import axios, { AxiosInstance } from 'axios';

/**
 * DataForSEO API Response Types
 */
interface MonthlySearch {
  month: number;
  year: number;
  search_volume: number;
}

interface KeywordInfo {
  monthly_searches?: MonthlySearch[];
}

interface DataForSEOKeywordResult {
  keyword: string;
  search_volume: number;
  competition: string; // 'LOW', 'MEDIUM', 'HIGH'
  competition_index?: number; // 0-100
  cpc: number;
  keyword_info?: KeywordInfo;
}

interface DataForSEOResponse {
  tasks: Array<{
    result: Array<{
      keywords: DataForSEOKeywordResult[];
    }>;
  }>;
}

/**
 * Our normalized keyword data structure
 */
export interface KeywordData {
  keyword: string;
  searchVolume: number;
  difficulty: number; // Normalized to 0-100
  cpc: number;
  competition: string;
  trend?: MonthlySearch[];
}

/**
 * People Also Ask question structure
 */
export interface PeopleAlsoAskQuestion {
  question: string;
  answer?: string;
  url?: string;
}

/**
 * DataForSEO Service
 * Handles all interactions with the DataForSEO Keywords Data API
 */
export class DataForSEOService {
  // Using DataForSEO Labs Keyword Ideas API (better coverage than Related Keywords)
  private apiUrl = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live';
  private username: string;
  private password: string;
  private axiosInstance: AxiosInstance;
  private readonly DEFAULT_LOCATION = 2702; // Singapore location code

