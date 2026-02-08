import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

import { registerRoutes, analysisJobs } from "./routes";
import { serveStatic } from "./static";
import { SACH_AI_SYSTEM_PROMPT } from "./sachAI.prompt";

/* ---------------- UPLOAD DIRECTORY CLEANUP ---------------- */

function cleanupUploadsDirectory() {
  const uploadsDir = path.resolve(import.meta.dirname, "..", "uploads");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    return;
  }

  try {
    const files = fs.readdirSync(uploadsDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    let cleaned = 0;
    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch {}
    });

    if (cleaned > 0) {
      console.log(
        `🧹 Cleaned up ${cleaned} old file(s) from uploads directory`,
      );
    }
  } catch (err) {
    console.error("Failed to cleanup uploads directory:", err);
  }
}

cleanupUploadsDirectory();
setInterval(cleanupUploadsDirectory, 60 * 60 * 1000);

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ---------------- SERVER SETUP ---------------- */

const app = express();
const server = createServer(app);

/* ---------------- CORS ---------------- */

app.use(
  cors({
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

/* ---------------- BODY PARSING ---------------- */

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ---------------- API LOGGER ---------------- */

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    }
  });

  next();
});

/* =========================================================
   SACH AI — TRUTH MODE (NEW, STANDALONE)
   ========================================================= */

app.post("/api/sach-ai", async (req: Request, res: Response) => {
  try {
    const { messages = [], jobId } = req.body;

    let policyText = "";

    if (jobId) {
      const job = (analysisJobs as any)?.get?.(jobId);
      policyText = job?.result?.__internal?.policyText || "";
    }

    // fallback to demo policy if no job text
    if (!policyText) {
      try {
        const demoPath = path.join(
          process.cwd(),
          "server",
          "knowledge_base",
          "demo_policy.txt",
        );
        console.log("Loading Demo Policy from:", demoPath); // Debug log
        policyText = fs.readFileSync(demoPath, "utf-8");
      } catch (e) {
        console.error("FAILED to load demo policy:", e);
        policyText = "No policy uploaded yet.";
      }
    }

    const systemPrompt =
      SACH_AI_SYSTEM_PROMPT +
      "\n\nUPLOADED POLICY TEXT (SOURCE OF TRUTH):\n" +
      policyText;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Aligning with routes.ts to use the model that is known to work with this key
    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

    // Format history for SDK
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    // Safety check for empty message
    if (!lastMessage || !lastMessage.content) {
      throw new Error("Invalid message format: missing content");
    }

    const { HarmCategory, HarmBlockThreshold } = await import(
      "@google/generative-ai"
    );

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [
            {
              text: "Understood. I am Sach AI, ready to tell the truth about this policy.",
            },
          ],
        },
        ...history,
      ],
      generationConfig: {
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        // Adding more explicit categories just in case
        {
          category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const result = await chat.sendMessageStream(lastMessage.content);

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      for await (const chunk of result.stream) {
        try {
          const chunkText = chunk.text();
          res.write(chunkText);
        } catch (chunkError) {
          const logMsg = `[CHUNK ERROR] ${chunkError} | FinishReason: ${JSON.stringify(
            chunk.candidates?.[0]?.finishReason,
          )}\n`;
          fs.appendFileSync(path.join(process.cwd(), "sach_debug.log"), logMsg);

          // If safety filter triggered, send a message to user
          if (!res.headersSent) {
            res.write(
              "\n\n(Note: The response was interrupted by safety filters. We are tuning them.)",
            );
          }
        }
      }
    } catch (streamError: any) {
      const logMsg = `[STREAM ERROR] ${streamError.message}\n`;
      fs.appendFileSync(path.join(process.cwd(), "sach_debug.log"), logMsg);
    }

    res.end();
  } catch (err: any) {
    const errorMsg = `[${new Date().toISOString()}] Sach AI Error: ${
      err.message
    }\nStack: ${err.stack}\n\n`;
    console.error(errorMsg);

    try {
      fs.appendFileSync(path.join(process.cwd(), "sach_debug.log"), errorMsg);
    } catch (fsErr) {
      console.error("Failed to write to log file", fsErr);
    }

    if (!res.headersSent) {
      res.status(500).json({
        message: "Sach AI service failed",
        details: err.message,
        hint: "Check sach_debug.log",
      });
    } else {
      res.end();
    }
  }
});

/* ---------------- BOOTSTRAP ---------------- */

async function start() {
  console.log("[SERVER] Registering routes...");
  await registerRoutes(server, app);
  console.log("[SERVER] Routes registered successfully");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API ERROR:", err);
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;

  server.listen(port, "127.0.0.1", () => {
    console.log(`API server running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("FAILED TO START SERVER:", err);
  process.exit(1);
});
