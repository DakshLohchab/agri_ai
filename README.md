# AgriAdvisor Workspace

AgriAdvisor is a pnpm workspace that combines:

- an Expo React Native application with mobile and web support
- an Express API server for auth, profile, health, and market data
- a Neon/PostgreSQL database layer managed with Drizzle ORM
- an optional Ollama-backed agricultural reasoning route
- a client-side fallback advisory pipeline so the app remains usable even when the full model backend is not available

This README is written for operators and developers. It documents the actual repo structure, environment variables, startup order, and the difference between the default workspace runtime and the optional full LangGraph/Ollama runtime.

## Quick Links

| Section | Asset | Link |
| --- | --- | --- |
| Docs | Architecture PDF | [docs/Architecture/agriadvisor-architecture.pdf](docs/Architecture/agriadvisor-architecture.pdf) |
| Docs | Impact Model PDF | [docs/ImpactModel/agriadvisor-impactmodel.pdf](docs/ImpactModel/agriadvisor-impactmodel.pdf) |
| Demo | Demo Video | [docs/AgriAdvisor.mp4](docs/AgriAdvisor.mp4) |

## What is in this repo

### Applications

- `artifacts/agri-advisor`
  Expo app for Android, iOS, and web
- `artifacts/api-server`
  Express API for auth, profile, health, and AGMARKNET proxy routes

### Shared libraries

- `lib/db`
  Neon/PostgreSQL connection and Drizzle schema

### Optional backend logic

- `api/agri/agri.route.ts`
  standalone Ollama-backed `/api/agri/query` route implementation
- `artifacts/agri-advisor/backend/langgraph_orchestrator.py`
  Python orchestrator reference for the 6-stage advisory pipeline

### Documentation

- `artifacts/agri-advisor/docs/agriadvisor-architecture.tex`
  two-page LaTeX architecture document

## Current architecture in one paragraph

The Expo app owns the UI, local chat persistence, language switching, translation, and voice UX. The Express API owns auth, user profile, health checks, and AGMARKNET proxying. The database layer uses Neon PostgreSQL through `@neondatabase/serverless` and Drizzle. For agricultural advisory, the app first tries a backend `/api/agri/query` endpoint if configured; if that is missing or unavailable, it falls back to its built-in client-side advisory pipeline in `artifacts/agri-advisor/services/langgraph.ts`.

## Key features

- multilingual chat UI
- existing chat retranslation using preserved base text
- voice input and playback services
- weather and mandi price views
- government scheme and agricultural advisory responses
- auth flows with email/password
- backend contract for Neon-based Google OAuth callback
- responsive web layout
- resilient fallback behavior when backend or data providers are unavailable

## Tech stack

- Node.js
- pnpm workspaces
- TypeScript
- Expo 54
- React Native + React Native Web
- Expo Router
- Express 5
- Drizzle ORM
- Neon PostgreSQL
- AsyncStorage
- Open-Meteo
- AGMARKNET / data.gov.in
- MyMemory / LibreTranslate
- Hugging Face Whisper API
- optional Ollama local models

## Repo structure

```text
.
├─ artifacts/
│  ├─ agri-advisor/              # Expo app
│  │  ├─ app/                    # Routes and screens
│  │  ├─ components/             # Shared UI
│  │  ├─ context/                # Auth, chat, language state
│  │  ├─ services/               # Chat orchestration, translation, voice
│  │  ├─ backend/                # Python orchestrator reference
│  │  ├─ server/                 # Static web serving for built builds
│  │  └─ scripts/                # Expo start/build scripts
│  └─ api-server/                # Express API
├─ api/
│  └─ agri/
│     └─ agri.route.ts           # Optional Ollama-backed route
├─ lib/
│  └─ db/                        # Drizzle + Neon DB package
├─ scripts/
│  └─ start-workspace.cjs        # Starts Expo app + API server together
├─ .env.example                  # Root environment template
└─ README.md
```

## Prerequisites

Install these first:

- Node.js 20+ recommended
- pnpm
- a Neon PostgreSQL project
- a JWT secret for the API

Optional, depending on which features you want:

- a data.gov.in API key for AGMARKNET
- a Hugging Face token for native voice transcription
- a Neon Auth project if you want to use Google OAuth callback flow
- Ollama and the required local models if you want the full model-backed `/api/agri/query` path

