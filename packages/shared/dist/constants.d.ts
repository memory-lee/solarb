import { TokenPairConfig } from "./types.js";
/** Jupiter Quote API base URL (Swap API v1) */
export declare const JUPITER_QUOTE_API = "https://api.jup.ag/swap/v1/quote";
/** Jupiter API key — read lazily from process.env at call time (not module load) */
export declare function getJupiterApiKey(): string;
/** Well-known Solana token mint addresses */
export declare const MINTS: {
    readonly SOL: "So11111111111111111111111111111111111111112";
    readonly USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    readonly mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
    readonly JitoSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
};
/** Token pairs to monitor for arbitrage */
export declare const TOKEN_PAIRS: TokenPairConfig[];
/** libp2p gossipsub topic for price data */
export declare const PRICE_TOPIC = "solarb/dex-prices/1.0.0";
/** Polling interval for Jupiter API (ms) */
export declare const POLL_INTERVAL_MS = 15000;
//# sourceMappingURL=constants.d.ts.map