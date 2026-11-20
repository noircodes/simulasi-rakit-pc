import { CATEGORIES } from "./categories";
import { estimateLoad, PSU_HEADROOM, recommendedPsu } from "./power";
import { ddrForCpuSocket, socketFits } from "./socket";
import type { CategoryKey, Part, PartSelection } from "./types";

export type IssueLevel = "error" | "warning" | "info";

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  categories: CategoryKey[];
}

/** 1 = Mini ITX, 2 = Micro ATX, 3 = ATX, 4 = E-ATX and larger. */
export function boardSize(formFactor: string): number | null {
  const f = formFactor.toLowerCase();
  if (f.includes("itx") || f.includes("dtx")) return 1;
  if (f.includes("micro")) return 2;
  if (f.startsWith("eatx") || f.includes("xl atx") || f.includes("ceb")) return 4;
  if (f === "atx") return 3;
  return null;
}

/** Largest board a case takes, from its type string. */
export function caseMaxBoard(type: string): number | null {
  const t = type.toLowerCase();
  if (t.startsWith("mini itx")) return 1;
  if (t.startsWith("microatx")) return 2;
  if (t.includes("full tower")) return 4;
  if (t.startsWith("atx")) return 3;
  return null;
}

const BOARD_LABEL = ["", "Mini ITX", "Micro ATX", "ATX", "E-ATX"];

export function checkBuild(sel: PartSelection): Issue[] {
  const issues: Issue[] = [];
  const cpu = sel.cpu?.part;
  const board = sel.motherboard?.part;
  const ram = sel.memory;
  const gpu = sel["video-card"]?.part;
  const psu = sel["power-supply"]?.part;
  const pcCase = sel.case?.part;

  if (cpu && !cpu.socket) {
    issues.push({
      level: "info",
      code: "cpu-socket-unknown",
      message: `Socket ${cpu.name} tidak terdeteksi otomatis. Cocokkan socket dengan motherboard secara manual.`,
      categories: ["cpu"],
    });
  }

  if (cpu?.socket && board && !socketFits(cpu.socket, board.socket)) {
    issues.push({
      level: "error",
      code: "socket-mismatch",
      message: `Socket prosesor ${cpu.socket} tidak cocok dengan motherboard ${board.socket}.`,
      categories: ["cpu", "motherboard"],
    });
  }

  if (ram) {
    const { part: mem, qty } = ram;
    if (board?.ddr && board.ddr !== mem.ddr) {
      issues.push({
        level: "error",
        code: "ddr-mismatch",
        message: `RAM DDR${mem.ddr} tidak bisa dipasang di motherboard DDR${board.ddr}.`,
        categories: ["memory", "motherboard"],
      });
    } else if (!board && cpu?.socket) {
      const supported = ddrForCpuSocket(cpu.socket);
      if (supported.length && !supported.includes(mem.ddr)) {
        issues.push({
          level: "error",
          code: "ddr-cpu-mismatch",
          message: `Platform ${cpu.socket} memakai DDR${supported.join("/DDR")}, bukan DDR${mem.ddr}.`,
          categories: ["memory", "cpu"],
        });
      }
    }
    if (board?.memorySlots && mem.modules * qty > board.memorySlots) {
      issues.push({
        level: "error",
        code: "ram-slots",
        message: `${mem.modules * qty} keping RAM, motherboard cuma punya ${board.memorySlots} slot.`,
        categories: ["memory", "motherboard"],
      });
    }
    if (board?.maxMemory && mem.totalGb * qty > board.maxMemory) {
      issues.push({
        level: "error",
        code: "ram-capacity",
        message: `Total RAM ${mem.totalGb * qty}GB melebihi batas motherboard ${board.maxMemory}GB.`,
        categories: ["memory", "motherboard"],
      });
    }
  }

  if (board && pcCase) {
    const size = boardSize(board.formFactor);
    const max = caseMaxBoard(pcCase.type);
    if (size && max && size > max) {
      const eatxInMid = size === 4 && max === 3;
      issues.push({
        level: eatxInMid ? "warning" : "error",
        code: "case-size",
        message: eatxInMid
          ? `Motherboard ${board.formFactor} di casing mid tower: cek dulu dukungan E-ATX di spesifikasi casing.`
          : `Motherboard ${board.formFactor} tidak muat di casing ${pcCase.type} (maks ${BOARD_LABEL[max]}).`,
        categories: ["motherboard", "case"],
      });
    } else if (!max) {
      issues.push({
        level: "info",
        code: "case-size-unknown",
        message: `Ukuran motherboard yang muat di casing ${pcCase.type} tidak diketahui. Cek manual.`,
        categories: ["case"],
      });
    }
  }

  if (cpu && !cpu.graphics && !gpu) {
    issues.push({
      level: "error",
      code: "no-display",
      message: `${cpu.name} tidak punya grafis terintegrasi. Tambahkan kartu grafis supaya ada tampilan.`,
      categories: ["cpu", "video-card"],
    });
  }

  if (psu && (cpu || gpu)) {
    const load = estimateLoad(sel);
    if (psu.wattage < load) {
      issues.push({
        level: "error",
        code: "psu-too-small",
        message: `Estimasi beban ${load}W melebihi PSU ${psu.wattage}W. Pakai minimal ${recommendedPsu(load)}W.`,
        categories: ["power-supply"],
      });
    } else if (psu.wattage < load * PSU_HEADROOM) {
      issues.push({
        level: "warning",
        code: "psu-tight",
        message: `PSU ${psu.wattage}W pas-pasan untuk beban ${load}W. Disarankan ${recommendedPsu(load)}W.`,
        categories: ["power-supply"],
      });
    }
  }

  if (cpu?.tdp && cpu.tdp >= 105 && !sel["cpu-cooler"]) {
    issues.push({
      level: "info",
      code: "cooler-suggested",
      message: `${cpu.name} (${cpu.tdp}W) umumnya dijual tanpa cooler bawaan. Pertimbangkan CPU cooler.`,
      categories: ["cpu-cooler"],
    });
  }

  return issues;
}

export function missingRequired(sel: PartSelection): CategoryKey[] {
  return CATEGORIES.filter((c) => c.required && !sel[c.key]).map((c) => c.key);
}

/**
 * Whether a candidate part would introduce an error together with the
 * other parts already chosen. Used by the picker's "compatible only" filter.
 */
export function isCompatibleCandidate(sel: PartSelection, part: Part): boolean {
  const key = part.category;
  const qty = sel[key]?.qty ?? 1;
  const next = { ...sel, [key]: { part, qty } } as PartSelection;
  return !checkBuild(next).some(
    (i) => i.level === "error" && i.categories.includes(key) && i.code !== "no-display",
  );
}
