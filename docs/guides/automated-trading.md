# Automated Trading Guide

This guide covers building automated trading systems with the Avantis SDK, from simple bots to sophisticated trading strategies.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Building a Basic Trading Bot](#building-a-basic-trading-bot)
3. [Strategy Framework](#strategy-framework)
4. [Risk Management](#risk-management)
5. [Position Management](#position-management)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Production Considerations](#production-considerations)
8. [Complete Example: Mean Reversion Bot](#complete-example-mean-reversion-bot)

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Trading Bot Architecture                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                │
│  │   Market    │────►│   Signal    │────►│  Position   │                │
│  │   Data      │     │  Generator  │     │   Manager   │                │
│  │   Feed      │     │             │     │             │                │
│  └─────────────┘     └─────────────┘     └─────────────┘                │
│         │                   │                   │                        │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                │
│  │   Price     │     │    Risk     │     │   Trade     │                │
│  │   Cache     │     │  Manager    │     │  Executor   │                │
│  │             │     │             │     │             │                │
│  └─────────────┘     └─────────────┘     └─────────────┘                │
│                             │                   │                        │
│                             │                   │                        │
│                             ▼                   ▼                        │
│                      ┌─────────────────────────────┐                    │
│                      │      Avantis SDK           │                    │
│                      │   TraderClient Instance     │                    │
│                      └─────────────────────────────┘                    │
│                                    │                                     │
│                                    ▼                                     │
│                            Base Blockchain                               │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Building a Basic Trading Bot

### Project Structure

```
trading-bot/
├── src/
│   ├── index.ts              # Entry point
│   ├── bot.ts                # Main bot class
│   ├── config.ts             # Configuration
│   ├── strategies/
│   │   ├── base.ts           # Base strategy interface
│   │   ├── skew.ts           # Skew-based strategy
│   │   └── momentum.ts       # Momentum strategy
│   ├── managers/
│   │   ├── position.ts       # Position management
│   │   ├── risk.ts           # Risk management
│   │   └── order.ts          # Order execution
│   └── utils/
│       ├── logger.ts         # Logging
│       └── notifications.ts  # Alerts
├── .env
└── package.json
```

### Configuration

```typescript
// src/config.ts
import { config as dotenv } from 'dotenv';
dotenv();

export interface BotConfig {
  // Connection
  privateKey: `0x${string}`;
  rpcUrl: string;

  // Trading limits
  maxPositionSize: number;
  maxTotalExposure: number;
  maxPositionsPerPair: number;
  maxLeverage: number;

  // Risk parameters
  maxDrawdownPercent: number;
  stopLossPercent: number;
  takeProfitPercent: number;

  // Pairs to trade
  allowedPairs: number[];

  // Timing
  scanIntervalMs: number;
  cooldownAfterTradeMs: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const config: BotConfig = {
  privateKey: requireEnv('PRIVATE_KEY') as `0x${string}`,
  rpcUrl: process.env.RPC_URL || 'https://mainnet.base.org',

  maxPositionSize: Number(process.env.MAX_POSITION_SIZE || 500),
  maxTotalExposure: Number(process.env.MAX_TOTAL_EXPOSURE || 5000),
  maxPositionsPerPair: Number(process.env.MAX_POSITIONS_PER_PAIR || 1),
  maxLeverage: Number(process.env.MAX_LEVERAGE || 10),

  maxDrawdownPercent: Number(process.env.MAX_DRAWDOWN_PERCENT || 20),
  stopLossPercent: Number(process.env.STOP_LOSS_PERCENT || 2),
  takeProfitPercent: Number(process.env.TAKE_PROFIT_PERCENT || 3),

  allowedPairs: (process.env.ALLOWED_PAIRS || '0,1,2')
    .split(',')
    .map(Number),

  scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS || 30000),
  cooldownAfterTradeMs: Number(process.env.COOLDOWN_MS || 60000),
};
```

### Main Bot Class

```typescript
// src/bot.ts
import { TraderClient, TradeInput } from 'avantisfi-sdk';
import { BotConfig, config } from './config';
import { BaseStrategy, Signal } from './strategies/base';
import { PositionManager } from './managers/position';
import { RiskManager } from './managers/risk';
import { Logger } from './utils/logger';

export class TradingBot {
  private client: TraderClient | null = null;
  private strategies: BaseStrategy[] = [];
  private positionManager: PositionManager | null = null;
  private riskManager: RiskManager | null = null;
  private lastTradeTime = 0;
  private isRunning = false;
  private logger = new Logger('TradingBot');

  constructor(private config: BotConfig) {}

  async initialize(): Promise<void> {
    this.logger.info('Initializing trading bot...');

    this.client = await TraderClient.create({
      privateKey: this.config.privateKey,
      rpcUrl: this.config.rpcUrl,
    });

    this.positionManager = new PositionManager(this.client);
    this.riskManager = new RiskManager(this.config, this.client);

    // Verify wallet balance
    const balance = await this.client.getUsdcBalance();
    this.logger.info(`Wallet: ${this.client.walletAddress}`);
    this.logger.info(`USDC Balance: $${balance.toFixed(2)}`);

    if (balance < this.config.maxPositionSize) {
      this.logger.warn('Low balance - may not be able to open positions');
    }

    // Pre-approve USDC
    const trading = this.client.contracts.Trading.address;
    const allowance = await this.client.getUsdcAllowance(trading);
    if (allowance < this.config.maxTotalExposure) {
      this.logger.info('Approving USDC...');
      await this.client.approveUsdc(trading, this.config.maxTotalExposure * 2);
    }

    this.logger.info('Bot initialized successfully');
  }

  addStrategy(strategy: BaseStrategy): void {
    this.strategies.push(strategy);
    this.logger.info(`Added strategy: ${strategy.name}`);
  }

  async start(): Promise<void> {
    if (!this.client) throw new Error('Bot not initialized');
    
    this.isRunning = true;
    this.logger.info('Starting trading bot...');

    while (this.isRunning) {
      try {
        await this.runCycle();
      } catch (error) {
        this.logger.error('Cycle error:', error);
      }

      await this.sleep(this.config.scanIntervalMs);
    }
  }

  stop(): void {
    this.logger.info('Stopping bot...');
    this.isRunning = false;
  }

  private async runCycle(): Promise<void> {
    if (!this.client || !this.riskManager || !this.positionManager) return;

    // Check if in cooldown
    if (Date.now() - this.lastTradeTime < this.config.cooldownAfterTradeMs) {
      return;
    }

    // Check risk limits
    const riskCheck = await this.riskManager.canTrade();
    if (!riskCheck.allowed) {
      this.logger.warn(`Risk limit reached: ${riskCheck.reason}`);
      return;
    }

    // Get signals from all strategies
    const signals: Signal[] = [];
    for (const strategy of this.strategies) {
      const strategySignals = await strategy.generateSignals(this.client);
      signals.push(...strategySignals);
    }

    if (signals.length === 0) return;

    // Sort by strength and take best signal
    signals.sort((a, b) => b.strength - a.strength);
    const bestSignal = signals[0];

    // Validate signal against risk rules
    const signalCheck = await this.riskManager.validateSignal(bestSignal);
    if (!signalCheck.allowed) {
      this.logger.debug(`Signal rejected: ${signalCheck.reason}`);
      return;
    }

    // Execute trade
    await this.executeTrade(bestSignal);
  }

  private async executeTrade(signal: Signal): Promise<void> {
    if (!this.client) return;

    this.logger.info(`Executing ${signal.direction} on ${signal.pairName}`);
    this.logger.info(`  Strength: ${signal.strength}/100`);
    this.logger.info(`  Collateral: $${signal.collateral}`);
    this.logger.info(`  Leverage: ${signal.leverage}x`);

    const trade: TradeInput = {
      pairIndex: signal.pairIndex,
      collateral: signal.collateral,
      openPrice: 0, // Market order
      isLong: signal.direction === 'long',
      leverage: signal.leverage,
      takeProfit: signal.tp,
      stopLoss: signal.sl,
      orderType: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };

    try {
      const txHash = await this.client.trade.openTrade(trade);
      this.logger.info(`Trade executed: ${txHash}`);
      this.lastTradeTime = Date.now();

      // Log to position tracker
      await this.positionManager?.trackNewPosition(signal, txHash);
    } catch (error) {
      this.logger.error('Trade execution failed:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Strategy Framework

### Base Strategy Interface

```typescript
// src/strategies/base.ts
import { TraderClient } from 'avantisfi-sdk';

export interface Signal {
  pairIndex: number;
  pairName: string;
  direction: 'long' | 'short';
  strength: number; // 0-100
  collateral: number;
  leverage: number;
  tp: number;
  sl: number;
  reason: string;
  strategyName: string;
}

export interface StrategyConfig {
  name: string;
  pairs: number[];
  minStrength: number;
}

export abstract class BaseStrategy {
  abstract name: string;
  
  constructor(protected config: StrategyConfig) {}

  abstract generateSignals(client: TraderClient): Promise<Signal[]>;

  protected calculateTpSl(
    price: number,
    isLong: boolean,
    tpPercent: number = 3,
    slPercent: number = 2
  ): { tp: number; sl: number } {
    if (isLong) {
      return {
        tp: price * (1 + tpPercent / 100),
        sl: price * (1 - slPercent / 100),
      };
    } else {
      return {
        tp: price * (1 - tpPercent / 100),
        sl: price * (1 + slPercent / 100),
      };
    }
  }
}
```

### Skew-Based Strategy

```typescript
// src/strategies/skew.ts
import { TraderClient } from 'avantisfi-sdk';
import { BaseStrategy, Signal, StrategyConfig } from './base';

interface SkewStrategyConfig extends StrategyConfig {
  minSkewThreshold: number;
  maxSkewThreshold: number;
  defaultCollateral: number;
  defaultLeverage: number;
}

export class SkewStrategy extends BaseStrategy {
  name = 'SkewMeanReversion';

  constructor(private skewConfig: SkewStrategyConfig) {
    super(skewConfig);
  }

  async generateSignals(client: TraderClient): Promise<Signal[]> {
    const signals: Signal[] = [];

    for (const pairIndex of this.skewConfig.pairs) {
      const signal = await this.analyzePair(client, pairIndex);
      if (signal && signal.strength >= this.skewConfig.minStrength) {
        signals.push(signal);
      }
    }

    return signals;
  }

  private async analyzePair(
    client: TraderClient,
    pairIndex: number
  ): Promise<Signal | null> {
    const [pair, skew, util, spread] = await Promise.all([
      client.pairsCache.getPairByIndex(pairIndex),
      client.blended.getBlendedSkew(pairIndex),
      client.blended.getBlendedUtilization(pairIndex),
      client.feeParameters.getSpread(pairIndex),
    ]);

    if (!pair) return null;

    const absSkew = Math.abs(skew.value);

    // Check if skew is in our trading range
    if (absSkew < this.skewConfig.minSkewThreshold) return null;
    if (absSkew > this.skewConfig.maxSkewThreshold) return null;

    // Trade against the skew
    const direction = skew.value > 0 ? 'short' : 'long';
    const myUtil = direction === 'long' ? util.long : util.short;

    // Skip if utilization is too high
    if (myUtil > 70) return null;

    // Calculate strength based on skew magnitude
    const skewStrength = Math.min((absSkew - this.skewConfig.minSkewThreshold) * 200, 50);
    const utilBonus = (70 - myUtil) / 2;
    const spreadPenalty = Math.min(spread, 10);
    const strength = Math.round(skewStrength + utilBonus - spreadPenalty);

    let price = 0;
    try {
      price = await client.feedClient.getPrice(pairIndex);
    } catch {
      return null;
    }

    const { tp, sl } = this.calculateTpSl(price, direction === 'long');

    return {
      pairIndex,
      pairName: pair.name,
      direction,
      strength: Math.max(0, Math.min(100, strength)),
      collateral: this.skewConfig.defaultCollateral,
      leverage: Math.min(this.skewConfig.defaultLeverage, pair.maxLeverage),
      tp,
      sl,
      reason: `Skew: ${(skew.value * 100).toFixed(1)}%, Util: ${myUtil.toFixed(0)}%`,
      strategyName: this.name,
    };
  }
}
```

### Momentum Strategy

```typescript
// src/strategies/momentum.ts
import { TraderClient } from 'avantisfi-sdk';
import { BaseStrategy, Signal, StrategyConfig } from './base';

interface MomentumConfig extends StrategyConfig {
  lookbackPeriods: number;
  minMomentumThreshold: number;
  defaultCollateral: number;
  defaultLeverage: number;
}

export class MomentumStrategy extends BaseStrategy {
  name = 'Momentum';
  private oiHistory = new Map<number, number[]>();

  constructor(private momentumConfig: MomentumConfig) {
    super(momentumConfig);
  }

  async generateSignals(client: TraderClient): Promise<Signal[]> {
    // Update OI history
    await this.updateHistory(client);

    const signals: Signal[] = [];

    for (const pairIndex of this.momentumConfig.pairs) {
      const signal = await this.analyzeMomentum(client, pairIndex);
      if (signal && signal.strength >= this.momentumConfig.minStrength) {
        signals.push(signal);
      }
    }

    return signals;
  }

  private async updateHistory(client: TraderClient): Promise<void> {
    const oi = await client.assetParameters.getOi();

    for (const [pairIndex, data] of oi) {
      const history = this.oiHistory.get(pairIndex) || [];
      const totalOi = data.long + data.short;
      
      history.push(totalOi);
      
      if (history.length > this.momentumConfig.lookbackPeriods) {
        history.shift();
      }
      
      this.oiHistory.set(pairIndex, history);
    }
  }

  private async analyzeMomentum(
    client: TraderClient,
    pairIndex: number
  ): Promise<Signal | null> {
    const history = this.oiHistory.get(pairIndex);
    if (!history || history.length < this.momentumConfig.lookbackPeriods) {
      return null;
    }

    const pair = await client.pairsCache.getPairByIndex(pairIndex);
    if (!pair) return null;

    // Calculate OI momentum
    const oldest = history[0];
    const newest = history[history.length - 1];
    const change = (newest - oldest) / oldest;

    if (Math.abs(change) < this.momentumConfig.minMomentumThreshold) {
      return null;
    }

    // Trade with momentum
    const direction = change > 0 ? 'long' : 'short';

    let price = 0;
    try {
      price = await client.feedClient.getPrice(pairIndex);
    } catch {
      return null;
    }

    const strength = Math.min(Math.abs(change) * 500, 100);
    const { tp, sl } = this.calculateTpSl(price, direction === 'long', 4, 2);

    return {
      pairIndex,
      pairName: pair.name,
      direction,
      strength: Math.round(strength),
      collateral: this.momentumConfig.defaultCollateral,
      leverage: Math.min(this.momentumConfig.defaultLeverage, pair.maxLeverage),
      tp,
      sl,
      reason: `OI momentum: ${(change * 100).toFixed(1)}%`,
      strategyName: this.name,
    };
  }
}
```

## Risk Management

```typescript
// src/managers/risk.ts
import { TraderClient } from 'avantisfi-sdk';
import { BotConfig } from '../config';
import { Signal } from '../strategies/base';

interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export class RiskManager {
  private initialBalance: number = 0;

  constructor(
    private config: BotConfig,
    private client: TraderClient
  ) {}

  async initialize(): Promise<void> {
    this.initialBalance = await this.client.getUsdcBalance();
  }

  async canTrade(): Promise<RiskCheckResult> {
    // Check drawdown
    const currentBalance = await this.client.getUsdcBalance();
    const drawdown = ((this.initialBalance - currentBalance) / this.initialBalance) * 100;

    if (drawdown >= this.config.maxDrawdownPercent) {
      return {
        allowed: false,
        reason: `Max drawdown reached: ${drawdown.toFixed(1)}%`,
      };
    }

    // Check total exposure
    const positions = await this.getCurrentExposure();
    if (positions.totalExposure >= this.config.maxTotalExposure) {
      return {
        allowed: false,
        reason: `Max exposure reached: $${positions.totalExposure}`,
      };
    }

    return { allowed: true };
  }

  async validateSignal(signal: Signal): Promise<RiskCheckResult> {
    // Check if pair is allowed
    if (!this.config.allowedPairs.includes(signal.pairIndex)) {
      return {
        allowed: false,
        reason: `Pair ${signal.pairIndex} not in allowed list`,
      };
    }

    // Check position size
    if (signal.collateral > this.config.maxPositionSize) {
      return {
        allowed: false,
        reason: `Position size $${signal.collateral} exceeds max $${this.config.maxPositionSize}`,
      };
    }

    // Check leverage
    if (signal.leverage > this.config.maxLeverage) {
      return {
        allowed: false,
        reason: `Leverage ${signal.leverage}x exceeds max ${this.config.maxLeverage}x`,
      };
    }

    // Check positions per pair
    const positions = await this.getCurrentExposure();
    const pairPositions = positions.byPair.get(signal.pairIndex) || 0;
    if (pairPositions >= this.config.maxPositionsPerPair) {
      return {
        allowed: false,
        reason: `Max positions for pair ${signal.pairIndex} reached`,
      };
    }

    // Check if we have enough balance
    const balance = await this.client.getUsdcBalance();
    if (balance < signal.collateral) {
      return {
        allowed: false,
        reason: `Insufficient balance: $${balance} < $${signal.collateral}`,
      };
    }

    return { allowed: true };
  }

  private async getCurrentExposure(): Promise<{
    totalExposure: number;
    byPair: Map<number, number>;
  }> {
    const trades = await this.client.trade.getOpenTrades(
      this.client.walletAddress!
    );

    let totalExposure = 0;
    const byPair = new Map<number, number>();

    for (const trade of trades) {
      const exposure = trade.collateral * trade.leverage;
      totalExposure += exposure;

      const current = byPair.get(trade.pairIndex) || 0;
      byPair.set(trade.pairIndex, current + 1);
    }

    return { totalExposure, byPair };
  }
}
```

## Position Management

```typescript
// src/managers/position.ts
import { TraderClient } from 'avantisfi-sdk';
import { Signal } from '../strategies/base';
import { Logger } from '../utils/logger';

interface TrackedPosition {
  pairIndex: number;
  tradeIndex: number;
  direction: 'long' | 'short';
  entryPrice: number;
  collateral: number;
  leverage: number;
  tp: number;
  sl: number;
  openTime: number;
  strategy: string;
  txHash: string;
}

export class PositionManager {
  private positions: TrackedPosition[] = [];
  private logger = new Logger('PositionManager');

  constructor(private client: TraderClient) {}

  async trackNewPosition(signal: Signal, txHash: string): Promise<void> {
    // Wait for position to appear on-chain
    await this.sleep(3000);

    const trades = await this.client.trade.getOpenTrades(
      this.client.walletAddress!
    );

    // Find the new position
    const newTrade = trades.find(
      t => t.pairIndex === signal.pairIndex && t.isLong === (signal.direction === 'long')
    );

    if (newTrade) {
      this.positions.push({
        pairIndex: newTrade.pairIndex,
        tradeIndex: newTrade.index,
        direction: signal.direction,
        entryPrice: newTrade.openPrice,
        collateral: newTrade.collateral,
        leverage: newTrade.leverage,
        tp: signal.tp,
        sl: signal.sl,
        openTime: Date.now(),
        strategy: signal.strategyName,
        txHash,
      });

      this.logger.info(`Tracking new position: ${signal.pairName} ${signal.direction}`);
    }
  }

  async monitorPositions(): Promise<void> {
    for (const pos of this.positions) {
      try {
        const currentPrice = await this.client.feedClient.getPrice(pos.pairIndex);
        const pnl = this.calculatePnl(pos, currentPrice);

        this.logger.debug(
          `Position ${pos.pairIndex}: PnL ${pnl.percent.toFixed(2)}%`
        );

        // Check for manual intervention conditions
        if (pnl.percent < -50) {
          this.logger.warn(`Position ${pos.pairIndex} down 50%+ - consider closing`);
        }
      } catch (error) {
        this.logger.error(`Error monitoring position ${pos.pairIndex}:`, error);
      }
    }
  }

  async syncWithChain(): Promise<void> {
    const trades = await this.client.trade.getOpenTrades(
      this.client.walletAddress!
    );

    // Remove closed positions from tracking
    this.positions = this.positions.filter(pos =>
      trades.some(t => 
        t.pairIndex === pos.pairIndex && 
        t.index === pos.tradeIndex
      )
    );
  }

  getActivePositions(): TrackedPosition[] {
    return [...this.positions];
  }

  private calculatePnl(
    pos: TrackedPosition,
    currentPrice: number
  ): { usd: number; percent: number } {
    const priceDiff = pos.direction === 'long'
      ? currentPrice - pos.entryPrice
      : pos.entryPrice - currentPrice;

    const pnlPercent = (priceDiff / pos.entryPrice) * pos.leverage * 100;
    const pnlUsd = (pnlPercent / 100) * pos.collateral;

    return { usd: pnlUsd, percent: pnlPercent };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Monitoring & Alerting

```typescript
// src/utils/notifications.ts
interface NotificationConfig {
  discordWebhook?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export class NotificationService {
  constructor(private config: NotificationConfig) {}

  async sendAlert(
    level: 'info' | 'warning' | 'error',
    title: string,
    message: string
  ): Promise<void> {
    console.log(`[${level.toUpperCase()}] ${title}: ${message}`);

    if (this.config.discordWebhook) {
      await this.sendDiscord(level, title, message);
    }

    if (this.config.telegramBotToken && this.config.telegramChatId) {
      await this.sendTelegram(level, title, message);
    }
  }

  private async sendDiscord(
    level: string,
    title: string,
    message: string
  ): Promise<void> {
    const colors = {
      info: 0x3498db,
      warning: 0xf39c12,
      error: 0xe74c3c,
    };

    try {
      await fetch(this.config.discordWebhook!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title,
            description: message,
            color: colors[level as keyof typeof colors],
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    } catch (error) {
      console.error('Discord notification failed:', error);
    }
  }

  private async sendTelegram(
    level: string,
    title: string,
    message: string
  ): Promise<void> {
    const emoji = { info: 'ℹ️', warning: '⚠️', error: '🚨' };
    const text = `${emoji[level as keyof typeof emoji]} *${title}*\n\n${message}`;

    try {
      await fetch(
        `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.config.telegramChatId,
            text,
            parse_mode: 'Markdown',
          }),
        }
      );
    } catch (error) {
      console.error('Telegram notification failed:', error);
    }
  }

  async tradeOpened(trade: {
    pair: string;
    direction: string;
    collateral: number;
    leverage: number;
    txHash: string;
  }): Promise<void> {
    await this.sendAlert(
      'info',
      'Trade Opened',
      `**${trade.pair}** ${trade.direction.toUpperCase()}\n` +
      `Collateral: $${trade.collateral}\n` +
      `Leverage: ${trade.leverage}x\n` +
      `[View TX](https://basescan.org/tx/${trade.txHash})`
    );
  }

  async tradeClosed(trade: {
    pair: string;
    pnl: number;
    pnlPercent: number;
  }): Promise<void> {
    const emoji = trade.pnl >= 0 ? '📈' : '📉';
    await this.sendAlert(
      trade.pnl >= 0 ? 'info' : 'warning',
      `${emoji} Trade Closed`,
      `**${trade.pair}**\n` +
      `PnL: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)} ` +
      `(${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(1)}%)`
    );
  }
}
```

## Production Considerations

### Health Checks

```typescript
// src/utils/health.ts
import { TraderClient } from 'avantisfi-sdk';

