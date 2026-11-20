"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { specLine, type CategoryDef } from "@/lib/categories";
import type { Issue } from "@/lib/compat";
import { formatIdr } from "@/lib/pricing";
import type { BuildItem, Condition } from "@/lib/types";
import { MAX_QTY, useBuildStore } from "@/store/build-store";
import { MarketPricePanel } from "./market-price-panel";
import { useMarketPrice, type MarketState } from "./use-market-price";

interface Props {
  index: number;
  def: CategoryDef;
  item: BuildItem | undefined;
  issues: Issue[];
  onPick: () => void;
}

export function SlotCard({ index, def, item, issues, onPick }: Props) {
  const number = String(index + 1).padStart(2, "0");
  const worst = issues.find((i) => i.level === "error") ?? issues.find((i) => i.level === "warning");

  return (
    <li className="bg-surface">
      <div className="flex items-start gap-3 px-4 pt-4 sm:gap-4 sm:px-5">
        <span className="tabular w-6 shrink-0 pt-0.5 text-sm text-muted" aria-hidden>
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm text-muted">
            {def.label}
            {!def.required && <span> · opsional</span>}
          </h2>
          {!item && (
            <button
              onClick={onPick}
              className="mb-4 mt-2 flex h-11 w-full items-center gap-2 rounded-sm border border-dashed border-line px-3 text-left text-sm hover:border-ink hover:bg-sunken"
            >
              <Plus className="size-4 text-accent" aria-hidden />
              Pilih {def.noun}
            </button>
          )}
        </div>
      </div>
      {item && <FilledSlot def={def} item={item} onPick={onPick} />}
      {worst && (
        <p
          className={`mx-4 mb-4 border-l-2 pl-3 text-sm sm:mx-5 sm:ml-[3.75rem] ${worst.level === "error" ? "border-err text-err" : "border-warn text-warn"}`}
        >
          {worst.message}
        </p>
      )}
    </li>
  );
}

function FilledSlot({ def, item, onPick }: { def: CategoryDef; item: BuildItem; onPick: () => void }) {
  const { setCondition, setQty, remove } = useBuildStore();
  const market = useMarketPrice(def.key, item);
  const [open, setOpen] = useState(false);
  const price = item.price;
  const panelId = `market-${def.key}`;

  return (
    <>
      <div className="px-4 pb-4 sm:pl-[3.75rem] sm:pr-5">
        <p className="mt-0.5 font-medium leading-snug">{item.part.name}</p>
        <p className="tabular mt-0.5 text-xs text-muted">{specLine(item.part)}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <ConditionToggle value={item.condition} onChange={(c) => setCondition(def.key, c)} label={def.label} />
          {def.multi && (
            <div className="flex items-center rounded-sm border border-line" role="group" aria-label={`Jumlah ${def.label}`}>
              <button
                onClick={() => setQty(def.key, item.qty - 1)}
                disabled={item.qty <= 1}
                className="inline-flex size-11 items-center justify-center hover:bg-sunken disabled:opacity-40"
                aria-label="Kurangi jumlah"
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="tabular w-8 text-center text-sm" aria-live="polite">
                {item.qty}
              </span>
              <button
                onClick={() => setQty(def.key, item.qty + 1)}
                disabled={item.qty >= MAX_QTY}
                className="inline-flex size-11 items-center justify-center hover:bg-sunken disabled:opacity-40"
                aria-label="Tambah jumlah"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          )}
          <div className="ml-auto text-right" aria-live="polite">
            {price ? (
              <>
                <p className="tabular text-base font-medium">{formatIdr(price.amountIdr * item.qty)}</p>
                <p className="text-xs text-muted">
                  {item.qty > 1 && <span className="tabular">{item.qty} × {formatIdr(price.amountIdr)} · </span>}
                  <SourceLabel source={price.source} amount={price.amountIdr} market={market} listing={Boolean(price.listingUrl)} />
                </p>
              </>
            ) : (
              <NoPrice market={market} condition={item.condition} />
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-1 text-sm">
          <button onClick={onPick} className="h-11 rounded-sm px-2 underline-offset-2 hover:bg-sunken hover:underline sm:-ml-2">
            Ganti
          </button>
          <button
            onClick={() => remove(def.key)}
            className="h-11 rounded-sm px-2 text-muted underline-offset-2 hover:bg-sunken hover:text-ink hover:underline"
          >
            Hapus
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className="ml-auto inline-flex h-11 items-center gap-1 rounded-sm px-2 hover:bg-sunken"
          >
            Harga pasar
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
      </div>
      {open && (
        <div id={panelId}>
          <MarketPricePanel category={def.key} item={item} market={market} price={price} />
        </div>
      )}
    </>
  );
}

function ConditionToggle({ value, onChange, label }: { value: Condition; onChange: (c: Condition) => void; label: string }) {
  const options: [Condition, string][] = [
    ["new", "Baru"],
    ["used", "Bekas"],
  ];
  return (
    <div className="inline-flex rounded-sm border border-line p-0.5" role="group" aria-label={`Kondisi ${label}`}>
      {options.map(([c, text]) => (
        <button
          key={c}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={`h-10 min-w-16 rounded-[2px] px-3 text-sm ${value === c ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SourceLabel({
  source,
  amount,
  market,
  listing,
}: {
  source: "tokopedia" | "manual";
  amount: number;
  market: MarketState;
  listing: boolean;
}) {
  if (source === "manual") return <>harga manual</>;
  if (source === "tokopedia") {
    const stats = market.result?.stats;
    if (listing) return <>Tokopedia · listing pilihan</>;
    if (stats && stats.median === amount) return <>Tokopedia · median {stats.count} listing</>;
    return <>Tokopedia</>;
  }
  return <>Tokopedia</>;
}

function NoPrice({ market, condition }: { market: MarketState; condition: Condition }) {
  if (market.phase === "queued") {
    return (
      <>
        <p className="text-sm">Menunggu giliran cek...</p>
        <p className="text-xs text-muted">maks 2 pencarian berjalan bersamaan</p>
      </>
    );
  }
  if (market.phase === "running") {
    return (
      <>
        <p className="text-sm">Mengecek Tokopedia...</p>
        <p className="text-xs text-muted">biasanya 20 sampai 60 detik</p>
      </>
    );
  }
  const reason =
    market.phase === "disabled"
      ? "cek Tokopedia belum aktif"
      : market.phase === "done"
        ? `tidak ada listing ${condition === "used" ? "bekas" : "baru"} yang cocok`
        : market.phase === "failed" || market.phase === "timeout"
          ? "pengecekan gagal"
          : "belum dicek";
  return (
    <>
      <p className="text-sm font-medium text-warn">Belum ada harga</p>
      <p className="text-xs text-muted">{reason} · buka Harga pasar</p>
    </>
  );
}
