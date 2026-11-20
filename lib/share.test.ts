import { describe, expect, it } from "vitest";
import { normalizeCatalog, normalizePart } from "./catalog";
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

describe("catalog (BuildCores OpenDB records)", () => {
  const meta = (name: string, extra = {}) => ({ name, manufacturer: name.split(" ")[0], series: "S", releaseYear: 2025, ...extra });

  it("maps a CPU with socket, memory support and bundled cooler", () => {
    const cpu = normalizePart("cpu", {
      opendb_id: "7ab840c3", socket: "AM5", microarchitecture: "Zen 5",
      cores: { total: 8, threads: 16 }, clocks: { performance: { base: 4.7, boost: 5.2 } },
      specifications: { tdp: 120, includesCooler: false, integratedGraphics: { model: "AMD Radeon Graphics" }, memory: { types: ["DDR5"] } },
      metadata: meta("AMD Ryzen 7 9800X3D"),
    });
    expect(cpu).toMatchObject({ id: "7ab840c3", socket: "AM5", coreCount: 8, boostClock: 5.2, tdp: 120, memoryDdr: [5], includesCooler: false, graphics: "AMD Radeon Graphics", releaseYear: 2025 });
    const noIgpu = normalizePart("cpu", { opendb_id: "x", socket: "LGA 1700", specifications: { integratedGraphics: { model: "None" } }, metadata: meta("Intel Core i5 12400F") });
    expect(noIgpu).toMatchObject({ socket: "LGA1700", graphics: null });
  });

  it("maps boards, cases and coolers with normalized form factors and sockets", () => {
    expect(normalizePart("motherboard", { opendb_id: "m", socket: "LGA 1700", form_factor: "Mini-ITX", chipset: "Intel B760", memory: { max: 96, ram_type: "DDR5", slots: 2 }, metadata: meta("Asus ROG STRIX B760-I") }))
      .toMatchObject({ socket: "LGA1700", formFactor: "Mini ITX", ddr: 5, memorySlots: 2, maxMemory: 96 });
    expect(normalizePart("case", { opendb_id: "c", form_factor: "ATX Mid Tower", supported_motherboard_form_factors: ["ATX", "Micro ATX", "Mini-ITX"], max_video_card_length: 315, max_cpu_cooler_height: 170, metadata: meta("Fractal Design Meshify C") }))
      .toMatchObject({ supportedBoards: ["ATX", "Micro ATX", "Mini ITX"], maxGpuLength: 315, maxCoolerHeight: 170 });
    expect(normalizePart("cpu-cooler", { opendb_id: "k", water_cooled: false, height: 155, cpu_sockets: ["LGA 1700", "LGA 1151v2", "LGA 1151", "AM5"], metadata: meta("Thermalright Peerless Assassin") }))
      .toMatchObject({ waterCooled: false, height: 155, sockets: ["LGA1700", "LGA1151", "AM5"] });
  });

  it("uses OpenDB GPU power and falls back to the chipset table", () => {
    const g = (tdp?: number) => normalizePart("video-card", { opendb_id: "g", chipset: "GeForce RTX 4070", tdp, length: 242, metadata: meta("MSI RTX 4070") });
    expect(g(215)).toMatchObject({ tdp: 215, length: 242 });
    expect(g()).toMatchObject({ tdp: 200 });
  });

  it("drops laptop memory and incomplete records, sorts newest first", () => {
    expect(normalizePart("memory", { opendb_id: "r", ram_type: "DDR5", speed: 5600, form_factor: "262-pin SO-DIMM", modules: { quantity: 2, capacity_gb: 16 }, metadata: meta("Crucial 32GB") })).toBeNull();
    expect(normalizePart("power-supply", { opendb_id: "p", metadata: meta("No Wattage PSU") })).toBeNull();
    const parts = normalizeCatalog("power-supply", [
      { opendb_id: "old", wattage: 500, metadata: meta("Old PSU", { releaseYear: 2015 }) },
      { opendb_id: "new", wattage: 850, metadata: meta("New PSU", { releaseYear: 2026 }) },
      { opendb_id: "bad", wattage: 650, metadata: meta("Typo PSU", { releaseYear: 20117 }) },
    ]);
    expect(parts.map((p) => p.id)).toEqual(["new", "old", "bad"]);
    expect(parts[2].releaseYear).toBeNull();
  });
});
