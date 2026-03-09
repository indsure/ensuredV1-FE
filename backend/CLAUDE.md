# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Backend API for **Ensured Advisor** — an AI-powered health/life/vehicle insurance policy analysis platform. Users upload policy PDFs, the backend extracts text, enriches it with official policy wordings via RAG, runs it through Google Gemini for forensic audit analysis, and returns structured verdicts with suitability scores.

## Commands

```bash
npm run dev          # Start dev server with tsx (port 8080, or PORT env)
npm run build        # Compile TypeScript (tsc)
npm run check        # Type-check only (tsc --noEmit)

npm run db:migrate              # Run Drizzle migrations
npm run db:ingest-hospitals     # Ingest hospital network data into Supabase
npm run db:ingest-policies      # Ingest policy wording PDFs into vector store
```

## Environment Variables

- `GEMINI_API_KEY` — Google Gemini API key (required)
- `DATABASE_URL` — PostgreSQL connection string (Supabase with pgvector)
- `PORT` — Server port (default 8080)
- `NODE_ENV` — `development` / `production`

## Architecture

### Dual Code Structure (Legacy + Refactored)

The codebase has two parallel structures:
- **`server/`** — Legacy monolithic code (routes.ts has all route handlers inline). Still mounted but being replaced.
- **`src/`** — Refactored layered architecture. This is the active code path.

The entrypoint chain: `server.ts` → `app.ts` → `src/routes/index.ts` → `src/routes/v1.ts`

### Refactored `src/` Layout

- **`src/routes/`** — Express router definitions. `v1.ts` maps all `/api/*` endpoints to controllers.
- **`src/controllers/`** — Request handlers (analyze, extractPolicy, sachAI, hospital, pdf, userProfile).
- **`src/services/`** — Business logic layer:
  - `analysis.service.ts` — Main analysis pipeline (extract → metadata → RAG fetch → Gemini audit → suitability check)
  - `ai.service.ts` — Gemini API wrapper with guarded/replay execution
  - `extraction.service.ts` — PDF/image/text extraction using pdfjs-dist
  - `rag.service.ts` — RAG retrieval from Supabase pgvector (policy wordings + hospital networks)
  - `embedding.service.ts` — Gemini text-embedding-004 for vector embeddings
  - `suitability.service.ts` — Structural suitability scoring (BCAR ratio)
  - `policyWordings.service.ts` — Policy wording fetch/merge logic
  - `personalization.service.ts` — User profile-based personalization
- **`src/middlewares/`** — upload (multer), logger, error handler, validation, response wrapper
- **`src/config/index.ts`** — AI_CONFIG, RAG_CONFIG, APP_CONFIG constants
- **`src/constants/prompts/`** — All Gemini prompt templates (master audit, life, vehicle, policy extraction, sachAI)
- **`src/db/`** — Drizzle ORM setup with postgres.js driver + pgvector custom type
- **`src/db/schema.ts`** — Tables: hospitals, hospital_network_embeddings, policy_wording_chunks, user_profiles, analysis_jobs, analysis_results, chat_sessions
- **`src/data/`** — Static JSON data files (hospital networks, insurer normalization, plan aliases, city tiers)
- **`src/scripts/`** — Data ingestion scripts for hospitals and policy wordings

### Key Patterns

- **Background job processing**: `/api/analyze` returns a `jobId` immediately; client polls `/api/analyze/status/:jobId`. Jobs stored in-memory Map with 1-hour TTL.
- **RAG pipeline**: User-uploaded policy text → extract metadata (insurer/product) → vector search Supabase for official wordings → merge with uploaded text → send to Gemini.
- **Suitability override**: After Gemini returns audit results, `SuitabilityEngine` can hard-override the verdict to RISKY if BCAR ratio < 0.4.
- **ESM modules**: Project uses `"type": "module"` with ES2022 target. Use `import` not `require`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/analyze` | Upload policy PDF, returns jobId for async analysis |
| GET | `/api/analyze/status/:jobId` | Poll analysis job status/result |
| POST | `/api/extract-policy` | Extract structured policy data for comparison |
| GET | `/api/hospitals/filter` | Filter hospital networks by state/city/pincode |
| POST | `/api/generate-pdf` | Generate PDF report via Playwright |
| POST | `/api/sach-ai` | Conversational AI follow-up on analysis results |
| POST | `/api/user/profile` | Create user profile |
| GET | `/api/user/profile/:id` | Get user profile |
| GET | `/api/user/history/:profileId` | Get analysis history |
