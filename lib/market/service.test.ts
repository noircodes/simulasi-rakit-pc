import { beforeEach, describe, expect, it, vi } from "vitest";
import { ryzen7600x } from "../fixtures";
import { ProviderBusyError, type MarketProvider, type RunState } from "./provider";

const state: { run: RunState; starts: number; lastSearch: unknown; busy: boolean } = {
  busy: false,
  run: { status: "running" },
  starts: 0,
  lastSearch: null,
};

const fakeProvider: MarketProvider = {
  name: "fake",
  start: async (search) => {
    if (state.busy) throw new ProviderBusyError();
    state.starts++;
    state.lastSearch = search;
    return `run${state.starts}abcdef`;
  },
  poll: async () => state.run,
};

vi.mock("../server-data", () => ({
  findPart: async (_c: string, id: string) => (id === ryzen7600x.id ? ryzen7600x : null),
  getRateSafe: async () => ({ rate: 10_000, source: "test", updatedAt: "" }),
}));
vi.mock("./apify-tokopedia", () => ({ getMarketProvider: () => fakeProvider }));

process.env.MARKET_DAILY_LIMIT = "1000";
const { lookup, pollRun } = await import("./service");

const listing = (title: string, priceIdr: number) => ({
  title, priceIdr, url: "https://www.tokopedia.com/x", shopName: null, shopCity: null, shopType: null,
  soldCount: null, rating: null, isAd: false,
});

describe("market service", () => {
  beforeEach(() => {
    state.run = { status: "running" };
  });

  it("peek misses without starting a paid run", async () => {
    const res = await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "used", peek: true, ip: "1.1.1.1" });
    expect(res).toEqual({ status: "miss", query: "AMD Ryzen 5 7600X" });
    expect(state.starts).toBe(0);
  });

  it("starts a run, polls it, caches the result", async () => {
    const started = await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "used", ip: "1.1.1.1" });
    expect(started.status).toBe("running");
    expect(state.lastSearch).toMatchObject({ query: "AMD Ryzen 5 7600X", condition: "used" });
    const runId = (started as { runId: string }).runId;

    // A second user asking at the same time joins the same run.
    expect(await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "used", ip: "2.2.2.2" })).toEqual(started);
    expect(state.starts).toBe(1);

    expect(await pollRun(runId)).toEqual({ status: "running", runId });

    state.run = {
      status: "succeeded",
      listings: [
        listing("Ryzen 5 7600X second", 2_400_000),
        listing("AMD Ryzen 5 7600X bekas mulus", 2_600_000),
        listing("Ryzen 5 7600X tray", 2_500_000),
      ],
    };
    const done = await pollRun(runId);
    expect(done).toMatchObject({ status: "done", cached: false, result: { stats: { median: 2_500_000, count: 3 } } });

    const cached = await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "used", peek: true, ip: "3.3.3.3" });
    expect(cached).toMatchObject({ status: "done", cached: true });
    expect(state.starts).toBe(1);
  });

  it("frees the slot when a run fails so it can be retried", async () => {
    const started = await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "new", ip: "4.4.4.4" });
    state.run = { status: "failed", error: "Run aborted" };
    expect(await pollRun((started as { runId: string }).runId)).toMatchObject({ status: "failed" });
    const retry = await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "new", ip: "4.4.4.4" });
    expect(retry.status).toBe("running");
    expect((retry as { runId: string }).runId).not.toBe((started as { runId: string }).runId);
  });

  it("rate limits paid lookups per IP", async () => {
    let last;
    for (let i = 0; i < 21; i++) {
      last = await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "new", query: `q${i}`, ip: "9.9.9.9" });
    }
    expect(last).toMatchObject({ status: "limited", error: expect.stringContaining("per jam") });
  });

  it("reports busy when the provider is at its concurrent run limit", async () => {
    state.busy = true;
    const res = await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "new", query: "busy test", ip: "5.5.5.5" });
    state.busy = false;
    expect(res).toEqual({ status: "busy" });
  });

  it("stops at the daily quota", async () => {
    process.env.MARKET_DAILY_LIMIT = "1";
    const res = await lookup({ category: "cpu", partId: ryzen7600x.id, condition: "new", query: "daily", ip: "6.6.6.6" });
    process.env.MARKET_DAILY_LIMIT = "1000";
    expect(res).toMatchObject({ status: "limited", error: expect.stringContaining("hari ini") });
  });

  it("rejects unknown runs and parts", async () => {
    expect(await pollRun("nope12345678")).toBeNull();
    expect(await lookup({ category: "cpu", partId: "missing", condition: "new", ip: "1.1.1.1" })).toMatchObject({ status: "failed" });
  });
});
