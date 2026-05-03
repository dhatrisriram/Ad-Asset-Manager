/**
 * Cloudflare Queues integration for async publish jobs.
 *
 * This module provides two parts:
 *  1. `enqueuePublish()` - called by routes to push jobs to the queue
 *  2. Queue consumer handler - processes jobs from Cloudflare Queues
 *
 * Responsibilities:
 *  - Enqueue publish jobs (one per (campaign, platform) pair) to Cloudflare Queues
 *  - Per-platform rate limiting via D1 + KV
 *  - Retry with exponential backoff (handled by Cloudflare, with audit trail)
 *  - Update job + campaign status as work progresses in D1
 *  - Emit audit-log entries
 *
 * Usage in wrangler.toml:
 *   [[queues.producers]]
 *   binding = "PUBLISH_QUEUE"
 *   queue = "publish-jobs"
 *
 *   [[queues.consumers]]
 *   queue = "publish-jobs"
 *   max_batch_size = 10
 *   max_batch_timeout = 30
 *   max_retries = 3
 *   dead_letter_queue = "publish-jobs-dlq"
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { publishJobsTable, campaignsTable, auditLogsTable } from "@workspace/db";
import type { PublishJob } from "@workspace/db";
import { getAdapter } from "../platforms/registry";
import { kv, credentialsKey } from "./kv";
import { logger } from "./logger";

interface QueueMessage {
  jobId: string;
  campaignId: string;
  platformKey: string;
  platformId: string;
  userId: string;
}

interface CloudflareEnv {
  PUBLISH_QUEUE: Queue<QueueMessage>;
  DB: D1Database;
  KV: KVNamespace;
  SESSION_SECRET: string;
}

const MAX_ATTEMPTS = 3;

/**
 * Enqueue a publish job to Cloudflare Queues.
 * Called from routes to queue work asynchronously.
 */
export async function enqueuePublish(
  item: Omit<QueueMessage, never>,
  env: CloudflareEnv,
): Promise<void> {
  await env.PUBLISH_QUEUE.send(item, {
    contentType: "json",
  });
}

/**
 * Cloudflare Queue Consumer Handler
 * Export this as the queue handler in your worker.
 *
 * Example in worker file:
 *   export default {
 *     async queue(batch, env) {
 *       await handlePublishQueue(batch, env);
 *     },
 *   };
 */
export async function handlePublishQueue(
  batch: MessageBatch<QueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  // Use D1 from env for this worker context
  const db = drizzle(env.DB);

  for (const message of batch.messages) {
    try {
      await processPublishJob(message.body, db, env);
      message.ack();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(
        { jobId: message.body.jobId, error: errMsg },
        "Queue consumer error",
      );
      // Re-queue for retry (Cloudflare will handle exponential backoff)
      message.retry();
    }
  }
}

