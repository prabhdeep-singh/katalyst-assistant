import axios from 'axios';
// Import SimpleHistoryItem along with others
import { QueryRequest, FeedbackRequest, ChatSession, ChatSessionCreate, ChatSessionHistory, SimpleHistoryItem, RegisterRequest, LoginResponse } from '../types'; // Added SimpleHistoryItem, RegisterRequest, LoginResponse
import { authService } from './auth';
import { v4 as uuidv4 } from 'uuid';

// Define API_URL safely using React's environment variable pattern
const API_URL = process.env.REACT_APP_API_URL || 'https://localhost'; // Default to HTTPS localhost

// Define the frontend ChatMessage interface (might differ slightly from backend)
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    persona: string;
}

// Define ChatConversation if needed by frontend logic (e.g., sidebar)
export interface ChatConversation {
    id: string; // Assuming string ID from backend session
    title: string;
    // messages might not be needed directly here if fetched separately
    messages?: ChatMessage[]; // Optional based on usage
    created_at: string;
    updated_at?: string; // Add if available/needed
}


const apiClient = axios.create({
    baseURL: API_URL, // Use the env variable for the base
});

// Add a request interceptor to attach the auth token
apiClient.interceptors.request.use(
    config => {
        const token = authService.getToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle token expiration
apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            // Avoid logout loop if the error is from the token refresh endpoint itself
            if (!error.config.url?.includes('/api/token')) {
                authService.logout();
                // Use relative path for redirect to ensure it works regardless of deployment domain
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

// Create a public client without auth headers for specific public endpoints
const publicClient = axios.create({
    baseURL: API_URL, // Use the same base URL
});

// API service
export const api = {
    // --- Authentication ---
    login: async (formData: URLSearchParams): Promise<LoginResponse> => {
        // Login uses the public client as no token exists yet
        const { data } = await publicClient.post<LoginResponse>('/api/token', formData, {
             headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return data;
    },
    register: async (params: RegisterRequest) => {
        // Registration is typically public
        const { data } = await publicClient.post('/api/register', params);
        return data;
    },

    // --- Queries ---
    submitQuery: async (params: QueryRequest) => {
        const { data } = await apiClient.post('/api/query', params);
        return data;
    },
    submitPublicQuery: async (params: QueryRequest) => {
        const { data } = await publicClient.post('/api/public/query', params);
        return data;
    },

    // --- Feedback ---
    submitFeedback: async (params: FeedbackRequest) => {
        const { data } = await apiClient.post('/api/feedback', params);
        return data;
    },

    // --- Chat Sessions ---
    getChatSessions: async (): Promise<ChatSession[]> => {
        const { data } = await apiClient.get<{ sessions: ChatSession[] }>('/api/chat/sessions');
        return data.sessions;
    },
    createChatSession: async (params: ChatSessionCreate): Promise<ChatSession> => {
        const { data } = await apiClient.post<ChatSession>('/api/chat/sessions', params);
        return data;
    },
    getChatSessionHistory: async (sessionId: number): Promise<ChatSessionHistory> => {
        const { data } = await apiClient.get<ChatSessionHistory>(`/api/chat/sessions/${sessionId}`);
        return data;
    },
    updateChatSession: async (sessionId: number, params: ChatSessionCreate): Promise<ChatSession> => {
        const { data } = await apiClient.put<ChatSession>(`/api/chat/sessions/${sessionId}`, params);
        return data;
    },
    deleteChatSession: async (sessionId: number): Promise<{ status: string, message: string }> => {
        const { data } = await apiClient.delete<{ status: string, message: string }>(`/api/chat/sessions/${sessionId}`);
        return data;
    },

    // --- Messaging ---
    // Note: sendMessage and sendOneOffMessage now primarily handle the API call structure,
    // the actual transformation/state update happens in ChatInterface.tsx mutation callbacks.
    sendMessage: async (chatId: string, message: string, role: string): Promise<any> => { // Return raw response data
        const { data } = await apiClient.post('/api/query', {
            query: message,
            role: role,
            session_id: parseInt(chatId, 10)
        });
        return data; // Return the raw API response
    },
    sendOneOffMessage: async (message: string, role: string, history?: SimpleHistoryItem[]): Promise<any> => { // Return raw response data
        console.log('Sending one-off message:', { message, role, history });
        try {
            const payload: QueryRequest = {
                query: message,
                role: role.toLowerCase() || 'functional',
                history: history
            };
            const { data } = await publicClient.post('/api/public/query', payload);
            console.log('Response from backend:', data);
            return data; // Return the raw API response
        } catch (error) {
            console.error('Error sending one-off message:', error);
            // Re-throw the error so the mutation's onError can handle it
            throw error;
        }
    },
};

// Export publicClient separately if needed elsewhere, though usually interacting via `api` object is preferred
// export { publicClient };