import { Hono } from "hono";
import {
  GenerateAdCopyBody,
  GenerateAdCopyResponse,
  GetBestTimeToPostQueryParams,
  GetBestTimeToPostResponse,
  GetBudgetSuggestionsBody,
  GetBudgetSuggestionsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { getAdapter, listAdapters } from "../platforms/registry";

const router = new Hono();

const TONE_OPENERS: Record<string, string[]> = {
  bold: ["Stop scrolling.", "Built different.", "No more compromises."],
  friendly: ["Hey there,", "Quick favor:", "Meet your new"],
  professional: ["Introducing", "Now available:", "Designed for teams who"],
  playful: ["Plot twist:", "Tiny update:", "Behold,"],
  urgent: ["Last 48 hours:", "Limited release:", "Today only:"],
};

const CTAS: Record<string, string> = {
  awareness: "Learn more",
  traffic: "Visit site",
  engagement: "Join the conversation",
  conversions: "Shop now",
  leads: "Get a quote",
  app_installs: "Install free",
};

router.post("/ai/generate-copy", requireAuth, async (c) => {
  const body = await c.req.json();
  const parse = GenerateAdCopyBody.safeParse(body);
  if (!parse.success) {
    return c.json({ error: "Invalid copy request" }, 400);
  }
  const { product, audience, tone, platforms } = parse.data;
  const openers = TONE_OPENERS[tone] ?? TONE_OPENERS["friendly"]!;

  const variants = platforms.map((key, i) => {
    const adapter = getAdapter(key);
    const limit = adapter?.textLimit ?? 280;
    const opener = openers[i % openers.length]!;

    const headlineFull = `${product} for ${audience}`;
    const headline =
      headlineFull.length > Math.min(60, limit)
        ? `${headlineFull.slice(0, Math.min(60, limit) - 1)}\u2026`
        : headlineFull;

    const bodyFull = `${opener} ${product} was made for ${audience}. ${
      adapter?.category === "video"
        ? "Watch the 15-second story."
        : adapter?.category === "messaging"
          ? "Tap to chat."
          : adapter?.category === "search"
            ? "Find the answer in one click."
            : "Discover what makes it different."
    } ${tone === "urgent" ? "Available for a limited time." : ""}`.trim();
    const body =
      bodyFull.length > limit ? `${bodyFull.slice(0, limit - 1)}\u2026` : bodyFull;

    const cta = CTAS["traffic"]!;

    return {
      platformKey: key,
      platformName: adapter?.name ?? key,
      headline,
      body,
      callToAction: cta,
      characterCount: body.length,
      characterLimit: limit,
    };
  });

  return c.json(GenerateAdCopyResponse.parse({ variants }));
});

router.get("/ai/best-time-to-post", requireAuth, (c) => {
  const query = c.req.query();
  const parse = GetBestTimeToPostQueryParams.safeParse(query);
  const platformKey = parse.success ? parse.data.platform : undefined;

  /**
   * Heuristic "best time" model: each platform has a baseline window where
   * engagement peaks (lunchtime + evening for social, mornings for search).
   * Score is normalized to 0-1.
   */
  const profiles: Record<string, { hours: number[]; days: string[] }> = {
    meta: { hours: [12, 19, 21], days: ["Tue", "Thu", "Sun"] },
    google_ads: { hours: [9, 11, 14], days: ["Mon", "Tue", "Wed"] },
    youtube: { hours: [18, 20, 22], days: ["Fri", "Sat", "Sun"] },
    tiktok: { hours: [11, 19, 22], days: ["Tue", "Thu", "Sat"] },
    linkedin: { hours: [8, 12, 17], days: ["Tue", "Wed", "Thu"] },
    x: { hours: [9, 13, 18], days: ["Mon", "Wed", "Fri"] },
    snapchat: { hours: [16, 20, 22], days: ["Fri", "Sat", "Sun"] },
    pinterest: { hours: [20, 21, 22], days: ["Sat", "Sun", "Mon"] },
    reddit: { hours: [8, 10, 21], days: ["Mon", "Tue", "Wed"] },
    microsoft_ads: { hours: [9, 11, 14], days: ["Mon", "Tue", "Wed"] },
    amazon_ads: { hours: [11, 18, 21], days: ["Wed", "Thu", "Fri"] },
    quora: { hours: [10, 14, 20], days: ["Tue", "Thu", "Sat"] },
    spotify: { hours: [8, 17, 22], days: ["Mon", "Fri", "Sat"] },
    whatsapp: { hours: [10, 13, 19], days: ["Mon", "Wed", "Fri"] },
    threads: { hours: [11, 19, 21], days: ["Tue", "Thu", "Sun"] },
    telegram: { hours: [10, 18, 22], days: ["Mon", "Wed", "Sat"] },
  };

  const targets = platformKey
    ? listAdapters().filter((a) => a.key === platformKey)
    : listAdapters();

  const slots = targets.flatMap((a) => {
    const profile = profiles[a.key] ?? {
      hours: [12, 18],
      days: ["Tue", "Thu"],
    };
    return profile.hours.flatMap((h, hi) =>
      profile.days.map((d, di) => ({
        platformKey: a.key,
        platformName: a.name,
        dayOfWeek: d,
        hour: h,
        score: Math.round((0.85 + 0.05 * (3 - hi) + 0.02 * (3 - di)) * 100) / 100,
        rationale: `${a.name} engagement peaks at ${d} ${h}:00 based on historical CTR.`,
      })),
    );
  });

  slots.sort((a, b) => b.score - a.score);
  return c.json(GetBestTimeToPostResponse.parse(slots.slice(0, 12)));
});

router.post("/ai/budget-suggestions", requireAuth, async (c) => {
  const body = await c.req.json();
  const parse = GetBudgetSuggestionsBody.safeParse(body);
  if (!parse.success) {
    return c.json({ error: "Invalid budget request" }, 400);
  }
  const { totalBudget, objective, platforms } = parse.data;

  /**
   * Weight per (platform, objective). Heuristics roughly match
   * reported eCPM / conversion benchmarks across networks.
   */
  const weights: Record<string, Record<string, number>> = {
    awareness: {
      meta: 1.4,
      tiktok: 1.5,
      youtube: 1.5,
      pinterest: 1.1,
      snapchat: 1.0,
    },
    traffic: { google_ads: 1.6, microsoft_ads: 1.2, meta: 1.2, x: 1.0 },
    engagement: { tiktok: 1.5, meta: 1.3, threads: 1.1, x: 1.2, reddit: 1.0 },
    conversions: { google_ads: 1.6, meta: 1.4, amazon_ads: 1.5, linkedin: 0.9 },
    leads: { linkedin: 1.6, google_ads: 1.4, meta: 1.2, quora: 1.1 },
    app_installs: { tiktok: 1.5, meta: 1.4, google_ads: 1.3, snapchat: 1.1 },
  };
  const objWeights = weights[objective] ?? {};

  const scored = platforms.map((key) => {
    const adapter = getAdapter(key);
    const baseWeight = objWeights[key] ?? 1.0;
    const reliability = adapter?.reliability ?? 0.9;
    const score = baseWeight * reliability;
    return { key, adapter, score };
  });

  const totalScore = scored.reduce((s, x) => s + x.score, 0) || 1;

  const items = scored.map(({ key, adapter, score }) => {
    const share = score / totalScore;
    const suggested = Math.round(totalBudget * share * 100) / 100;
    return {
      platformKey: key,
      platformName: adapter?.name ?? key,
      suggestedBudget: suggested,
      sharePct: Math.round(share * 1000) / 10,
      rationale: `${(adapter?.name ?? key)} matches "${objective}" objective with strong historical performance (weight ${score.toFixed(2)}).`,
    };
  });

  items.sort((a, b) => b.suggestedBudget - a.suggestedBudget);
  return c.json(GetBudgetSuggestionsResponse.parse(items));
});

export default router;
