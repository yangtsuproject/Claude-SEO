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
  private readonly FALLBACK_LOCATION = 2840; // United States location code (better data coverage)

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
   * Fetch keyword suggestions from Google Autocomplete
   * This gives us what people actually search for (like SE Ranking)
   */
  private async getAutocompleteSuggestions(keyword: string): Promise<string[]> {
    try {
      const requestBody = [{
        keyword: keyword.trim(),
        location_code: this.DEFAULT_LOCATION,
        language_code: 'en',
      }];

      const response = await this.axiosInstance.post(
        'https://api.dataforseo.com/v3/serp/google/autocomplete/live/advanced',
        requestBody
      );

      const task = response.data?.tasks?.[0];
      console.log(`    📋 Autocomplete API - status: ${task?.status_code}, items: ${task?.result?.[0]?.items?.length || 0}`);

      if (task?.status_code === 20000 && task?.result?.[0]?.items) {
        const items = task.result[0].items;

        // Log first item structure for debugging
        if (items.length > 0) {
          console.log(`    🔍 First item structure:`, JSON.stringify(items[0], null, 2));
        }

        return items
          .map((item: any) => item.suggestion)
          .filter((kw: string) => kw && typeof kw === 'string' && kw.length > 0);
      }

      if (task?.status_code !== 20000) {
        console.warn(`    ⚠️  Autocomplete failed: ${task?.status_message}`);
      }

      return [];
    } catch (error: any) {
      console.error(`    ❌ Autocomplete error for "${keyword}": ${error?.response?.status} ${error?.response?.statusText}`);
      return [];
    }
  }

  /**
   * Fetch keyword data from DataForSEO API using multi-source approach
   * Combines autocomplete + keyword ideas for comprehensive coverage
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
      console.log(`📊 Fetching comprehensive keyword data (autocomplete + keyword ideas)...`);

      const allKeywordSeeds = new Set<string>();

      // Step 1: Get autocomplete suggestions for each seed keyword
      for (const keyword of keywords) {
        console.log(`  🔍 Getting autocomplete for "${keyword}"...`);

        // Add the seed keyword itself
        allKeywordSeeds.add(keyword.trim().toLowerCase());

        // Get autocomplete suggestions
        const suggestions = await this.getAutocompleteSuggestions(keyword);
        suggestions.forEach(s => allKeywordSeeds.add(s.toLowerCase()));

        console.log(`    ✓ Found ${suggestions.length} autocomplete suggestions`);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log(`  📝 Total autocomplete seeds: ${allKeywordSeeds.size}`);

      // Step 2: Use Keyword Ideas API to expand each autocomplete suggestion
      const allKeywords: KeywordData[] = [];
      const seedsArray = Array.from(allKeywordSeeds).slice(0, 5); // Limit to first 5 seeds to avoid too many API calls

      for (const seed of seedsArray) {
        console.log(`  🔎 Getting keyword ideas for "${seed}"...`);

        const requestBody = [{
          keywords: [seed],
          location_code: this.DEFAULT_LOCATION,
          language_code: 'en',
          include_seed_keyword: true,
          limit: Math.min(limit, 50), // Limit per seed
          filters: [
            ['keyword_info.search_volume', '>', 0], // Only keywords with volume
          ],
          order_by: ['keyword_info.search_volume,desc'],
        }];

        const response = await this.axiosInstance.post(
          'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live',
          requestBody
        );

        const task = response.data?.tasks?.[0];
        if (task?.status_code === 20000 && task?.result?.[0]?.items) {
          const items = task.result[0].items;
          console.log(`    ✓ Found ${items.length} keyword ideas for "${seed}"`);

          items.forEach((item: any) => {
            if (item.keyword_info?.search_volume > 0) {
              allKeywords.push({
                keyword: item.keyword,
                searchVolume: item.keyword_info.search_volume,
                difficulty: item.keyword_properties?.keyword_difficulty || 50,
                cpc: item.keyword_info.cpc || 0,
                competition: this.mapCompetition(item.keyword_info.competition),
                trend: item.keyword_info.monthly_searches,
              });
            }
          });
        } else {
          console.log(`    ⚠️  No keyword ideas for "${seed}". Status: ${task?.status_code}`);
        }

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`  📝 Total keywords from Keyword Ideas API: ${allKeywords.length}`);

      // Step 3: If Singapore didn't return enough keywords, try US location
      if (allKeywords.length < 10 && seedsArray.length > 0) {
        console.log(`  ⚠️  Only ${allKeywords.length} keywords from Singapore. Trying US location for more coverage...`);

        for (const seed of seedsArray.slice(0, 3)) { // Try first 3 seeds with US location
          console.log(`  🔎 Getting US keyword ideas for "${seed}"...`);

          const requestBody = [{
            keywords: [seed],
            location_code: this.FALLBACK_LOCATION, // US location
            language_code: 'en',
            include_seed_keyword: true,
            limit: Math.min(limit, 50),
            filters: [
              ['keyword_info.search_volume', '>', 0],
            ],
            order_by: ['keyword_info.search_volume,desc'],
          }];

          const response = await this.axiosInstance.post(
            'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live',
            requestBody
          );

          const task = response.data?.tasks?.[0];
          if (task?.status_code === 20000 && task?.result?.[0]?.items) {
            const items = task.result[0].items;
            console.log(`    ✓ Found ${items.length} US keyword ideas for "${seed}"`);

            items.forEach((item: any) => {
              if (item.keyword_info?.search_volume > 0) {
                allKeywords.push({
                  keyword: item.keyword,
                  searchVolume: item.keyword_info.search_volume,
                  difficulty: item.keyword_properties?.keyword_difficulty || 50,
                  cpc: item.keyword_info.cpc || 0,
                  competition: this.mapCompetition(item.keyword_info.competition),
                  trend: item.keyword_info.monthly_searches,
                });
              }
            });
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`  ✅ Total keywords after US fallback: ${allKeywords.length}`);
      }

      // Remove duplicates and sort by search volume
      const uniqueKeywords = Array.from(
        new Map(allKeywords.map(kw => [kw.keyword.toLowerCase(), kw])).values()
      );
      uniqueKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

      console.log(`✅ Total unique keywords: ${uniqueKeywords.length}`);

      if (uniqueKeywords.length === 0) {
        throw new Error('No keyword data returned. Check DataForSEO credits and API access.');
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
