import {
  TOKEN_PAIRS,
  DexPrice,
  PriceMessage,
  createSubscriber,
} from "@solarb/shared";
import { SpreadAnalyzer } from "./spread-analyzer.js";
import { startApiServer } from "./api.js";
import { saveOpportunity } from "./dynamodb.js";

const WATCHER_HOST = process.env.WATCHER_HOST || "127.0.0.1";
const WATCHER_PORT = Number(process.env.WATCHER_PORT) || 6001;

const analyzer = new SpreadAnalyzer({
  multiplier: 2, // 2 standard deviations
  minThreshold: 0.005, // 0.005% minimum threshold
});

/**
 * Process incoming prices: analyze spreads, log, and persist significant ones.
 */
function processPrices(prices: DexPrice[]): void {
  if (prices.length === 0) return;

  const opportunities = analyzer.analyze(prices);
  logAnalysis(opportunities);
}

/**
 * Format and log analysis results.
 */
function logAnalysis(
  opportunities: ReturnType<SpreadAnalyzer["analyze"]>
): void {
  const timestamp = new Date().toISOString();
  console.log(`\n--- ${timestamp} | SolArb Detector ---`);

  // Group by pair
  const byPair = new Map<string, typeof opportunities>();
  for (const opp of opportunities) {
    const list = byPair.get(opp.pair) || [];
    list.push(opp);
    byPair.set(opp.pair, list);
  }

  const thresholds = analyzer.getThresholds();

  for (const [pair, opps] of byPair) {
    const opp = opps[0]; // One per pair
    const th = thresholds[pair];
    const flag = opp.isSignificant ? " ** ALERT **" : "";

    console.log(`  ${pair}:`);
    console.log(
      `    spread: ${opp.spreadPercent.toFixed(4)}% (${opp.buyDex} @ ${opp.buyPrice.toFixed(6)} → ${opp.sellDex} @ ${opp.sellPrice.toFixed(6)})${flag}`
    );
    if (th) {
      console.log(
        `    threshold: ${th.threshold.toFixed(4)}% (mean=${th.mean.toFixed(4)}%, std=${th.std.toFixed(4)}%, samples=${th.samples})`
      );
    }
  }

  // Count significant and persist
  const significant = opportunities.filter((o) => o.isSignificant);
  if (significant.length > 0) {
    console.log(
      `\n  >> ${significant.length} significant opportunity(ies) detected!`
    );

    // Write to DynamoDB
    for (const opp of significant) {
      saveOpportunity(opp).catch((err) =>
        console.error("[DynamoDB] Save failed:", err)
      );
    }

    // TODO: Send SNS notification
  }
}

/**
 * Main entry point — connect to Watcher via P2P and process price feeds.
 */
async function main(): Promise<void> {
  console.log("[SolArb Detector] Starting...");
  console.log(
    `[SolArb Detector] Monitoring ${TOKEN_PAIRS.length} pairs: ${TOKEN_PAIRS.map((p) => p.name).join(", ")}`
  );
  console.log(
    `[SolArb Detector] Adaptive threshold: mean + ${2}σ, min=${0.005}%`
  );

  // Start REST API server
  const apiPort = Number(process.env.API_PORT) || 3000;
  startApiServer(analyzer, apiPort);

  // Connect to Watcher via P2P (TCP subscriber with auto-reconnect)
  let messageCount = 0;
  createSubscriber(
    { host: WATCHER_HOST, port: WATCHER_PORT },
    (msg: PriceMessage) => {
      messageCount++;
      console.log(
        `[P2P] Received ${msg.prices.length} prices from ${msg.nodeId} (msg #${messageCount})`
      );
      processPrices(msg.prices);
    }
  );
}

main().catch(console.error);