  constructor() {
    this.username = process.env.DATAFORSEO_LOGIN || '';
    this.password = process.env.DATAFORSEO_PASSWORD || '';

    if (!this.username || !this.password) {
      throw new Error('DataForSEO credentials are not configured');
    }

    this.axiosInstance = axios.create({
      auth: {
        username: this.username,
        password: this.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch keyword data from DataForSEO API
   * @param keywords Array of seed keywords to analyze
   * @param location Target location (default: Singapore)
   * @param language Target language (default: English)
   * @param limit Number of related keywords to fetch per seed (default: 50, max: 100)
   * @returns Array of keyword data with search volume, CPC, difficulty, etc.
   */
  async getKeywordData(
    keywords: string[],
    location: string = 'Singapore',
    language: string = 'English',
    limit: number = 50
  ): Promise<KeywordData[]> {
    try {
      // Ensure limit is within bounds
      const keywordLimit = Math.min(Math.max(limit, 10), 100);

      console.log(`📊 Fetching keyword data for ${keywords.length} keywords (limit: ${keywordLimit}/seed)...`);

      // Process each keyword separately for better results
      const allKeywords: KeywordData[] = [];

      for (const keyword of keywords) {
        const requestBody = [
          {
            keywords: [keyword.trim()], // Keyword Ideas API takes array
            location_code: this.DEFAULT_LOCATION, // Singapore (2702)
            language_code: 'en', // English
            include_adult_keywords: false,
            limit: keywordLimit, // Configurable limit (10-100)
            filters: ["keyword_info.search_volume", ">", 0], // Only keywords with search volume
            order_by: ["keyword_info.search_volume,desc"], // Sort by search volume
          },
        ];

        const response = await this.axiosInstance.post<any>(
          this.apiUrl,
          requestBody
        );

        // Check if task succeeded
        const task = response.data?.tasks?.[0];
        if (task?.status_code !== 20000) {
          console.error(`Task failed for "${keyword}": ${task?.status_message}`);
          continue;
        }

        if (task?.result?.[0]?.items && Array.isArray(task.result[0].items)) {
          const items = task.result[0].items;

          items.forEach((item: any) => {
            // Keyword Ideas API has direct structure (no keyword_data nesting)
            allKeywords.push({
              keyword: item.keyword,
              searchVolume: item.keyword_info?.search_volume || 0,
              difficulty: item.keyword_properties?.keyword_difficulty || 50,
              cpc: item.keyword_info?.cpc || 0,
              competition: this.mapCompetition(item.keyword_info?.competition),
              trend: item.keyword_info?.monthly_searches,
            });
          });

          console.log(`  ✅ ${items.length} keywords for "${keyword}"`);
        }

        // Small delay between requests to avoid rate limiting
        if (keywords.indexOf(keyword) < keywords.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Remove duplicates and sort by search volume
      const uniqueKeywords = Array.from(
        new Map(allKeywords.map(kw => [kw.keyword.toLowerCase(), kw])).values()
      );
      uniqueKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

      console.log(`✅ Total unique keywords fetched: ${uniqueKeywords.length}`);

      if (uniqueKeywords.length === 0) {
        throw new Error('No keyword data returned from DataForSEO Labs API. This could mean: 1) No credits available, 2) DataForSEO Labs not enabled on your account, or 3) Keywords not found. Check Railway logs for details.');
      }

      return uniqueKeywords;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        console.error('❌ DataForSEO API Request Failed:');
        console.error('   Status:', error.response?.status);
        console.error('   Response:', JSON.stringify(errorData, null, 2));
        console.error('   Message:', error.message);

        // Check for common errors
        if (error.response?.status === 401) {
          throw new Error('DataForSEO authentication failed. Check your DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in Railway.');
        }

        if (error.response?.status === 402) {
          throw new Error('Insufficient DataForSEO credits. Please add credits to your DataForSEO account.');
        }

        throw new Error(
          `DataForSEO API Error (${error.response?.status || 'unknown'}): ${errorData?.status_message || errorData?.tasks?.[0]?.status_message || error.message}`
        );
      }

      console.error('❌ Unexpected error:', error);
      throw error;
    }
  }

  /**
   * Map competition value to string
   */
  private mapCompetition(competition?: number): string {
    if (competition === undefined || competition === null) return 'MEDIUM';
    if (competition < 0.33) return 'LOW';
    if (competition < 0.66) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Calculate keyword difficulty (0-100 scale)
   * Combines competition index and competition level
   */
  private calculateDifficulty(
    competitionIndex?: number,
    competition?: string
  ): number {
    // If we have competition_index, use it directly
    if (competitionIndex !== undefined && competitionIndex !== null) {
      return Math.round(competitionIndex);
    }

    // Otherwise, map competition level to a rough difficulty score
    switch (competition?.toUpperCase()) {
      case 'LOW':
        return 25;
      case 'MEDIUM':
        return 50;
      case 'HIGH':
        return 75;
      default:
        return 50; // Default to medium
    }
  }

  /**
   * Batch fetch keyword data (useful for large keyword lists)
   * Splits keywords into chunks to avoid API limits
   */
  async batchGetKeywordData(
    keywords: string[],
    location: string = 'Singapore',
    batchSize: number = 100
  ): Promise<KeywordData[]> {
    const batches: string[][] = [];

    // Split into batches
    for (let i = 0; i < keywords.length; i += batchSize) {
      batches.push(keywords.slice(i, i + batchSize));
    }

    console.log(`📦 Processing ${batches.length} batches of keywords...`);

    // Process batches sequentially to avoid rate limits
    const results: KeywordData[] = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length}...`);

      const batchResults = await this.getKeywordData(batch, location);
      results.push(...batchResults);

      // Add a small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get search volume for a single keyword
   * Useful for quick lookups
   */
  async getSearchVolume(keyword: string, location: string = 'Singapore'): Promise<number> {
    const results = await this.getKeywordData([keyword], location);
    return results[0]?.searchVolume || 0;
  }

  /**
   * Fetch People Also Ask questions for a keyword
   * @param keyword The keyword to search for
   * @returns Array of PAA questions
   */
  async getPeopleAlsoAsk(keyword: string): Promise<PeopleAlsoAskQuestion[]> {
    try {
      console.log(`❓ Fetching People Also Ask for: "${keyword}"...`);

      const requestBody = [
        {
          keyword: keyword.trim(),
          location_code: this.DEFAULT_LOCATION, // Singapore (2702)
          language_code: 'en',
          device: 'desktop',
          os: 'windows',
        },
      ];

      const response = await this.axiosInstance.post<any>(
        'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
        requestBody
      );

      const task = response.data?.tasks?.[0];

      if (task?.status_code !== 20000) {
        console.warn(`  ⚠️  PAA request failed: ${task?.status_message}`);
        return [];
      }

      const items = task?.result?.[0]?.items || [];
      const paaItems = items.filter((item: any) => item.type === 'people_also_ask');

      const questions: PeopleAlsoAskQuestion[] = [];

      paaItems.forEach((paaItem: any) => {
        paaItem.items?.forEach((item: any) => {
          questions.push({
            question: item.title || item.question,
            answer: item.answer,
            url: item.url,
          });
        });
      });

      console.log(`  ✅ Found ${questions.length} PAA questions for "${keyword}"`);

      return questions.slice(0, 10); // Limit to 10 most relevant questions
    } catch (error) {
      console.error(`  ❌ Error fetching PAA for "${keyword}":`, error);
      return []; // Return empty array on error, don't fail the entire request
    }
  }
}
