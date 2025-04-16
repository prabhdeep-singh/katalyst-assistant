import axios from 'axios';
import { api } from './api'; // Import the api service
import { RegisterRequest, UserRole, UserRead } from '../types'; // Import necessary types, including UserRead
import { jwtDecode } from 'jwt-decode'; // Import jwt-decode - Keep for potential future use if needed, but not for auth token
import Cookies from 'js-cookie'; // Import js-cookie for reading CSRF token
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
    // private tokenKey = 'katalyst_assistant_auth_token'; // No longer storing token in localStorage
    private csrfCookieName = 'csrf_token_cookie'; // Updated to match backend cookie name

    
        // Login user and store JWT token
        async login(username: string, password: string): Promise<void> {
            try {
                // Use the login method from the api service
                const formData = new URLSearchParams({
                    username: username,
                    password: password,
                });
                const response = await api.login(formData); // Call the exported api.login
    
                // Backend now sets HttpOnly cookie for auth and non-HttpOnly for CSRF.
                // We just check for success.
                if (response && response.message === "Login successful") {
                    console.log("Login successful, cookies set by backend.");
                    // REMOVED: No longer need to manually set the CSRF cookie here
                    // if (response.csrf_token) { ... }
                } else {
                    console.error("Login response indicates failure:", response);
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
        // Call the backend logout endpoint to clear cookies
        api.logout().then(() => {
            console.log("Logout successful, cookies cleared by backend.");
        }).catch((error: any) => { // Add explicit type 'any' to error parameter
            console.error("Logout API call failed:", error);
            // Optionally force remove frontend cookies if API fails?
            // Cookies.remove(this.csrfCookieName); // Example if needed
        });
    }

    // Check if user is authenticated (token exists and is not expired)
    isAuthenticated(): boolean {
        // Check if the CSRF token cookie exists as an indicator of an active session
        // Note: This isn't foolproof, as the auth cookie could expire before the CSRF one.
        // A better check might involve making a quick API call to a protected endpoint.
        const csrfToken = Cookies.get(this.csrfCookieName); // Reads 'csrf_token_cookie'
        return !!csrfToken; // Returns true if the cookie exists, false otherwise
    }

    // Get user info by decoding the token
    // Updated: Now fetches user info from the backend API asynchronously
    async getCurrentUser(): Promise<UserRead | null> {
        // Check authentication status first (e.g., cookie presence)
        if (!this.isAuthenticated()) {
            return null;
        }
        try {
            const userInfo = await api.getCurrentUserInfo();
            return userInfo;
        } catch (error) {
            console.error("Failed to fetch current user info:", error);
            // Handle error appropriately, maybe logout if it's an auth error (e.g., 401)
            // Depending on error handling in api.ts interceptor, a 401 might already trigger logout/redirect
            return null;
        }
    }

    // Get the authentication token
    // getToken(): string | null { // Obsolete - cannot access HttpOnly cookie
    //     return localStorage.getItem(this.tokenKey);
    // }

    // Set the authentication token
    // private setToken(token: string): void { // Obsolete
    //     localStorage.setItem(this.tokenKey, token);
    // }

    // Removed private setUser method

    // Get auth header for API requests (used by apiClient interceptor)
    // getAuthHeader(): { Authorization: string } | {} { // Obsolete
    //     const token = this.getToken();
    //     if (token) {
    //         return { Authorization: `Bearer ${token}` };
    //     }
    //     return {};
    // }
}

export const authService = new AuthService();