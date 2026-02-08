import type { Express } from "express";
import type { Server } from "http";
import { createServer as createViteServer, createLogger } from "vite";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
    },
    appType: "custom",
    customLogger: {
      ...viteLogger,
      error: (msg) => {
        viteLogger.error(msg);
      },
    },
  });

  // Vite dev middleware
  app.use(vite.middlewares);

  // Catch-all for SPA (IMPORTANT: use /* not *)
  app.use("/*", async (req, res, next) => {
    try {
      const url = req.originalUrl;

      const indexPath = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(indexPath, "utf-8");

      template = template.replace(
        `/src/main.tsx`,
        `/src/main.tsx?v=${nanoid()}`,
      );

      const html = await vite.transformIndexHtml(url, template);

      res
        .status(200)
        .set({ "Content-Type": "text/html" })
        .end(html);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
}
