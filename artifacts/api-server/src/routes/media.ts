import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import {
  ListMediaResponse,
  CreateMediaBody,
  CreateMediaResponse,
  DeleteMediaResponse,
} from "@workspace/api-zod";
import { mediaTable, type Media } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = new Hono();

function serialize(m: Media) {
  return {
    id: m.id,
    type: m.type,
    name: m.name,
    url: m.url,
    sizeBytes: m.sizeBytes,
    width: m.width ?? null,
    height: m.height ?? null,
    createdAt: m.createdAt,
  };
}

router.get("/media", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const rows = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.userId, user.id))
    .orderBy(desc(mediaTable.createdAt));
  return c.json(ListMediaResponse.parse(rows.map(serialize)));
});

router.post("/media", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const body = await c.req.json();
  const parse = CreateMediaBody.safeParse(body);
  if (!parse.success) {
    return c.json({ error: "Invalid media payload" }, 400);
  }
  const [created] = await db
    .insert(mediaTable)
    .values({
      userId: user.id,
      type: parse.data.type,
      name: parse.data.name,
      url: parse.data.url,
      sizeBytes: parse.data.sizeBytes ?? 0,
      width: parse.data.width ?? null,
      height: parse.data.height ?? null,
    })
    .returning();
  return c.json(CreateMediaResponse.parse(serialize(created!)));
});

router.delete("/media/:mediaId", requireAuth, async (c) => {
  const user = (c as any).user;
  const db = (c as any).db;
  const id = c.req.param("mediaId");
  if (!id) {
    return c.json({ error: "Media ID is required" }, 400);
  }
  const result = await db
    .delete(mediaTable)
    .where(and(eq(mediaTable.id, id), eq(mediaTable.userId, user.id)));
  if (result.rowCount === 0) {
    return c.json({ error: "Media not found" }, 404);
  }
  return c.json(DeleteMediaResponse.parse({ ok: true }));
});

export default router;
