import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import {
  ListPlatformCatalogResponse,
  ListPlatformsResponse,
  ConnectPlatformBody,
  ConnectPlatformResponse,
  DisconnectPlatformResponse,
  TestPlatformConnectionResponse,
} from "@workspace/api-zod";
import {
  platformsTable,
  auditLogsTable,
  type Platform,
} from "@workspace/db";
import { listAdapters, getAdapter } from "../platforms/registry";
import { requireAuth } from "../lib/auth";
import { kv, credentialsKey, configKey } from "../lib/kv";

const router = new Hono();

function serializePlatform(p: Platform) {
  const adapter = getAdapter(p.key);
  return {
    id: p.id,
    key: p.key,
    name: adapter?.name ?? p.key,
    accountLabel: p.accountLabel,
    status: p.status,
    connectedAt: p.connectedAt,
    lastSyncedAt: p.lastSyncedAt,
    config: typeof p.config === "string" ? JSON.parse(p.config) : p.config,
  };
}

router.get("/platforms/catalog", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const connected = await db
    .select({ key: platformsTable.key })
    .from(platformsTable)
    .where(eq(platformsTable.userId, user.id));
  const connectedKeys = new Set(connected.map((item: Platform) => item.key));

  const items = await Promise.all(
    listAdapters().map(async (a) => {
      // Cache config in KV (TTL 1h) — mirrors Cloudflare KV pattern.
      const cached = await kv.get(configKey(a.key));
      if (!cached) {
        await kv.put(
          configKey(a.key),
          { textLimit: a.textLimit, rateLimitPerSec: a.rateLimitPerSec },
          { ttlSeconds: 3600 },
        );
      }
      return {
        key: a.key,
        name: a.name,
        category: a.category,
        authType: a.authType,
        supportedCreatives: a.supportedCreatives,
        textLimit: a.textLimit,
        brandColor: a.brandColor,
        connected: connectedKeys.has(a.key),
      };
    }),
  );
  return c.json(ListPlatformCatalogResponse.parse(items));
});

router.get("/platforms", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const rows = await db
    .select()
    .from(platformsTable)
    .where(eq(platformsTable.userId, user.id))
    .orderBy(desc(platformsTable.connectedAt));
  return c.json(ListPlatformsResponse.parse(rows.map(serializePlatform)));
});

router.post("/platforms", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const body = await c.req.json();
  const parse = ConnectPlatformBody.safeParse(body);
  if (!parse.success) {
    return c.json({ error: "Invalid platform payload" }, 400);
  }
  const adapter = getAdapter(parse.data.key);
  if (!adapter) {
    return c.json({ error: `Unknown platform "${parse.data.key}"` }, 404);
  }

  const [created] = await db
    .insert(platformsTable)
    .values({
      userId: user.id,
      key: adapter.key,
      accountLabel: parse.data.accountLabel,
      status: "active",
      credentialsRef: `kv:platform:credentials:pending`,
      config: JSON.stringify(parse.data.config ?? {}),
    })
    .returning();

  // Store mocked credentials in KV (the "real" data lives there, not in D1).
  await kv.put(credentialsKey(created!.id), {
    apiKey: parse.data.apiKey ?? `mock_${adapter.key}_key`,
    issuedAt: Date.now(),
  });
  await db
    .update(platformsTable)
    .set({ credentialsRef: credentialsKey(created!.id) })
    .where(eq(platformsTable.id, created!.id));

  await db.insert(auditLogsTable).values({
    userId: user.id,
    platformKey: adapter.key,
    action: "platform.connected",
    level: "info",
    message: `Connected ${adapter.name} (${parse.data.accountLabel})`,
  });

  return c.json(
    ConnectPlatformResponse.parse(
      serializePlatform({ ...created!, credentialsRef: credentialsKey(created!.id) }),
    ),
  );
});

router.delete("/platforms/:platformId", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const platformId = c.req.param("platformId");
  if (!platformId) {
    return c.json({ error: "Platform ID is required" }, 400);
  }
  const [existing] = await db
    .select()
    .from(platformsTable)
    .where(
      and(
        eq(platformsTable.id, platformId),
        eq(platformsTable.userId, user.id),
      ),
    );
  if (!existing) {
    return c.json({ error: "Platform not found" }, 404);
  }
  await db
    .delete(platformsTable)
    .where(eq(platformsTable.id, platformId));
  await kv.delete(credentialsKey(platformId));
  await db.insert(auditLogsTable).values({
    userId: user.id,
    platformKey: existing.key,
    action: "platform.disconnected",
    level: "info",
    message: `Disconnected ${existing.accountLabel}`,
  });
  return c.json(DisconnectPlatformResponse.parse({ ok: true }));
});

router.post("/platforms/:platformId/test", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const platformId = c.req.param("platformId");
  if (!platformId) {
    return c.json({ error: "Platform ID is required" }, 400);
  }
  const [platform] = await db
    .select()
    .from(platformsTable)
    .where(
      and(
        eq(platformsTable.id, platformId),
        eq(platformsTable.userId, user.id),
      ),
    );
  if (!platform) {
    return c.json({ error: "Platform not found" }, 404);
  }
  const adapter = getAdapter(platform.key);
  if (!adapter) {
    return c.json({ error: "Unknown adapter" }, 400);
  }
  const credentials =
    (await kv.get<Record<string, unknown>>(credentialsKey(platform.id))) ??
    {};
  const result = await adapter.testConnection(credentials);
  await db
    .update(platformsTable)
    .set({ lastSyncedAt: new Date().toISOString() })
    .where(eq(platformsTable.id, platformId));
  return c.json(TestPlatformConnectionResponse.parse(result));
});

export default router;
