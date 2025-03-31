#!/bin/bash

# IFS ERP Assistant Setup Script

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Katalyst Assistant Setup Script     ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check for Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"

# Check for docker compose
if docker compose version &> /dev/null; then
    echo -e "${GREEN}✓ Docker Compose V2 is installed${NC}"
else
    echo -e "${RED}Docker Compose V2 not found. You may need to update Docker.${NC}"
    echo -e "${RED}You can still use the legacy 'docker-compose' command if available.${NC}"
fi

# Create environment files if they don't exist
if [ ! -f backend/.env ]; then
    echo -e "${BLUE}Creating backend/.env from example...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✓ Created backend/.env${NC}"
    echo -e "${RED}! Remember to update the API keys in backend/.env${NC}"
else
    echo -e "${GREEN}✓ backend/.env already exists${NC}"
fi

if [ ! -f frontend/.env ]; then
    echo -e "${BLUE}Creating frontend/.env from example...${NC}"
    cp frontend/.env.example frontend/.env
    echo -e "${GREEN}✓ Created frontend/.env${NC}"
    echo -e "${RED}! Remember to update the API keys in frontend/.env${NC}"
else
    echo -e "${GREEN}✓ frontend/.env already exists${NC}"
fi

# Generate self-signed certificates for development
echo -e "${BLUE}Generating self-signed SSL certificates...${NC}"
./gen-certs.sh

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}Setup complete!${NC}"
echo -e "${BLUE}To start the application, run:${NC}"
echo -e "docker compose up -d"
echo ""
echo -e "${BLUE}To stop the application, run:${NC}"
echo -e "docker compose down"
echo -e "${BLUE}=====================================${NC}" 