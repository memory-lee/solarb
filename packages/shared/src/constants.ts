import { TokenPairConfig } from "./types.js";

/** Jupiter Quote API base URL (Swap API v1) */
export const JUPITER_QUOTE_API = "https://api.jup.ag/swap/v1/quote";

/** Jupiter API key — read lazily from process.env at call time (not module load) */
export function getJupiterApiKey(): string {
  return process.env.JUPITER_API_KEY || "";
}

/** Well-known Solana token mint addresses */
export const MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  JitoSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
} as const;

/** Token pairs to monitor for arbitrage */
export const TOKEN_PAIRS: TokenPairConfig[] = [
  {
    name: "SOL/USDC",
    inputMint: MINTS.SOL,
    outputMint: MINTS.USDC,
    inputAmount: "1000000000", // 1 SOL = 10^9 lamports
  },
  {
    name: "mSOL/SOL",
    inputMint: MINTS.mSOL,
    outputMint: MINTS.SOL,
    inputAmount: "1000000000", // 1 mSOL
  },
  {
    name: "JitoSOL/SOL",
    inputMint: MINTS.JitoSOL,
    outputMint: MINTS.SOL,
    inputAmount: "1000000000", // 1 JitoSOL
  },
];

/** libp2p gossipsub topic for price data */
export const PRICE_TOPIC = "solarb/dex-prices/1.0.0";

/** Polling interval for Jupiter API (ms) */
export const POLL_INTERVAL_MS = 5_000;