## Environment configuration

There are two env layers in this repo:

1. root `.env`
2. app-local `artifacts/agri-advisor/.env.local`

### 1. Root environment

Copy the root example:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in these values:

```env
PORT=3000
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
JWT_SECRET=your-secret-key-here
DATA_GOV_API_KEY=your-data-gov-api-key-here
EXPO_PUBLIC_DATA_GOV_API_KEY=your-data-gov-api-key-here
NODE_ENV=development
NEON_AUTH_URL=https://your-neon-auth-url.neonauth.c-*.region.aws.neon.tech/dbname/auth
```

What each variable does:

- `PORT`
  port for the Express API server
- `DATABASE_URL`
  Neon/PostgreSQL connection string used by Drizzle and the API server
- `JWT_SECRET`
  signs app auth tokens
- `DATA_GOV_API_KEY`
  used by the backend market route
- `EXPO_PUBLIC_DATA_GOV_API_KEY`
  used by the app client fallback path
- `NEON_AUTH_URL`
  only relevant if you wire Neon Auth / Google OAuth flow into the client

### 2. Frontend app environment

Copy the app example:

```bash
cp artifacts/agri-advisor/.env.local.example artifacts/agri-advisor/.env.local
```

Windows PowerShell:

```powershell
Copy-Item artifacts/agri-advisor/.env.local.example artifacts/agri-advisor/.env.local
```

Default contents:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

You may also set:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
EXPO_PUBLIC_HF_TOKEN=hf_xxx
```

Notes:

- `EXPO_PUBLIC_API_URL` is used by the auth/profile API client
- `EXPO_PUBLIC_BACKEND_URL` is used by the advisory orchestration client for `/api/agri/query`
- `EXPO_PUBLIC_HF_TOKEN` is needed if you want more reliable native Whisper transcription

## Neon setup

This project uses Neon as the PostgreSQL provider through `@neondatabase/serverless`.

### Step 1. Create a Neon project

In Neon:

1. create a new project
2. create or select a database
3. copy the connection string
4. place that string into `DATABASE_URL` in your root `.env`

Example:

```env
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
```

### Step 2. Push the schema

The DB package uses Drizzle and currently defines a `users` table:

- `id`
- `email`
- `name`
- `picture`
- `neonUserId`
- `passwordHash`
- `createdAt`

Push the schema to Neon:

```bash
pnpm --filter @workspace/db run push
```

If you intentionally want a forced schema push:

```bash
pnpm --filter @workspace/db run push-force
```

Important:

- there is no seed script in this repo
- `push-force` can be destructive depending on schema drift

## How Neon is used here

### What works now

- email/password auth backed by the `users` table
- profile persistence in PostgreSQL
- password change
- profile fetch/update using the API server

### What is partially wired

Neon Auth / Google OAuth exists at the contract level:

- backend route: `POST /api/auth/google-callback`
- frontend methods:
  - `AuthService.handleGoogleCallback(...)`
  - `AuthContext.googleLogin(...)`

What that means in practice:

- the repo already stores `neonToken` and `neonUserId`
- the API expects Neon/Google user data
- but the visible client UI for starting the Google OAuth flow is not the main auth path today

So for local setup:

- email/password auth is the default supported path
- Neon Auth / Google OAuth is optional and requires additional client wiring around your Neon Auth redirect flow

## Install dependencies

At the workspace root:

```bash
pnpm install
```

The repo enforces pnpm via `only-allow pnpm`.

## Recommended local startup

### Option A. Start the normal workspace stack

This starts:

- the Express API server
- the Expo app

Command:

```bash
pnpm start
```

This uses `scripts/start-workspace.cjs`, which internally runs:

- `pnpm --filter @workspace/api-server run dev`
- `pnpm --filter @workspace/agri-advisor run start`

### Option B. Start services separately

API server:

```bash
pnpm api:dev
```

Expo app:

```bash
pnpm app:start
```

### Option C. Start only the Expo app

Useful when you want UI-only work and do not need auth/profile API calls:

```bash
pnpm --filter @workspace/agri-advisor run start
```

### Option D. Start only the API server

```bash
pnpm --filter @workspace/api-server run dev
```

## What runs on each side

### Expo app

Command:

```bash
pnpm --filter @workspace/agri-advisor run start
```

Behavior:

- launches `expo start --localhost`
- supports mobile simulator/device and web
- uses `EXPO_PUBLIC_API_URL` for auth/profile API calls
- uses `EXPO_PUBLIC_BACKEND_URL` for advisory backend attempts

### API server

Command:

```bash
pnpm --filter @workspace/api-server run dev
```

Behavior:

- builds the API server
- starts the built server on `PORT`
- exposes:
  - `GET /api/healthz`
  - `GET /api/market/agmarknet`
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/google-callback`
  - `GET /api/auth/me`
  - `PATCH /api/auth/profile`
  - `POST /api/auth/change-password`
  - `POST /api/auth/logout`

