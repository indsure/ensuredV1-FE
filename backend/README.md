# IndSure Backend (Express API)

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
| `npm run dev`   | Run with tsx (no build step) |
| `npm start`     | Same as `dev`. There is no compile step. |
| `npm run build` | `tsc --noEmit`, i.e. a typecheck, not a build |
| `npm run check` | TypeScript check only    |

Nothing here compiles to `dist/`. The service runs from TypeScript via `tsx`,
in development and on the EC2 box alike.

## Dependencies

`backend/package.json` declares everything `server/` and `src/` import, and is
complete on its own as of 2026-09-01. Before that it was not: `pg` and
`nodemailer` were declared here but `express-rate-limit` only in the root
manifest, so a clean `npm ci` in either directory alone produced a server that
could not start. If you add an import, add it to this file.

## Shared code

`shared/policy.ts` at the repo root holds the `ForensicAuditReport` contract.
Today only the frontend imports it, through its `@shared` alias; the backend
describes the same shape in `promptTemplate.ts` and does not import the types.
Having the backend validate against the shared contract would be an
improvement, but it would mean teaching `tsx` the alias at runtime, so it has
not been done.

## Project layout

- `server/` – Express app: `index.ts`, `routes.ts`, `teamRoutes.ts`, services, data
- `src/` – A second, separate Express server on port 3001 for the Playwright
  policy-fetch experiment. **Parked, not deployed, and not started by
  `npm run dev`.** Reachable only via the root `dev:all` script.
- `catalog_seed/` – Plan catalog JSON, loaded by `scripts/ops/load_catalog.mjs`
