import axios from 'axios';
// Import SimpleHistoryItem along with others
import { QueryRequest, FeedbackRequest, ChatSession, ChatSessionCreate, ChatSessionHistory, SimpleHistoryItem, RegisterRequest, LoginResponse, UserRead } from '../types'; // Added UserRead
// Removed authService import as it's no longer needed here for token
import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie'; // Import js-cookie to read CSRF token

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

// Define AppConfig interface
export interface AppConfig {
    guest_mode_enabled: boolean;
}


const apiClient = axios.create({
    baseURL: API_URL, // Use the env variable for the base
});

// REMOVED: Old interceptor for Authorization: Bearer header
// apiClient.interceptors.request.use(
//     config => {
//         const token = authService.getToken(); // This caused the error as getToken was removed
//         if (token) {
//             config.headers = config.headers || {};
//             config.headers.Authorization = `Bearer ${token}`;
//         }
//         return config;
//     },
//     error => {
//         return Promise.reject(error);
//     }
// );

// Add a request interceptor to include the CSRF token header for relevant methods
apiClient.interceptors.request.use(
    config => {
        const method = config.method?.toLowerCase();
        // Add CSRF token for state-changing methods
        if (method === 'post' || method === 'put' || method === 'delete' || method === 'patch') {
            const csrfToken = Cookies.get('csrf_token_cookie'); // Updated to match backend cookie name
            if (csrfToken) {
                config.headers = config.headers || {};
                config.headers['X-CSRF-Token'] = csrfToken;
            } else {
                console.warn('CSRF token cookie (csrf_token_cookie) not found for state-changing request.');
                // Don't prevent the request, let the backend handle CSRF validation
            }
        }
        return config;
    },
    error => Promise.reject(error)
);

// Add a response interceptor to handle token expiration
apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            // Avoid logout loop if the error is from the token refresh endpoint itself
            if (!error.config.url?.includes('/api/token')) {
                // Cannot call authService.logout() directly here as it might cause loops
                // Just redirect, authService.isAuthenticated() check on reload will handle state
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
    // --- Application Configuration ---
    getAppConfig: async (): Promise<AppConfig> => {
        // Config should be fetched using public client as it's needed before login
        const { data } = await publicClient.get<AppConfig>('/api/config');
        return data;
    },

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
    logout: async (): Promise<{ message: string }> => {
        // Logout uses the authenticated client to ensure cookies are sent
        const { data } = await apiClient.post<{ message: string }>('/api/logout');
        return data;
    },
    getCurrentUserInfo: async (): Promise<UserRead> => {
        // Get user info from the protected endpoint
        const { data } = await apiClient.get<UserRead>('/api/users/me');
        return data;
    },

    // --- Queries ---
    submitQuery: async (params: QueryRequest) => {
        const { data } = await apiClient.post('/api/query', params);
        return data;
    },
    submitPublicQuery: async (params: QueryRequest) => {
        // This endpoint is now handled by sendOneOffMessage which returns ChatMessage
        console.warn("submitPublicQuery is deprecated, use sendOneOffMessage");
        const { data } = await publicClient.post('/api/public/query', params);
        return data; // Returns raw backend response structure
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
        // Transform backend response to ChatMessage format for mutation onSuccess
        const assistantContent = data?.choices?.[0]?.message?.content || "Error: Could not parse response.";
        return {
            id: uuidv4(), // Generate frontend ID
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString(),
            persona: role
        };
    },
    sendOneOffMessage: async (message: string, role: string, history?: SimpleHistoryItem[]): Promise<ChatMessage> => { // Return ChatMessage
        console.log('Sending one-off message:', { message, role, history });
        try {
            const payload: QueryRequest = {
                query: message,
                role: role.toLowerCase() || 'functional',
                history: history
            };
            const response = await publicClient.post('/api/public/query', payload);
            console.log('Response from backend:', response.data);
            // Parse the specific structure from /api/public/query
            const assistantContent = response.data?.choices?.[0]?.message?.content || "Error: Could not parse response.";
            // Return the expected ChatMessage structure
            return {
                id: uuidv4(), // Generate frontend ID
                role: 'assistant',
                content: assistantContent,
                timestamp: new Date().toISOString(),
                persona: role
            };
        } catch (error) {
            console.error('Error sending one-off message:', error);
            // Return an error message in the expected ChatMessage structure
            return {
                id: uuidv4(),
                role: 'assistant',
                content: "Sorry, I encountered an error processing your request. Please try again later.",
                timestamp: new Date().toISOString(),
                persona: role
            };
        }
    },
};

// Export publicClient separately if needed elsewhere, though usually interacting via `api` object is preferred
// export { publicClient };