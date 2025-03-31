import React, { useState } from 'react';
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Stack,
    Heading,
    Text,
    Link,
    useColorModeValue,
    FormErrorMessage,
    InputGroup,
    InputRightElement,
    Icon,
    Flex,
    Container,
    Alert,
    AlertIcon,
} from '@chakra-ui/react';
import { authService } from '../services/auth';
import { FiEye, FiEyeOff } from 'react-icons/fi';

interface LoginProps {
    onLoginSuccess: () => void;
    onNavigateToRegister: () => void;
    onContinueAsGuest?: () => void;
}

export const Login: React.FC<LoginProps> = ({ 
    onLoginSuccess, 
    onNavigateToRegister,
    onContinueAsGuest
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setUsernameError(null);
        setPasswordError(null);
        
        // Validation
        let isValid = true;
        if (!username) {
            setUsernameError('Username is required');
            isValid = false;
        }
        if (!password) {
            setPasswordError('Password is required');
            isValid = false;
        }
        if (!isValid) return;

        setIsLoading(true);
        try {
            await authService.login(username, password);
            onLoginSuccess();
        } catch (err) {
            setError('Invalid credentials. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const togglePasswordVisibility = () => setShowPassword(!showPassword);

    return (
        <Container maxW="md" py={12}>
            <Flex direction="column" align="center">
                <Box 
                    w="full" 
                    bg={bgColor} 
                    p={8} 
                    borderRadius="lg" 
                    boxShadow="lg"
                    borderWidth="1px"
                    borderColor={borderColor}
                >
                    <Stack spacing={6}>
                        <Heading size="lg" textAlign="center" color="purple.500">
                            Login to Katalyst Assistant
                        </Heading>
                        
                        {error && (
                            <Alert status="error" borderRadius="md">
                                <AlertIcon />
                                {error}
                            </Alert>
                        )}
                        
                        <form onSubmit={handleSubmit}>
                            <Stack spacing={4}>
                                <FormControl isInvalid={!!usernameError} isRequired>
                                    <FormLabel>Username</FormLabel>
                                    <Input 
                                        type="text" 
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                    {usernameError && <FormErrorMessage>{usernameError}</FormErrorMessage>}
                                </FormControl>

                                <FormControl isInvalid={!!passwordError} isRequired>
                                    <FormLabel>Password</FormLabel>
                                    <InputGroup>
                                        <Input 
                                            type={showPassword ? 'text' : 'password'} 
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <InputRightElement width="3rem">
                                            <Button 
                                                h="1.5rem" 
                                                size="sm" 
                                                variant="ghost"
                                                onClick={togglePasswordVisibility}
                                            >
                                                <Icon as={showPassword ? FiEyeOff : FiEye} />
                                            </Button>
                                        </InputRightElement>
                                    </InputGroup>
                                    {passwordError && <FormErrorMessage>{passwordError}</FormErrorMessage>}
                                </FormControl>

                                <Button 
                                    type="submit" 
                                    colorScheme="purple" 
                                    size="md" 
                                    width="full"
                                    isLoading={isLoading}
                                    mt={4}
                                >
                                    Sign In
                                </Button>
                            </Stack>
                        </form>
                        
                        <Text mt={4} textAlign="center">
                            Don't have an account?{' '}
                            <Link 
                                color="purple.500" 
                                onClick={onNavigateToRegister}
                                textDecoration="underline"
                                _hover={{ color: 'purple.600' }}
                                cursor="pointer"
                            >
                                Sign Up
                            </Link>
                        </Text>
                        
                        {onContinueAsGuest && (
                            <>
                                <Box textAlign="center" py={2}>
                                    <Text fontSize="sm" color="gray.500">or</Text>
                                </Box>
                                <Button
                                    variant="outline"
                                    colorScheme="purple"
                                    width="full"
                                    onClick={onContinueAsGuest}
                                >
                                    Continue as Guest
                                </Button>
                            </>
                        )}
                    </Stack>
                </Box>
            </Flex>
        </Container>
    );
}; 