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
 * DataForSEO Service
 * Handles all interactions with the DataForSEO Keywords Data API
 */
export class DataForSEOService {
  // Using SERP API for organic keyword research
  private apiUrl = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live';
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
   * @returns Array of keyword data with search volume, CPC, difficulty, etc.
   */
  async getKeywordData(
    keywords: string[],
    location: string = 'Singapore',
    language: string = 'English'
  ): Promise<KeywordData[]> {
    try {
      console.log(`📊 Fetching keyword data for ${keywords.length} keywords from DataForSEO Labs API (Singapore only)...`);

      // Process each keyword separately for better results
      const allKeywords: KeywordData[] = [];

      for (const keyword of keywords) {
        const requestBody = [
          {
            keyword: keyword.trim(),
            location_code: this.DEFAULT_LOCATION, // Singapore (2702)
            language_code: 'en', // English
            include_seed_keyword: true,
            include_serp_info: true,
            limit: 30, // Get top 30 related keywords per seed
          },
        ];

        console.log(`  Fetching suggestions for: "${keyword}"`);

        const response = await this.axiosInstance.post<any>(
          this.apiUrl,
          requestBody
        );

        console.log(`  Response status: ${response.data?.tasks?.[0]?.status_message || 'unknown'}`);

        if (response.data?.tasks?.[0]?.result?.[0]?.items) {
          const items = response.data.tasks[0].result[0].items;

          items.forEach((item: any) => {
            allKeywords.push({
              keyword: item.keyword,
              searchVolume: item.keyword_info?.search_volume || 0,
              difficulty: item.keyword_properties?.keyword_difficulty || 50,
              cpc: item.keyword_info?.cpc || 0,
              competition: this.mapCompetition(item.keyword_info?.competition),
              trend: item.keyword_info?.monthly_searches,
            });
          });

          console.log(`  ✅ Found ${items.length} keywords for "${keyword}"`);
        } else {
          console.warn(`  ⚠️  No results for "${keyword}"`);
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
        throw new Error('No keyword data returned from DataForSEO API. Please check your credits and try again.');
      }

      return uniqueKeywords;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        console.error('❌ DataForSEO API Error:', errorData || error.message);

        throw new Error(
          `DataForSEO API Error: ${errorData?.status_message || error.message}`
        );
      }
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
}
