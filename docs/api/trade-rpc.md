# TradeRPC API Reference

The `TradeRPC` class provides methods for executing trades on the Avantis protocol.

## Access

```typescript
const client = await TraderClient.create({ privateKey: '0x...' });
const tradeRpc = client.trade;
```

## Methods

### `openTrade`

```typescript
async openTrade(trade: TradeInput): Promise<string>
```

Open a new trade (market or limit order).

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `pairIndex` | `number` | Trading pair index (0 = ETH/USD) |
| `collateral` | `number` | Collateral amount in USDC |
| `openPrice` | `number` | Open price (0 for market order) |
| `isLong` | `boolean` | `true` for long, `false` for short |
| `leverage` | `number` | Leverage multiplier (e.g., 10) |
| `takeProfit` | `number` | Take profit price (0 = disabled) |
| `stopLoss` | `number` | Stop loss price (0 = disabled) |
| `orderType` | `number` | 0 = Market, 1 = Limit |
| `timestamp` | `number` | Unix timestamp in seconds |

**Returns:** Transaction hash

**Example:**
```typescript
const trade: TradeInput = {
  pairIndex: 0,              // ETH/USD
  collateral: 100,           // $100 USDC
  openPrice: 0,              // Market order
  isLong: true,              // Long position
  leverage: 10,              // 10x leverage
  takeProfit: 4000,          // TP at $4000
  stopLoss: 3000,            // SL at $3000
  orderType: 0,              // Market order
  timestamp: Math.floor(Date.now() / 1000),
};

const txHash = await client.trade.openTrade(trade);
console.log('Trade opened:', txHash);
```

### `closeTradeMarket`

```typescript
async closeTradeMarket(pairIndex: number, tradeIndex: number): Promise<string>
```

Close an open trade at market price.

**Parameters:**
- `pairIndex`: Trading pair index
- `tradeIndex`: Trade index within the pair

**Returns:** Transaction hash

**Example:**
```typescript
const txHash = await client.trade.closeTradeMarket(0, 0);
console.log('Trade closed:', txHash);
```

### `updateTp`

```typescript
async updateTp(
  pairIndex: number,
  tradeIndex: number,
  newTp: number
): Promise<string>
```

Update take profit price for an open trade.

**Parameters:**
- `pairIndex`: Trading pair index
- `tradeIndex`: Trade index within the pair
- `newTp`: New take profit price (0 to disable)

**Returns:** Transaction hash

**Example:**
```typescript
// Set TP to $4500
const txHash = await client.trade.updateTp(0, 0, 4500);

// Remove TP
const txHash2 = await client.trade.updateTp(0, 0, 0);
```

### `updateSl`

```typescript
async updateSl(
  pairIndex: number,
  tradeIndex: number,
  newSl: number
): Promise<string>
```

Update stop loss price for an open trade.

**Parameters:**
- `pairIndex`: Trading pair index
- `tradeIndex`: Trade index within the pair
- `newSl`: New stop loss price (0 to disable)

**Returns:** Transaction hash

**Example:**
```typescript
// Set SL to $3200
const txHash = await client.trade.updateSl(0, 0, 3200);

// Remove SL (not recommended!)
const txHash2 = await client.trade.updateSl(0, 0, 0);
```

### `getOpenTrades`

```typescript
async getOpenTrades(trader: string): Promise<Trade[]>
```

Get all open trades for an address.

**Parameters:**
- `trader`: Wallet address

**Returns:** Array of open trades

**Example:**
```typescript
const trades = await client.trade.getOpenTrades(client.walletAddress!);

for (const trade of trades) {
  console.log(`${trade.pairIndex}: ${trade.isLong ? 'LONG' : 'SHORT'}`);
  console.log(`  Collateral: $${trade.collateral}`);
  console.log(`  Leverage: ${trade.leverage}x`);
  console.log(`  Open Price: $${trade.openPrice}`);
}
```

### `getOpenTradesInfo`

```typescript
async getOpenTradesInfo(trader: string): Promise<TradeInfo[]>
```

Get additional info for open trades (TP, SL, timestamps).

