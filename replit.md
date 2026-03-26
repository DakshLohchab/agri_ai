# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains an Expo React Native mobile app (AgriAdvisor AI) and Express API backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── agri-advisor/       # Expo React Native mobile app
│   └── mockup-sandbox/     # UI mockup sandbox
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
└── package.json            # Root package
```

## AgriAdvisor AI Mobile App

**Path**: `artifacts/agri-advisor/`

### Features
- **Sign Up / Sign In flows** — Beautiful onboarding with 3-step registration (name/phone, location, crops)
- **Home Screen** — Personalized greeting, quick queries, mini pipeline visualization
- **Ask AI Tab** — Conversation list with swipe-to-delete
- **Chat Screen** — Full AI chat with live agent step visualization
- **Weather Tab** — Live weather via Open-Meteo API (free, no API key)
- **Market Tab** — Commodity prices (MSP + estimated mandi) + Government schemes
- **AI Agents Tab** — Live LangGraph pipeline visualization with 5 edge-case demos

### LangGraph Architecture
6-node state machine (`artifacts/agri-advisor/backend/langgraph_orchestrator.py`):
1. **Guardrails** (Llama-3-8B) — Safety, off-domain blocking, ambiguity detection
2. **Intent** (Mistral-7B) — Query routing + entity extraction
3. **Web Search** (Qwen-14B) — Live pest alerts, scheme updates
4. **Weather** (Open-Meteo API) — Free live weather
5. **Market** (AgMarkNet stub) — MSP + mandi prices with graceful fallback
6. **Synthesis** (Llama-3-70B) — Final multilingual advice with action steps

### Edge Case Demos (5 built-in)
1. Off-Domain Block — detects non-agriculture queries
2. Ambiguity Detection — requests clarification
3. Weather API Fallback — graceful degradation
4. Market Price Fallback — MSP when AgMarkNet unavailable
5. Low Confidence Escalation — escalates uncertain diagnoses

### Design
- Dark green theme (`#0A0F0D` background, `#1DB954` primary)
- Inter font family throughout
- LangGraph native tabs (NativeTabs with liquid glass on iOS 26+)
- Framer-style animations using React Native Animated
- Beautiful onboarding with hero farm image

## Packages

### `artifacts/agri-advisor` (`@workspace/agri-advisor`)
Expo 54 React Native app with:
- `expo-router` — File-based routing
- `expo-linear-gradient` — Gradient backgrounds
- `expo-haptics` — Tactile feedback
- `@tanstack/react-query` — Server state management
- `react-native-gesture-handler` — Swipe gestures
- `react-native-keyboard-controller` — Keyboard handling
- `AsyncStorage` — Local data persistence

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server (shared backend).

### `lib/db` (`@workspace/db`)
Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI spec + Orval codegen config.
