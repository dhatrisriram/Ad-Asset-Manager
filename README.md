# AdsHub — Unified Social Media Ads Platform

A single dashboard to connect 16 ad networks, draft creatives once, publish across them all, and track results in one place.

Marketing teams juggling multiple ad networks end up re-doing the same campaign setup 16 times over and lose visibility across platforms. AdsHub unifies creation, publishing, and tracking into a single dashboard.

Built on a free-tier stack today, with each component chosen to map 1:1 onto a production-grade managed service — no rewrite needed to scale.

## Tech Stack & Cloudflare Primitives

This project maps directly to Cloudflare's ecosystem for production, as required:

| Concern             | Implementation                 |
| ------------------- | ------------------------------ |
| Edge Runtime        | Cloudflare Workers (via Hono)  |
| Relational Store    | Cloudflare D1 (via Drizzle)    |
| Hot Cache           | Cloudflare KV                  |
| Job Queue           | Cloudflare Queues              |
| Object Storage      | Cloudflare R2                  |
| Frontend Hosting    | Cloudflare Pages               |
| Validation          | Zod (Shared Client/Server)     |


## Features shipped

- **Auth** — passwordless-style: any email/password creates an account on first login (demo: `demo@adshub.app` / `demo`).
- **16 platforms** — Meta, Google Ads, YouTube, TikTok, LinkedIn, X, Snapchat, Pinterest, Reddit, Microsoft, Amazon, Quora, Spotify, WhatsApp, Threads, Telegram. Each has its own adapter file (`artifacts/api-server/src/adapters/`) — adding #17 is one file.
- **Connection manager** — Connect / disconnect / live test every platform. Catalog page shows brand colors, supported creatives, and per-platform character limits.
- **Campaign wizard** — Multi-platform select, AI ad-copy generation, AI budget allocation, per-platform character validation, schedule or publish immediately.
- **Cross-platform publishing** — Job per platform queued through the in-process worker. Exponential back-off, max 3 attempts, per-platform rate limiting. Campaign auto-reconciles to `live` / `partial` / `failed` based on job results.
- **Job control** — Retry failed jobs, duplicate campaigns, delete, and view a per-campaign activity log that refreshes every 3s.
- **Media library** — URL-based asset registry with type/dimension metadata.
- **Audit log** — Filterable, level-tagged event stream (info / warn / error) with platform context.
- **Dashboard** — Spend, impressions, clicks, success rate, spend-by-platform bar chart, status-breakdown pie, per-platform CTR & success table, recent activity feed. Refreshes every 5s.

## Repo layout

```
artifacts/
  api-server/        # Express API, adapters, queue, auth
  ads-platform/      # React + Vite + wouter SPA (the dashboard)
  mockup-sandbox/    # Component preview (Replit canvas)
lib/
  api-spec/          # OpenAPI source of truth → Orval codegen
  api-zod/           # Zod schemas shared between server and client
  api-client-react/  # Generated React Query hooks
  db/                # Drizzle schema + migrations
```

## Local commands

```bash
pnpm --filter @workspace/api-server run dev    # API on :8080
pnpm --filter @workspace/ads-platform run dev  # Web on $PORT
pnpm --filter @workspace/db run push           # Push schema changes
pnpm --filter @workspace/api-spec run codegen  # Regenerate API hooks + zod
pnpm run typecheck                             # Full repo typecheck
```

## Architecture flow

```
┌──────────────┐   POST /campaigns          ┌─────────────────┐
│  React SPA   │ ─────────────────────────► │  Express API    │
│  (ads-       │                            │  + Zod validate │
│   platform)  │ ◄───── React Query ─────── │                 │
└──────────────┘                            └────────┬────────┘
                                                     │ enqueue job
                                                     ▼
                                            ┌─────────────────┐
                                            │ In-proc Queue   │  ←  Cloudflare Queues
                                            │ exp. backoff    │
                                            └────────┬────────┘
                                                     │ adapter.publish()
                                                     ▼
                                            ┌─────────────────┐
                                            │ Platform        │
                                            │ Adapter (×16)   │  ←  Mock; swap for real SDKs
                                            └────────┬────────┘
                                                     │ result
                                                     ▼
                                            ┌─────────────────┐
                                            │ Postgres (jobs, │  ←  D1
                                            │ campaigns,      │
                                            │ audit log)      │
                                            └────────┬────────┘
                                                     │ reconcile
                                                     ▼
                                                campaign.status
```

## Design choices

- **OpenAPI as source of truth.** Server, Zod schemas, and React Query hooks are all generated. Adding an endpoint is: edit one YAML, rerun codegen, write the route.
- **Adapter pattern.** Each platform exposes `publish`, `testConnection`, `validateCreative`. Mock adapters simulate latency, failure rates, and policy rejections — easy to swap for real SDKs.
- **Optimistic in-memory KV** for catalog and platform credentials; values are tagged with TTL and treated as best-effort cache.
- **No silent fallbacks.** Failed publish jobs surface in the campaign view with the failure reason and a Retry button.

## Demo

Login with any email + password (e.g. `demo@adshub.app` / `demo`) → connect a couple of platforms → New campaign → pick targets → Generate copy → Publish immediately → watch the campaign reconcile to `live` and the dashboard refresh.
