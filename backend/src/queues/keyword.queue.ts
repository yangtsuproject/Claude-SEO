import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { KeywordService } from '../services/keyword.service';

/**
 * Job data interface for keyword research
 */
interface KeywordResearchJobData {
  keywordResearchId: string;
  projectId: string;
  seedKeywords: string[];
  keywordLimit?: number; // Number of keywords to fetch per seed (10-100)
  includePAA?: boolean; // Whether to include People Also Ask questions
}

/**
 * Redis connection configuration
 */
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * Keyword Research Queue
 * Handles background processing of keyword research jobs
 */
export const keywordResearchQueue = new Queue<KeywordResearchJobData>('keyword-research', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Keyword Research Worker
 * Processes jobs from the queue
 */
export const keywordResearchWorker = new Worker<KeywordResearchJobData>(
  'keyword-research',
  async (job: Job<KeywordResearchJobData>) => {
    const { keywordResearchId, seedKeywords, keywordLimit, includePAA } = job.data;

    console.log(`\n🔄 Processing job ${job.id} for keyword research ${keywordResearchId}`);
    console.log(`📋 Seed keywords: ${seedKeywords.join(', ')}`);
    console.log(`🔢 Keyword limit: ${keywordLimit || 50} per seed`);
    console.log(`❓ Include PAA: ${includePAA !== false ? 'Yes' : 'No'}`);

    const keywordService = new KeywordService();

    try {
      // Update job progress
      await job.updateProgress(10);

      // Process the keyword research
      await keywordService.processKeywordResearch(keywordResearchId, keywordLimit || 50, includePAA !== false);

      // Update job progress to 100%
      await job.updateProgress(100);

      console.log(`✅ Job ${job.id} completed successfully`);

      return {
        success: true,
        keywordResearchId,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);

      // Log the error but let BullMQ handle retries
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2, // Process 2 jobs concurrently
    limiter: {
      max: 10, // Maximum 10 jobs
      duration: 60000, // Per 60 seconds (1 minute)
    },
  }
);

/**
 * Event handlers for the worker
 */
keywordResearchWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} has been completed`);
});

keywordResearchWorker.on('failed', (job, error) => {
  if (job) {
    console.error(`❌ Job ${job.id} has failed with error:`, error.message);
  }
});

keywordResearchWorker.on('active', (job) => {
  console.log(`🔄 Job ${job.id} is now active`);
});

keywordResearchWorker.on('progress', (job, progress) => {
  console.log(`📊 Job ${job.id} progress: ${progress}%`);
});

/**
 * Add a new keyword research job to the queue
 */
export async function addKeywordResearchJob(
  keywordResearchId: string,
  projectId: string,
  seedKeywords: string[],
  keywordLimit: number = 50,
  includePAA: boolean = true
): Promise<Job<KeywordResearchJobData>> {
  const job = await keywordResearchQueue.add(
    'process-keyword-research',
    {
      keywordResearchId,
      projectId,
      seedKeywords,
      keywordLimit,
      includePAA,
    },
    {
      jobId: keywordResearchId, // Use keyword research ID as job ID for idempotency
    }
  );

  console.log(`📬 Added keyword research job ${job.id} to queue`);

  return job;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  const job = await keywordResearchQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    returnValue: job.returnvalue,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

/**
 * Graceful shutdown
 */
export async function closeQueue() {
  console.log('🛑 Closing keyword research queue...');
  await keywordResearchQueue.close();
  await keywordResearchWorker.close();
  await redisConnection.quit();
  console.log('✅ Queue closed successfully');
}

// Handle shutdown signals
process.on('SIGTERM', async () => {
  await closeQueue();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeQueue();
  process.exit(0);
});