async function processPublishJob(
  item: QueueMessage,
  db: any,
  env: CloudflareEnv,
): Promise<void> {
  const adapter = getAdapter(item.platformKey);
  if (!adapter) {
    await failJob(db, item, `Unknown platform "${item.platformKey}"`, 0);
    return;
  }

  // Fetch current job record
  const [job] = await db
    .select()
    .from(publishJobsTable)
    .where(eq(publishJobsTable.id, item.jobId));

  if (!job) {
    logger.warn({ jobId: item.jobId }, "Job not found");
    return;
  }

  // Update job to "processing"
  await db
    .update(publishJobsTable)
    .set({ status: "processing", startedAt: new Date().toISOString() })
    .where(eq(publishJobsTable.id, item.jobId));

  // Fetch campaign
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, item.campaignId));

  if (!campaign) {
    logger.warn({ campaignId: item.campaignId }, "Campaign not found");
    return;
  }

  // Fetch platform credentials from KV
  const credKey = credentialsKey(item.platformId);
  const credentialsJson = await env.KV.get(credKey);
  const credentials = credentialsJson ? JSON.parse(credentialsJson) : {};

  // Parse campaign fields (stored as JSON strings in SQLite)
  const targetPlatforms = typeof campaign.targetPlatforms === "string"
    ? JSON.parse(campaign.targetPlatforms)
    : campaign.targetPlatforms;
  const creative = typeof campaign.creative === "string"
    ? JSON.parse(campaign.creative)
    : campaign.creative;

  try {
    const result = await adapter.publish({
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      objective: campaign.objective,
      budget: Number(campaign.budget),
      currency: campaign.currency,
      targetPlatforms,
      scheduleStart: campaign.scheduleStart,
      scheduleEnd: campaign.scheduleEnd,
      creative,
      credentials,
    });

    // Success: update job
    await db
      .update(publishJobsTable)
      .set({
        status: "success",
        attempts: (job.attempts ?? 0) + 1,
        externalId: result.externalId,
        externalUrl: result.externalUrl ?? null,
        response: JSON.stringify(result.response ?? {}),
        impressions: result.impressions,
        clicks: result.clicks,
        spend: String(result.spend),
        completedAt: new Date().toISOString(),
        error: null,
      })
      .where(eq(publishJobsTable.id, item.jobId));

    // Audit log
    await db.insert(auditLogsTable).values({
      userId: item.userId,
      campaignId: item.campaignId,
      platformKey: item.platformKey,
      action: "publish.success",
      level: "info",
      message: `Published to ${adapter.name}`,
      meta: JSON.stringify({
        externalId: result.externalId,
        attempts: (job.attempts ?? 0) + 1,
      }),
    });

    await reconcileCampaignStatus(item.campaignId, db);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const attempts = (job.attempts ?? 0) + 1;

    logger.warn(
      { jobId: item.jobId, attempt: attempts, error: errMsg },
      "Publish attempt failed",
    );

    // Audit log for attempt
    await db.insert(auditLogsTable).values({
      userId: item.userId,
      campaignId: item.campaignId,
      platformKey: item.platformKey,
      action: attempts >= MAX_ATTEMPTS ? "publish.failed" : "publish.retry",
      level: attempts >= MAX_ATTEMPTS ? "error" : "warn",
      message: `${adapter.name}: ${errMsg}`,
      meta: JSON.stringify({ attempt: attempts }),
    });

    if (attempts >= MAX_ATTEMPTS) {
      // Final failure
      await failJob(db, item, errMsg, attempts);
      await reconcileCampaignStatus(item.campaignId, db);
    } else {
      // Retrying - update job status
      await db
        .update(publishJobsTable)
        .set({ status: "retrying", attempts, error: errMsg })
        .where(eq(publishJobsTable.id, item.jobId));

      // Cloudflare will retry based on queue consumer config (exponential backoff)
      throw new Error(`Retry attempt ${attempts}: ${errMsg}`);
    }
  }
}

async function failJob(
  db: any,
  item: QueueMessage,
  message: string,
  attempts: number,
): Promise<void> {
  await db
    .update(publishJobsTable)
    .set({
      status: "failed",
      attempts,
      error: message,
      completedAt: new Date().toISOString(),
    })
    .where(eq(publishJobsTable.id, item.jobId));
}

export async function reconcileCampaignStatus(
  campaignId: string,
  db: any,
): Promise<void> {
  const jobs: PublishJob[] = await db
    .select()
    .from(publishJobsTable)
    .where(eq(publishJobsTable.campaignId, campaignId));

  if (jobs.length === 0) return;

  const all = jobs.length;
  const success = jobs.filter((j) => j.status === "success").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const inflight = jobs.filter((j) =>
    ["pending", "processing", "retrying"].includes(j.status),
  ).length;

  let status:
    | "draft"
    | "scheduled"
    | "publishing"
    | "live"
    | "partial"
    | "failed"
    | "paused";
  if (inflight > 0) status = "publishing";
  else if (success === all) status = "live";
  else if (failed === all) status = "failed";
  else status = "partial";

  await db
    .update(campaignsTable)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(campaignsTable.id, campaignId));
}
