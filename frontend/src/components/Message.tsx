import React from 'react'; // Removed useEffect import
import {
    Box,
    VStack, // Keep VStack import for now, though we remove its usage temporarily
    useColorModeValue,
    useColorMode,
    Flex,
    Avatar,
    Icon,
    Badge,
    Tooltip,
    Text,
} from '@chakra-ui/react';
import { FiUser } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../services/api'; // Assuming ChatMessage is defined here or imported correctly
import { UserRole } from '../types'; // Assuming UIMessage uses role from UserRole

// Define the structure expected by the Message component props
interface UIMessageForRender {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    persona?: string;
}

// Define the component props
interface MessageProps {
    message: UIMessageForRender; // Use the adjusted interface
}

// The main Message component
export const Message: React.FC<MessageProps> = ({ message }) => {
    const { role, content, persona } = message;
    const isUser = role === 'user';
    const { colorMode } = useColorMode();

    // Bubble background colors
    const userBg = useColorModeValue('purple.500', 'purple.600');
    const aiBg = useColorModeValue('gray.100', 'gray.700');
    const bubbleBg = isUser ? userBg : aiBg;

    // Text colors within bubbles
    const userTextColor = 'white';
    const aiTextColor = useColorModeValue('gray.800', 'white');
    const bubbleTextColor = isUser ? userTextColor : aiTextColor;

    // Get persona display name function
    const getPersonaDisplayName = (personaName: string | undefined): string => {
        if (!personaName || personaName === 'user') return ''; // Don't show for user

        const lowerPersona = personaName.toLowerCase();
        switch (lowerPersona) {
            case UserRole.TECHNICAL.toLowerCase(): return 'Technical Expert';
            case UserRole.FUNCTIONAL.toLowerCase(): return 'Functional Consultant';
            case UserRole.ADMINISTRATOR.toLowerCase(): return 'System Administrator';
            case UserRole.KEY_USER.toLowerCase(): return 'Key User Expert';
            case UserRole.END_USER.toLowerCase(): return 'End User';
            case UserRole.PROJECT_MANAGER.toLowerCase(): return 'Project Manager';
            case UserRole.TESTER.toLowerCase(): return 'Testing Specialist';
            default: return 'Katalyst Assistant'; // Fallback
        }
    };
    const personaDisplayName = getPersonaDisplayName(persona);

    return (
        // Flex container for the entire message row (avatar + bubble)
        <Flex
            w="100%"
            mb={4}
            justifyContent={isUser ? 'flex-end' : 'flex-start'} // Align user right, AI left
        >
            {/* Avatar (order depends on role) */}
            {!isUser && (
                 <Avatar size="sm" bg="purple.500" name="KA" mr={3} mt={1} /> // Updated Avatar name
            )}

            {/* Message Bubble */}
            <Box
                maxWidth={{ base: "90%", md: "70%" }} // Limit bubble width
                bg={bubbleBg}
                color={bubbleTextColor}
                px={4}
                py={2}
                borderRadius="lg" // Rounded corners
                borderTopLeftRadius={isUser ? 'lg' : '0'}
                borderTopRightRadius={isUser ? '0' : 'lg'}
            >
                {/* Display Persona Name for AI messages */}
                 {!isUser && personaDisplayName && (
                     <Text fontSize="xs" fontWeight="bold" opacity={0.8} mb={1}>
                        {personaDisplayName}
                    </Text>
                )}

                {/* Markdown Content */}
                <Box className="markdown-content" sx={{
                    // Styles restored
                    'p': { mb: 2, lineHeight: '1.6' },
                    'ul, ol': { pl: 5, mb: 2 },
                    'li': { mb: 1 },
                    'pre': {
                        bg: useColorModeValue('gray.200', 'gray.800'),
                        color: useColorModeValue('gray.800', 'gray.100'),
                        p: 3,
                        borderRadius: 'md',
                        overflowX: 'auto',
                        fontSize: 'sm',
                        my: 3,
                    },
                    'code': {
                         fontFamily: 'monospace',
                         fontSize: 'sm',
                         bg: useColorModeValue('purple.50', 'purple.900'),
                         color: useColorModeValue('purple.700', 'purple.100'),
                         px: '0.3em',
                         py: '0.1em',
                         borderRadius: 'sm',
                         display: 'inline',
                         whiteSpace: 'pre-wrap',
                    },
                    'pre code': {
                       bg: 'transparent',
                       color: 'inherit',
                       p: 0,
                       borderRadius: 0,
                       display: 'inline',
                       whiteSpace: 'inherit',
                    },
                    'table': {
                        width: 'auto',
                        maxWidth: '100%',
                        borderCollapse: 'collapse',
                        my: 3,
                        boxShadow: 'sm',
                    },
                    'th, td': {
                        border: '1px solid',
                        borderColor: useColorModeValue('gray.300', 'gray.600'),
                        p: 2,
                        textAlign: 'left',
                    },
                     'th': {
                        bg: useColorModeValue('gray.50', 'gray.600'),
                        fontWeight: 'semibold',
                    },
                    'a': {
                        color: useColorModeValue('purple.600', 'purple.300'),
                        textDecoration: 'underline',
                        _hover: {
                            textDecoration: 'none',
                        }
                    }
                }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content || ''}
                    </ReactMarkdown>
                </Box>
            </Box>

             {/* Avatar (order depends on role) */}
             {isUser && (
                 <Avatar size="sm" bg="gray.300" icon={<Icon as={FiUser} color="gray.700" />} ml={3} mt={1} />
            )}
        </Flex>
    );
};