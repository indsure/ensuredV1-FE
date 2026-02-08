# Ensured Frontend (React + Vite)

Standalone React frontend. Deploy to **Vercel** or run locally with the backend.

## Local development

From this folder:

```bash
npm install
npm run dev
```

Runs at http://localhost:5173. API calls go to `/api/*`, which Vite proxies to `http://localhost:5000` by default. Start the backend separately (see `../backend/README.md`).

## Deploy on Vercel

1. In Vercel, **import** or **push** this repo and set the **Root Directory** to `frontend` (not the repo root).
2. Vercel will detect Vite and use `npm run build`; output is `dist/`.
3. Set **Environment variable** for production:
   - `VITE_API_URL` = your backend base URL (e.g. `https://api.yourdomain.com`) with **no trailing slash**.

Without `VITE_API_URL`, the app will call `/api/...` on the same origin (same as the Vercel deployment), which will 404 unless you run a serverless API there.

## Scripts

| Script   | Description        |
|----------|--------------------|
| `npm run dev`    | Dev server (port 5173) |
| `npm run build`  | Production build → `dist/` |
| `npm run preview`| Preview production build |
| `npm run check`  | TypeScript check |

## Project layout

- `client/` – Vite app root: `index.html`, `src/`, `public/`
- `dist/` – Build output (after `npm run build`)
