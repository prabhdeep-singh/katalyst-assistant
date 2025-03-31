import React from 'react';
import {
    Box,
    Heading,
    useColorModeValue,
    Container,
    Flex,
    Button,
    Text,
    HStack,
    Avatar,
    IconButton,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    Tooltip,
    useColorMode
} from '@chakra-ui/react';
import { authService } from '../services/auth';
import { FiUser, FiLogOut, FiMoon, FiSun } from 'react-icons/fi';

interface HeaderProps {
    onLogout: () => void;
    isAuthenticated: boolean;
    isGuestMode?: boolean;
    onLoginClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
    onLogout, 
    isAuthenticated, 
    isGuestMode = false,
    onLoginClick 
}) => {
    const { colorMode, toggleColorMode } = useColorMode();
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const user = authService.getCurrentUser();
    
    return (
        <Box
            as="header"
            bg={bgColor}
            borderBottom="1px"
            borderColor={borderColor}
            py={3}
            h="60px"
        >
            <Container maxW="1200px">
                <Flex justifyContent="space-between" alignItems="center">
                    {/* Logo and Title */}
                    <Flex alignItems="center">
                        <Avatar 
                            size="sm" 
                            bg="purple.500"
                            color="white"
                            name="KA" // Updated Avatar name
                            mr={2}
                        />
                        <Heading size="md" color="purple.500">
                            Katalyst Assistant
                        </Heading>
                    </Flex>
                    
                    {/* User Controls */}
                    <HStack spacing={3}>
                        <Tooltip label={colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                            <IconButton
                                aria-label="Toggle color mode"
                                icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
                                onClick={toggleColorMode}
                                variant="ghost"
                                size="sm"
                            />
                        </Tooltip>
                        
                        {isAuthenticated && user ? (
                            <Menu>
                                <MenuButton
                                    as={Button}
                                    variant="ghost"
                                    size="sm"
                                    rightIcon={<FiUser />}
                                >
                                    {user.username.split('@')[0]}
                                </MenuButton>
                                <MenuList>
                                    <Text px={3} py={1} fontSize="xs" color="gray.500">
                                        Signed in as <strong>{user.role ? user.role.replace('_', ' ') : 'Unknown Role'}</strong>
                                    </Text>
                                    <MenuItem
                                        icon={<FiLogOut />} 
                                        onClick={onLogout}
                                    >
                                        Log out
                                    </MenuItem>
                                </MenuList>
                            </Menu>
                        ) : isGuestMode ? (
                            <Button 
                                size="sm" 
                                colorScheme="purple" 
                                onClick={onLoginClick}
                            >
                                Sign In
                            </Button>
                        ) : (
                            <Button 
                                size="sm" 
                                colorScheme="purple" 
                                onClick={onLoginClick}
                            >
                                Log In
                            </Button>
                        )}
                    </HStack>
                </Flex>
            </Container>
        </Box>
    );
}; 