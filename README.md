

https://github.com/user-attachments/assets/40cdb5e4-4061-4162-b501-8c17b33a5147



Course Assistant is a course recommendation assistant for counselors running live sessions with students. This repository is the starting point for a practical, low-cost deployment model that avoids unnecessary cloud spending while keeping the app production-aware.

## Included in this scaffold

- `backend/` — TypeScript API with a working example `/recommend` endpoint
- `frontend/` — React + Vite starter that can consume the API
- `infra/` — optional infrastructure notes
- `scripts/` — seeding helpers and utilities
- `Docs/` — architecture, roadmap, strategy, and evaluation notes


This keeps cost low, gives you control over the stack, and still demonstrates good production thinking without requiring a heavy managed cloud deployment.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev:backend
```

Use the env template in `.env.example` to configure `DATABASE_URL`, `REDIS_URL`, `SESSION_ENCRYPTION_KEY`, `CORS_ORIGIN`, and `VITE_API_BASE_URL` for local or homelab deployment.

### Clerk authentication

This proj uses Clerk authentication. Configure the backend secret and frontend publishable key:

```env
# backend/.env or the root .env loaded by the backend
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key

# frontend/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
VITE_API_BASE_URL=http://localhost:3001
```

Configure `http://localhost:5173` as an allowed Clerk origin. Each signed-in counselor gets an isolated workspace: other users cannot list, open, analyze, download, or access another user's saved sessions, meeting documents, or meeting links.

### Google Meet transcript documents

The dashboard can generate a document after a Google Meet ends and its transcript artifact is ready:

1. Enable the Google Meet REST API in Google Cloud.
2. Create a Desktop OAuth client and save its JSON as `credentials.json` in the repository root.
3. Start the backend and frontend. In the **Meeting documents** panel, paste a Meet URL or meeting code.
4. Authorize the Google account when the browser prompt appears.

The generated document includes the transcript, detected questions and replies, topic mentions, word count, duration, and response statistics. Transcription must have been enabled for the meeting, and Google Workspace may take a short time to publish the artifact. The OAuth file is ignored by Git and must never be committed.

Open a generated document to run structured AI analysis and download a Word-compatible `.doc` file containing the analysis, transcript, questions, replies, and analytics. If AI credentials are unavailable, it labels and uses a deterministic fallback instead of silently claiming AI analysis.


Then in another terminal:

```bash
npm run dev:frontend
```

The backend listens on `http://localhost:3001` and the frontend runs on `http://localhost:5173`.

## Local infrastructure

```bash
docker-compose up -d
```

This starts local PostgreSQL and Redis instances for the project.

Initialize and seed PostgreSQL:

```bash
docker compose exec -T postgres psql -U gradgu

ide -d gradguide < backend/schema.sql
npm run seed --workspace backend
```

The seed script inserts 60 deterministic course records. The backend's
`POST /api/recommend` endpoint reads these records through parameterized SQL.
