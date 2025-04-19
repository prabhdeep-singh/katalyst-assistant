import os
import secrets
from fastapi import FastAPI, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
import json
from dotenv import load_dotenv
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession # Use AsyncSession
import logging
import traceback

# Rate Limiting Imports
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Model and Service Imports
from .models.enums import UserRole
from .models.schemas import (
    QueryRequest, FeedbackRequest, LLMConfig, SecurityConfig, Token, UserCreate, UserRead,
    ChatSessionCreate, ChatMessageCreate, ChatResponseCreate, ChatSession,
    ChatHistoryItem, ChatSessionList, ChatSessionHistory, ChatMessageUpdate
)
from .models.database import get_db, create_tables
from .services.llm_service import EnhancedLLMWrapper
from .services.prompt_engine import PromptEngine
from .services.auth_service import (
    authenticate_user, create_access_token, get_current_user, create_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, get_user_id_from_username
)
from .services.chat_history_service import ChatHistoryService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# --- Security Check: Ensure SECRET_KEY is set ---
if not os.getenv("SECRET_KEY"):
    logger.critical("FATAL ERROR: SECRET_KEY environment variable not set.")
    # In a real scenario, you might exit here:
    # import sys
    # sys.exit("Application cannot start without a SECRET_KEY.")

# --- FastAPI App Initialization ---
# Create the app instance *before* configuring rate limiting or startup events
app = FastAPI()

# --- Rate Limiting Setup ---
# Check if rate limiting is enabled (default to True)
rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in ["true", "1", "yes"]
guest_mode_enabled = os.getenv("GUEST_MODE_ENABLED", "true").lower() in ["true", "1", "yes"]

# Define DummyLimiter first so it's always available
class DummyLimiter:
    def limit(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator

if rate_limit_enabled:
    limiter = Limiter( # Assign to limiter variable
        key_func=get_remote_address,
        default_limits=[os.getenv("RATE_LIMIT_DEFAULT", "60/minute")]
    )
    # Configure the existing app instance
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("Rate limiting is enabled with default limit: " + os.getenv("RATE_LIMIT_DEFAULT", "60/minute"))
else:
    limiter = DummyLimiter() # Assign to limiter variable
    # No need to configure app state for the dummy limiter
    logger.info("Rate limiting is disabled")
# --- Async Startup Event ---
# Define the startup event *after* app is created
@app.on_event("startup")
async def startup_event():
    """Create database tables on startup."""
    logger.info("Running startup event...")
    await create_tables() # Await the async function
    logger.info("Startup event finished.")
# --- End Async Startup Event ---
    
# These lines are now handled within the corrected if/else block above

# --- Middleware Setup ---

# Configure CORS
# Get CORS origins from environment variable
cors_origins_str = os.getenv("BACKEND_CORS_ORIGINS", '[]') # Default to empty list string
cors_origins = ["*"] # Default to allow all origins

# Get cookie domain from environment variable
cookie_domain = os.getenv("COOKIE_DOMAIN", None)  # Default to None (current domain)

try:
    if cors_origins_str and cors_origins_str != "[]":
        cors_origins = json.loads(cors_origins_str)
        if not isinstance(cors_origins, list):
            logger.warning(f"BACKEND_CORS_ORIGINS is not a valid JSON list, using default '*'. Value: {cors_origins_str}")
            cors_origins = ["*"]
    else:
        logger.info("BACKEND_CORS_ORIGINS not set or empty, allowing all origins ('*').")
except json.JSONDecodeError as e:
    logger.error(f"Failed to parse BACKEND_CORS_ORIGINS JSON string: {cors_origins_str}. Allowing all origins ('*').")
    cors_origins = ["*"]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins, # Use the parsed or default list
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Add security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Log CORS settings
logger.info(f"CORS configured with allow_origins: {cors_origins}")

# Initialize services
prompt_engine = PromptEngine()

# --- Define CSRF Verification Dependency ---
async def verify_csrf(request: Request):
    # Get token from non-HttpOnly cookie
    csrf_cookie = request.cookies.get("csrf_token_cookie")
    # Get token from request header (sent by frontend JS)
    csrf_header = request.headers.get("X-CSRF-Token")

    if not csrf_cookie or not csrf_header:
        logger.warning("CSRF cookie or header missing.")
        raise HTTPException(status_code=403, detail="CSRF token missing")

    try:
        is_valid = secrets.compare_digest(csrf_cookie, csrf_header)
    except Exception: # Handle potential errors during comparison
        logger.warning("Error comparing CSRF tokens.")
        is_valid = False

    if not is_valid:
        logger.warning("CSRF token mismatch.")
        raise HTTPException(status_code=403, detail="CSRF token mismatch")
    # If tokens match, request proceeds implicitly
    logger.debug("CSRF token verified successfully.")
# --- End CSRF Dependency ---

# --- API Endpoints ---

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/api/config")
async def get_app_config():
    """Returns application configuration settings."""
    logger.info(f"Sending app config: guest_mode_enabled={guest_mode_enabled}")
    return {"guest_mode_enabled": guest_mode_enabled}

# Get rate limits from environment variables or use defaults
rate_limit_login = os.getenv("RATE_LIMIT_LOGIN", "5/minute")
rate_limit_register = os.getenv("RATE_LIMIT_REGISTER", "2/hour")
rate_limit_logout = os.getenv("RATE_LIMIT_LOGOUT", "5/minute")
rate_limit_query = os.getenv("RATE_LIMIT_QUERY", "30/minute")
rate_limit_public_query = os.getenv("RATE_LIMIT_PUBLIC_QUERY", "15/minute")
rate_limit_create_session = os.getenv("RATE_LIMIT_CREATE_SESSION", "30/minute")
rate_limit_update_session = os.getenv("RATE_LIMIT_UPDATE_SESSION", "20/minute")
rate_limit_delete_session = os.getenv("RATE_LIMIT_DELETE_SESSION", "20/minute")
rate_limit_update_message = os.getenv("RATE_LIMIT_UPDATE_MESSAGE", "20/minute")

@app.post("/api/token")
@limiter.limit(rate_limit_login)
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db) # Add db dependency
):
    """Authenticate user, set HttpOnly auth cookie and CSRF cookie + token."""
    logger.info(f"Login attempt for user: {form_data.username}")
    # Authenticate user (needs to be async now)
    user = await authenticate_user(form_data.username, form_data.password, db=db) # Pass db
    if not user:
        logger.warning(f"Login failed for user: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user.get("role", "unknown")},
        expires_delta=access_token_expires
    )

    # --- Manual CSRF Double Submit Cookie ---
    csrf_token = secrets.token_urlsafe(32) # Generate secure token

    # Set HttpOnly cookie for the access token
    response.set_cookie(
        key="access_token_cookie",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",  # Changed from "lax" to "strict"
        domain=cookie_domain,  # Add domain if set
        max_age=int(access_token_expires.total_seconds())
    )

    # Set non-HttpOnly cookie for the CSRF token
    response.set_cookie(
        key="csrf_token_cookie",
        value=csrf_token,
        httponly=False,  # MUST be False for JS access
        secure=True,
        samesite="strict",  # Changed from "lax" to "strict"
        domain=cookie_domain,  # Add domain if set
        max_age=int(access_token_expires.total_seconds())  # Match access token expiry
    )
    # --- End CSRF ---

    logger.info(f"Login successful for user: {form_data.username}")

    # Return user info AND the CSRF token value
    return {
        "message": "Login successful",
        "user": {"username": user["username"], "role": user.get("role")},
        # "csrf_token": csrf_token # REMOVED: Frontend reads the cookie directly now
    }

