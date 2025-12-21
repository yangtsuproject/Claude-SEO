import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';

/**
 * Project Controller
 * Handles CRUD operations for projects
 */

/**
 * Get all projects for the authenticated user
 */
export async function getProjects(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            keywordResearch: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch projects',
    });
  }
}

/**
 * Get a single project by ID
 */
export async function getProject(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId, // Ensure user owns this project
      },
      include: {
        keywordResearch: {
          include: {
            _count: {
              select: {
                keywords: true,
                clusters: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    return res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project',
    });
  }
}

/**
 * Create a new project
 */
export async function createProject(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { name, domain, targetLocation } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Project name is required',
      });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        domain: domain?.trim() || null,
        targetLocation: targetLocation || 'Singapore',
        userId,
      },
    });

    console.log(`✅ Created project: ${project.name} (${project.id})`);

    return res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create project',
    });
  }
}

/**
 * Update a project
 */
export async function updateProject(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, domain, targetLocation } = req.body;

    // Check if project exists and belongs to user
    const existingProject = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!existingProject) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Update project
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(domain !== undefined && { domain: domain?.trim() || null }),
        ...(targetLocation && { targetLocation }),
      },
    });

    console.log(`✅ Updated project: ${project.name} (${project.id})`);

    return res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update project',
    });
  }
}

/**
 * Delete a project
 */
export async function deleteProject(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Check if project exists and belongs to user
    const existingProject = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!existingProject) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Delete project (cascade will delete related data)
    await prisma.project.delete({
      where: { id },
    });

    console.log(`✅ Deleted project: ${existingProject.name} (${id})`);

    return res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete project',
    });
  }
}
