# BlendedRPC API Reference

The `BlendedRPC` class provides blended metrics that combine asset-level and category-level data for comprehensive market analysis.

## Access

```typescript
const client = await TraderClient.create();
const blended = client.blended;
```

## Overview

Blended metrics combine:
- **Asset-level data**: Specific to individual trading pairs (e.g., ETH/USD)
- **Category-level data**: Aggregated across groups (e.g., all Crypto pairs)

This provides a more complete picture of market conditions for trading decisions.

```
┌─────────────────────────────────────────────────────────┐
│                    Blended Metrics                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   Asset Level          Category Level                   │
│   ┌─────────┐          ┌─────────────┐                  │
│   │ ETH/USD │          │   Crypto    │                  │
│   │ OI: $1M │    +     │   OI: $50M  │                  │
│   │ Util: 5%│          │   Util: 25% │                  │
│   └─────────┘          └─────────────┘                  │
│        │                     │                          │
│        └──────────┬──────────┘                          │
│                   │                                      │
│                   ▼                                      │
│            ┌─────────────┐                              │
│            │   Blended   │                              │
│            │  Util: 30%  │                              │
│            │  (weighted) │                              │
│            └─────────────┘                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Methods

### `getBlendedUtilization`

```typescript
async getBlendedUtilization(pairIndex: number): Promise<Utilization>
```

Get blended utilization combining asset and category utilization.

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Blended utilization percentages

**Example:**
```typescript
const util = await client.blended.getBlendedUtilization(0);
console.log(`Blended Long Util: ${util.long.toFixed(2)}%`);
console.log(`Blended Short Util: ${util.short.toFixed(2)}%`);
```

### `getBlendedSkew`

```typescript
async getBlendedSkew(pairIndex: number): Promise<Skew>
```

Get blended skew combining asset and category skew.

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Blended skew values

**Example:**
```typescript
const skew = await client.blended.getBlendedSkew(0);
console.log(`Blended Skew: ${skew.value.toFixed(4)}`);
console.log(`Long component: ${skew.long.toFixed(4)}`);
console.log(`Short component: ${skew.short.toFixed(4)}`);
```

### `getBlendedOi`

```typescript
async getBlendedOi(pairIndex: number): Promise<OpenInterest>
```

Get blended open interest combining asset and category OI.

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Blended open interest

**Example:**
```typescript
const oi = await client.blended.getBlendedOi(0);
console.log(`Total Long Exposure: $${oi.long.toLocaleString()}`);
console.log(`Total Short Exposure: $${oi.short.toLocaleString()}`);
```

### `getTotalSpread`

```typescript
async getTotalSpread(
  pairIndex: number,
  positionSize: number,
  isLong: boolean
): Promise<number>
```

Get total spread including base, price impact, and skew impact.

**Parameters:**
- `pairIndex`: Trading pair index
- `positionSize`: Position size in USDC
- `isLong`: Trade direction

**Returns:** Total spread in basis points

**Example:**
```typescript
const spread = await client.blended.getTotalSpread(0, 10000, true);
console.log(`Total spread: ${spread} bps`);
console.log(`Cost: $${(10000 * spread / 10000).toFixed(2)}`);
```

### `getMarketSnapshot`

```typescript
async getMarketSnapshot(pairIndex: number): Promise<MarketSnapshot>
```

Get a complete market snapshot for a pair.

**Parameters:**
- `pairIndex`: Trading pair index

**Returns:** Complete market data snapshot

**Example:**
```typescript
const snapshot = await client.blended.getMarketSnapshot(0);

console.log(`=== ${snapshot.pairName} ===`);
console.log(`Price: $${snapshot.price.toFixed(2)}`);
console.log(`Long OI: $${snapshot.oi.long.toLocaleString()}`);
console.log(`Short OI: $${snapshot.oi.short.toLocaleString()}`);
console.log(`Utilization: L=${snapshot.utilization.long}%, S=${snapshot.utilization.short}%`);
console.log(`Skew: ${snapshot.skew.value.toFixed(4)}`);
```

## Type Definitions

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
  value: number;  // Net skew (-1 to 1)
  long: number;   // Long skew component
  short: number;  // Short skew component
}
```

### OpenInterest

```typescript
interface OpenInterest {
  long: number;   // Long OI in USDC
  short: number;  // Short OI in USDC
}
```

### MarketSnapshot

