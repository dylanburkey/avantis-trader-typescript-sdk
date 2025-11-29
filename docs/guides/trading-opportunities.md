# Discovering Trading Opportunities

This guide shows how to use the Avantis SDK to identify and analyze trading opportunities based on market conditions.

## Table of Contents

1. [Market Analysis Fundamentals](#market-analysis-fundamentals)
2. [Opportunity Detection Strategies](#opportunity-detection-strategies)
3. [Signal Generation](#signal-generation)
4. [Risk Assessment](#risk-assessment)
5. [Complete Example: Opportunity Scanner](#complete-example-opportunity-scanner)

## Market Analysis Fundamentals

### Key Metrics for Opportunity Detection

The SDK provides several metrics useful for finding trading opportunities:

| Metric | Description | Use Case |
|--------|-------------|----------|
| **Open Interest** | Total positions in longs/shorts | Gauge market participation |
| **Utilization** | OI as % of limits | Find capacity for large trades |
| **Skew** | Imbalance between longs/shorts | Identify crowded trades |
| **Spread** | Cost to enter position | Optimize entry timing |
| **Blended Metrics** | Combined asset + category | Holistic market view |

### Basic Market Scanner

```typescript
import { TraderClient } from 'avantisfi-sdk';

interface MarketCondition {
  pairIndex: number;
  pairName: string;
  price: number;
  longOi: number;
  shortOi: number;
  skew: number;
  utilization: { long: number; short: number };
  spread: number;
}

async function scanMarkets(): Promise<MarketCondition[]> {
  const client = await TraderClient.create();
  const pairs = await client.pairsCache.getPairsInfo();
  const oi = await client.assetParameters.getOi();

  const conditions: MarketCondition[] = [];

  for (const [index, pair] of pairs) {
    const pairOi = oi.get(index);
    if (!pairOi) continue;

    const [util, skew, spread] = await Promise.all([
      client.blended.getBlendedUtilization(index),
      client.blended.getBlendedSkew(index),
      client.feeParameters.getSpread(index),
    ]);

    let price = 0;
    try {
      price = await client.feedClient.getPrice(index);
    } catch {}

    conditions.push({
      pairIndex: index,
      pairName: pair.name,
      price,
      longOi: pairOi.long,
      shortOi: pairOi.short,
      skew: skew.value,
      utilization: util,
      spread,
    });
  }

  return conditions;
}
```

## Opportunity Detection Strategies

### 1. Skew-Based Opportunities

When the market is heavily skewed in one direction, there may be opportunities to trade against the crowd.

```typescript
interface SkewOpportunity {
  pairIndex: number;
  pairName: string;
  skew: number;
  direction: 'long' | 'short';
  reason: string;
  confidence: number;
}

async function findSkewOpportunities(
  minSkew: number = 0.3
): Promise<SkewOpportunity[]> {
  const client = await TraderClient.create();
  const conditions = await scanMarkets();
  const opportunities: SkewOpportunity[] = [];

  for (const market of conditions) {
    const absSkew = Math.abs(market.skew);
    
    if (absSkew >= minSkew) {
      // Trade against the skew
      const direction = market.skew > 0 ? 'short' : 'long';
      const crowdedSide = market.skew > 0 ? 'long' : 'short';
      
      opportunities.push({
        pairIndex: market.pairIndex,
        pairName: market.pairName,
        skew: market.skew,
        direction,
        reason: `Market is ${(absSkew * 100).toFixed(1)}% skewed ${crowdedSide}. Consider ${direction} for mean reversion.`,
        confidence: Math.min(absSkew * 2, 1), // 0-1 confidence
      });
    }
  }

  // Sort by confidence descending
  return opportunities.sort((a, b) => b.confidence - a.confidence);
}

// Usage
const opportunities = await findSkewOpportunities(0.25);
console.log('Skew-based opportunities:');
for (const opp of opportunities) {
  console.log(`${opp.pairName}: ${opp.direction.toUpperCase()}`);
  console.log(`  ${opp.reason}`);
  console.log(`  Confidence: ${(opp.confidence * 100).toFixed(0)}%`);
}
```

### 2. Low Spread Entry Points

Find pairs with unusually low spreads for cost-effective entries.

```typescript
interface SpreadOpportunity {
  pairIndex: number;
  pairName: string;
  spread: number;
  averageSpread: number;
  savings: number;
  reason: string;
}

async function findLowSpreadOpportunities(): Promise<SpreadOpportunity[]> {
  const client = await TraderClient.create();
  const pairs = await client.pairsCache.getPairsInfo();
  
  // Collect all spreads
  const spreads = new Map<number, number>();
  for (const [index] of pairs) {
    spreads.set(index, await client.feeParameters.getSpread(index));
  }

  // Calculate average
  const allSpreads = [...spreads.values()];
  const avgSpread = allSpreads.reduce((a, b) => a + b, 0) / allSpreads.length;

  // Find below-average spreads
  const opportunities: SpreadOpportunity[] = [];
  
  for (const [index, spread] of spreads) {
    const pair = pairs.get(index);
    if (spread < avgSpread * 0.7) { // 30% below average
      const savings = avgSpread - spread;
      opportunities.push({
        pairIndex: index,
        pairName: pair?.name || `Pair ${index}`,
        spread,
        averageSpread: avgSpread,
        savings,
        reason: `Spread ${savings.toFixed(0)} bps below average - good entry point`,
      });
    }
  }

  return opportunities.sort((a, b) => a.spread - b.spread);
}
```

### 3. Utilization-Based Opportunities

Low utilization means the protocol can accept larger positions.

```typescript
interface CapacityOpportunity {
  pairIndex: number;
  pairName: string;
  direction: 'long' | 'short';
  utilization: number;
  remainingCapacity: number;
  reason: string;
}

async function findCapacityOpportunities(
  maxUtil: number = 50
): Promise<CapacityOpportunity[]> {
  const client = await TraderClient.create();
  const pairs = await client.pairsCache.getPairsInfo();
  const opportunities: CapacityOpportunity[] = [];

  for (const [index, pair] of pairs) {
    const util = await client.blended.getBlendedUtilization(index);
    const limits = await client.assetParameters.getOiLimits();
    const limit = limits.get(index)?.limit || 0;

    // Check long side
    if (util.long < maxUtil) {
      const remaining = limit * (1 - util.long / 100);
      opportunities.push({
        pairIndex: index,
        pairName: pair.name,
        direction: 'long',
        utilization: util.long,
        remainingCapacity: remaining,
        reason: `Only ${util.long.toFixed(1)}% long utilization - $${remaining.toLocaleString()} capacity available`,
      });
    }

    // Check short side
    if (util.short < maxUtil) {
      const remaining = limit * (1 - util.short / 100);
      opportunities.push({
        pairIndex: index,
        pairName: pair.name,
        direction: 'short',
        utilization: util.short,
        remainingCapacity: remaining,
        reason: `Only ${util.short.toFixed(1)}% short utilization - $${remaining.toLocaleString()} capacity available`,
      });
    }
  }

  return opportunities.sort((a, b) => a.utilization - b.utilization);
}
```

### 4. Momentum Detection

Identify pairs with increasing open interest momentum.

```typescript
interface MomentumOpportunity {
  pairIndex: number;
  pairName: string;
  oiChange: number;
  dominantSide: 'long' | 'short';
  confidence: number;
  reason: string;
}

class MomentumTracker {
  private history = new Map<number, Array<{
    timestamp: number;
    longOi: number;
    shortOi: number;
  }>>();

  async recordSnapshot(client: TraderClient): Promise<void> {
    const oi = await client.assetParameters.getOi();
    const timestamp = Date.now();

    for (const [index, data] of oi) {
      const history = this.history.get(index) || [];
      history.push({
        timestamp,
        longOi: data.long,
        shortOi: data.short,
      });

      // Keep last 60 snapshots (e.g., 1 hour at 1-min intervals)
      if (history.length > 60) {
        history.shift();
      }

      this.history.set(index, history);
    }
  }

  async findMomentumOpportunities(
    client: TraderClient,
    minChangePercent: number = 5
  ): Promise<MomentumOpportunity[]> {
    const pairs = await client.pairsCache.getPairsInfo();
    const opportunities: MomentumOpportunity[] = [];

    for (const [index, pair] of pairs) {
      const history = this.history.get(index);
      if (!history || history.length < 10) continue;

      const oldest = history[0];
      const newest = history[history.length - 1];

      const longChange = ((newest.longOi - oldest.longOi) / oldest.longOi) * 100;
      const shortChange = ((newest.shortOi - oldest.shortOi) / oldest.shortOi) * 100;

      const absLongChange = Math.abs(longChange);
      const absShortChange = Math.abs(shortChange);
      const maxChange = Math.max(absLongChange, absShortChange);

      if (maxChange >= minChangePercent) {
        const dominantSide = absLongChange > absShortChange ? 'long' : 'short';
        const change = dominantSide === 'long' ? longChange : shortChange;

        opportunities.push({
          pairIndex: index,
          pairName: pair.name,
          oiChange: change,
          dominantSide,
          confidence: Math.min(maxChange / 20, 1),
          reason: `${dominantSide.toUpperCase()} OI ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% - momentum building`,
        });
      }
    }

    return opportunities.sort((a, b) => b.confidence - a.confidence);
  }
}

// Usage
const tracker = new MomentumTracker();

// Record snapshots every minute
setInterval(async () => {
  const client = await TraderClient.create();
  await tracker.recordSnapshot(client);
}, 60000);

// Check for momentum opportunities
async function checkMomentum() {
  const client = await TraderClient.create();
  const opportunities = await tracker.findMomentumOpportunities(client, 3);
  
  if (opportunities.length > 0) {
    console.log('Momentum opportunities detected:');
    opportunities.forEach(opp => {
      console.log(`  ${opp.pairName}: ${opp.reason}`);
    });
  }
}
```

## Signal Generation

### Combined Signal Generator

```typescript
interface TradingSignal {
  pairIndex: number;
  pairName: string;
  direction: 'long' | 'short';
  strength: 'weak' | 'moderate' | 'strong';
  score: number; // 0-100
  reasons: string[];
  entryPrice: number;
  suggestedTp: number;
  suggestedSl: number;
}

async function generateSignals(): Promise<TradingSignal[]> {
  const client = await TraderClient.create();
  const pairs = await client.pairsCache.getPairsInfo();
  const signals: TradingSignal[] = [];

  for (const [index, pair] of pairs) {
    const [oi, util, skew, spread] = await Promise.all([
      client.assetParameters.getOiForPair(index),
      client.blended.getBlendedUtilization(index),
      client.blended.getBlendedSkew(index),
      client.feeParameters.getSpread(index),
    ]);

    let price = 0;
    try {
      price = await client.feedClient.getPrice(index);
    } catch {
      continue; // Skip pairs without price
    }

    // Score factors
    let longScore = 50;
    let shortScore = 50;
    const longReasons: string[] = [];
    const shortReasons: string[] = [];

    // Skew factor (trade against skew)
    if (skew.value > 0.2) {
      shortScore += 20;
      longScore -= 10;
      shortReasons.push(`Market skewed long (${(skew.value * 100).toFixed(0)}%)`);
    } else if (skew.value < -0.2) {
      longScore += 20;
      shortScore -= 10;
      longReasons.push(`Market skewed short (${(Math.abs(skew.value) * 100).toFixed(0)}%)`);
    }

    // Utilization factor (favor low utilization)
    if (util.long < 30) {
      longScore += 10;
      longReasons.push(`Low long utilization (${util.long.toFixed(0)}%)`);
    }
    if (util.short < 30) {
      shortScore += 10;
      shortReasons.push(`Low short utilization (${util.short.toFixed(0)}%)`);
    }

    // Spread factor (favor low spread)
    if (spread < 5) {
      longScore += 5;
      shortScore += 5;
      longReasons.push(`Low spread (${spread} bps)`);
      shortReasons.push(`Low spread (${spread} bps)`);
    }

    // OI balance factor
    const totalOi = oi.long + oi.short;
    if (totalOi > 0) {
      const longDominance = oi.long / totalOi;
      if (longDominance > 0.65) {
        shortScore += 15;
        shortReasons.push(`Long-heavy OI (${(longDominance * 100).toFixed(0)}%)`);
      } else if (longDominance < 0.35) {
        longScore += 15;
        longReasons.push(`Short-heavy OI (${((1 - longDominance) * 100).toFixed(0)}%)`);
      }
    }

    // Generate signal for the stronger direction
    const direction = longScore > shortScore ? 'long' : 'short';
    const score = direction === 'long' ? longScore : shortScore;
    const reasons = direction === 'long' ? longReasons : shortReasons;

    if (score >= 60 && reasons.length >= 2) {
      // Calculate TP/SL
      const movePercent = direction === 'long' ? 0.03 : -0.03; // 3% move
      const slPercent = direction === 'long' ? -0.02 : 0.02; // 2% stop

      signals.push({
        pairIndex: index,
        pairName: pair.name,
        direction,
        strength: score >= 80 ? 'strong' : score >= 70 ? 'moderate' : 'weak',
        score,
        reasons,
        entryPrice: price,
        suggestedTp: price * (1 + movePercent),
        suggestedSl: price * (1 + slPercent),
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

// Usage
const signals = await generateSignals();
console.log('\n=== Trading Signals ===\n');

for (const signal of signals.slice(0, 5)) {
  console.log(`${signal.pairName} - ${signal.direction.toUpperCase()} (${signal.strength})`);
  console.log(`  Score: ${signal.score}/100`);
  console.log(`  Entry: $${signal.entryPrice.toFixed(2)}`);
  console.log(`  TP: $${signal.suggestedTp.toFixed(2)}`);
  console.log(`  SL: $${signal.suggestedSl.toFixed(2)}`);
  console.log(`  Reasons:`);
  signal.reasons.forEach(r => console.log(`    - ${r}`));
  console.log('');
}
```

## Risk Assessment

### Position Risk Calculator

```typescript
interface RiskAssessment {
  pairIndex: number;
  direction: 'long' | 'short';
  positionSize: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  riskScore: number; // 0-100
  warnings: string[];
  recommendations: string[];
}

async function assessRisk(
  pairIndex: number,
  direction: 'long' | 'short',
  collateral: number,
  leverage: number
): Promise<RiskAssessment> {
  const client = await TraderClient.create();
  const positionSize = collateral * leverage;
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let riskScore = 0;

  const [pair, util, skew, limits] = await Promise.all([
    client.pairsCache.getPairByIndex(pairIndex),
    client.blended.getBlendedUtilization(pairIndex),
    client.blended.getBlendedSkew(pairIndex),
    client.assetParameters.getOiLimits(),
  ]);

  // Leverage risk
  if (leverage > (pair?.maxLeverage || 50) * 0.8) {
    riskScore += 30;
    warnings.push(`High leverage (${leverage}x) near maximum`);
    recommendations.push('Consider reducing leverage to leave room for volatility');
  } else if (leverage > 20) {
    riskScore += 15;
  }

  // Utilization risk
  const myUtil = direction === 'long' ? util.long : util.short;
  if (myUtil > 80) {
    riskScore += 25;
    warnings.push(`High utilization (${myUtil.toFixed(0)}%) - harder to exit`);
    recommendations.push('Wait for utilization to decrease or reduce size');
  } else if (myUtil > 60) {
    riskScore += 10;
  }

  // Skew risk (going with crowded side)
  const goingWithSkew = (direction === 'long' && skew.value > 0) ||
                        (direction === 'short' && skew.value < 0);
  if (goingWithSkew && Math.abs(skew.value) > 0.3) {
    riskScore += 20;
    warnings.push(`Trading with skew (${(skew.value * 100).toFixed(0)}%) - crowded trade`);
    recommendations.push('Consider contra-skew trade for better funding rates');
  }

  // Position size risk relative to limit
  const limit = limits.get(pairIndex)?.limit || Infinity;
  const sizeRatio = positionSize / limit;
  if (sizeRatio > 0.1) {
    riskScore += 25;
    warnings.push(`Large position (${(sizeRatio * 100).toFixed(1)}% of limit)`);
    recommendations.push('Consider splitting into multiple smaller positions');
  } else if (sizeRatio > 0.05) {
    riskScore += 10;
  }

  // Collateral concentration risk
  if (collateral > 1000) {
    riskScore += 10;
    recommendations.push('Consider using multiple positions for diversification');
  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  if (riskScore >= 70) {
    riskLevel = 'extreme';
  } else if (riskScore >= 50) {
    riskLevel = 'high';
  } else if (riskScore >= 25) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  if (warnings.length === 0) {
    recommendations.push('Trade parameters look reasonable');
  }

  return {
    pairIndex,
    direction,
    positionSize,
    riskLevel,
    riskScore,
    warnings,
    recommendations,
  };
}

// Usage
const risk = await assessRisk(0, 'long', 500, 20);
console.log(`Risk Level: ${risk.riskLevel.toUpperCase()} (${risk.riskScore}/100)`);
console.log('Warnings:', risk.warnings);
console.log('Recommendations:', risk.recommendations);
```

## Complete Example: Opportunity Scanner

```typescript
// opportunity-scanner.ts
import { TraderClient } from 'avantisfi-sdk';

interface Opportunity {
  pairIndex: number;
  pairName: string;
  type: 'skew' | 'spread' | 'capacity' | 'momentum';
  direction: 'long' | 'short';
  score: number;
  reason: string;
  suggestedParams: {
    collateral: number;
    leverage: number;
    tp: number;
    sl: number;
  };
}

class OpportunityScanner {
  private client: TraderClient | null = null;

  async initialize(): Promise<void> {
    this.client = await TraderClient.create();
    console.log('Scanner initialized');
  }

  async scan(): Promise<Opportunity[]> {
    if (!this.client) throw new Error('Scanner not initialized');

    const opportunities: Opportunity[] = [];
    const pairs = await this.client.pairsCache.getPairsInfo();

    for (const [index, pair] of pairs) {
      // Skip pairs with very low OI
      const oi = await this.client.assetParameters.getOiForPair(index);
      if (oi.long + oi.short < 10000) continue;

      let price = 0;
      try {
        price = await this.client.feedClient.getPrice(index);
      } catch {
        continue;
      }

      const [util, skew, spread] = await Promise.all([
        this.client.blended.getBlendedUtilization(index),
        this.client.blended.getBlendedSkew(index),
        this.client.feeParameters.getSpread(index),
      ]);

      // Check skew opportunity
      if (Math.abs(skew.value) > 0.25) {
        const direction = skew.value > 0 ? 'short' : 'long';
        opportunities.push({
          pairIndex: index,
          pairName: pair.name,
          type: 'skew',
          direction,
          score: Math.min(Math.abs(skew.value) * 200, 100),
          reason: `${(Math.abs(skew.value) * 100).toFixed(0)}% ${skew.value > 0 ? 'long' : 'short'} skew`,
          suggestedParams: this.getSuggestedParams(price, direction, pair.maxLeverage),
        });
      }

      // Check spread opportunity
      if (spread < 3) {
        opportunities.push({
          pairIndex: index,
          pairName: pair.name,
          type: 'spread',
          direction: skew.value < 0 ? 'long' : 'short', // Against skew
          score: (10 - spread) * 10,
          reason: `Very low spread: ${spread} bps`,
          suggestedParams: this.getSuggestedParams(price, 'long', pair.maxLeverage),
        });
      }

      // Check capacity opportunity
      const minUtil = Math.min(util.long, util.short);
      if (minUtil < 20) {
        const direction = util.long < util.short ? 'long' : 'short';
        opportunities.push({
          pairIndex: index,
          pairName: pair.name,
          type: 'capacity',
          direction,
          score: (20 - minUtil) * 3,
          reason: `Low ${direction} utilization: ${minUtil.toFixed(0)}%`,
          suggestedParams: this.getSuggestedParams(price, direction, pair.maxLeverage),
        });
      }
    }

    return opportunities.sort((a, b) => b.score - a.score);
  }

  private getSuggestedParams(
    price: number,
    direction: 'long' | 'short',
    maxLeverage: number
  ): Opportunity['suggestedParams'] {
    const leverage = Math.min(10, maxLeverage);
    const tpMultiplier = direction === 'long' ? 1.03 : 0.97;
    const slMultiplier = direction === 'long' ? 0.98 : 1.02;

    return {
      collateral: 100, // Default $100
      leverage,
      tp: price * tpMultiplier,
      sl: price * slMultiplier,
    };
  }

  async runContinuously(intervalMs: number = 60000): Promise<void> {
    console.log('Starting continuous scan...');
    
    while (true) {
      try {
        const opportunities = await this.scan();
        
        console.clear();
        console.log(`\n=== Opportunity Scan (${new Date().toLocaleTimeString()}) ===\n`);
        
        if (opportunities.length === 0) {
          console.log('No strong opportunities found');
        } else {
          for (const opp of opportunities.slice(0, 5)) {
            console.log(`${opp.pairName} - ${opp.direction.toUpperCase()} (${opp.type})`);
            console.log(`  Score: ${opp.score.toFixed(0)}/100`);
            console.log(`  Reason: ${opp.reason}`);
            console.log(`  Suggested: ${opp.suggestedParams.leverage}x, TP: $${opp.suggestedParams.tp.toFixed(2)}`);
            console.log('');
          }
        }
      } catch (error) {
        console.error('Scan error:', error);
      }

      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
}

// Run the scanner
const scanner = new OpportunityScanner();
await scanner.initialize();
await scanner.runContinuously(30000); // Scan every 30 seconds
```

## Next Steps

- [Automated Trading](./automated-trading.md) - Execute trades automatically
- [Implementation Guide](./implementation.md) - Project setup best practices
- [API Reference](../api/blended-metrics.md) - Complete API documentation
