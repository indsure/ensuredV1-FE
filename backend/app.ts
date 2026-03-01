import express from "express";
import cors from "cors";
import { apiLogger, globalErrorHandler } from "./src/middlewares";
import { registerRoutes } from "./src/routes";

const app = express();

/* ---------------- CORS ---------------- */

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ---------------- BODY PARSING ---------------- */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

/* ---------------- API LOGGER ---------------- */

app.use(apiLogger);

/* ---------------- ROUTES ---------------- */

registerRoutes(app);

/* ---------------- ERROR HANDLER ---------------- */

app.use(globalErrorHandler);

export default app;
