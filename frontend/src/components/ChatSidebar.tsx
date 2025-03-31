import React from 'react';
import {
    Box,
    Button,
    VStack,
    Text,
    useColorModeValue,
    IconButton,
    Flex,
    Divider,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    Tooltip,
} from '@chakra-ui/react';
import {
    FiMessageSquare,
    FiPlus,
    FiTrash,
    FiMoreVertical,
} from 'react-icons/fi';
// Import ChatSession instead of ChatConversation
import { ChatSession } from '../types';

interface ChatSidebarProps {
    chats: ChatSession[]; // Use ChatSession[] type
    activeChatId: string | null;
    onSelectChat: (chatId: string) => void;
    onDeleteChat: (chatId: string) => void;
    onNewChat: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
    chats = [],
    activeChatId,
    onSelectChat,
    onDeleteChat,
    onNewChat,
}) => {
    const bgColor = useColorModeValue('white', 'gray.800');
    const hoverBgColor = useColorModeValue('gray.100', 'gray.700');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    // Use purple scheme for active chat for better visibility
    const activeBgColor = useColorModeValue('purple.50', 'purple.900');
    const activeTextColor = useColorModeValue('purple.700', 'purple.100');

    // Format the date to a readable format
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });
    };

    // Get chat title (simplified as ChatSession only has title)
    const getChatTitle = (chat: ChatSession) => {
        // Truncate title if necessary
        const title = chat.title || 'Untitled Chat';
        return title.length > 25 ? title.substring(0, 25) + '...' : title;
    };

    return (
        <Box
            w={{ base: "200px", md: "260px" }} // Responsive width
            h="100%"
            bg={bgColor}
            borderRight="1px"
            borderColor={borderColor}
            display="flex"
            flexDirection="column" // Stack button and list
            p={3} // Reduced padding slightly
        >
            <Button
                leftIcon={<FiPlus />}
                colorScheme="purple"
                onClick={onNewChat}
                size="sm"
                w="full"
                mb={4} // Margin bottom
            >
                New chat
            </Button>

            {/* Scrollable chat list */}
            <Box flex="1" overflowY="auto" pr={1}> {/* Added padding-right for scrollbar */}
                 {chats.length > 0 && (
                    <Text fontSize="xs" fontWeight="medium" color="gray.500" mb={2} px={1}>
                        RECENT CHATS
                    </Text>
                 )}
                <VStack spacing={1} align="stretch">
                    {chats.map((chat) => {
                        const isActive = chat.id.toString() === activeChatId;
                        return (
                            <Flex
                                key={chat.id}
                                p={2}
                                borderRadius="md"
                                bg={isActive ? activeBgColor : 'transparent'}
                                color={isActive ? activeTextColor : 'inherit'}
                                _hover={{ bg: !isActive ? hoverBgColor : undefined }} // Only hover if not active
                                align="center"
                                cursor="pointer"
                                // Convert chat.id (number) to string for callbacks
                                onClick={() => onSelectChat(chat.id.toString())}
                            >
                                <Box mr={2} opacity={0.7}>
                                    <FiMessageSquare size={16}/>
                                </Box>
                                <Box flex="1" overflow="hidden">
                                    <Text fontWeight="medium" fontSize="sm" isTruncated>
                                        {getChatTitle(chat)}
                                    </Text>
                                    {/* Optional: Show date if needed
                                    <Text fontSize="xs" color="gray.500">
                                        {formatDate(chat.created_at)}
                                    </Text>
                                     */}
                                </Box>
                                <Menu>
                                    <MenuButton
                                        as={IconButton}
                                        size="xs"
                                        icon={<FiMoreVertical />}
                                        variant="ghost"
                                        aria-label="Chat options"
                                        onClick={(e) => e.stopPropagation()} // Prevent triggering onSelectChat
                                        ml={1} // Margin left
                                        isRound
                                    />
                                    <MenuList fontSize="sm" minW="120px">
                                        <MenuItem
                                            icon={<FiTrash size={14} />}
                                            color="red.500"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Convert chat.id (number) to string
                                                onDeleteChat(chat.id.toString());
                                            }}
                                        >
                                            Delete
                                        </MenuItem>
                                    </MenuList>
                                </Menu>
                            </Flex>
                        );
                    })}
                </VStack>

                {chats.length === 0 && (
                    <Box mt={6} textAlign="center">
                        <Text fontSize="sm" color="gray.500">
                            No chat history yet.
                        </Text>
                    </Box>
                )}
            </Box>
        </Box>
    );
};