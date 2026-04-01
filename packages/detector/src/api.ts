import { createServer, IncomingMessage, ServerResponse } from "http";
import { SpreadAnalyzer } from "./spread-analyzer.js";

/**
 * Simple REST API server for the dashboard.
 * No external dependencies — uses Node.js built-in http module.
 */
export function startApiServer(analyzer: SpreadAnalyzer, port = 3000): void {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // CORS headers for dashboard frontend
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || "/";

    try {
      if (url === "/api/prices") {
        // Current prices for all pairs
        res.writeHead(200);
        res.end(JSON.stringify(analyzer.getLatestPrices()));
      } else if (url === "/api/opportunities") {
        // Significant arbitrage opportunities
        res.writeHead(200);
        res.end(JSON.stringify(analyzer.getSignificantOpportunities()));
      } else if (url === "/api/thresholds") {
        // Current adaptive thresholds
        res.writeHead(200);
        res.end(JSON.stringify(analyzer.getThresholds()));
      } else if (url === "/api/status") {
        // System status
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: "running",
            uptime: process.uptime(),
            pairs: Object.keys(analyzer.getLatestPrices()),
            opportunityCount: analyzer.getSignificantOpportunities().length,
          })
        );
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (err) {
      console.error("[API] Error:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });

  server.listen(port, () => {
    console.log(`[SolArb API] Listening on http://localhost:${port}`);
  });
}
