import { ComponentWithAs } from '@chakra-ui/react';

declare module '@chakra-ui/react' {
  // Fix Container type issues
  export interface ContainerProps {
    maxW?: string | number;
    children?: React.ReactNode;
  }
  
  // Other type augmentations for Chakra UI components as needed
} 