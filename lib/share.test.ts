import { describe, expect, it } from "vitest";
import { brandOf, hashId, normalizeCatalog } from "./catalog";
import { buildTotal, formatIdr, itemTotal, unpricedCount } from "./pricing";
import { decodeBuild, encodeBuild } from "./share";
import { ddr5kit, ryzen7600x } from "./fixtures";

describe("share", () => {
  it("round-trips a build", () => {
    const build = {
      cpu: { id: "abc", c: "new" as const, q: 1, p: [3_150_000, "tokopedia", "https://www.tokopedia.com/x"] as [number, "tokopedia", string] },
      memory: { id: "def", c: "used" as const, q: 2 },
    };
    expect(decodeBuild(encodeBuild(build))).toEqual(build);
  });

  it("rejects garbage and sanitizes fields", () => {
    expect(decodeBuild("%%%")).toBeNull();
    const evil = encodeBuild({ cpu: { id: "a", c: "x", q: 99, p: [1, "tokopedia", "javascript:alert(1)"] }, nope: { id: "b" } } as never);
    expect(decodeBuild(evil)).toEqual({ cpu: { id: "a", c: "new", q: 1, p: [1, "tokopedia", undefined] } });
  });
});

describe("pricing", () => {
  it("formats rupiah", () => {
    expect(formatIdr(1234000).replace(/\s/g, " ")).toBe("Rp 1.234.000");
  });

  it("sums priced items only and counts the unpriced ones", () => {
    const build = {
      cpu: { part: ryzen7600x, condition: "new" as const, qty: 1, price: { amountIdr: 3_000_000, source: "tokopedia" as const } },
      memory: { part: ddr5kit, condition: "new" as const, qty: 2, price: { amountIdr: 1_500_000, source: "manual" as const } },
      "video-card": undefined,
      motherboard: { part: ddr5kit as never, condition: "used" as const, qty: 1, price: null },
    };
    expect(buildTotal(build)).toBe(3_000_000 + 2 * 1_500_000);
    expect(unpricedCount(build)).toBe(1);
    expect(itemTotal(build.motherboard)).toBeNull();
  });
});

describe("catalog", () => {
  it("detects multi-word brands", () => {
    expect(brandOf("Western Digital WD_Black SN850X")).toBe("Western Digital");
    expect(brandOf("Corsair RM750e")).toBe("Corsair");
  });

  it("normalizes rows, drops unpriced ones, dedupes by cheapest", () => {
    const parts = normalizeCatalog("power-supply", [
      { name: "Corsair RM750e", price: 99.99, wattage: 750, efficiency: "gold", modular: "Full", color: "Black" },
      { name: "Corsair RM750e", price: 89.99, wattage: 750, efficiency: "gold", modular: "Full", color: "Black" },
      { name: "No Price PSU", price: null, wattage: 500 },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ priceUsd: 89.99, wattage: 750, id: hashId("psu|Corsair RM750e|750|Black") });
  });
});
