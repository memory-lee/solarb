/**
 * Call Vertex AI prediction endpoint for anomaly detection.
 * Each instance is [spread_pct, spread_velocity, pair_index].
 * Returns one prediction per instance: 1 = normal, -1 = anomaly.
 */
export declare function predictAnomaly(instances: number[][]): Promise<number[]>;
//# sourceMappingURL=vertex-ai.d.ts.map