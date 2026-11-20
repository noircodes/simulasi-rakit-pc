"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CATEGORIES } from "@/lib/categories";
import { fetchParts } from "@/lib/client/api";
import { checkBuild, missingRequired } from "@/lib/compat";
import { buildTotal, formatIdr } from "@/lib/pricing";
import { decodeBuild, encodeBuild, priceFromSnapshot, snapshotPrice, type SharedBuild } from "@/lib/share";
import { buildSummaryText } from "@/lib/summary-text";
import type { Build, CategoryKey, Part } from "@/lib/types";
import { toSelection, useBuildStore } from "@/store/build-store";
import { PartPicker } from "./part-picker";
import { SlotCard } from "./slot-card";
import { SummaryPanel } from "./summary-panel";

export function Builder() {
  const build = useBuildStore((s) => s.build);
  const setPart = useBuildStore((s) => s.setPart);
  const replace = useBuildStore((s) => s.replace);
  const clear = useBuildStore((s) => s.clear);
  const queryClient = useQueryClient();

  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [picking, setPicking] = useState<CategoryKey | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Restore the saved build, then let a ?b= share link replace it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useBuildStore.persist.rehydrate();
      const encoded = new URLSearchParams(window.location.search).get("b");
      if (encoded) {
        const loaded = await loadShared(encoded, (c) =>
          queryClient.fetchQuery({ queryKey: ["parts", c], queryFn: () => fetchParts(c), staleTime: Infinity }),
        );
        if (cancelled) return;
        window.history.replaceState(null, "", window.location.pathname);
        if (!loaded) {
          setNotice({ tone: "err", text: "Link rakitan tidak valid atau rusak. Rakitan tersimpan tetap dipakai." });
        } else {
          replace(loaded.build);
          setNotice({
            tone: loaded.missing ? "err" : "ok",
            text: loaded.missing
              ? `Rakitan dari link dimuat, tapi ${loaded.missing} komponen sudah tidak ada di katalog.`
              : "Rakitan dari link dimuat.",
          });
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient, replace]);

  const selection = useMemo(() => toSelection(build), [build]);
  const issues = useMemo(() => checkBuild(selection), [selection]);
  const missing = useMemo(() => missingRequired(selection), [selection]);

  const shareUrl = () => {
    const shared: SharedBuild = {};
    for (const [key, item] of Object.entries(build)) {
      if (item) shared[key as CategoryKey] = { id: item.part.id, c: item.condition, q: item.qty, p: snapshotPrice(item.price) };
    }
    return `${window.location.origin}${window.location.pathname}?b=${encodeBuild(shared)}`;
  };

  const summary = (
    <SummaryPanel
      build={build}
      selection={selection}
      issues={issues}
      missing={missing}
      onCopyLink={() => navigator.clipboard.writeText(shareUrl())}
      onCopySummary={() => navigator.clipboard.writeText(buildSummaryText(build, shareUrl()))}
      onClear={clear}
    />
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6 lg:pb-12">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Rakit PC</h1>
          <p className="text-sm text-muted">Simulasi rakitan, cek kompatibilitas, dan harga baru atau bekas.</p>
        </div>
        <ThemeToggle />
      </header>

      {notice && (
        <div
          role="status"
          className={`mt-4 flex items-start justify-between gap-3 rounded-sm border px-4 py-2 text-sm ${notice.tone === "ok" ? "border-ok text-ok" : "border-err text-err"}`}
        >
          <span className="pt-2.5">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="inline-flex size-11 shrink-0 items-center justify-center" aria-label="Tutup pemberitahuan">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main>
          {!hydrated ? (
            <p className="py-8 text-sm text-muted">Memuat rakitan...</p>
          ) : (
            <ol className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {CATEGORIES.map((def, i) => (
                <SlotCard
                  key={def.key}
                  index={i}
                  def={def}
                  item={build[def.key]}
                  issues={issues.filter((x) => x.categories.includes(def.key))}
                  onPick={() => setPicking(def.key)}
                />
              ))}
            </ol>
          )}
        </main>

        <aside className="hidden lg:block" aria-label="Ringkasan rakitan">
          {hydrated && <div className="sticky top-6 rounded-md border border-line bg-surface p-5">{summary}</div>}
        </aside>
      </div>

      {hydrated && (
        <Dialog.Root open={summaryOpen} onOpenChange={setSummaryOpen}>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">
                  Grand total
                  {issues.some((i) => i.level === "error") && <span className="text-err"> · ada masalah</span>}
                </p>
                <p className="tabular truncate text-lg font-semibold text-accent">{formatIdr(buildTotal(build))}</p>
              </div>
              <Dialog.Trigger className="h-11 shrink-0 rounded-sm bg-ink px-4 text-sm font-medium text-paper">Lihat ringkasan</Dialog.Trigger>
            </div>
          </div>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-md border-t border-line bg-surface p-5"
            >
              <div className="mb-2 flex items-center justify-between">
                <Dialog.Title className="font-semibold">Ringkasan rakitan</Dialog.Title>
                <Dialog.Close className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-sunken" aria-label="Tutup">
                  <X className="size-5" aria-hidden />
                </Dialog.Close>
              </div>
              {summary}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <PartPicker
        category={picking}
        selection={selection}
        selectedId={picking ? build[picking]?.part.id : undefined}
        onSelect={(part) => {
          setPart(part);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />

      <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-muted">
        Data spesifikasi:{" "}
        <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/docyx/pc-part-dataset" target="_blank" rel="noopener noreferrer">
          docyx/pc-part-dataset
        </a>{" "}
        (MIT). Harga: Tokopedia lewat Apify.
      </footer>
    </div>
  );
}

async function loadShared(
  encoded: string,
  getParts: (c: CategoryKey) => Promise<Part[]>,
): Promise<{ build: Build; missing: number } | null> {
  const shared = decodeBuild(encoded);
  if (!shared || Object.keys(shared).length === 0) return null;
  const build: Build = {};
  let missing = 0;
  await Promise.all(
    Object.entries(shared).map(async ([key, item]) => {
      const category = key as CategoryKey;
      const parts = await getParts(category).catch(() => []);
      const part = parts.find((p) => p.id === item!.id);
      if (!part) {
        missing++;
        return;
      }
      build[category] = { part, condition: item!.c, qty: item!.q, price: priceFromSnapshot(item!.p) };
    }),
  );
  return { build, missing };
}
