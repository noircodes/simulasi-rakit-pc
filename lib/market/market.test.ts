import { describe, expect, it } from "vitest";
import { airCooler, atxCase, b650, ddr4kit, ddr5kit, psu650, rtx5060, ryzen7600x, ssd990 } from "../fixtures";
import type { MarketListing } from "../types";
import { toListing } from "./apify-tokopedia";
import { buildSearchQuery, cleanName, matchesRule, relevanceRule } from "./query";
import { computeStats, median, withoutOutliers } from "./stats";

const listing = (title: string, priceIdr: number): MarketListing => ({
  title, priceIdr, url: null, shopName: null, shopCity: null, shopType: null, soldCount: null, rating: null, isAd: false,
});

const ssd = ssd990;

describe("buildSearchQuery", () => {
  it("builds marketplace-style terms", () => {
    expect(buildSearchQuery(ryzen7600x)).toBe("AMD Ryzen 5 7600X");
    expect(buildSearchQuery(ddr5kit)).toBe("Corsair Vengeance 32GB DDR5");
    expect(buildSearchQuery(rtx5060)).toBe("MSI RTX 5060 Ventus 2X OC 8GB");
    expect(buildSearchQuery(ssd)).toBe("Samsung 990 Pro 2TB");
    expect(buildSearchQuery(psu650)).toBe("MSI MAG A650BN 650W");
    expect(buildSearchQuery(atxCase)).toBe("Montech XR");
    expect(buildSearchQuery(airCooler)).toBe("Thermalright Peerless Assassin 120 SE");
  });

  it("strips OpenDB retail noise from names", () => {
    expect(cleanName("Intel Core i5 6400T OEM/Tray")).toBe("Intel Core i5 6400T");
    expect(cleanName("Intel Xeon E5-1660 3.3 GHz 6-Core LGA2011")).toBe("Intel Xeon E5-1660");
    expect(cleanName("Fractal Design Define 7 ATX Mid Tower White Tempered Glass")).toBe("Fractal Design Define 7");
    expect(cleanName("Antec Earthwatts 550W 80+ Bronze Certified Non-Modular")).toBe("Antec Earthwatts 550W");
    expect(cleanName("Deepcool GAMMAXX Water 240mm A-RGB 69.34 CFM White")).toBe("Deepcool GAMMAXX A-RGB");
    expect(cleanName("Cougar DarkBlader-G ATX Full Tower Black / Silver with Tempered Glass Side Panel")).toBe("Cougar DarkBlader-G");
  });
});

describe("relevance", () => {
  it("keeps the exact CPU and drops sibling models and bundles", () => {
    const rule = relevanceRule(ryzen7600x);
    expect(matchesRule("Processor AMD Ryzen 5 7600X 4.7GHz AM5 Box", rule)).toBe(true);
    expect(matchesRule("AMD RYZEN 5 7600X3D", rule)).toBe(false);
    expect(matchesRule("Paket Bundling Ryzen 5 7600X + B650", rule)).toBe(false);
  });

  it("drops Ti/SUPER variants and other brands for GPUs", () => {
    const rule = relevanceRule(rtx5060);
    expect(matchesRule("VGA MSI GeForce RTX5060 Ventus 2X OC 8GB", rule)).toBe(true);
    expect(matchesRule("MSI RTX 5060 Ti Ventus 2X 16GB", rule)).toBe(false);
    expect(matchesRule("Zotac RTX 5060 Twin Edge", rule)).toBe(false);
  });

  it("matches RAM by generation, series and capacity", () => {
    const rule = relevanceRule(ddr5kit);
    expect(matchesRule("Corsair Vengeance RGB DDR5 32GB (2x16GB) 6000MHz", rule)).toBe(true);
    expect(matchesRule("Corsair Vengeance DDR5 2x16 6000", rule)).toBe(true);
    expect(matchesRule("Corsair Vengeance DDR4 32GB 3200", rule)).toBe(false);
  });

  it("matches storage by model and capacity", () => {
    const rule = relevanceRule(ssd);
    expect(matchesRule("SSD Samsung 990 PRO 2TB NVMe M.2", rule)).toBe(true);
    expect(matchesRule("SSD Samsung 990 PRO 1TB NVMe M.2", rule)).toBe(false);
  });
});

