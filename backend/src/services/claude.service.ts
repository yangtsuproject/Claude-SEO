import Anthropic from '@anthropic-ai/sdk';

/**
 * Keyword with SEO metrics
 */
export interface KeywordWithMetrics {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc?: number;
  competition?: string;
}

/**
 * Sub-cluster structure
 */
export interface SubCluster {
  name: string;
  type: 'sub';
  recommendedUrl: string;
  searchIntent: string;
  keywords: string[];
}

/**
 * Main cluster structure
 */
export interface MainCluster {
  name: string;
  type: 'main';
  recommendedUrl: string;
  searchIntent: string;
  keywords: string[];
  subClusters?: SubCluster[];
}

/**
 * Clustering response from Claude
 */
export interface ClusteringResponse {
  clusters: MainCluster[];
  cannibalizationWarnings?: Array<{
    keywords: string[];
    reason: string;
  }>;
}

/**
 * Claude AI Service
 * Handles keyword clustering using Anthropic's Claude API
 */
export class ClaudeService {
  private client: Anthropic;
  private model: string = 'claude-sonnet-4-20250514';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  /**
   * Cluster keywords into logical groups using Claude AI
   * @param keywords Array of keywords with their metrics
   * @returns Clustered keywords with recommended URL structure
   */
  async clusterKeywords(keywords: KeywordWithMetrics[]): Promise<ClusteringResponse> {
    try {
      console.log(`🤖 Clustering ${keywords.length} keywords with Claude AI...`);

      const prompt = this.buildClusteringPrompt(keywords);

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 8000,
        temperature: 0.3, // Lower temperature for more consistent, logical grouping
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract text content from response
      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      if (!responseText) {
        throw new Error('Empty response from Claude API');
      }

      // Parse JSON from response
      const clusteringResult = this.extractJsonFromResponse(responseText);

      console.log(
        `✅ Successfully clustered into ${clusteringResult.clusters.length} main clusters`
      );

      return clusteringResult;
    } catch (error) {
      console.error('Claude API Error:', error);
      if (error instanceof Error) {
        throw new Error(`Claude API Error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build the clustering prompt for Claude
   */
  private buildClusteringPrompt(keywords: KeywordWithMetrics[]): string {
    // Sort keywords by search volume (descending) for better context
    const sortedKeywords = [...keywords].sort((a, b) => b.searchVolume - a.searchVolume);

    const keywordList = sortedKeywords
      .map(
        (k) =>
          `- "${k.keyword}" | Volume: ${k.searchVolume} | Difficulty: ${k.difficulty} | CPC: $${k.cpc?.toFixed(2) || '0.00'}`
      )
      .join('\n');

    return `You are an expert SEO strategist. Analyze the following keywords and organize them into logical, SEO-optimized clusters.

KEYWORDS TO ANALYZE:
${keywordList}

CLUSTERING RULES:
1. **Cluster Size**: Each cluster should contain 5-8 keywords maximum to avoid keyword cannibalization
2. **Grouping Logic**: Group keywords by:
   - Search intent (informational, transactional, navigational, commercial)
   - Topic similarity and semantic relevance
   - User journey stage (awareness, consideration, decision)
3. **Hierarchy**: Create main clusters and sub-clusters where appropriate
   - Main clusters represent broad topics (e.g., "Colorectal Screening")
   - Sub-clusters represent specific aspects (e.g., "Colonoscopy Procedure")
4. **URL Structure**: Recommend clean, SEO-friendly URL slugs
   - Main cluster: /main-topic
   - Sub-cluster: /main-topic/sub-topic
   - Use lowercase, hyphens for spaces, avoid special characters
5. **Search Intent Classification**:
   - **Informational**: User wants to learn (e.g., "what is colonoscopy")
   - **Transactional**: User wants to buy/book (e.g., "book colonoscopy singapore")
   - **Navigational**: User wants to find a specific page (e.g., "raffles hospital colonoscopy")
   - **Commercial**: User is researching before buying (e.g., "best colonoscopy clinic singapore")
6. **Cannibalization Detection**: Flag any keywords that are too similar and might compete with each other

RESPONSE FORMAT:
Return ONLY valid JSON (no markdown, no explanations) in this exact structure:

{
  "clusters": [
    {
      "name": "Main Cluster Name",
      "type": "main",
      "recommendedUrl": "/url-slug",
      "searchIntent": "informational|transactional|navigational|commercial",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "subClusters": [
        {
          "name": "Sub Cluster Name",
          "type": "sub",
          "recommendedUrl": "/main-slug/sub-slug",
          "searchIntent": "informational|transactional|navigational|commercial",
          "keywords": ["keyword4", "keyword5"]
        }
      ]
    }
  ],
  "cannibalizationWarnings": [
    {
      "keywords": ["very-similar-keyword-1", "very-similar-keyword-2"],
      "reason": "These keywords have identical search intent and should likely target the same page"
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, no additional text
- Ensure all keywords from the input are included in the clusters
- Prioritize high-volume, low-difficulty keywords for main clusters
- Keep clusters focused and semantically coherent`;
  }

  /**
   * Extract and parse JSON from Claude's response
   * Handles cases where Claude might wrap JSON in markdown code blocks
   */
  private extractJsonFromResponse(responseText: string): ClusteringResponse {
    // Try to find JSON in the response (might be wrapped in code blocks)
    let jsonText = responseText.trim();

    // Remove markdown code blocks if present
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    // Find JSON object boundaries
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in Claude response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.clusters || !Array.isArray(parsed.clusters)) {
        throw new Error('Invalid clustering response: missing clusters array');
      }

      return parsed as ClusteringResponse;
    } catch (error) {
      console.error('Failed to parse Claude response:', jsonMatch[0]);
      throw new Error(`Failed to parse JSON from Claude: ${error}`);
    }
  }

  /**
   * Detect keyword cannibalization
   * Identifies keywords that are too similar and might compete
   */
  async detectCannibalization(
    keywords: KeywordWithMetrics[]
  ): Promise<Array<{ keywords: string[]; similarity: number }>> {
    try {
      const prompt = `Analyze these keywords and identify groups that are too similar and might cause keyword cannibalization in SEO:

KEYWORDS:
${keywords.map((k) => `- ${k.keyword}`).join('\n')}

Return ONLY valid JSON with groups of similar keywords:
{
  "groups": [
    {
      "keywords": ["keyword1", "keyword2"],
      "similarity": 95
    }
  ]
}`;

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const result = JSON.parse(jsonMatch[0]);
      return result.groups || [];
    } catch (error) {
      console.error('Error detecting cannibalization:', error);
      return [];
    }
  }
}