## Health check

Once the API is running:

```bash
curl http://localhost:3000/api/healthz
```

Expected response:

```json
{"status":"ok"}
```

## Running the app on web

If Expo is running, press `w` in the Expo terminal or open the local web URL shown by Expo.

For a production-style static web build:

```bash
pnpm --filter @workspace/agri-advisor run build
pnpm --filter @workspace/agri-advisor run serve
```

Or combined:

```bash
pnpm --filter @workspace/agri-advisor run preview
```

What this does:

- builds a static Expo web output
- serves it via `artifacts/agri-advisor/server/serve.js`

## Running on Android or iOS

After Expo starts:

- press `a` for Android if configured
- press `i` for iOS on macOS
- scan the QR code with Expo Go or use a simulator

## Advisory engine: default mode vs full model-backed mode

This repo supports two advisory execution modes.

### 1. Default mode: app + API server + client fallback

This is the mode you get with normal workspace startup.

Behavior:

- the app tries `POST {EXPO_PUBLIC_BACKEND_URL}/api/agri/query`
- if that backend path is unavailable, the app falls back to local orchestration in:
  - `artifacts/agri-advisor/services/langgraph.ts`
- fallback still supports:
  - intent classification
  - weather lookups
  - AGMARKNET lookups
  - scheme/general answers
  - multilingual reply rendering

This is the easiest way to run the project locally.

### 2. Full model-backed mode: Ollama + optional `/api/agri/query`

There is a standalone route source at:

- `api/agri/agri.route.ts`

That file is not mounted by `artifacts/api-server` by default.

It expects:

- Ollama running locally
- these models pulled:
  - `llama3`
  - `mistral`
  - `qwen:14b`
  - `llama3:70b`

The route comments also reference the Python orchestrator:

- `artifacts/agri-advisor/backend/langgraph_orchestrator.py`

### If you want full model-backed mode

Minimum manual setup:

1. install Ollama
2. start Ollama:

```bash
ollama serve
```

1. pull models:

```bash
ollama pull llama3
ollama pull mistral
ollama pull qwen:14b
ollama pull llama3:70b
```

1. mount `api/agri/agri.route.ts` into a server that exposes:

```text
POST /api/agri/query
```

1. set:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:YOUR_BACKEND_PORT
```

Important:

- this mode is optional
- the workspace does not mount that route automatically today
- `llama3:70b` has large memory requirements

## Detailed first-time setup

If you want the fastest path from clone to running app, use this exact order.

### Step 1. Clone

```bash
git clone <your-repo-url>
cd agri_ai
```

### Step 2. Install pnpm dependencies

```bash
pnpm install
```

### Step 3. Create env files

```bash
cp .env.example .env
cp artifacts/agri-advisor/.env.local.example artifacts/agri-advisor/.env.local
```

Fill in:

- `DATABASE_URL`
- `JWT_SECRET`
- `DATA_GOV_API_KEY` if you have one
- `EXPO_PUBLIC_API_URL=http://localhost:3000/api`

### Step 4. Create the Neon database schema

```bash
pnpm --filter @workspace/db run push
```

### Step 5. Start the workspace

```bash
pnpm start
```

### Step 6. Verify API health

```bash
curl http://localhost:3000/api/healthz
```

### Step 7. Open the app

- web: use the Expo web URL
- mobile: scan QR or open a simulator

### Step 8. Test auth

Create an account using the email/password flow.

### Step 9. Test chat

Try:

- `What is the wheat mandi price today in Haryana?`
- `Will it rain this week in Punjab?`
- `कपास के लिए कीट अलर्ट`

If `/api/agri/query` is not running, the app should still answer using the local fallback pipeline.

## Build and preview commands

### Workspace

