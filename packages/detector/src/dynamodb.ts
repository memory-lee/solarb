import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ArbitrageOpportunity } from "@solarb/shared";

const TABLE_NAME = process.env.DYNAMODB_TABLE || "solarb-opportunities";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Write a detected arbitrage opportunity to DynamoDB.
 */
export async function saveOpportunity(opp: ArbitrageOpportunity): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pair: opp.pair,
          timestamp: opp.timestamp,
          buyDex: opp.buyDex,
          sellDex: opp.sellDex,
          buyPrice: opp.buyPrice,
          sellPrice: opp.sellPrice,
          spreadPercent: opp.spreadPercent,
          isSignificant: opp.isSignificant,
          mlDetected: opp.mlDetected,
        },
      })
    );
  } catch (err) {
    console.error("[DynamoDB] Failed to save opportunity:", err);
  }
}

/**
 * Query recent opportunities for a specific pair.
 */
export async function getRecentOpportunities(
  pair: string,
  limit = 50
): Promise<ArbitrageOpportunity[]> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "#p = :pair",
        ExpressionAttributeNames: { "#p": "pair" },
        ExpressionAttributeValues: { ":pair": pair },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );
    return (result.Items || []) as ArbitrageOpportunity[];
  } catch (err) {
    console.error("[DynamoDB] Failed to query opportunities:", err);
    return [];
  }
}
