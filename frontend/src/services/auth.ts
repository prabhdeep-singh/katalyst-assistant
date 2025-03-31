import axios from 'axios';
import { api } from './api'; // Import the api service
import { RegisterRequest, UserRole } from '../types'; // Import necessary types
import { jwtDecode } from 'jwt-decode'; // Import jwt-decode
// Removed unused API_URL constant, using apiClient/publicClient baseURL instead

// Interface for the decoded JWT payload
interface DecodedToken {
    sub: string; // Subject (usually username/email)
    role: string; // User role
    exp: number; // Expiration timestamp
    // Add other claims if present in your token
}

// Interface for user info derived from token
interface UserInfo {
    username: string;
    role: UserRole | null; // Use UserRole enum, allow null if role is invalid
}


class AuthService {
    private tokenKey = 'katalyst_assistant_auth_token';

    
        // Login user and store JWT token
        async login(username: string, password: string): Promise<void> {
            try {
                // Use the login method from the api service
                const formData = new URLSearchParams({
                    username: username,
                    password: password,
                });
                const response = await api.login(formData); // Call the exported api.login
    
                // Access token directly from the response object now
                if (response.access_token) {
                    this.setToken(response.access_token);
                    // No longer setting user info in localStorage here
                } else {
                    console.error("Login response missing token:", response); // Log the whole response
                    throw new Error('Login failed: Invalid response from server.');
                }
        } catch (error: any) {
             console.error("Login error:", error);
             const errorMsg = error.response?.data?.detail || error.message || 'Login failed';
             throw new Error(errorMsg);
        }
    }

    // Register a new user using the api service
    async register(
        username: string,
        password: string,
        role: UserRole
    ): Promise<any> {
        const payload: RegisterRequest = { username, password, role };
        try {
            const response = await api.register(payload);
            console.log("Registration successful:", response);
            return response;
        } catch (error: any) {
            console.error("Registration error in authService:", error);
            const errorMsg = error.response?.data?.detail || error.message || 'Registration failed';
            throw new Error(errorMsg);
        }
    }

    // Logout user by removing token
    logout(): void {
        localStorage.removeItem(this.tokenKey);
        // Removed localStorage.removeItem(this.userKey);
    }

    // Check if user is authenticated (token exists and is not expired)
    isAuthenticated(): boolean {
        const token = this.getToken();
        if (!token) {
            return false;
        }
        try {
            const decoded = jwtDecode<DecodedToken>(token);
            // Check if token is expired
            const isExpired = Date.now() >= decoded.exp * 1000;
            if (isExpired) {
                this.logout(); // Clean up expired token
                return false;
            }
            return true;
        } catch (error) {
            console.error("Error decoding token:", error);
            this.logout(); // Clean up invalid token
            return false;
        }
    }

    // Get user info by decoding the token
    getCurrentUser(): UserInfo | null {
        const token = this.getToken();
        if (!token) return null;

        try {
            const decoded = jwtDecode<DecodedToken>(token);
            // Validate role from token against UserRole enum
            const roleKey = decoded.role?.toUpperCase() as keyof typeof UserRole;
            const validRole = UserRole[roleKey] ? UserRole[roleKey] : null;

            return {
                username: decoded.sub,
                role: validRole
            };
        } catch (e) {
            console.error('Error decoding token for user info', e);
            // Optionally logout if token is invalid
            // this.logout();
            return null;
        }
    }

    // Get the authentication token
    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    // Set the authentication token
    private setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token);
    }

    // Removed private setUser method

    // Get auth header for API requests (used by apiClient interceptor)
    getAuthHeader(): { Authorization: string } | {} {
        const token = this.getToken();
        if (token) {
            return { Authorization: `Bearer ${token}` };
        }
        return {};
    }
}

export const authService = new AuthService();