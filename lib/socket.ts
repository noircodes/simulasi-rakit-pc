/**
 * The dataset has no CPU socket field, so it is derived from the
 * microarchitecture, with name rules for HEDT/workstation chips that
 * share an architecture with mainstream parts. null = unknown, checked manually.
 */
const ARCH_SOCKET: Record<string, string> = {
  "Zen 5": "AM5",
  "Zen 4": "AM5",
  "Zen 3": "AM4",
  "Zen 2": "AM4",
  "Zen+": "AM4",
  Zen: "AM4",
  "Arrow Lake": "LGA1851",
  "Raptor Lake Refresh": "LGA1700",
  "Raptor Lake": "LGA1700",
  "Alder Lake": "LGA1700",
  "Rocket Lake": "LGA1200",
  "Comet Lake": "LGA1200",
  "Coffee Lake Refresh": "LGA1151",
  "Coffee Lake": "LGA1151",
  "Kaby Lake": "LGA1151",
  Skylake: "LGA1151",
  "Haswell Refresh": "LGA1150",
  Haswell: "LGA1150",
  Broadwell: "LGA1150",
  "Ivy Bridge": "LGA1155",
  "Sandy Bridge": "LGA1155",
  Wolfdale: "LGA775",
  Yorkfield: "LGA775",
  Core: "LGA775",
  K10: "AM3",
};

export function deriveCpuSocket(name: string, microarchitecture: string | null): string | null {
  if (/xeon|opteron|epyc/i.test(name)) return null;

  const tr = name.match(/threadripper\s+(pro\s+)?(\d)\d{3}/i);
  if (tr) {
    if (tr[1]) return null;
    const gen = tr[2];
    if (gen === "1" || gen === "2") return "sTR4";
    if (gen === "3") return "sTRX4";
    return "sTR5";
  }

  // Intel HEDT: i7-5820K..i7-6950X (LGA2011-3), i7-3820..i7-4960X (LGA2011)
  if (/i7-(58|59|68|69)\d{2}[kx]?\b/i.test(name)) return "LGA2011-3";
  if (/i7-(38|39|48|49)\d{2}[kx]?\b/i.test(name)) return "LGA2011";
  // Skylake-X / Cascade Lake-X / Kaby Lake-X: model ends in X or XE
  if (/i[579]-(7\d{3}|9\d{3}|10\d{3})xe?\b/i.test(name)) return "LGA2066";

  if (/^amd fx/i.test(name)) return "AM3+";

  if (!microarchitecture) return null;
  return ARCH_SOCKET[microarchitecture] ?? null;
}

/** Board socket strings can list several ("AM3+/AM3") or be dual ("2 x LGA2011-3"). */
export function boardSockets(socket: string): string[] {
  return socket
    .replace(/^\d+\s*x\s*/i, "")
    .replace(/\s*narrow$/i, "")
    .split("/")
    .map((s) => s.trim());
}

export function socketFits(cpuSocket: string, boardSocket: string): boolean {
  return boardSockets(boardSocket).includes(cpuSocket);
}

const DDR_BY_SOCKET: Record<string, number> = {
  AM5: 5,
  LGA1851: 5,
  sTR5: 5,
  AM4: 4,
  LGA1200: 4,
  LGA1151: 4,
  LGA2066: 4,
  "LGA2011-3": 4,
  sTR4: 4,
  sTRX4: 4,
  LGA1150: 3,
  LGA1155: 3,
  LGA2011: 3,
  "AM3+": 3,
  AM3: 3,
  FM2: 3,
  "FM2+": 3,
};

/** Memory generation a board takes. LGA1700 boards come in both; the name says DDR4 when it is. */
export function deriveBoardDdr(name: string, socket: string): number | null {
  const named = name.match(/\bDDR([345])\b/i);
  if (named) return Number(named[1]);
  const primary = boardSockets(socket)[0];
  if (primary === "LGA1700") return /\bD4\b/i.test(name) ? 4 : 5;
  return DDR_BY_SOCKET[primary] ?? null;
}

/** DDR generations a CPU socket can run, used when no board is chosen yet. */
export function ddrForCpuSocket(socket: string): number[] {
  if (socket === "LGA1700") return [4, 5];
  const ddr = DDR_BY_SOCKET[socket];
  return ddr ? [ddr] : [];
}
