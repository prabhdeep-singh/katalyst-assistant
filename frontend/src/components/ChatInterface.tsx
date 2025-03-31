import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    VStack,
    Input,
    Button,
    Select,
    useToast,
    Text,
    useColorModeValue,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    CloseButton,
    HStack,
    Flex,
    IconButton,
    Textarea,
    InputGroup,
    InputRightElement,
    Heading,
    Container,
    Divider,
    Spinner,
    Tooltip,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    Avatar,
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
// Import ChatMessage from api
import { api, ChatMessage } from '../services/api';
import { Message } from './Message';
// Import necessary types from types/index.ts
import { UserRole, ChatSessionHistory, ChatHistoryItem, ChatSession, SimpleHistoryItem } from '../types';
import { ChatSidebar } from './ChatSidebar';
import { FiSend, FiPlusCircle, FiPlus, FiAlertCircle, FiChevronDown } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';

// Define the structure for the frontend message state
interface UIMessage {
    id: string; // Use string for potential temp IDs
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    persona?: string; // Persona of the assistant for this message
}


interface ChatInterfaceProps {
    isAuthenticated: boolean;
    userRole: UserRole | null; // Add userRole prop
}

// Helper function to generate title from first message
const generateTitleFromMessage = (message: string): string => {
    const words = message.split(' ');
    // Take first few words, up to a max length
    const title = words.slice(0, 5).join(' ');
    return title.length > 30 ? title.substring(0, 30) + '...' : title;
};


