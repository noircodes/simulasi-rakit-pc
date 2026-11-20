import type { MarketListing, MarketStats } from "../types";
import { matchesRule, type RelevanceRule } from "./query";

export const LISTINGS_SHOWN = 5;

export function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Drops prices outside 1.5 x IQR. Needs at least 4 points to be meaningful. */
export function withoutOutliers(prices: number[]): number[] {
  const sorted = [...prices].sort((a, b) => a - b);
  if (sorted.length < 4) return sorted;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const fence = 1.5 * (q3 - q1);
  return sorted.filter((p) => p >= q1 - fence && p <= q3 + fence);
}

export function computeStats(listings: MarketListing[], rule: RelevanceRule): MarketStats | null {
  const relevant = listings.filter((l) => l.priceIdr > 0 && matchesRule(l.title, rule));
  const kept = withoutOutliers(relevant.map((l) => l.priceIdr));
  if (!kept.length) return null;

  const min = kept[0];
  const max = kept[kept.length - 1];
  const mid = median(kept);
  const shown = relevant
    .filter((l) => l.priceIdr >= min && l.priceIdr <= max)
    .sort((a, b) => a.priceIdr - b.priceIdr)
    .slice(0, LISTINGS_SHOWN);

  return { median: mid, min, max, count: kept.length, totalFound: listings.length, listings: shown };
}
