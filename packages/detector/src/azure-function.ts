import { ArbitrageOpportunity } from "@solarb/shared";

const AZURE_FUNCTION_URL =
  "https://solarb-alerts.azurewebsites.net/api/logopportunity";

export async function logToAzure(opp: ArbitrageOpportunity): Promise<void> {
  try {
    await fetch(AZURE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pair: opp.pair,
        spreadPercent: opp.spreadPercent,
        buyDex: opp.buyDex,
        sellDex: opp.sellDex,
        buyPrice: opp.buyPrice,
        sellPrice: opp.sellPrice,
        mlDetected: opp.mlDetected,
        timestamp: opp.timestamp,
      }),
    });
  } catch (err) {
    console.error("[AzureFunc] Log failed:", err);
  }
}