export const ChatInterface: React.FC<ChatInterfaceProps> = ({ isAuthenticated, userRole }) => { // Destructure userRole
    const [messages, setMessages] = useState<UIMessage[]>([]); // Use UIMessage type
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false); // For sending messages
    const [activeChatId, setActiveChatId] = useState<string | null>(null); // Store ID as string
    const [showGuestAlert, setShowGuestAlert] = useState(!isAuthenticated);
    const messageEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();
    const [selectedPersona, setSelectedPersona] = useState<UserRole>(
        isAuthenticated && userRole ? userRole : UserRole.FUNCTIONAL
    );
    const queryClient = useQueryClient();
    // State to track which chat is currently being mutated
    const [mutatingChatId, setMutatingChatId] = useState<string | null>(null);

    // Color Mode Values
    const bgColor = useColorModeValue('gray.50', 'gray.800');
    const inputBgColor = useColorModeValue('white', 'gray.700');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const welcomeTextColor = useColorModeValue("gray.600", "gray.400");
    const menuButtonHoverBg = useColorModeValue("gray.100", "gray.700");
    const menuItemSelectedBg = useColorModeValue("purple.50", "purple.900");
    const menuItemHoverBg = useColorModeValue("purple.100", "purple.800");

    // Effect to update selectedPersona when auth state or userRole changes
    useEffect(() => {
        if (isAuthenticated && userRole) {
            setSelectedPersona(userRole);
        } else {
            setSelectedPersona(UserRole.FUNCTIONAL);
        }
        setShowGuestAlert(!isAuthenticated);
    }, [isAuthenticated, userRole]);


    // Fetch chat sessions list (only if authenticated)
    const { data: chatsData = [] } = useQuery<ChatSession[]>(
        'chats',
        api.getChatSessions,
        {
            enabled: isAuthenticated,
            onError: () => {
                toast({ title: 'Error fetching chat list', status: 'error', duration: 3000 });
            },
        }
    );

     // Fetch messages for the active chat session
     const { data: activeChatHistory, isLoading: isLoadingChatHistory } = useQuery<ChatSessionHistory>(
        ['chat', activeChatId],
        () => api.getChatSessionHistory(parseInt(activeChatId!, 10)),
        {
            // Re-enable the check: Disable fetch if no active chat, not authenticated, OR if this chat is currently being mutated
            enabled: !!activeChatId && isAuthenticated && activeChatId !== mutatingChatId,
            onSuccess: (data) => {
                const uiMessages = data.messages.flatMap((item: ChatHistoryItem): UIMessage[] => {
                     const userMsg: UIMessage = {
                        id: item.message.id?.toString() || `user-${uuidv4()}`,
                        role: 'user',
                        content: item.message.content,
                        timestamp: item.message.created_at,
                        persona: 'user'
                    };
                    const messagesArray: UIMessage[] = [userMsg];
                    if (item.response) {
                        const assistantMsg: UIMessage = {
                            id: item.response.id?.toString() || `assistant-${uuidv4()}`,
                            role: 'assistant',
                            content: item.response.content,
                            timestamp: item.response.created_at,
                            persona: item.message.role
                        };
                        messagesArray.push(assistantMsg);
                    }
                    return messagesArray;
                });
                // Update component state with fetched history
                setMessages(uiMessages);
            },
            onError: () => {
                toast({ title: 'Error loading chat messages', status: 'error', duration: 3000 });
            },
        }
    );


    // Create a new chat session
    const createChatMutation = useMutation(
        (title: string) => api.createChatSession({ title }),
        {
            onSuccess: (newChat) => {
                queryClient.invalidateQueries('chats');
                setActiveChatId(newChat.id.toString());
                setMessages([]);
            },
            onError: () => {
                toast({ title: 'Error creating new chat', status: 'error', duration: 3000 });
            },
        }
    );

    // Mutation to update chat title
    const updateChatTitleMutation = useMutation(
        (params: { sessionId: number; title: string }) =>
            api.updateChatSession(params.sessionId, { title: params.title }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('chats');
            },
            onError: () => {
                console.error("Error updating chat title");
            },
        }
    );


    // Send a message (handles both authenticated and public)
    const sendMessageMutation = useMutation(
        (params: { content: string; role: UserRole; chatId?: string; history?: SimpleHistoryItem[] }) => {
            if (params.chatId && isAuthenticated) {
                return api.sendMessage(params.chatId, params.content, params.role);
            } else {
                return api.sendOneOffMessage(params.content, params.role, params.history);
            }
        },
        {
            onMutate: async (variables) => {
                 // Set the mutating chat ID if applicable
                 if (variables.chatId && isAuthenticated) {
                     setMutatingChatId(variables.chatId);
                 }
                 const optimisticUserMessage: UIMessage = {
                    id: 'optimistic-user-' + uuidv4(),
                    role: 'user',
                    content: variables.content,
                    timestamp: new Date().toISOString(),
                    persona: 'user',
                };
                 // Add optimistic message to component state
                 setMessages(prev => [...prev, optimisticUserMessage]);
                 // Return only the ID for rollback context
                 return { optimisticUserMessageId: optimisticUserMessage.id };
            },
            onSuccess: (response: ChatMessage, variables, context) => {
                 const assistantMessage: UIMessage = {
                    id: response.id?.toString() || uuidv4(),
                    role: 'assistant',
                    content: response.content || "Error: Empty response",
                    timestamp: response.timestamp || new Date().toISOString(),
                    persona: variables.role,
                 };
                 // Append assistant message to component state
                 setMessages(prev => [...prev, assistantMessage]);
                 // isLoading reset in onSettled
                 // Cache invalidation happens in onSettled
            },
            onError: (error, variables, context) => {
                console.error("Send message error:", error);
                // Remove optimistic user message from component state on error
                setMessages(prev => prev.filter(m => m.id !== context?.optimisticUserMessageId));
                toast({ title: 'Error sending message', status: 'error', duration: 3000 });
                 // isLoading reset in onSettled
            },
            onSettled: (data, error, variables) => {
                // Reset loading state
                setIsLoading(false);
                // Reset mutating chat ID *after* invalidation might start
                const chatToInvalidate = variables.chatId;
                setMutatingChatId(null);
                // Invalidate the specific chat query to refetch the true state from the backend
                if (chatToInvalidate && isAuthenticated) {
                    // console.log(`Invalidating query for chat ID: ${chatToInvalidate} after mutation settled.`); // Keep commented unless debugging
                    queryClient.invalidateQueries(['chat', chatToInvalidate]);
                }
            },
        }
    );


    // Delete a chat session
    const deleteChatMutation = useMutation(
        (chatId: string) => api.deleteChatSession(parseInt(chatId, 10)),
        {
            onSuccess: (_, deletedChatId) => {
                queryClient.invalidateQueries('chats');
                if (activeChatId === deletedChatId.toString()) {
                    setActiveChatId(null);
                    setMessages([]);
                }
            },
            onError: () => {
                toast({ title: 'Error deleting chat', status: 'error', duration: 3000 });
            },
        }
    );


    // Scroll to bottom when messages change
    useEffect(() => {
        setTimeout(() => {
             if (messageEndRef.current) {
                messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    }, [messages]);

    // Handle sending a message
    const handleSendMessage = async () => {
        const trimmedInput = input.trim();
        if (!trimmedInput || isLoading) return;

        const currentPersona = selectedPersona || UserRole.FUNCTIONAL;
        setInput('');

        const historyToSend: SimpleHistoryItem[] | undefined = !isAuthenticated
            ? messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
            : undefined;

        setIsLoading(true);

        let targetChatId = activeChatId;
        let isNewChat = false;

        try {
            if (isAuthenticated && !targetChatId) {
                isNewChat = true;
                const newChatTitle = generateTitleFromMessage(trimmedInput);
                const newChat = await createChatMutation.mutateAsync(newChatTitle);
                targetChatId = newChat.id.toString();
                setActiveChatId(targetChatId);
                // Clear local messages state for the new chat *before* optimistic update
                setMessages([]);
            }

            // Ensure targetChatId is not null before proceeding if authenticated
            const finalChatId = isAuthenticated ? (targetChatId ?? undefined) : undefined;

            // Trigger the mutation (onMutate will add optimistic user message)
            sendMessageMutation.mutate({
                content: trimmedInput,
                role: currentPersona,
                chatId: finalChatId,
                history: historyToSend
            });

        } catch (error) {
             console.error("Error in send message flow (create chat step):", error);
             setIsLoading(false);
             toast({
                 title: 'Error starting chat',
                 description: 'Could not create a new chat session.',
                 status: 'error',
                 duration: 3000,
             });
        }
    };

    // Handle starting a new chat (clears active chat)
    const handleNewChat = () => {
        setActiveChatId(null);
        setMessages([]);
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    // Handle selecting a chat from the sidebar
    const handleSelectChat = (chatId: string) => {
        setActiveChatId(chatId);
    };

    // Handle deleting a chat from the sidebar
    const handleDeleteChat = (chatId: string) => {
        deleteChatMutation.mutate(chatId);
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage();
    };

    // Handle Enter key press in input
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Focus input on initial mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Handle persona selection change
    const handlePersonaChange = (role: UserRole) => {
        setSelectedPersona(role);
    };

    // Helper function to get display name for persona
    const getPersonaDisplayName = (role: UserRole | null): string => {
        if (!role) return 'Select Persona';
        switch (role) {
            case UserRole.TECHNICAL: return 'Technical Expert';
            case UserRole.FUNCTIONAL: return 'Functional Consultant';
            case UserRole.ADMINISTRATOR: return 'System Administrator';
            case UserRole.KEY_USER: return 'Key User';
            case UserRole.END_USER: return 'End User';
            case UserRole.PROJECT_MANAGER: return 'Project Manager';
            case UserRole.TESTER: return 'Testing Specialist';
            default: return 'Katalyst Assistant';
        }
    };

    return (
        // Outermost Flex container (Sidebar + Main Content)
        <Flex h="calc(100vh - 60px)" position="relative" bg={bgColor}>
            {/* Sidebar */}
            {isAuthenticated && (
                <ChatSidebar
                    chats={chatsData} // Pass ChatSession[]
                    activeChatId={activeChatId} // Pass string | null
                    onSelectChat={handleSelectChat}
                    onDeleteChat={handleDeleteChat}
                    onNewChat={handleNewChat}
                />
            )}

            {/* Main chat area Flex container */}
            <Flex
                flex="1"
                flexDirection="column"
                position="relative"
                height="100%"
                overflow="hidden" // Prevent this outer Flex from scrolling
            >
                 {/* Guest Mode Alert Banner */}
                 {showGuestAlert && !isAuthenticated && (
                    <Box px={{ base: 2, md: 4 }} py={2} width="100%">
                         <Alert status="info" variant="subtle" colorScheme="blue" borderRadius="md">
                            <AlertIcon />
                            <Box flex="1">
                                You are using the Katalyst Assistant in guest mode. Login for personalized assistance and to save your conversation history.
                            </Box>
                            <CloseButton
                                onClick={() => setShowGuestAlert(false)}
                                position="absolute"
                                right="8px"
                                top="8px"
                            />
                        </Alert>
                    </Box>
                )}

                {/* Scrolling container for messages */}
                <Box
                    flex="1" // Takes up available vertical space
                    overflowY="auto" // Enables vertical scrolling
                    width="100%"
                    maxWidth="800px" // **CENTERING: Constrain width**
                    mx="auto" // **CENTERING: Center horizontally**
                    px={{ base: 2, md: 4 }} // Horizontal padding within the centered box
                    pt={4}
                    pb={2}
                >
                    {/* Welcome message or actual messages */}
                    {(messages.length === 0 && !isLoadingChatHistory && !activeChatId) ? ( // Show welcome only if no active chat and not loading
                        <Flex
                            direction="column"
                            align="center"
                            justify="center" // Changed to center
                            minHeight="calc(100% - 40px)"
                            textAlign="center"
                            color={welcomeTextColor}
                            px={4}
                            py={10} // Added padding top/bottom
                        >
                            <Avatar size="xl" bg="purple.500" name="KA" mb={6} />
                            <Heading size="lg" mb={3}>
                                Katalyst Assistant
                            </Heading>
                            <Text fontSize="lg">
                                {isAuthenticated ? 'Select a chat or start a new one.' : 'How can I help you today?'}
                            </Text>
                        </Flex>
                    ) : (
                        messages.map((message) => (
                            // Pass UIMessage to Message component
                            <Message
                                key={message.id}
                                message={message as any} // Cast needed if Message expects API type
                            />
                        ))
                    )}
                     {/* Loading spinner */}
                     {(isLoading || isLoadingChatHistory) && ( // Show spinner if sending or loading history
                        <Flex justify="center" py={4}>
                            <Spinner size="md" color="purple.500" />
                        </Flex>
                    )}

                    {/* For auto-scrolling */}
                    <div ref={messageEndRef} />
                </Box>

                {/* Input area */}
                <Box
                    width="100%"
                    maxWidth="800px" // **CENTERING: Constrain input width**
                    mx="auto" // **CENTERING: Center input area**
                    px={{ base: 2, md: 4 }}
                    py={3} // Reduced padding slightly
                    mt="auto" // Pushes to bottom
                    borderTop="1px"
                    borderColor={borderColor}
                    bg={bgColor}
                >
                    <form onSubmit={handleSubmit}>
                        <VStack spacing={2}> {/* Reduced spacing */}
                            {/* Persona selection dropdown */}
                            <Menu placement="top-end">
                                <MenuButton
                                    as={Button}
                                    rightIcon={<FiChevronDown />}
                                    variant="outline"
                                    size="sm"
                                    w="full"
                                    textAlign="left"
                                    fontWeight="normal"
                                    borderColor={borderColor}
                                    _hover={{ bg: menuButtonHoverBg }}
                                >
                                    Respond as: <Text as="span" fontWeight="medium" ml={1}>{getPersonaDisplayName(selectedPersona)}</Text>
                                </MenuButton>
                                <MenuList zIndex={10}>
                                    {Object.values(UserRole).map((role) => (
                                        <MenuItem
                                            key={role}
                                            value={role}
                                            onClick={() => handlePersonaChange(role as UserRole)}
                                            bg={selectedPersona === role ? menuItemSelectedBg : undefined}
                                            fontWeight={selectedPersona === role ? "semibold" : "normal"}
                                            _hover={{ bg: menuItemHoverBg }}
                                        >
                                            {getPersonaDisplayName(role as UserRole)}
                                        </MenuItem>
                                    ))}
                                </MenuList>
                            </Menu>

                            {/* Input field and send button */}
                            <Flex position="relative" w="full">
                                <Input
                                    placeholder="Ask Katalyst Assistant..." // Updated placeholder
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    pr="3.5rem"
                                    disabled={isLoading || isLoadingChatHistory} // Disable if loading anything
                                    ref={inputRef}
                                    size="md"
                                    borderRadius="md"
                                    bg={inputBgColor}
                                    borderColor={borderColor}
                                    _focus={{ borderColor: "purple.500", boxShadow: `0 0 0 1px var(--chakra-colors-purple-500)` }}
                                />
                                <Tooltip label="Send message" placement="top">
                                    <IconButton
                                        icon={isLoading ? <Spinner size="xs" /> : <FiSend />}
                                        aria-label="Send message"
                                        position="absolute"
                                        right="0.5rem"
                                        top="50%"
                                        transform="translateY(-50%)"
                                        size="sm"
                                        colorScheme="purple"
                                        variant="ghost"
                                        isRound
                                        type="submit"
                                        isDisabled={!input.trim() || isLoading || isLoadingChatHistory} // Disable if loading anything
                                    />
                                </Tooltip>
                            </Flex>
                        </VStack>
                    </form>
                </Box>
            </Flex>
        </Flex>
    );
};