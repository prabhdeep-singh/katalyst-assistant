from sqlalchemy.ext.asyncio import AsyncSession # Use AsyncSession
from sqlalchemy import select, update, delete # Import select, update, delete
from sqlalchemy.orm import selectinload # For eager loading relationships if needed
from typing import List, Optional, Dict, Any
from datetime import datetime

from ..models.database import ChatSession, ChatMessage, ChatResponse, User
from ..models.schemas import (
    ChatSessionCreate, 
    ChatMessageCreate, 
    ChatResponseCreate,
    ChatSession as ChatSessionSchema,
    ChatMessage as ChatMessageSchema,
    ChatResponse as ChatResponseSchema,
    ChatHistoryItem
)

class ChatHistoryService:
    @staticmethod
    async def create_session(db: AsyncSession, user_id: int, title: str = "New Conversation") -> ChatSession:
        """Create a new chat session for a user"""
        db_session = ChatSession(
            user_id=user_id,
            title=title
        )
        db.add(db_session)
        await db.commit()
        await db.refresh(db_session)
        return db_session
    
    @staticmethod
    async def get_user_sessions(db: AsyncSession, user_id: int) -> List[ChatSession]:
        """Get all chat sessions for a user"""
        result = await db.execute(
            select(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
        )
        return result.scalars().all()
    
    @staticmethod
    async def get_session_by_id(db: AsyncSession, session_id: int, user_id: int) -> Optional[ChatSession]:
        """Get a specific chat session by ID"""
        result = await db.execute(
            select(ChatSession).filter(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id
            )
        )
        return result.scalars().first()
    
    @staticmethod
    async def update_session(db: AsyncSession, session_id: int, user_id: int, title: str) -> Optional[ChatSession]:
        """Update a chat session title"""
        db_session = await ChatHistoryService.get_session_by_id(db, session_id, user_id)
        if db_session:
            db_session.title = title
            db_session.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(db_session)
        return db_session
    
    @staticmethod
    async def delete_session(db: AsyncSession, session_id: int, user_id: int) -> bool:
        """Delete a chat session and all its messages"""
        db_session = await ChatHistoryService.get_session_by_id(db, session_id, user_id)
        if db_session:
            await db.delete(db_session) # Use await
            await db.commit()
            return True
        return False
    
    @staticmethod
    async def save_message_and_response(
        db: AsyncSession,
        user_id: int,
        message_data: ChatMessageCreate,
        response_data: ChatResponseCreate,
        session_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Save a user message and the corresponding AI response"""
        # Create a session if one is not provided
        if not session_id:
            # Use first few words of query as session title
            words = message_data.content.split()
            title = " ".join(words[:5]) + "..." if len(words) > 5 else message_data.content
            db_session = await ChatHistoryService.create_session(db, user_id, title)
            session_id = db_session.id
        else:
            # Update the session's timestamp
            db_session = await ChatHistoryService.get_session_by_id(db, session_id, user_id)
            if db_session:
                db_session.updated_at = datetime.utcnow()
                await db.commit()
        
        # Save the user's query
        db_message = ChatMessage(
            user_id=user_id,
            session_id=session_id,
            message_type="query",
            content=message_data.content,
            role=message_data.role
        )
        db.add(db_message)
        # Commit message first to get its ID
        await db.commit()
        await db.refresh(db_message)
        
        # Save the system's response
        db_response = ChatResponse(
            message_id=db_message.id,
            content=response_data.content,
            disclaimers=response_data.disclaimers or []
        )
        db.add(db_response)
        
        # Also save the response as a message for better querying
        db_response_message = ChatMessage(
            user_id=user_id,
            session_id=session_id,
            message_type="response",
            content=response_data.content,
            role="assistant"
        )
        db.add(db_response_message)
        
        # Commit response and response_message
        await db.commit()
        
        return {
            "message": db_message,
            "response": db_response,
            "response_message": db_response_message,
            "session_id": session_id
        }
    
    @staticmethod
    async def get_session_messages(db: AsyncSession, session_id: int, user_id: int, limit: Optional[int] = None) -> List[ChatHistoryItem]: # Added limit parameter
        """Get messages in a chat session, optionally limited"""
        # Verify the session belongs to the user
        db_session = await ChatHistoryService.get_session_by_id(db, session_id, user_id)
        if not db_session:
            return []
        
        # Build the query for messages, always order chronologically (ascending)
        stmt = select(ChatMessage).filter(
            ChatMessage.session_id == session_id,
            ChatMessage.message_type == "query"  # We want the user queries to pair with responses
        ).order_by(ChatMessage.created_at.asc()) # Always sort ascending
        
        # Apply limit if provided (note: this limits the *oldest* messages, might want to limit newest)
        # If limiting newest is desired, the query needs rethinking (e.g., subquery or window function)
        # For now, keep the limit applying to the oldest if used.
        if limit is not None:
            # To limit the *most recent* N pairs, it's more complex.
            # A simpler approach for now is to fetch all and slice in Python,
            # but that's inefficient for long histories.
            # Sticking with limiting oldest for now as implemented in main.py.
            # If main.py stops sending limit, this won't apply.
            stmt = stmt.limit(limit)
            
        # Execute query
        result = await db.execute(stmt)
        db_messages = result.scalars().all()
        # No reversal needed as we query in ascending order now
        
        # Prepare the result with responses
        result = []
        for msg in db_messages:
            # Get the response associated with this message
            # Async query for response
            response_result = await db.execute(
                select(ChatResponse).filter(ChatResponse.message_id == msg.id)
            )
            db_response = response_result.scalars().first()
            
            # Create a ChatHistoryItem
            history_item = ChatHistoryItem(
                message=ChatMessageSchema.from_orm(msg),
                response=ChatResponseSchema.from_orm(db_response) if db_response else None
            )
            result.append(history_item)
        
        return result 