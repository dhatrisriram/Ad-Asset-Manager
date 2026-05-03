import { Hono } from "hono";
import { HealthCheckResponse } from "@workspace/api-zod";

const router = new Hono();

router.get("/healthz", (c) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  return c.json(data);
});

export default router;
