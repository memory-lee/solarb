import { predictAnomaly } from "./vertex-ai.js";
/**
 * Rolling statistics tracker for a single token pair's spread history.
 * Uses a fixed-size window to compute mean and standard deviation,
 * enabling adaptive threshold detection.
 */
class SpreadHistory {
    spreads = [];
    maxSize;
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
    }
    add(spread) {
        this.spreads.push(spread);
        if (this.spreads.length > this.maxSize) {
            this.spreads.shift();
        }
    }
    get count() {
        return this.spreads.length;
    }
    /** Rolling mean of observed spreads */
    get mean() {
        if (this.spreads.length === 0)
            return 0;
        return this.spreads.reduce((sum, s) => sum + s, 0) / this.spreads.length;
    }
    /** Rolling standard deviation */
    get std() {
        if (this.spreads.length < 2)
            return 0;
        const m = this.mean;
        const variance = this.spreads.reduce((sum, s) => sum + (s - m) ** 2, 0) /
            (this.spreads.length - 1);
        return Math.sqrt(variance);
    }
    /**
     * Adaptive threshold = mean + multiplier * std
     * Falls back to a minimum threshold if not enough data yet.
     */
    getThreshold(multiplier = 2, minThreshold = 0.01) {
        if (this.spreads.length < 10) {
            // Not enough data yet, use minimum threshold
            return minThreshold;
        }
        return Math.max(this.mean + multiplier * this.std, minThreshold);
    }
}
/** Pair index used as the third feature for the Vertex AI model */
const PAIR_INDEX = {
    "SOL/USDC": 0,
    "SOL/USDT": 1,
    "BONK/SOL": 2,
};
export class SpreadAnalyzer {
    /** Per-pair spread history for adaptive thresholds */
    histories = new Map();
    /** Latest prices per pair per DEX */
    priceTable = new Map();
    /** Previous spread per pair, used to compute spread velocity for ML features */
    lastSpread = new Map();
    /** All detected opportunities */
    opportunities = [];
    /** Threshold multiplier (number of std deviations) */
    multiplier;
    /** Minimum spread % to consider as opportunity */
    minThreshold;
    /** Max opportunities to keep in memory */
    maxOpportunities;
    constructor(opts) {
        this.multiplier = opts?.multiplier ?? 2;
        this.minThreshold = opts?.minThreshold ?? 0.005; // 0.005%
        this.maxOpportunities = opts?.maxOpportunities ?? 1000;
    }
    /**
     * Ingest a batch of prices from a single poll cycle and analyze spreads.
     * Runs both statistical detection (mean + 2σ) and Vertex AI anomaly
     * detection in parallel; an opportunity is flagged significant if either
     * one fires. Falls back to stat-only on Vertex AI failure.
     */
    async analyze(prices) {
        // Update price table
        for (const price of prices) {
            if (!this.priceTable.has(price.pair)) {
                this.priceTable.set(price.pair, new Map());
            }
            this.priceTable.get(price.pair).set(price.dex, price);
        }
        const candidates = [];
        for (const [pair, dexPrices] of this.priceTable) {
            const priceList = Array.from(dexPrices.values());
            if (priceList.length < 2)
                continue;
            const sorted = [...priceList].sort((a, b) => a.price - b.price);
            const low = sorted[0];
            const high = sorted[sorted.length - 1];
            const spreadPercent = ((high.price - low.price) / low.price) * 100;
            if (!this.histories.has(pair)) {
                this.histories.set(pair, new SpreadHistory());
            }
            const history = this.histories.get(pair);
            history.add(spreadPercent);
            const threshold = history.getThreshold(this.multiplier, this.minThreshold);
            const statSignificant = spreadPercent > threshold;
            const prev = this.lastSpread.get(pair) ?? spreadPercent;
            const velocity = spreadPercent - prev;
            this.lastSpread.set(pair, spreadPercent);
            candidates.push({ pair, low, high, spreadPercent, velocity, statSignificant });
        }
        // Build ML instances only for pairs the model was trained on
        const instances = [];
        const mlIndices = [];
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const pairIndex = PAIR_INDEX[c.pair];
            if (pairIndex === undefined)
                continue;
            instances.push([c.spreadPercent, c.velocity, pairIndex]);
            mlIndices.push(i);
        }
        let predictions = null;
        if (instances.length > 0) {
            try {
                predictions = await predictAnomaly(instances);
            }
            catch (err) {
                console.error("[VertexAI] Prediction failed, falling back to statistical detection:", err);
                predictions = null;
            }
        }
        const mlFlags = new Map();
        if (predictions) {
            for (let i = 0; i < mlIndices.length; i++) {
                mlFlags.set(mlIndices[i], predictions[i] === -1);
            }
        }
        const newOpportunities = [];
        const now = Date.now();
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const mlDetected = mlFlags.get(i) ?? false;
            const isSignificant = c.statSignificant || mlDetected;
            const opportunity = {
                pair: c.pair,
                buyDex: c.low.dex,
                sellDex: c.high.dex,
                buyPrice: c.low.price,
                sellPrice: c.high.price,
                spreadPercent: c.spreadPercent,
                timestamp: now,
                isSignificant,
                mlDetected,
            };
            newOpportunities.push(opportunity);
            if (isSignificant) {
                this.opportunities.push(opportunity);
                if (this.opportunities.length > this.maxOpportunities) {
                    this.opportunities.shift();
                }
            }
        }
        return newOpportunities;
    }
    /** Get current adaptive thresholds for all pairs */
    getThresholds() {
        const result = {};
        for (const [pair, history] of this.histories) {
            result[pair] = {
                mean: history.mean,
                std: history.std,
                threshold: history.getThreshold(this.multiplier, this.minThreshold),
                samples: history.count,
            };
        }
        return result;
    }
    /** Get all significant opportunities */
    getSignificantOpportunities() {
        return [...this.opportunities];
    }
    /** Get latest prices for all pairs */
    getLatestPrices() {
        const result = {};
        for (const [pair, dexPrices] of this.priceTable) {
            result[pair] = Array.from(dexPrices.values());
        }
        return result;
    }
}
//# sourceMappingURL=spread-analyzer.js.map