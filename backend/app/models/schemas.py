from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from .enums import UserRole

# Simple history item for guest mode context
class SimpleHistoryItem(BaseModel):
    role: str # 'user' or 'assistant'
    content: str

class QueryRequest(BaseModel):
    query: str
    role: str
    session_id: Optional[int] = None
    # Add history for guest mode context
    history: Optional[List[SimpleHistoryItem]] = None
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "query": "How to configure purchase order approval workflows?",
                    "role": "functional"
                }
            ]
        }
    }

class FeedbackRequest(BaseModel):
    response_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "response_id": "123e4567-e89b-12d3-a456-426614174000",
                    "rating": 4,
                    "comment": "Very helpful response"
                }
            ]
        }
    }

class LLMConfig(BaseModel):
    model_name: str
    api_key: str
    max_requests_per_minute: int = 60
    max_retries: int = 3
    timeout_seconds: int = 30

class SecurityConfig(BaseModel):
    max_query_length: int = 1000
    max_requests_per_ip: int = 100
    request_window_minutes: int = 60
    blocked_patterns: Optional[List[str]] = None

class PromptTemplate(BaseModel):
    system_prompt: str
    response_format: Dict[str, Any]

# Authentication models
class UserLogin(BaseModel):
    username: str
    password: str
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "username": "user@example.com",
                    "password": "securepassword"
                }
            ]
        }
    }

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "username": "user@example.com",
                    "password": "securepassword",
                    "role": "functional"
                }
            ]
        }
    }

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Optional[str] = None # Add optional role field
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer"
                }
            ]
        }
    }

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None

# Chat history models
class ChatMessageBase(BaseModel):
    message_type: str
    content: str
    role: str

class ChatMessageCreate(ChatMessageBase):
    session_id: Optional[int] = None

class ChatMessage(ChatMessageBase):
    id: int
    user_id: int
    session_id: int
    created_at: datetime
    
    model_config = {
        "from_attributes": True
    }

class ChatResponseBase(BaseModel):
    content: str
    disclaimers: Optional[List[str]] = None

class ChatResponseCreate(ChatResponseBase):
    pass

class ChatResponse(ChatResponseBase):
    id: int
    message_id: int
    created_at: datetime
    
    model_config = {
        "from_attributes": True
    }

class ChatSessionBase(BaseModel):
    title: str

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSession(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "from_attributes": True
    }

class ChatHistoryItem(BaseModel):
    message: ChatMessage
    response: Optional[ChatResponse] = None
    
    model_config = {
        "from_attributes": True
    }

class ChatSessionList(BaseModel):
    sessions: List[ChatSession]

class ChatSessionHistory(BaseModel):
    session: ChatSession
    messages: List[ChatHistoryItem] 