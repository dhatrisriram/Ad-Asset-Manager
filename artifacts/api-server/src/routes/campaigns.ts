import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import {
  ListCampaignsQueryParams,
  ListCampaignsResponse,
  CreateCampaignBody,
  CreateCampaignResponse,
  GetCampaignResponse,
  UpdateCampaignBody,
  UpdateCampaignResponse,
  DeleteCampaignResponse,
  DuplicateCampaignResponse,
} from "@workspace/api-zod";
import {
  campaignsTable,
  publishJobsTable,
  auditLogsTable,
  type Campaign,
  type PublishJob,
  type AuditLog,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { enqueuePlatformJobs } from "./publish";
import { getAdapter } from "../platforms/registry";

const router = new Hono();

function serializeCampaign(c: Campaign) {
  return {
    id: c.id,
    title: c.title,
    objective: c.objective,
    budget: Number(c.budget),
    currency: c.currency,
    status: c.status,
    targetPlatforms:
      typeof c.targetPlatforms === "string"
        ? JSON.parse(c.targetPlatforms)
        : c.targetPlatforms,
    scheduleStart: c.scheduleStart,
    scheduleEnd: c.scheduleEnd,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    creative:
      typeof c.creative === "string" ? JSON.parse(c.creative) : c.creative,
  };
}

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
    response: j.response
      ? typeof j.response === "string"
        ? JSON.parse(j.response)
        : j.response
      : null,
    impressions: j.impressions,
    clicks: j.clicks,
    spend: Number(j.spend),
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    createdAt: j.createdAt,
  };
}

function serializeLog(l: AuditLog) {
  return {
    id: l.id,
    campaignId: l.campaignId ?? null,
    platformKey: l.platformKey ?? null,
    action: l.action,
    level: l.level,
    message: l.message,
    meta: l.meta
      ? typeof l.meta === "string"
        ? JSON.parse(l.meta)
        : l.meta
      : null,
    createdAt: l.createdAt,
  };
}

router.get("/campaigns", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const query = c.req.query();
  const parse = ListCampaignsQueryParams.safeParse(query);
  const status = parse.success ? parse.data.status : undefined;

  const where = status
    ? and(eq(campaignsTable.userId, user.id), eq(campaignsTable.status, status))
    : eq(campaignsTable.userId, user.id);

  const rows = await db
    .select()
    .from(campaignsTable)
    .where(where)
    .orderBy(desc(campaignsTable.createdAt));
  return c.json(ListCampaignsResponse.parse(rows.map(serializeCampaign)));
});

router.post("/campaigns", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const env = (c as any).env;
  const body = await c.req.json();
  const parse = CreateCampaignBody.safeParse(body);
  if (!parse.success) {
    return c.json(
      { error: "Invalid campaign payload", issues: parse.error.issues },
      400,
    );
  }
  const { publishImmediately, ...data } = parse.data;
  const status = publishImmediately
    ? ("publishing" as const)
    : data.scheduleStart
      ? ("scheduled" as const)
      : ("draft" as const);

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(campaignsTable).values({
    id: newId,
    userId: user.id,
    title: data.title,
    objective: data.objective,
    budget: String(data.budget),
    currency: data.currency,
    targetPlatforms: JSON.stringify(data.targetPlatforms),
    status,
    scheduleStart: data.scheduleStart
      ? new Date(data.scheduleStart).toISOString()
      : null,
    scheduleEnd: data.scheduleEnd
      ? new Date(data.scheduleEnd).toISOString()
      : null,
    creative: JSON.stringify(data.creative),
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, newId))
    .limit(1);

  await db.insert(auditLogsTable).values({
    userId: user.id,
    campaignId: created!.id,
    action: "campaign.created",
    level: "info",
    message: `Created campaign "${created!.title}"`,
  });

  if (publishImmediately) {
    await enqueuePlatformJobs(user.id, created!, data.targetPlatforms, env, db);
  }

  return c.json(CreateCampaignResponse.parse(serializeCampaign(created!)));
});

