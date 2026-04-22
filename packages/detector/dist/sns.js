import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
const client = new SNSClient({
    region: process.env.AWS_REGION || "us-east-2",
});
const TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";
/** Last alert timestamp per pair – used for 5-minute cooldown. */
const lastAlertTime = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
/**
 * Publish an SNS alert for a significant arbitrage opportunity.
 * Enforces a 5-minute cooldown per token pair.
 */
export async function sendAlert(opp) {
    const now = Date.now();
    const last = lastAlertTime.get(opp.pair);
    if (last && now - last < COOLDOWN_MS) {
        return; // cooldown active
    }
    if (!TOPIC_ARN) {
        console.warn("[SNS] SNS_TOPIC_ARN not set, skipping alert");
        return;
    }
    const message = [
        `🚨 SolArb Alert: ${opp.pair}`,
        ``,
        `Spread:    ${opp.spreadPercent.toFixed(4)}%`,
        `Buy DEX:   ${opp.buyDex} @ ${opp.buyPrice.toFixed(6)}`,
        `Sell DEX:  ${opp.sellDex} @ ${opp.sellPrice.toFixed(6)}`,
        `Timestamp: ${new Date(opp.timestamp).toISOString()}`,
    ].join("\n");
    await client.send(new PublishCommand({
        TopicArn: TOPIC_ARN,
        Subject: `SolArb Alert: ${opp.pair} ${opp.spreadPercent.toFixed(2)}%`,
        Message: message,
    }));
    lastAlertTime.set(opp.pair, now);
    console.log(`[SNS] Alert sent for ${opp.pair}`);
}
//# sourceMappingURL=sns.js.map