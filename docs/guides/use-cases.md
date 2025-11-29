# SDK Use Cases

This guide explores various use cases for the Avantis TypeScript SDK, from simple market data consumers to sophisticated trading systems.

## Table of Contents

1. [Market Data & Analytics](#market-data--analytics)
2. [Portfolio Tracking](#portfolio-tracking)
3. [Trading Applications](#trading-applications)
4. [Automated Systems](#automated-systems)
5. [Integration Patterns](#integration-patterns)

---

## Market Data & Analytics

### Use Case 1: Market Dashboard

Build a real-time dashboard displaying market conditions across all trading pairs.

```typescript
import { TraderClient } from 'avantisfi-sdk';

interface MarketStats {
  totalLongOi: number;
  totalShortOi: number;
  topPairs: Array<{ name: string; oi: number; skew: number }>;
  avgSpread: number;
  timestamp: Date;
}

async function getMarketStats(): Promise<MarketStats> {
  const client = await TraderClient.create();
  const pairs = await client.pairsCache.getPairsInfo();
  const oi = await client.assetParameters.getOi();

  let totalLongOi = 0;
  let totalShortOi = 0;
  let totalSpread = 0;
  const pairStats: Array<{ name: string; oi: number; skew: number }> = [];

  for (const [index, pair] of pairs) {
    const pairOi = oi.get(index);
    if (!pairOi) continue;

    totalLongOi += pairOi.long;
    totalShortOi += pairOi.short;

    const spread = await client.feeParameters.getSpread(index);
    totalSpread += spread;

    const skew = await client.blended.getBlendedSkew(index);
    pairStats.push({
      name: pair.name,
      oi: pairOi.long + pairOi.short,
      skew: skew.value,
    });
  }

  // Sort by OI
  pairStats.sort((a, b) => b.oi - a.oi);

  return {
    totalLongOi,
    totalShortOi,
    topPairs: pairStats.slice(0, 10),
    avgSpread: totalSpread / pairs.size,
    timestamp: new Date(),
  };
}

// Usage: Poll for stats
setInterval(async () => {
  const stats = await getMarketStats();
  console.log(`Total OI: $${(stats.totalLongOi + stats.totalShortOi).toLocaleString()}`);
  console.log(`Long/Short: ${((stats.totalLongOi / (stats.totalLongOi + stats.totalShortOi)) * 100).toFixed(1)}%`);
}, 30000);
```

**Applications:**
- Trading terminals
- Market analysis websites
- Institutional dashboards
- Research tools

---

### Use Case 2: Historical Data Collection

Collect and store market data for backtesting and analysis.

```typescript
import { TraderClient } from 'avantisfi-sdk';
import * as fs from 'fs';

interface DataPoint {
  timestamp: number;
  pairIndex: number;
  pairName: string;
  price: number;
  longOi: number;
  shortOi: number;
  skew: number;
  spread: number;
}

class DataCollector {
  private client: TraderClient | null = null;
  private dataFile: string;

  constructor(outputFile: string = './market_data.jsonl') {
    this.dataFile = outputFile;
  }

  async initialize(): Promise<void> {
    this.client = await TraderClient.create();
  }

  async collectSnapshot(): Promise<DataPoint[]> {
    if (!this.client) throw new Error('Not initialized');

    const pairs = await this.client.pairsCache.getPairsInfo();
    const oi = await this.client.assetParameters.getOi();
    const timestamp = Date.now();
    const dataPoints: DataPoint[] = [];

    for (const [index, pair] of pairs) {
      const pairOi = oi.get(index);
      if (!pairOi) continue;

      let price = 0;
      try {
        price = await this.client.feedClient.getPrice(index);
      } catch {}

      const skew = await this.client.blended.getBlendedSkew(index);
      const spread = await this.client.feeParameters.getSpread(index);

      dataPoints.push({
        timestamp,
        pairIndex: index,
        pairName: pair.name,
        price,
        longOi: pairOi.long,
        shortOi: pairOi.short,
        skew: skew.value,
        spread,
      });
    }

    return dataPoints;
  }

  async saveSnapshot(): Promise<void> {
    const data = await this.collectSnapshot();
    const lines = data.map(d => JSON.stringify(d)).join('\n') + '\n';
    fs.appendFileSync(this.dataFile, lines);
    console.log(`Saved ${data.length} data points`);
  }

  async runContinuously(intervalMs: number = 60000): Promise<void> {
    console.log('Starting data collection...');
    while (true) {
      await this.saveSnapshot();
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
}

// Usage
const collector = new DataCollector();
await collector.initialize();
await collector.runContinuously(60000); // Collect every minute
```

**Applications:**
- Backtesting frameworks
- ML model training data
- Market research
- Regulatory compliance

---

## Portfolio Tracking

### Use Case 3: Position Tracker

Monitor open positions and calculate real-time PnL.

```typescript
import { TraderClient } from 'avantisfi-sdk';

interface PositionSummary {
  pairName: string;
  direction: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  collateral: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  roi: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalPnl: number;
  positions: PositionSummary[];
  riskMetrics: {
    largestPosition: number;
    averageLeverage: number;
    longExposure: number;
    shortExposure: number;
  };
}

async function getPortfolio(walletAddress: string): Promise<PortfolioSummary> {
  const client = await TraderClient.create();
  const trades = await client.trade.getOpenTrades(walletAddress);
  const balance = await client.getUsdcBalance(walletAddress);

  const positions: PositionSummary[] = [];
  let totalPnl = 0;
  let longExposure = 0;
  let shortExposure = 0;
  let totalLeverage = 0;
  let largestPosition = 0;

  for (const trade of trades) {
    const pair = await client.pairsCache.getPairByIndex(trade.pairIndex);
    let currentPrice = trade.openPrice;
    
    try {
      currentPrice = await client.feedClient.getPrice(trade.pairIndex);
    } catch {}

    const priceDiff = trade.isLong
      ? currentPrice - trade.openPrice
      : trade.openPrice - currentPrice;

    const pnl = (priceDiff / trade.openPrice) * trade.positionSize;
    const pnlPercent = (pnl / trade.collateral) * 100;
    const roi = pnlPercent / trade.leverage;

    positions.push({
      pairName: pair?.name || `Pair ${trade.pairIndex}`,
      direction: trade.isLong ? 'LONG' : 'SHORT',
      entryPrice: trade.openPrice,
      currentPrice,
      size: trade.positionSize,
      collateral: trade.collateral,
      leverage: trade.leverage,
      pnl,
      pnlPercent,
      roi,
    });

    totalPnl += pnl;
    totalLeverage += trade.leverage;
    largestPosition = Math.max(largestPosition, trade.positionSize);

    if (trade.isLong) {
      longExposure += trade.positionSize;
    } else {
      shortExposure += trade.positionSize;
    }
  }

  const totalCollateral = positions.reduce((sum, p) => sum + p.collateral, 0);

  return {
    totalValue: balance + totalCollateral + totalPnl,
    totalPnl,
    positions,
    riskMetrics: {
      largestPosition,
      averageLeverage: trades.length > 0 ? totalLeverage / trades.length : 0,
      longExposure,
      shortExposure,
    },
  };
}

// Usage
const portfolio = await getPortfolio('0x...');
console.log(`Total Value: $${portfolio.totalValue.toFixed(2)}`);
console.log(`Total PnL: ${portfolio.totalPnl >= 0 ? '+' : ''}$${portfolio.totalPnl.toFixed(2)}`);
```

**Applications:**
- Portfolio management apps
- Tax reporting tools
- Performance analytics
- Risk dashboards

---

### Use Case 4: Trade History Export

Export trade history for accounting and analysis.

```typescript
import { TraderClient } from 'avantisfi-sdk';

interface TradeRecord {
  timestamp: Date;
  pair: string;
  direction: string;
  action: 'open' | 'close';
  price: number;
  collateral: number;
  leverage: number;
  pnl?: number;
  txHash?: string;
}

async function exportTradeHistory(
  walletAddress: string,
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  const client = await TraderClient.create();
  
  // Get current open positions
  const openTrades = await client.trade.getOpenTrades(walletAddress);
  const tradesInfo = await client.trade.getOpenTradesInfo(walletAddress);

  const records: TradeRecord[] = [];

  // Add open positions
  for (let i = 0; i < openTrades.length; i++) {
    const trade = openTrades[i];
    const info = tradesInfo[i];
    const pair = await client.pairsCache.getPairByIndex(trade.pairIndex);

    records.push({
      timestamp: new Date(info.openTime * 1000),
      pair: pair?.name || `Pair ${trade.pairIndex}`,
      direction: trade.isLong ? 'LONG' : 'SHORT',
      action: 'open',
      price: trade.openPrice,
      collateral: trade.collateral,
      leverage: trade.leverage,
    });
  }

  if (format === 'csv') {
    const headers = 'Timestamp,Pair,Direction,Action,Price,Collateral,Leverage,PnL';
    const rows = records.map(r =>
      `${r.timestamp.toISOString()},${r.pair},${r.direction},${r.action},${r.price},${r.collateral},${r.leverage},${r.pnl || ''}`
    );
    return [headers, ...rows].join('\n');
  }

  return JSON.stringify(records, null, 2);
}

// Usage
const csv = await exportTradeHistory('0x...', 'csv');
fs.writeFileSync('trades.csv', csv);
```

**Applications:**
- Tax preparation
- Audit trails
- Performance review
- Regulatory reporting

---

## Trading Applications

### Use Case 5: Copy Trading

Mirror trades from successful traders.

```typescript
import { TraderClient, TradeInput } from 'avantisfi-sdk';

interface CopyConfig {
  sourceWallet: string;
  proportionalSize: number; // e.g., 0.5 = 50% of source size
  maxPositionSize: number;
  excludePairs: number[];
}

class CopyTrader {
  private client: TraderClient | null = null;
  private lastKnownTrades = new Map<string, number>();

  constructor(private config: CopyConfig) {}

  async initialize(privateKey: `0x${string}`): Promise<void> {
    this.client = await TraderClient.create({ privateKey });
    
    // Initialize with current positions
    const trades = await this.client.trade.getOpenTrades(this.config.sourceWallet);
    for (const trade of trades) {
      const key = `${trade.pairIndex}-${trade.index}`;
      this.lastKnownTrades.set(key, trade.collateral);
    }
  }

  async checkForNewTrades(): Promise<void> {
    if (!this.client) return;

    const currentTrades = await this.client.trade.getOpenTrades(
      this.config.sourceWallet
    );

    for (const trade of currentTrades) {
      const key = `${trade.pairIndex}-${trade.index}`;
      
      if (!this.lastKnownTrades.has(key)) {
        // New trade detected
        if (!this.config.excludePairs.includes(trade.pairIndex)) {
          await this.copyTrade(trade);
        }
        this.lastKnownTrades.set(key, trade.collateral);
      }
    }

    // Clean up closed trades
    const currentKeys = new Set(
      currentTrades.map(t => `${t.pairIndex}-${t.index}`)
    );
    for (const key of this.lastKnownTrades.keys()) {
      if (!currentKeys.has(key)) {
        this.lastKnownTrades.delete(key);
      }
    }
  }

  private async copyTrade(sourceTrade: any): Promise<void> {
    if (!this.client) return;

    const copySize = Math.min(
      sourceTrade.collateral * this.config.proportionalSize,
      this.config.maxPositionSize
    );

    const trade: TradeInput = {
      pairIndex: sourceTrade.pairIndex,
      collateral: copySize,
      openPrice: 0,
      isLong: sourceTrade.isLong,
      leverage: sourceTrade.leverage,
      takeProfit: 0,
      stopLoss: 0,
      orderType: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };

    try {
      const txHash = await this.client.trade.openTrade(trade);
      console.log(`Copied trade: ${txHash}`);
    } catch (error) {
      console.error('Failed to copy trade:', error);
    }
  }

  async run(intervalMs: number = 10000): Promise<void> {
    console.log(`Monitoring ${this.config.sourceWallet}...`);
    while (true) {
      await this.checkForNewTrades();
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
}

// Usage
const copier = new CopyTrader({
  sourceWallet: '0x...leader...',
  proportionalSize: 0.25, // 25% of leader's size
  maxPositionSize: 100,
  excludePairs: [], // Copy all pairs
});

await copier.initialize(process.env.PRIVATE_KEY as `0x${string}`);
await copier.run();
```

**Applications:**
- Social trading platforms
- Fund management
- Trading education
- Signal groups

---

### Use Case 6: DCA (Dollar Cost Averaging) Bot

Automatically build positions over time.

```typescript
import { TraderClient, TradeInput } from 'avantisfi-sdk';

interface DCAConfig {
  pairIndex: number;
  direction: 'long' | 'short';
  amountPerInterval: number;
  leverage: number;
  intervalMs: number;
  totalBudget: number;
}

class DCABot {
  private client: TraderClient | null = null;
  private totalInvested = 0;

  constructor(private config: DCAConfig) {}

  async initialize(privateKey: `0x${string}`): Promise<void> {
    this.client = await TraderClient.create({ privateKey });
    
    // Pre-approve USDC
    await this.client.approveUsdc(
      this.client.contracts.Trading.address,
      this.config.totalBudget
    );
  }

  async executeDCA(): Promise<boolean> {
    if (!this.client) return false;

    if (this.totalInvested >= this.config.totalBudget) {
      console.log('DCA complete - budget exhausted');
      return false;
    }

    const amount = Math.min(
      this.config.amountPerInterval,
      this.config.totalBudget - this.totalInvested
    );

    const trade: TradeInput = {
      pairIndex: this.config.pairIndex,
      collateral: amount,
      openPrice: 0,
      isLong: this.config.direction === 'long',
      leverage: this.config.leverage,
      takeProfit: 0,
      stopLoss: 0,
      orderType: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };

    try {
      const txHash = await this.client.trade.openTrade(trade);
      this.totalInvested += amount;
      
      const pair = await this.client.pairsCache.getPairByIndex(this.config.pairIndex);
      const price = await this.client.feedClient.getPrice(this.config.pairIndex);
      
      console.log(`DCA executed: ${pair?.name} @ $${price.toFixed(2)}`);
      console.log(`  Amount: $${amount}, Total: $${this.totalInvested}/${this.config.totalBudget}`);
      
      return true;
    } catch (error) {
      console.error('DCA execution failed:', error);
      return false;
    }
  }

  async run(): Promise<void> {
    console.log('Starting DCA bot...');
    
    while (this.totalInvested < this.config.totalBudget) {
      await this.executeDCA();
      await new Promise(r => setTimeout(r, this.config.intervalMs));
    }
    
    console.log('DCA complete!');
  }
}

// Usage: DCA $1000 into ETH over 10 days
const dca = new DCABot({
  pairIndex: 0, // ETH/USD
  direction: 'long',
  amountPerInterval: 100, // $100 per interval
  leverage: 1, // No leverage for DCA
  intervalMs: 24 * 60 * 60 * 1000, // Daily
  totalBudget: 1000,
});

await dca.initialize(process.env.PRIVATE_KEY as `0x${string}`);
await dca.run();
```

**Applications:**
- Long-term investing
- Accumulation strategies
- Recurring buy programs
- Retirement portfolios

---

## Automated Systems

### Use Case 7: Arbitrage Monitor

Monitor for arbitrage opportunities between Avantis and other exchanges.

```typescript
import { TraderClient } from 'avantisfi-sdk';

interface ArbitrageOpportunity {
  pair: string;
  avantisPrice: number;
  externalPrice: number;
  spread: number;
  direction: 'buy_avantis' | 'sell_avantis';
  potentialProfit: number;
}

class ArbitrageMonitor {
  private client: TraderClient | null = null;

  async initialize(): Promise<void> {
    this.client = await TraderClient.create();
  }

  async getExternalPrice(symbol: string): Promise<number> {
    // Example: Fetch from Binance
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`
    );
    const data = await response.json();
    return parseFloat(data.price);
  }

  async findOpportunities(minSpreadBps: number = 10): Promise<ArbitrageOpportunity[]> {
    if (!this.client) return [];

    const opportunities: ArbitrageOpportunity[] = [];
    const pairMappings = [
      { avantis: 0, binance: 'ETH', name: 'ETH/USD' },
      { avantis: 1, binance: 'BTC', name: 'BTC/USD' },
      { avantis: 2, binance: 'SOL', name: 'SOL/USD' },
    ];

    for (const mapping of pairMappings) {
      try {
        const [avantisPrice, externalPrice] = await Promise.all([
          this.client.feedClient.getPrice(mapping.avantis),
          this.getExternalPrice(mapping.binance),
        ]);

        const spreadBps = ((avantisPrice - externalPrice) / externalPrice) * 10000;

        if (Math.abs(spreadBps) >= minSpreadBps) {
          opportunities.push({
            pair: mapping.name,
            avantisPrice,
            externalPrice,
            spread: spreadBps,
            direction: spreadBps > 0 ? 'sell_avantis' : 'buy_avantis',
            potentialProfit: Math.abs(spreadBps) - minSpreadBps, // After fees
          });
        }
      } catch (error) {
        console.error(`Error checking ${mapping.name}:`, error);
      }
    }

    return opportunities.sort((a, b) => 
      Math.abs(b.spread) - Math.abs(a.spread)
    );
  }

  async monitor(intervalMs: number = 5000): Promise<void> {
    console.log('Monitoring for arbitrage opportunities...');
    
    while (true) {
      const opportunities = await this.findOpportunities(15);
      
      if (opportunities.length > 0) {
        console.log('\n=== Arbitrage Opportunities ===');
        for (const opp of opportunities) {
          console.log(`${opp.pair}: ${opp.spread.toFixed(1)} bps spread`);
          console.log(`  Avantis: $${opp.avantisPrice.toFixed(2)}`);
          console.log(`  External: $${opp.externalPrice.toFixed(2)}`);
          console.log(`  Direction: ${opp.direction}`);
        }
      }
      
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
}

// Usage
const monitor = new ArbitrageMonitor();
await monitor.initialize();
await monitor.monitor();
```

**Applications:**
- HFT systems
- Market making
- Price discovery
- Cross-exchange trading

---

### Use Case 8: Liquidation Bot

Monitor positions approaching liquidation.

```typescript
import { TraderClient } from 'avantisfi-sdk';

interface AtRiskPosition {
  trader: string;
  pairIndex: number;
  pairName: string;
  direction: string;
  healthFactor: number;
  liquidationPrice: number;
  currentPrice: number;
  distancePercent: number;
}

class LiquidationMonitor {
  private client: TraderClient | null = null;

  async initialize(): Promise<void> {
    this.client = await TraderClient.create();
  }

  calculateLiquidationPrice(
    entryPrice: number,
    leverage: number,
    isLong: boolean
  ): number {
    const liquidationThreshold = 0.9; // 90% loss
    const movePercent = liquidationThreshold / leverage;

    return isLong
      ? entryPrice * (1 - movePercent)
      : entryPrice * (1 + movePercent);
  }

  async findAtRiskPositions(
    traders: string[],
    maxHealthFactor: number = 1.5
  ): Promise<AtRiskPosition[]> {
    if (!this.client) return [];

    const atRisk: AtRiskPosition[] = [];

    for (const trader of traders) {
      const trades = await this.client.trade.getOpenTrades(trader);

      for (const trade of trades) {
        const pair = await this.client.pairsCache.getPairByIndex(trade.pairIndex);
        let currentPrice = trade.openPrice;
        
        try {
          currentPrice = await this.client.feedClient.getPrice(trade.pairIndex);
        } catch {}

        const liqPrice = this.calculateLiquidationPrice(
          trade.openPrice,
          trade.leverage,
          trade.isLong
        );

        const distanceToLiq = trade.isLong
          ? (currentPrice - liqPrice) / currentPrice
          : (liqPrice - currentPrice) / currentPrice;

        const healthFactor = distanceToLiq * trade.leverage;

        if (healthFactor <= maxHealthFactor) {
          atRisk.push({
            trader,
            pairIndex: trade.pairIndex,
            pairName: pair?.name || `Pair ${trade.pairIndex}`,
            direction: trade.isLong ? 'LONG' : 'SHORT',
            healthFactor,
            liquidationPrice: liqPrice,
            currentPrice,
            distancePercent: distanceToLiq * 100,
          });
        }
      }
    }

    return atRisk.sort((a, b) => a.healthFactor - b.healthFactor);
  }
}

// Usage
const monitor = new LiquidationMonitor();
await monitor.initialize();

const traders = ['0x...', '0x...']; // List of traders to monitor
const atRisk = await monitor.findAtRiskPositions(traders, 1.2);

console.log('Positions at risk of liquidation:');
for (const pos of atRisk) {
  console.log(`${pos.pairName} ${pos.direction}`);
  console.log(`  Health: ${pos.healthFactor.toFixed(2)}`);
  console.log(`  Distance to liq: ${pos.distancePercent.toFixed(1)}%`);
}
```

**Applications:**
- Risk monitoring
- Liquidation protection
- Portfolio alerts
- MEV bots

---

## Integration Patterns

### Use Case 9: Discord Trading Bot

Create a Discord bot for trading via commands.

```typescript
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { TraderClient, TradeInput } from 'avantisfi-sdk';

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let avantisClient: TraderClient;

discordClient.on('ready', async () => {
  console.log('Discord bot ready');
  avantisClient = await TraderClient.create({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });
});

discordClient.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;

  const [command, ...args] = message.content.split(' ');

  switch (command.toLowerCase()) {
    case '!price':
      await handlePrice(message, args);
      break;
    case '!balance':
      await handleBalance(message);
      break;
    case '!positions':
      await handlePositions(message);
      break;
    case '!long':
    case '!short':
      await handleTrade(message, command, args);
      break;
  }
});

async function handlePrice(message: Message, args: string[]): Promise<void> {
  const pairName = args[0]?.toUpperCase() || 'ETH/USD';
  const pair = await avantisClient.pairsCache.getPairByName(pairName);
  
  if (!pair) {
    await message.reply(`Unknown pair: ${pairName}`);
    return;
  }

  const price = await avantisClient.feedClient.getPrice(pair.pairIndex);
  const oi = await avantisClient.assetParameters.getOiForPair(pair.pairIndex);
  
  await message.reply(
    `**${pairName}**\n` +
    `Price: $${price.toFixed(2)}\n` +
    `Long OI: $${oi.long.toLocaleString()}\n` +
    `Short OI: $${oi.short.toLocaleString()}`
  );
}

async function handleBalance(message: Message): Promise<void> {
  const balance = await avantisClient.getUsdcBalance();
  await message.reply(`USDC Balance: $${balance.toFixed(2)}`);
}

async function handlePositions(message: Message): Promise<void> {
  const trades = await avantisClient.trade.getOpenTrades(
    avantisClient.walletAddress!
  );

  if (trades.length === 0) {
    await message.reply('No open positions');
    return;
  }

  let response = '**Open Positions:**\n';
  for (const trade of trades) {
    const pair = await avantisClient.pairsCache.getPairByIndex(trade.pairIndex);
    response += `- ${pair?.name} ${trade.isLong ? 'LONG' : 'SHORT'} ${trade.leverage}x ($${trade.collateral})\n`;
  }

  await message.reply(response);
}

async function handleTrade(
  message: Message,
  command: string,
  args: string[]
): Promise<void> {
  // !long ETH 100 10 (pair, collateral, leverage)
  const [pairName, collateralStr, leverageStr] = args;
  
  if (!pairName || !collateralStr) {
    await message.reply('Usage: !long <pair> <collateral> [leverage]');
    return;
  }

  const pair = await avantisClient.pairsCache.getPairByName(pairName.toUpperCase());
  if (!pair) {
    await message.reply(`Unknown pair: ${pairName}`);
    return;
  }

  const collateral = parseFloat(collateralStr);
  const leverage = parseFloat(leverageStr) || 5;

  const trade: TradeInput = {
    pairIndex: pair.pairIndex,
    collateral,
    openPrice: 0,
    isLong: command === '!long',
    leverage,
    takeProfit: 0,
    stopLoss: 0,
    orderType: 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  try {
    const txHash = await avantisClient.trade.openTrade(trade);
    await message.reply(
      `Trade opened!\n` +
      `${pair.name} ${command.substring(1).toUpperCase()} ${leverage}x\n` +
      `TX: https://basescan.org/tx/${txHash}`
    );
  } catch (error) {
    await message.reply(`Trade failed: ${error}`);
  }
}

discordClient.login(process.env.DISCORD_TOKEN);
```

**Applications:**
- Community trading
- Team coordination
- Educational groups
- Signal channels

---

### Use Case 10: Webhook Integration

Trigger trades via webhooks (e.g., from TradingView alerts).

```typescript
import express from 'express';
import { TraderClient, TradeInput } from 'avantisfi-sdk';

const app = express();
app.use(express.json());

let client: TraderClient;

// Initialize on startup
(async () => {
  client = await TraderClient.create({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });
  console.log('Trading client initialized');
})();

// Webhook endpoint for TradingView alerts
app.post('/webhook/tradingview', async (req, res) => {
  const { ticker, action, price } = req.body;
  
  // Map ticker to pair index
  const pairMap: Record<string, number> = {
    'ETHUSD': 0,
    'BTCUSD': 1,
    'SOLUSD': 2,
  };

  const pairIndex = pairMap[ticker];
  if (pairIndex === undefined) {
    return res.status(400).json({ error: 'Unknown ticker' });
  }

  if (!['buy', 'sell', 'close'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    if (action === 'close') {
      // Close all positions for this pair
      const trades = await client.trade.getOpenTrades(client.walletAddress!);
      const pairTrades = trades.filter(t => t.pairIndex === pairIndex);
      
      for (const trade of pairTrades) {
        await client.trade.closeTradeMarket(trade.pairIndex, trade.index);
      }
      
      return res.json({ success: true, action: 'closed', count: pairTrades.length });
    }

    // Open new position
    const trade: TradeInput = {
      pairIndex,
      collateral: 100, // Fixed size
      openPrice: 0,
      isLong: action === 'buy',
      leverage: 5,
      takeProfit: 0,
      stopLoss: 0,
      orderType: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const txHash = await client.trade.openTrade(trade);
    
    res.json({
      success: true,
      action,
      ticker,
      txHash,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

**Applications:**
- TradingView integration
- Alert-based trading
- Multi-platform connectivity
- API bridges

---

## Summary

The Avantis SDK enables a wide range of applications:

| Category | Use Cases |
|----------|-----------|
| **Data** | Dashboards, analytics, data collection |
| **Portfolio** | Position tracking, PnL calculation, reporting |
| **Trading** | Copy trading, DCA, manual trading apps |
| **Automation** | Trading bots, arbitrage, risk management |
| **Integration** | Discord bots, webhooks, API bridges |

For implementation details, see:
- [Implementation Guide](./implementation.md)
- [Front-End Example](./frontend-example.md)
- [Automated Trading](./automated-trading.md)
- [API Reference](../api/trader-client.md)
