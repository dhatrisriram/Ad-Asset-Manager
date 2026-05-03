import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import {
  PublishCampaignBody,
  PublishCampaignResponse,
  RetryPublishJobResponse,
  GetPublishStatusQueryParams,
  GetPublishStatusResponse,
} from "@workspace/api-zod";
import {
  campaignsTable,
  publishJobsTable,
  platformsTable,
  auditLogsTable,
  type Campaign,
  type Platform,
  type PublishJob,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getAdapter } from "../platforms/registry";
import { enqueuePublish } from "../lib/queue";

const router = new Hono();

function serializeJob(j: PublishJob) {
  return {
    id: j.id,
    campaignId: j.campaignId,
    platformKey: j.platformKey,
    platformName: j.platformName,
    status: j.status,
    attempts: j.attempts,
    externalId: j.externalId ?? null,
    externalUrl: j.externalUrl ?? null,
    error: j.error ?? null,
    response: j.response ? (typeof j.response === "string" ? JSON.parse(j.response) : j.response) : null,
    impressions: j.impressions,
    clicks: j.clicks,
    spend: Number(j.spend),
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    createdAt: j.createdAt,
  };
}

/**
 * Shared helper: create publish_jobs rows for each platform and push to queue.
 * Used both by /publish and by /campaigns when `publishImmediately` is set.
 */
export async function enqueuePlatformJobs(
  userId: string,
  campaign: Campaign,
  platformKeys: string[],
  env: any,
  db?: any,
): Promise<PublishJob[]> {
  // If db not provided, get from env (used when called from route context)
  const database = db || (env?.db);
  if (!database) {
    throw new Error("Database instance required");
  }

  const connected = await database
    .select()
    .from(platformsTable)
    .where(eq(platformsTable.userId, userId));
  const connectedByKey = new Map<string, Platform>(connected.map((p: Platform) => [p.key, p]));

  const created: PublishJob[] = [];
  for (const key of platformKeys) {
    const adapter = getAdapter(key);
    if (!adapter) continue;
    const platform = connectedByKey.get(key);
    const platformName = adapter.name;

    const [job] = await database
      .insert(publishJobsTable)
      .values({
        userId,
        campaignId: campaign.id,
        platformKey: key,
        platformName,
        status: "pending",
        attempts: 0,
      })
      .returning();
    created.push(job!);

    if (!platform) {
      // Fail fast — platform not connected. Provides a clear error in the UI.
      await database
        .update(publishJobsTable)
        .set({
          status: "failed",
          error: `${adapter.name} is not connected. Connect it on the Integrations page.`,
          completedAt: new Date().toISOString(),
        })
        .where(eq(publishJobsTable.id, job!.id));
      await database.insert(auditLogsTable).values({
        userId,
        campaignId: campaign.id,
        platformKey: key,
        action: "publish.skipped",
        level: "warn",
        message: `Skipped ${adapter.name} — not connected`,
      });
      continue;
    }

    await enqueuePublish(
      {
        jobId: job!.id,
        campaignId: campaign.id,
        platformKey: key,
        platformId: platform!.id,
        userId,
      },
      env,
    );
  }

  await database
    .update(campaignsTable)
    .set({ status: "publishing", updatedAt: new Date().toISOString() })
    .where(eq(campaignsTable.id, campaign.id));

  await database.insert(auditLogsTable).values({
    userId,
    campaignId: campaign.id,
    action: "campaign.published",
    level: "info",
    message: `Queued publish to ${platformKeys.length} platform(s)`,
    meta: JSON.stringify({ platforms: platformKeys }),
  });

  return created;
}

router.post("/publish", requireAuth, async (c) => {
  const user = (c as any).user;
  const env = c.env as any;
  const db = (c as any).db;
  const body = await c.req.json();
  const parse = PublishCampaignBody.safeParse(body);
  if (!parse.success) {
    return c.json({ error: "Invalid publish payload" }, 400);
  }
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, parse.data.campaignId),
        eq(campaignsTable.userId, user.id),
      ),
    );
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }
  const targetPlatforms = typeof campaign.targetPlatforms === "string"
    ? JSON.parse(campaign.targetPlatforms)
    : campaign.targetPlatforms;
  const platforms =
    parse.data.platforms && parse.data.platforms.length > 0
      ? parse.data.platforms
      : targetPlatforms;

  const jobs = await enqueuePlatformJobs(user.id, campaign, platforms, env, db);

  return c.json(
    PublishCampaignResponse.parse({
      campaignId: campaign.id,
      jobs: jobs.map(serializeJob),
    }),
  );
});

router.post("/publish/:jobId/retry", requireAuth, async (c) => {
  const user = (c as any).user;
  const env = c.env as any;
  const db = (c as any).db;
  const jobId = c.req.param("jobId");
  if (!jobId) {
    return c.json({ error: "Job ID is required" }, 400);
  }
  const [job] = await db
    .select()
    .from(publishJobsTable)
    .where(
      and(
        eq(publishJobsTable.id, jobId),
        eq(publishJobsTable.userId, user.id),
      ),
    );
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }
  const [platform] = await db
    .select()
    .from(platformsTable)
    .where(
      and(
        eq(platformsTable.userId, user.id),
        eq(platformsTable.key, job.platformKey),
      ),
    );
  if (!platform) {
    return c.json({ error: `${job.platformName} is not connected — cannot retry.` }, 400);
  }
  const [updated] = await db
    .update(publishJobsTable)
    .set({
      status: "pending",
      error: null,
      attempts: 0,
      startedAt: null,
      completedAt: null,
    })
    .where(eq(publishJobsTable.id, jobId))
    .returning();
  await enqueuePublish({
    jobId,
    campaignId: job.campaignId,
    platformKey: job.platformKey,
    platformId: platform.id,
    userId: user.id,
  }, env);
  await db.insert(auditLogsTable).values({
    userId: user.id,
    campaignId: job.campaignId,
    platformKey: job.platformKey,
    action: "publish.manual_retry",
    level: "info",
    message: `Manually retried ${job.platformName}`,
  });
  return c.json(RetryPublishJobResponse.parse(serializeJob(updated!)));
});

router.get("/status", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const query = c.req.query();
  const parse = GetPublishStatusQueryParams.safeParse(query);
  const where = parse.success && parse.data.campaignId
    ? and(
        eq(publishJobsTable.userId, user.id),
        eq(publishJobsTable.campaignId, parse.data.campaignId),
      )
    : eq(publishJobsTable.userId, user.id);
  const rows = await db
    .select()
    .from(publishJobsTable)
    .where(where)
    .orderBy(desc(publishJobsTable.createdAt))
    .limit(200);
  return c.json(GetPublishStatusResponse.parse(rows.map(serializeJob)));
});

export default router;
