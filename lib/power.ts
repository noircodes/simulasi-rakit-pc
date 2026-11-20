import type { PartSelection } from "./types";

/**
 * Board power by GPU chipset (vendor reference TGP/TBP, watts).
 * More specific names come first: "4070 Ti SUPER" before "4070 Ti" before "4070".
 */
const GPU_TDP: [RegExp, number][] = [
  [/rtx 5090/, 575], [/rtx 5080/, 360], [/rtx 5070 ti/, 300], [/rtx 5070/, 250],
  [/rtx 5060 ti/, 180], [/rtx 5060/, 145], [/rtx 5050/, 130],
  [/rtx 4090/, 450], [/rtx 4080/, 320], [/rtx 4070 ti/, 285], [/rtx 4070 super/, 220],
  [/rtx 4070/, 200], [/rtx 4060 ti/, 165], [/rtx 4060/, 115],
  [/rtx 3090 ti/, 450], [/rtx 3090/, 350], [/rtx 3080 ti/, 350], [/rtx 3080/, 320],
  [/rtx 3070 ti/, 290], [/rtx 3070/, 220], [/rtx 3060 ti/, 200], [/rtx 3060/, 170], [/rtx 3050/, 130],
  [/rtx 2080 ti/, 250], [/rtx 2080/, 225], [/rtx 2070/, 195], [/rtx 2060/, 165],
  [/gtx 16[56]0/, 120], [/gtx 1080 ti/, 250], [/gtx 1080/, 180], [/gtx 1070/, 160],
  [/gtx 1060/, 120], [/gtx 1050/, 75], [/gt \d{3,4}/, 50],
  [/rx 9070 xt/, 304], [/rx 9070/, 220], [/rx 9060 xt/, 160],
  [/rx 7900 xtx/, 355], [/rx 7900 xt/, 315], [/rx 7900/, 260], [/rx 7800 xt/, 263],
  [/rx 7700 xt/, 245], [/rx 7600 xt/, 190], [/rx 7600/, 165],
  [/rx 69[05]0 xt/, 320], [/rx 6800 xt/, 300], [/rx 6800/, 250], [/rx 67[05]0/, 230],
  [/rx 6650 xt/, 180], [/rx 6600/, 150], [/rx 6500/, 107], [/rx 6400/, 53],
  [/rx 5700/, 210], [/rx 5600/, 150], [/rx 5500/, 130],
  [/rx 590/, 225], [/rx 580/, 185], [/rx 570/, 150], [/rx 5[56]0/, 70],
  [/arc b580/, 190], [/arc b570/, 150], [/arc a7[57]0/, 225], [/arc a580/, 185], [/arc a3\d0/, 75],
];

export const DEFAULT_GPU_TDP = 200;
/** Board, RAM, drives and fans. */
export const BASE_SYSTEM_WATTS = 80;
export const PSU_HEADROOM = 1.3;

export function estimateGpuTdp(chipset: string): number {
  const c = chipset.toLowerCase().replace(/geforce |radeon |intel /g, "");
  return GPU_TDP.find(([re]) => re.test(c))?.[1] ?? DEFAULT_GPU_TDP;
}

export function estimateLoad(sel: PartSelection): number {
  const cpu = sel.cpu ? sel.cpu.part.tdp ?? 65 : 0;
  const gpu = sel["video-card"]?.part.tdp ?? 0;
  return cpu + gpu + BASE_SYSTEM_WATTS;
}

export function recommendedPsu(load: number): number {
  return Math.ceil((load * PSU_HEADROOM) / 50) * 50;
}
