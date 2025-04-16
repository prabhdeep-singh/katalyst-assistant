import React, { useState, useEffect } from 'react';
import { ChakraProvider, Box, Center, Spinner, useDisclosure } from '@chakra-ui/react'; // Import useDisclosure
import { QueryClient, QueryClientProvider } from 'react-query';
import { Header } from './components/Header';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ChatInterface } from './components/ChatInterface';
import { authService } from './services/auth';
import { api, AppConfig } from './services/api'; // Import api and AppConfig
import theme from './theme';
import { UserRole, UserRead } from './types'; // Import UserRole and UserRead

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
type LoadingState = 'loading' | 'loaded'; // Add loading state type

const App: React.FC = () => {
    const { isOpen, onOpen, onClose } = useDisclosure(); // Lifted drawer state
    const [authState, setAuthState] = useState<AuthState>('login');
    const [authLoadingState, setAuthLoadingState] = useState<LoadingState>('loading'); // Add loading state
    // State for current user info, fetched from API
    const [currentUserInfo, setCurrentUserInfo] = useState<UserRead | null>(null);
    const [appConfig, setAppConfig] = useState<AppConfig | null>(null); // State for app config

    // Function to fetch config and check auth status
    const initializeApp = async () => {
        setAuthLoadingState('loading'); // Start loading
        let configFetched = false;
        let authChecked = false;
        try { // Outer try for the whole initialization process
            // Fetch App Config
            try {
                const config = await api.getAppConfig();
                setAppConfig(config);
                configFetched = true;
                console.log("App config fetched:", config);
            } catch (configError) {
                console.error("Error fetching app config:", configError);
                // Default guest mode to false on config fetch error
                setAppConfig({ guest_mode_enabled: false });
                configFetched = true; // Mark as fetched even on error to proceed
            }

            // Check Auth Status (only after config attempt)
            if (authService.isAuthenticated()) { // Check cookie
                const userInfo = await authService.getCurrentUser(); // Fetch user info async
                if (userInfo && userInfo.role) {
                    setCurrentUserInfo(userInfo); // Store the full user object
                    setAuthState('authenticated');
                } else {
                    // API call failed or returned null user, treat as logged out
                    console.warn("Could not fetch user info or invalid role, logging out.");
                    authService.logout(); // Ensure cookies are cleared
                    setCurrentUserInfo(null);
                    setAuthState('login');
                }
            } else {
                setAuthState('login'); // Not authenticated, go to login
                setCurrentUserInfo(null);
            }
            authChecked = true; // Mark auth check as done

        } catch (error) { // Catch errors from the outer try (e.g., authService.getCurrentUser)
            console.error("Error during app initialization:", error);
            setAuthState('login'); // Default to login on error
            setCurrentUserInfo(null);
            // Ensure config is set to a default if auth check fails before config fetch completes
            if (!configFetched) {
                 setAppConfig({ guest_mode_enabled: false });
            }
            authChecked = true; // Mark auth check as done even on error
        } finally {
            // Only set loaded state when both config fetch attempt and auth check are done
            if (configFetched && authChecked) {
                setAuthLoadingState('loaded');
            }
        }
    }; // End of initializeApp function

    // Check auth status on initial load
    useEffect(() => {
        initializeApp(); // Call the initialization function
    }, []);

    // Handle login success: token is set by authService.login, just update state
    const handleLoginSuccess = () => {
        initializeApp(); // Re-run initialization which includes fetching user info
    };

    // Handle register success - User needs to login after register
    const handleRegisterSuccess = () => {
        // Navigate to login, maybe show a success toast
        setAuthState('login');
    };

    // Handle logout
    const handleLogout = () => {
        authService.logout();
        setCurrentUserInfo(null); // Clear user info
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
        setCurrentUserInfo(null); // Ensure user info is null in guest mode
    };

    // Check if user is authenticated (for UI components)
    const isAuthenticated = authState === 'authenticated';

    // Show loading spinner while checking auth
    if (authLoadingState === 'loading') {
        return (
            <ChakraProvider theme={theme}>
                <Center h="100vh">
                    <Spinner size="xl" />
                </Center>
            </ChakraProvider>
        );
    }

    return (
        <ChakraProvider theme={theme}>
            <QueryClientProvider client={queryClient}>
                <Box minH="100vh" display="flex" flexDirection="column">
                    <Header
                        isAuthenticated={isAuthenticated}
                        currentUser={currentUserInfo} // Pass the full user object
                        isGuestMode={authState === 'public'}
                        onLogout={handleLogout}
                        onLoginClick={navigateToLogin}
                        onMenuOpen={onOpen} // Pass onOpen for the hamburger button
                    />

                    {authState === 'login' && (
                        <Login
                            onLoginSuccess={handleLoginSuccess}
                            onNavigateToRegister={navigateToRegister}
                            onContinueAsGuest={switchToPublicMode}
                            isGuestModeAllowed={appConfig?.guest_mode_enabled ?? false} // Pass down config state
                        />
                    )}

                    {authState === 'register' && (
                        <Register
                            onRegisterSuccess={handleRegisterSuccess}
                            onNavigateToLogin={navigateToLogin}
                            onContinueAsGuest={switchToPublicMode}
                            isGuestModeAllowed={appConfig?.guest_mode_enabled ?? false} // Pass down config state
                        />
                    )}

                    {(authState === 'authenticated' || authState === 'public') && (
                        <ChatInterface
                            isAuthenticated={isAuthenticated}
                            // Pass the user role if authenticated
                            userRole={isAuthenticated ? currentUserInfo?.role ?? null : null} // Get role from user object
                            isDrawerOpen={isOpen} // Pass drawer state
                            onDrawerClose={onClose} // Pass drawer close handler
                        />
                    )}
                </Box>
            </QueryClientProvider>
        </ChakraProvider>
    );
};

export default App;
