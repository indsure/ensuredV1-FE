import fs from "fs";
import path from "path";
import { PROMPT_VERSION } from "../promptTemplate";
import { AIService } from "../services/aiService";
import { fetchPolicyWordings } from "../utils/policyWordingsFetcher";
import { validateParsedReport, performScoreArithmeticCheck } from "../services/analysisPipeline";
import { extractTextFromPDF } from "../routes";
import { AI_CONFIG } from "../config/ai_config";

let totalChecks = 0;
let passedChecks = 0;
let warnedChecks = 0;
let failedChecks = 0;

function pass(name: string) {
  passedChecks++;
  totalChecks++;
  console.log(`[PASS] ${name}`);
}

function fail(name: string, reason: string) {
  failedChecks++;
  totalChecks++;
  console.log(`[FAIL] ${name} - ${reason}`);
}

function warn(name: string, reason: string) {
  warnedChecks++;
  totalChecks++;
  console.log(`[WARN] ${name} - ${reason}`);
}

async function runHealthCheck() {
  console.log("=== INDSURE ENGINE HEALTH CHECK ===\n");

  // 1. PDF EXTRACTION
  const fixturesPath = path.join(__dirname, "fixtures");
  if (!fs.existsSync(fixturesPath)) {
    fs.mkdirSync(fixturesPath, { recursive: true });
  }

  const pdfFiles = fs.readdirSync(fixturesPath).filter(f => f.endsWith(".pdf"));
  if (pdfFiles.length === 0) {
    warn("PDF Extraction", "No fixture file found in backend/server/tests/fixtures/. Skipping actual extraction.");
  } else {
    try {
      const pdfPath = path.join(fixturesPath, pdfFiles[0]);
      const text = await extractTextFromPDF(pdfPath);
      const len = text.length;
      console.log(`[Info] Extracted ${len} characters from PDF.`);
      
      if (len > 500) {
        pass("PDF Extraction");
      } else if (len > 0) {
        warn("PDF Extraction", `Extracted between 1 and 499 characters (${len}).`);
      } else {
        fail("PDF Extraction", "0 characters extracted from PDF.");
      }
    } catch (err: any) {
      fail("PDF Extraction", `Exception: ${err.message}`);
    }
  }

  // 2. WORDING REPOSITORY MATCH
  try {
    const wordingsText = await fetchPolicyWordings("HDFC Ergo", "Optima Secure", "", "2023");
    const wordingSource = wordingsText && wordingsText.trim().length > 0 ? "repository_matched" : "schedule_only";
    console.log(`[Info] Wording match source: ${wordingSource}`);
    
    if (wordingSource === "repository_matched") {
      pass("Wording Repository Match");
    } else {
      warn("Wording Repository Match", "Matched 'schedule_only'. Repository check missed.");
    }
  } catch (err: any) {
    fail("Wording Repository Match", `Exception: ${err.message}`);
  }

  // 3. GEMINI API CONNECTIVITY
  try {
    const startTime = Date.now();
    const rawResponse = await AIService.generateContent(
      "Respond with the word PONG and nothing else.",
      "",
      AI_CONFIG.model
    );
    const latency = Date.now() - startTime;
    console.log(`[Info] Gemini API latency: ${latency}ms`);
    
    if (rawResponse.includes("PONG")) {
      pass("Gemini API Connectivity");
    } else {
      fail("Gemini API Connectivity", `Unexpected response: ${rawResponse}`);
    }
  } catch (err: any) {
    fail("Gemini API Connectivity", `Exception: ${err.message}`);
  }

  // 4. SCORE ARITHMETIC VALIDATOR
  try {
    const mockReport = {
      audit_score: {
        score: 61,
        breakdown: {
          net_cover_penalty: 10,
          claim_rejection_risk: 15,
          oop_exposure: 15,
          coverage_quality_gap: 5
        }
      },
      confidence_notes: []
    };

    performScoreArithmeticCheck(mockReport);
    
    if (mockReport.audit_score.score === 55 && mockReport.confidence_notes.length > 0) {
      pass("Score Arithmetic Validator");
    } else {
      fail("Score Arithmetic Validator", `Score was not updated correctly. Score: ${mockReport.audit_score.score}`);
    }
  } catch (err: any) {
    fail("Score Arithmetic Validator", `Exception: ${err.message}`);
  }

  // 5. PROMPT VERSION PRESENT
  try {
    if (typeof PROMPT_VERSION === "string" && PROMPT_VERSION.trim().length > 0) {
      // Basic semver check
      const semverRegex = /^(\d+)\.(\d+)\.(\d+)/;
      if (semverRegex.test(PROMPT_VERSION)) {
        pass("Prompt Version Present");
      } else {
        fail("Prompt Version Present", `PROMPT_VERSION found but not in semver format: ${PROMPT_VERSION}`);
      }
    } else {
      fail("Prompt Version Present", "PROMPT_VERSION is missing or strictly empty.");
    }
  } catch (err: any) {
    fail("Prompt Version Present", `Exception: ${err.message}`);
  }

  // 6. SCHEMA VALIDATION
  try {
    // Malformed report - missing final_verdict
    const malformedReport = {
      audit_score: {
        score: 100
      }
    };

    const validation = validateParsedReport(malformedReport);
    if (!validation.valid) {
      pass("Schema Validation");
    } else {
      fail("Schema Validation", "Silently accepted a malformed object missing final_verdict.");
    }
  } catch (err: any) {
    // If it throws, that also counts as passing (rejecting the bad object)
    pass("Schema Validation (threw exception)");
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Total checks: ${totalChecks}`);
  console.log(`Passed: ${passedChecks}`);
  console.log(`Warned: ${warnedChecks}`);
  console.log(`Failed: ${failedChecks}`);

  if (failedChecks > 0) {
    console.error("\n[CRITICAL] Engine health check failed. Please review errors before continuing.");
    process.exit(1);
  } else if (warnedChecks > 0) {
    console.warn("\nEngine operational with warnings — review before agent rollout.");
    process.exit(0);
  } else {
    console.log("\n[OK] Engine health check fully passed. System is go.");
    process.exit(0);
  }
}

runHealthCheck().catch(err => {
  console.error("Health check script encountered a fatal error:");
  console.error(err);
  process.exit(1);
});
