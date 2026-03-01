import { Router } from "express";
import {
  handleAnalyze,
  handleAnalyzeStatus,
  analyzeUploadMiddleware,
  handleExtractPolicy,
  extractPolicyUploadMiddleware,
  handleHospitalFilter,
  handlePdfTest,
  handleGeneratePdf,
  handleSachAI,
} from "../controllers";

const router = Router();

// Analysis
router.post("/analyze", analyzeUploadMiddleware, handleAnalyze);
router.get("/analyze/status/:jobId", handleAnalyzeStatus);

// Policy extraction
router.post("/extract-policy", extractPolicyUploadMiddleware, handleExtractPolicy);

// Hospital network
router.get("/hospitals/filter", handleHospitalFilter);

// PDF generation
router.get("/generate-pdf/test", handlePdfTest);
router.post("/generate-pdf", handleGeneratePdf);

// Sach AI
router.post("/sach-ai", handleSachAI);

export default router;
