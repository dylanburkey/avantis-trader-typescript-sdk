# AssetParameters API Reference

The `AssetParametersRPC` class provides asset-level market data and metrics.

## Access

```typescript
const client = await TraderClient.create();
const assetParams = client.assetParameters;
```

## Methods

### `getOi`

```typescript
async getOi(): Promise<Map<number, OpenInterest>>
```

Get open interest for all trading pairs.

**Returns:** Map of pair index to open interest

**Example:**
```typescript
const oi = await client.assetParameters.getOi();

for (const [pairIndex, data] of oi) {
  console.log(`Pair ${pairIndex}:`);
  console.log(`  Long OI: $${data.long.toLocaleString()}`);
  console.log(`  Short OI: $${data.short.toLocaleString()}`);
}
```

### `getOiForPair`

```typescript
async getOiForPair(pairIndex: number): Promise<OpenInterest>
```

Get open interest for a specific pair.

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Open interest data

**Example:**
```typescript
const ethOi = await client.assetParameters.getOiForPair(0);
console.log(`ETH/USD Long: $${ethOi.long}, Short: $${ethOi.short}`);
```

### `getOiLimits`

```typescript
async getOiLimits(): Promise<Map<number, OpenInterestLimits>>
```

Get open interest limits for all pairs.

**Returns:** Map of pair index to OI limits

**Example:**
```typescript
const limits = await client.assetParameters.getOiLimits();
const ethLimit = limits.get(0);
console.log(`ETH/USD max OI: $${ethLimit?.limit.toLocaleString()}`);
```

### `getUtilization`

```typescript
async getUtilization(pairIndex: number): Promise<Utilization>
```

Get utilization percentages for a pair (OI / Limit).

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Utilization percentages (0-100)

**Example:**
```typescript
const util = await client.assetParameters.getUtilization(0);
console.log(`Long utilization: ${util.long.toFixed(2)}%`);
console.log(`Short utilization: ${util.short.toFixed(2)}%`);
```

### `getSkew`

```typescript
async getSkew(pairIndex: number): Promise<Skew>
```

Get skew metrics for a pair (imbalance between longs and shorts).

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Skew values (-1 to 1)

**Example:**
```typescript
const skew = await client.assetParameters.getSkew(0);
console.log(`Skew: ${skew.value.toFixed(4)}`);
// Positive = more longs, Negative = more shorts
```

### `getPriceImpactSpread`

```typescript
async getPriceImpactSpread(
  pairIndex: number,
  positionSize: number,
  isLong: boolean
): Promise<number>
```

Calculate price impact spread for a potential trade.

**Parameters:**
- `pairIndex`: Trading pair index
- `positionSize`: Position size in USDC
- `isLong`: Trade direction

**Returns:** Spread in basis points

**Example:**
```typescript
const spread = await client.assetParameters.getPriceImpactSpread(
  0,      // ETH/USD
  10000,  // $10,000 position
  true    // Long
);
console.log(`Price impact: ${spread} bps`);
```

### `getSkewImpactSpread`

```typescript
async getSkewImpactSpread(
  pairIndex: number,
  positionSize: number,
  isLong: boolean
): Promise<number>
```

Calculate skew-based spread for a potential trade.

**Parameters:**
- `pairIndex`: Trading pair index
- `positionSize`: Position size in USDC
- `isLong`: Trade direction

**Returns:** Spread in basis points

**Example:**
```typescript
const skewSpread = await client.assetParameters.getSkewImpactSpread(
  0,      // ETH/USD
  10000,  // $10,000 position
  true    // Long
);
console.log(`Skew impact: ${skewSpread} bps`);
```

## Type Definitions

### OpenInterest

```typescript
interface OpenInterest {
  long: number;   // Long OI in USDC
  short: number;  // Short OI in USDC
}
```

### OpenInterestLimits

```typescript
interface OpenInterestLimits {
  limit: number;  // Max OI in USDC
}
```

### Utilization

```typescript
interface Utilization {
  long: number;   // Long utilization % (0-100)
  short: number;  // Short utilization % (0-100)
}
```

### Skew

```typescript
interface Skew {
  value: number;  // Skew value (-1 to 1)
  long: number;   // Long skew component
  short: number;  // Short skew component
}
```

## Usage Patterns

### Monitor Market Balance

```typescript
async function analyzeMarketBalance(pairIndex: number) {
  const oi = await client.assetParameters.getOiForPair(pairIndex);
  const total = oi.long + oi.short;
  
  if (total === 0) {
    console.log('No open positions');
    return;
  }
  
  const longPct = (oi.long / total) * 100;
  const shortPct = (oi.short / total) * 100;
  
  console.log(`Long: ${longPct.toFixed(1)}% ($${oi.long.toLocaleString()})`);
  console.log(`Short: ${shortPct.toFixed(1)}% ($${oi.short.toLocaleString()})`);
  
  if (longPct > 70) {
    console.log('Market is heavily long - consider shorting');
  } else if (shortPct > 70) {
    console.log('Market is heavily short - consider longing');
  }
}
```

### Find Most Utilized Pairs

```typescript
async function getMostUtilizedPairs(limit: number = 5) {
  const pairs = await client.pairsCache.getPairsInfo();
  const utilizations: Array<{name: string; util: number}> = [];
  
  for (const [index, pair] of pairs) {
    const util = await client.assetParameters.getUtilization(index);
    const maxUtil = Math.max(util.long, util.short);
    utilizations.push({ name: pair.name, util: maxUtil });
  }
  
  return utilizations
    .sort((a, b) => b.util - a.util)
    .slice(0, limit);
}

const top = await getMostUtilizedPairs(5);
console.log('Most utilized pairs:');
top.forEach((p, i) => console.log(`${i + 1}. ${p.name}: ${p.util.toFixed(1)}%`));
```

### Calculate Trade Cost

```typescript
async function estimateTradeCost(
  pairIndex: number,
  positionSize: number,
  isLong: boolean
) {
  const [priceImpact, skewImpact] = await Promise.all([
    client.assetParameters.getPriceImpactSpread(pairIndex, positionSize, isLong),
    client.assetParameters.getSkewImpactSpread(pairIndex, positionSize, isLong),
  ]);
  
  const baseSpread = await client.feeParameters.getSpread(pairIndex);
  const totalSpread = baseSpread + priceImpact + skewImpact;
  const cost = (positionSize * totalSpread) / 10000; // bps to USD
  
  console.log(`Base spread: ${baseSpread} bps`);
  console.log(`Price impact: ${priceImpact} bps`);
  console.log(`Skew impact: ${skewImpact} bps`);
  console.log(`Total: ${totalSpread} bps ($${cost.toFixed(2)})`);
  
  return cost;
}
```

## Data Flow

```
┌───────────────────────────────────────────────────────────┐
│                    Socket API Response                     │
├───────────────────────────────────────────────────────────┤
│  {                                                         │
│    "pairInfos": {                                         │
│      "0": {                                               │
│        "longOI": "1234567890",                            │
│        "shortOI": "987654321",                            │
│        "maxOI": "10000000000",                            │
│        ...                                                │
│      }                                                    │
│    }                                                      │
│  }                                                        │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                       PairsCache                           │
│                  (Caches & normalizes)                     │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                   AssetParametersRPC                       │
│          (Converts to human-readable USDC values)          │
├───────────────────────────────────────────────────────────┤
│  getOi() → { long: 1234.56, short: 987.65 }               │
│  getUtilization() → { long: 12.34%, short: 9.87% }        │
│  getSkew() → { value: 0.11, long: 0.55, short: 0.45 }     │
└───────────────────────────────────────────────────────────┘
```
