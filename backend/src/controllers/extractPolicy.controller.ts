import type { Request, Response } from "express";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { upload } from "../middlewares";
import { extractPolicyText } from "../services/extraction.service";
import { POLICY_EXTRACTION_PROMPT } from "../constants";
import { transformRawExtraction } from "../utils/policyTransformer";
import type { RawPolicyExtraction } from "../types/policy";
import {
  extractPolicyMetadata,
  fetchPolicyWordings,
  mergePolicyTexts,
} from "../utils/policyWordingsFetcher";

export const extractPolicyUploadMiddleware = (req: Request, res: Response, next: Function) => {
  upload.single("policy_pdf")(req, res, (err: any) => {
    if (err) {
      console.error("MULTER ERROR:", err);
      return res.status(400).json({
        error: "File upload failed: " + (err.message || "Unknown error"),
      });
    }
    next();
  });
};

export async function handleExtractPolicy(req: Request, res: Response) {
  try {
    console.log("POLICY EXTRACTION - REQUEST RECEIVED");
    console.log(
      "POLICY EXTRACTION - req.file:",
      req.file ? "EXISTS" : "MISSING"
    );
    console.log("POLICY EXTRACTION - req.body:", Object.keys(req.body));

    if (!req.file) {
      console.error("POLICY EXTRACTION - No file in request!");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(
      "POLICY EXTRACTION - FILE RECEIVED:",
      req.file.originalname
    );
    console.log("POLICY EXTRACTION - File size:", req.file.size, "bytes");
    console.log("POLICY EXTRACTION - File mimetype:", req.file.mimetype);
    console.log("POLICY EXTRACTION - File path:", req.file.path);

    // Step 1: Extract text from PDF
    console.log("POLICY EXTRACTION - Starting text extraction...");
    let uploadedPolicyText: string;
    try {
      uploadedPolicyText = await extractPolicyText(req.file);
      console.log(
        "POLICY EXTRACTION - Text extraction successful, length:",
        uploadedPolicyText.length
      );
    } catch (extractError: any) {
      console.error(
        "POLICY EXTRACTION - Text extraction failed:",
        extractError
      );

      fs.unlinkSync(req.file.path);
      return res.status(500).json({
        error:
          "Failed to extract text from PDF: " + extractError.message,
      });
    }

    fs.unlinkSync(req.file.path);

    if (!uploadedPolicyText.trim()) {
      console.error("POLICY EXTRACTION - Extracted text is empty!");
      return res
        .status(400)
        .json({ error: "No text extracted from file" });
    }

    console.log(
      "POLICY EXTRACTION - TEXT LENGTH:",
      uploadedPolicyText.length
    );

    // Step 2: Extract policy metadata and fetch wordings
    console.log(
      "POLICY EXTRACTION - Extracting metadata and fetching wordings..."
    );
    const metadata = await extractPolicyMetadata(uploadedPolicyText);
    console.log("POLICY EXTRACTION - Metadata:", metadata);

    let wordingsText: string | null = null;
    if (metadata.insurer && metadata.product) {
      console.log(
        `POLICY EXTRACTION - Fetching wordings for ${metadata.insurer} - ${metadata.product}...`
      );
      wordingsText = await fetchPolicyWordings(
        metadata.insurer,
        metadata.product || "",
        metadata.plan || "",
        metadata.year || ""
      );
      if (wordingsText) {
        console.log(
          "POLICY EXTRACTION - Wordings fetched, length:",
          wordingsText.length
        );
      }
    }

    // Step 3: Merge texts
    const policyText = mergePolicyTexts(uploadedPolicyText, wordingsText);
    console.log(
      "POLICY EXTRACTION - Merged text length:",
      policyText.length
    );

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY not set" });
    }

    console.log("POLICY EXTRACTION - CALLING GEMINI...");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-pro-preview",
      generationConfig: {
        temperature: 0,
        topP: 0.95,
      },
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              "Request timeout: Gemini API took too long to respond (5 minutes)"
            )
          ),
        5 * 60 * 1000
      );
    });

    const generatePromise = model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: POLICY_EXTRACTION_PROMPT + "\n\n" + policyText,
            },
          ],
        },
      ],
    });

    const result = (await Promise.race([
      generatePromise,
      timeoutPromise,
    ])) as any;
    const responseText = result.response.text();

    console.log("POLICY EXTRACTION - GEMINI RESPONSE RECEIVED");

    // Step 3: Parse JSON response
    let rawExtraction: RawPolicyExtraction;
    try {
      const jsonMatch =
        responseText.match(
          /```(?:json)?\s*(\{[\s\S]*\})\s*```/
        ) || responseText.match(/(\{[\s\S]*\})/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;
      rawExtraction = JSON.parse(jsonText);
    } catch (parseError: any) {
      console.error(
        "POLICY EXTRACTION - JSON PARSE ERROR:",
        parseError
      );
      return res.status(500).json({
        error: "Failed to parse extraction response",
        details:
          "Gemini returned invalid JSON. Please try again or verify the PDF is readable.",
        raw_response_preview: responseText.substring(0, 500),
      });
    }

    // Step 4: Validate critical fields
    const missingFields: string[] = [];
    if (!rawExtraction.policy_metadata?.insurer)
      missingFields.push("insurer");
    if (!rawExtraction.policy_metadata?.policy_name)
      missingFields.push("plan_name");
    if (!rawExtraction.coverage?.sum_insured)
      missingFields.push("sum_insured");
    if (!rawExtraction.coverage?.annual_premium)
      missingFields.push("annual_premium");

    if (missingFields.length > 0) {
      console.warn(
        "POLICY EXTRACTION - Missing critical fields:",
        missingFields
      );
    }

    // Step 5: Transform to full policy structure
    const policyData = transformRawExtraction(
      rawExtraction,
      req.file.originalname
    );

    // Step 6: Return extracted policy
    return res.json({
      policy_id: policyData.policy_id,
      extracted_data: policyData,
      extraction_metadata: {
        confidence:
          policyData.extraction_metadata.extraction_confidence,
        missing_fields:
          policyData.extraction_metadata.missing_fields,
        needs_verification:
          policyData.extraction_metadata
            .manual_verification_needed,
      },
    });
  } catch (err: any) {
    console.error("POLICY EXTRACTION ERROR:", err);
    console.error("POLICY EXTRACTION ERROR STACK:", err.stack);

    let errorMessage = err.message || "Unknown error occurred";
    let statusCode = 500;

    if (errorMessage.includes("timeout")) {
      errorMessage =
        "Extraction timed out. The PDF may be too large or complex. Please try again.";
      statusCode = 408;
    } else if (errorMessage.includes("GEMINI_API_KEY")) {
      errorMessage = "API key not configured";
      statusCode = 500;
    } else if (
      errorMessage.includes("quota") ||
      errorMessage.includes("429")
    ) {
      errorMessage =
        "API quota exceeded. Please check your Gemini API usage limits.";
      statusCode = 429;
    }

    // Clean up file if it still exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error("Failed to clean up file:", unlinkErr);
      }
    }

    return res.status(statusCode).json({
      error: "Policy extraction failed: " + errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? err.stack
          : undefined,
    });
  }
}
