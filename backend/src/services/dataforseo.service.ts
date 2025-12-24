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
 * Competitor ranking data
 */
export interface CompetitorData {
  url: string;
  domain: string;
  position: number;
  title: string;
}

/**
 * Competitor keyword opportunity
 */
export interface CompetitorKeyword extends KeywordData {
  competitorUrls: string[]; // URLs that rank for this keyword
  gap: 'high' | 'medium' | 'low'; // Opportunity level
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
      console.log(`📊 Fetching intent-based & LSI keywords...`);

      const allKeywords: KeywordData[] = [];

      for (const keyword of keywords) {
        console.log(`  🔍 Processing seed: "${keyword}"...`);

        // Step 1: Get all keyword ideas (includes LSI and related terms)
        const requestBody = [{
          keywords: [keyword.trim()],
          location_code: this.DEFAULT_LOCATION,
          language_code: 'en',
          include_seed_keyword: true,
          limit: 100, // Get more to filter later
          filters: [
            ['keyword_info.search_volume', '>=', 10], // Minimum 10 search volume
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
          console.log(`    ✓ Found ${items.length} keyword ideas`);

          // Filter to intent-based and LSI keywords only
          // Exclude pure location variations (in city, in country, etc.)
          const locationPatterns = [
            /\s+in\s+[a-z]+$/i,          // "keyword in city"
            /\s+[a-z]+\s+city$/i,        // "keyword city name"
            /\s+near\s+me$/i,            // Keep "near me" as it's local intent
          ];

          const intentKeywords = [
            'price', 'cost', 'fee', 'charge', 'pricing', 'rate',
            'service', 'package', 'what', 'how', 'why', 'when',
            'best', 'top', 'consultant', 'agency', 'company',
            'hire', 'find', 'get', 'choose',
          ];

          items.forEach((item: any) => {
            const kw = item.keyword.toLowerCase();

            // Skip if it's purely a location variation (without intent keywords)
            const isLocationOnly = locationPatterns.some(pattern => {
              const match = kw.match(pattern);
              if (!match) return false;
              // Check if it has any intent keywords
              return !intentKeywords.some(intent => kw.includes(intent));
            });

            if (!isLocationOnly && item.keyword_info?.search_volume >= 10) {
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
          console.log(`    ⚠️  No keyword ideas found. Status: ${task?.status_code}`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`  📝 Total intent-based keywords: ${allKeywords.length}`);

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

  /**
   * Get top-ranking competitors for a keyword
   * @param keyword The keyword to analyze
   * @param limit Number of top results to return (default: 3)
   * @returns Array of competitor data
   */
  async getTopCompetitors(keyword: string, limit: number = 3): Promise<CompetitorData[]> {
    try {
      console.log(`🏆 Fetching top ${limit} competitors for: "${keyword}"...`);

      const requestBody = [
        {
          keyword: keyword.trim(),
          location_code: this.DEFAULT_LOCATION, // Singapore
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
        console.warn(`  ⚠️  SERP request failed: ${task?.status_message}`);
        return [];
      }

      const items = task?.result?.[0]?.items || [];
      const organicResults = items.filter((item: any) => item.type === 'organic');

      const competitors: CompetitorData[] = organicResults
        .slice(0, limit)
        .map((result: any) => ({
          url: result.url,
          domain: result.domain,
          position: result.rank_group,
          title: result.title,
        }));

      console.log(`  ✅ Found ${competitors.length} top competitors`);
      competitors.forEach((comp, idx) => {
        console.log(`    ${idx + 1}. ${comp.domain} - ${comp.title.substring(0, 60)}`);
      });

      return competitors;
    } catch (error) {
      console.error(`  ❌ Error fetching competitors for "${keyword}":`, error);
      return [];
    }
  }

  /**
   * Get keywords that a competitor URL ranks for
   * @param url The competitor URL to analyze
   * @param limit Maximum keywords to return (default: 50)
   * @returns Array of keywords the URL ranks for
   */
  async getCompetitorKeywords(url: string, limit: number = 50): Promise<KeywordData[]> {
    try {
      console.log(`  🔍 Analyzing keywords for URL: ${url.substring(0, 60)}...`);

      const requestBody = [
        {
          target: url,
          location_code: this.DEFAULT_LOCATION,
          language_code: 'en',
          limit: limit,
          filters: [
            ['keyword_data.keyword_info.search_volume', '>=', 10], // Minimum search volume
          ],
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
        },
      ];

      const response = await this.axiosInstance.post<any>(
        'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
        requestBody
      );

      const task = response.data?.tasks?.[0];

      if (task?.status_code !== 20000) {
        console.warn(`    ⚠️  Ranked keywords request failed: ${task?.status_message}`);
        return [];
      }

      const items = task?.result?.[0]?.items || [];

      const keywords: KeywordData[] = items
        .map((item: any) => ({
          keyword: item.keyword_data?.keyword,
          searchVolume: item.keyword_data?.keyword_info?.search_volume || 0,
          difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty || 50,
          cpc: item.keyword_data?.keyword_info?.cpc || 0,
          competition: this.mapCompetition(item.keyword_data?.keyword_info?.competition),
          trend: item.keyword_data?.keyword_info?.monthly_searches,
        }))
        .filter((kw: Partial<KeywordData>) => kw.keyword && kw.searchVolume && kw.searchVolume >= 10) as KeywordData[];

      console.log(`    ✓ Found ${keywords.length} keywords for this URL`);

      return keywords;
    } catch (error) {
      console.error(`    ❌ Error fetching competitor keywords for ${url}:`, error);
      return [];
    }
  }

  /**
   * Analyze competitive gaps - find keywords competitors rank for that we don't
   * @param seedKeywords Our target keywords
   * @param currentKeywords Keywords we already have
   * @param domainRating Our domain rating for opportunity scoring
   * @returns Array of competitor keyword opportunities
   */
  async analyzeCompetitiveGaps(
    seedKeywords: string[],
    currentKeywords: string[],
    domainRating: number = 10
  ): Promise<CompetitorKeyword[]> {
    try {
      console.log(`🔬 Analyzing competitive gaps for ${seedKeywords.length} seed keywords...`);
      console.log(`   Your DR: ${domainRating}`);

      const competitorKeywordsMap = new Map<string, CompetitorKeyword>();
      const currentKeywordsSet = new Set(currentKeywords.map((kw) => kw.toLowerCase()));

      // For each seed keyword, find top competitors
      for (const seedKeyword of seedKeywords.slice(0, 2)) {
        // Limit to 2 seeds to save API credits
        console.log(`\n  📊 Analyzing competitors for: "${seedKeyword}"`);

        // Get top 3 competitors
        const competitors = await this.getTopCompetitors(seedKeyword, 3);

        if (competitors.length === 0) {
          console.log(`    ⚠️  No competitors found, skipping...`);
          continue;
        }

        // For each competitor, get their keywords
        for (const competitor of competitors) {
          const compKeywords = await this.getCompetitorKeywords(competitor.url, 30);

          // Filter to find gaps (keywords they rank for that we don't have)
          compKeywords.forEach((kw) => {
            const kwLower = kw.keyword.toLowerCase();

            // Skip if we already have this keyword
            if (currentKeywordsSet.has(kwLower)) {
              return;
            }

            // Skip if it's too different from our seed keywords (basic relevance check)
            const isRelevant = seedKeywords.some((seed) => {
              const seedWords = seed.toLowerCase().split(' ');
              const kwWords = kwLower.split(' ');
              return seedWords.some((sw) => kwWords.includes(sw));
            });

            if (!isRelevant) {
              return;
            }

            // Calculate opportunity gap level based on DR vs KD
            let gap: 'high' | 'medium' | 'low';
            if (kw.difficulty <= domainRating + 15) {
              gap = 'high'; // Easy to rank
            } else if (kw.difficulty <= domainRating + 30) {
              gap = 'medium'; // Possible
            } else {
              gap = 'low'; // Difficult
            }

            // Add or update in map
            if (competitorKeywordsMap.has(kwLower)) {
              const existing = competitorKeywordsMap.get(kwLower)!;
              if (!existing.competitorUrls.includes(competitor.url)) {
                existing.competitorUrls.push(competitor.url);
              }
            } else {
              competitorKeywordsMap.set(kwLower, {
                ...kw,
                competitorUrls: [competitor.url],
                gap,
              });
            }
          });

          // Small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Delay between seed keywords
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const competitorKeywords = Array.from(competitorKeywordsMap.values());

      // Sort by opportunity (high gap + high volume first)
      competitorKeywords.sort((a, b) => {
        const gapScore = { high: 3, medium: 2, low: 1 };
        const scoreA = gapScore[a.gap] * Math.log(a.searchVolume + 1);
        const scoreB = gapScore[b.gap] * Math.log(b.searchVolume + 1);
        return scoreB - scoreA;
      });

      console.log(`\n✅ Found ${competitorKeywords.length} competitive gap opportunities`);
      console.log(`   High opportunity: ${competitorKeywords.filter((k) => k.gap === 'high').length}`);
      console.log(`   Medium opportunity: ${competitorKeywords.filter((k) => k.gap === 'medium').length}`);
      console.log(`   Low opportunity: ${competitorKeywords.filter((k) => k.gap === 'low').length}`);

      return competitorKeywords.slice(0, 50); // Return top 50 opportunities
    } catch (error) {
      console.error('❌ Error analyzing competitive gaps:', error);
      return [];
    }
  }
}
