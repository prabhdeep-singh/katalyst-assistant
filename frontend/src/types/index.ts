// Shared types between frontend and backend

// User Roles Enum (ensure this matches backend models/enums.py)
export enum UserRole {
    TECHNICAL = 'technical',
    FUNCTIONAL = 'functional',
    ADMINISTRATOR = 'administrator',
    KEY_USER = 'key_user',
    END_USER = 'end_user',
    PROJECT_MANAGER = 'project_manager',
    TESTER = 'tester',
}

// Request Payloads
export interface QueryRequest {
    query: string;
    role: string; // Keep as string for flexibility in selection
    session_id?: number | null; // Optional session ID for history
    history?: SimpleHistoryItem[] | null; // Optional simple history for public queries
}

export interface FeedbackRequest {
    query: string;
    response: string;
    rating: number; // e.g., 1-5
    comment?: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
    role: UserRole;
}

export interface ChatSessionCreate {
    title: string;
}

// API Responses (ensure these match backend models/schemas.py)
export interface Token {
    access_token: string;
    token_type: string;
    role?: UserRole; // Include role if returned by backend /token endpoint
}

// Define LoginResponse based on what /api/token returns
// Updated: No longer returns token directly
export interface LoginResponse {
    message: string; // e.g., "Login successful"
    user?: { // Optional user info
        username: string;
        role: UserRole | string; // Role might be enum or string
    };
    csrf_token?: string; // CSRF token returned by the backend
}

// User info returned by /api/users/me
export interface UserRead {
    id: number;
    username: string;
    role: UserRole; // Use the enum
    created_at: string; // Assuming ISO string format
}


export interface ChatSession {
    id: number;
    user_id: number;
    title: string;
    created_at: string; // Assuming ISO string format
    updated_at: string; // Assuming ISO string format
}

export interface ChatMessageBase {
    id?: number; // Optional for creation
    session_id: number;
    user_id: number;
    message_type: 'query' | 'response';
    content: string;
    role: string; // UserRole for query, 'assistant' for response
    created_at: string;
}

export interface ChatResponseBase {
    id?: number; // Optional for creation
    message_id: number;
    content: string;
    disclaimers?: string[];
    created_at: string;
}

export interface ChatHistoryItem {
    message: ChatMessageBase;
    response: ChatResponseBase | null;
}

export interface ChatSessionHistory {
    session: ChatSession;
    messages: ChatHistoryItem[];
}

export interface ChatSessionList {
    sessions: ChatSession[];
}

// Simplified history item for public queries
export interface SimpleHistoryItem {
    role: 'user' | 'assistant';
    content: string;
}