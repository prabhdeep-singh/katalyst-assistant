from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
import os
import json # Needed for parsing CORS origins
from dotenv import load_dotenv
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import logging
import traceback # For detailed error logging

# Rate Limiting Imports
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Model and Service Imports
from .models.enums import UserRole
from .models.schemas import (
    QueryRequest, FeedbackRequest, LLMConfig, SecurityConfig, Token, UserCreate,
    ChatSessionCreate, ChatMessageCreate, ChatResponseCreate, ChatSession,
    ChatHistoryItem, ChatSessionList, ChatSessionHistory
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

# Create database tables if they don't exist
create_tables()

# --- Rate Limiting Setup ---
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Middleware Setup ---

# Configure CORS
# Read allowed origins from environment variable
# Expected format: JSON string array, e.g., '["https://localhost", "https://your-domain.com"]'
cors_origins_str = os.getenv("BACKEND_CORS_ORIGINS", '[]') # Default to empty list string
allowed_origins = ["*"] # Default to allow all if parsing fails or env var is empty/missing
try:
    parsed_origins = json.loads(cors_origins_str)
    if isinstance(parsed_origins, list) and len(parsed_origins) > 0:
        allowed_origins = parsed_origins
    elif cors_origins_str and cors_origins_str != '[]': # Handle non-empty, non-list strings if needed
         # Simple comma-separated list fallback (optional)
         # allowed_origins = [origin.strip() for origin in cors_origins_str.split(',')]
         logger.warning(f"BACKEND_CORS_ORIGINS is not a valid JSON list, using default '*'. Value: {cors_origins_str}")
         allowed_origins = ["*"] # Fallback to allow all if format is wrong but var exists
    else:
         # If empty list '[]' or not set, default to allowing all for easier local dev
         logger.info("BACKEND_CORS_ORIGINS not set or empty, allowing all origins ('*').")
         allowed_origins = ["*"]

except json.JSONDecodeError:
    logger.error(f"Failed to parse BACKEND_CORS_ORIGINS JSON string: {cors_origins_str}. Allowing all origins ('*').")
    allowed_origins = ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins, # Use the parsed or default list
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Log CORS settings
logger.info(f"CORS configured with allow_origins: {allowed_origins}")


# Initialize services
prompt_engine = PromptEngine()

# --- API Endpoints ---

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

@app.post("/api/token", response_model=Token)
@limiter.limit("10/minute") # Apply rate limit
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """Generate JWT token for user authentication."""
    logger.info(f"Login attempt for user: {form_data.username}")
    user = authenticate_user(form_data.username, form_data.password)
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
    logger.info(f"Login successful, token generated for user: {form_data.username}")
    return {"access_token": access_token, "token_type": "bearer", "role": user.get("role")}

@app.post("/api/register")
@limiter.limit("5/hour") # Stricter limit for registration
async def register_user(request: Request, user_data: UserCreate):
    """Register a new user."""
    logger.info(f"Registration attempt for user: {user_data.username}")
    user = create_user(user_data.username, user_data.password, user_data.role.value)
    if not user:
        logger.warning(f"Registration failed for user: {user_data.username} (Username likely exists)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists or registration failed."
        )
    logger.info(f"Registration successful for user: {user_data.username}")
    return {"message": "User created successfully"}

@app.post("/api/query", response_model=Dict[str, Any])
@limiter.limit("60/minute") # Rate limit for authenticated queries
async def process_query(
    request: Request, # Add request for rate limiter
    query_request: QueryRequest, # Rename variable to avoid conflict
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process queries from authenticated users, include history, and save"""
    session_id_for_saving: Optional[int] = query_request.session_id
    final_response_content: str = "An error occurred while processing your request."
    llm_call_successful = False

    try:
        logger.info(f"Processing query for user: {current_user.get('username')}, session: {query_request.session_id}, role: {query_request.role}")
        user_id = get_user_id_from_username(current_user.get("username"))
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
                model_name=os.getenv("LLM_MODEL", "gemini-pro"),
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
            "disclaimers": [
                "This response is generated by an AI system...", # Truncated for brevity
                "Community content references...",
                "For critical business decisions..."
            ] if llm_call_successful else ["Failed to get a valid response from the assistant."]
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
            disclaimers=response_for_frontend['disclaimers']
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
@limiter.limit("30/minute") # Rate limit for public queries
async def process_public_query(request: Request, query_request: QueryRequest): # Add request, rename body param
    """Process queries from public/unauthenticated users, include history"""
    logger.info(f"Processing public query. Role: {query_request.role}, History provided: {bool(query_request.history)}")
    try:
        model_name = os.getenv("LLM_MODEL", "gemini-pro")
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
             "disclaimers": [
                "This response is generated by an AI system...", # Truncated
                "Community content references...",
                "For critical business decisions...",
                "You are using the public version..."
            ] if llm_call_successful else ["Failed to get a valid response from the assistant."]
        }
        return response_for_frontend
    except Exception as e:
        logger.error(f"Error in process_public_query: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


@app.post("/api/feedback")
@limiter.limit("10/minute") # Limit feedback submissions
async def submit_feedback(
    request: Request, # Add request for rate limiter
    feedback: FeedbackRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
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
    db: Session = Depends(get_db)
):
    """Get all chat sessions for the current user"""
    user_id = get_user_id_from_username(current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    sessions = await ChatHistoryService.get_user_sessions(db, user_id)
    return {"sessions": sessions}

@app.post("/api/chat/sessions", response_model=ChatSession)
@limiter.limit("20/minute")
async def create_chat_session(
    request: Request, # Add request
    session_data: ChatSessionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new chat session"""
    user_id = get_user_id_from_username(current_user["username"])
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
    db: Session = Depends(get_db)
):
    """Get chat history for a specific session"""
    user_id = get_user_id_from_username(current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    session = await ChatHistoryService.get_session_by_id(db, session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = await ChatHistoryService.get_session_messages(db, session_id, user_id)
    return {"session": session, "messages": messages}

@app.put("/api/chat/sessions/{session_id}", response_model=ChatSession)
@limiter.limit("30/minute")
async def update_chat_session(
    request: Request, # Add request
    session_id: int,
    session_data: ChatSessionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a chat session's title"""
    user_id = get_user_id_from_username(current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    session = await ChatHistoryService.update_session(db, session_id, user_id, session_data.title)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    logger.info(f"Updated title for session {session_id}")
    return session

@app.delete("/api/chat/sessions/{session_id}")
@limiter.limit("30/minute")
async def delete_chat_session(
    request: Request, # Add request
    session_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat session and all its messages"""
    user_id = get_user_id_from_username(current_user["username"])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    success = await ChatHistoryService.delete_session(db, session_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    logger.info(f"Deleted session {session_id} for user {user_id}")
    return {"status": "success", "message": "Session deleted"}