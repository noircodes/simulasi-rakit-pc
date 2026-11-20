/**
 * OpenDB writes sockets as "LGA 1700", coolers sometimes as "LGA 1151v2",
 * and Threadripper boards as both "TR4" and "sTR4". Everything is compared
 * in one canonical form: "LGA1700", "AM5", "sTR4".
 */
export function normalizeSocket(socket: string): string {
  const s = socket.trim().replace(/\s+narrow$/i, "");
  if (/^lga\s*\d/i.test(s)) return s.replace(/^lga\s*/i, "LGA").replace(/v\d+$/i, "");
  if (/^tr4$/i.test(s)) return "sTR4";
  return s;
}

/** Board socket strings can be dual ("2 x LGA 2011-3"). */
export function boardSocket(socket: string): string {
  return normalizeSocket(socket.replace(/^\d+\s*x\s*/i, ""));
}

export function socketFits(cpuSocket: string, boardSocketValue: string): boolean {
  return normalizeSocket(cpuSocket) === boardSocket(boardSocketValue);
}

/** "DDR5" -> 5 */
export function ddrNumber(ramType: string | null | undefined): number | null {
  const m = ramType?.match(/^DDR(\d)$/i);
  return m ? Number(m[1]) : null;
}
