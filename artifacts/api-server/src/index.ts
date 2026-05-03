import app from "./app";
import { initDb } from "../../../lib/db/src/index";
import { initKV } from "./lib/kv";
import { handlePublishQueue } from "./lib/queue";
import { logger } from "./lib/logger";

interface Env {
  DB: D1Database;
  KV_CACHE: KVNamespace;
  PUBLISH_QUEUE: Queue<{
    jobId: string;
    campaignId: string;
    platformKey: string;
    platformId: string;
    userId: string;
  }>;
  SESSION_SECRET: string;
}

/**
 * Cloudflare Worker entry point.
 * Hono app handles all HTTP requests.
 * Queue handler processes async publishing jobs.
 */
export default {
  fetch: app.fetch,

  /**
   * Cloudflare Queues consumer handler for async publishing jobs.
   * Processes batch of messages from the PUBLISH_QUEUE.
   */
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
    try {
      // Initialize KV from environment
      initKV(env.KV_CACHE);
      
      // Initialize database instance for queue processing
      const db = initDb(env.DB);
      
      // Process queue messages
      await handlePublishQueue(batch, {
        PUBLISH_QUEUE: env.PUBLISH_QUEUE,
        DB: env.DB,
        KV: env.KV_CACHE,
        SESSION_SECRET: env.SESSION_SECRET,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ error: errMsg }, "Queue handler error");
      throw err;
    }
  },
};
