import type { Build, BuildItem } from "./types";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatIdr(amount: number): string {
  return idr.format(amount);
}

/** Line total, or null while the item has no Tokopedia or manual price yet. */
export function itemTotal(item: BuildItem): number | null {
  return item.price ? item.price.amountIdr * item.qty : null;
}

export function buildTotal(build: Build): number {
  return Object.values(build).reduce((sum, item) => sum + (item ? itemTotal(item) ?? 0 : 0), 0);
}

export function unpricedCount(build: Build): number {
  return Object.values(build).filter((item) => item && !item.price).length;
}
