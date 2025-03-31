import axios from 'axios';
// Import SimpleHistoryItem along with others
import { QueryRequest, FeedbackRequest, ChatSession, ChatSessionCreate, ChatSessionHistory, SimpleHistoryItem, RegisterRequest } from '../types'; // Added SimpleHistoryItem & RegisterRequest
import { authService } from './auth';
import { v4 as uuidv4 } from 'uuid';

// Define API_URL safely using React's environment variable pattern
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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
    baseURL: API_URL,
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
            authService.logout();
            window.location.href = '/'; // Redirect to login
        }
        return Promise.reject(error);
    }
);

// Create a public client without auth headers
const publicClient = axios.create({
    baseURL: API_URL, // Use the same base URL
});

// API service
export const api = {
    // --- Authentication ---
    register: async (params: RegisterRequest) => {
        // Registration is typically public
        const { data } = await publicClient.post('/api/register', params);
        return data;
    },
    // login: async (...) => { ... } // Add login if needed

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
    sendMessage: async (chatId: string, message: string, role: string): Promise<ChatMessage> => {
        const response = await apiClient.post('/api/query', {
            query: message,
            role: role,
            session_id: parseInt(chatId, 10)
        });
        const assistantContent = response.data?.choices?.[0]?.message?.content || "Error: Could not parse response.";
        return {
            id: uuidv4(),
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString(),
            persona: role
        };
    },
    sendOneOffMessage: async (message: string, role: string, history?: SimpleHistoryItem[]): Promise<ChatMessage> => {
        console.log('Sending one-off message:', { message, role, history });
        try {
            const payload: QueryRequest = {
                query: message,
                role: role.toLowerCase() || 'functional',
                history: history
            };
            const response = await publicClient.post('/api/public/query', payload);
            console.log('Response from backend:', response.data);
            const assistantContent = response.data?.choices?.[0]?.message?.content || "Error: Could not parse response.";
            return {
                id: uuidv4(),
                role: 'assistant',
                content: assistantContent,
                timestamp: new Date().toISOString(),
                persona: role
            };
        } catch (error) {
            console.error('Error sending one-off message:', error);
            return {
                id: uuidv4(),
                role: 'assistant',
                content: "Sorry, I encountered an error processing your request. Please try again later.",
                timestamp: new Date().toISOString(),
                persona: role
            };
        }
    },

    // --- Deprecated/Combined ---
    // deleteChat: async (chatId: string): Promise<void> => {
    //     await api.deleteChatSession(parseInt(chatId, 10)); // Use the correct session endpoint
    // }
};