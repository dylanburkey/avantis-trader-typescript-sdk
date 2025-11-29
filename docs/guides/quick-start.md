# Quick Start Guide

Get up and running with the Avantis TypeScript SDK in 5 minutes.

## Installation

```bash
npm install avantisfi-sdk viem
```

Or with yarn:
```bash
yarn add avantisfi-sdk viem
```

## Basic Setup

### Read-Only Mode (No Private Key)

For market data and analysis without executing trades:

```typescript
import { TraderClient } from 'avantisfi-sdk';

async function main() {
  // Initialize client without private key
  const client = await TraderClient.create();

  // Fetch all trading pairs
  const pairs = await client.pairsCache.getPairsInfo();
  console.log(`Found ${pairs.size} trading pairs`);

  // Get pair names
  const names = await client.pairsCache.getPairNames();
  console.log('Available pairs:', names.slice(0, 10).join(', '));

  // Get market data for ETH/USD (index 0)
  const oi = await client.assetParameters.getOi();
  const ethOi = oi.get(0);
  console.log(`ETH/USD - Long OI: $${ethOi?.long.toFixed(2)}, Short OI: $${ethOi?.short.toFixed(2)}`);
}

main();
```

### Trading Mode (With Private Key)

For executing trades on Base mainnet:

```typescript
import { TraderClient } from 'avantisfi-sdk';

async function main() {
  // Initialize with private key for trading
  const client = await TraderClient.create({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  // Your wallet address
  console.log('Wallet:', client.walletAddress);

  // Check USDC balance
  const balance = await client.getUsdcBalance();
  console.log(`USDC Balance: ${balance}`);
}

main();
```

## Fetching Market Data

### Get Trading Pair Information

```typescript
// Get all pairs
const pairs = await client.pairsCache.getPairsInfo();

// Get specific pair by index
const ethUsd = await client.pairsCache.getPairByIndex(0);
console.log('ETH/USD:', ethUsd);

// Get pair by name
const btcUsd = await client.pairsCache.getPairByName('BTC/USD');
console.log('BTC/USD:', btcUsd);
```

### Get Current Prices

```typescript
// Get price for a specific pair
const price = await client.feedClient.getPrice(0); // ETH/USD
console.log(`ETH Price: $${price.toFixed(2)}`);

// Get prices for multiple pairs
const prices = await client.feedClient.getPrices([0, 1, 2]); // ETH, BTC, SOL
```

### Get Open Interest

```typescript
// Asset-level OI
const assetOi = await client.assetParameters.getOi();
for (const [pairIndex, oi] of assetOi) {
  console.log(`Pair ${pairIndex}: Long $${oi.long.toFixed(2)}, Short $${oi.short.toFixed(2)}`);
}

// Category-level OI
const categoryOi = await client.categoryParameters.getOi();
for (const [groupIndex, oi] of categoryOi) {
  console.log(`Group ${groupIndex}: Long $${oi.long.toFixed(2)}, Short $${oi.short.toFixed(2)}`);
}
```

### Get Blended Metrics

```typescript
// Get utilization metrics (combines asset and category)
const util = await client.blended.getBlendedUtilization(0); // ETH/USD
console.log(`Blended Utilization - Long: ${util.long.toFixed(2)}%, Short: ${util.short.toFixed(2)}%`);

// Get skew metrics
const skew = await client.blended.getBlendedSkew(0);
console.log(`Blended Skew - Long: ${skew.long.toFixed(4)}, Short: ${skew.short.toFixed(4)}`);
```

## Opening a Trade

```typescript
import { TraderClient, TradeInput } from 'avantisfi-sdk';

async function openLongPosition() {
  const client = await TraderClient.create({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  // Prepare trade parameters
  const trade: TradeInput = {
    pairIndex: 0,              // ETH/USD
    collateral: 100,           // 100 USDC
    openPrice: 0,              // 0 for market order (uses current price)
    isLong: true,              // Long position
    leverage: 10,              // 10x leverage
    takeProfit: 0,             // No TP (0 = disabled)
    stopLoss: 0,               // No SL (0 = disabled)
    orderType: 0,              // 0 = Market, 1 = Limit
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Check and approve USDC if needed
  const trading = client.contracts.Trading.address;
  await client.approveUsdc(trading, trade.collateral);

  // Execute the trade
  const txHash = await client.trade.openTrade(trade);
  console.log('Trade opened:', txHash);
}
```

## Closing a Trade

```typescript
async function closeTrade() {
  const client = await TraderClient.create({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  // Get all open trades for your wallet
  const trades = await client.trade.getOpenTrades(client.walletAddress!);
  
  if (trades.length === 0) {
    console.log('No open trades');
    return;
  }

  // Close the first trade
  const trade = trades[0];
  const txHash = await client.trade.closeTradeMarket(
    trade.pairIndex,
    trade.index
  );
  console.log('Trade closed:', txHash);
}
```

## Error Handling

```typescript
import { TraderClient } from 'avantisfi-sdk';

async function safeTrading() {
  try {
    const client = await TraderClient.create({
      privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    });

    const trade = { /* ... */ };
    const txHash = await client.trade.openTrade(trade);
    console.log('Success:', txHash);

  } catch (error) {
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('insufficient funds')) {
        console.error('Not enough USDC or ETH for gas');
      } else if (error.message.includes('exceeds max leverage')) {
        console.error('Leverage too high for this pair');
      } else {
        console.error('Trade failed:', error.message);
      }
    }
  }
}
```

## Next Steps

- [Configuration Guide](./configuration.md) - Customize RPC endpoints and caching
- [Trading Basics](./trading-basics.md) - Understanding perpetual trading
- [API Reference](../api/trader-client.md) - Complete API documentation
- [Examples](../examples/open-trade.md) - More code examples
