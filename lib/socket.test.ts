import { describe, expect, it } from "vitest";
import { deriveBoardDdr, deriveCpuSocket, socketFits } from "./socket";

describe("deriveCpuSocket", () => {
  it.each([
    ["AMD Ryzen 7 9800X3D", "Zen 5", "AM5"],
    ["AMD Ryzen 5 5600X", "Zen 3", "AM4"],
    ["Intel Core i5-12400F", "Alder Lake", "LGA1700"],
    ["Intel Core Ultra 7 265K", "Arrow Lake", "LGA1851"],
    ["Intel Core i9-10900K", "Comet Lake", "LGA1200"],
    ["Intel Core i9-10900X", "Cascade Lake", "LGA2066"],
    ["Intel Core i9-7900X", "Skylake", "LGA2066"],
    ["Intel Core i7-6700K", "Skylake", "LGA1151"],
    ["Intel Core i7-6950X", "Broadwell", "LGA2011-3"],
    ["AMD Threadripper 3970X", "Zen 2", "sTRX4"],
    ["AMD Threadripper 1950X", "Zen", "sTR4"],
    ["AMD FX-8350", "Piledriver", "AM3+"],
  ])("%s -> %s", (name, arch, socket) => {
    expect(deriveCpuSocket(name, arch)).toBe(socket);
  });

  it("returns null for server chips and unknown architectures", () => {
    expect(deriveCpuSocket("Intel Xeon E5-2699 V4", "Broadwell")).toBeNull();
    expect(deriveCpuSocket("AMD A10-7850K", "Steamroller")).toBeNull();
  });
});

describe("boards", () => {
  it("matches multi-socket strings", () => {
    expect(socketFits("AM3", "AM3+/AM3")).toBe(true);
    expect(socketFits("LGA2011-3", "2 x LGA2011-3 Narrow")).toBe(true);
    expect(socketFits("AM4", "AM5")).toBe(false);
  });

  it("derives DDR generation", () => {
    expect(deriveBoardDdr("MSI B650 GAMING PLUS WIFI", "AM5")).toBe(5);
    expect(deriveBoardDdr("MSI PRO B760M-A DDR4", "LGA1700")).toBe(4);
    expect(deriveBoardDdr("Gigabyte B760M DS3H D4", "LGA1700")).toBe(4);
    expect(deriveBoardDdr("Asus PRIME B760M-A WIFI", "LGA1700")).toBe(5);
    expect(deriveBoardDdr("Asus PRIME B550M-A", "AM4")).toBe(4);
  });
});
