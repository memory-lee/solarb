import { ArbitrageOpportunity } from "@solarb/shared";
/**
 * Write a detected arbitrage opportunity to DynamoDB.
 */
export declare function saveOpportunity(opp: ArbitrageOpportunity): Promise<void>;
/**
 * Query recent opportunities for a specific pair.
 */
export declare function getRecentOpportunities(pair: string, limit?: number): Promise<ArbitrageOpportunity[]>;
//# sourceMappingURL=dynamodb.d.ts.map