import { capacityLabel } from "../categories";
import type { Part } from "../types";

/**
 * Turns a catalog part into a Tokopedia search term plus a relevance rule
 * used to drop listings for other models, bundles and accessories.
 *
 * Model and series tokens (`all`) must appear as whole words, so B650 does not
 * match B650M and 5060 does not match 5060Ti, while RTX5060 still matches 5060.
 * Brand, capacity and exclusion tokens are matched on "compact" text
 * (lowercase, alphanumerics only), so "Paket Bundling" and "paketbundling" both hit.
 */
export interface RelevanceRule {
  /** every token must appear as a whole word */
  all: string[];
  /** each group needs at least one of its tokens */
  any: string[][];
  /** no token may appear */
  exclude: string[];
  /** no token may appear as a whole word (for siblings like B650M next to B650) */
  excludeWords?: string[];
}

const GLOBAL_EXCLUDE = [
  "laptop", "notebook", "rakitan", "fullset", "paket", "bundle", "bundling",
  // accessories and empty boxes that mention the model in their title
  "backplate", "bracket", "holder", "waterblock", "duskosong", "boxkosong", "sticker", "stiker", "thermalpad",
];
const STOP_WORDS = new Set(["wifi", "rgb", "argb", "edition", "black", "white", "the", "gaming", "plus", "pro"]);
const BRAND_ALIASES: Record<string, string[]> = {
  westerndigital: ["wd", "westerndigital"],
  teamgroup: ["team", "teamgroup"],
  coolermaster: ["coolermaster", "cm"],
};

