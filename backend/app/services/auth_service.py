from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from fastapi import Depends, HTTPException, status, Request, Cookie # Import Request and Cookie
from sqlalchemy.orm import Session
# Removed OAuth2PasswordBearer import as it's no longer used
from sqlalchemy.orm import Session
from ..models.schemas import TokenData, UserLogin
from ..models.database import User, get_db
import json
import bcrypt
import logging # Import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY") # Remove default value
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Removed OAuth2PasswordBearer definition

# Path to users file
# NOTE: This dual storage (JSON + DB) is complex and prone to inconsistency.
# Ideally, rely solely on the database as the source of truth.
USER_DB_PATH = os.path.join(os.path.dirname(__file__), '../data/users.json')

# Create users directory if it doesn't exist
os.makedirs(os.path.dirname(USER_DB_PATH), exist_ok=True)

def get_users() -> Dict[str, Any]:
    """Load users from JSON file or create empty dict if file doesn't exist"""
    try:
        with open(USER_DB_PATH, 'r') as f:
            # Ensure the loaded data has a "users" key which is a list
            data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("users"), list):
                return data
            else:
                logger.warning("users.json format is incorrect or missing 'users' list. Resetting.")
                return {"users": []}
    except (FileNotFoundError, json.JSONDecodeError):
        logger.info("users.json not found or invalid JSON. Returning empty users list.")
        return {"users": []}

def save_users(users_data: Dict[str, Any]) -> None:
    """Save users to JSON file"""
    try:
        with open(USER_DB_PATH, 'w') as f:
            json.dump(users_data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving users to JSON: {e}")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify that a plain password matches the hashed password"""
    # Handle potential errors during verification (e.g., invalid hash format)
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Error verifying password: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Generate a hash for a password"""
    return pwd_context.hash(password)

# Removed get_user function as it's replaced by DB query in authenticate_user

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate a user against the SQL database."""
    logger.info(f"Attempting to authenticate user (DB): {username}")
    db: Session = next(get_db())
    user: Optional[User] = None
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            logger.warning(f"Authentication failed: User '{username}' not found in DB.")
            return None
        if not verify_password(password, user.hashed_password):
            logger.warning(f"Authentication failed: Invalid password for user '{username}'.")
            return None

        logger.info(f"Authentication successful for user (DB): {username}")
        # Return user info needed for token creation
        return {"username": user.username, "role": user.role, "id": user.id}
    except Exception as e:
        logger.error(f"Error during DB authentication for user '{username}': {e}", exc_info=True)
        return None
    finally:
        db.close()


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(
    # Read the token from a cookie named '__Host-access_token_cookie'
    access_token_cookie: Optional[str] = Cookie(None)
) -> Dict[str, Any]:
    """Get the current user from JWT token, verifying against DB."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    db: Session = next(get_db())
    try:
        # Check if the cookie exists
        if access_token_cookie is None:
            logger.warning("Attempted access without access token cookie.")
            raise credentials_exception

        payload = jwt.decode(access_token_cookie, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        token_role: Optional[str] = payload.get("role") # Get role from token
        if username is None:
            logger.warning("JWT decode failed: 'sub' (username) missing.")
            raise credentials_exception
        token_data = TokenData(username=username, role=token_role) # Include role

        # Fetch user details from DB
        user = db.query(User).filter(User.username == token_data.username).first()
        if user is None:
            logger.warning(f"User '{token_data.username}' from token not found in DB.")
            raise credentials_exception

        # Verify role consistency
        if user.role != token_data.role:
            logger.warning(f"Role mismatch for user '{token_data.username}'. Token: {token_data.role}, DB: {user.role}")
            raise credentials_exception

        # Return user info as dict
        return {
            "username": user.username,
            "role": user.role,
            "id": user.id,
            "created_at": user.created_at
        }

    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Error in get_current_user: {e}", exc_info=True)
        raise credentials_exception
    finally:
        db.close()


def create_user(username: str, password: str, role: str) -> Optional[Dict[str, Any]]:
    """Create a new user, prioritizing SQL DB as source of truth."""
    logger.info(f"Attempting to create user: {username}")
    db: Session = next(get_db())
    db_user_instance: Optional[User] = None # Renamed to avoid confusion with return dict
    users_data = get_users() # Still load JSON for potential update

    try:
        # 1. Check if username exists in SQL Database (Primary Check)
        logger.info(f"Checking DB for existing user: {username}")
        db_exists = db.query(User).filter(User.username == username).first() is not None
        logger.info(f"DB check result for {username}: exists={db_exists}")

        if db_exists:
            logger.warning(f"User '{username}' already exists in DB. Registration aborted.")
            return None # User already exists

        # 2. Hash password
        logger.info(f"Hashing password for user: {username}")
        hashed_password = get_password_hash(password)

        # 3. Create SQLAlchemy User object (Let DB generate ID)
        logger.info(f"Creating SQLAlchemy User object for: {username}")
        db_user_instance = User(
            username=username,
            hashed_password=hashed_password,
            role=role
        )

        # 4. Add to DB session and commit
        logger.info(f"Adding user {username} to DB session.")
        db.add(db_user_instance)
        logger.info(f"Committing transaction for user: {username}")
        db.commit()
        logger.info(f"Refreshing DB user instance for: {username}")
        db.refresh(db_user_instance) # Get the generated ID and other defaults
        logger.info(f"User '{username}' successfully created in DB with ID {db_user_instance.id}.")

        # 5. Update and Save JSON file (Now that DB is confirmed)
        try:
            logger.info(f"Attempting to save user {username} (ID: {db_user_instance.id}) to JSON.")
            # Create dict for JSON, using the DB-generated ID
            user_dict_for_json = {
                "id": db_user_instance.id,
                "username": username,
                "hashed_password": hashed_password, # Storing hash in JSON too
                "role": role
            }
            # Ensure "users" list exists
            users_data.setdefault("users", []).append(user_dict_for_json)
            save_users(users_data)
            logger.info(f"User '{username}' also saved to JSON.")
        except Exception as json_e:
            # Log error but don't fail the whole process if JSON save fails
            logger.error(f"Warning: Failed to save user '{username}' to JSON after DB creation: {json_e}")

        # 6. Return user info (excluding password hash)
        user_info = {
            "id": db_user_instance.id,
            "username": db_user_instance.username,
            "role": db_user_instance.role
        }
        logger.info(f"Returning created user info for {username}: {user_info}")
        return user_info

    except Exception as e:
        logger.error(f"!!! Exception during DB operation for user '{username}': {str(e)}", exc_info=True) # Log stack trace
        db.rollback() # Rollback DB transaction on any error during DB phase
        logger.info(f"DB transaction rolled back for user: {username}")
        return None # Indicate failure

    finally:
        logger.info(f"Closing DB session for create_user request: {username}")
        db.close() # Ensure session is always closed


def get_user_id_from_username(username: str) -> Optional[int]:
    """Get user ID from username (querying DB)."""
    logger.info(f"Getting user ID for username (DB): {username}")
    db: Session = next(get_db())
    user: Optional[User] = None
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            logger.info(f"Found user ID {user.id} for username {username}")
            return user.id
        else:
            logger.warning(f"Could not find user ID for username (DB): {username}")
            return None
    except Exception as e:
         logger.error(f"Error getting user ID for '{username}': {e}", exc_info=True)
         return None
    finally:
        db.close()