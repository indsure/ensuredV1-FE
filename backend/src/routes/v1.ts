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
  handleCreateProfile,
  handleGetProfile,
  handleGetHistory,
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

// User profiles
router.post("/user/profile", handleCreateProfile);
router.get("/user/profile/:id", handleGetProfile);
router.get("/user/history/:profileId", handleGetHistory);

export default router;
