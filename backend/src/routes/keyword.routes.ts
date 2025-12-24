import { Router } from 'express';
import {
  createKeywordResearch,
  getKeywordResearch,
  getProjectKeywordResearch,
  exportToGoogleSheets,
  deleteKeywordResearch,
  extractSeedKeywords,
  identifyPillars,
} from '../controllers/keyword.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

// All keyword research routes require authentication
router.use(authenticateUser);

/**
 * @route   POST /api/keyword-research/extract-seeds
 * @desc    Extract seed keywords from natural language description (OLD)
 * @access  Private
 */
router.post('/extract-seeds', extractSeedKeywords);

/**
 * @route   POST /api/keyword-research/identify-pillars
 * @desc    Identify keyword pillars from business description (NEW PILLAR-FIRST APPROACH)
 * @access  Private
 */
router.post('/identify-pillars', identifyPillars);

/**
 * @route   POST /api/keyword-research
 * @desc    Create a new keyword research job
 * @access  Private
 */
router.post('/', createKeywordResearch);

/**
 * @route   GET /api/keyword-research/:id
 * @desc    Get keyword research by ID
 * @access  Private
 */
router.get('/:id', getKeywordResearch);

/**
 * @route   GET /api/keyword-research/project/:projectId
 * @desc    Get all keyword research for a project
 * @access  Private
 */
router.get('/project/:projectId', getProjectKeywordResearch);

/**
 * @route   POST /api/keyword-research/:id/export
 * @desc    Export keyword research to Google Sheets
 * @access  Private
 */
router.post('/:id/export', exportToGoogleSheets);

/**
 * @route   DELETE /api/keyword-research/:id
 * @desc    Delete a keyword research
 * @access  Private
 */
router.delete('/:id', deleteKeywordResearch);

export default router;