@app.post("/api/register")
@limiter.limit(rate_limit_register)
async def register_user(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)): # Add db dependency
    """Register a new user."""
    logger.info(f"Registration attempt for user: {user_data.username}")
    # Create user (needs to be async now)
    user = await create_user(user_data.username, user_data.password, user_data.role.value, db=db) # Pass db
    if not user:
        logger.warning(f"Registration failed for user: {user_data.username} (Username likely exists)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists or registration failed."
        )
    logger.info(f"Registration successful for user: {user_data.username}")
    return {"message": "User created successfully"}

@app.post("/api/logout")
@limiter.limit(rate_limit_logout)
async def logout_user(request: Request, response: Response):
    """Logout user by clearing cookies."""
    logger.info("Logout attempt: Clearing cookies.")
    response.delete_cookie(
        key="access_token_cookie",
        httponly=True,
        secure=True,
        samesite="strict",  # Changed from "lax" to "strict"
        domain=cookie_domain  # Add domain if set
    )
    response.delete_cookie(
        key="csrf_token_cookie",
        httponly=False,
        secure=True,
        samesite="strict",  # Changed from "lax" to "strict"
        domain=cookie_domain  # Add domain if set
    )
    logger.info("Cookies cleared for logout.")
    return {"message": "Successfully logged out"}

