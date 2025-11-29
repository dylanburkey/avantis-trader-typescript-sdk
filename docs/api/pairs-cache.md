# PairsCache API Reference

The `PairsCache` class provides caching and access to trading pair information from the Avantis Socket API.

## Access

```typescript
const client = await TraderClient.create();
const pairsCache = client.pairsCache;
```

## Data Source

The PairsCache fetches data from the Avantis Socket API:
```
https://socket-api-pub.avantisfi.com/socket-api/v1/data
```

This provides real-time pair information including:
- Pair configuration (name, leverage limits)
- Open interest data
- Group information
- Spread settings

## Methods

### `getPairsInfo`

```typescript
async getPairsInfo(forceUpdate?: boolean): Promise<Map<number, PairInfoWithData>>
```

Get information for all trading pairs.

**Parameters:**
- `forceUpdate` (optional): Force refresh from API, bypassing cache

**Returns:** Map of pair index to pair info

**Example:**
```typescript
const pairs = await client.pairsCache.getPairsInfo();

for (const [index, pair] of pairs) {
  console.log(`${pair.name} (${index})`);
  console.log(`  Group: ${pair.groupIndex}`);
  console.log(`  Leverage: ${pair.minLeverage}x - ${pair.maxLeverage}x`);
}
```

### `getPairByIndex`

```typescript
async getPairByIndex(pairIndex: number): Promise<PairInfoWithData | undefined>
```

Get information for a specific pair by index.

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Pair info or `undefined` if not found

**Example:**
```typescript
const ethUsd = await client.pairsCache.getPairByIndex(0);
if (ethUsd) {
  console.log(`ETH/USD max leverage: ${ethUsd.maxLeverage}x`);
}
```

### `getPairByName`

```typescript
async getPairByName(name: string): Promise<PairInfoWithData | undefined>
```

Get information for a specific pair by name.

**Parameters:**
- `name`: Pair name (e.g., "ETH/USD", "BTC/USD")

**Returns:** Pair info or `undefined` if not found

**Example:**
```typescript
const btcUsd = await client.pairsCache.getPairByName('BTC/USD');
if (btcUsd) {
  console.log(`BTC/USD index: ${btcUsd.pairIndex}`);
}
```

### `getPairNames`

```typescript
async getPairNames(): Promise<string[]>
```

Get names of all available trading pairs.

**Returns:** Array of pair names

**Example:**
```typescript
const names = await client.pairsCache.getPairNames();
console.log('Available pairs:', names.join(', '));
// Output: ETH/USD, BTC/USD, SOL/USD, ...
```

### `getPairCount`

```typescript
async getPairCount(): Promise<number>
```

Get total number of trading pairs.

**Returns:** Number of pairs

**Example:**
```typescript
const count = await client.pairsCache.getPairCount();
console.log(`Total pairs: ${count}`);
```

### `getGroupIndexes`

```typescript
async getGroupIndexes(): Promise<number[]>
```

Get all unique group indexes.

**Returns:** Array of group indexes

**Example:**
```typescript
const groups = await client.pairsCache.getGroupIndexes();
console.log('Groups:', groups); // [0, 1, 2, ...]
```

### `getGroupInfo`

```typescript
async getGroupInfo(groupIndex: number): Promise<GroupInfo | undefined>
```

Get information for a specific group.

**Parameters:**
- `groupIndex`: Group index

**Returns:** Group info or `undefined` if not found

**Example:**
```typescript
const cryptoGroup = await client.pairsCache.getGroupInfo(0);
if (cryptoGroup) {
  console.log(`Crypto group max OI: $${cryptoGroup.maxOI}`);
}
```

### `getPairsByGroup`

```typescript
async getPairsByGroup(groupIndex: number): Promise<PairInfoWithData[]>
```

Get all pairs in a specific group.

**Parameters:**
- `groupIndex`: Group index

**Returns:** Array of pairs in the group

