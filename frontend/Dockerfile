# Stage 1: Build the React application
FROM node:20-alpine as build

WORKDIR /app
COPY package*.json ./
# Use npm ci for cleaner installs if package-lock.json is reliable
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve the static files using a simple server
FROM node:20-alpine

WORKDIR /app

# Install 'serve' to serve static files
RUN npm install -g serve

# Copy built assets from the build stage
COPY --from=build /app/build ./build

# Expose the port serve uses by default (3000)
EXPOSE 3000

# Serve the build directory
# The -s flag ensures that it serves index.html for any unknown paths (SPA routing)
CMD ["serve", "-s", "build", "-l", "3000"]