@app.get("/api/users/me", response_model=UserRead)
async def read_users_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Fetch details for the currently authenticated user."""
    # The get_current_user dependency already returns a dict with id, username, role
    # FastAPI will automatically filter this based on the UserRead response_model
    return current_user

@app.post("/api/query", response_model=Dict[str, Any])
@limiter.limit(rate_limit_query)
async def process_query(
    request: Request,
    query_request: QueryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db), # Use AsyncSession
    csrf_check: None = Depends(verify_csrf)
):
    """Process queries from authenticated users, include history, and save"""
    session_id_for_saving: Optional[int] = query_request.session_id
    final_response_content: str = "An error occurred while processing your request."
    llm_call_successful = False

    try:
        logger.info(f"Processing query for user: {current_user.get('username')}, session: {query_request.session_id}, role: {query_request.role}")
        # Get user ID (needs to be async now)
        user_id = await get_user_id_from_username(db, current_user.get("username"))
        if not user_id:
            logger.error(f"Could not find user ID for username: {current_user.get('username')}")
            raise HTTPException(status_code=404, detail="User not found")

        chat_history = None
        if query_request.session_id:
            logger.info(f"Fetching history for session: {query_request.session_id}")
            history_items = await ChatHistoryService.get_session_messages(
                db, query_request.session_id, user_id, limit=10
            )
            # chat_history = history_items[::-1] # No longer needed, service returns ascending
            chat_history = history_items
            logger.info(f"Fetched {len(chat_history) if chat_history else 0} history items.")

        assistant = EnhancedLLMWrapper(
            config=LLMConfig(
                model_name=os.getenv("LLM_MODEL", "gemini-2.0-flash-lite"),
                api_key=os.getenv("GEMINI_API_KEY", "")
            )
        )

        logger.info("Generating prompt...")
        prompt = prompt_engine.generate_prompt(
            query=query_request.query,
            role=UserRole[query_request.role.upper()],
            history=chat_history
        )
        logger.info(f"Generated prompt length: {len(prompt)}")

        logger.info("Making LLM API call...")
        llm_response_dict = await assistant._make_api_call(prompt)
        logger.info(f"Received LLM response dict: {llm_response_dict}")

        choices = llm_response_dict.get("choices")
        if isinstance(choices, list) and len(choices) > 0:
            message = choices[0].get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    final_response_content = content
                    llm_call_successful = True
                    logger.info("Successfully parsed LLM response content.")
                else:
                    logger.error(f"LLM response 'content' is not a string: {content}")
            else:
                logger.error(f"LLM response 'message' is not a dict: {message}")
        else:
            logger.error(f"LLM response 'choices' is not a list or is empty: {choices}")
            error_detail = llm_response_dict.get("error", {}).get("message", "Unknown LLM API error")
            final_response_content = f"Error from LLM API: {error_detail}"

        response_for_frontend = {
            "choices": [{"message": {"content": final_response_content}}],
            "session_id": query_request.session_id,
        }

        logger.info(f"Saving message and response to history for session: {query_request.session_id}")
        message_data = ChatMessageCreate(
            message_type="query",
            content=query_request.query,
            role=query_request.role,
            session_id=query_request.session_id
        )
        response_data = ChatResponseCreate(
            content=final_response_content,
            # disclaimers removed as they are now handled statically in frontend
        )

        history_entry = await ChatHistoryService.save_message_and_response(
            db=db, user_id=user_id, message_data=message_data,
            response_data=response_data, session_id=session_id_for_saving
        )
        logger.info(f"History saved. Msg ID: {history_entry.get('message_id')}, Session ID: {history_entry.get('session_id')}")

        response_for_frontend['session_id'] = history_entry.get("session_id")
        return response_for_frontend

    except HTTPException as http_exc:
         logger.error(f"HTTPException in process_query: {http_exc.detail}")
         raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error in process_query: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


@app.post("/api/public/query")
@limiter.limit(rate_limit_public_query)
async def process_public_query(
    request: Request,
    query_request: QueryRequest,
    # No CSRF needed for public endpoint
):
    """Process queries from public/unauthenticated users, include history"""
    # --- Add Guest Mode Check ---
    if not guest_mode_enabled:
        logger.warning("Public query attempt failed: Guest mode is disabled.")
        raise HTTPException(status_code=403, detail="Guest access is disabled.")
    # --- End Guest Mode Check ---

    logger.info(f"Processing public query. Role: {query_request.role}, History provided: {bool(query_request.history)}")
    try:
        model_name = os.getenv("LLM_MODEL", "gemini-2.0-flash-lite")
        api_key = os.getenv("GEMINI_API_KEY", "")
        assistant = EnhancedLLMWrapper(
            config=LLMConfig(model_name=model_name, api_key=api_key)
        )

        role_upper = query_request.role.upper() if query_request.role else "FUNCTIONAL"
        prompt = prompt_engine.generate_prompt(
            query=query_request.query,
            role=UserRole[role_upper],
            history=query_request.history
        )
        logger.info(f"Generated public prompt length: {len(prompt)}")

        logger.info("Making public LLM API call...")
        llm_response_dict = await assistant._make_api_call(prompt)
        logger.info(f"Received public LLM response dict: {llm_response_dict}")

        final_response_content = "An error occurred while processing your request."
        llm_call_successful = False
        choices = llm_response_dict.get("choices")
        if isinstance(choices, list) and len(choices) > 0:
            message = choices[0].get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    final_response_content = content
                    llm_call_successful = True
                    logger.info("Successfully parsed public LLM response content.")
                else:
                    logger.error(f"Public LLM response 'content' is not a string: {content}")
            else:
                logger.error(f"Public LLM response 'message' is not a dict: {message}")
        else:
            logger.error(f"Public LLM response 'choices' is not a list or is empty: {choices}")
            error_detail = llm_response_dict.get("error", {}).get("message", "Unknown LLM API error")
            final_response_content = f"Error from LLM API: {error_detail}"

        response_for_frontend = {
            "choices": [{"message": {"content": final_response_content}}],
             # disclaimers removed as they are now handled statically in frontend
        }
        return response_for_frontend
    except Exception as e:
        logger.error(f"Error in process_public_query: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


@app.post("/api/feedback")
@limiter.limit("10/minute")
async def submit_feedback(
    request: Request,
    feedback: FeedbackRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    csrf_check: None = Depends(verify_csrf)
):
    logger.info(f"Feedback received from user {current_user.get('username')}: {feedback}")
    # Implement feedback storage logic here
    return {"status": "success", "message": "Feedback received"}

# --- Chat History Endpoints (Apply rate limits if needed) ---

@app.get("/api/chat/sessions", response_model=ChatSessionList)
@limiter.limit("60/minute")
async def get_chat_sessions(
    request: Request, # Add request
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db) # Use AsyncSession
):
    """Get all chat sessions for the current user"""
    # Get user ID (needs to be async now)
    user_id = await get_user_id_from_username(db, current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    sessions = await ChatHistoryService.get_user_sessions(db, user_id)
    return {"sessions": sessions}

@app.post("/api/chat/sessions", response_model=ChatSession)
@limiter.limit(rate_limit_create_session)
async def create_chat_session(
    request: Request,
    session_data: ChatSessionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db), # Use AsyncSession
    csrf_check: None = Depends(verify_csrf)
):
    """Create a new chat session"""
    # Get user ID (needs to be async now)
    user_id = await get_user_id_from_username(db, current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    session = await ChatHistoryService.create_session(db, user_id, session_data.title)
    logger.info(f"Created new chat session {session.id} for user {user_id}")
    return session

@app.get("/api/chat/sessions/{session_id}", response_model=ChatSessionHistory)
@limiter.limit("60/minute")
async def get_chat_session_history(
    request: Request, # Add request
    session_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db) # Use AsyncSession
):
    """Get chat history for a specific session"""
    # Get user ID (needs to be async now)
    user_id = await get_user_id_from_username(db, current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    session = await ChatHistoryService.get_session_by_id(db, session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = await ChatHistoryService.get_session_messages(db, session_id, user_id)
    return {"session": session, "messages": messages}

@app.put("/api/chat/sessions/{session_id}", response_model=ChatSession)
@limiter.limit(rate_limit_update_session)
async def update_chat_session(
    request: Request,
    session_id: int,
    session_data: ChatSessionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db), # Use AsyncSession
    csrf_check: None = Depends(verify_csrf)
):
    """Update a chat session's title"""
    # Get user ID (needs to be async now)
    user_id = await get_user_id_from_username(db, current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    session = await ChatHistoryService.update_session(db, session_id, user_id, session_data.title)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    logger.info(f"Updated title for session {session_id}")
    return session

@app.delete("/api/chat/sessions/{session_id}")
@limiter.limit(rate_limit_delete_session)
async def delete_chat_session(
    request: Request,
    session_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db), # Use AsyncSession
    csrf_check: None = Depends(verify_csrf)
):
    """Delete a chat session and all its messages"""
    # Get user ID (needs to be async now)
    user_id = await get_user_id_from_username(db, current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    success = await ChatHistoryService.delete_session(db, session_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    logger.info(f"Deleted session {session_id} for user {user_id}")
    return {"status": "success", "message": "Session deleted"}

@app.put("/api/chat/sessions/{session_id}/messages/{message_id}")
@limiter.limit(rate_limit_update_message)
async def update_chat_message(
    request: Request,
    session_id: str,
    message_id: str,
    message_data: ChatMessageUpdate,
    csrf_check: None = Depends(verify_csrf),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db) # Use AsyncSession
):
    # Get user ID (needs to be async now)
    user_id = await get_user_id_from_username(db, current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify session ownership
    session = await ChatHistoryService.get_session(db, session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Get and verify message ownership
    message = await ChatHistoryService.get_message(db, message_id, session_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Update message
    message.content = message_data.content
    message.metadata = message_data.metadata
    
    # Save changes
    await db.commit()
    await db.refresh(message)
    
    logger.info(f"Updated message {message_id} in session {session_id} for user {user_id}")
    return message