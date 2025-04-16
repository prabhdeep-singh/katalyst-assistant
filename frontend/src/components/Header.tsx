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
import { UserRead } from '../types'; // Import UserRead type
import { FiUser, FiLogOut, FiMoon, FiSun } from 'react-icons/fi';
import { HamburgerIcon } from '@chakra-ui/icons'; // Import HamburgerIcon

interface HeaderProps {
    onLogout: () => void;
    isAuthenticated: boolean;
    currentUser: UserRead | null; // Add prop for user info
    isGuestMode?: boolean;
    onLoginClick?: () => void;
    onMenuOpen: () => void; // Add prop to open the drawer menu
}

export const Header: React.FC<HeaderProps> = ({ 
    onLogout, 
    isAuthenticated,
    currentUser, // Use the prop
    isGuestMode = false,
    onLoginClick, 
    onMenuOpen // Receive the handler
}) => {
    const { colorMode, toggleColorMode } = useColorMode();
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    // Removed: const user = authService.getCurrentUser();
    
    return (
        <Box
            as="header"
            bg={bgColor}
            borderBottom="1px"
            borderColor={borderColor}
            py={{ base: 2, md: 3 }} // Adjust padding for mobile
            h="60px"
            position="sticky"
            top={0}
            zIndex="sticky"
        >
            <Container maxW="1200px">
                <Flex justifyContent="space-between" alignItems="center" h="full">
                    {/* Hamburger Menu Icon - Visible only on small screens */}
                    <IconButton
                        aria-label="Open menu"
                        icon={<HamburgerIcon />}
                        onClick={onMenuOpen} // Call the passed handler
                        display={{ base: 'flex', md: 'none' }} // Show on mobile
                        variant="ghost"
                        size="sm"
                        mr={2}
                    />
                    {/* Logo and Title */}
                    <Flex alignItems="center">
                        {/* Katalyst Icon/Avatar - Always visible */}
                        <Avatar 
                            size="sm" 
                            bg="purple.500"
                            color="white"
                            name="KA" // Updated Avatar name
                            mr={2}
                        />
                        {/* Title - Now visible on all screens */}
                        <Heading 
                            size="md" 
                            color="purple.500"
                        >
                            Katalyst Assistant
                        </Heading>
                    </Flex>
                    
                    {/* User Controls */}
                    <HStack spacing={{ base: 1, md: 3 }}>
                        <Tooltip label={colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                            <IconButton
                                aria-label="Toggle color mode"
                                icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
                                onClick={toggleColorMode}
                                variant="ghost"
                                size="sm"
                            />
                        </Tooltip>
                        
                        {isAuthenticated && currentUser ? (
                            <Menu>
                                <MenuButton
                                    as={Button}
                                    variant="ghost"
                                    size="sm"
                                    rightIcon={<FiUser />}
                                    display='inline-flex'
                                >
                                    {currentUser.username.split('@')[0]} 
                                </MenuButton>
                                <MenuList zIndex="popover">
                                    <Text px={3} py={1} fontSize="xs" color="gray.500">
                                        Signed in as <strong>{currentUser.role ? currentUser.role.replace('_', ' ') : 'Unknown Role'}</strong>
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
                                display={{ base: 'none', md: 'inline-flex' }} // Hide on mobile
                            >
                                Sign In
                            </Button>
                        ) : (
                            <Button 
                                size="sm" 
                                colorScheme="purple" 
                                onClick={onLoginClick}
                                display={{ base: 'none', md: 'inline-flex' }} // Hide on mobile
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