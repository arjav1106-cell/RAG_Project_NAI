# Repository Guidelines

## Project Structure

This project is a React/TypeScript client and FastAPI service for vehicle insurance records and source-grounded policy Q&A. Frontend routes live in `frontend/src/pages/`; shared components, API access, and types are in `frontend/src/components/` and `frontend/src/lib/`. Backend routes are in `backend/app/api/`, SQLAlchemy models and Pydantic schemas are in `backend/app/`, and ingestion, Ollama, and retrieval logic are in `backend/app/services/`. Curated seed sources are in `backend/app/knowledge/sources.json`; tests are in `backend/tests/` and alongside frontend pages.

## Development Commands

Run the API from `backend/` with its virtual environment active: `python -m uvicorn app.main:app --reload`. Run the client from `frontend/` with `npm run dev`; Vite proxies `/api` to port 8000. Install Python dependencies with `python -m pip install -r requirements.txt` and frontend dependencies with `npm ci`.

Run backend checks from `backend/`: `python -m pytest`, `python -m ruff check app tests`, and `python -m ruff format --check app tests`. Run frontend checks from `frontend/`: `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Style and Naming

Use Ruff formatting/lint rules for Python (4 spaces, snake_case functions/modules, PascalCase models) and Prettier/ESLint for TypeScript (2 spaces, PascalCase React components, camelCase functions). Keep route logic in API modules and reusable processing in service modules. Use descriptive test names such as `test_rag_abstains_when_there_are_no_sources`.

## Testing Expectations

Add API tests for validation, record ownership, and persistence, and RAG tests for relevance, citations, tracker scoping, and abstention. Frontend tests should cover forms, loading/error states, and important user interactions. Use synthetic PDFs and fake Ollama clients in tests; do not rely on live user records or model availability. Run the relevant checks before describing behavior as verified.

## Security and Data Handling

Never commit real insurance or claim documents, personal data, local databases, `.env` files, or credentials. Keep uploaded PDFs in the configured private data directory and ensure every read, update, and delete operation checks record ownership. Treat model responses as informational; cite evidence and do not promise claim decisions or legal outcomes.

## Commits and Pull Requests

Use short imperative Conventional Commit subjects, for example `feat: include tracker data in policy answers` or `docs: document local setup`. Pull requests should describe user-visible behavior, list checks run, link relevant work, and include screenshots for interface changes.
