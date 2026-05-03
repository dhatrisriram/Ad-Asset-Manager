/**
 * Cloudflare KV integration for platform credentials and config.
 * 
 * Maps to the KV_CACHE namespace binding in wrangler.toml.
 * The API matches Cloudflare KV namespace methods.
 */

interface KVNamespaceStub {
  get(key: string): Promise<string | null>;
  get(key: string, type: "json"): Promise<Record<string, unknown> | null>;
  put(
    key: string,
    value: string | Blob | ArrayBuffer | ArrayBufferView | ReadableStream<any>,
    options?: KVNamespacePutOptions,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<string>>;
}

// This will be initialized from the worker context
let kvNamespace: KVNamespaceStub | null = null;

export function initKV(kv: KVNamespaceStub) {
  kvNamespace = kv;
}

export const kv = {
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!kvNamespace) {
      throw new Error("KV namespace not initialized. Did you forget to call initKV()?");
    }
    try {
      const value = await kvNamespace.get(key, "json");
      return value as T | null;
    } catch (err) {
      // If not JSON, fall back to string
      const value = await kvNamespace.get(key);
      return value ? (JSON.parse(value) as T) : null;
    }
  },

  async put(
    key: string,
    value: unknown,
    options?: { ttlSeconds?: number },
  ): Promise<void> {
    if (!kvNamespace) {
      throw new Error("KV namespace not initialized. Did you forget to call initKV()?");
    }
    const expirationTtl = options?.ttlSeconds;
    await kvNamespace.put(key, JSON.stringify(value), { expirationTtl });
  },

  async delete(key: string): Promise<void> {
    if (!kvNamespace) {
      throw new Error("KV namespace not initialized. Did you forget to call initKV()?");
    }
    await kvNamespace.delete(key);
  },

  async keys(prefix: string): Promise<string[]> {
    if (!kvNamespace) {
      throw new Error("KV namespace not initialized. Did you forget to call initKV()?");
    }
    const result = await kvNamespace.list({ prefix });
    return result.keys.map((k: { name: string }) => k.name);
  },
};

export function credentialsKey(platformId: string): string {
  return `platform:credentials:${platformId}`;
}

export function configKey(platformKey: string): string {
  return `platform:config:${platformKey}`;
}

export function tokenKey(token: string): string {
  return `auth:token:${token}`;
}
