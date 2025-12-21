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
  private apiUrl = 'https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live';
  private username: string;
  private password: string;
  private axiosInstance: AxiosInstance;

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
      const requestBody = [
        {
          keywords,
          location_name: location,
          language_name: language,
          include_adult_keywords: false,
          sort_by: 'search_volume',
        },
      ];

      console.log(`📊 Fetching keyword data for ${keywords.length} keywords...`);

      const response = await this.axiosInstance.post<DataForSEOResponse>(
        this.apiUrl,
        requestBody
      );

      if (!response.data?.tasks?.[0]?.result?.[0]?.keywords) {
        throw new Error('Invalid response from DataForSEO API');
      }

      const rawKeywords = response.data.tasks[0].result[0].keywords;

      // Normalize the data to our format
      const normalizedKeywords: KeywordData[] = rawKeywords.map((kw) => ({
        keyword: kw.keyword,
        searchVolume: kw.search_volume || 0,
        difficulty: this.calculateDifficulty(kw.competition_index, kw.competition),
        cpc: kw.cpc || 0,
        competition: kw.competition || 'UNKNOWN',
        trend: kw.keyword_info?.monthly_searches,
      }));

      console.log(`✅ Successfully fetched ${normalizedKeywords.length} keywords`);

      return normalizedKeywords;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('DataForSEO API Error:', error.response?.data || error.message);
        throw new Error(
          `DataForSEO API Error: ${error.response?.data?.status_message || error.message}`
        );
      }
      throw error;
    }
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