```bash
pnpm build
pnpm typecheck
```

### App only

```bash
pnpm app:build
pnpm app:serve
pnpm preview
```

### API only

```bash
pnpm api:start
```

### Type checking

Workspace:

```bash
pnpm typecheck
```

App only:

```bash
pnpm --filter @workspace/agri-advisor run typecheck
```

API only:

```bash
pnpm --filter @workspace/api-server run typecheck
```

## Important implementation details

### Chat persistence

Chat history is stored in AsyncStorage by `ChatContext`.

The app maintains:

- `rawConversations`
  source-of-truth stored data
- `conversations`
  language-localized rendered view

This separation is what allows UI language changes to re-render existing conversations.

### Translation

The app uses:

- `services/translation.ts`
- MyMemory as primary translation provider
- LibreTranslate as fallback

Translation is used for:

- UI strings via `useLocalizedStrings`
- reply localization
- existing conversation re-rendering
- input normalization for non-English advisory requests

### Voice

Voice is handled in `services/voiceService.ts`.

Inputs:

- web speech recognition when supported
- native recording + Whisper transcription

Outputs:

- browser speech synthesis on web
- remote/native playback handling on mobile

If native transcription is important for your deployment, set:

```env
EXPO_PUBLIC_HF_TOKEN=hf_xxx
```

## Troubleshooting

### 1. `Cannot connect to server at http://localhost:3000/api`

Cause:

- API server is not running
- wrong `EXPO_PUBLIC_API_URL`
- physical device cannot resolve `localhost`

Fix:

- start the API with `pnpm api:dev`
- if testing on a physical device, replace `localhost` with your machine IP in `artifacts/agri-advisor/.env.local`

Example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api
```

### 2. Sign-up or login fails with database errors

Cause:

- `DATABASE_URL` missing or invalid
- Neon project not reachable
- schema not pushed

Fix:

1. verify `DATABASE_URL`
2. run:

```bash
pnpm --filter @workspace/db run push
```

1. restart the API server

### 3. Chat works but model-backed answers do not

Cause:

- `/api/agri/query` is not mounted
- `EXPO_PUBLIC_BACKEND_URL` not set
- Ollama not running

Fix:

- use the built-in fallback mode, or
- wire and run the optional route from `api/agri/agri.route.ts`

### 4. Voice input does nothing on mobile

Cause:

- microphone permission denied
- Hugging Face token missing
- unsupported environment

Fix:

- grant mic permission
- set `EXPO_PUBLIC_HF_TOKEN`
- test web speech recognition in Chrome/Edge for easier debugging

### 5. Existing chats do not appear translated

Check:

- app language changed in profile
- translation provider accessible
- older messages have base/original metadata available

The newer architecture stores base content specifically to improve retranslation behavior.

## Command reference

From workspace root:

```bash
pnpm start
pnpm dev
pnpm build
pnpm preview
pnpm typecheck

pnpm app:start
pnpm app:build
pnpm app:serve

pnpm api:dev
pnpm api:start

pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run push-force
```

## Recommended developer workflow

For UI and frontend work:

1. configure `.env` and `.env.local`
2. run `pnpm start`
3. use the Expo app with the default API server
4. rely on the client fallback advisory path during UI iteration

For backend/auth work:

1. configure Neon
2. push the DB schema
3. run `pnpm api:dev`
4. test `/api/healthz` and `/api/auth/*`

For full advisory model work:

1. install and run Ollama
2. pull required models
3. expose `/api/agri/query`
4. point `EXPO_PUBLIC_BACKEND_URL` to that backend

## Related files worth reading

- `artifacts/agri-advisor/services/langgraph.ts`
- `artifacts/agri-advisor/services/translation.ts`
- `artifacts/agri-advisor/services/voiceService.ts`
- `artifacts/agri-advisor/context/ChatContext.tsx`
- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/src/routes/market.ts`
- `lib/db/src/index.ts`
- `lib/db/src/schema/index.ts`
- `api/agri/agri.route.ts`
- `artifacts/agri-advisor/docs/agriadvisor-architecture.tex`

## Current limitations

- the full `/api/agri/query` route is not part of the default workspace startup
- Google/Neon OAuth is contract-ready but not the main visible auth path
- some advisory responses still depend on external translation providers
- live speech capabilities vary by browser/device support

## License

MIT
