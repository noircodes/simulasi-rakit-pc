/**
 * Downloads BuildCores OpenDB, normalizes the PC builder categories and writes
 * data/catalog/<category>.json plus data/catalog/meta.json.
 *
 *   npm run sync:catalog
 *
 * Runs daily in .github/workflows/sync-catalog.yml.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Parser, type ReadEntry } from "tar";
import { CATEGORY_KEYS } from "../lib/categories";
import { normalizeCatalog, OPENDB_FOLDERS, OPENDB_REPO } from "../lib/catalog";
import type { CategoryKey } from "../lib/types";

const OUT_DIR = path.join(process.cwd(), "data", "catalog");
const folderToCategory = new Map(Object.entries(OPENDB_FOLDERS).map(([k, v]) => [v, k as CategoryKey]));

async function latestCommit(): Promise<string | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${OPENDB_REPO}/commits/main`, { headers });
  if (!res.ok) return null;
  return ((await res.json()) as { sha?: string }).sha ?? null;
}

async function main() {
  const sha = await latestCommit();
  const ref = sha ?? "main";
  const url = `https://codeload.github.com/${OPENDB_REPO}/tar.gz/${ref}`;
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);

  const rows = new Map<CategoryKey, Record<string, unknown>[]>(CATEGORY_KEYS.map((k) => [k, []]));
  let skipped = 0;

  const parser = new Parser({
    onReadEntry(entry: ReadEntry) {
      // <repo>-<ref>/open-db/<Folder>/<uuid>.json
      const parts = entry.path.split("/");
      const category = parts[1] === "open-db" ? folderToCategory.get(parts[2]) : undefined;
      if (!category || entry.type !== "File" || !entry.path.endsWith(".json")) {
        entry.resume();
        return;
      }
      const chunks: Buffer[] = [];
      entry.on("data", (c: Buffer) => chunks.push(c));
      entry.on("end", () => {
        try {
          rows.get(category)!.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          skipped++;
        }
      });
    },
  });

  await pipeline(Readable.fromWeb(res.body as never), parser);

  await mkdir(OUT_DIR, { recursive: true });
  const counts: Record<string, number> = {};
  for (const category of CATEGORY_KEYS) {
    const parts = normalizeCatalog(category, rows.get(category)!);
    counts[category] = parts.length;
    await writeFile(path.join(OUT_DIR, `${category}.json`), JSON.stringify(parts));
    console.log(`${category}: ${rows.get(category)!.length} records -> ${parts.length} parts`);
  }

  const meta = {
    source: `https://github.com/${OPENDB_REPO}`,
    license: "CC BY-NC-SA 4.0",
    commit: sha,
    syncedAt: new Date().toISOString(),
    counts,
  };
  await writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  if (skipped) console.warn(`Skipped ${skipped} unreadable records`);
  console.log(`Done. OpenDB commit ${sha ?? "(unknown)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
