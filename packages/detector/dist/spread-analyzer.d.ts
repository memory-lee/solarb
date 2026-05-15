import { DexPrice, ArbitrageOpportunity } from "@solarb/shared";
export declare class SpreadAnalyzer {
    /** Per-pair spread history for adaptive thresholds */
    private histories;
    /** Latest prices per pair per DEX */
    private priceTable;
    /** Previous spread per pair, used to compute spread velocity for ML features */
    private lastSpread;
    /** All detected opportunities */
    private opportunities;
    /** Threshold multiplier (number of std deviations) */
    private readonly multiplier;
    /** Minimum spread % to consider as opportunity */
    private readonly minThreshold;
    /** Max opportunities to keep in memory */
    private readonly maxOpportunities;
    constructor(opts?: {
        multiplier?: number;
        minThreshold?: number;
        maxOpportunities?: number;
    });
    /**
     * Ingest a batch of prices from a single poll cycle and analyze spreads.
     * Runs both statistical detection (mean + 2σ) and Vertex AI anomaly
     * detection in parallel; an opportunity is flagged significant if either
     * one fires. Falls back to stat-only on Vertex AI failure.
     */
    analyze(prices: DexPrice[]): Promise<ArbitrageOpportunity[]>;
    /** Get current adaptive thresholds for all pairs */
    getThresholds(): Record<string, {
        mean: number;
        std: number;
        threshold: number;
        samples: number;
    }>;
    /** Get all significant opportunities */
    getSignificantOpportunities(): ArbitrageOpportunity[];
    /** Get latest prices for all pairs */
    getLatestPrices(): Record<string, DexPrice[]>;
}
//# sourceMappingURL=spread-analyzer.d.ts.map