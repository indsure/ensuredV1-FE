/**
 * API Routes for IndSure Scoring Engine
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { extractPolicies } from '../extraction/extraction-orchestrator';
import { scorePolicies, rescoreWithCustomWeights } from '../scoring/scoring-engine';
import { generateVerdict } from '../verdict/verdict-generator';
import { sessionStore } from './session-store';
import { UserProfileSchema, ScoringWeightsSchema } from '../types/scoring';
import { getInsurerById } from '../extraction/insurer-resolver-bridge';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for in-memory file uploads (no disk persistence)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 4, // Max 4 files
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

/**
 * POST /api/upload
 * Upload 1-4 PDFs and extract policy data
 */
router.post('/upload', upload.array('files', 4), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log(`Extracting ${files.length} PDF(s)...`);
    
    // Extract policies from PDFs
    const buffers = files.map((f) => f.buffer);
    const policies = await extractPolicies(buffers);
    
    if (policies.length === 0) {
      return res.status(400).json({ error: 'Failed to extract any policies' });
    }
    
    // Create session
    const sessionId = uuidv4();
    sessionStore.create(sessionId, policies);
    
    console.log(`Extracted ${policies.length} policies, session: ${sessionId}`);
    
    res.json({
      session_id: sessionId,
      extracted_policies: policies,
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Extraction failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/compare
 * Score and compare policies
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { session_id, user_profile, scoring_profile_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'session_id required' });
    }
    
    // Get policies from session
    const policies = sessionStore.get(session_id);
    
    if (!policies) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    // Validate user profile
    const userProfile = UserProfileSchema.parse({
      ...user_profile,
      scoring_profile_id: scoring_profile_id || 'balanced',
    });
    
    console.log(`Scoring ${policies.length} policies with profile: ${userProfile.scoring_profile_id}`);
    
    // Score policies
    const scoredPolicies = await scorePolicies(policies, userProfile);
    
    // Generate verdict
    const verdict = generateVerdict(scoredPolicies);
    
    res.json({
      scored_policies: scoredPolicies,
      verdict,
    });
    
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({
      error: 'Scoring failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/rescore
 * Rescore with custom weights
 */
router.post('/rescore', async (req: Request, res: Response) => {
  try {
    const { session_id, user_profile, custom_weights } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'session_id required' });
    }
    
    if (!custom_weights) {
      return res.status(400).json({ error: 'custom_weights required' });
    }
    
    // Get policies from session
    const policies = sessionStore.get(session_id);
    
    if (!policies) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    // Validate user profile and weights
    const userProfile = UserProfileSchema.parse(user_profile);
    const weights = ScoringWeightsSchema.parse(custom_weights);
    
    console.log(`Rescoring ${policies.length} policies with custom weights`);
    
    // Rescore policies
    const scoredPolicies = await rescoreWithCustomWeights(policies, userProfile, weights);
    
    // Generate verdict
    const verdict = generateVerdict(scoredPolicies);
    
    res.json({
      scored_policies: scoredPolicies,
      verdict,
    });
    
  } catch (error) {
    console.error('Rescore error:', error);
    res.status(500).json({
      error: 'Rescoring failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/session/:id
 * Delete session immediately (DPDP compliance)
 */
router.delete('/session/:id', (req: Request, res: Response) => {
  const sessionId = req.params.id;
  
  const deleted = sessionStore.delete(sessionId);
  
  if (deleted) {
    res.json({ deleted: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

/**
 * GET /api/insurer/:id
 * Get insurer details (for SEO pages)
 */
router.get('/insurer/:id', async (req: Request, res: Response) => {
  try {
    const insurerId = req.params.id;
    
    const insurer = await getInsurerById(insurerId);
    
    if (!insurer) {
      return res.status(404).json({ error: 'Insurer not found' });
    }
    
    // Get latest metrics
    const metrics = await prisma.insurerMetric.findMany({
      where: { insurerId },
      orderBy: { fiscalYear: 'desc' },
      take: 10,
    });
    
    res.json({
      insurer,
      metrics,
    });
    
  } catch (error) {
    console.error('Insurer lookup error:', error);
    res.status(500).json({ error: 'Failed to fetch insurer data' });
  }
});

/**
 * GET /api/glossary
 * Get all glossary terms
 */
router.get('/glossary', async (_req: Request, res: Response) => {
  try {
    const terms = await prisma.glossaryTerm.findMany({
      where: { language: 'EN' },
      orderBy: { term: 'asc' },
    });
    
    res.json({ terms });
    
  } catch (error) {
    console.error('Glossary error:', error);
    res.status(500).json({ error: 'Failed to fetch glossary' });
  }
});

/**
 * GET /api/facts
 * Get random educational facts
 */
router.get('/facts', async (_req: Request, res: Response) => {
  try {
    const allFacts = await prisma.educationalFact.findMany({
      where: { language: 'EN' },
    });
    
    // Return 5 random facts
    const shuffled = allFacts.sort(() => Math.random() - 0.5);
    const facts = shuffled.slice(0, 5);
    
    res.json({ facts });
    
  } catch (error) {
    console.error('Facts error:', error);
    res.status(500).json({ error: 'Failed to fetch facts' });
  }
});

/**
 * GET /api/data-freshness
 * Get data freshness metadata
 */
router.get('/data-freshness', async (_req: Request, res: Response) => {
  try {
    const freshness = await prisma.dataFreshness.findFirst({
      orderBy: { lastRefreshedAt: 'desc' },
    });
    
    res.json({ freshness });
    
  } catch (error) {
    console.error('Data freshness error:', error);
    res.status(500).json({ error: 'Failed to fetch data freshness' });
  }
});

export default router;
