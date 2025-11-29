# Avantis TypeScript SDK Documentation

Welcome to the Avantis TypeScript SDK documentation. This SDK provides a comprehensive interface for interacting with the Avantis perpetuals trading protocol on Base.

## Table of Contents

### Getting Started
- [Quick Start Guide](./guides/quick-start.md) - Get up and running in 5 minutes
- [Implementation Guide](./guides/implementation.md) - Integrate the SDK into your project
- [Testing Guide](./guides/testing.md) - How to test the SDK and your applications

### Building Applications
- [Front-End Example](./guides/frontend-example.md) - Build a React/Next.js trading dashboard
- [Trading Opportunities](./guides/trading-opportunities.md) - Discover and analyze trading signals
- [Automated Trading](./guides/automated-trading.md) - Build trading bots and strategies
- [Use Cases](./guides/use-cases.md) - Portfolio tracking, copy trading, webhooks, and more

### API Reference
- [TraderClient](./api/trader-client.md) - Main client class
- [Trade RPC](./api/trade-rpc.md) - Trading operations
- [Asset Parameters](./api/asset-parameters.md) - Asset-level market data
- [Blended Metrics](./api/blended-metrics.md) - Combined market metrics
- [Pairs Cache](./api/pairs-cache.md) - Trading pair information

### Architecture & Diagrams
- [SDK Architecture](./diagrams/architecture.md) - Visual system overview
- [Trade Flow](./diagrams/trade-flow.md) - Transaction lifecycle
- [Data Flow](./diagrams/data-flow.md) - How data moves through the SDK

---

## Quick Start

```bash
npm install avantisfi-sdk viem
```

```typescript
import { TraderClient } from 'avantisfi-sdk';

// Initialize (read-only mode)
const client = await TraderClient.create();

// Get trading pairs
const pairs = await client.pairsCache.getPairsInfo();
console.log(`Found ${pairs.size} trading pairs`);

// Get market data
const oi = await client.assetParameters.getOi();
const ethOi = oi.get(0); // ETH/USD
console.log(`ETH Long OI: $${ethOi?.long.toLocaleString()}`);
```

For trading capabilities, initialize with a private key:

```typescript
const client = await TraderClient.create({
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});

// Open a trade
await client.trade.openTrade({
  pairIndex: 0,      // ETH/USD
  collateral: 100,   // $100 USDC
  leverage: 10,      // 10x
  isLong: true,
  // ...
});
```

## SDK at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        TraderClient                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Trade     │  │   Market    │  │      Parameters         │  │
│  │   Module    │  │   Data      │  │                         │  │
│  ├─────────────┤  ├─────────────┤  ├─────────────────────────┤  │
│  │ • openTrade │  │ • pairsCache│  │ • assetParameters       │  │
│  │ • closeTrade│  │ • feedClient│  │ • categoryParameters    │  │
│  │ • updateTp  │  │ • snapshot  │  │ • feeParameters         │  │
│  │ • updateSl  │  │             │  │ • tradingParameters     │  │
│  │ • getTrades │  │             │  │ • blended               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## What Can You Build?

| Application | Description | Guide |
|-------------|-------------|-------|
| **Trading Dashboard** | Real-time market data, position management | [Front-End Example](./guides/frontend-example.md) |
| **Trading Bot** | Automated trading based on signals | [Automated Trading](./guides/automated-trading.md) |
| **Market Scanner** | Find trading opportunities | [Trading Opportunities](./guides/trading-opportunities.md) |
| **Portfolio Tracker** | Monitor positions and PnL | [Use Cases](./guides/use-cases.md#portfolio-tracking) |
| **Copy Trading** | Mirror trades from other wallets | [Use Cases](./guides/use-cases.md#use-case-5-copy-trading) |
| **Discord Bot** | Trade via Discord commands | [Use Cases](./guides/use-cases.md#use-case-9-discord-trading-bot) |
| **Webhook Integration** | TradingView alerts to trades | [Use Cases](./guides/use-cases.md#use-case-10-webhook-integration) |

## Key Features

- **91 Trading Pairs** - Crypto, forex, commodities, and more
- **Real-Time Data** - Prices via Pyth Network, market data via Socket API
- **Full Trading** - Open, close, update TP/SL, limit orders
- **Market Analysis** - Open interest, utilization, skew metrics
- **Type-Safe** - Full TypeScript support with comprehensive types

## Data Sources

The SDK fetches data from multiple sources:

| Source | Data | Update Frequency |
|--------|------|------------------|
| **Socket API** | Pairs, OI, groups | Cached (5 min TTL) |
| **Pyth Network** | Prices | Real-time |
| **Base RPC** | Positions, trades | On-demand |

## Requirements

- Node.js 18+
- TypeScript 5.0+
- viem 2.x (peer dependency)

## Quick Links

| Resource | Description |
|----------|-------------|
| [GitHub Repository](https://github.com/avantis-labs/avantis-typescript-sdk) | Source code |
| [Python SDK](https://github.com/Avantis-Labs/avantis_trader_sdk) | Reference implementation |
| [Avantis Protocol](https://avantisfi.com) | Official website |
| [Base Network](https://base.org) | L2 blockchain |

## License

MIT License - see [LICENSE](../LICENSE) for details.