export class HealthChecker {
  constructor(private client: TraderClient) {}

  async runChecks(): Promise<{
    healthy: boolean;
    checks: Record<string, boolean>;
  }> {
    const checks: Record<string, boolean> = {};

    // Check RPC connection
    try {
      await this.client.pairsCache.getPairCount();
      checks.rpc = true;
    } catch {
      checks.rpc = false;
    }

    // Check wallet balance
    try {
      const balance = await this.client.getUsdcBalance();
      checks.balance = balance > 10;
    } catch {
      checks.balance = false;
    }

    // Check price feed
    try {
      await this.client.feedClient.getPrice(0);
      checks.priceFeed = true;
    } catch {
      checks.priceFeed = false;
    }

    const healthy = Object.values(checks).every(v => v);
    return { healthy, checks };
  }
}
```

### Graceful Shutdown

```typescript
// src/index.ts
import { TradingBot } from './bot';
import { config } from './config';
import { SkewStrategy } from './strategies/skew';

const bot = new TradingBot(config);

// Handle shutdown signals
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down...');
  bot.stop();
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  bot.stop();
});

async function main() {
  await bot.initialize();

  // Add strategies
  bot.addStrategy(new SkewStrategy({
    name: 'SkewMeanReversion',
    pairs: config.allowedPairs,
    minStrength: 60,
    minSkewThreshold: 0.2,
    maxSkewThreshold: 0.6,
    defaultCollateral: 100,
    defaultLeverage: 5,
  }));

  // Start bot
  await bot.start();
}

main().catch(console.error);
```

## Complete Example: Mean Reversion Bot

See the complete example in the `examples/` directory of the SDK repository:

```bash
# Clone and run
git clone https://github.com/avantis-labs/avantis-typescript-sdk
cd avantis-typescript-sdk/examples/trading-bot
npm install
cp .env.example .env
# Edit .env with your private key
npm start
```

## Next Steps

- [Trading Opportunities](./trading-opportunities.md) - Finding profitable signals
- [Implementation Guide](./implementation.md) - Project structure best practices
- [Testing Guide](./testing.md) - Test your bot before going live
