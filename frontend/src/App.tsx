import React, { useState, useEffect } from 'react';
import { ChakraProvider, Box } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Header } from './components/Header';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ChatInterface } from './components/ChatInterface';
import { authService } from './services/auth';
import theme from './theme';
import { UserRole } from './types'; // Import UserRole

// Create a client for React Query
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: false,
        },
    },
});

// Define auth states
type AuthState = 'login' | 'register' | 'authenticated' | 'public';

const App: React.FC = () => {
    const [authState, setAuthState] = useState<AuthState>('login');
    // State for current user's role, derived from token
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

    // Function to check auth status and update state
    const checkAuthStatus = () => {
        if (authService.isAuthenticated()) {
            const userInfo = authService.getCurrentUser(); // Decodes token
            if (userInfo && userInfo.role) {
                // Role is already validated as UserRole | null in getCurrentUser
                setCurrentUserRole(userInfo.role);
                setAuthState('authenticated');
            } else {
                // Invalid token or missing role claim
                console.warn("Invalid token or missing role claim, logging out.");
                handleLogout(); // Force logout
            }
        } else {
            setAuthState('login'); // Not authenticated, go to login
            setCurrentUserRole(null);
        }
    };

    // Check auth status on initial load
    useEffect(() => {
        checkAuthStatus();
    }, []);

    // Handle login success: token is set by authService.login, just update state
    const handleLoginSuccess = () => {
        checkAuthStatus(); // Re-check auth status which decodes token and sets state
    };

    // Handle register success - User needs to login after register
    const handleRegisterSuccess = () => {
        // Navigate to login, maybe show a success toast
        setAuthState('login');
    };

    // Handle logout
    const handleLogout = () => {
        authService.logout();
        setCurrentUserRole(null); // Clear user role
        setAuthState('login');
    };

    // Navigate to login page
    const navigateToLogin = () => {
        setAuthState('login');
    };

    // Navigate to register page
    const navigateToRegister = () => {
        setAuthState('register');
    };

    // Switch to public/guest mode
    const switchToPublicMode = () => {
        setAuthState('public');
        setCurrentUserRole(null); // Ensure role is null in guest mode
    };

    // Check if user is authenticated (for UI components)
    const isAuthenticated = authState === 'authenticated';

    return (
        <ChakraProvider theme={theme}>
            <QueryClientProvider client={queryClient}>
                <Box minH="100vh" display="flex" flexDirection="column">
                    <Header
                        isAuthenticated={isAuthenticated}
                        isGuestMode={authState === 'public'}
                        onLogout={handleLogout}
                        onLoginClick={navigateToLogin}
                    />

                    {authState === 'login' && (
                        <Login
                            onLoginSuccess={handleLoginSuccess}
                            onNavigateToRegister={navigateToRegister}
                            onContinueAsGuest={switchToPublicMode}
                        />
                    )}

                    {authState === 'register' && (
                        <Register
                            onRegisterSuccess={handleRegisterSuccess}
                            onNavigateToLogin={navigateToLogin}
                            onContinueAsGuest={switchToPublicMode}
                        />
                    )}

                    {(authState === 'authenticated' || authState === 'public') && (
                        <ChatInterface
                            isAuthenticated={isAuthenticated}
                            // Pass the user role if authenticated
                            userRole={isAuthenticated ? currentUserRole : null}
                        />
                    )}
                </Box>
            </QueryClientProvider>
        </ChakraProvider>
    );
};

export default App;
