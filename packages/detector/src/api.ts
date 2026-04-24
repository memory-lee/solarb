import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "node:url";
import { SpreadAnalyzer } from "./spread-analyzer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardPath = resolve(__dirname, "../../dashboard/index.html");

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
      if (url === "/") {
        const html = readFileSync(dashboardPath, "utf-8");
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(html);
      } else if (url === "/api/prices") {
        // Only return prices updated within the last 30s, top 3 most recent per pair.
        const PRICE_MAX_AGE_MS = 30_000;
        const cutoff = Date.now() - PRICE_MAX_AGE_MS;
        const all = analyzer.getLatestPrices();
        const filtered: Record<string, typeof all[string]> = {};
        for (const [pair, prices] of Object.entries(all)) {
          const fresh = prices
            .filter((p) => p.timestamp >= cutoff)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 3);
          if (fresh.length > 0) filtered[pair] = fresh;
        }
        res.writeHead(200);
        res.end(JSON.stringify(filtered));
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
