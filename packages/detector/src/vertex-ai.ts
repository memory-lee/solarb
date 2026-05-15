import { GoogleAuth } from "google-auth-library";

const VERTEX_ENDPOINT =
  "https://us-east1-aiplatform.googleapis.com/v1/projects/solarb-project/locations/us-east1/endpoints/3010500220246032384:predict";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.value;
  }
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to obtain GCP access token");
  }
  // google-auth-library refreshes on its own; cache briefly to avoid per-call overhead
  cachedToken = { value: tokenResponse.token, expiresAt: now + 5 * 60_000 };
  return tokenResponse.token;
}

/**
 * Call Vertex AI prediction endpoint for anomaly detection.
 * Each instance is [spread_pct, spread_velocity, pair_index].
 * Returns one prediction per instance: 1 = normal, -1 = anomaly.
 */
export async function predictAnomaly(
  instances: number[][]
): Promise<number[]> {
  const token = await getAccessToken();

  const response = await fetch(VERTEX_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ instances }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Vertex AI request failed: ${response.status} ${response.statusText} ${body}`
    );
  }

  const data = (await response.json()) as { predictions?: unknown };
  const predictions = data.predictions;
  if (!Array.isArray(predictions)) {
    throw new Error("Vertex AI response missing predictions array");
  }

  return predictions.map((p) => {
    if (typeof p === "number") return p;
    if (p && typeof p === "object" && "value" in p) {
      const v = (p as { value: unknown }).value;
      if (typeof v === "number") return v;
    }
    return Number(p);
  });
}