```typescript
interface MarketSnapshot {
  pairName: string;
  pairIndex: number;
  price: number;
  oi: OpenInterest;
  utilization: Utilization;
  skew: Skew;
  spread: number;
  timestamp: number;
}
```

## Blending Algorithm

The blending algorithm weights asset and category metrics:

```
blended_util = (asset_util * asset_weight) + (category_util * category_weight)

where:
  asset_weight = asset_oi / (asset_oi + category_oi_share)
  category_weight = 1 - asset_weight
```

This ensures:
- Small positions are more affected by category-level conditions
- Large positions relative to the asset are more affected by asset-level conditions

## Usage Patterns

### Trading Decision Support

```typescript
async function shouldOpenPosition(
  pairIndex: number,
  isLong: boolean,
  positionSize: number
): Promise<{recommend: boolean; reason: string}> {
  const util = await client.blended.getBlendedUtilization(pairIndex);
  const skew = await client.blended.getBlendedSkew(pairIndex);
  const spread = await client.blended.getTotalSpread(pairIndex, positionSize, isLong);
  
  // Check utilization
  const myUtil = isLong ? util.long : util.short;
  if (myUtil > 80) {
    return {
      recommend: false,
      reason: `High utilization (${myUtil.toFixed(1)}%) - consider reducing size`,
    };
  }
  
  // Check if going against skew (favorable)
  const goingWithSkew = (isLong && skew.value > 0) || (!isLong && skew.value < 0);
  if (goingWithSkew && Math.abs(skew.value) > 0.3) {
    return {
      recommend: false,
      reason: `High skew against you (${skew.value.toFixed(2)}) - unfavorable entry`,
    };
  }
  
  // Check spread
  if (spread > 50) { // 0.5%
    return {
      recommend: false,
      reason: `High spread (${spread} bps) - wait for better conditions`,
    };
  }
  
  return {
    recommend: true,
    reason: `Good conditions: util=${myUtil.toFixed(1)}%, skew=${skew.value.toFixed(2)}, spread=${spread}bps`,
  };
}
```

### Multi-Pair Comparison

```typescript
async function comparePairs(pairIndexes: number[]) {
  const snapshots = await Promise.all(
    pairIndexes.map(i => client.blended.getMarketSnapshot(i))
  );
  
  console.log('Pair Comparison:');
  console.log('─'.repeat(60));
  
  for (const snap of snapshots) {
    const totalOi = snap.oi.long + snap.oi.short;
    const bias = snap.skew.value > 0 ? 'LONG' : 'SHORT';
    
    console.log(`${snap.pairName}:`);
    console.log(`  OI: $${totalOi.toLocaleString()}`);
    console.log(`  Bias: ${bias} (${(Math.abs(snap.skew.value) * 100).toFixed(1)}%)`);
    console.log(`  Spread: ${snap.spread} bps`);
    console.log('');
  }
}

await comparePairs([0, 1, 2]); // ETH, BTC, SOL
```

### Monitor Extreme Conditions

```typescript
async function findExtremeConditions() {
  const pairs = await client.pairsCache.getPairsInfo();
  const extremes: string[] = [];
  
  for (const [index, pair] of pairs) {
    const util = await client.blended.getBlendedUtilization(index);
    const skew = await client.blended.getBlendedSkew(index);
    
    if (util.long > 90 || util.short > 90) {
      extremes.push(`${pair.name}: High utilization (L=${util.long}%, S=${util.short}%)`);
    }
    
    if (Math.abs(skew.value) > 0.5) {
      const direction = skew.value > 0 ? 'long' : 'short';
      extremes.push(`${pair.name}: Extreme ${direction} skew (${skew.value.toFixed(2)})`);
    }
  }
  
  return extremes;
}

const alerts = await findExtremeConditions();
if (alerts.length > 0) {
  console.log('Market Alerts:');
  alerts.forEach(a => console.log(`  - ${a}`));
}
```

## Data Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐
│ AssetParameters │     │CategoryParameters│
│                 │     │                  │
│ • getOi()       │     │ • getOi()        │
│ • getUtilization│     │ • getUtilization │
│ • getSkew()     │     │ • getSkew()      │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │      BlendedRPC       │
         │                       │
         │ • Combines metrics    │
         │ • Applies weighting   │
         │ • Returns unified view│
         └───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Blended Metrics     │
         │                       │
         │ • getBlendedUtil()    │
         │ • getBlendedSkew()    │
         │ • getTotalSpread()    │
         │ • getMarketSnapshot() │
         └───────────────────────┘
```
