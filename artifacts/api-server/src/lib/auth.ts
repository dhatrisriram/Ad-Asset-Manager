import { eq, and, sql } from "drizzle-orm";
import type { Context } from "hono";
import { usersTable, sessionsTable, type User } from "@workspace/db";

const SESSION_DAYS = 30;

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// Use Web Crypto API (available in Cloudflare Workers)
async function hashPassword(password: string): Promise<string> {
  const secret = typeof process !== "undefined"
    ? process.env["SESSION_SECRET"] ?? "dev-secret"
    : "dev-secret";

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { hashPassword };

export function generateToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(userId: string, db: any): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(sessionsTable).values({ token, userId, expiresAt });
  return token;
}

export async function destroySession(token: string, db: any): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const candidateHash = await hashPassword(password);
  const a = new TextEncoder().encode(candidateHash);
  const b = new TextEncoder().encode(hash);
  return timingSafeEqual(a, b);
}

export async function getUserFromToken(
  token: string | undefined,
  db: any,
): Promise<User | null> {
  if (!token) return null;
  const nowIso = new Date().toISOString();
  const rows = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionsTable.token, token),
        sql`${sessionsTable.expiresAt} > ${nowIso}`,
      ),
    )
    .limit(1);
  return rows[0]?.user ?? null;
}

export interface AuthedContext extends Context {
  get user(): User;
}

export async function findOrCreateUser(opts: {
  email: string;
  password: string;
  name?: string;
  db: any;
}): Promise<User> {
  const email = opts.email.toLowerCase().trim();
  const existing = await opts.db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing[0]) return existing[0];

  const passwordHash = await hashPassword(opts.password);
  const [created] = await opts.db
    .insert(usersTable)
    .values({
      email,
      name: opts.name ?? email.split("@")[0]!,
      passwordHash,
    })
    .returning();
  return created!;
}

function extractToken(c: Context): string | undefined {
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return (c as any).cookie?.("adshub_token");
}

export async function requireAuth(c: Context, next: () => Promise<void>): Promise<Response | void> {
  const token = extractToken(c);
  const db = (c as any).db;
  const user = await getUserFromToken(token, db);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  (c as any).user = user;
  await next();
}
