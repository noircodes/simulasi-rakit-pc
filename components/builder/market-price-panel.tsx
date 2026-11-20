"use client";

import { ExternalLink } from "lucide-react";
import { useId, useState } from "react";
import { formatIdr } from "@/lib/pricing";
import type { BuildItem, CategoryKey, ItemPrice } from "@/lib/types";
import { useBuildStore } from "@/store/build-store";
import type { MarketState } from "./use-market-price";

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

interface Props {
  category: CategoryKey;
  item: BuildItem;
  market: MarketState;
  price: ItemPrice | null;
}

export function MarketPricePanel({ category, item, market, price }: Props) {
  const setPrice = useBuildStore((s) => s.setPrice);
  const queryId = useId();
  const condLabel = item.condition === "used" ? "bekas" : "baru";
  const stats = market.result?.stats ?? null;
  const running = market.phase === "running" || market.phase === "queued";

  return (
    <div className="space-y-4 border-t border-dashed border-line bg-paper/60 px-4 py-4 text-sm sm:px-5">
      {market.phase === "disabled" ? (
        <p className="text-muted">
          Cek harga Tokopedia belum aktif di server ini (<code className="tabular">APIFY_TOKEN</code> belum diisi). Isi
          harga manual di bawah supaya komponen ini ikut dihitung.
        </p>
      ) : (
        <section aria-labelledby={`${queryId}-title`} className="space-y-3">
          <h3 id={`${queryId}-title`} className="font-medium">
            Harga {condLabel} di Tokopedia
          </h3>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!running && market.query.trim()) market.run();
            }}
          >
            <label htmlFor={queryId} className="sr-only">
              Kata kunci pencarian Tokopedia
            </label>
            <input
              id={queryId}
              value={market.query}
              onChange={(e) => market.setQuery(e.target.value)}
              maxLength={100}
              className="h-11 min-w-0 flex-1 rounded-sm border border-line bg-surface px-3"
            />
            <button
              type="submit"
              disabled={running || !market.query.trim()}
              className="h-11 shrink-0 rounded-sm bg-ink px-4 font-medium text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? "Mencari..." : stats ? "Cek ulang" : `Cek harga ${condLabel}`}
            </button>
          </form>

          <div aria-live="polite" className="space-y-3">
            {market.phase === "queued" && (
              <p className="text-muted">Menunggu giliran. Maksimal 2 pencarian berjalan bersamaan supaya tidak melewati batas Apify.</p>
            )}
            {market.phase === "running" && (
              <p className="text-muted">Mencari listing {condLabel} di Tokopedia. Biasanya selesai dalam 20 sampai 60 detik.</p>
            )}
            {market.phase === "timeout" && (
              <p className="text-err">Pencarian terlalu lama dan dihentikan. Coba lagi beberapa saat lagi.</p>
            )}
            {market.phase === "failed" && <p className="text-err">{market.error}</p>}
            {market.phase === "idle" && (
              <p className="text-muted">
                {price?.source === "tokopedia" && price.fetchedAt
                  ? `Harga diambil dari Tokopedia ${dateFmt.format(new Date(price.fetchedAt))}. Tekan Cek ulang untuk memperbarui.`
                  : "Satu pengecekan mengambil sampai 10 listing teratas, lalu dihitung median harganya."}
              </p>
            )}
            {market.phase === "done" && !stats && (
              <p className="text-muted">
                Tidak ada listing {condLabel} yang cocok dengan kata kunci ini. Coba ubah kata kunci di atas, atau isi
                harga manual.
              </p>
            )}
            {market.phase === "done" && stats && market.result && (
              <MarketStatsView
                stats={stats}
                fetchedAt={market.result.fetchedAt}
                currentAmount={price?.amountIdr ?? null}
                onUse={(amountIdr, listingUrl) =>
                  setPrice(category, {
                    amountIdr,
                    source: "tokopedia",
                    fetchedAt: market.result!.fetchedAt,
                    ...(listingUrl ? { listingUrl } : {}),
                  })
                }
              />
            )}
          </div>
        </section>
      )}

      <ManualPrice
        key={`${item.part.id}:${item.condition}`}
        current={price}
        onSave={(amountIdr) => setPrice(category, { amountIdr, source: "manual" })}
        onReset={() => setPrice(category, null)}
      />
    </div>
  );
}

