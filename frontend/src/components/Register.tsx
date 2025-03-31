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
    Select,
} from '@chakra-ui/react';
import { authService } from '../services/auth';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { UserRole } from '../types'; // Import UserRole enum

interface RegisterProps {
    onRegisterSuccess: () => void;
    onNavigateToLogin: () => void;
    onContinueAsGuest?: () => void;
}

export const Register: React.FC<RegisterProps> = ({
    onRegisterSuccess,
    onNavigateToLogin,
    onContinueAsGuest
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        role: UserRole.FUNCTIONAL, // Default to a valid UserRole enum value
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        // Handle Select specifically to ensure value is treated as UserRole
        const newValue = name === 'role' ? value as UserRole : value;
        setFormData(prev => ({ ...prev, [name]: newValue }));

        // Clear error when field is modified
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.username) {
            newErrors.username = 'Username is required';
        } else if (!/^\S+@\S+\.\S+$/.test(formData.username)) {
            // Basic email format check
            newErrors.username = 'Username must be a valid email address';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (!formData.role || !Object.values(UserRole).includes(formData.role)) {
             newErrors.role = 'Please select a valid role';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) return;

        setIsLoading(true);
        try {
            // Pass the UserRole enum value directly
            await authService.register(
                formData.username,
                formData.password,
                formData.role // This is now UserRole type
            );
            // Display success message before calling callback
             setError("Registration successful! Please log in.");
             // Optionally delay navigation or let user click login link
             // onRegisterSuccess(); // Call this if you want immediate navigation/state change
        } catch (err: any) {
            // Use the error message thrown by authService
            setError(err.message || 'Registration failed. Please try again.');
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
                            Create Your Account
                        </Heading>

                        {error && (
                            <Alert status={error.includes("successful") ? "success" : "error"} borderRadius="md">
                                <AlertIcon />
                                {error}
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit}>
                            <Stack spacing={4}>
                                <FormControl isInvalid={!!errors.username} isRequired>
                                    <FormLabel>Email</FormLabel>
                                    <Input
                                        name="username"
                                        type="email"
                                        placeholder="Enter your email"
                                        value={formData.username}
                                        onChange={handleChange}
                                    />
                                    {errors.username && (
                                        <FormErrorMessage>{errors.username}</FormErrorMessage>
                                    )}
                                </FormControl>

                                <FormControl isInvalid={!!errors.password} isRequired>
                                    <FormLabel>Password</FormLabel>
                                    <InputGroup>
                                        <Input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Create a password (min. 6 characters)"
                                            value={formData.password}
                                            onChange={handleChange}
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
                                    {errors.password && (
                                        <FormErrorMessage>{errors.password}</FormErrorMessage>
                                    )}
                                </FormControl>

                                <FormControl isInvalid={!!errors.confirmPassword} isRequired>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <Input
                                        name="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Confirm your password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                    />
                                    {errors.confirmPassword && (
                                        <FormErrorMessage>{errors.confirmPassword}</FormErrorMessage>
                                    )}
                                </FormControl>

                                <FormControl isInvalid={!!errors.role} isRequired>
                                    <FormLabel>Role</FormLabel>
                                    <Select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                    >
                                        {/* Map over UserRole enum values */}
                                        {Object.values(UserRole).map(roleValue => (
                                            <option key={roleValue} value={roleValue}>
                                                {/* Simple capitalization for display */}
                                                {roleValue.charAt(0).toUpperCase() + roleValue.slice(1).toLowerCase().replace('_', ' ')}
                                            </option>
                                        ))}
                                    </Select>
                                    {errors.role && (
                                        <FormErrorMessage>{errors.role}</FormErrorMessage>
                                    )}
                                </FormControl>

                                <Button
                                    type="submit"
                                    colorScheme="purple"
                                    size="md"
                                    width="full"
                                    isLoading={isLoading}
                                    mt={4}
                                >
                                    Sign Up
                                </Button>
                            </Stack>
                        </form>

                        <Text mt={4} textAlign="center">
                            Already have an account?{' '}
                            <Link
                                color="purple.500"
                                onClick={onNavigateToLogin}
                                textDecoration="underline"
                                _hover={{ color: 'purple.600' }}
                                cursor="pointer"
                            >
                                Sign In
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