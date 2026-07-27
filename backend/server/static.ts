import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  // Vite builds frontend to repo-root/dist/public (per vite.config.ts build.outDir)
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
