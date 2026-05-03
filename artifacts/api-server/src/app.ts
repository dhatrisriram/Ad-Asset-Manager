import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import router from "./routes";
import { logger } from "./lib/logger";
import { initDb } from "../../../lib/db/src/index";
import { initKV } from "./lib/kv";

interface Env {
  DB: D1Database;
  KV_CACHE: KVNamespace;
  PUBLISH_QUEUE: Queue<any>;
  SESSION_SECRET: string;
}

type HonoEnv = {
  Bindings: Env;
};

const app = new Hono<HonoEnv>();

// Inject KV and DB into context on each request
app.use("*", async (c, next) => {
  // 1. Fallback for SESSION_SECRET (Prevents the crash after DB insert)
  if (!c.env.SESSION_SECRET) {
    c.env.SESSION_SECRET = "temp_secret_for_demo_123";
  }

  // 2. Initialize KV
  if (c.env?.KV_CACHE) {
    initKV(c.env.KV_CACHE);
  }
  
  // 3. Inject initialized DB instance
  if (c.env?.DB) {
    try {
      // Ensure we are assigning the initialized DB to the context correctly
      (c as any).db = initDb(c.env.DB);
    } catch (err) {
      console.error("DB Init Error:", err);
    }
  }
  
  await next();
});

// Logging middleware
app.use("*", (c, next) => {
  const startTime = Date.now();
  return next().then(() => {
    const duration = Date.now() - startTime;
    logger.info({
      method: c.req.method,
      url: c.req.url.split("?")[0],
      status: c.res.status,
      duration,
    });
  });
});

// CORS middleware
// 1. Bulletproof CORS middleware
app.use(
  "*",
  cors({
    origin: (origin) => origin, // Dynamically accepts the incoming URL (no string matching issues)
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "Accept"],
    exposeHeaders: ["Set-Cookie"],
  })
);

// 2. Explicit Preflight Handler (This specifically fixes the 405 error!)
app.options("*", (c) => {
  return new Response("", { status: 204 });
});

app.route("/api", router);

export default app;
