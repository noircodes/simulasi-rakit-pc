import { isCategoryKey } from "./categories";
import type { CategoryKey, Condition, ItemPrice, PriceSource } from "./types";

/**
 * Compact build snapshot for share links. Parts are referenced by catalog id;
 * prices are snapshotted so the receiver sees the same total.
 */
export interface SharedItem {
  id: string;
  c: Condition;
  q: number;
  /** price snapshot: [amountIdr, source, listingUrl?] */
  p?: [number, PriceSource, string?];
}

export type SharedBuild = Partial<Record<CategoryKey, SharedItem>>;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export function encodeBuild(build: SharedBuild): string {
  return toBase64Url(JSON.stringify(build));
}

const SOURCES: PriceSource[] = ["tokopedia", "manual"];

export function decodeBuild(encoded: string): SharedBuild | null {
  try {
    const raw = JSON.parse(fromBase64Url(encoded)) as Record<string, unknown>;
    const out: SharedBuild = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!isCategoryKey(key) || !value || typeof value !== "object") continue;
      const v = value as Partial<SharedItem>;
      if (typeof v.id !== "string") continue;
      const item: SharedItem = {
        id: v.id,
        c: v.c === "used" ? "used" : "new",
        q: Number.isInteger(v.q) && v.q! >= 1 && v.q! <= 4 ? v.q! : 1,
      };
      if (Array.isArray(v.p) && typeof v.p[0] === "number" && v.p[0] >= 0 && SOURCES.includes(v.p[1])) {
        const url = typeof v.p[2] === "string" && v.p[2].startsWith("https://") ? v.p[2] : undefined;
        item.p = [Math.round(v.p[0]), v.p[1], url];
      }
      out[key] = item;
    }
    return out;
  } catch {
    return null;
  }
}

export function snapshotPrice(price: ItemPrice | null): SharedItem["p"] {
  if (!price) return undefined;
  return price.listingUrl ? [price.amountIdr, price.source, price.listingUrl] : [price.amountIdr, price.source];
}

export function priceFromSnapshot(p: SharedItem["p"]): ItemPrice | null {
  if (!p) return null;
  return { amountIdr: p[0], source: p[1], ...(p[2] ? { listingUrl: p[2] } : {}) };
}
