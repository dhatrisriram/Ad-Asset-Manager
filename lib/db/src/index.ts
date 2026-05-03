import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * For Cloudflare Workers, the D1 database is injected via env.DB binding.
 * This function should be called from worker context with the D1 binding.
 */
export function initDb(db: D1Database) {
  return drizzle(db, { schema });
}

/**
 * Type export for use in routes
 */
export type Db = ReturnType<typeof initDb>;

export * from "./schema";
