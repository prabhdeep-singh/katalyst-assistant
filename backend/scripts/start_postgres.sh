#!/bin/bash

# Start PostgreSQL in Docker (Standalone - Use docker-compose for full setup)
docker run --name katalyst-assistant-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=katalyst_assistant \
  -p 5432:5432 \
  -d postgres:14-alpine

echo "PostgreSQL started on port 5432"
echo "Database: katalyst_assistant"
echo "Username: postgres"
echo "Password: password"
echo ""
echo "NOTE: This script starts only the database. Use 'docker-compose up' for the full application."
echo "To initialize the database tables (if needed separately), run: python -m app.scripts.init_db"