import { describe, expect, it } from "vitest";
import { boardSize, caseMaxBoard, checkBuild, isCompatibleCandidate, missingRequired } from "./compat";
import {
  airCooler, atxCase, b550itx, b650, ddr4kit, ddr5kit, itxCase, psu300, psu650, rtx5060, ryzen5600x, ryzen7600x,
} from "./fixtures";
import { estimateGpuTdp, estimateLoad, recommendedPsu } from "./power";
import type { PartSelection } from "./types";

const codes = (sel: PartSelection) => checkBuild(sel).map((i) => i.code);

const goodBuild: PartSelection = {
  cpu: { part: ryzen7600x, qty: 1 },
  motherboard: { part: b650, qty: 1 },
  memory: { part: ddr5kit, qty: 1 },
  "video-card": { part: rtx5060, qty: 1 },
  "power-supply": { part: psu650, qty: 1 },
  case: { part: atxCase, qty: 1 },
};

describe("checkBuild", () => {
  it("passes a matching AM5 build, only hinting that this CPU ships without a cooler", () => {
    expect(checkBuild(goodBuild).filter((i) => i.level !== "info")).toEqual([]);
    expect(codes(goodBuild)).toContain("cooler-suggested");
    expect(codes({ ...goodBuild, "cpu-cooler": { part: airCooler, qty: 1 } })).not.toContain("cooler-suggested");
    expect(codes({ cpu: { part: ryzen5600x, qty: 1 }, "video-card": { part: rtx5060, qty: 1 } })).not.toContain("cooler-suggested");
  });

  it("flags socket mismatch", () => {
    expect(codes({ ...goodBuild, motherboard: { part: b550itx, qty: 1 } })).toContain("socket-mismatch");
  });

  it("flags DDR mismatch against the board", () => {
    expect(codes({ ...goodBuild, memory: { part: ddr4kit, qty: 1 } })).toContain("ddr-mismatch");
  });

  it("flags DDR mismatch against the CPU memory controller when no board is chosen", () => {
    const noBoard = { ...goodBuild };
    delete noBoard.motherboard;
    expect(codes({ ...noBoard, memory: { part: ddr4kit, qty: 1 } })).toContain("ddr-cpu-mismatch");
  });

  it("flags too many RAM sticks and too much capacity", () => {
    const sel: PartSelection = { motherboard: { part: b550itx, qty: 1 }, memory: { part: { ...ddr4kit, moduleGb: 32, totalGb: 64 }, qty: 2 } };
    expect(codes(sel)).toEqual(expect.arrayContaining(["ram-slots", "ram-capacity"]));
  });

  it("checks the board against the case's supported form factors", () => {
    expect(codes({ ...goodBuild, case: { part: itxCase, qty: 1 } })).toContain("case-size");
    expect(codes({ motherboard: { part: b550itx, qty: 1 }, case: { part: itxCase, qty: 1 } })).not.toContain("case-size");
    expect(codes({ motherboard: { part: { ...b550itx, formFactor: "Thin Mini ITX" }, qty: 1 }, case: { part: itxCase, qty: 1 } })).not.toContain("case-size");
  });

  it("falls back to the case type when the case lists no boards", () => {
    const bare = { ...itxCase, supportedBoards: [] };
    expect(codes({ ...goodBuild, case: { part: bare, qty: 1 } })).toContain("case-size");
  });

  it("checks GPU length against the case", () => {
    expect(codes({ ...goodBuild, "video-card": { part: { ...rtx5060, length: 336 }, qty: 1 }, case: { part: itxCase, qty: 1 } })).toContain("gpu-length");
    expect(codes(goodBuild)).not.toContain("gpu-length");
  });

  it("checks cooler socket support and height", () => {
    const withCooler = { ...goodBuild, "cpu-cooler": { part: airCooler, qty: 1 } };
    expect(codes(withCooler)).not.toEqual(expect.arrayContaining(["cooler-socket", "cooler-height"]));
    expect(codes({ ...withCooler, "cpu-cooler": { part: { ...airCooler, sockets: ["LGA1700"] }, qty: 1 } })).toContain("cooler-socket");
    expect(codes({ ...withCooler, case: { part: { ...atxCase, maxCoolerHeight: 150 }, qty: 1 } })).toContain("cooler-height");
    const aio = { ...airCooler, waterCooled: true, radiator: 240, height: 200 };
    expect(codes({ ...withCooler, "cpu-cooler": { part: aio, qty: 1 }, case: { part: { ...atxCase, maxCoolerHeight: 150 }, qty: 1 } })).not.toContain("cooler-height");
  });

  it("requires a GPU when the CPU has no integrated graphics", () => {
    expect(codes({ cpu: { part: ryzen5600x, qty: 1 } })).toContain("no-display");
    expect(codes({ cpu: { part: ryzen5600x, qty: 1 }, "video-card": { part: rtx5060, qty: 1 } })).not.toContain("no-display");
  });

  it("checks PSU against the estimated load", () => {
    expect(codes({ ...goodBuild, "power-supply": { part: psu300, qty: 1 } })).toContain("psu-too-small");
    expect(codes({ ...goodBuild, "power-supply": { part: { ...psu650, wattage: 350 }, qty: 1 } })).toContain("psu-tight");
  });

  it("lists missing required slots", () => {
    expect(missingRequired(goodBuild)).toEqual(["internal-hard-drive"]);
  });
});

describe("isCompatibleCandidate", () => {
  it("filters boards by the chosen CPU socket", () => {
    const sel: PartSelection = { cpu: { part: ryzen7600x, qty: 1 } };
    expect(isCompatibleCandidate(sel, b650)).toBe(true);
    expect(isCompatibleCandidate(sel, b550itx)).toBe(false);
  });

  it("does not hide iGPU-less CPUs just because no GPU is chosen yet", () => {
    expect(isCompatibleCandidate({}, ryzen5600x)).toBe(true);
  });

  it("hides PSUs below the load and GPUs too long for the case", () => {
    expect(isCompatibleCandidate(goodBuild, psu300)).toBe(false);
    expect(isCompatibleCandidate({ case: { part: itxCase, qty: 1 } }, { ...rtx5060, length: 300 })).toBe(false);
  });
});

describe("form factors", () => {
  it("ranks boards and cases", () => {
    expect(boardSize("Mini ITX")).toBe(1);
    expect(boardSize("Micro ATX")).toBe(2);
    expect(boardSize("ATX")).toBe(3);
    expect(boardSize("EATX")).toBe(4);
    expect(caseMaxBoard("Micro ATX Mini Tower")).toBe(2);
    expect(caseMaxBoard("ATX Full Tower")).toBe(4);
    expect(caseMaxBoard("HTPC")).toBeNull();
  });
});

describe("power", () => {
  it("estimates GPU power from the chipset when OpenDB has none", () => {
    expect(estimateGpuTdp("GeForce RTX 4070 SUPER")).toBe(220);
    expect(estimateGpuTdp("GeForce RTX 4070")).toBe(200);
    expect(estimateGpuTdp("Radeon RX 7900 XTX")).toBe(355);
    expect(estimateGpuTdp("Unknown Chip")).toBe(200);
  });

  it("estimates load and PSU size", () => {
    expect(estimateLoad(goodBuild)).toBe(105 + 145 + 80);
    expect(recommendedPsu(330)).toBe(450);
  });
});
