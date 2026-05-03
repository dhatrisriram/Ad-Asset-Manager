import pino from "pino";

// Cloudflare Workers environment handling
const isProduction = typeof process !== "undefined" && process.env.NODE_ENV === "production";

export const logger = pino({
  level: typeof process !== "undefined" ? process.env.LOG_LEVEL ?? "info" : "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
});
