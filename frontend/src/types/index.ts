export enum UserRole {
    FUNCTIONAL = "functional",
    TECHNICAL = "technical",
    ADMINISTRATOR = "administrator",
    KEY_USER = "key_user",
    END_USER = "end_user",
    PROJECT_MANAGER = "project_manager",
    TESTER = "tester"
}

// Simple history item for guest mode context (matches backend schema)
export interface SimpleHistoryItem {
    role: 'user' | 'assistant';
    content: string;
}

export interface QueryRequest {
    query: string;
    role: string;
    session_id?: number;
    history?: SimpleHistoryItem[]; // Added history for guest mode
}

export interface FeedbackRequest {
    response_id: string;
    rating: number;
    comment?: string;
}

export interface Message {
    type: 'query' | 'response';
    content: string;
    disclaimers?: string[];
}

// Authentication related types
export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
    role: UserRole;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
}

export interface User {
    username: string;
    role: UserRole;
}

// Chat history related types
export interface ChatSessionCreate {
    title: string;
}

export interface ChatSession {
    id: number;
    user_id: number;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface ChatMessageBase {
    message_type: 'query' | 'response';
    content: string;
    role: string; // This is the persona role for the query
}

export interface ChatMessage extends ChatMessageBase {
    id: number;
    user_id: number;
    session_id: number;
    created_at: string;
}

export interface ChatResponseBase {
    content: string;
    disclaimers?: string[];
}

export interface ChatResponseData extends ChatResponseBase {
    id: number;
    message_id: number;
    created_at: string;
}

export interface ChatHistoryItem {
    message: ChatMessage;
    response?: ChatResponseData;
}

export interface ChatSessionList {
    sessions: ChatSession[];
}

export interface ChatSessionHistory {
    session: ChatSession;
    messages: ChatHistoryItem[];
}