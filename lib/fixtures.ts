import type { CasePart, CoolerPart, CpuPart, GpuPart, MemoryPart, MotherboardPart, PsuPart, StoragePart } from "./types";

const meta = { series: null, releaseYear: 2024 };

export const ryzen7600x: CpuPart = {
  ...meta, id: "cpu1", category: "cpu", name: "AMD Ryzen 5 7600X", brand: "AMD",
  socket: "AM5", coreCount: 6, threads: 12, boostClock: 5.3, microarchitecture: "Zen 4", tdp: 105,
  graphics: "AMD Radeon Graphics", memoryDdr: [5], includesCooler: false,
};

export const ryzen5600x: CpuPart = {
  ...ryzen7600x, id: "cpu2", name: "AMD Ryzen 5 5600X", socket: "AM4", microarchitecture: "Zen 3", tdp: 65,
  graphics: null, memoryDdr: [4], includesCooler: true,
};

export const b650: MotherboardPart = {
  ...meta, id: "mb1", category: "motherboard", name: "MSI B650 GAMING PLUS WIFI DDR5 ATX", brand: "MSI",
  socket: "AM5", formFactor: "ATX", chipset: "AMD B650", maxMemory: 192, memorySlots: 4, ddr: 5,
};

export const b550itx: MotherboardPart = {
  ...b650, id: "mb2", name: "ASRock B550M-ITX/ac", brand: "ASRock", socket: "AM4", formFactor: "Mini ITX",
  chipset: "AMD B550", maxMemory: 64, memorySlots: 2, ddr: 4,
};

export const ddr5kit: MemoryPart = {
  ...meta, id: "mem1", category: "memory", name: "Corsair Vengeance RGB DDR5-6000 32GB (2x16GB) CL36", brand: "Corsair",
  series: "Vengeance RGB", ddr: 5, speed: 6000, modules: 2, moduleGb: 16, totalGb: 32, casLatency: 36,
};

export const ddr4kit: MemoryPart = {
  ...ddr5kit, id: "mem2", name: "Corsair Vengeance LPX DDR4-3200 16GB (2x8GB)", series: "Vengeance LPX",
  ddr: 4, speed: 3200, moduleGb: 8, totalGb: 16,
};

export const rtx5060: GpuPart = {
  ...meta, id: "gpu1", category: "video-card", name: "MSI GeForce RTX 5060 Ventus 2X OC 8GB GDDR7", brand: "MSI",
  series: "VENTUS", chipset: "GeForce RTX 5060", memory: 8, memoryType: "GDDR7", boostClock: 2535, length: 197, tdp: 145,
};

export const ssd990: StoragePart = {
  ...meta, id: "s1", category: "internal-hard-drive", name: "Samsung 990 Pro 2TB M.2-2280 PCIe 4.0 X4 NVME Solid State Drive",
  brand: "Samsung", series: "990 Pro", capacity: 2000, type: "SSD", formFactor: "M.2-2280", interface: "M.2 PCIe 4.0 x4",
};

export const psu650: PsuPart = {
  ...meta, id: "psu1", category: "power-supply", name: "MSI MAG A650BN 650W 80+ Bronze Certified Non-Modular ATX", brand: "MSI",
  wattage: 650, efficiency: "80+ Bronze", modular: "Non-Modular", formType: "ATX",
};

export const psu300: PsuPart = { ...psu650, id: "psu2", name: "Generic 300W", wattage: 300 };

export const atxCase: CasePart = {
  ...meta, id: "case1", category: "case", name: "Montech XR ATX Mid Tower Black", brand: "Montech", type: "ATX Mid Tower",
  supportedBoards: ["ATX", "Micro ATX", "Mini ITX"], maxGpuLength: 400, maxCoolerHeight: 167, sidePanel: "Tempered Glass",
};

export const itxCase: CasePart = {
  ...atxCase, id: "case2", name: "Cooler Master NR200 Mini ITX Tower", brand: "Cooler Master", type: "Mini ITX Tower",
  supportedBoards: ["Mini ITX"], maxGpuLength: 180, maxCoolerHeight: 155,
};

export const airCooler: CoolerPart = {
  ...meta, id: "cool1", category: "cpu-cooler", name: "Thermalright Peerless Assassin 120 SE Air 155mm", brand: "Thermalright",
  series: "Peerless Assassin", waterCooled: false, radiator: null, height: 155, sockets: ["AM4", "AM5", "LGA1700", "LGA1851"],
};
