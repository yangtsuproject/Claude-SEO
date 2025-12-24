import { prisma } from '../utils/prisma';
import { DataForSEOService, KeywordData, CompetitorKeyword } from './dataforseo.service';
import { ClaudeService, KeywordWithMetrics, ClusteringResponse } from './claude.service';

/**
 * Keyword Service
 * Orchestrates the entire keyword research process
 */
export class KeywordService {
  private dataForSEO: DataForSEOService;
  private claude: ClaudeService;

  constructor() {
    this.dataForSEO = new DataForSEOService();
    this.claude = new ClaudeService();
  }

  /**
   * Process a complete keyword research job
   * 1. Fetch keyword data from DataForSEO
   * 2. Optionally fetch People Also Ask questions
   * 3. Analyze competitive gaps (optional)
   * 4. Cluster keywords with Claude AI
   * 5. Save everything to database
   */
  async processKeywordResearch(
    keywordResearchId: string,
    keywordLimit: number = 50,
    includePAA: boolean = true,
    includeCompetitorAnalysis: boolean = true
  ): Promise<void> {
    try {
      console.log(`🚀 Starting keyword research job: ${keywordResearchId}`);

      // Get the keyword research record
      const research = await prisma.keywordResearch.findUnique({
        where: { id: keywordResearchId },
        include: { project: true },
      });

      if (!research) {
        throw new Error(`Keyword research ${keywordResearchId} not found`);
      }

      // Update status to processing
      await prisma.keywordResearch.update({
        where: { id: keywordResearchId },
        data: { status: 'processing' },
      });

      // Step 1: Fetch keyword data from DataForSEO
      console.log(`📊 Step 1: Fetching keyword data (limit: ${keywordLimit} per seed)...`);
      const keywordData = await this.dataForSEO.getKeywordData(
        research.seedKeywords,
        research.project.targetLocation,
        'English',
        keywordLimit
      );

      if (keywordData.length === 0) {
        throw new Error('No keyword data received from DataForSEO');
      }

      console.log(`✅ Received ${keywordData.length} keywords`);

      // Step 2: Fetch People Also Ask questions (if enabled)
      let paaQuestions: Map<string, any[]> = new Map();
      if (includePAA) {
        console.log('❓ Step 2: Fetching People Also Ask questions...');
        for (const seedKeyword of research.seedKeywords) {
          const questions = await this.dataForSEO.getPeopleAlsoAsk(seedKeyword);
          if (questions.length > 0) {
            paaQuestions.set(seedKeyword.toLowerCase(), questions);
            console.log(`  ✅ Found ${questions.length} PAA for "${seedKeyword}"`);
          }
        }
      }

      // Step 3: Analyze competitive gaps (if enabled)
      let competitorKeywords: CompetitorKeyword[] = [];
      if (includeCompetitorAnalysis) {
        console.log('🔬 Step 3: Analyzing competitive gaps...');
        const domainRating = research.project.domainRating || 10;
        const currentKeywordsList = keywordData.map((kw) => kw.keyword);

        competitorKeywords = await this.dataForSEO.analyzeCompetitiveGaps(
          research.seedKeywords,
          currentKeywordsList,
          domainRating
        );

        console.log(`  ✅ Found ${competitorKeywords.length} competitor opportunities`);

        // Merge competitor keywords into main keyword data for clustering
        if (competitorKeywords.length > 0) {
          const competitorKeywordData: KeywordData[] = competitorKeywords.map((ck) => ({
            keyword: ck.keyword,
            searchVolume: ck.searchVolume,
            difficulty: ck.difficulty,
            cpc: ck.cpc,
            competition: ck.competition,
            trend: ck.trend,
          }));
          keywordData.push(...competitorKeywordData);
          console.log(`  📊 Total keywords (including competitors): ${keywordData.length}`);
        }
      }

      // Step 4: Cluster keywords with Claude AI
      console.log('🤖 Step 4: Clustering keywords with AI...');
      const keywordsForClustering: KeywordWithMetrics[] = keywordData.map((kw) => ({
        keyword: kw.keyword,
        searchVolume: kw.searchVolume,
        difficulty: kw.difficulty,
        cpc: kw.cpc,
        competition: kw.competition,
      }));

      const clusteringResult = await this.claude.clusterKeywords(keywordsForClustering);

      // Step 5: Save keywords and clusters to database
      console.log('💾 Step 5: Saving to database...');
      await this.saveKeywordsAndClusters(
        keywordResearchId,
        keywordData,
        clusteringResult,
        paaQuestions,
        competitorKeywords
      );

      // Update status to completed
      await prisma.keywordResearch.update({
        where: { id: keywordResearchId },
        data: { status: 'completed', updatedAt: new Date() },
      });

      console.log(`✅ Keyword research completed: ${keywordResearchId}`);
    } catch (error) {
      console.error(`❌ Error processing keyword research ${keywordResearchId}:`, error);

      // Update status to failed
      await prisma.keywordResearch.update({
        where: { id: keywordResearchId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Save keywords and clusters to database
   */
  private async saveKeywordsAndClusters(
    keywordResearchId: string,
    keywordData: KeywordData[],
    clusteringResult: ClusteringResponse,
    paaQuestions?: Map<string, any[]>,
    competitorKeywords?: CompetitorKeyword[]
  ): Promise<void> {
    // Create a map of keyword -> keyword data for quick lookup
    const keywordMap = new Map(keywordData.map((kw) => [kw.keyword.toLowerCase(), kw]));

    // Create a set of competitor keywords for quick lookup
    const competitorKeywordSet = new Set(
      competitorKeywords?.map((ck) => ck.keyword.toLowerCase()) || []
    );

    // Create a map of competitor keyword -> gap level
    const competitorGapMap = new Map(
      competitorKeywords?.map((ck) => [ck.keyword.toLowerCase(), ck.gap]) || []
    );

    // Process each main cluster
    for (const mainCluster of clusteringResult.clusters) {
      // Find relevant PAA questions for this cluster
      let relevantPAA: any[] = [];
      if (paaQuestions && paaQuestions.size > 0) {
        // Match PAA by checking if cluster name or keywords match seed keywords
        for (const [seedKeyword, questions] of paaQuestions.entries()) {
          const clusterNameLower = mainCluster.name.toLowerCase();
          const hasMatchingKeyword = mainCluster.keywords.some(
            kw => kw.toLowerCase().includes(seedKeyword) || seedKeyword.includes(kw.toLowerCase())
          );

          if (clusterNameLower.includes(seedKeyword) || hasMatchingKeyword) {
            relevantPAA.push(...questions);
          }
        }
      }

      // Create main cluster
      const cluster = await prisma.cluster.create({
        data: {
          name: mainCluster.name,
          type: 'main',
          recommendedUrl: mainCluster.recommendedUrl,
          searchIntent: mainCluster.searchIntent,
          keywordResearchId,
          keywordCount: mainCluster.keywords.length,
          peopleAlsoAsk: relevantPAA.length > 0 ? relevantPAA : undefined,
        },
      });

      // Create keywords for main cluster
      for (const keywordText of mainCluster.keywords) {
        const kwData = keywordMap.get(keywordText.toLowerCase());
        if (kwData) {
          await prisma.keyword.create({
            data: {
              keyword: kwData.keyword,
              searchVolume: kwData.searchVolume,
              difficulty: kwData.difficulty,
              cpc: kwData.cpc,
              competition: kwData.competition,
              trend: kwData.trend as any,
              searchIntent: mainCluster.searchIntent,
              keywordResearchId,
              clusterId: cluster.id,
            },
          });
        }
      }

      // Process sub-clusters if they exist
      if (mainCluster.subClusters && mainCluster.subClusters.length > 0) {
        for (const subCluster of mainCluster.subClusters) {
          // Create sub-cluster
          const subClusterRecord = await prisma.cluster.create({
            data: {
              name: subCluster.name,
              type: 'sub',
              recommendedUrl: subCluster.recommendedUrl,
              searchIntent: subCluster.searchIntent,
              keywordResearchId,
              parentClusterId: cluster.id,
              keywordCount: subCluster.keywords.length,
            },
          });

          // Create keywords for sub-cluster
          for (const keywordText of subCluster.keywords) {
            const kwData = keywordMap.get(keywordText.toLowerCase());
            if (kwData) {
              await prisma.keyword.create({
                data: {
                  keyword: kwData.keyword,
                  searchVolume: kwData.searchVolume,
                  difficulty: kwData.difficulty,
                  cpc: kwData.cpc,
                  competition: kwData.competition,
                  trend: kwData.trend as any,
                  searchIntent: subCluster.searchIntent,
                  keywordResearchId,
                  clusterId: subClusterRecord.id,
                },
              });
            }
          }

          // Update parent cluster keyword count to include sub-cluster keywords
          await prisma.cluster.update({
            where: { id: cluster.id },
            data: {
              keywordCount: {
                increment: subCluster.keywords.length,
              },
            },
          });
        }
      }
    }

    // Create a special cluster for competitor opportunities if we have any
    if (competitorKeywords && competitorKeywords.length > 0) {
      console.log(`📊 Creating Competitor Opportunities cluster with ${competitorKeywords.length} keywords...`);

      // Group by gap level
      const highOpportunities = competitorKeywords.filter((k) => k.gap === 'high');
      const mediumOpportunities = competitorKeywords.filter((k) => k.gap === 'medium');
      const lowOpportunities = competitorKeywords.filter((k) => k.gap === 'low');

      // Create main competitor cluster
      const compCluster = await prisma.cluster.create({
        data: {
          name: '🏆 Competitor Opportunities',
          type: 'competitor',
          recommendedUrl: '/competitor-opportunities',
          searchIntent: 'competitive_gap',
          keywordResearchId,
          keywordCount: competitorKeywords.length,
        },
      });

      // Create sub-clusters for each opportunity level
      if (highOpportunities.length > 0) {
        const highCluster = await prisma.cluster.create({
          data: {
            name: '✅ High Opportunity (Easy to Rank)',
            type: 'sub',
            recommendedUrl: '/competitor-opportunities/high',
            searchIntent: 'competitor_high',
            keywordResearchId,
            parentClusterId: compCluster.id,
            keywordCount: highOpportunities.length,
          },
        });

        for (const compKw of highOpportunities) {
          await prisma.keyword.create({
            data: {
              keyword: compKw.keyword,
              searchVolume: compKw.searchVolume,
              difficulty: compKw.difficulty,
              cpc: compKw.cpc,
              competition: compKw.competition,
              trend: compKw.trend as any,
              searchIntent: 'competitor_high',
              keywordResearchId,
              clusterId: highCluster.id,
            },
          });
        }
      }

      if (mediumOpportunities.length > 0) {
        const mediumCluster = await prisma.cluster.create({
          data: {
            name: '⚠️ Medium Opportunity (Challenging)',
            type: 'sub',
            recommendedUrl: '/competitor-opportunities/medium',
            searchIntent: 'competitor_medium',
            keywordResearchId,
            parentClusterId: compCluster.id,
            keywordCount: mediumOpportunities.length,
          },
        });

        for (const compKw of mediumOpportunities) {
          await prisma.keyword.create({
            data: {
              keyword: compKw.keyword,
              searchVolume: compKw.searchVolume,
              difficulty: compKw.difficulty,
              cpc: compKw.cpc,
              competition: compKw.competition,
              trend: compKw.trend as any,
              searchIntent: 'competitor_medium',
              keywordResearchId,
              clusterId: mediumCluster.id,
            },
          });
        }
      }

      if (lowOpportunities.length > 0) {
        const lowCluster = await prisma.cluster.create({
          data: {
            name: '❌ Low Opportunity (Difficult)',
            type: 'sub',
            recommendedUrl: '/competitor-opportunities/low',
            searchIntent: 'competitor_low',
            keywordResearchId,
            parentClusterId: compCluster.id,
            keywordCount: lowOpportunities.length,
          },
        });

        for (const compKw of lowOpportunities) {
          await prisma.keyword.create({
            data: {
              keyword: compKw.keyword,
              searchVolume: compKw.searchVolume,
              difficulty: compKw.difficulty,
              cpc: compKw.cpc,
              competition: compKw.competition,
              trend: compKw.trend as any,
              searchIntent: 'competitor_low',
              keywordResearchId,
              clusterId: lowCluster.id,
            },
          });
        }
      }

      console.log(`  ✅ Saved competitor opportunities: ${highOpportunities.length} high, ${mediumOpportunities.length} medium, ${lowOpportunities.length} low`);
    }

    const totalClusters = clusteringResult.clusters.length + (competitorKeywords && competitorKeywords.length > 0 ? 1 : 0);
    console.log(`✅ Saved ${keywordData.length} keywords in ${totalClusters} main clusters`);
  }

  /**
   * Get keyword research results with all related data
   */
  async getKeywordResearch(keywordResearchId: string) {
    return await prisma.keywordResearch.findUnique({
      where: { id: keywordResearchId },
      include: {
        keywords: {
          include: {
            cluster: true,
          },
          orderBy: {
            searchVolume: 'desc',
          },
        },
        clusters: {
          include: {
            keywords: {
              orderBy: {
                searchVolume: 'desc',
              },
            },
            subClusters: {
              include: {
                keywords: {
                  orderBy: {
                    searchVolume: 'desc',
                  },
                },
              },
            },
          },
          where: {
            type: 'main', // Only get main clusters, sub-clusters are nested
          },
          orderBy: {
            keywordCount: 'desc',
          },
        },
        project: true,
        _count: {
          select: {
            keywords: true,
            clusters: true,
          },
        },
      },
    });
  }

  /**
   * Create a new keyword research job
   */
  async createKeywordResearch(projectId: string, seedKeywords: string[]) {
    return await prisma.keywordResearch.create({
      data: {
        projectId,
        seedKeywords,
        status: 'pending',
      },
    });
  }

  /**
   * Get all keyword research for a project
   */
  async getProjectKeywordResearch(projectId: string) {
    return await prisma.keywordResearch.findMany({
      where: { projectId },
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
    });
  }
}
