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

      // NEW PILLAR-FIRST APPROACH: Generate sub-clusters for each pillar
      console.log(`🏛️ Step 0: Generating sub-clusters for ${research.seedKeywords.length} pillars...`);
      const pillarToSubClusters: Map<string, string[]> = new Map();
      const allKeywordsToFetch: string[] = [...research.seedKeywords]; // Include pillars themselves

      for (const pillar of research.seedKeywords) {
        try {
          console.log(`  🌳 Generating sub-clusters for: "${pillar}"`);
          const subClusterResult = await this.claude.generateSubClusters(
            pillar,
            research.project.targetLocation
          );

          pillarToSubClusters.set(pillar, subClusterResult.subClusters);
          allKeywordsToFetch.push(...subClusterResult.subClusters);

          console.log(`    ✅ Generated ${subClusterResult.subClusters.length} sub-clusters for "${pillar}"`);
        } catch (error) {
          console.error(`    ❌ Failed to generate sub-clusters for "${pillar}":`, error);
          // Continue with other pillars even if one fails
          pillarToSubClusters.set(pillar, []);
        }
      }

      console.log(`  📊 Total keywords to fetch: ${allKeywordsToFetch.length} (${research.seedKeywords.length} pillars + ${allKeywordsToFetch.length - research.seedKeywords.length} sub-clusters)`);

      // Step 1: Fetch keyword data from DataForSEO for ALL keywords (pillars + sub-clusters)
      console.log(`📊 Step 1: Fetching keyword data from DataForSEO...`);
      const keywordData = await this.dataForSEO.getKeywordData(
        allKeywordsToFetch,
        research.project.targetLocation,
        'English',
        keywordLimit
      );

      if (keywordData.length === 0) {
        throw new Error('No keyword data received from DataForSEO');
      }

      console.log(`✅ Received ${keywordData.length} keywords`);

      // Step 2: Fetch People Also Ask questions (if enabled) - only for PILLARS
      let paaQuestions: Map<string, any[]> = new Map();
      if (includePAA) {
        console.log('❓ Step 2: Fetching People Also Ask questions (max 5 per pillar)...');
        for (const pillar of research.seedKeywords) {
          const questions = await this.dataForSEO.getPeopleAlsoAsk(pillar);
          if (questions.length > 0) {
            // Limit to 5 questions per pillar
            const limitedQuestions = questions.slice(0, 5);
            paaQuestions.set(pillar.toLowerCase(), limitedQuestions);
            console.log(`  ✅ Found ${limitedQuestions.length} PAA for "${pillar}"`);
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

      // Step 4: Create pillar-based clusters with sub-cluster hierarchy
      console.log('📋 Step 4: Organizing keywords into pillar → sub-cluster hierarchy...');
      const clusteringResult = this.createPillarBasedClusters(
        research.seedKeywords,
        pillarToSubClusters,
        keywordData
      );

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
   * Create seed-based clusters (one cluster per seed, max 10 keywords each)
   * This replaces AI clustering with a simpler, more predictable approach
   */
  private createSeedBasedClusters(
    seedKeywords: string[],
    allKeywords: KeywordData[]
  ): ClusteringResponse {
    console.log(`  📊 Creating clusters for ${seedKeywords.length} seeds...`);

    const clusters: any[] = [];

    for (const seed of seedKeywords) {
      const seedLower = seed.toLowerCase();
      const seedWords = seedLower.split(' ');

      // Find keywords related to this seed
      const relatedKeywords = allKeywords
        .filter(kw => {
          const kwLower = kw.keyword.toLowerCase();

          // Keyword must contain at least one word from the seed
          return seedWords.some(word => kwLower.includes(word));
        })
        // Sort by search volume (highest first)
        .sort((a, b) => b.searchVolume - a.searchVolume)
        // Take top 10 only
        .slice(0, 10);

      if (relatedKeywords.length > 0) {
        // Determine dominant intent
        const intents = relatedKeywords
          .map(kw => {
            const kwLower = kw.keyword.toLowerCase();
            if (kwLower.match(/price|cost|fee|pricing|rate/)) return 'transactional';
            if (kwLower.match(/what|how|why|guide|tips/)) return 'informational';
            if (kwLower.match(/best|top|vs|compare|review/)) return 'commercial';
            return 'navigational';
          });

        const intentCounts = intents.reduce((acc, intent) => {
          acc[intent] = (acc[intent] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const dominantIntent = Object.entries(intentCounts)
          .sort(([,a], [,b]) => b - a)[0][0];

        // Create cluster
        clusters.push({
          name: seed,
          type: 'main',
          recommendedUrl: `/${seed.toLowerCase().replace(/\s+/g, '-')}`,
          searchIntent: dominantIntent,
          keywords: relatedKeywords.map(kw => kw.keyword),
          subClusters: [], // No sub-clusters for now
        });

        console.log(`    ✓ ${seed}: ${relatedKeywords.length} keywords (${dominantIntent})`);
      }
    }

    return {
      clusters,
      cannibalizationWarnings: [],
    };
  }

  /**
   * Create pillar-based clusters with sub-cluster hierarchy
   * NEW PILLAR-FIRST APPROACH
   *
   * Structure:
   * Pillar (main cluster) →
   *   Sub-cluster 1 (child cluster)
   *   Sub-cluster 2 (child cluster)
   *   ...
   */
  private createPillarBasedClusters(
    pillars: string[],
    pillarToSubClusters: Map<string, string[]>,
    allKeywords: KeywordData[]
  ): ClusteringResponse {
    console.log(`  🏛️ Creating pillar-based clusters for ${pillars.length} pillars...`);

    const clusters: any[] = [];
    const keywordMap = new Map(allKeywords.map(kw => [kw.keyword.toLowerCase(), kw]));

    for (const pillar of pillars) {
      const subClusterKeywords = pillarToSubClusters.get(pillar) || [];

      // Get data for the pillar itself
      const pillarData = keywordMap.get(pillar.toLowerCase());

      // Get data for all sub-clusters
      const subClustersWithData: any[] = [];
      const allRelatedKeywords: KeywordData[] = [];

      // Add pillar itself as first keyword if it has data
      if (pillarData) {
        allRelatedKeywords.push(pillarData);
      }

      // Process each sub-cluster
      for (const subCluster of subClusterKeywords) {
        const subClusterData = keywordMap.get(subCluster.toLowerCase());

        if (subClusterData) {
          allRelatedKeywords.push(subClusterData);

          // Determine intent for this sub-cluster
          const kwLower = subCluster.toLowerCase();
          let intent = 'navigational';
          if (kwLower.match(/price|cost|fee|pricing|rate|buy|hire|service/)) intent = 'transactional';
          else if (kwLower.match(/what|how|why|guide|tips|learn/)) intent = 'informational';
          else if (kwLower.match(/best|top|vs|compare|review/)) intent = 'commercial';

          subClustersWithData.push({
            name: subCluster,
            type: 'sub',
            recommendedUrl: `/${pillar.toLowerCase().replace(/\s+/g, '-')}/${subCluster.toLowerCase().replace(/\s+/g, '-')}`,
            searchIntent: intent,
            keywords: [subCluster],
            subClusters: [],
          });
        }
      }

      // Determine dominant intent for the pillar based on all related keywords
      const intents = allRelatedKeywords.map(kw => {
        const kwLower = kw.keyword.toLowerCase();
        if (kwLower.match(/price|cost|fee|pricing|rate|buy|hire|service/)) return 'transactional';
        if (kwLower.match(/what|how|why|guide|tips|learn/)) return 'informational';
        if (kwLower.match(/best|top|vs|compare|review/)) return 'commercial';
        return 'navigational';
      });

      const intentCounts = intents.reduce((acc, intent) => {
        acc[intent] = (acc[intent] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dominantIntent = Object.entries(intentCounts).length > 0
        ? Object.entries(intentCounts).sort(([,a], [,b]) => b - a)[0][0]
        : 'navigational';

      // Create the main pillar cluster
      clusters.push({
        name: pillar,
        type: 'main',
        recommendedUrl: `/${pillar.toLowerCase().replace(/\s+/g, '-')}`,
        searchIntent: dominantIntent,
        keywords: allRelatedKeywords.map(kw => kw.keyword), // All keywords (pillar + sub-clusters)
        subClusters: subClustersWithData, // Nested sub-clusters
      });

      console.log(`    ✓ ${pillar}: ${allRelatedKeywords.length} keywords (${dominantIntent}), ${subClustersWithData.length} sub-clusters`);
    }

    return {
      clusters,
      cannibalizationWarnings: [],
    };
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
