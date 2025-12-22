import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { KeywordService } from '../services/keyword.service';
import { addKeywordResearchJob, getJobStatus } from '../queues/keyword.queue';
import { prisma } from '../utils/prisma';
import { google } from 'googleapis';

const keywordService = new KeywordService();

/**
 * Keyword Research Controller
 * Handles keyword research operations
 */

/**
 * Create a new keyword research job
 */
export async function createKeywordResearch(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { projectId, seedKeywords, targetLocation, keywordLimit, includePAA } = req.body;

    // Validation
    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Project ID is required',
      });
    }

    if (!seedKeywords || !Array.isArray(seedKeywords) || seedKeywords.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Seed keywords array is required and must not be empty',
      });
    }

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Update project target location if provided
    if (targetLocation && targetLocation !== project.targetLocation) {
      await prisma.project.update({
        where: { id: projectId },
        data: { targetLocation },
      });
    }

    // Create keyword research record
    const keywordResearch = await keywordService.createKeywordResearch(
      projectId,
      seedKeywords.map((kw: string) => kw.trim()).filter((kw: string) => kw.length > 0)
    );

    // Add job to queue for background processing
    await addKeywordResearchJob(
      keywordResearch.id,
      projectId,
      keywordResearch.seedKeywords,
      keywordLimit || 50, // Default to 50 keywords per seed
      includePAA !== false // Default to true (include PAA questions)
    );

    console.log(`✅ Created keyword research job: ${keywordResearch.id}`);

    return res.status(201).json({
      success: true,
      data: {
        id: keywordResearch.id,
        status: keywordResearch.status,
        seedKeywords: keywordResearch.seedKeywords,
        createdAt: keywordResearch.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating keyword research:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create keyword research',
    });
  }
}

/**
 * Get keyword research by ID
 */
export async function getKeywordResearch(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const keywordResearch = await keywordService.getKeywordResearch(id);

    if (!keywordResearch) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Keyword research not found',
      });
    }

    // Verify user owns the project
    if (keywordResearch.project.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this keyword research',
      });
    }

    // Get job status if still processing
    let jobStatus = null;
    if (keywordResearch.status === 'processing' || keywordResearch.status === 'pending') {
      jobStatus = await getJobStatus(id);
    }

    return res.json({
      success: true,
      data: {
        ...keywordResearch,
        jobStatus,
      },
    });
  } catch (error) {
    console.error('Error fetching keyword research:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch keyword research',
    });
  }
}

/**
 * Get all keyword research for a project
 */
export async function getProjectKeywordResearch(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { projectId } = req.params;

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    const keywordResearch = await keywordService.getProjectKeywordResearch(projectId);

    return res.json({
      success: true,
      data: keywordResearch,
    });
  } catch (error) {
    console.error('Error fetching project keyword research:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch keyword research',
    });
  }
}

/**
 * Export keyword research to Google Sheets
 */
export async function exportToGoogleSheets(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const keywordResearch = await keywordService.getKeywordResearch(id);

    if (!keywordResearch) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Keyword research not found',
      });
    }

    // Verify user owns the project
    if (keywordResearch.project.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this keyword research',
      });
    }

    if (keywordResearch.status !== 'completed') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Keyword research is not completed yet',
      });
    }

    // Create Google Sheets export
    const spreadsheetUrl = await createGoogleSheet(keywordResearch);

    return res.json({
      success: true,
      data: {
        spreadsheetUrl,
      },
    });
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export to Google Sheets',
    });
  }
}

/**
 * Create a Google Sheet with keyword research data
 */
async function createGoogleSheet(keywordResearch: any): Promise<string> {
  // This is a placeholder - you'll need to implement OAuth2 flow for production
  // For now, we'll use service account authentication

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Create new spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `Keyword Research - ${keywordResearch.project.name} - ${new Date().toLocaleDateString()}`,
      },
      sheets: [
        {
          properties: {
            title: 'Clusters',
          },
        },
        {
          properties: {
            title: 'All Keywords',
          },
        },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;

  // Prepare data for Clusters sheet
  const clusterRows: any[][] = [
    ['Cluster Name', 'Type', 'Recommended URL', 'Search Intent', 'Keyword Count', 'Keywords'],
  ];

  for (const cluster of keywordResearch.clusters) {
    const keywords = cluster.keywords.map((k: any) => k.keyword).join(', ');
    clusterRows.push([
      cluster.name,
      cluster.type,
      cluster.recommendedUrl || '',
      cluster.searchIntent || '',
      cluster.keywordCount,
      keywords,
    ]);

    // Add sub-clusters
    if (cluster.subClusters) {
      for (const subCluster of cluster.subClusters) {
        const subKeywords = subCluster.keywords.map((k: any) => k.keyword).join(', ');
        clusterRows.push([
          `  └─ ${subCluster.name}`,
          subCluster.type,
          subCluster.recommendedUrl || '',
          subCluster.searchIntent || '',
          subCluster.keywordCount,
          subKeywords,
        ]);
      }
    }
  }

  // Prepare data for All Keywords sheet
  const keywordRows: any[][] = [
    [
      'Keyword',
      'Search Volume',
      'Difficulty',
      'CPC',
      'Competition',
      'Search Intent',
      'Cluster',
    ],
  ];

  for (const keyword of keywordResearch.keywords) {
    keywordRows.push([
      keyword.keyword,
      keyword.searchVolume || 0,
      keyword.difficulty || 0,
      keyword.cpc || 0,
      keyword.competition || '',
      keyword.searchIntent || '',
      keyword.cluster?.name || 'Unclustered',
    ]);
  }

  // Write data to sheets
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: 'Clusters!A1',
          values: clusterRows,
        },
        {
          range: 'All Keywords!A1',
          values: keywordRows,
        },
      ],
    },
  });

  // Format headers
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: 1,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
      ],
    },
  });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

/**
 * Delete a keyword research
 */
export async function deleteKeywordResearch(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const keywordResearch = await prisma.keywordResearch.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!keywordResearch) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Keyword research not found',
      });
    }

    // Verify user owns the project
    if (keywordResearch.project.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this keyword research',
      });
    }

    await prisma.keywordResearch.delete({
      where: { id },
    });

    console.log(`✅ Deleted keyword research: ${id}`);

    return res.json({
      success: true,
      message: 'Keyword research deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting keyword research:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete keyword research',
    });
  }
}
