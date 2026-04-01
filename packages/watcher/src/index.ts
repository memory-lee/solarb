import { TOKEN_PAIRS, POLL_INTERVAL_MS, DexPrice, PriceMessage, createPublisher } from "@solarb/shared";
import { fetchJupiterQuotes } from "./jupiter.js";
import { randomUUID } from "crypto";

const NODE_ID = `watcher-${randomUUID().slice(0, 8)}`;
const P2P_PORT = Number(process.env.WATCHER_P2P_PORT) || 6001;

/**
 * Single poll cycle: fetch prices for all token pairs from Jupiter.
 */
async function pollPrices(): Promise<DexPrice[]> {
  const allPrices: DexPrice[] = [];
  const results = await Promise.allSettled(
    TOKEN_PAIRS.map((pair) => fetchJupiterQuotes(pair))
  );
  for (const result of results) {
    if (result.status === "fulfilled") {
      allPrices.push(...result.value);
    } else {
      console.error("Failed to fetch pair:", result.reason);
    }
  }
  return allPrices;
}

/**
 * Format price data for console output.
 */
function logPrices(prices: DexPrice[]): void {
  const grouped = new Map<string, DexPrice[]>();
  for (const p of prices) {
    const existing = grouped.get(p.pair) || [];
    existing.push(p);
    grouped.set(p.pair, existing);
  }

  console.log(`\n--- ${new Date().toISOString()} | ${NODE_ID} ---`);
  for (const [pair, dexPrices] of grouped) {
    console.log(`  ${pair}:`);
    for (const dp of dexPrices) {
      console.log(`    ${dp.dex.padEnd(14)} ${dp.price.toFixed(6)}`);
    }
    if (dexPrices.length >= 2) {
      const sorted = [...dexPrices].sort((a, b) => a.price - b.price);
      const low = sorted[0];
      const high = sorted[sorted.length - 1];
      const spread = ((high.price - low.price) / low.price) * 100;
      console.log(`    >> spread: ${spread.toFixed(4)}% (${low.dex} → ${high.dex})`);
    }
  }
}

function buildPriceMessage(prices: DexPrice[]): PriceMessage {
  return {
    type: "price_update",
    nodeId: NODE_ID,
    prices,
    timestamp: Date.now(),
  };
}

/**
 * Main loop with P2P publishing.
 */
async function main(): Promise<void> {
  console.log(`[SolArb Watcher] Starting node: ${NODE_ID}`);
  console.log(`[SolArb Watcher] Monitoring ${TOKEN_PAIRS.length} pairs: ${TOKEN_PAIRS.map((p) => p.name).join(", ")}`);
  console.log(`[SolArb Watcher] Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Start P2P publisher (TCP server)
  const publisher = await createPublisher(P2P_PORT);

  // Initial poll
  const prices = await pollPrices();
  logPrices(prices);
  publisher.publish(buildPriceMessage(prices));

  // Continuous polling
  setInterval(async () => {
    try {
      const prices = await pollPrices();
      logPrices(prices);
      publisher.publish(buildPriceMessage(prices));
    } catch (err) {
      console.error("[Watcher] Poll error:", err);
    }
  }, POLL_INTERVAL_MS);
}

main().catch(console.error);