describe("whole-word model matching (titles from live Tokopedia results)", () => {
  it("does not take the mATX B650M for the ATX B650", () => {
    const rule = relevanceRule(b650);
    expect(matchesRule("MSI B650M GAMING PLUS WIFI - AM5 B650 DDR5 Motherboard", rule)).toBe(false);
    expect(matchesRule("MSI B650M GAMING PLUS WiFi - [Socket AM5, USB C m-ATX]", rule)).toBe(false);
    expect(matchesRule("MSI B650 GAMING PLUS WIFI AM5 ATX", rule)).toBe(true);
  });

  it("requires the full RAM product line", () => {
    const lpx = { ...ddr4kit, name: "Corsair Vengeance LPX 16 GB" };
    const rule = relevanceRule(lpx);
    expect(buildSearchQuery(lpx)).toBe("Corsair Vengeance LPX 16GB DDR4");
    expect(matchesRule("CORSAIR Vengeance LPX 16GB (2x8GB) DDR4 3200Mhz", rule)).toBe(true);
    expect(matchesRule("Corsair Vengeance RGB PRO 8GB 16GB 32GB DDR4 3000 3200", rule)).toBe(false);
  });

  it("still matches model numbers glued to a prefix", () => {
    expect(matchesRule("VGA MSI RTX5060 Ventus 2X OC", relevanceRule(rtx5060))).toBe(true);
    expect(matchesRule("VGA MSI RTX5060Ti Ventus 2X OC", relevanceRule(rtx5060))).toBe(false);
  });
});

describe("default rule", () => {
  it("pairs the model number with a series word", () => {
    const rule = relevanceRule(airCooler);
    expect(rule.all).toEqual(["120", "peerless"]);
    expect(matchesRule("Thermalright Peerless Assassin 120 SE ARGB", rule)).toBe(true);
    expect(matchesRule("Thermalright Assassin King 120", rule)).toBe(false);
  });
});

describe("stats", () => {
  it("computes median for odd and even counts", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
  });

  it("removes outliers", () => {
    expect(withoutOutliers([100, 102, 104, 106, 500])).toEqual([100, 102, 104, 106]);
  });

  it("summarizes relevant listings only", () => {
    const rule = relevanceRule(ryzen7600x);
    const stats = computeStats(
      [
        listing("AMD Ryzen 5 7600X Box", 3_200_000),
        listing("AMD Ryzen 5 7600X Tray", 3_000_000),
        listing("Ryzen 5 7600X garansi resmi", 3_400_000),
        listing("Ryzen 5 7600X murah", 3_100_000),
        listing("Ryzen 5 7600X dus kosong", 50_000),
        listing("Cooler for Ryzen 7600", 200_000),
      ],
      rule,
    );
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(4);
    expect(stats!.median).toBe(3_150_000);
    expect(stats!.min).toBe(3_000_000);
    expect(stats!.totalFound).toBe(6);
  });

  it("returns null when nothing is relevant", () => {
    expect(computeStats([listing("Something else", 1000)], relevanceRule(ryzen7600x))).toBeNull();
  });
});

describe("toListing", () => {
  it("maps actor rows and rejects incomplete ones", () => {
    expect(toListing({ name: "X", price: 1000, shopCity: "Jakarta Pusat", isAd: true })).toMatchObject({
      title: "X", priceIdr: 1000, shopCity: "Jakarta Pusat", isAd: true,
    });
    expect(toListing({ name: "X", price: null })).toBeNull();
  });
});
