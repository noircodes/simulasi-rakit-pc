import type { CategoryKey, Part } from "./types";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  /** label as used mid-sentence: "Pilih RAM", "Pilih kartu grafis" */
  noun: string;
  short: string;
  required: boolean;
  /** quantity can be raised (RAM kits, drives) */
  multi: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  { key: "cpu", label: "Prosesor", noun: "prosesor", short: "CPU", required: true, multi: false },
  { key: "motherboard", label: "Motherboard", noun: "motherboard", short: "Mobo", required: true, multi: false },
  { key: "memory", label: "RAM", noun: "RAM", short: "RAM", required: true, multi: true },
  { key: "video-card", label: "Kartu grafis", noun: "kartu grafis", short: "VGA", required: false, multi: false },
  { key: "internal-hard-drive", label: "Penyimpanan", noun: "penyimpanan", short: "SSD/HDD", required: true, multi: true },
  { key: "power-supply", label: "Power supply", noun: "power supply", short: "PSU", required: true, multi: false },
  { key: "case", label: "Casing", noun: "casing", short: "Casing", required: true, multi: false },
  { key: "cpu-cooler", label: "CPU cooler", noun: "CPU cooler", short: "Cooler", required: false, multi: false },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function isCategoryKey(value: string): value is CategoryKey {
  return (CATEGORY_KEYS as string[]).includes(value);
}

export function getCategory(key: CategoryKey): CategoryDef {
  return CATEGORIES.find((c) => c.key === key)!;
}

export function capacityLabel(gb: number): string {
  return gb >= 1000 ? `${+(gb / 1000).toFixed(1)}TB` : `${gb}GB`;
}

/** One-line datasheet summary shown under the part name. */
export function specLine(part: Part): string {
  const bits: (string | number | null | false)[] = [];
  switch (part.category) {
    case "cpu":
      bits.push(
        part.socket,
        part.coreCount && `${part.coreCount} core`,
        part.boostClock && `${part.boostClock} GHz`,
        part.tdp && `${part.tdp}W`,
        part.graphics ? "iGPU" : "tanpa iGPU",
        part.includesCooler && "cooler bawaan",
      );
      break;
    case "motherboard":
      bits.push(part.socket, part.chipset, part.formFactor, part.ddr && `DDR${part.ddr}`, part.memorySlots && `${part.memorySlots} slot`);
      break;
    case "memory":
      bits.push(`DDR${part.ddr}-${part.speed}`, `${part.modules}x${part.moduleGb}GB`, part.casLatency && `CL${part.casLatency}`);
      break;
    case "video-card":
      bits.push(part.chipset, part.memory && `${part.memory}GB ${part.memoryType ?? ""}`.trim(), `${part.tdp}W`, part.length && `${part.length}mm`);
      break;
    case "internal-hard-drive":
      bits.push(capacityLabel(part.capacity), part.type, part.formFactor, part.interface);
      break;
    case "power-supply":
      bits.push(`${part.wattage}W`, part.formType, part.efficiency, part.modular && part.modular.toLowerCase());
      break;
    case "case":
      bits.push(part.type, part.maxGpuLength && `VGA maks ${part.maxGpuLength}mm`, part.maxCoolerHeight && `cooler maks ${part.maxCoolerHeight}mm`);
      break;
    case "cpu-cooler":
      bits.push(
        part.waterCooled ? `AIO ${part.radiator ? `${part.radiator}mm` : ""}`.trim() : "air cooler",
        !part.waterCooled && part.height && `tinggi ${part.height}mm`,
      );
      break;
  }
  return bits.filter(Boolean).join(" · ");
}
