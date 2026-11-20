import { create } from "zustand";

/**
 * Apify's free plan allows 5 concurrent actor runs for the whole account, and a
 * build has up to 8 slots. Slots take a turn here so one visitor uses at most
 * MAX_ACTIVE runs and leaves room for others. A slot holds its turn from
 * start until its run settles (done, failed, or timed out).
 */
export const MAX_ACTIVE = 2;

interface QueueState {
  active: string[];
  waiting: string[];
  request: (key: string) => void;
  release: (key: string) => void;
}

function promote(active: string[], waiting: string[]) {
  const nextActive = [...active];
  const nextWaiting = [...waiting];
  while (nextActive.length < MAX_ACTIVE && nextWaiting.length) nextActive.push(nextWaiting.shift()!);
  return { active: nextActive, waiting: nextWaiting };
}

export const useLookupQueue = create<QueueState>()((set) => ({
  active: [],
  waiting: [],
  request: (key) =>
    set((s) => {
      if (s.active.includes(key) || s.waiting.includes(key)) return s;
      return promote(s.active, [...s.waiting, key]);
    }),
  release: (key) =>
    set((s) => {
      if (!s.active.includes(key) && !s.waiting.includes(key)) return s;
      return promote(
        s.active.filter((k) => k !== key),
        s.waiting.filter((k) => k !== key),
      );
    }),
}));
