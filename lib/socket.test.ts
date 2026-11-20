import { describe, expect, it } from "vitest";
import { boardSocket, ddrNumber, normalizeSocket, socketFits } from "./socket";

describe("sockets", () => {
  it("normalizes OpenDB spellings", () => {
    expect(normalizeSocket("LGA 1700")).toBe("LGA1700");
    expect(normalizeSocket("LGA 1151v2")).toBe("LGA1151");
    expect(normalizeSocket("LGA 2011-3 Narrow")).toBe("LGA2011-3");
    expect(normalizeSocket("TR4")).toBe("sTR4");
    expect(normalizeSocket("AM5")).toBe("AM5");
  });

  it("reads dual-socket boards", () => {
    expect(boardSocket("2 x LGA 2011-3")).toBe("LGA2011-3");
  });

  it("matches CPU and board sockets across spellings", () => {
    expect(socketFits("LGA1700", "LGA 1700")).toBe(true);
    expect(socketFits("sTR4", "TR4")).toBe(true);
    expect(socketFits("AM4", "AM5")).toBe(false);
  });

  it("parses DDR generations", () => {
    expect(ddrNumber("DDR5")).toBe(5);
    expect(ddrNumber("ddr4")).toBe(4);
    expect(ddrNumber("GDDR6")).toBeNull();
    expect(ddrNumber(undefined)).toBeNull();
  });
});
