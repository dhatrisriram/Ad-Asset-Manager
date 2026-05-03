/**
 * Platform Integration Layer — plug-and-play adapter contract.
 *
 * Every supported ad network implements this interface. Adding a new platform
 * is purely additive: drop a new file in `./adapters/`, export a `PlatformAdapter`,
 * register it in `./registry.ts`. No changes to routes or DB are required.
 *
 * In production this contract maps 1:1 onto Cloudflare Workers (each adapter
 * could be its own Service Binding) — credentials would live in KV
 * (referenced by `credentialsRef`), and `publish` would be invoked from a
 * Queue consumer.
 */

export type CreativeType = "image" | "video" | "text" | "carousel";
export type AuthType = "oauth" | "apikey";

export interface CreativePayload {
  type: CreativeType;
  headline: string;
  body: string;
  callToAction?: string | null;
  mediaUrl?: string | null;
}

export interface PublishContext {
  campaignId: string;
  campaignTitle: string;
  objective: string;
  budget: number;
  currency: string;
  targetPlatforms: string[];
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  creative: CreativePayload;
  /** Stored credentials, looked up via the credentials reference (KV in prod). */
  credentials: Record<string, unknown>;
}

export interface PublishResult {
  externalId: string;
  externalUrl?: string | null;
  response: Record<string, unknown>;
  /** Initial reported metrics from the platform (mocked). */
  impressions: number;
  clicks: number;
  spend: number;
}

export interface PlatformAdapter {
  /** Stable machine identifier — matches catalog `key`. */
  key: string;
  /** Human-readable name. */
  name: string;
  /** Grouping in the integrations UI. */
  category: "social" | "search" | "video" | "messaging" | "marketplace";
  authType: AuthType;
  supportedCreatives: CreativeType[];
  /** Per-platform copy length cap. */
  textLimit: number;
  /** Brand color (hex) — used to accent UI cards. */
  brandColor: string;
  /** Per-platform rate limit, requests/sec. Enforced by the queue worker. */
  rateLimitPerSec: number;
  /** Probability the mocked publish call succeeds. */
  reliability: number;
  /** Validate credentials. */
  testConnection(credentials: Record<string, unknown>): Promise<{
    ok: boolean;
    latencyMs: number;
    message: string;
  }>;
  /** Publish a creative to the platform — returns the platform's response. */
  publish(ctx: PublishContext): Promise<PublishResult>;
}
