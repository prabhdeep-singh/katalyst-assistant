import os
import sys
from pathlib import Path

# Add the parent directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import asyncio # Import asyncio
from app.models.database import create_tables

if __name__ == "__main__":
    print("Creating database tables...")
    asyncio.run(create_tables()) # Run the async function
    print("Database tables created successfully!") 