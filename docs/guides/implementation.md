# SDK Implementation Guide

This guide shows how to integrate the Avantis TypeScript SDK into your applications, from simple scripts to full-featured trading platforms.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Project Structure](#project-structure)
3. [Configuration Patterns](#configuration-patterns)
4. [Error Handling](#error-handling)
5. [Environment Management](#environment-management)
6. [TypeScript Integration](#typescript-integration)

## Installation & Setup

### npm / yarn / pnpm

```bash
# npm
npm install avantisfi-sdk viem

# yarn
yarn add avantisfi-sdk viem

# pnpm
pnpm add avantisfi-sdk viem
```

### Peer Dependencies

The SDK requires `viem` as a peer dependency for blockchain interactions:

```json
{
  "dependencies": {
    "avantisfi-sdk": "^1.0.0",
    "viem": "^2.0.0"
  }
}
```

## Project Structure

### Recommended Structure for Trading Applications

```
my-trading-app/
├── src/
│   ├── config/
│   │   ├── index.ts          # Configuration exports
│   │   └── avantis.ts        # SDK configuration
│   ├── services/
│   │   ├── market.ts         # Market data service
│   │   ├── trading.ts        # Trading operations
│   │   └── signals.ts        # Trading signals
│   ├── strategies/
│   │   ├── base.ts           # Base strategy class
│   │   ├── momentum.ts       # Momentum strategy
│   │   └── mean-reversion.ts # Mean reversion strategy
│   ├── utils/
│   │   ├── formatting.ts     # Display formatting
│   │   └── risk.ts           # Risk calculations
│   └── index.ts              # Entry point
├── .env                      # Environment variables
├── .env.example              # Example env file
└── package.json
```

### Basic Configuration File

```typescript
// src/config/avantis.ts
import { TraderClient } from 'avantisfi-sdk';

export interface AppConfig {
  rpcUrl: string;
  privateKey?: `0x${string}`;
  maxPositionSize: number;
  maxLeverage: number;
  allowedPairs: number[];
}

export const config: AppConfig = {
  rpcUrl: process.env.RPC_URL || 'https://mainnet.base.org',
  privateKey: process.env.PRIVATE_KEY as `0x${string}` | undefined,
  maxPositionSize: 1000,  // $1000 max per trade
  maxLeverage: 10,        // 10x max leverage
  allowedPairs: [0, 1, 2], // ETH, BTC, SOL only
};

let clientInstance: TraderClient | null = null;

export async function getClient(): Promise<TraderClient> {
  if (!clientInstance) {
    clientInstance = await TraderClient.create({
      rpcUrl: config.rpcUrl,
      privateKey: config.privateKey,
    });
  }
  return clientInstance;
}
```

## Configuration Patterns

### Singleton Pattern (Recommended)

```typescript
// src/services/client.ts
import { TraderClient } from 'avantisfi-sdk';

class AvantisService {
  private static instance: AvantisService;
  private client: TraderClient | null = null;
  private initPromise: Promise<TraderClient> | null = null;

  private constructor() {}

  static getInstance(): AvantisService {
    if (!AvantisService.instance) {
      AvantisService.instance = new AvantisService();
    }
    return AvantisService.instance;
  }

  async getClient(): Promise<TraderClient> {
    if (this.client) {
      return this.client;
    }

    if (!this.initPromise) {
      this.initPromise = TraderClient.create({
        privateKey: process.env.PRIVATE_KEY as `0x${string}`,
      }).then(client => {
        this.client = client;
        return client;
      });
    }

    return this.initPromise;
  }
}

export const avantis = AvantisService.getInstance();
```

### Factory Pattern (Multiple Accounts)

```typescript
// src/services/client-factory.ts
import { TraderClient } from 'avantisfi-sdk';

const clients = new Map<string, TraderClient>();

export async function getClientForWallet(
  privateKey: `0x${string}`
): Promise<TraderClient> {
  const existing = clients.get(privateKey);
  if (existing) {
    return existing;
  }

  const client = await TraderClient.create({ privateKey });
  clients.set(privateKey, client);
  return client;
}

export async function getReadOnlyClient(): Promise<TraderClient> {
  const key = 'readonly';
  const existing = clients.get(key);
  if (existing) {
    return existing;
  }

  const client = await TraderClient.create();
  clients.set(key, client);
  return client;
}
```

## Error Handling

### Comprehensive Error Handler

```typescript
// src/utils/errors.ts
export enum ErrorCode {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  EXCEEDS_LEVERAGE = 'EXCEEDS_LEVERAGE',
  EXCEEDS_OI_LIMIT = 'EXCEEDS_OI_LIMIT',
  PAIR_PAUSED = 'PAIR_PAUSED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface TradingError {
  code: ErrorCode;
  message: string;
  recoverable: boolean;
  suggestion?: string;
}

export function parseError(error: unknown): TradingError {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('insufficient funds') || message.includes('balance')) {
    return {
      code: ErrorCode.INSUFFICIENT_BALANCE,
      message: 'Insufficient USDC or ETH balance',
      recoverable: false,
      suggestion: 'Add funds to your wallet before trading',
    };
  }

  if (message.includes('exceeds max leverage') || message.includes('leverage')) {
    return {
      code: ErrorCode.EXCEEDS_LEVERAGE,
      message: 'Leverage exceeds maximum allowed',
      recoverable: true,
      suggestion: 'Reduce leverage and retry',
    };
  }

  if (message.includes('OI limit') || message.includes('open interest')) {
    return {
      code: ErrorCode.EXCEEDS_OI_LIMIT,
      message: 'Position would exceed open interest limit',
      recoverable: true,
      suggestion: 'Reduce position size or wait for OI to decrease',
    };
  }

  if (message.includes('paused')) {
    return {
      code: ErrorCode.PAIR_PAUSED,
      message: 'Trading is paused for this pair',
      recoverable: false,
      suggestion: 'Wait for trading to resume',
    };
  }

  if (message.includes('network') || message.includes('timeout')) {
    return {
      code: ErrorCode.NETWORK_ERROR,
      message: 'Network error occurred',
      recoverable: true,
      suggestion: 'Check connection and retry',
    };
  }

  return {
    code: ErrorCode.UNKNOWN,
    message,
    recoverable: false,
  };
}
```

### Usage with Error Handler

```typescript
import { parseError, ErrorCode } from './utils/errors';

async function safeTrade(trade: TradeInput): Promise<string | null> {
  try {
    const client = await getClient();
    return await client.trade.openTrade(trade);
  } catch (error) {
    const parsed = parseError(error);
    
    console.error(`Trade failed: ${parsed.message}`);
    if (parsed.suggestion) {
      console.log(`Suggestion: ${parsed.suggestion}`);
    }

    if (parsed.recoverable && parsed.code === ErrorCode.NETWORK_ERROR) {
      console.log('Retrying in 5 seconds...');
      await new Promise(r => setTimeout(r, 5000));
      return safeTrade(trade); // Retry once
    }

    return null;
  }
}
```

## Environment Management

### Environment Variables

```bash
# .env.example
# Required for trading
PRIVATE_KEY=0x...

# Optional - defaults to public RPC
RPC_URL=https://mainnet.base.org

# Optional - trading limits
MAX_POSITION_SIZE=1000
MAX_LEVERAGE=10
ALLOWED_PAIRS=0,1,2

# Optional - monitoring
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

### Configuration Loader

```typescript
// src/config/env.ts
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const env = {
  // Trading
  privateKey: process.env.PRIVATE_KEY as `0x${string}` | undefined,
  rpcUrl: optionalEnv('RPC_URL', 'https://mainnet.base.org'),
  
  // Limits
  maxPositionSize: Number(optionalEnv('MAX_POSITION_SIZE', '1000')),
  maxLeverage: Number(optionalEnv('MAX_LEVERAGE', '10')),
  allowedPairs: optionalEnv('ALLOWED_PAIRS', '0,1,2')
    .split(',')
    .map(Number),
  
  // Monitoring
  discordWebhook: process.env.DISCORD_WEBHOOK,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  
  // Derived
  get isTradingEnabled(): boolean {
    return !!this.privateKey;
  },
};
```

## TypeScript Integration

### Type Extensions

```typescript
// src/types/trading.ts
import { TradeInput } from 'avantisfi-sdk';

// Extended trade input with app-specific fields
export interface AppTradeInput extends TradeInput {
  strategyId?: string;
  signalSource?: string;
  notes?: string;
}

// Trade result with metadata
export interface TradeResult {
  txHash: string;
  trade: AppTradeInput;
  timestamp: number;
  estimatedFees: number;
}

// Position with calculated fields
export interface EnhancedPosition {
  pairIndex: number;
  pairName: string;
  isLong: boolean;
  entryPrice: number;
  currentPrice: number;
  collateral: number;
  leverage: number;
  positionSize: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  liquidationPrice: number;
}
```

### Type-Safe Wrapper

```typescript
// src/services/trading.ts
import { TraderClient, TradeInput } from 'avantisfi-sdk';
import { AppTradeInput, TradeResult, EnhancedPosition } from '../types/trading';

export class TradingService {
  constructor(private client: TraderClient) {}

  async openTrade(input: AppTradeInput): Promise<TradeResult> {
    // Validate against app limits
    if (input.collateral > env.maxPositionSize) {
      throw new Error(`Position size $${input.collateral} exceeds limit $${env.maxPositionSize}`);
    }

    if (input.leverage > env.maxLeverage) {
      throw new Error(`Leverage ${input.leverage}x exceeds limit ${env.maxLeverage}x`);
    }

    if (!env.allowedPairs.includes(input.pairIndex)) {
      throw new Error(`Pair ${input.pairIndex} is not in allowed pairs`);
    }

    // Calculate fees
    const spread = await this.client.blended.getTotalSpread(
      input.pairIndex,
      input.collateral * input.leverage,
      input.isLong
    );
    const estimatedFees = (input.collateral * input.leverage * spread) / 10000;

    // Execute trade
    const txHash = await this.client.trade.openTrade(input);

    return {
      txHash,
      trade: input,
      timestamp: Date.now(),
      estimatedFees,
    };
  }

  async getEnhancedPositions(): Promise<EnhancedPosition[]> {
    if (!this.client.walletAddress) {
      return [];
    }

    const trades = await this.client.trade.getOpenTrades(this.client.walletAddress);
    const positions: EnhancedPosition[] = [];

    for (const trade of trades) {
      const pair = await this.client.pairsCache.getPairByIndex(trade.pairIndex);
      const currentPrice = await this.client.feedClient.getPrice(trade.pairIndex);

      const priceDiff = trade.isLong
        ? currentPrice - trade.openPrice
        : trade.openPrice - currentPrice;

      const unrealizedPnl = (priceDiff / trade.openPrice) * trade.positionSize;
      const unrealizedPnlPercent = (unrealizedPnl / trade.collateral) * 100;

      positions.push({
        pairIndex: trade.pairIndex,
        pairName: pair?.name || `Pair ${trade.pairIndex}`,
        isLong: trade.isLong,
        entryPrice: trade.openPrice,
        currentPrice,
        collateral: trade.collateral,
        leverage: trade.leverage,
        positionSize: trade.positionSize,
        unrealizedPnl,
        unrealizedPnlPercent,
        liquidationPrice: this.calculateLiquidationPrice(trade),
      });
    }

    return positions;
  }

  private calculateLiquidationPrice(trade: {
    openPrice: number;
    leverage: number;
    isLong: boolean;
  }): number {
    // Simplified liquidation calculation (90% loss)
    const liquidationThreshold = 0.9;
    const movePercent = liquidationThreshold / trade.leverage;

    if (trade.isLong) {
      return trade.openPrice * (1 - movePercent);
    } else {
      return trade.openPrice * (1 + movePercent);
    }
  }
}
```

## Next Steps

- [Front-End Integration](./frontend-example.md) - Build a React trading dashboard
- [Trading Opportunities](./trading-opportunities.md) - Discover and analyze trades
- [Automated Trading](./automated-trading.md) - Build trading bots
