"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { marketLookup, marketPoll, type LookupResponse } from "@/lib/client/api";
import { buildSearchQuery } from "@/lib/market/query";
import type { BuildItem, CategoryKey, MarketResult } from "@/lib/types";
import { useBuildStore } from "@/store/build-store";
import { useLookupQueue } from "./lookup-queue";

const POLL_MS = 3000;
/** Actor runs normally finish in under a minute; stop waiting after three. */
const MAX_POLLS = 60;
const BUSY_RETRY_MS = 8000;
const MAX_BUSY_RETRIES = 5;

export type MarketPhase = "idle" | "disabled" | "queued" | "running" | "done" | "failed" | "timeout";

export interface MarketState {
  phase: MarketPhase;
  result: MarketResult | null;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  run: () => void;
}

/**
 * Tokopedia price for one build slot. A lookup starts on its own when a part
 * without a price is chosen or its condition changes; the server answers from
 * its cache when it can, so repeat parts cost nothing. Lookups wait their turn
 * in a shared queue (see lookup-queue.ts). A fresh median replaces the current
 * Tokopedia price, never a manual one.
 */
export function useMarketPrice(category: CategoryKey, item: BuildItem): MarketState {
  const { part, condition } = item;
  const setPrice = useBuildStore((s) => s.setPrice);
  const [query, setQuery] = useState(() => buildSearchQuery(part));
  const [runId, setRunId] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const [settled, setSettled] = useState<LookupResponse | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Reset when the part or condition changes.
  const key = `${part.id}:${condition}`;
  const slotKey = `${category}:${key}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setQuery(buildSearchQuery(part));
    setRunId(null);
    setPolls(0);
    setSettled(null);
    setRetrying(false);
  }

  const request = useLookupQueue((s) => s.request);
  const release = useLookupQueue((s) => s.release);
  const isActive = useLookupQueue((s) => s.active.includes(slotKey));
  const isWaiting = useLookupQueue((s) => s.waiting.includes(slotKey));

  const pending = useRef(false);
  const busyRetries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRanFor = useRef<string | null>(null);

  const enqueue = () => {
    pending.current = true;
    request(slotKey);
  };

  const lookup = useMutation({
    mutationFn: () => marketLookup({ category, partId: part.id, condition, query }),
    onSuccess: (res) => {
      if (res.status === "running") {
        setRunId(res.runId);
        setPolls(0);
        return;
      }
      release(slotKey);
      if (res.status === "busy" && busyRetries.current < MAX_BUSY_RETRIES) {
        busyRetries.current++;
        setRetrying(true);
        retryTimer.current = setTimeout(() => {
          setRetrying(false);
          enqueue();
        }, BUSY_RETRY_MS);
        return;
      }
      setSettled(
        res.status === "busy"
          ? { status: "failed", error: "Layanan pencarian sedang penuh. Coba lagi beberapa saat lagi." }
          : res,
      );
    },
    onError: (err) => {
      release(slotKey);
      setSettled({ status: "failed", error: (err as Error).message });
    },
  });

  // Start once this slot gets its turn.
  useEffect(() => {
    if (!isActive || !pending.current) return;
    pending.current = false;
    lookup.mutate();
  }, [isActive, lookup]);

  // Auto lookup for a part that has no price yet.
  useEffect(() => {
    if (item.price || autoRanFor.current === key) return;
    autoRanFor.current = key;
    busyRetries.current = 0;
    pending.current = true;
    request(slotKey);
  }, [key, slotKey, item.price, request]);

  // Give the turn back when the slot changes or unmounts. Clearing autoRanFor lets a
  // remount (React StrictMode runs effects twice in dev) queue the lookup again.
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      pending.current = false;
      autoRanFor.current = null;
      release(slotKey);
    },
    [slotKey, release],
  );

  const poll = useQuery({
    queryKey: ["market-run", runId],
    queryFn: async () => {
      setPolls((n) => n + 1);
      const res = await marketPoll(runId!).catch(
        (err): LookupResponse => ({ status: "failed", error: (err as Error).message }),
      );
      if (res.status !== "running") {
        setSettled(res);
        setRunId(null);
        release(slotKey);
      }
      return res;
    },
    enabled: Boolean(runId) && polls < MAX_POLLS,
    refetchInterval: (q) => (q.state.data?.status === "running" ? POLL_MS : false),
    staleTime: 0,
    gcTime: 0,
  });

  const timedOut = Boolean(runId) && polls >= MAX_POLLS;
  useEffect(() => {
    if (timedOut) release(slotKey);
  }, [timedOut, slotKey, release]);

  const latest: LookupResponse | undefined = settled ?? (runId ? poll.data : undefined);
  const result = latest?.status === "done" ? latest.result : null;

  // Apply each new median, but never over a manual price or a listing picked from this same result.
  const priceSource = item.price?.source;
  const priceFetchedAt = item.price?.fetchedAt;
  useEffect(() => {
    if (!result?.stats || result.condition !== condition) return;
    if (priceSource === "manual" || priceFetchedAt === result.fetchedAt) return;
    setPrice(category, { amountIdr: result.stats.median, source: "tokopedia", fetchedAt: result.fetchedAt });
  }, [result, condition, category, priceSource, priceFetchedAt, setPrice]);

  let phase: MarketPhase = "idle";
  let error: string | null = null;
  if (latest?.status === "disabled") phase = "disabled";
  else if (timedOut) phase = "timeout";
  else if (runId || lookup.isPending) phase = "running";
  else if (isWaiting || retrying) phase = "queued";
  else if (latest?.status === "done") phase = "done";
  else if (latest?.status === "failed" || latest?.status === "limited") {
    phase = "failed";
    error = latest.error;
  }

  return {
    phase,
    result,
    error,
    query,
    setQuery,
    run: () => {
      setSettled(null);
      busyRetries.current = 0;
      enqueue();
    },
  };
}
