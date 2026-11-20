import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Build, CategoryKey, Condition, ItemPrice, Part, PartSelection } from "@/lib/types";

interface BuildState {
  build: Build;
  setPart: (part: Part) => void;
  remove: (category: CategoryKey) => void;
  setCondition: (category: CategoryKey, condition: Condition) => void;
  setQty: (category: CategoryKey, qty: number) => void;
  setPrice: (category: CategoryKey, price: ItemPrice | null) => void;
  replace: (build: Build) => void;
  clear: () => void;
}

export const MAX_QTY = 4;

export const useBuildStore = create<BuildState>()(
  persist(
    (set) => ({
      build: {},
      setPart: (part) =>
        set((s) => {
          const prev = s.build[part.category];
          return {
            build: {
              ...s.build,
              [part.category]: { part, condition: prev?.condition ?? "new", qty: prev?.qty ?? 1, price: null },
            },
          };
        }),
      remove: (category) =>
        set((s) => {
          const next = { ...s.build };
          delete next[category];
          return { build: next };
        }),
      setCondition: (category, condition) =>
        set((s) => {
          const item = s.build[category];
          if (!item || item.condition === condition) return s;
          return { build: { ...s.build, [category]: { ...item, condition, price: null } } };
        }),
      setQty: (category, qty) =>
        set((s) => {
          const item = s.build[category];
          if (!item) return s;
          const clamped = Math.min(MAX_QTY, Math.max(1, Math.round(qty)));
          return { build: { ...s.build, [category]: { ...item, qty: clamped } } };
        }),
      setPrice: (category, price) =>
        set((s) => {
          const item = s.build[category];
          if (!item) return s;
          return { build: { ...s.build, [category]: { ...item, price } } };
        }),
      replace: (build) => set({ build }),
      clear: () => set({ build: {} }),
    }),
    {
      name: "rakit-pc-build-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export function toSelection(build: Build): PartSelection {
  const sel: Record<string, { part: Part; qty: number }> = {};
  for (const [key, item] of Object.entries(build)) {
    if (item) sel[key] = { part: item.part, qty: item.qty };
  }
  return sel as PartSelection;
}
