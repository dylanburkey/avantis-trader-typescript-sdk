# GitHub Repository Description

## Short Description (For GitHub "About" section)

```
TypeScript SDK for Avantis perpetuals trading on Base. Community port of the official Python SDK.
```

## Full README Description

---

# Avantis TypeScript SDK

A community-maintained TypeScript SDK for the [Avantis](https://avantisfi.com) perpetuals trading protocol on Base.

> **Note**: This is an unofficial TypeScript port of the [official Avantis Python SDK](https://github.com/Avantis-Labs/avantis_trader_sdk). It mirrors the Python SDK's functionality while providing idiomatic TypeScript patterns and full type safety.

## Relationship to Official Python SDK

| Aspect | Python SDK (Official) | TypeScript SDK (This Repo) |
|--------|----------------------|---------------------------|
| **Maintainer** | Avantis Labs | Community |
| **Status** | Official | Unofficial Port |
| **API Parity** | Reference | Mirrors Python SDK |
| **Data Sources** | Socket API + Contracts | Socket API + Contracts |
| **Use Cases** | Python applications, scripts | Web apps, Node.js, bots |

### What's Ported

This SDK implements the core functionality from the Python SDK:

- **TraderClient** - Main entry point (mirrors `AvantisTradingClient`)
- **PairsCache** - Trading pair information with Socket API
- **AssetParameters** - Asset-level market data (OI, utilization, skew)
- **CategoryParameters** - Category-level market data
- **FeeParameters** - Spread and fee calculations
- **BlendedRPC** - Combined metrics
- **TradeRPC** - Trade execution (open, close, update TP/SL)
- **FeedClient** - Pyth price feeds

### Key Differences

1. **Language & Types**: Full TypeScript with comprehensive type definitions
2. **Blockchain Library**: Uses [viem](https://viem.sh) instead of web3.py
3. **Async Patterns**: Native Promise/async-await (no callbacks)
4. **Package Ecosystem**: npm/yarn compatible, works with Node.js and browsers

## Installation

```bash
npm install avantisfi-sdk viem
```

## Quick Example

```typescript
import { TraderClient } from 'avantisfi-sdk';

// Read-only mode
const client = await TraderClient.create();

// Get all 91 trading pairs
const pairs = await client.pairsCache.getPairsInfo();

// Get market data
const oi = await client.assetParameters.getOi();
const ethOi = oi.get(0);
console.log(`ETH/USD - Long: $${ethOi?.long}, Short: $${ethOi?.short}`);

// Trading mode (with private key)
const trader = await TraderClient.create({
  privateKey: '0x...',
});

await trader.trade.openTrade({
  pairIndex: 0,
  collateral: 100,
  leverage: 10,
  isLong: true,
  // ...
});
```

## Documentation

- [Quick Start Guide](./docs/guides/quick-start.md)
- [API Reference](./docs/api/trader-client.md)
- [Building Trading Bots](./docs/guides/automated-trading.md)
- [Front-End Integration](./docs/guides/frontend-example.md)

## Comparison with Python SDK

### Python SDK
```python
from avantis_trader_sdk import TraderClient

client = TraderClient("https://mainnet.base.org")
pairs_info = await client.pairs_cache.get_pairs_info()
```

### TypeScript SDK (This Repo)
```typescript
import { TraderClient } from 'avantisfi-sdk';

const client = await TraderClient.create();
const pairsInfo = await client.pairsCache.getPairsInfo();
```

## Features

- 91 trading pairs (crypto, forex, commodities)
- Real-time prices via Pyth Network
- Market data via Avantis Socket API
- Full trading capabilities (market/limit orders)
- Position management (TP/SL updates)
- Blended metrics for analysis
- TypeScript types for all responses

## Contributing

Contributions welcome! This is a community project aimed at maintaining parity with the official Python SDK while providing a great TypeScript developer experience.

## Links

- [Official Python SDK](https://github.com/Avantis-Labs/avantis_trader_sdk)
- [Python SDK Docs](https://sdk.avantisfi.com)
- [Avantis Protocol](https://avantisfi.com)
- [Base Network](https://base.org)

## License

MIT

---

## GitHub Topics/Tags

```
avantis, perpetuals, trading, defi, base, typescript, sdk, web3, viem, crypto
```
