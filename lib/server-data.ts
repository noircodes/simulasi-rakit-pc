import type { CategoryKey, Part } from "./types";

/**
 * The catalog ships with the app in data/catalog (written by scripts/sync-catalog.ts),
 * so reads are local and the bundler traces the files for deployment.
 */
const LOADERS: Record<CategoryKey, () => Promise<{ default: unknown }>> = {
  cpu: () => import("@/data/catalog/cpu.json"),
  motherboard: () => import("@/data/catalog/motherboard.json"),
  memory: () => import("@/data/catalog/memory.json"),
  "video-card": () => import("@/data/catalog/video-card.json"),
  "internal-hard-drive": () => import("@/data/catalog/internal-hard-drive.json"),
  "power-supply": () => import("@/data/catalog/power-supply.json"),
  case: () => import("@/data/catalog/case.json"),
  "cpu-cooler": () => import("@/data/catalog/cpu-cooler.json"),
};

const byIdCache = new Map<CategoryKey, Map<string, Part>>();

export async function getCatalog(category: CategoryKey): Promise<Part[]> {
  return (await LOADERS[category]()).default as Part[];
}

export async function findPart(category: CategoryKey, id: string): Promise<Part | null> {
  let index = byIdCache.get(category);
  if (!index) {
    index = new Map((await getCatalog(category)).map((p) => [p.id, p]));
    byIdCache.set(category, index);
  }
  return index.get(id) ?? null;
}

export { default as catalogMeta } from "@/data/catalog/meta.json";