function MarketStatsView({
  stats,
  fetchedAt,
  currentAmount,
  onUse,
}: {
  stats: NonNullable<NonNullable<MarketState["result"]>["stats"]>;
  fetchedAt: string;
  currentAmount: number | null;
  onUse: (amountIdr: number, listingUrl?: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Median</dt>
          <dd className="tabular font-medium">{formatIdr(stats.median)}</dd>
          <dt className="text-muted">Rentang</dt>
          <dd className="tabular">
            {formatIdr(stats.min)} sampai {formatIdr(stats.max)}
          </dd>
          <dt className="text-muted">Dasar</dt>
          <dd>
            {stats.count} dari {stats.totalFound} listing cocok · {dateFmt.format(new Date(fetchedAt))}
          </dd>
        </dl>
        {currentAmount !== stats.median && (
          <button
            onClick={() => onUse(stats.median)}
            className="h-11 rounded-sm border border-line bg-surface px-4 hover:bg-sunken"
          >
            Pakai median
          </button>
        )}
      </div>
      {stats.count < 3 && (
        <p className="text-warn">
          Hanya {stats.count} listing yang cocok, jadi median ini kurang bisa diandalkan. Cek listing di bawah atau isi
          harga manual.
        </p>
      )}
      <ul className="divide-y divide-line rounded-sm border border-line bg-surface">
        {stats.listings.map((l, i) => (
          <li key={`${l.url ?? l.title}-${i}`} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              {l.url ? (
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 underline decoration-line underline-offset-2 hover:decoration-ink"
                >
                  <span className="truncate">{l.title}</span>
                  <ExternalLink className="size-3.5 shrink-0" aria-label="(tab baru)" />
                </a>
              ) : (
                <span className="block truncate">{l.title}</span>
              )}
              <p className="text-xs text-muted">
                {[l.shopName, l.shopCity, l.soldCount ? `${l.soldCount}+ terjual` : null, l.isAd ? "iklan" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="tabular">{formatIdr(l.priceIdr)}</span>
              <button
                onClick={() => onUse(l.priceIdr, l.url ?? undefined)}
                disabled={currentAmount === l.priceIdr}
                className="h-11 rounded-sm border border-line px-3 hover:bg-sunken disabled:opacity-50"
              >
                {currentAmount === l.priceIdr ? "Dipakai" : "Pakai"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ManualPrice({
  current,
  onSave,
  onReset,
}: {
  current: ItemPrice | null;
  onSave: (amount: number) => void;
  onReset: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState(current?.source === "manual" ? String(current.amountIdr) : "");
  const amount = Number(value.replace(/\D/g, ""));
  const valid = amount >= 1000 && amount <= 1_000_000_000;

  return (
    <section className="space-y-2">
      <label htmlFor={id} className="block font-medium">
        Harga sendiri
      </label>
      <p className="text-xs text-muted">Sudah dapat harga dari toko atau penjual? Isi di sini, total ikut berubah.</p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(amount);
        }}
      >
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-sm border border-line bg-surface px-3 focus-within:outline-2 focus-within:outline-accent">
          <span className="text-muted">Rp</span>
          <input
            id={id}
            inputMode="numeric"
            value={amount ? amount.toLocaleString("id-ID") : value.replace(/\D/g, "")}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
            className="tabular h-full w-full min-w-0 bg-transparent pl-2 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!valid}
          className="h-11 shrink-0 rounded-sm border border-line bg-surface px-4 hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50"
        >
          Pakai harga ini
        </button>
        {current?.source === "manual" && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              onReset();
            }}
            className="h-11 shrink-0 px-3 text-muted underline underline-offset-2 hover:text-ink"
          >
            Hapus harga manual
          </button>
        )}
      </form>
      {value && !valid && <p className="text-xs text-err">Masukkan harga antara Rp1.000 dan Rp1.000.000.000.</p>}
    </section>
  );
}
