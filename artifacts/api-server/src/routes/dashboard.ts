import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetPlatformPerformanceResponse,
} from "@workspace/api-zod";
import {
  campaignsTable,
  platformsTable,
  publishJobsTable,
  auditLogsTable,
  type Campaign,
  type Platform,
  type PublishJob,
  type AuditLog,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getAdapter } from "../platforms/registry";

const router = new Hono();

function mapActivityType(action: string) {
  if (action.startsWith("campaign.created")) return "create";
  if (action.startsWith("platform.connected")) return "connect";
  if (action.startsWith("platform.disconnected")) return "disconnect";
  if (action.includes("retry")) return "retry";
  if (action.startsWith("publish")) return "publish";
  if (action.includes("error") || action.startsWith("job.failed")) return "error";
  return "publish";
}

router.get("/dashboard/summary", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;

  const campaigns = (await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, user.id))) as Campaign[];

  const platforms = (await db
    .select()
    .from(platformsTable)
    .where(eq(platformsTable.userId, user.id))) as Platform[];

  const jobs = (await db
    .select()
    .from(publishJobsTable)
    .where(eq(publishJobsTable.userId, user.id))) as PublishJob[];

  const totalSpend = jobs.reduce((sum, job) => sum + Number(job.spend || 0), 0);
  const totalImpressions = jobs.reduce((sum, job) => sum + (job.impressions ?? 0), 0);
  const totalClicks = jobs.reduce((sum, job) => sum + (job.clicks ?? 0), 0);
  const successCount = jobs.filter((job) => job.status === "success").length;

  const statusCounts = campaigns.reduce<Record<string, number>>((acc, campaign) => {
    acc[campaign.status] = (acc[campaign.status] ?? 0) + 1;
    return acc;
  }, {});

  return c.json(
    GetDashboardSummaryResponse.parse({
      totalCampaigns: campaigns.length,
      liveCampaigns: campaigns.filter((campaign) => campaign.status === "live").length,
      connectedPlatforms: platforms.length,
      totalSpend,
      totalImpressions,
      totalClicks,
      avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      successRate: jobs.length > 0 ? successCount / jobs.length : 0,
      statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    }),
  );
});

router.get("/dashboard/recent-activity", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;

  const rows = (await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.userId, user.id))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(10)) as AuditLog[];

  const activity = rows.map((row) => ({
    id: row.id,
    type: mapActivityType(row.action),
    title: row.message,
    description: row.message,
    platformKey: row.platformKey ?? null,
    campaignId: row.campaignId ?? null,
    createdAt: row.createdAt,
  }));

  return c.json(GetRecentActivityResponse.parse(activity));
});

router.get("/dashboard/platform-performance", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;

  const platforms = (await db
    .select()
    .from(platformsTable)
    .where(eq(platformsTable.userId, user.id))) as Platform[];

  const jobs = (await db
    .select()
    .from(publishJobsTable)
    .where(eq(publishJobsTable.userId, user.id))) as PublishJob[];

  const performance = platforms.map((platform) => {
    const platformJobs = jobs.filter((job) => job.platformKey === platform.key);
    const campaignIds = new Set(platformJobs.map((job) => job.campaignId));
    const impressions = platformJobs.reduce((sum, job) => sum + (job.impressions ?? 0), 0);
    const clicks = platformJobs.reduce((sum, job) => sum + (job.clicks ?? 0), 0);
    const spend = platformJobs.reduce((sum, job) => sum + Number(job.spend || 0), 0);
    const success = platformJobs.filter((job) => job.status === "success").length;

    return {
      platformKey: platform.key,
      platformName: getAdapter(platform.key)?.name ?? platform.key,
      campaigns: campaignIds.size,
      impressions,
      clicks,
      spend,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      successRate: platformJobs.length > 0 ? success / platformJobs.length : 0,
    };
  });

  return c.json(GetPlatformPerformanceResponse.parse(performance));
});

export default router;