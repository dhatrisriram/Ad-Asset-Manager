import { createMockAdapter } from "./factory";
import type { PlatformAdapter } from "./types";

/**
 * Plug-and-play registry. Adding a new platform = add an entry here.
 * No other file needs to change.
 */
const adapters: PlatformAdapter[] = [
  createMockAdapter({
    key: "meta",
    name: "Meta (Facebook & Instagram)",
    category: "social",
    authType: "oauth",
    supportedCreatives: ["image", "video", "text", "carousel"],
    textLimit: 2200,
    brandColor: "#1877F2",
    rateLimitPerSec: 5,
    reliability: 0.94,
    buildExternalUrl: (id) => `https://business.facebook.com/ads/manager/${id}`,
  }),
  createMockAdapter({
    key: "google_ads",
    name: "Google Ads",
    category: "search",
    authType: "oauth",
    supportedCreatives: ["text", "image", "video"],
    textLimit: 90,
    brandColor: "#4285F4",
    rateLimitPerSec: 10,
    reliability: 0.96,
    buildExternalUrl: (id) => `https://ads.google.com/aw/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "youtube",
    name: "YouTube Ads",
    category: "video",
    authType: "oauth",
    supportedCreatives: ["video"],
    textLimit: 100,
    brandColor: "#FF0000",
    rateLimitPerSec: 8,
    buildExternalUrl: (id) => `https://studio.youtube.com/ads/${id}`,
  }),
  createMockAdapter({
    key: "tiktok",
    name: "TikTok",
    category: "social",
    authType: "oauth",
    supportedCreatives: ["video", "image"],
    textLimit: 100,
    brandColor: "#FE2C55",
    rateLimitPerSec: 6,
    reliability: 0.9,
    buildExternalUrl: (id) => `https://ads.tiktok.com/i18n/perf/${id}`,
  }),
  createMockAdapter({
    key: "linkedin",
    name: "LinkedIn",
    category: "social",
    authType: "oauth",
    supportedCreatives: ["text", "image", "video", "carousel"],
    textLimit: 600,
    brandColor: "#0A66C2",
    rateLimitPerSec: 4,
    buildExternalUrl: (id) => `https://www.linkedin.com/campaignmanager/${id}`,
  }),
  createMockAdapter({
    key: "x",
    name: "X (Twitter)",
    category: "social",
    authType: "oauth",
    supportedCreatives: ["text", "image", "video"],
    textLimit: 280,
    brandColor: "#000000",
    rateLimitPerSec: 7,
    reliability: 0.88,
    buildExternalUrl: (id) => `https://ads.x.com/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "snapchat",
    name: "Snapchat",
    category: "social",
    authType: "oauth",
    supportedCreatives: ["image", "video"],
    textLimit: 80,
    brandColor: "#FFFC00",
    rateLimitPerSec: 5,
    buildExternalUrl: (id) => `https://ads.snapchat.com/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "pinterest",
    name: "Pinterest",
    category: "social",
    authType: "oauth",
    supportedCreatives: ["image", "video", "carousel"],
    textLimit: 500,
    brandColor: "#E60023",
    rateLimitPerSec: 6,
    buildExternalUrl: (id) => `https://ads.pinterest.com/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "reddit",
    name: "Reddit",
    category: "social",
    authType: "oauth",
    supportedCreatives: ["text", "image", "video"],
    textLimit: 300,
    brandColor: "#FF4500",
    rateLimitPerSec: 4,
    reliability: 0.85,
    buildExternalUrl: (id) => `https://ads.reddit.com/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "microsoft_ads",
    name: "Microsoft Advertising",
    category: "search",
    authType: "oauth",
    supportedCreatives: ["text", "image"],
    textLimit: 90,
    brandColor: "#00A4EF",
    rateLimitPerSec: 8,
    buildExternalUrl: (id) =>
      `https://ui.ads.microsoft.com/campaign/vnext/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "amazon_ads",
    name: "Amazon Ads",
    category: "marketplace",
    authType: "apikey",
    supportedCreatives: ["text", "image", "video"],
    textLimit: 150,
    brandColor: "#FF9900",
    rateLimitPerSec: 5,
    buildExternalUrl: (id) => `https://advertising.amazon.com/cm/${id}`,
  }),
  createMockAdapter({
    key: "quora",
    name: "Quora",
    category: "social",
    authType: "apikey",
    supportedCreatives: ["text", "image"],
    textLimit: 250,
    brandColor: "#B92B27",
    rateLimitPerSec: 3,
    reliability: 0.87,
    buildExternalUrl: (id) => `https://ads.quora.com/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "spotify",
    name: "Spotify",
    category: "video",
    authType: "oauth",
    supportedCreatives: ["video", "image"],
    textLimit: 90,
    brandColor: "#1DB954",
    rateLimitPerSec: 4,
    buildExternalUrl: (id) => `https://ads.spotify.com/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "whatsapp",
    name: "WhatsApp Business",
    category: "messaging",
    authType: "apikey",
    supportedCreatives: ["text", "image"],
    textLimit: 1024,
    brandColor: "#25D366",
    rateLimitPerSec: 2,
    reliability: 0.93,
    buildExternalUrl: (id) => `https://business.whatsapp.com/broadcasts/${id}`,
  }),
  createMockAdapter({
    key: "threads",
    name: "Threads",
    category: "social",
    authType: "oauth",
    supportedCreatives: ["text", "image", "video"],
    textLimit: 500,
    brandColor: "#000000",
    rateLimitPerSec: 5,
    reliability: 0.84,
    buildExternalUrl: (id) => `https://www.threads.net/campaigns/${id}`,
  }),
  createMockAdapter({
    key: "telegram",
    name: "Telegram",
    category: "messaging",
    authType: "apikey",
    supportedCreatives: ["text", "image", "video"],
    textLimit: 4096,
    brandColor: "#26A5E4",
    rateLimitPerSec: 6,
    buildExternalUrl: (id) => `https://promote.telegram.org/campaigns/${id}`,
  }),
];

const adapterMap = new Map(adapters.map((a) => [a.key, a]));

export function listAdapters(): PlatformAdapter[] {
  return adapters;
}

export function getAdapter(key: string): PlatformAdapter | undefined {
  return adapterMap.get(key);
}

/** For dynamic registration if a new adapter is loaded at runtime. */
export function registerAdapter(adapter: PlatformAdapter): void {
  adapters.push(adapter);
  adapterMap.set(adapter.key, adapter);
}
