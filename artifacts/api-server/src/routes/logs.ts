import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { ListAuditLogsQueryParams, ListAuditLogsResponse } from "@workspace/api-zod";
import { auditLogsTable, type AuditLog } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = new Hono();

function serialize(l: AuditLog) {
  return {
    id: l.id,
    campaignId: l.campaignId ?? null,
    platformKey: l.platformKey ?? null,
    action: l.action,
    level: l.level,
    message: l.message,
    meta: l.meta ? (typeof l.meta === "string" ? JSON.parse(l.meta) : l.meta) : null,
    createdAt: l.createdAt,
  };
}

router.get("/logs", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const query = c.req.query();
  const parse = ListAuditLogsQueryParams.safeParse(query);
  const limit = parse.success && parse.data.limit ? parse.data.limit : 100;
  const where =
    parse.success && parse.data.campaignId
      ? and(
          eq(auditLogsTable.userId, user.id),
          eq(auditLogsTable.campaignId, parse.data.campaignId),
        )
      : eq(auditLogsTable.userId, user.id);
  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(where)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit);
  return c.json(ListAuditLogsResponse.parse(rows.map(serialize)));
});

export default router;
