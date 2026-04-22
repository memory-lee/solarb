import { ArbitrageOpportunity } from "@solarb/shared";
/**
 * Publish an SNS alert for a significant arbitrage opportunity.
 * Enforces a 5-minute cooldown per token pair.
 */
export declare function sendAlert(opp: ArbitrageOpportunity): Promise<void>;
//# sourceMappingURL=sns.d.ts.map