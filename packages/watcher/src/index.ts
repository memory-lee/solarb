import {
  TOKEN_PAIRS,
  POLL_INTERVAL_MS,
  DexPrice,
  PriceMessage,
  createP2PNode,
  publishPrices,
  subscribePrices,
} from "@solarb/shared";
import { fetchJupiterQuotes } from "./jupiter.js";
import { randomUUID } from "crypto";

const NODE_ID = `watcher-${randomUUID().slice(0, 8)}`;
const P2P_PORT = Number(process.env.WATCHER_P2P_PORT) || 6001;
const SIMULATE = process.env.SIMULATE === "true";

const simulatedKeys = new Set<string>();
let cycleCount = 0;
let nextInjectAt = pickNextInjectCycle();

function pickNextInjectCycle(): number {
  return cycleCount + 3 + Math.floor(Math.random() * 2);
}

/**
 * Inject a synthetic spread on a random pair by scaling one DEX's price
 * by 1.02–1.05x. Mutates the array in place and records which entries
 * were tampered with so they can be flagged in the log.
 */
function injectSimulatedSpread(prices: DexPrice[]): void {
  const byPair = new Map<string, DexPrice[]>();
  for (const p of prices) {
    const arr = byPair.get(p.pair) || [];
    arr.push(p);
    byPair.set(p.pair, arr);
  }
  const eligiblePairs = [...byPair.entries()].filter(([, arr]) => arr.length >= 2);
  if (eligiblePairs.length === 0) return;

  const [pair, dexPrices] = eligiblePairs[Math.floor(Math.random() * eligiblePairs.length)];
  const target = dexPrices[Math.floor(Math.random() * dexPrices.length)];
  const factor = 1.02 + Math.random() * 0.03;
  const original = target.price;
  target.price = original * factor;
  simulatedKeys.add(`${target.pair}|${target.dex}`);
  console.log(
    `[SolArb Watcher] [SIMULATED] ${pair} ${target.dex} price ${original.toFixed(6)} → ${target.price.toFixed(6)} (x${factor.toFixed(4)})`
  );
}

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
      const tag = simulatedKeys.has(`${dp.pair}|${dp.dex}`) ? " [SIMULATED]" : "";
      console.log(`    ${dp.dex.padEnd(14)} ${dp.price.toFixed(6)}${tag}`);
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

async function runCycle(node: Awaited<ReturnType<typeof createP2PNode>>): Promise<void> {
  const prices = await pollPrices();
  simulatedKeys.clear();
  cycleCount += 1;
  if (SIMULATE && cycleCount >= nextInjectAt) {
    injectSimulatedSpread(prices);
    nextInjectAt = pickNextInjectCycle();
  }
  logPrices(prices);
  await publishPrices(node, buildPriceMessage(prices));
}

async function main(): Promise<void> {
  console.log(`[SolArb Watcher] Starting node: ${NODE_ID}`);
  if (SIMULATE) {
    console.log(`[SolArb Watcher] SIMULATION MODE ENABLED`);
  }
  console.log(`[SolArb Watcher] Monitoring ${TOKEN_PAIRS.length} pairs: ${TOKEN_PAIRS.map((p) => p.name).join(", ")}`);
  console.log(`[SolArb Watcher] Poll interval: ${POLL_INTERVAL_MS}ms`);

  const bootstrapPeers = process.env.BOOTSTRAP_PEERS?.split(",").filter(Boolean) || [];

  const node = await createP2PNode({
    listenPort: P2P_PORT,
    nodeName: NODE_ID,
    bootstrapPeers,
  });

  // Watcher also subscribes so gossipsub can form a mesh with peers.
  subscribePrices(node, () => {});

  await runCycle(node);

  setInterval(() => {
    runCycle(node).catch((err) => console.error("[Watcher] Poll error:", err));
  }, POLL_INTERVAL_MS);
}

main().catch(console.error);
