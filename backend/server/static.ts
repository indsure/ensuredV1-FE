import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  // Legacy path, from when one process served both API and frontend. The
  // frontend now builds to frontend/dist and is served by Vercel, so this
  // directory is not produced any more and the caller's try/catch takes over.
  // Kept as the fallback for a single-process run; point it at frontend/dist
  // if that is ever revived.
  const distPath = path.resolve(__dirname, "../../dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // SPA fallback — serve index.html for all non-API routes
  app.use("/*", (req, res) => {
    if (req.path.startsWith("/api")) return;
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
