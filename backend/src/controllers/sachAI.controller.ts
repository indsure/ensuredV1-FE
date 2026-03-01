import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SACH_AI_SYSTEM_PROMPT } from "../constants";
import { analysisJobs } from "../utils/jobManager";

export async function handleSachAI(req: Request, res: Response) {
  try {
    const { messages = [], jobId } = req.body;

    let policyText = "";

    if (jobId) {
      const job = analysisJobs.get(jobId);
      policyText = job?.result?.__internal?.policyText || "";
    }

    // fallback to demo policy if no job text
    if (!policyText) {
      try {
        const demoPath = path.join(
          process.cwd(),
          "src",
          "knowledge_base",
          "demo_policy.txt"
        );
        console.log("Loading Demo Policy from:", demoPath);
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
      throw new Error(
        "GEMINI_API_KEY is not defined in environment variables"
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-pro-preview",
    });

    // Format history for SDK
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];

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
            chunk.candidates?.[0]?.finishReason
          )}\n`;
          fs.appendFileSync(
            path.join(process.cwd(), "sach_debug.log"),
            logMsg
          );

          if (!res.headersSent) {
            res.write(
              "\n\n(Note: The response was interrupted by safety filters. We are tuning them.)"
            );
          }
        }
      }
    } catch (streamError: any) {
      const logMsg = `[STREAM ERROR] ${streamError.message}\n`;
      fs.appendFileSync(
        path.join(process.cwd(), "sach_debug.log"),
        logMsg
      );
    }

    res.end();
  } catch (err: any) {
    const errorMsg = `[${new Date().toISOString()}] Sach AI Error: ${err.message}\nStack: ${err.stack}\n\n`;
    console.error(errorMsg);

    try {
      fs.appendFileSync(
        path.join(process.cwd(), "sach_debug.log"),
        errorMsg
      );
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
}
