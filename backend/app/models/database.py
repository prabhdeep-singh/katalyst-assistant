# Use async components from SQLAlchemy
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, ARRAY, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import relationship, declarative_base # declarative_base moved here
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import logging # Add logging import

# Configure logging (if not already configured elsewhere)
# logging.basicConfig(level=logging.INFO) # Uncomment if needed
logger = logging.getLogger(__name__)

# --- Database Connection Setup ---
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD") # Consider using a secrets manager in production
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432") # Default PostgreSQL port
DB_NAME = os.getenv("DB_NAME")

# Check if essential variables are set
if not all([DB_USER, DB_PASSWORD, DB_HOST, DB_NAME]):
    logger.error("Database connection details missing in environment variables (DB_USER, DB_PASSWORD, DB_HOST, DB_NAME).")
    # Optionally, raise an exception or exit if connection is critical
    # raise ValueError("Missing essential database environment variables.")
    # Fallback to SQLite for local development if desired, or handle error appropriately
    DATABASE_URL = "sqlite:///./fallback.db" # Example fallback
    logger.warning("Falling back to SQLite database: " + DATABASE_URL)
else:
    # Construct the database URL for PostgreSQL
    # Using asyncpg driver as recommended for FastAPI/asyncio
    DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    logger.info(f"Connecting to database: postgresql+asyncpg://{DB_USER}:***@{DB_HOST}:{DB_PORT}/{DB_NAME}") # Log without password

# Create SQLAlchemy engine and session
# Add connect_args for potential SSL configuration if needed for Supabase/Cloud SQL
# Example: connect_args={"ssl": "require"} if needed
# Create async engine and session
engine = create_async_engine(DATABASE_URL, echo=False) # echo=False for less verbose logs, set True for debugging SQL
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# Create base class for models
Base = declarative_base()

# Define User model
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")

# Define ChatSession model (groups messages into conversations)
class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

# Define ChatMessage model for storing user queries and system responses
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    message_type = Column(String)  # 'query' or 'response'
    content = Column(Text)
    role = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="chat_messages")
    session = relationship("ChatSession", back_populates="messages")
    response_data = relationship("ChatResponse", back_populates="message", uselist=False, cascade="all, delete-orphan")

# Define ChatResponse model to store additional response data
class ChatResponse(Base):
    __tablename__ = "chat_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("chat_messages.id"))
    content = Column(Text)
    disclaimers = Column(ARRAY(String))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    message = relationship("ChatMessage", back_populates="response_data")

# Async function to get DB session
async def get_db() -> AsyncSession: # Type hint for clarity
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback() # Rollback on error within the context
            raise
        finally:
            # No explicit close needed with async context manager
            pass

# Async function to create all tables in the database
async def create_tables():
    async with engine.begin() as conn:
        # Use run_sync for metadata creation which is typically synchronous
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables checked/created.")