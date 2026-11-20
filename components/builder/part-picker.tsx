"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { getCategory, specLine } from "@/lib/categories";
import { fetchParts } from "@/lib/client/api";
import { isCompatibleCandidate } from "@/lib/compat";
import type { CategoryKey, Part, PartSelection } from "@/lib/types";

/** "newest" keeps the catalog order: release year descending, then name. */
type Sort = "newest" | "name";

/** Categories where another chosen part can rule a candidate out. */
const COMPAT_FILTERED: CategoryKey[] = ["cpu", "motherboard", "memory", "video-card", "case", "power-supply", "cpu-cooler"];

interface Props {
  category: CategoryKey | null;
  selection: PartSelection;
  selectedId?: string;
  onSelect: (part: Part) => void;
  onClose: () => void;
}

export function PartPicker({ category, selection, selectedId, onSelect, onClose }: Props) {
  return (
    <Dialog.Root open={category !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col bg-surface sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[82vh] sm:w-[min(720px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md sm:border sm:border-line"
          aria-describedby={undefined}
        >
          {category && (
            <PickerBody
              key={category}
              category={category}
              selection={selection}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PickerBody({ category, selection, selectedId, onSelect }: Omit<Props, "category" | "onClose"> & { category: CategoryKey }) {
  const def = getCategory(category);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["parts", category],
    queryFn: () => fetchParts(category),
    staleTime: Infinity,
  });

  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const canFilterCompat = COMPAT_FILTERED.includes(category);
  const [compatOnly, setCompatOnly] = useState(true);

  // OpenDB spells some brands several ways (ASRock, AsRock, ASROCK); group them case-insensitively.
  const brands = useMemo(() => {
    const groups = new Map<string, { label: string; count: number }>();
    data?.forEach((p) => {
      const key = p.brand.toLowerCase();
      const g = groups.get(key);
      if (g) g.count++;
      else groups.set(key, { label: p.brand, count: 1 });
    });
    return [...groups.entries()].sort((a, b) => b[1].count - a[1].count).map(([value, g]) => ({ value, label: g.label }));
  }, [data]);

  const { items, hiddenByCompat } = useMemo(() => {
    if (!data) return { items: [], hiddenByCompat: 0 };
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const matched = data.filter(
      (p) => (!brand || p.brand.toLowerCase() === brand) && words.every((w) => p.name.toLowerCase().includes(w)),
    );
    const compatible = canFilterCompat && compatOnly ? matched.filter((p) => isCompatibleCandidate(selection, p)) : matched;
    const sorted = sort === "name" ? [...compatible].sort((a, b) => a.name.localeCompare(b.name)) : compatible;
    return { items: sorted, hiddenByCompat: matched.length - compatible.length };
  }, [data, search, brand, sort, compatOnly, canFilterCompat, selection]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68,
    overscan: 8,
  });

  const resetFilters = () => {
    setSearch("");
    setBrand("");
    setCompatOnly(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Dialog.Title className="text-base font-semibold">Pilih {def.noun}</Dialog.Title>
        <Dialog.Close
          className="inline-flex size-11 items-center justify-center rounded-sm text-muted hover:bg-sunken hover:text-ink"
          aria-label="Tutup"
        >
          <X className="size-5" aria-hidden />
        </Dialog.Close>
      </div>

      <div className="space-y-2 border-b border-line px-4 py-3">
        <label className="flex h-11 items-center gap-2 rounded-sm border border-line bg-paper px-3 focus-within:outline-2 focus-within:outline-accent">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari nama, mis. ${placeholderFor(category)}`}
            className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted"
            aria-label={`Cari ${def.label}`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-sm border border-line bg-paper px-2 sm:flex-none"
            aria-label="Filter merek"
          >
            <option value="">Semua merek</option>
            {brands.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-11 min-w-0 flex-1 rounded-sm border border-line bg-paper px-2 sm:flex-none"
            aria-label="Urutkan"
          >
            <option value="newest">Terbaru</option>
            <option value="name">Nama A-Z</option>
          </select>
          {canFilterCompat && (
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={compatOnly}
                onChange={(e) => setCompatOnly(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              Hanya yang kompatibel
            </label>
          )}
        </div>
        {data && (
          <p className="text-xs text-muted" aria-live="polite">
            {items.length.toLocaleString("id-ID")} komponen
            {hiddenByCompat > 0 && ` · ${hiddenByCompat.toLocaleString("id-ID")} disembunyikan karena tidak kompatibel`}
          </p>
        )}
        <p className="text-xs text-muted">Harga dicek di Tokopedia setelah komponen dipilih.</p>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {isPending && <p className="p-6 text-sm text-muted">Memuat katalog {def.noun} dari dataset...</p>}
        {isError && (
          <div className="space-y-3 p-6 text-sm">
            <p className="text-err">Katalog gagal dimuat: {(error as Error).message}</p>
            <button onClick={() => refetch()} className="h-11 rounded-sm border border-line px-4 hover:bg-sunken">
              Coba muat ulang
            </button>
          </div>
        )}
        {data && items.length === 0 && (
          <div className="space-y-3 p-6 text-sm">
            <p className="text-muted">Tidak ada {def.noun} yang cocok dengan pencarian dan filter ini.</p>
            <button onClick={resetFilters} className="h-11 rounded-sm border border-line px-4 hover:bg-sunken">
              Hapus semua filter
            </button>
          </div>
        )}
        {items.length > 0 && (
          <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => {
              const part = items[row.index];
              const selected = part.id === selectedId;
              return (
                <li
                  key={part.id}
                  className="absolute inset-x-0 border-b border-line"
                  style={{ height: row.size, transform: `translateY(${row.start}px)` }}
                >
                  <button
                    onClick={() => onSelect(part)}
                    className="flex h-full w-full items-center gap-3 px-4 text-left hover:bg-sunken focus-visible:-outline-offset-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{part.name}</span>
                      <span className="tabular block truncate text-xs text-muted">{specLine(part)}</span>
                    </span>
                    <span className="tabular shrink-0 text-right text-xs text-muted">
                      {selected ? "Terpilih" : part.releaseYear ?? ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function placeholderFor(category: CategoryKey): string {
  const examples: Record<CategoryKey, string> = {
    cpu: "7600X",
    motherboard: "B650",
    memory: "DDR5 32 GB",
    "video-card": "RTX 4060",
    "internal-hard-drive": "990 Pro",
    "power-supply": "750",
    case: "NZXT",
    "cpu-cooler": "Peerless",
  };
  return examples[category];
}
