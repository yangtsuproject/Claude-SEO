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

    return `You are an expert SEO strategist. Analyze the following keywords and organize them into a PILLAR/CLUSTER content structure.

KEYWORDS TO ANALYZE:
${keywordList}

PILLAR/CLUSTER STRATEGY:
Create ONE main pillar page that serves as the central hub, with 5-10 cluster pages (sub-clusters) that link back to it.

1. **PILLAR PAGE (Main Cluster)**:
   - Choose the keyword with HIGHEST search volume + MODERATE difficulty (not too competitive)
   - Should be a broad topic that encompasses all other keywords
   - This becomes your cornerstone content
   - Example: "Colorectal Screening Singapore" (pillar) with sub-topics about colonoscopy, costs, procedures

2. **CLUSTER PAGES (Sub-Clusters)**:
   - Create 5-10 focused sub-clusters under the pillar
   - Each cluster targets a specific aspect or intent
   - Group keywords by:
     * Search intent (informational, transactional, commercial)
     * Topic specificity (price, procedure, comparison, etc.)
     * User journey stage (awareness, consideration, decision)
   - Each cluster should have 3-8 keywords maximum
   - Link structure: All clusters link TO pillar, pillar links TO all clusters

3. **Search Intent Classification**:
   - **Informational**: User wants to learn (what, how, why questions)
   - **Transactional**: User wants to buy/book (price, service, package)
   - **Commercial**: User is comparing options (best, top, vs, comparison)
   - **Navigational**: User seeks specific provider/location

4. **URL Structure**:
   - Pillar: /main-topic (e.g., /colorectal-screening)
   - Clusters: /main-topic/sub-topic (e.g., /colorectal-screening/colonoscopy-cost)
   - Use lowercase, hyphens for spaces, no special characters

5. **Keyword Distribution**:
   - Avoid keyword cannibalization: similar keywords go in same cluster
   - Distribute by intent: don't mix informational + transactional
   - Balance cluster sizes: 3-8 keywords each

RESPONSE FORMAT:
Return ONLY valid JSON (no markdown, no explanations):

{
  "clusters": [
    {
      "name": "Pillar Page Topic",
      "type": "main",
      "recommendedUrl": "/pillar-slug",
      "searchIntent": "informational|transactional|commercial",
      "keywords": ["main keyword", "broad keyword 2"],
      "subClusters": [
        {
          "name": "Cluster 1: Specific Topic",
          "type": "sub",
          "recommendedUrl": "/pillar-slug/cluster1-slug",
          "searchIntent": "informational",
          "keywords": ["keyword1", "keyword2", "keyword3"]
        },
        {
          "name": "Cluster 2: Another Topic",
          "type": "sub",
          "recommendedUrl": "/pillar-slug/cluster2-slug",
          "searchIntent": "transactional",
          "keywords": ["keyword4", "keyword5"]
        }
      ]
    }
  ],
  "cannibalizationWarnings": [
    {
      "keywords": ["similar-kw-1", "similar-kw-2"],
      "reason": "These have identical intent and should target the same page"
    }
  ]
}

CRITICAL REQUIREMENTS:
- Create ONLY ONE main cluster (the pillar)
- Create 5-10 sub-clusters under it
- Pillar should have the highest volume keyword(s) with moderate difficulty
- All keywords must be included in the output
- Keep sub-clusters focused and distinct
- Return ONLY JSON, no extra text`;
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
   * Intelligently extract seed keywords from user's description
   * @param description Natural language description of what user wants to rank for
   * @param location Target location for context (e.g., "Singapore")
   * @returns Array of recommended seed keywords
   */
  async extractSeedKeywords(
    description: string,
    location: string = 'Singapore'
  ): Promise<{ seedKeywords: string[]; reasoning: string }> {
    try {
      console.log(`🤖 Extracting seed keywords from description...`);

      const prompt = `You are an expert SEO strategist. A user wants to do keyword research and has described what they want to rank for.

USER'S DESCRIPTION:
"${description}"

TARGET LOCATION: ${location}

YOUR TASK:
Analyze the description and extract 3-5 SEED KEYWORDS that will be used for keyword research. These seed keywords should:

1. **Be broad enough** to find related concepts (e.g., "digital marketing" not "digital marketing consultant services in singapore")
2. **Capture the core topics** mentioned in the description
3. **Be relevant to ${location}** market if location-specific services are mentioned
4. **Cover different aspects** of the topic (don't just use synonyms)
5. **Use professional terminology** that people actually search for

EXAMPLES:
- Description: "I run a clinic offering colonoscopy and other colorectal screening services"
  Seeds: ["colonoscopy", "colorectal screening", "colon cancer screening"]

- Description: "We provide digital marketing services including SEO, SEM, and social media"
  Seeds: ["digital marketing", "SEO services", "SEM agency", "social media marketing"]

- Description: "I'm a wedding photographer in Singapore"
  Seeds: ["wedding photographer", "wedding photography", "bridal photography"]

RESPONSE FORMAT:
Return ONLY valid JSON (no markdown, no explanations):
{
  "seedKeywords": ["keyword1", "keyword2", "keyword3"],
  "reasoning": "Brief explanation of why these seeds were chosen"
}

IMPORTANT:
- Return 3-5 seed keywords maximum
- Each seed should be 1-3 words
- Focus on broad concepts, not long-tail variations
- Consider what competitors might target
- Think about user search intent`;

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      if (!responseText) {
        throw new Error('Empty response from Claude API');
      }

      // Extract JSON
      let jsonText = responseText.trim();
      const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      }

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Claude response');
      }

      const result = JSON.parse(jsonMatch[0]);

      if (!result.seedKeywords || !Array.isArray(result.seedKeywords)) {
        throw new Error('Invalid response: missing seedKeywords array');
      }

      console.log(`✅ Extracted ${result.seedKeywords.length} seed keywords`);
      console.log(`   Seeds: ${result.seedKeywords.join(', ')}`);
      console.log(`   Reasoning: ${result.reasoning}`);

      return result;
    } catch (error) {
      console.error('Error extracting seed keywords:', error);
      throw new Error(`Failed to extract seed keywords: ${error}`);
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
