const { app } = require("@azure/functions");
const { recentOpportunities } = require("./shared.js");

app.http("getOpportunities", {
  methods: ["GET"],
  route: "opportunities",
  authLevel: "anonymous",
  handler: async () => {
    return {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      jsonBody: {
        count: recentOpportunities.length,
        opportunities: recentOpportunities,
      },
    };
  },
});
