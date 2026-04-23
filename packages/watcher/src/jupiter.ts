import { DexPrice, TokenPairConfig, JUPITER_QUOTE_API, getJupiterApiKey } from "@solarb/shared";

/**
 * Raw Jupiter Quote API response (simplified to the fields we need)
 */
interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  routePlan: RoutePlanStep[];
  contextSlot: number;
}

interface RoutePlanStep {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

/**
 * Extract the primary DEX label(s) from a quote's route plan.
 */
function getDexLabels(quote: JupiterQuoteResponse): string[] {
  return quote.routePlan.map((step) => step.swapInfo.label);
}

/**
 * Fetch quotes from Jupiter for a specific token pair.
 * Strategy: make multiple calls, each time excluding previously seen DEXes,
 * to get pricing from different DEXes for comparison.
 */
export async function fetchJupiterQuotes(
  pair: TokenPairConfig
): Promise<DexPrice[]> {
  const timestamp = Date.now();
  const prices: DexPrice[] = [];
  const excludeDexes: string[] = [];

  // Make up to 3 calls, each excluding previously seen DEXes
  for (let attempt = 0; attempt < 3; attempt++) {
    const quote = await fetchSingleQuote(pair, { excludeDexes });
    if (!quote || !quote.routePlan || quote.routePlan.length === 0) break;

    const labels = getDexLabels(quote);
    const primaryLabel = labels[0]; // Use first step's label as DEX identifier

    // Calculate price from overall quote amounts
    const price = Number(quote.outAmount) / Number(quote.inAmount);

    // Only add if we got a valid price
    if (price > 0 && isFinite(price)) {
      prices.push({
        pair: pair.name,
        dex: primaryLabel,
        price,
        timestamp,
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
      });
    }

    // Exclude this DEX's labels for next call
    excludeDexes.push(...labels);

    // Small delay to respect rate limits (free tier = 1 RPS)
    if (attempt < 2) {
      await sleep(500);
    }
  }

  return prices;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSingleQuote(
  pair: TokenPairConfig,
  opts: { slippageBps?: number; excludeDexes?: string[] } = {}
): Promise<JupiterQuoteResponse | null> {
  try {
    const params = new URLSearchParams({
      inputMint: pair.inputMint,
      outputMint: pair.outputMint,
      amount: pair.inputAmount,
      slippageBps: String(opts.slippageBps ?? 50),
    });

    // Add excluded DEXes if any
    if (opts.excludeDexes && opts.excludeDexes.length > 0) {
      params.set("excludeDexes", opts.excludeDexes.join(","));
    }

    const url = `${JUPITER_QUOTE_API}?${params.toString()}`;
    const res = await fetch(url, {
      headers: getJupiterApiKey() ? { "x-api-key": getJupiterApiKey() } : {},
    });
    if (!res.ok) {
      console.error(`Jupiter API error: ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as JupiterQuoteResponse;
  } catch (err) {
    console.error("Failed to fetch Jupiter quote:", err);
    return null;
  }
}
