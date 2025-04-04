# Katalyst Assistant

An AI-powered chat assistant designed to answer questions about ERP systems (Currently tailored for **IFS ERP**) and processes, featuring persona-based responses tailored to different user roles. Built with FastAPI (Python) for the backend and React (TypeScript) for the frontend, containerized using Docker Compose.

## Features

*   **Persona-Based Responses:** Select a user role (Technical Expert, Functional Consultant, Administrator, etc.) to receive answers tailored to that perspective.
*   **Markdown Support:** Assistant responses are formatted using Markdown, including code blocks, lists, tables, and text emphasis.
*   **Chat History:** Authenticated users have their chat sessions saved and can revisit previous conversations.
*   **Authentication:** JWT-based authentication for registered users.
*   **Guest Mode:** Allows unauthenticated users to try the assistant (without history saving).
*   **Dockerized:** Easy setup and deployment using Docker and Docker Compose.
*   **Configurable LLM:** Uses Google Gemini by default, configurable via environment variables.

## Tech Stack

*   **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL, Pydantic, SlowAPI
*   **Frontend:** React, TypeScript, Chakra UI, React Query, Axios, `react-markdown`, `remark-gfm`, `jwt-decode`, `serve` (for serving static build)
*   **LLM:** Google Gemini API (configurable)
*   **Deployment:** Docker, Docker Compose, Nginx (for HTTPS termination and proxying)

## Prerequisites

*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/) (Usually included with Docker Desktop)
*   [Git](https://git-scm.com/downloads)
*   A Google Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))
*   (Optional) Self-signed or valid SSL certificates for Nginx (`cert.pem`, `key.pem` in `nginx/ssl/`). A script `gen-certs.sh` is included for generating self-signed ones for local testing.

## Getting Started / Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd katalyst-assistant # IMPORTANT: Rename the cloned folder if needed
    ```
    *(Replace `<repository-url>` with the actual URL after you create the GitHub repo. Ensure your local project folder is named `katalyst-assistant`)*

2.  **Generate SSL Certificates (for local HTTPS):**
    *   If you don't have existing certificates, run the provided script (you might need to make it executable first: `chmod +x gen-certs.sh`):
        ```bash
        ./gen-certs.sh
        ```
    *   This creates self-signed certificates in `nginx/ssl/`. Your browser will show a security warning when accessing `https://localhost`, which you'll need to bypass for local testing.

3.  **Configure Backend Environment:**
    *   Copy the example environment file:
        ```bash
        cp backend/.env.example backend/.env
        ```
    *   Edit `backend/.env` with your actual values:
        *   `DATABASE_URL`: Keep the default `postgresql://postgres:password@db:5432/katalyst_assistant` if using the included Docker Compose setup. Change the password if desired (and update in `docker-compose.yml` too).
        *   `GEMINI_API_KEY`: **Required.** Paste your Gemini API key here.
        *   `LLM_MODEL`: (Optional) Change the Gemini model if desired (e.g., `gemini-1.5-flash`). Defaults to `gemini-pro`.
        *   `SECRET_KEY`: **Required.** Generate a strong secret key for JWT signing. You can use `openssl rand -hex 32` in your terminal to generate one and paste it here.
        *   `ACCESS_TOKEN_EXPIRE_MINUTES`: (Optional) Adjust token expiry time. Defaults to 30.
        *   `BACKEND_CORS_ORIGINS`: For the local Docker setup, ensure this is set to `BACKEND_CORS_ORIGINS='["https://localhost"]'` to allow requests from the Nginx proxy.

4.  **Configure Frontend Environment:**
    *   Copy the example environment file:
        ```bash
        cp frontend/.env.example frontend/.env
        ```
    *   Edit `frontend/.env`:
        *   `REACT_APP_API_URL`: **Required.** Set this to the URL the frontend will use to reach the backend *via the Nginx proxy*. For the local Docker setup, this should be `https://localhost`. For a production deployment, this would be your public backend URL (e.g., `https://your-backend.run.app`).

5.  **Build and Run with Docker Compose:**
    *   From the root `katalyst-assistant` directory, run:
        ```bash
        docker-compose up --build -d
        ```
    *   This command will:
        *   Build the Docker images for the backend and frontend.
        *   Start the PostgreSQL database, backend, frontend (serving static files), and Nginx containers.
        *   The `-d` flag runs the containers in detached mode.
    *   The first time you run this, it might take longer. The backend will automatically create the necessary database tables on startup.

## Usage

1.  **Access Frontend:**
    *   Access the application at `https://localhost`.
    *   Accept the browser security warning (due to the self-signed certificate if you generated one).
2.  **Register/Login:**
    *   Create an account using the "Sign Up" option.
    *   Log in with your credentials.
    *   Alternatively, "Continue as Guest" (chat history will not be saved).
3.  **Chat:**
    *   If logged in, your previous chat sessions appear in the left sidebar. Click one to load it or click "New chat" to start fresh.
    *   Select the desired "Respond as" persona from the dropdown above the input field.
    *   Type your query in the input field and press Enter or click the send icon.

## Configuration Details

Environment variables are used for configuration. Create `.env` files based on the `.env.example` files in the `backend` and `frontend` directories.

**Backend (`backend/.env`):**

*   `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://postgres:password@db:5432/katalyst_assistant`).
*   `GEMINI_API_KEY`: Your Google Gemini API key.
*   `LLM_MODEL`: The Gemini model to use (default: `gemini-pro`).
*   `SECRET_KEY`: A strong secret for signing JWT tokens.
*   `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT token validity duration (default: 30).
*   `BACKEND_CORS_ORIGINS`: JSON array of allowed origins. Set to `BACKEND_CORS_ORIGINS='["https://localhost"]'` for local Docker/Nginx setup.

**Frontend (`frontend/.env`):**

*   `REACT_APP_API_URL`: The base URL the frontend uses to make API calls. Set to `https://localhost` for local Docker/Nginx setup.

## Nginx and Content Security Policy (CSP)

*   Nginx is used as a reverse proxy, handling HTTPS termination and routing requests to the appropriate backend or frontend service.
*   A Content Security Policy (CSP) is set in `nginx/nginx.conf`. The current policy includes `'unsafe-inline'` for `style-src` to support Chakra UI's dynamic styling and allows connections to `fonts.googleapis.com`, `fonts.gstatic.com`, and the backend API origin (`https://localhost` for local setup).
*   **Security Note:** For production deployments, consider replacing `'unsafe-inline'` with a stricter nonce-based strategy for enhanced security.

## Development Dependencies Audit

`npm audit` reported 8 vulnerabilities (2 moderate, 6 high) in frontend development dependencies (`react-scripts` sub-dependencies like `nth-check`, `postcss`). These affect the build environment but are considered low risk for the runtime application. Attempting `npm audit fix --force` may cause breaking changes and is not recommended without careful testing.

## Contributing

Contributions are welcome! Please follow standard GitHub practices (fork, feature branch, pull request).

## License

This project is licensed under the [MIT License](LICENSE).