router.get("/campaigns/:campaignId", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const id = c.req.param("campaignId");
  if (!id) {
    return c.json({ error: "Campaign ID is required" }, 400);
  }
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, user.id)));
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }
  const jobs = await db
    .select()
    .from(publishJobsTable)
    .where(eq(publishJobsTable.campaignId, id))
    .orderBy(desc(publishJobsTable.createdAt));
  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.campaignId, id))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(50);
  return c.json(
    GetCampaignResponse.parse({
      campaign: serializeCampaign(campaign),
      jobs: jobs.map(serializeJob),
      logs: logs.map(serializeLog),
    }),
  );
});

router.patch("/campaigns/:campaignId", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const id = c.req.param("campaignId");
  if (!id) {
    return c.json({ error: "Campaign ID is required" }, 400);
  }
  const body = await c.req.json();
  const parse = UpdateCampaignBody.safeParse(body);
  if (!parse.success) {
    return c.json({ error: "Invalid update payload" }, 400);
  }
  const data = parse.data;
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.title !== undefined) updates["title"] = data.title;
  if (data.objective !== undefined) updates["objective"] = data.objective;
  if (data.budget !== undefined) updates["budget"] = String(data.budget);
  if (data.currency !== undefined) updates["currency"] = data.currency;
  if (data.status !== undefined) updates["status"] = data.status;
  if (data.targetPlatforms !== undefined)
    updates["targetPlatforms"] = JSON.stringify(data.targetPlatforms);
  if (data.scheduleStart !== undefined)
    updates["scheduleStart"] = data.scheduleStart
      ? new Date(data.scheduleStart).toISOString()
      : null;
  if (data.scheduleEnd !== undefined)
    updates["scheduleEnd"] = data.scheduleEnd
      ? new Date(data.scheduleEnd).toISOString()
      : null;
  if (data.creative !== undefined)
    updates["creative"] = JSON.stringify(data.creative);

  await db
    .update(campaignsTable)
    .set(updates)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, user.id)));

  const [updated] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, user.id)))
    .limit(1);

  if (!updated) {
    return c.json({ error: "Campaign not found" }, 404);
  }
  return c.json(UpdateCampaignResponse.parse(serializeCampaign(updated)));
});

router.delete("/campaigns/:campaignId", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const id = c.req.param("campaignId");
  if (!id) {
    return c.json({ error: "Campaign ID is required" }, 400);
  }
  await db
    .delete(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, user.id)));
  return c.json(DeleteCampaignResponse.parse({ ok: true }));
});

router.post("/campaigns/:campaignId/duplicate", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const id = c.req.param("campaignId");
  if (!id) {
    return c.json({ error: "Campaign ID is required" }, 400);
  }
  const [orig] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, user.id)));
  if (!orig) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const targetPlatforms =
    typeof orig.targetPlatforms === "string"
      ? JSON.parse(orig.targetPlatforms)
      : orig.targetPlatforms;
  const origCreative =
    typeof orig.creative === "string"
      ? JSON.parse(orig.creative)
      : orig.creative;

  const trimmedCreative = (() => {
    const limits: number[] = targetPlatforms
      .map((k: string) => getAdapter(k)?.textLimit ?? 1000)
      .filter((n: number): n is number => typeof n === "number");
    const minLimit = limits.length ? Math.min(...limits) : 1000;
    const body = origCreative.body;
    return {
      ...origCreative,
      body:
        body.length > minLimit ? `${body.slice(0, minLimit - 1)}\u2026` : body,
    };
  })();

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(campaignsTable).values({
    id: newId,
    userId: user.id,
    title: `${orig.title} (copy)`,
    objective: orig.objective,
    budget: orig.budget,
    currency: orig.currency,
    targetPlatforms: JSON.stringify(targetPlatforms),
    status: "draft",
    scheduleStart: orig.scheduleStart,
    scheduleEnd: orig.scheduleEnd,
    creative: JSON.stringify(trimmedCreative),
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, newId))
    .limit(1);

  await db.insert(auditLogsTable).values({
    userId: user.id,
    campaignId: created!.id,
    action: "campaign.duplicated",
    level: "info",
    message: `Duplicated from "${orig.title}"`,
  });

  return c.json(DuplicateCampaignResponse.parse(serializeCampaign(created!)));
});

export default router;