**Example:**
```typescript
const cryptoPairs = await client.pairsCache.getPairsByGroup(0);
console.log(`Crypto pairs: ${cryptoPairs.map(p => p.name).join(', ')}`);
```

### `getFeedId`

```typescript
async getFeedId(pairIndex: number): Promise<string | undefined>
```

Get Pyth feed ID for a pair.

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Pyth feed ID (hex string) or `undefined`

**Example:**
```typescript
const feedId = await client.pairsCache.getFeedId(0);
console.log(`ETH/USD feed: ${feedId}`);
```

## Type Definitions

### PairInfoWithData

```typescript
interface PairInfoWithData {
  name: string;
  pairIndex: number;
  groupIndex: number;
  feedId: string;
  minLeverage: number;
  maxLeverage: number;
  data: PairData;
}
```

### PairData

```typescript
interface PairData {
  longOI: bigint;      // Long open interest (raw)
  shortOI: bigint;     // Short open interest (raw)
  maxOI: bigint;       // Max open interest (raw)
  spreadP: number;     // Spread percentage
  isPaused: boolean;   // Trading paused
}
```

### GroupInfo

```typescript
interface GroupInfo {
  name: string;
  groupIndex: number;
  maxOI: number;       // Max OI in USDC
  currentOI: number;   // Current total OI in USDC
  maxOpenInterestP: number;  // Max OI percentage
  isSpreadDynamic: boolean;
}
```

## Caching Behavior

```
┌─────────────────────────────────────────────────────────┐
│                    Cache Strategy                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Request                                                 │
│     │                                                    │
│     ▼                                                    │
│  ┌─────────────────┐                                    │
│  │ Check Cache Age │                                    │
│  └────────┬────────┘                                    │
│           │                                              │
│    ┌──────┴──────┐                                      │
│    │             │                                      │
│  Fresh        Stale (>5min) or forceUpdate              │
│    │             │                                      │
│    ▼             ▼                                      │
│  Return      Fetch from                                 │
│  Cached      Socket API                                 │
│  Data           │                                       │
│                 ▼                                       │
│              Update                                     │
│              Cache                                      │
│                 │                                       │
│                 ▼                                       │
│              Return                                     │
│              Fresh Data                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Default TTL:** 5 minutes (300,000 ms)

**Force refresh:**
```typescript
// Bypass cache
const pairs = await client.pairsCache.getPairsInfo(true);
```

## Usage Patterns

### Find Pairs by Leverage

```typescript
const pairs = await client.pairsCache.getPairsInfo();
const highLeveragePairs = [...pairs.values()]
  .filter(p => p.maxLeverage >= 50)
  .map(p => p.name);

console.log('High leverage pairs:', highLeveragePairs);
```

### Group Analysis

```typescript
const groups = await client.pairsCache.getGroupIndexes();

for (const groupIndex of groups) {
  const info = await client.pairsCache.getGroupInfo(groupIndex);
  const pairs = await client.pairsCache.getPairsByGroup(groupIndex);
  
  console.log(`\n${info?.name || `Group ${groupIndex}`}:`);
  console.log(`  Pairs: ${pairs.length}`);
  console.log(`  Max OI: $${info?.maxOI.toLocaleString()}`);
  console.log(`  Current OI: $${info?.currentOI.toLocaleString()}`);
}
```

### Validate Pair Before Trading

```typescript
async function validatePair(name: string, leverage: number): Promise<boolean> {
  const pair = await client.pairsCache.getPairByName(name);
  
  if (!pair) {
    console.error(`Pair ${name} not found`);
    return false;
  }
  
  if (pair.data.isPaused) {
    console.error(`Trading paused for ${name}`);
    return false;
  }
  
  if (leverage > pair.maxLeverage) {
    console.error(`Leverage ${leverage}x exceeds max ${pair.maxLeverage}x`);
    return false;
  }
  
  return true;
}
```
