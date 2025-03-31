#!/bin/bash

# Script to generate self-signed certificates for local development

# Create the SSL directory if it doesn't exist
mkdir -p nginx/ssl

# Generate a private key
openssl genrsa -out nginx/ssl/key.pem 2048

# Generate a self-signed certificate
openssl req -x509 -new -nodes -key nginx/ssl/key.pem -sha256 -days 365 -out nginx/ssl/cert.pem -subj "/CN=localhost"

echo "Self-signed SSL certificates have been generated."
echo "IMPORTANT: These certificates are meant for development purposes only."
echo "For production, please use properly signed certificates from a trusted CA." 