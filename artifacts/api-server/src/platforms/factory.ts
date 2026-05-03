import type {
  PlatformAdapter,
  AuthType,
  CreativeType,
  PublishContext,
  PublishResult,
} from "./types";

/**
 * Default mock implementation factory.
 * Real adapters override `publish` and `testConnection`. The factory keeps the
 * scaffolding identical across platforms so adding a new one is a 5-line change.
 */
export function createMockAdapter(opts: {
  key: string;
  name: string;
  category: PlatformAdapter["category"];
  authType: AuthType;
  supportedCreatives: CreativeType[];
  textLimit: number;
  brandColor: string;
  rateLimitPerSec: number;
  reliability?: number;
  buildExternalUrl?: (id: string) => string;
}): PlatformAdapter {
  const reliability = opts.reliability ?? 0.92;

  return {
    key: opts.key,
    name: opts.name,
    category: opts.category,
    authType: opts.authType,
    supportedCreatives: opts.supportedCreatives,
    textLimit: opts.textLimit,
    brandColor: opts.brandColor,
    rateLimitPerSec: opts.rateLimitPerSec,
    reliability,

    async testConnection(_credentials) {
      const latency = 80 + Math.floor(Math.random() * 220);
      await new Promise((r) => setTimeout(r, Math.min(latency, 250)));
      return {
        ok: true,
        latencyMs: latency,
        message: `Connected to ${opts.name} API`,
      };
    },

    async publish(ctx: PublishContext): Promise<PublishResult> {
      const latency = 250 + Math.floor(Math.random() * 600);
      await new Promise((r) => setTimeout(r, latency));

      if (Math.random() > reliability) {
        const reasons = [
          "Creative rejected: policy violation",
          "Rate limit exceeded",
          "Invalid bid amount for objective",
          "Audience too narrow",
          "Temporary upstream error (502)",
        ];
        throw new Error(reasons[Math.floor(Math.random() * reasons.length)]!);
      }

      const externalId = `${opts.key}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const externalUrl = opts.buildExternalUrl?.(externalId) ?? null;

      // Mocked initial metrics — proportional to budget.
      const baseImpressions = Math.floor(
        ctx.budget * (40 + Math.random() * 60),
      );
      const ctr = 0.005 + Math.random() * 0.04;
      const clicks = Math.floor(baseImpressions * ctr);
      const spendPct = 0.05 + Math.random() * 0.2;

      return {
        externalId,
        externalUrl,
        response: {
          ok: true,
          objective: ctx.objective,
          delivery: "active",
          previewUrl: externalUrl,
          textLengthOk: ctx.creative.body.length <= opts.textLimit,
        },
        impressions: baseImpressions,
        clicks,
        spend: Math.round(ctx.budget * spendPct * 100) / 100,
      };
    },
  };
}
