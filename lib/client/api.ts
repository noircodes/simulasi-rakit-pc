import type { LookupResponse } from "../market/service";
import type { CategoryKey, Condition, Part } from "../types";

export type { LookupResponse };

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok && res.status !== 429) {
    throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchParts(category: CategoryKey): Promise<Part[]> {
  const res = await fetch(`/api/parts/${category}`);
  return (await json<{ parts: Part[] }>(res)).parts;
}

export interface LookupRequest {
  category: CategoryKey;
  partId: string;
  condition: Condition;
  query?: string;
  peek?: boolean;
}

export async function marketLookup(req: LookupRequest): Promise<LookupResponse> {
  const res = await fetch("/api/market-price", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return json<LookupResponse>(res);
}

export async function marketPoll(runId: string): Promise<LookupResponse> {
  return json<LookupResponse>(await fetch(`/api/market-price/${runId}`));
}
