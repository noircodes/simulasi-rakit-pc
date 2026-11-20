import { LOOKUPS_PER_HOUR, allowLookup, kv } from "../cache";
import { findPart } from "../server-data";
import type { CategoryKey, Condition, MarketListing, MarketResult, Part } from "../types";
import { getMarketProvider } from "./apify-tokopedia";
import { ProviderBusyError } from "./provider";
import { buildSearchQuery, compact, relevanceRule } from "./query";
import { computeStats } from "./stats";

const RESULT_TTL = 3 * 24 * 3600;
/** Empty results are cached shorter so a later retry can still find listings. */
const EMPTY_TTL = 24 * 3600;
const RUN_TTL = 15 * 60;

export type LookupResponse =
  | { status: "disabled" }
  | { status: "miss"; query: string }
  | { status: "done"; result: MarketResult; cached: boolean }
  | { status: "running"; runId: string }
  | { status: "failed"; error: string }
  | { status: "limited"; error: string }
  /** too many runs at the provider right now; retry shortly */
  | { status: "busy" };

interface RunMeta {
  cacheKey: string;
  category: CategoryKey;
  partId: string;
  query: string;
  condition: Condition;
}

/**
 * Raw listings are cached, not the computed stats, so a change to the
 * relevance rules applies to cached searches without paying for a new run.
 */
interface CachedSearch {
  query: string;
  condition: Condition;
  fetchedAt: string;
  listings: MarketListing[];
}

export function cacheKeyFor(partId: string, condition: Condition, query: string): string {
  return `market:v2:${partId}:${condition}:${compact(query)}`;
}

function toResult(search: CachedSearch, part: Part): MarketResult {
  return {
    query: search.query,
    condition: search.condition,
    fetchedAt: search.fetchedAt,
    stats: computeStats(search.listings, relevanceRule(part)),
  };
}

/** 10 lookups x 10 listings x $0.0015 x 30 days = $4.50, inside the Apify free credit. */
export const DEFAULT_DAILY_LIMIT = 10;

function dailyLimit(): number {
  const n = Number(process.env.MARKET_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_LIMIT;
}

export interface LookupInput {
  category: CategoryKey;
  partId: string;
  condition: Condition;
  query?: string;
  /** only read the cache, never start a paid run */
  peek?: boolean;
  ip: string;
}

export async function lookup(input: LookupInput): Promise<LookupResponse> {
  const provider = getMarketProvider();
  if (!provider) return { status: "disabled" };

  const part = await findPart(input.category, input.partId);
  if (!part) return { status: "failed", error: "Komponen tidak ditemukan di katalog." };

  const query = input.query?.trim().slice(0, 100) || buildSearchQuery(part);
  const cacheKey = cacheKeyFor(part.id, input.condition, query);

  const cached = await kv.get<CachedSearch>(cacheKey);
  if (cached) return { status: "done", result: toResult(cached, part), cached: true };

  const inflight = await kv.get<string>(`${cacheKey}:run`);
  if (inflight) return { status: "running", runId: inflight };

  if (input.peek) return { status: "miss", query };

  if (!(await allowLookup(input.ip))) {
    return { status: "limited", error: `Batas cek harga tercapai (${LOOKUPS_PER_HOUR} per jam). Coba lagi nanti.` };
  }
  const dailyKey = `market:daily:${new Date().toISOString().slice(0, 10)}`;
  if (((await kv.get<number>(dailyKey)) ?? 0) >= dailyLimit()) {
    return { status: "limited", error: "Kuota cek harga hari ini sudah habis. Harga bisa diisi manual." };
  }

  let runId: string;
  try {
    runId = await provider.start({ query, condition: input.condition });
  } catch (err) {
    if (err instanceof ProviderBusyError) return { status: "busy" };
    throw err;
  }
  // Only runs that actually started count against the daily quota.
  await kv.incr(dailyKey, 26 * 3600);
  const meta: RunMeta = { cacheKey, category: part.category, partId: part.id, query, condition: input.condition };
  await kv.set(`market:run:${runId}`, meta, RUN_TTL);
  await kv.set(`${cacheKey}:run`, runId, RUN_TTL);
  return { status: "running", runId };
}

export async function pollRun(runId: string): Promise<LookupResponse | null> {
  const provider = getMarketProvider();
  if (!provider) return { status: "disabled" };

  const meta = await kv.get<RunMeta>(`market:run:${runId}`);
  if (!meta) return null;

  const part = await findPart(meta.category, meta.partId);
  if (!part) return { status: "failed", error: "Komponen tidak ditemukan di katalog." };

  const cached = await kv.get<CachedSearch>(meta.cacheKey);
  if (cached) return { status: "done", result: toResult(cached, part), cached: true };

  const state = await provider.poll(runId);
  if (state.status === "running") return { status: "running", runId };
  if (state.status === "failed") {
    await kv.del(`${meta.cacheKey}:run`);
    return { status: "failed", error: `Pencarian Tokopedia gagal (${state.error}).` };
  }

  const search: CachedSearch = {
    query: meta.query,
    condition: meta.condition,
    fetchedAt: new Date().toISOString(),
    listings: state.listings,
  };
  const result = toResult(search, part);
  await kv.set(meta.cacheKey, search, result.stats ? RESULT_TTL : EMPTY_TTL);
  await kv.del(`${meta.cacheKey}:run`);
  return { status: "done", result, cached: false };
}
