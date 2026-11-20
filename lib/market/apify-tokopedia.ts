import type { MarketListing } from "../types";
import { ProviderBusyError, type MarketProvider, type MarketSearch, type RunState } from "./provider";

const API = "https://api.apify.com/v2";
const DEFAULT_ACTOR = "unnoted~tokopedia-product-search";
/** The actor bills per saved product, so this caps the cost of one lookup. */
export const MAX_ITEMS = 10;

interface ApifyItem {
  name?: string | null;
  price?: number | null;
  url?: string | null;
  shopName?: string | null;
  shopCity?: string | null;
  shopType?: string | null;
  soldCount?: number | null;
  rating?: number | null;
  isAd?: boolean | null;
}

export function toListing(item: ApifyItem): MarketListing | null {
  if (!item.name || typeof item.price !== "number") return null;
  return {
    title: item.name,
    priceIdr: item.price,
    url: item.url ?? null,
    shopName: item.shopName ?? null,
    shopCity: item.shopCity ?? null,
    shopType: item.shopType ?? null,
    soldCount: item.soldCount ?? null,
    rating: item.rating ?? null,
    isAd: Boolean(item.isAd),
  };
}

export class ApifyTokopediaProvider implements MarketProvider {
  readonly name = "tokopedia";

  constructor(
    private readonly token: string,
    private readonly actor: string = DEFAULT_ACTOR,
  ) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      if (res.status === 429 || body.includes("concurrent-runs-limit-exceeded")) throw new ProviderBusyError(body);
      throw new Error(`Apify ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async start(search: MarketSearch): Promise<string> {
    const input = {
      searchQueries: [search.query],
      condition: search.condition,
      sort: "relevance",
      maxItems: MAX_ITEMS,
      ...(search.priceMin ? { priceMin: Math.round(search.priceMin) } : {}),
      ...(search.priceMax ? { priceMax: Math.round(search.priceMax) } : {}),
    };
    const { data } = await this.call<{ data: { id: string } }>(`/acts/${this.actor}/runs?timeout=120`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data.id;
  }

  async poll(runId: string): Promise<RunState> {
    const { data } = await this.call<{ data: { status: string; defaultDatasetId: string } }>(
      `/actor-runs/${encodeURIComponent(runId)}`,
    );
    if (data.status === "READY" || data.status === "RUNNING") return { status: "running" };
    if (data.status !== "SUCCEEDED") return { status: "failed", error: `Run ${data.status.toLowerCase()}` };

    const items = await this.call<ApifyItem[]>(`/datasets/${data.defaultDatasetId}/items?clean=true&format=json`);
    return { status: "succeeded", listings: items.map(toListing).filter((l): l is MarketListing => l !== null) };
  }
}

export function getMarketProvider(): MarketProvider | null {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  return new ApifyTokopediaProvider(token, process.env.APIFY_ACTOR || DEFAULT_ACTOR);
}
