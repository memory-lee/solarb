import { DexPrice, ArbitrageOpportunity } from "@solarb/shared";
export declare class SpreadAnalyzer {
    /** Per-pair spread history for adaptive thresholds */
    private histories;
    /** Latest prices per pair per DEX */
    private priceTable;
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
     * Returns any new arbitrage opportunities detected.
     */
    analyze(prices: DexPrice[]): ArbitrageOpportunity[];
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