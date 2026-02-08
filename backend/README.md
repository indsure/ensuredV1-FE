# Ensured Backend (Express API)

Standalone Express API. Run locally or deploy to any Node host (Railway, Render, Fly, etc.).

## Local development

From this folder:

```bash
npm install
cp .env.example .env.local   # if present
# Set GEMINI_API_KEY and optionally PORT in .env.local
npm run dev
```

Runs at http://localhost:5000 (or `PORT`). CORS is set for `http://localhost:5173` so the frontend can call the API.

## Environment

| Variable        | Description                    |
|-----------------|--------------------------------|
| `GEMINI_API_KEY` | Google Gemini API key (required) |
| `PORT`          | Server port (default 5000)     |
| `NODE_ENV`      | `development` / `production`   |

## Scripts

| Script   | Description              |
|----------|--------------------------|
| `npm run dev`   | Run with tsx (no build)   |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start`     | Run compiled app: `node dist/index.js` |
| `npm run check` | TypeScript check only    |

## Shared schema

The backend imports **`@shared/schema`** (the repo’s `shared/schema.ts`), which defines the Drizzle `users` table and `User` / `InsertUser` types used in `server/storage.ts`.

- **Development** (`npm run dev`): run from the **`backend/`** directory. The `shared/` folder must exist at repo root (`../shared`). `tsx` resolves the `@shared/*` path via `tsconfig.json` and the backend’s `drizzle-orm` / `drizzle-zod` dependencies.
- **Production build**: the compiled output does not rewrite `@shared` imports, so for a full production build you’d need to run from the monorepo with path resolution (e.g. `tsx` or `node` with `tsconfig-paths`) or use a bundler. For a quick production run, use `npm run dev` from `backend/` with `shared/` present.

## Project layout

- `server/` – Express app: `index.ts`, `routes.ts`, `storage.ts`, services, data, etc.
- `dist/` – Build output (after `npm run build`)
