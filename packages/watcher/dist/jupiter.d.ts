import { DexPrice, TokenPairConfig } from "@solarb/shared";
/**
 * Fetch quotes from Jupiter for a specific token pair.
 * Strategy: make multiple calls, each time excluding previously seen DEXes,
 * to get pricing from different DEXes for comparison.
 */
export declare function fetchJupiterQuotes(pair: TokenPairConfig): Promise<DexPrice[]>;
//# sourceMappingURL=jupiter.d.ts.map