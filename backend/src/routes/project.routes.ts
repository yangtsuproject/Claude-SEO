import { Router } from 'express';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/project.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

// All project routes require authentication
router.use(authenticateUser);

/**
 * @route   GET /api/projects
 * @desc    Get all projects for authenticated user
 * @access  Private
 */
router.get('/', getProjects);

/**
 * @route   GET /api/projects/:id
 * @desc    Get a single project by ID
 * @access  Private
 */
router.get('/:id', getProject);

/**
 * @route   POST /api/projects
 * @desc    Create a new project
 * @access  Private
 */
router.post('/', createProject);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update a project
 * @access  Private
 */
router.put('/:id', updateProject);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete a project
 * @access  Private
 */
router.delete('/:id', deleteProject);

export default router;
