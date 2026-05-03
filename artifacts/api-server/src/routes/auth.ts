import { Hono } from "hono";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import {
  LoginBody,
  LoginResponse,
  GetCurrentUserResponse,
  LogoutResponse,
} from "@workspace/api-zod";
import { usersTable } from "@workspace/db";
import {
  createSession,
  destroySession,
  findOrCreateUser,
  verifyPassword,
  requireAuth,
} from "../lib/auth";

const router = new Hono();

function extractToken(c: Context): string | undefined {
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return (c as any).cookie?.("adshub_token");
}

router.post("/auth/login", async (c) => {
  const db = (c as any).db;
  const body = await c.req.json();
  const parse = LoginBody.safeParse(body);
  if (!parse.success) {
    return c.json({ error: "Invalid login payload", issues: parse.error.issues }, 400);
  }

  const email = parse.data.email.toLowerCase().trim();
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  let user = existing;
  if (user) {
    const valid = await verifyPassword(parse.data.password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }
  } else {
    user = await findOrCreateUser({
      email,
      password: parse.data.password,
      db,
    });
  }

  const token = await createSession(user.id, db);
  return c.json(
    LoginResponse.parse({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    }),
  );
});

router.get("/auth/me", requireAuth, async (c) => {
  const user = (c as any).user;
  return c.json(
    GetCurrentUserResponse.parse({
      id: user.id,
      email: user.email,
      name: user.name,
    }),
  );
});

router.post("/auth/logout", async (c) => {
  const db = (c as any).db;
  const token = extractToken(c);
  if (token) {
    await destroySession(token, db);
  }
  return c.json(LogoutResponse.parse({ ok: true }));
});

export default router;