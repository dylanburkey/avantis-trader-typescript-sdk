# Avantis TypeScript SDK

A community-maintained TypeScript SDK for the [Avantis](https://avantisfi.com) perpetuals trading protocol on Base.

[![npm version](https://img.shields.io/npm/v/avantisfi-sdk.svg)](https://www.npmjs.com/package/avantisfi-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

> **Note**: This is an unofficial TypeScript port of the [official Avantis Python SDK](https://github.com/Avantis-Labs/avantis_trader_sdk). It mirrors the Python SDK's functionality while providing idiomatic TypeScript patterns and full type safety.

## Features

- **91 Trading Pairs** - Crypto, forex, commodities, and indices
- **Real-Time Prices** - Via Pyth Network price feeds
- **Full Trading Support** - Market orders, limit orders, TP/SL management
- **Market Analytics** - Open interest, utilization, skew, and blended metrics
- **Type-Safe** - Comprehensive TypeScript definitions
- **Lightweight** - Only `viem` as a peer dependency

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
- [API Overview](#api-overview)
- [Documentation](#documentation)
- [Examples](#examples)
- [Comparison with Python SDK](#comparison-with-python-sdk)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# npm
npm install avantisfi-sdk viem

# yarn
yarn add avantisfi-sdk viem

# pnpm
pnpm add avantisfi-sdk viem
```

## Quick Start

### Read-Only Mode (Market Data)

```typescript
import { TraderClient } from 'avantisfi-sdk';

async function main() {
  // Initialize client (no private key needed for reading)
  const client = await TraderClient.create();

  // Get all trading pairs
  const pairs = await client.pairsCache.getPairsInfo();
  console.log(`Found ${pairs.size} trading pairs`);

  // Get pair names
  const names = await client.pairsCache.getPairNames();
  console.log('Pairs:', names.slice(0, 5).join(', '), '...');

  // Get open interest for ETH/USD
  const oi = await client.assetParameters.getOi();
  const ethOi = oi.get(0);
  console.log(`ETH/USD - Long OI: $${ethOi?.long.toLocaleString()}`);
  console.log(`ETH/USD - Short OI: $${ethOi?.short.toLocaleString()}`);

  // Get current price
  const price = await client.feedClient.getPrice(0);
  console.log(`ETH Price: $${price.toFixed(2)}`);
}

main();
```

### Trading Mode (Execute Trades)

```typescript
import { TraderClient, TradeInput } from 'avantisfi-sdk';

async function trade() {
  // Initialize with private key for trading
  const client = await TraderClient.create({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  console.log('Wallet:', client.walletAddress);

  // Check USDC balance
  const balance = await client.getUsdcBalance();
  console.log(`USDC Balance: $${balance.toFixed(2)}`);

  // Approve USDC spending (one-time)
  await client.approveUsdc(client.contracts.Trading.address, 1000);

  // Open a long position on ETH/USD
  const trade: TradeInput = {
    pairIndex: 0,              // ETH/USD
    collateral: 100,           // $100 USDC
    openPrice: 0,              // 0 = market order
    isLong: true,              // Long position
    leverage: 10,              // 10x leverage
    takeProfit: 4000,          // TP at $4000
    stopLoss: 3000,            // SL at $3000
    orderType: 0,              // 0 = market, 1 = limit
    timestamp: Math.floor(Date.now() / 1000),
  };

  const txHash = await client.trade.openTrade(trade);
  console.log('Trade opened:', txHash);
}

trade();
```

## Usage Examples

### Get Market Snapshot

```typescript
const client = await TraderClient.create();

// Get comprehensive market data for a pair
const pairIndex = 0; // ETH/USD

const [pair, oi, util, skew, spread] = await Promise.all([
  client.pairsCache.getPairByIndex(pairIndex),
  client.assetParameters.getOiForPair(pairIndex),
  client.blended.getBlendedUtilization(pairIndex),
  client.blended.getBlendedSkew(pairIndex),
  client.feeParameters.getSpread(pairIndex),
]);

console.log(`=== ${pair?.name} ===`);
console.log(`Long OI: $${oi.long.toLocaleString()}`);
console.log(`Short OI: $${oi.short.toLocaleString()}`);
console.log(`Utilization: L=${util.long.toFixed(1)}%, S=${util.short.toFixed(1)}%`);
console.log(`Skew: ${(skew.value * 100).toFixed(1)}%`);
console.log(`Spread: ${spread} bps`);
```

### Monitor Open Positions

```typescript
const client = await TraderClient.create({
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});

// Get all open trades
const trades = await client.trade.getOpenTrades(client.walletAddress!);

for (const trade of trades) {
  const pair = await client.pairsCache.getPairByIndex(trade.pairIndex);
  const currentPrice = await client.feedClient.getPrice(trade.pairIndex);
  
  const pnlPercent = trade.isLong
    ? ((currentPrice - trade.openPrice) / trade.openPrice) * trade.leverage * 100
    : ((trade.openPrice - currentPrice) / trade.openPrice) * trade.leverage * 100;

  console.log(`${pair?.name} ${trade.isLong ? 'LONG' : 'SHORT'} ${trade.leverage}x`);
  console.log(`  Entry: $${trade.openPrice.toFixed(2)}`);
  console.log(`  Current: $${currentPrice.toFixed(2)}`);
  console.log(`  PnL: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`);
}
```

### Close a Trade

```typescript
// Close a specific trade
const txHash = await client.trade.closeTradeMarket(
  0,  // pairIndex
  0   // tradeIndex
);
console.log('Trade closed:', txHash);
```

### Update Take Profit / Stop Loss

```typescript
// Update TP
await client.trade.updateTp(0, 0, 4500); // New TP at $4500

// Update SL
await client.trade.updateSl(0, 0, 3200); // New SL at $3200
```

## API Overview

### TraderClient

The main entry point for all SDK functionality.

```typescript
const client = await TraderClient.create({
  rpcUrl?: string;           // Base RPC URL (default: mainnet)
  privateKey?: `0x${string}`; // For trading (optional for read-only)
});
```

### Available Modules

| Module | Description | Example |
|--------|-------------|---------|
| `pairsCache` | Trading pair information | `client.pairsCache.getPairsInfo()` |
| `feedClient` | Pyth price feeds | `client.feedClient.getPrice(0)` |
| `assetParameters` | Asset-level metrics | `client.assetParameters.getOi()` |
| `categoryParameters` | Category-level metrics | `client.categoryParameters.getOi()` |
| `feeParameters` | Spread and fees | `client.feeParameters.getSpread(0)` |
| `blended` | Combined metrics | `client.blended.getBlendedUtilization(0)` |
| `trade` | Trade execution | `client.trade.openTrade(...)` |
| `contracts` | Raw contract instances | `client.contracts.Trading` |

### Key Methods

#### Market Data
```typescript
// Pairs
await client.pairsCache.getPairsInfo()      // All pairs
await client.pairsCache.getPairByIndex(0)   // Single pair
await client.pairsCache.getPairNames()      // Pair names list

// Prices
await client.feedClient.getPrice(0)         // Current price
await client.feedClient.getPrices([0,1,2])  // Multiple prices

// Open Interest
await client.assetParameters.getOi()        // All pairs OI
await client.assetParameters.getOiForPair(0) // Single pair OI

// Utilization & Skew
await client.blended.getBlendedUtilization(0)
await client.blended.getBlendedSkew(0)
```

#### Trading
```typescript
// Open trade
await client.trade.openTrade(tradeInput)

// Close trade
await client.trade.closeTradeMarket(pairIndex, tradeIndex)

// Update TP/SL
await client.trade.updateTp(pairIndex, tradeIndex, newTp)
await client.trade.updateSl(pairIndex, tradeIndex, newSl)

// Get positions
await client.trade.getOpenTrades(walletAddress)
await client.trade.getPendingOrders(walletAddress)
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Guides

| Guide | Description |
|-------|-------------|
| [Quick Start](./docs/guides/quick-start.md) | Get up and running in 5 minutes |
| [Implementation Guide](./docs/guides/implementation.md) | Integrate SDK into your project |
| [Testing Guide](./docs/guides/testing.md) | Unit and integration testing |
| [Front-End Example](./docs/guides/frontend-example.md) | React/Next.js trading dashboard |
| [Trading Opportunities](./docs/guides/trading-opportunities.md) | Find and analyze trading signals |
| [Automated Trading](./docs/guides/automated-trading.md) | Build trading bots |
| [Use Cases](./docs/guides/use-cases.md) | 10 practical applications |

### API Reference

| Reference | Description |
|-----------|-------------|
| [TraderClient](./docs/api/trader-client.md) | Main client class |
| [TradeRPC](./docs/api/trade-rpc.md) | Trade execution |
| [PairsCache](./docs/api/pairs-cache.md) | Pair information |
| [AssetParameters](./docs/api/asset-parameters.md) | Asset metrics |
| [BlendedMetrics](./docs/api/blended-metrics.md) | Combined metrics |

### Architecture

| Diagram | Description |
|---------|-------------|
| [SDK Architecture](./docs/diagrams/architecture.md) | System overview |
| [Trade Flow](./docs/diagrams/trade-flow.md) | Transaction lifecycle |
| [Data Flow](./docs/diagrams/data-flow.md) | Data sources and caching |

## Examples

The `examples/` directory contains runnable examples:

```bash
# Run the market data example
npx ts-node examples/market-data.ts

# Run the trading example (requires PRIVATE_KEY env)
PRIVATE_KEY=0x... npx ts-node examples/open-trade.ts
```

### Example Scripts

| Example | Description |
|---------|-------------|
| `examples/market-data.ts` | Fetch and display market data |
| `examples/open-trade.ts` | Open a trading position |
| `examples/monitor-positions.ts` | Track open positions |
| `examples/trading-bot/` | Complete trading bot example |

## Comparison with Python SDK

This SDK is a TypeScript port of the official Python SDK with equivalent functionality:

### Python SDK
```python
from avantis_trader_sdk import TraderClient

client = TraderClient("https://mainnet.base.org")
pairs_info = await client.pairs_cache.get_pairs_info()
oi = await client.asset_parameters.get_oi()
```

### TypeScript SDK (This Package)
```typescript
import { TraderClient } from 'avantisfi-sdk';

const client = await TraderClient.create();
const pairsInfo = await client.pairsCache.getPairsInfo();
const oi = await client.assetParameters.getOi();
```

### Feature Comparison

| Feature | Python SDK | TypeScript SDK |
|---------|------------|----------------|
| Pair Information | Yes | Yes |
| Price Feeds | Yes | Yes |
| Open Interest | Yes | Yes |
| Trade Execution | Yes | Yes |
| Blended Metrics | Yes | Yes |
| Socket API | Yes | Yes |
| Type Safety | No | Yes |
| Browser Support | No | Yes |

## Requirements

- **Node.js**: 18.0 or higher
- **TypeScript**: 5.0 or higher (if using TypeScript)
- **viem**: 2.x (peer dependency)

## Environment Variables

```bash
# Required for trading
PRIVATE_KEY=0x...

# Optional
RPC_URL=https://mainnet.base.org  # Default Base RPC
```

## Contributing

Contributions are welcome! This is a community project aimed at maintaining parity with the official Python SDK.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/avantisfi-typescript-sdk.git
cd avantisfi-typescript-sdk

# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test

# Run in development mode
npm run dev
```

### Running Tests

```bash
# Unit tests only (no network)
SKIP_INTEGRATION_TESTS=true npm test

# All tests including integration
npm test

# Watch mode
npm test -- --watch
```

### Code Style

- Use TypeScript strict mode
- Follow existing naming conventions (camelCase for methods/variables)
- Add JSDoc comments for public APIs
- Write tests for new functionality

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linting (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Areas for Contribution

- Bug fixes and improvements
- Additional test coverage
- Documentation improvements
- New examples
- Performance optimizations
- Feature parity with Python SDK updates

## Related Links

| Resource | Link |
|----------|------|
| Avantis Protocol | [avantisfi.com](https://avantisfi.com) |
| Official Python SDK | [GitHub](https://github.com/Avantis-Labs/avantis_trader_sdk) |
| Python SDK Docs | [sdk.avantisfi.com](https://sdk.avantisfi.com) |
| Base Network | [base.org](https://base.org) |
| Pyth Network | [pyth.network](https://pyth.network) |

## Support

- **Issues**: [GitHub Issues](https://github.com/your-username/avantisfi-typescript-sdk/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/avantisfi-typescript-sdk/discussions)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
Author: Dylan Burkey
X: @dylanburkey
---

**Disclaimer**: This is an unofficial community SDK. Use at your own risk. Always test with small amounts first. The authors are not responsible for any financial losses incurred through the use of this software.
