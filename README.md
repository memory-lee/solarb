# SolArb

Real-time arbitrage detection system for Solana DEX markets. Multi-cloud (GCP + AWS + Azure) with P2P gossip networking and ML-powered opportunity scoring.

## Demo

[![SolArb Demo](https://img.youtube.com/vi/zZwPhL9iWd4/maxresdefault.jpg)](https://www.youtube.com/watch?v=zZwPhL9iWd4)

▶️ [Watch the demo on YouTube](https://www.youtube.com/watch?v=zZwPhL9iWd4)

## Architecture

```
Jupiter API → Watcher Node → P2P Gossip Network → Detector Node
                                                        ├── Vertex AI (ML predictions)
                                                        ├── DynamoDB (persistence)
                                                        ├── SNS (alerts)
                                                        ├── Azure Function (logging)
                                                        └── Dashboard (visualization)
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js / TypeScript |
| P2P Layer | libp2p (GossipSub) |
| ML | Vertex AI (Isolation Forest) |
| Compute | GCE (Google Compute Engine) |
| Storage | AWS DynamoDB |
| Alerts | AWS SNS |
| Serverless | Azure Functions |
| Dashboard | Cloud Run |
| Data Source | Jupiter Aggregator API |

## Project Structure

```
packages/
├── watcher/      # Price monitoring via Jupiter API
├── detector/     # Arbitrage detection + Vertex AI ML
├── dashboard/    # Real-time web dashboard
└── shared/       # Common types and utilities
azure-function/   # Azure Function for logging
```

## Getting Started

### Prerequisites

- Node.js 18+
- GCP account with Vertex AI enabled
- AWS account (DynamoDB + SNS)
- Azure account (Functions)

### Install

```bash
npm install
```

### Run

```bash
# Start watcher node
npm run start:watcher

# Start detector node
npm run start:detector

# Start dashboard
npm run start:dashboard
```

## Cloud Deployment

Each component has its own Dockerfile for containerized deployment:

- `Dockerfile.watcher` — Watcher node
- `Dockerfile.detector` — Detector node
- `Dockerfile.dashboard` — Dashboard (deployed to Cloud Run)
