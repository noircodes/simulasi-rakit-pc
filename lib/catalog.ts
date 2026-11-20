import { estimateGpuTdp } from "./power";
import { deriveBoardDdr, deriveCpuSocket } from "./socket";
import type { CategoryKey, Part } from "./types";

/** Public PC part dataset (MIT, scraped from PCPartPicker), served by jsDelivr. */
export const DATASET_URL = "https://cdn.jsdelivr.net/gh/docyx/pc-part-dataset@main/data/json";

type Raw = Record<string, unknown>;

const MULTI_WORD_BRANDS = [
  "Western Digital",
  "Cooler Master",
  "Fractal Design",
  "be quiet!",
  "Lian Li",
  "Silicon Power",
  "Super Flower",
  "SK hynix",
  "Arctic Cooling",
];

export function brandOf(name: string): string {
  const multi = MULTI_WORD_BRANDS.find((b) => name.toLowerCase().startsWith(b.toLowerCase() + " "));
  return multi ?? name.split(/\s+/)[0];
}

/** FNV-1a, base36. Stable across dataset refreshes as long as name and key specs stay. */
export function hashId(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const range = (v: unknown): string | null =>
  Array.isArray(v) ? v.join("-") : typeof v === "number" ? String(v) : null;

export function normalizePart(category: CategoryKey, raw: Raw): Part | null {
  const name = str(raw.name);
  const priceUsd = num(raw.price);
  if (!name || priceUsd === null || priceUsd <= 0) return null;
  const brand = brandOf(name);

  switch (category) {
    case "cpu": {
      const microarchitecture = str(raw.microarchitecture);
      const tdp = num(raw.tdp);
      return {
        category, name, brand, priceUsd, microarchitecture, tdp,
        id: hashId(`cpu|${name}`),
        coreCount: num(raw.core_count),
        coreClock: num(raw.core_clock),
        boostClock: num(raw.boost_clock),
        graphics: str(raw.graphics),
        socket: deriveCpuSocket(name, microarchitecture),
      };
    }
    case "motherboard": {
      const socket = str(raw.socket);
      const formFactor = str(raw.form_factor);
      if (!socket || !formFactor) return null;
      return {
        category, name, brand, priceUsd, socket, formFactor,
        id: hashId(`mb|${name}|${socket}|${formFactor}`),
        maxMemory: num(raw.max_memory),
        memorySlots: num(raw.memory_slots),
        ddr: deriveBoardDdr(name, socket),
      };
    }
    case "memory": {
      const speed = raw.speed as unknown[];
      const modules = raw.modules as unknown[];
      const ddr = num(speed?.[0]);
      const mhz = num(speed?.[1]);
      const count = num(modules?.[0]);
      const size = num(modules?.[1]);
      if (!ddr || !mhz || !count || !size) return null;
      return {
        category, name, brand, priceUsd, ddr, speed: mhz, modules: count, moduleGb: size,
        id: hashId(`mem|${name}|${ddr}|${mhz}|${count}x${size}|${num(raw.cas_latency)}|${str(raw.color)}`),
        totalGb: count * size,
        casLatency: num(raw.cas_latency),
      };
    }
    case "video-card": {
      const chipset = str(raw.chipset);
      if (!chipset) return null;
      return {
        category, name, brand, priceUsd, chipset,
        id: hashId(`gpu|${name}|${chipset}|${num(raw.memory)}|${str(raw.color)}|${num(raw.length)}`),
        memory: num(raw.memory),
        boostClock: num(raw.boost_clock),
        length: num(raw.length),
        tdp: estimateGpuTdp(chipset),
      };
    }
    case "internal-hard-drive": {
      const capacity = num(raw.capacity);
      if (!capacity) return null;
      const type = typeof raw.type === "number" ? `HDD ${raw.type} rpm` : str(raw.type) ?? "SSD";
      return {
        category, name, brand, priceUsd, capacity, type,
        id: hashId(`sto|${name}|${capacity}|${type}|${str(raw.interface)}`),
        formFactor: typeof raw.form_factor === "number" ? `${raw.form_factor}"` : str(raw.form_factor),
        interface: str(raw.interface),
      };
    }
    case "power-supply": {
      const wattage = num(raw.wattage);
      if (!wattage) return null;
      return {
        category, name, brand, priceUsd, wattage,
        id: hashId(`psu|${name}|${wattage}|${str(raw.color)}`),
        efficiency: str(raw.efficiency),
        modular: raw.modular === false ? "No" : str(raw.modular),
        formType: str(raw.type),
      };
    }
    case "case": {
      const type = str(raw.type);
      if (!type) return null;
      return {
        category, name, brand, priceUsd, type,
        id: hashId(`case|${name}|${type}|${str(raw.color)}`),
        sidePanel: str(raw.side_panel),
      };
    }
    case "cpu-cooler":
      return {
        category, name, brand, priceUsd,
        id: hashId(`cool|${name}|${num(raw.size)}|${str(raw.color)}`),
        size: num(raw.size),
        noise: range(raw.noise_level),
      };
  }
}

/** Normalizes, drops unpriced rows, and keeps the cheapest row per id. */
export function normalizeCatalog(category: CategoryKey, rows: Raw[]): Part[] {
  const byId = new Map<string, Part>();
  for (const row of rows) {
    const part = normalizePart(category, row);
    if (!part) continue;
    const existing = byId.get(part.id);
    if (!existing || part.priceUsd < existing.priceUsd) byId.set(part.id, part);
  }
  return [...byId.values()];
}

export async function fetchCatalog(category: CategoryKey): Promise<Part[]> {
  const res = await fetch(`${DATASET_URL}/${category}.json`);
  if (!res.ok) throw new Error(`Dataset ${category}: HTTP ${res.status}`);
  return normalizeCatalog(category, (await res.json()) as Raw[]);
}
