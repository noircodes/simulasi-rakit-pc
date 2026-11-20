import type { CasePart, CpuPart, GpuPart, MemoryPart, MotherboardPart, PsuPart } from "./types";

export const ryzen7600x: CpuPart = {
  id: "cpu1", category: "cpu", name: "AMD Ryzen 5 7600X", brand: "AMD", priceUsd: 170.49,
  coreCount: 6, coreClock: 4.7, boostClock: 5.3, microarchitecture: "Zen 4", tdp: 105, graphics: "Radeon", socket: "AM5",
};

export const ryzen5600x: CpuPart = {
  ...ryzen7600x, id: "cpu2", name: "AMD Ryzen 5 5600X", microarchitecture: "Zen 3", tdp: 65, graphics: null, socket: "AM4",
};

export const b650: MotherboardPart = {
  id: "mb1", category: "motherboard", name: "MSI B650 GAMING PLUS WIFI", brand: "MSI", priceUsd: 169.99,
  socket: "AM5", formFactor: "ATX", maxMemory: 192, memorySlots: 4, ddr: 5,
};

export const b550itx: MotherboardPart = {
  ...b650, id: "mb2", name: "ASRock B550M-ITX/ac", socket: "AM4", formFactor: "Mini ITX", maxMemory: 64, memorySlots: 2, ddr: 4,
};

export const ddr5kit: MemoryPart = {
  id: "mem1", category: "memory", name: "Corsair Vengeance RGB 32 GB", brand: "Corsair", priceUsd: 94.99,
  ddr: 5, speed: 6000, modules: 2, moduleGb: 16, totalGb: 32, casLatency: 36,
};

export const ddr4kit: MemoryPart = { ...ddr5kit, id: "mem2", name: "Corsair Vengeance LPX 16 GB", ddr: 4, speed: 3200, moduleGb: 8, totalGb: 16 };

export const rtx5060: GpuPart = {
  id: "gpu1", category: "video-card", name: "MSI GeForce RTX 5060 Ventus 2X OC", brand: "MSI", priceUsd: 299.99,
  chipset: "GeForce RTX 5060", memory: 8, boostClock: 2535, length: 197, tdp: 145,
};

export const psu650: PsuPart = {
  id: "psu1", category: "power-supply", name: "MSI MAG A650BN", brand: "MSI", priceUsd: 74.98,
  wattage: 650, efficiency: "bronze", modular: "No", formType: "ATX",
};

export const psu300: PsuPart = { ...psu650, id: "psu2", name: "Generic 300W", wattage: 300 };

export const atxCase: CasePart = {
  id: "case1", category: "case", name: "Montech XR", brand: "Montech", priceUsd: 83.59, type: "ATX Mid Tower", sidePanel: "Tempered Glass",
};

export const itxCase: CasePart = { ...atxCase, id: "case2", name: "Cooler Master NR200", type: "Mini ITX Tower" };
