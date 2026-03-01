import type { Express } from "express";
import v1Router from "./v1";

export function registerRoutes(app: Express) {
  console.log("[ROUTES] Starting route registration... (v3.0 - layered)");

  app.use("/api", v1Router);

  console.log("[ROUTES] All routes registered successfully");
}
