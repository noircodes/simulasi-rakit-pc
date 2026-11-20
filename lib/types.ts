export type CategoryKey =
  | "cpu"
  | "motherboard"
  | "memory"
  | "video-card"
  | "internal-hard-drive"
  | "power-supply"
  | "case"
  | "cpu-cooler";

export type Condition = "new" | "used";

interface PartBase {
  /** BuildCores OpenDB id (UUID) */
  id: string;
  name: string;
  brand: string;
  /** product line from OpenDB metadata, e.g. "Vengeance LPX", "INSPIRE" */
  series: string | null;
  releaseYear: number | null;
}

export interface CpuPart extends PartBase {
  category: "cpu";
  socket: string;
  coreCount: number | null;
  threads: number | null;
  boostClock: number | null;
  microarchitecture: string | null;
  tdp: number | null;
  /** integrated graphics model, null when the CPU has none */
  graphics: string | null;
  /** DDR generations the memory controller supports, e.g. [5] or [5, 4] */
  memoryDdr: number[];
  includesCooler: boolean;
}

export interface MotherboardPart extends PartBase {
  category: "motherboard";
  socket: string;
  formFactor: string;
  chipset: string | null;
  maxMemory: number | null;
  memorySlots: number | null;
  ddr: number | null;
}

export interface MemoryPart extends PartBase {
  category: "memory";
  ddr: number;
  speed: number;
  modules: number;
  moduleGb: number;
  totalGb: number;
  casLatency: number | null;
}

export interface GpuPart extends PartBase {
  category: "video-card";
  chipset: string;
  memory: number | null;
  memoryType: string | null;
  boostClock: number | null;
  /** card length in mm */
  length: number | null;
  /** board power in watts (from OpenDB, or a chipset estimate when missing) */
  tdp: number;
}

export interface StoragePart extends PartBase {
  category: "internal-hard-drive";
  capacity: number;
  type: string;
  formFactor: string | null;
  interface: string | null;
}

export interface PsuPart extends PartBase {
  category: "power-supply";
  wattage: number;
  efficiency: string | null;
  modular: string | null;
  formType: string | null;
}

export interface CasePart extends PartBase {
  category: "case";
  type: string;
  /** board form factors the case takes, normalized ("ATX", "Micro ATX", "Mini ITX", "EATX") */
  supportedBoards: string[];
  /** mm */
  maxGpuLength: number | null;
  /** mm */
  maxCoolerHeight: number | null;
  sidePanel: string | null;
}

export interface CoolerPart extends PartBase {
  category: "cpu-cooler";
  waterCooled: boolean;
  /** radiator size in mm, for AIO coolers */
  radiator: number | null;
  /** mm, for air coolers */
  height: number | null;
  sockets: string[];
}

export type Part =
  | CpuPart
  | MotherboardPart
  | MemoryPart
  | GpuPart
  | StoragePart
  | PsuPart
  | CasePart
  | CoolerPart;

export type PartOf<C extends CategoryKey> = Extract<Part, { category: C }>;

export type PriceSource = "tokopedia" | "manual";

export interface ItemPrice {
  amountIdr: number;
  source: PriceSource;
  listingUrl?: string;
  fetchedAt?: string;
}

export interface BuildItem {
  part: Part;
  condition: Condition;
  qty: number;
  /** null = no Tokopedia or manual price yet */
  price: ItemPrice | null;
}

export type Build = Partial<Record<CategoryKey, BuildItem>>;

/** Shape used by compatibility checks; only parts and quantities matter there. */
export type PartSelection = Partial<{ [C in CategoryKey]: { part: PartOf<C>; qty: number } }>;

export interface MarketListing {
  title: string;
  priceIdr: number;
  url: string | null;
  shopName: string | null;
  shopCity: string | null;
  shopType: string | null;
  soldCount: number | null;
  rating: number | null;
  isAd: boolean;
}

export interface MarketStats {
  median: number;
  min: number;
  max: number;
  count: number;
  totalFound: number;
  listings: MarketListing[];
}

export interface MarketResult {
  query: string;
  condition: Condition;
  fetchedAt: string;
  stats: MarketStats | null;
}
