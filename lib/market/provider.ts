import type { Condition, MarketListing } from "../types";

export interface MarketSearch {
  query: string;
  condition: Condition;
  priceMin?: number;
  priceMax?: number;
}

export type RunState =
  | { status: "running" }
  | { status: "failed"; error: string }
  | { status: "succeeded"; listings: MarketListing[] };

/**
 * A marketplace price source. Searches are asynchronous: start() returns a
 * run id and poll() is called until the run settles. Swapping the scraper
 * (another Apify actor, another marketplace) only means a new implementation.
 */
export interface MarketProvider {
  readonly name: string;
  start(search: MarketSearch): Promise<string>;
  poll(runId: string): Promise<RunState>;
}

/** The provider refused a new run because too many are running (Apify free plan: 5 concurrent). */
export class ProviderBusyError extends Error {
  constructor(message = "Provider is busy") {
    super(message);
    this.name = "ProviderBusyError";
  }
}
