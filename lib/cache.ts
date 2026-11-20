import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Key-value store for market lookups. Upstash Redis when configured,
 * otherwise a per-instance memory map (fine for local dev, lost on restart).
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  incr(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<void>;
}

// Vercel's Upstash integration may expose KV_REST_API_* instead of UPSTASH_REDIS_REST_*.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

class MemoryKV implements KV {
  private store = new Map<string, { value: unknown; expires: number }>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const hit = this.store.get(key);
    const next = current + 1;
    this.store.set(key, { value: next, expires: hit?.expires ?? Date.now() + ttlSeconds * 1000 });
    return next;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class RedisKV implements KV {
  constructor(private readonly client: Redis) {}

  get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { ex: ttlSeconds });
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, ttlSeconds);
    return n;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

const globalForKv = globalThis as unknown as { __kv?: KV };
export const kv: KV = globalForKv.__kv ?? (redis ? new RedisKV(redis) : new MemoryKV());
globalForKv.__kv = kv;

/** A full build is 6 to 8 lookups, plus condition switches. */
export const LOOKUPS_PER_HOUR = 20;

const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LOOKUPS_PER_HOUR, "1 h"), prefix: "rl:market" })
  : null;

/** Per-IP limit on paid lookups. */
export async function allowLookup(ip: string): Promise<boolean> {
  if (ratelimit) return (await ratelimit.limit(ip)).success;
  const n = await kv.incr(`rl:market:${ip}:${new Date().getUTCHours()}`, 3600);
  return n <= LOOKUPS_PER_HOUR;
}
