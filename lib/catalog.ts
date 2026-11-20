import { estimateGpuTdp } from "./power";
import { boardSocket, ddrNumber, normalizeSocket } from "./socket";
import type { CategoryKey, Part } from "./types";

/**
 * Catalog source: BuildCores OpenDB (https://github.com/buildcores/buildcores-open-db),
 * CC BY-NC-SA 4.0. scripts/sync-catalog.ts downloads it, runs every record through
 * normalizePart(), and writes the slim result to data/catalog/<category>.json.
 */
export const OPENDB_REPO = "buildcores/buildcores-open-db";

/** OpenDB folder name for each catalog category. */
export const OPENDB_FOLDERS: Record<CategoryKey, string> = {
  cpu: "CPU",
  motherboard: "Motherboard",
  memory: "RAM",
  "video-card": "GPU",
  "internal-hard-drive": "Storage",
  "power-supply": "PSU",
  case: "PCCase",
  "cpu-cooler": "CPUCooler",
};

type Raw = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** "Mini-ITX" and "Mini ITX" are the same board size. */
export function normalizeFormFactor(ff: string): string {
  return ff.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function year(v: unknown): number | null {
  const y = num(v);
  return y && y >= 1990 && y <= 2100 ? y : null;
}

export function normalizePart(category: CategoryKey, raw: Raw): Part | null {
  const meta = obj(raw.metadata);
  const id = str(raw.opendb_id);
  const name = str(meta.name);
  const brand = str(meta.manufacturer);
  if (!id || !name || !brand) return null;
  const base = { id, name, brand, series: str(meta.series), releaseYear: year(meta.releaseYear) };

  switch (category) {
    case "cpu": {
      const socket = str(raw.socket);
      if (!socket) return null;
      const specs = obj(raw.specifications);
      const cores = obj(raw.cores);
      const igpu = str(obj(specs.integratedGraphics).model);
      return {
        ...base,
        category,
        socket: normalizeSocket(socket),
        coreCount: num(cores.total),
        threads: num(cores.threads),
        boostClock: num(obj(obj(raw.clocks).performance).boost),
        microarchitecture: str(raw.microarchitecture),
        tdp: num(specs.tdp),
        graphics: igpu && igpu.toLowerCase() !== "none" ? igpu : null,
        memoryDdr: arr(obj(specs.memory).types)
          .map((t) => ddrNumber(str(t)))
          .filter((n): n is number => n !== null),
        includesCooler: specs.includesCooler === true,
      };
    }
    case "motherboard": {
      const socket = str(raw.socket);
      const formFactor = str(raw.form_factor);
      if (!socket || !formFactor) return null;
      const memory = obj(raw.memory);
      return {
        ...base,
        category,
        socket: boardSocket(socket),
        formFactor: normalizeFormFactor(formFactor),
        chipset: str(raw.chipset),
        maxMemory: num(memory.max),
        memorySlots: num(memory.slots),
        ddr: ddrNumber(str(memory.ram_type)),
      };
    }
    case "memory": {
      // Desktop sticks only; SO-DIMM is laptop memory.
      if (/so-dimm/i.test(str(raw.form_factor) ?? "")) return null;
      const ddr = ddrNumber(str(raw.ram_type));
      const modules = obj(raw.modules);
      const count = num(modules.quantity);
      const size = num(modules.capacity_gb);
      const speed = num(raw.speed);
      if (!ddr || !count || !size || !speed) return null;
      return {
        ...base,
        category,
        ddr,
        speed,
        modules: count,
        moduleGb: size,
        totalGb: count * size,
        casLatency: num(raw.cas_latency),
      };
    }
    case "video-card": {
      const chipset = str(raw.chipset);
      if (!chipset) return null;
      return {
        ...base,
        category,
        chipset,
        memory: num(raw.memory),
        memoryType: str(raw.memory_type),
        boostClock: num(raw.core_boost_clock),
        length: num(raw.length),
        tdp: num(raw.tdp) ?? estimateGpuTdp(chipset),
      };
    }
    case "internal-hard-drive": {
      const capacity = num(raw.capacity);
      if (!capacity) return null;
      return {
        ...base,
        category,
        capacity,
        type: str(raw.storage_type) ?? "SSD",
        formFactor: str(raw.form_factor),
        interface: str(raw.interface),
      };
    }
    case "power-supply": {
      const wattage = num(raw.wattage);
      if (!wattage) return null;
      return {
        ...base,
        category,
        wattage,
        efficiency: str(raw.efficiency_rating),
        modular: str(raw.modular),
        formType: str(raw.form_factor),
      };
    }
    case "case": {
      const type = str(raw.form_factor);
      if (!type) return null;
      return {
        ...base,
        category,
        type,
        supportedBoards: arr(raw.supported_motherboard_form_factors)
          .map((f) => str(f))
          .filter((f): f is string => f !== null)
          .map(normalizeFormFactor),
        maxGpuLength: num(raw.max_video_card_length),
        maxCoolerHeight: num(raw.max_cpu_cooler_height),
        sidePanel: str(raw.side_panel),
      };
    }
    case "cpu-cooler":
      return {
        ...base,
        category,
        waterCooled: raw.water_cooled === true,
        radiator: num(raw.radiator_size),
        height: num(raw.height),
        sockets: [
          ...new Set(
            arr(raw.cpu_sockets)
              .map((s) => str(s))
              .filter((s): s is string => s !== null)
              .map(normalizeSocket),
          ),
        ],
      };
  }
}

/** Newest first, then by name, so the picker opens on current hardware. */
export function sortCatalog(parts: Part[]): Part[] {
  return [...parts].sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || a.name.localeCompare(b.name));
}

export function normalizeCatalog(category: CategoryKey, rows: Raw[]): Part[] {
  const byId = new Map<string, Part>();
  for (const row of rows) {
    const part = normalizePart(category, row);
    if (part) byId.set(part.id, part);
  }
  return sortCatalog([...byId.values()]);
}
