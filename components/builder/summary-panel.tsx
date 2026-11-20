"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, getCategory } from "@/lib/categories";
import type { Issue } from "@/lib/compat";
import { estimateLoad, recommendedPsu } from "@/lib/power";
import { buildTotal, formatIdr, itemTotal, unpricedCount } from "@/lib/pricing";
import type { Build, CategoryKey, PartSelection } from "@/lib/types";

interface Props {
  build: Build;
  selection: PartSelection;
  issues: Issue[];
  missing: CategoryKey[];
  onCopyLink: () => Promise<void>;
  onCopySummary: () => Promise<void>;
  onClear: () => void;
}

const LEVEL_TEXT = { error: "Masalah", warning: "Perhatian", info: "Catatan" } as const;
const LEVEL_CLASS = { error: "text-err", warning: "text-warn", info: "text-muted" } as const;

export function SummaryPanel({ build, selection, issues, missing, onCopyLink, onCopySummary, onClear }: Props) {
  const chosen = CATEGORIES.filter((c) => build[c.key]);
  const total = buildTotal(build);
  const unpriced = unpricedCount(build);
  const hasPower = Boolean(selection.cpu || selection["video-card"]);
  const load = estimateLoad(selection);
  const [confirmClear, setConfirmClear] = useState(false);
  const order = { error: 0, warning: 1, info: 2 };
  const sortedIssues = [...issues].sort((a, b) => order[a.level] - order[b.level]);

  return (
    <div className="space-y-5">
      <section aria-labelledby="total-title">
        <h2 id="total-title" className="text-sm text-muted">
          Grand total
        </h2>
        <p className="tabular mt-1 break-words text-3xl font-semibold text-accent" aria-live="polite">
          {formatIdr(total)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {chosen.length === 0
            ? "Belum ada komponen dipilih."
            : unpriced > 0
              ? `${chosen.length} komponen · ${unpriced} belum ada harga dan belum masuk total`
              : `${chosen.length} komponen · semua sudah ada harga`}
        </p>
      </section>

      {chosen.length > 0 && (
        <table className="w-full text-sm">
          <caption className="sr-only">Rincian harga</caption>
          <tbody className="divide-y divide-line">
            {chosen.map((c) => {
              const item = build[c.key]!;
              return (
                <tr key={c.key}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="block text-xs text-muted">
                      {c.short}
                      {item.condition === "used" ? " · bekas" : ""}
                      {item.qty > 1 ? ` · ×${item.qty}` : ""}
                    </span>
                    <span className="line-clamp-1 break-all">{item.part.name}</span>
                  </th>
                  <td className={`tabular whitespace-nowrap py-2 text-right align-bottom ${item.price ? "" : "text-muted"}`}>
                    {item.price ? formatIdr(itemTotal(item)!) : "belum ada"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <section aria-labelledby="compat-title" className="space-y-2 border-t border-line pt-4">
        <h2 id="compat-title" className="text-sm font-medium">
          Kompatibilitas
        </h2>
        {hasPower && (
          <p className="tabular text-xs text-muted">
            Estimasi daya ~{load}W · PSU disarankan {recommendedPsu(load)}W
          </p>
        )}
        <ul className="space-y-2 text-sm">
          {sortedIssues.map((issue) => (
            <li key={issue.code} className="leading-snug">
              <span className={`font-medium ${LEVEL_CLASS[issue.level]}`}>{LEVEL_TEXT[issue.level]}: </span>
              {issue.message}
            </li>
          ))}
          {chosen.length >= 2 && !issues.some((i) => i.level !== "info") && (
            <li className="flex items-start gap-2 text-ok">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              Tidak ada masalah kompatibilitas yang terdeteksi.
            </li>
          )}
          {chosen.length < 2 && issues.length === 0 && (
            <li className="text-muted">Pilih minimal dua komponen untuk mulai cek kompatibilitas.</li>
          )}
        </ul>
        {missing.length > 0 && chosen.length > 0 && (
          <p className="text-xs text-muted">Belum dipilih: {missing.map((k) => getCategory(k).noun).join(", ")}.</p>
        )}
      </section>

      <section className="space-y-2 border-t border-line pt-4">
        <CopyButton onCopy={onCopyLink} disabled={chosen.length === 0} icon={<Link2 className="size-4" aria-hidden />} label="Salin link build" done="Link tersalin" primary />
        <CopyButton onCopy={onCopySummary} disabled={chosen.length === 0} icon={<Copy className="size-4" aria-hidden />} label="Salin ringkasan teks" done="Ringkasan tersalin" />
        {chosen.length > 0 &&
          (confirmClear ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Hapus semua komponen?</span>
              <button
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
                className="h-11 rounded-sm px-3 font-medium text-err hover:bg-sunken"
              >
                Ya, kosongkan
              </button>
              <button onClick={() => setConfirmClear(false)} className="h-11 rounded-sm px-3 hover:bg-sunken">
                Batal
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="h-11 rounded-sm px-2 text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
              Kosongkan rakitan
            </button>
          ))}
      </section>

      <p className="border-t border-line pt-4 text-xs leading-relaxed text-muted">
        Harga = median listing Tokopedia yang cocok dengan model komponen saat dicek (disimpan 3 hari). Harga per toko
        bisa berbeda; isi harga manual kalau sudah dapat penawaran sendiri.
      </p>
    </div>
  );
}

function CopyButton({
  onCopy,
  disabled,
  icon,
  label,
  done,
  primary,
}: {
  onCopy: () => Promise<void>;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  done: string;
  primary?: boolean;
}) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  return (
    <button
      disabled={disabled}
      onClick={async () => {
        try {
          await onCopy();
          setState("done");
        } catch {
          setState("error");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-sm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        primary ? "bg-accent text-accent-ink hover:opacity-90" : "border border-line hover:bg-sunken"
      }`}
    >
      {state === "done" ? <Check className="size-4" aria-hidden /> : icon}
      <span aria-live="polite">{state === "done" ? done : state === "error" ? "Gagal menyalin, coba lagi" : label}</span>
    </button>
  );
}
