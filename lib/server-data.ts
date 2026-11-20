import { cacheLife } from "next/cache";
import { fetchCatalog } from "./catalog";
import type { CategoryKey, Part } from "./types";

/** Server-side cached reads shared by the route handlers. */

export async function getCatalog(category: CategoryKey): Promise<Part[]> {
  "use cache";
  cacheLife("days");
  return fetchCatalog(category);
}

export async function findPart(category: CategoryKey, id: string): Promise<Part | null> {
  return (await getCatalog(category)).find((p) => p.id === id) ?? null;
}