**Parameters:**
- `trader`: Wallet address

**Returns:** Array of trade info objects

**Example:**
```typescript
const tradesInfo = await client.trade.getOpenTradesInfo(client.walletAddress!);

for (const info of tradesInfo) {
  console.log(`Trade ${info.tradeIndex}:`);
  console.log(`  TP: ${info.tp > 0 ? `$${info.tp}` : 'None'}`);
  console.log(`  SL: ${info.sl > 0 ? `$${info.sl}` : 'None'}`);
  console.log(`  Opened: ${new Date(info.openTime * 1000)}`);
}
```

### `getPendingOrders`

```typescript
async getPendingOrders(trader: string): Promise<LimitOrder[]>
```

Get pending limit orders for an address.

**Parameters:**
- `trader`: Wallet address

**Returns:** Array of pending limit orders

**Example:**
```typescript
const orders = await client.trade.getPendingOrders(client.walletAddress!);

for (const order of orders) {
  console.log(`Limit ${order.isLong ? 'LONG' : 'SHORT'} at $${order.price}`);
  console.log(`  Collateral: $${order.collateral}`);
  console.log(`  Leverage: ${order.leverage}x`);
}
```

### `cancelLimitOrder`

```typescript
async cancelLimitOrder(pairIndex: number, orderIndex: number): Promise<string>
```

Cancel a pending limit order.

**Parameters:**
- `pairIndex`: Trading pair index
- `orderIndex`: Order index within the pair

**Returns:** Transaction hash

**Example:**
```typescript
const orders = await client.trade.getPendingOrders(client.walletAddress!);
if (orders.length > 0) {
  const txHash = await client.trade.cancelLimitOrder(
    orders[0].pairIndex,
    orders[0].index
  );
  console.log('Order cancelled:', txHash);
}
```

## Type Definitions

### TradeInput

```typescript
interface TradeInput {
  pairIndex: number;
  collateral: number;
  openPrice: number;
  isLong: boolean;
  leverage: number;
  takeProfit: number;
  stopLoss: number;
  orderType: number;
  timestamp: number;
}
```

### Trade

```typescript
interface Trade {
  trader: string;
  pairIndex: number;
  index: number;
  collateral: number;
  openPrice: number;
  isLong: boolean;
  leverage: number;
  positionSize: number;
}
```

### TradeInfo

```typescript
interface TradeInfo {
  tradeIndex: number;
  tp: number;
  sl: number;
  openTime: number;
  lastUpdateTime: number;
}
```

### LimitOrder

```typescript
interface LimitOrder {
  trader: string;
  pairIndex: number;
  index: number;
  collateral: number;
  price: number;
  isLong: boolean;
  leverage: number;
}
```

## Trade Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Approve   │────►│  Open Trade │────►│  Position   │
│    USDC     │     │             │     │   Active    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┤
                    │                          │
                    ▼                          ▼
            ┌─────────────┐            ┌─────────────┐
            │  Update TP  │            │  Update SL  │
            │  or SL      │            │             │
            └─────────────┘            └─────────────┘
                    │                          │
                    └──────────────────────────┤
                                               │
                    ┌──────────────────────────┤
                    │                          │
                    ▼                          ▼
            ┌─────────────┐            ┌─────────────┐
            │   Close     │            │  Liquidated │
            │   Trade     │            │  or TP/SL   │
            └─────────────┘            └─────────────┘
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Exceeds max leverage` | Leverage too high | Check pair's maxLeverage |
| `Below min collateral` | Collateral too low | Use at least minimum |
| `Exceeds OI limit` | Position too large | Reduce position size |
| `Invalid TP/SL` | TP below/above entry | Check price direction |
| `Trade not found` | Invalid trade index | Verify trade exists |

**Example:**
```typescript
try {
  await client.trade.openTrade(trade);
} catch (error) {
  if (error.message.includes('Exceeds max leverage')) {
    const pair = await client.pairsCache.getPairByIndex(trade.pairIndex);
    console.error(`Max leverage for ${pair.name} is ${pair.maxLeverage}x`);
  }
}
```
