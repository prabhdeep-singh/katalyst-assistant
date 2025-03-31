import { extendTheme, ThemeConfig } from '@chakra-ui/react';

// Color mode config
const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: true,
};

// Custom colors
const colors = {
  purple: {
    50: '#f5e9ff',
    100: '#dac1ff',
    200: '#c098ff',
    300: '#a66fff',
    400: '#8c47ff',
    500: '#722de6', // Primary brand color
    600: '#5a22b5',
    700: '#421884',
    800: '#2a0e54',
    900: '#140426',
  },
  gray: {
    50: '#f9fafb',
    100: '#edf2f7',
    200: '#e2e8f0',
    300: '#cbd5e0',
    400: '#a0aec0',
    500: '#718096',
    600: '#4a5568',
    700: '#2d3748',
    800: '#1a202c',
    900: '#171923',
  },
};

// Component-specific theme customization
const components = {
  Button: {
    baseStyle: {
      fontWeight: 'medium',
      borderRadius: 'md',
    },
    variants: {
      solid: {
        bg: 'purple.500',
        color: 'white',
        _hover: {
          bg: 'purple.600',
        },
      },
      outline: {
        borderColor: 'gray.300',
        color: 'gray.700',
        _hover: {
          bg: 'gray.50',
        },
        _dark: {
          borderColor: 'gray.600',
          color: 'gray.200',
          _hover: {
            bg: 'gray.700',
          },
        },
      },
    },
  },
  Input: {
    variants: {
      outline: {
        field: {
          borderColor: 'gray.300',
          _hover: {
            borderColor: 'gray.400',
          },
          _focus: {
            borderColor: 'purple.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-purple-500)',
          },
        },
      },
    },
  },
  Textarea: {
    variants: {
      outline: {
        borderColor: 'gray.300',
        _hover: {
          borderColor: 'gray.400',
        },
        _focus: {
          borderColor: 'purple.500',
          boxShadow: '0 0 0 1px var(--chakra-colors-purple-500)',
        },
      },
    },
  },
};

// Fonts
const fonts = {
  heading: "'Inter', sans-serif",
  body: "'Inter', system-ui, sans-serif",
};

// Global styles
const styles = {
  global: (props: { colorMode: string }) => ({
    body: {
      bg: props.colorMode === 'dark' ? 'gray.900' : 'white',
      color: props.colorMode === 'dark' ? 'white' : 'gray.800',
    },
  }),
};

// Export the theme
const theme = extendTheme({
  config,
  colors,
  components,
  fonts,
  styles,
});

export default theme; 