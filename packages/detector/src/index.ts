import {
  TOKEN_PAIRS,
  DexPrice,
  PriceMessage,
  createP2PNode,
  subscribePrices,
} from "@solarb/shared";
import { SpreadAnalyzer } from "./spread-analyzer.js";
import { startApiServer } from "./api.js";
import { saveOpportunity } from "./dynamodb.js";
import { sendAlert } from "./sns.js";

const DETECTOR_P2P_PORT = Number(process.env.DETECTOR_P2P_PORT) || 6002;

const analyzer = new SpreadAnalyzer({
  multiplier: 2, // 2 standard deviations
  minThreshold: 0.02, // 0.02% minimum threshold
});

/**
 * Process incoming prices: analyze spreads, log, and persist significant ones.
 */
async function processPrices(prices: DexPrice[]): Promise<void> {
  if (prices.length === 0) return;

  const opportunities = await analyzer.analyze(prices);
  logAnalysis(opportunities);
}

/**
 * Format and log analysis results.
 */
function logAnalysis(
  opportunities: Awaited<ReturnType<SpreadAnalyzer["analyze"]>>
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
    const statDetected = th ? opp.spreadPercent > th.threshold : false;
    let source = "";
    if (opp.isSignificant) {
      if (statDetected && opp.mlDetected) source = "BOTH";
      else if (opp.mlDetected) source = "ML";
      else source = "STAT";
    }
    const flag = opp.isSignificant ? ` ** ALERT [${source}] **` : "";

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

    // Write to DynamoDB & send SNS alert
    for (const opp of significant) {
      saveOpportunity(opp).catch((err) =>
        console.error("[DynamoDB] Save failed:", err)
      );
      sendAlert(opp).catch((err) =>
        console.error("[SNS] Alert failed:", err)
      );
    }
  }
}

/**
 * Main entry point — connect to Watcher via P2P and process price feeds.
 */
async function main(): Promise<void> {
  const apiPort = Number(process.env.PORT) || Number(process.env.API_PORT) || 3000;
  startApiServer(analyzer, apiPort);

  console.log("[SolArb Detector] Starting...");
  console.log(
    `[SolArb Detector] Monitoring ${TOKEN_PAIRS.length} pairs: ${TOKEN_PAIRS.map((p) => p.name).join(", ")}`
  );
  console.log(
    `[SolArb Detector] Adaptive threshold: mean + ${2}σ, min=${0.005}%`
  );

  try {
    const bootstrapPeers = process.env.BOOTSTRAP_PEERS?.split(",").filter(Boolean) || [];

    const node = await createP2PNode({
      listenPort: DETECTOR_P2P_PORT,
      nodeName: "detector",
      bootstrapPeers,
    });

    let messageCount = 0;
    subscribePrices(node, (msg: PriceMessage) => {
      messageCount++;
      console.log(
        `[P2P] Received ${msg.prices.length} prices from ${msg.nodeId} (msg #${messageCount})`
      );
      processPrices(msg.prices).catch((err) =>
        console.error("[Detector] processPrices failed:", err)
      );
    });
  } catch (err) {
    console.error("[P2P] Initialization failed, continuing with REST API only:", err);
  }
}

main().catch(console.error);
