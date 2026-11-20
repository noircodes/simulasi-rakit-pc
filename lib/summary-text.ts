import { CATEGORIES } from "./categories";
import { buildTotal, formatIdr, itemTotal, unpricedCount } from "./pricing";
import type { Build } from "./types";

const SOURCE_LABEL = { tokopedia: "Tokopedia", manual: "manual" } as const;

/** Plain-text build summary for pasting into chat or a marketplace message. */
export function buildSummaryText(build: Build, link?: string): string {
  const lines = ["Rakitan PC", ""];
  for (const cat of CATEGORIES) {
    const item = build[cat.key];
    if (!item) continue;
    const qty = item.qty > 1 ? ` x${item.qty}` : "";
    const cond = item.condition === "used" ? "bekas" : "baru";
    const total = itemTotal(item);
    const price = item.price && total !== null ? `${formatIdr(total)} [${SOURCE_LABEL[item.price.source]}]` : "belum ada harga";
    lines.push(`${cat.label}: ${item.part.name}${qty} (${cond}) ${price}`);
  }
  const missing = unpricedCount(build);
  lines.push("", `Total: ${formatIdr(buildTotal(build))}${missing ? ` (${missing} komponen belum ada harga)` : ""}`);
  if (link) lines.push(link);
  return lines.join("\n");
}
