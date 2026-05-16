const { app } = require("@azure/functions");
const { recentOpportunities, MAX_STORED } = require("./shared.js");

app.http("logOpportunity", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();

      const opportunity = {
        pair: body.pair,
        spreadPercent: body.spreadPercent,
        buyDex: body.buyDex,
        sellDex: body.sellDex,
        buyPrice: body.buyPrice,
        sellPrice: body.sellPrice,
        mlDetected: body.mlDetected,
        timestamp: body.timestamp,
        processedAt: new Date().toISOString(),
      };

      recentOpportunities.push(opportunity);
      if (recentOpportunities.length > MAX_STORED) {
        recentOpportunities.shift();
      }

      context.log(`Logged opportunity: ${opportunity.pair} ${opportunity.spreadPercent}%`);

      return {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        jsonBody: { ok: true },
      };
    } catch (err) {
      context.log.error("Failed to log opportunity:", err);
      return {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        jsonBody: { ok: false, error: String(err) },
      };
    }
  },
});
