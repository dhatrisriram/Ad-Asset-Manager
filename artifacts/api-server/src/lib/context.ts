import type { Context } from "hono";

/**
 * Get the database instance from Hono context.
 * Used in all route handlers to access D1.
 */
export function getDb(c: Context): any {
  return (c as any).db;
}

/**
 * Get the Cloudflare environment bindings from Hono context.
 */
export function getEnv(c: Context): any {
  return c.env;
}