export function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stripParens(text: string): string {
  return text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

function withoutBrand(part: Part): string {
  const name = stripParens(part.name);
  return name.toLowerCase().startsWith(part.brand.toLowerCase()) ? name.slice(part.brand.length).trim() : name;
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Words that carry a digit: model numbers like 7600X, B650, RM850e, SN580. */
function modelTokens(text: string, minLength = 3): string[] {
  return words(text).filter((t) => /\d/.test(t) && t.length >= minLength && !/^20\d\d$/.test(t));
}

function brandGroup(brand: string): string[] {
  const key = compact(brand);
  return BRAND_ALIASES[key] ?? [key];
}

function chipsetShort(chipset: string): string {
  return chipset.replace(/^(geforce|radeon|intel)\s+/i, "").replace(/\s+\d+\s*GB$/i, "").trim();
}

export function buildSearchQuery(part: Part): string {
  switch (part.category) {
    case "memory":
      // No speed: listings often cover several speeds, and "DDR4 3000" alone cut results to one.
      return [part.brand, ...seriesWords(part), `${part.totalGb}GB`, `DDR${part.ddr}`].join(" ");
    case "video-card": {
      const chip = chipsetShort(part.chipset);
      const chipTokens = new Set(chip.toLowerCase().split(/\s+/));
      const rest = withoutBrand(part)
        .split(/\s+/)
        .filter((w) => !/^(geforce|radeon)$/i.test(w) && !chipTokens.has(w.toLowerCase()))
        .join(" ");
      return [part.brand, chip, rest].filter(Boolean).join(" ");
    }
    case "internal-hard-drive":
      return `${stripParens(part.name)} ${capacityLabel(part.capacity)}`;
    default:
      return stripParens(part.name);
  }
}

/** Product line words for RAM: "Vengeance LPX", "Trident", "Fury Beast". */
function seriesWords(part: Part): string[] {
  return withoutBrand(part)
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => /^[a-z]{3,}$/i.test(w) && !STOP_WORDS.has(w.toLowerCase()) && w.toLowerCase() !== "gb")
    .slice(0, 2);
}

function cpuExcludes(model: string): string[] {
  if (/\d$/.test(model)) return ["x", "x3d", "k", "kf", "f", "g", "t"].map((s) => model + s);
  if (model.endsWith("x")) return [model + "3d"];
  if (model.endsWith("k")) return [model + "f", model + "s"];
  return [];
}

function gpuExcludes(chipset: string): string[] {
  const c = chipset.toLowerCase();
  const num = c.match(/\b\d{3,4}\b/)?.[0];
  if (!num) return [];
  const out: string[] = [];
  if (!/\bti\b/.test(c)) out.push(num + "ti");
  if (!/\bsuper\b/.test(c)) out.push(num + "super");
  if (!/\bxtx\b/.test(c)) out.push(num + "xtx");
  if (!/\bxtx?\b/.test(c)) out.push(num + "xt");
  if (!/\bgre\b/.test(c)) out.push(num + "gre");
  return out;
}

export function relevanceRule(part: Part): RelevanceRule {
  const brand = brandGroup(part.brand);
  switch (part.category) {
    case "cpu": {
      const model = modelTokens(withoutBrand(part)).at(-1);
      return { all: model ? [model] : [], any: [], exclude: [...GLOBAL_EXCLUDE, ...(model ? cpuExcludes(model) : [])] };
    }
    case "video-card": {
      const model = part.chipset.toLowerCase().match(/\b[ab]?\d{3,4}\b/)?.[0];
      return { all: model ? [model] : [], any: [brand], exclude: [...GLOBAL_EXCLUDE, ...gpuExcludes(part.chipset)] };
    }
    case "memory": {
      return {
        all: [`ddr${part.ddr}`, ...seriesWords(part).map((w) => w.toLowerCase())],
        any: [brand, [`${part.totalGb}gb`, `${part.modules}x${part.moduleGb}`]],
        exclude: GLOBAL_EXCLUDE,
      };
    }
    case "internal-hard-drive": {
      const tb = capacityLabel(part.capacity).toLowerCase();
      return {
        all: nameTokens(withoutBrand(part), 2),
        any: [brand, [tb, `${part.capacity}gb`]],
        exclude: GLOBAL_EXCLUDE,
      };
    }
    case "motherboard": {
      const all = nameTokens(withoutBrand(part), 2);
      const model = all.find((t) => /\d/.test(t));
      // An ATX "B650" listing must not be the Micro ATX "B650M" or Mini ITX "B650I" sibling.
      const siblings = model && /^[a-z]+\d+$/.test(model) ? [`${model}m`, `${model}i`] : [];
      return { all, any: [brand], exclude: GLOBAL_EXCLUDE, excludeWords: siblings };
    }
    default:
      return { all: nameTokens(withoutBrand(part), 2), any: [brand], exclude: GLOBAL_EXCLUDE };
  }
}

/**
 * First model number plus first series word ("peerless" + "120", "mag" + "b650").
 * A bare number like 120 or 360 alone would match half the coolers on sale.
 */
function nameTokens(rest: string, minModelLength: number): string[] {
  const all = words(rest);
  const model = modelTokens(rest, minModelLength)[0];
  const series = all.find((w) => /^[a-z]{3,}$/.test(w) && !STOP_WORDS.has(w));
  const picked = [model, series].filter((t): t is string => Boolean(t));
  if (picked.length) return picked;
  return all.filter((w) => w.length >= 2 && !STOP_WORDS.has(w)).slice(0, 2);
}

/** Whole-word match. A model number may follow letters ("rtx5060") but not digits or more letters. */
function hasWord(normalized: string, token: string): boolean {
  const before = /^\d/.test(token) ? "(?<![0-9])" : "(?<![a-z0-9])";
  return new RegExp(`${before}${token}(?![a-z0-9])`).test(normalized);
}

export function matchesRule(title: string, rule: RelevanceRule): boolean {
  const normalized = words(title).join(" ");
  const t = compact(title);
  return (
    rule.all.every((tok) => hasWord(normalized, tok)) &&
    rule.any.every((group) => group.some((tok) => t.includes(tok))) &&
    !rule.exclude.some((tok) => t.includes(tok)) &&
    !(rule.excludeWords ?? []).some((tok) => hasWord(normalized, tok))
  );
}
