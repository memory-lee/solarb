/** A normalized price quote from a specific DEX */
export interface DexPrice {
    /** Token pair identifier, e.g. "SOL/USDC" */
    pair: string;
    /** DEX name, e.g. "Raydium", "Orca" */
    dex: string;
    /** Price of input token in terms of output token */
    price: number;
    /** Unix timestamp in ms */
    timestamp: number;
    /** Amount used for the quote (in lamports / smallest unit) */
    inputAmount: string;
    /** Output amount returned by the DEX */
    outputAmount: string;
}
/** A detected arbitrage opportunity */
export interface ArbitrageOpportunity {
    pair: string;
    buyDex: string;
    sellDex: string;
    buyPrice: number;
    sellPrice: number;
    spreadPercent: number;
    timestamp: number;
    /** Whether this exceeded the adaptive threshold */
    isSignificant: boolean;
    /** Whether the ML model (Vertex AI) flagged this as an anomaly */
    mlDetected: boolean;
}
/** Message format for libp2p gossipsub */
export interface PriceMessage {
    type: "price_update";
    nodeId: string;
    prices: DexPrice[];
    timestamp: number;
}
/** Config for a token pair to monitor */
export interface TokenPairConfig {
    name: string;
    inputMint: string;
    outputMint: string;
    /** Amount in smallest unit (lamports etc.) to use for quotes */
    inputAmount: string;
}
//# sourceMappingURL=types.d.ts.map