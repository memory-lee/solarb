import { DexPrice, ArbitrageOpportunity } from "@solarb/shared";

/**
 * Rolling statistics tracker for a single token pair's spread history.
 * Uses a fixed-size window to compute mean and standard deviation,
 * enabling adaptive threshold detection.
 */
class SpreadHistory {
  private spreads: number[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  add(spread: number): void {
    this.spreads.push(spread);
    if (this.spreads.length > this.maxSize) {
      this.spreads.shift();
    }
  }

  get count(): number {
    return this.spreads.length;
  }

  /** Rolling mean of observed spreads */
  get mean(): number {
    if (this.spreads.length === 0) return 0;
    return this.spreads.reduce((sum, s) => sum + s, 0) / this.spreads.length;
  }

  /** Rolling standard deviation */
  get std(): number {
    if (this.spreads.length < 2) return 0;
    const m = this.mean;
    const variance =
      this.spreads.reduce((sum, s) => sum + (s - m) ** 2, 0) /
      (this.spreads.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Adaptive threshold = mean + multiplier * std
   * Falls back to a minimum threshold if not enough data yet.
   */
  getThreshold(multiplier = 2, minThreshold = 0.01): number {
    if (this.spreads.length < 10) {
      // Not enough data yet, use minimum threshold
      return minThreshold;
    }
    return Math.max(this.mean + multiplier * this.std, minThreshold);
  }
}

export class SpreadAnalyzer {
  /** Per-pair spread history for adaptive thresholds */
  private histories = new Map<string, SpreadHistory>();
  /** Latest prices per pair per DEX */
  private priceTable = new Map<string, Map<string, DexPrice>>();
  /** All detected opportunities */
  private opportunities: ArbitrageOpportunity[] = [];

  /** Threshold multiplier (number of std deviations) */
  private readonly multiplier: number;
  /** Minimum spread % to consider as opportunity */
  private readonly minThreshold: number;
  /** Max opportunities to keep in memory */
  private readonly maxOpportunities: number;

  constructor(opts?: {
    multiplier?: number;
    minThreshold?: number;
    maxOpportunities?: number;
  }) {
    this.multiplier = opts?.multiplier ?? 2;
    this.minThreshold = opts?.minThreshold ?? 0.005; // 0.005%
    this.maxOpportunities = opts?.maxOpportunities ?? 1000;
  }

  /**
   * Ingest a batch of prices from a single poll cycle and analyze spreads.
   * Returns any new arbitrage opportunities detected.
   */
  analyze(prices: DexPrice[]): ArbitrageOpportunity[] {
    const newOpportunities: ArbitrageOpportunity[] = [];

    // Update price table
    for (const price of prices) {
      if (!this.priceTable.has(price.pair)) {
        this.priceTable.set(price.pair, new Map());
      }
      this.priceTable.get(price.pair)!.set(price.dex, price);
    }

    // Analyze each pair
    for (const [pair, dexPrices] of this.priceTable) {
      const priceList = Array.from(dexPrices.values());
      if (priceList.length < 2) continue;

      // Find best buy (lowest price) and best sell (highest price)
      const sorted = [...priceList].sort((a, b) => a.price - b.price);
      const low = sorted[0];
      const high = sorted[sorted.length - 1];
      const spreadPercent = ((high.price - low.price) / low.price) * 100;

      // Update history
      if (!this.histories.has(pair)) {
        this.histories.set(pair, new SpreadHistory());
      }
      const history = this.histories.get(pair)!;
      history.add(spreadPercent);

      // Check against adaptive threshold
      const threshold = history.getThreshold(this.multiplier, this.minThreshold);
      const isSignificant = spreadPercent > threshold;

      const opportunity: ArbitrageOpportunity = {
        pair,
        buyDex: low.dex,
        sellDex: high.dex,
        buyPrice: low.price,
        sellPrice: high.price,
        spreadPercent,
        timestamp: Date.now(),
        isSignificant,
      };

      // Always record, but flag significance
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
  getThresholds(): Record<string, { mean: number; std: number; threshold: number; samples: number }> {
    const result: Record<string, { mean: number; std: number; threshold: number; samples: number }> = {};
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
  getSignificantOpportunities(): ArbitrageOpportunity[] {
    return [...this.opportunities];
  }

  /** Get latest prices for all pairs */
  getLatestPrices(): Record<string, DexPrice[]> {
    const result: Record<string, DexPrice[]> = {};
    for (const [pair, dexPrices] of this.priceTable) {
      result[pair] = Array.from(dexPrices.values());
    }
    return result;
  }
}
