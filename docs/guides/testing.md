# Testing Guide

This guide covers how to test the Avantis TypeScript SDK and write tests for your own applications.

## Running SDK Tests

### Unit Tests

Run unit tests that don't require network access:

```bash
# Run with mocked dependencies
SKIP_INTEGRATION_TESTS=true npm test

# Run once (no watch mode)
SKIP_INTEGRATION_TESTS=true npm run test:run
```

### Integration Tests

Run integration tests that connect to Base mainnet:

```bash
# Run all tests including integration
npm test

# Run with verbose output
npm test -- --reporter=verbose
```

### Watch Mode

During development, run tests in watch mode:

```bash
npm run dev  # Runs build in watch mode
npm test     # In another terminal, runs tests in watch mode
```

## Test Configuration

Tests are configured in `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
});
```

## Writing Unit Tests

### Mocking the TraderClient

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraderClient } from 'avantisfi-sdk';

describe('MyTradingBot', () => {
  let mockClient: jest.Mocked<TraderClient>;

  beforeEach(() => {
    // Create a mock client
    mockClient = {
      pairsCache: {
        getPairsInfo: vi.fn().mockResolvedValue(new Map([
          [0, { name: 'ETH/USD', pairIndex: 0 }],
          [1, { name: 'BTC/USD', pairIndex: 1 }],
        ])),
        getPairNames: vi.fn().mockResolvedValue(['ETH/USD', 'BTC/USD']),
      },
      assetParameters: {
        getOi: vi.fn().mockResolvedValue(new Map([
          [0, { long: 1000000, short: 900000 }],
        ])),
      },
      feedClient: {
        getPrice: vi.fn().mockResolvedValue(3500.50),
      },
    } as unknown as jest.Mocked<TraderClient>;
  });

  it('should fetch market data', async () => {
    const names = await mockClient.pairsCache.getPairNames();
    expect(names).toContain('ETH/USD');
    expect(mockClient.pairsCache.getPairNames).toHaveBeenCalled();
  });
});
```

### Testing Trade Logic

```typescript
import { describe, it, expect } from 'vitest';
import { calculatePositionSize, validateTrade } from './trading-utils';

describe('Trade Validation', () => {
  it('should reject leverage above max', () => {
    const trade = {
      pairIndex: 0,
      leverage: 100, // ETH max is 75x
      collateral: 100,
    };
    
    expect(() => validateTrade(trade, 75)).toThrow('exceeds max leverage');
  });

  it('should calculate position size correctly', () => {
    const size = calculatePositionSize(100, 10); // $100 at 10x
    expect(size).toBe(1000);
  });

  it('should handle decimal precision', () => {
    const size = calculatePositionSize(99.99, 5);
    expect(size).toBeCloseTo(499.95, 2);
  });
});
```

## Writing Integration Tests

### Testing Against Live Network

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { TraderClient } from 'avantisfi-sdk';

describe('Integration: Market Data', () => {
  let client: TraderClient;

  beforeAll(async () => {
    client = await TraderClient.create();
  }, 30000); // 30s timeout for initialization

  it('should fetch trading pairs from Socket API', async () => {
    const pairs = await client.pairsCache.getPairsInfo();
    
    expect(pairs.size).toBeGreaterThan(0);
    expect(pairs.get(0)?.name).toBe('ETH/USD');
  });

  it('should get open interest data', async () => {
    const oi = await client.assetParameters.getOi();
    
    expect(oi.size).toBeGreaterThan(0);
    const ethOi = oi.get(0);
    expect(ethOi).toBeDefined();
    expect(ethOi!.long).toBeGreaterThanOrEqual(0);
    expect(ethOi!.short).toBeGreaterThanOrEqual(0);
  });

  it('should calculate blended utilization', async () => {
    const util = await client.blended.getBlendedUtilization(0);
    
    expect(util.long).toBeGreaterThanOrEqual(0);
    expect(util.long).toBeLessThanOrEqual(100);
    expect(util.short).toBeGreaterThanOrEqual(0);
    expect(util.short).toBeLessThanOrEqual(100);
  });
});
```

### Testing Trade Execution (Testnet)

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { TraderClient, TradeInput } from 'avantisfi-sdk';

// Only run on testnet
describe.skipIf(!process.env.TESTNET_PRIVATE_KEY)('Integration: Trading', () => {
  let client: TraderClient;

  beforeAll(async () => {
    client = await TraderClient.create({
      rpcUrl: process.env.TESTNET_RPC_URL,
      privateKey: process.env.TESTNET_PRIVATE_KEY as `0x${string}`,
    });
  }, 30000);

  it('should open and close a trade', async () => {
    const trade: TradeInput = {
      pairIndex: 0,
      collateral: 10, // Small amount for testing
      openPrice: 0,
      isLong: true,
      leverage: 2,
      takeProfit: 0,
      stopLoss: 0,
      orderType: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };

    // Approve USDC
    await client.approveUsdc(
      client.contracts.Trading.address,
      trade.collateral
    );

    // Open trade
    const openTx = await client.trade.openTrade(trade);
    expect(openTx).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Wait for confirmation
    await new Promise(r => setTimeout(r, 5000));

    // Get open trades
    const trades = await client.trade.getOpenTrades(client.walletAddress!);
    expect(trades.length).toBeGreaterThan(0);

    // Close the trade
    const closeTx = await client.trade.closeTradeMarket(
      trades[0].pairIndex,
      trades[0].index
    );
    expect(closeTx).toMatch(/^0x[a-fA-F0-9]{64}$/);
  }, 60000);
});
```

## Test Utilities

### Helper Functions

Create test utilities in `src/__tests__/helpers.ts`:

```typescript
import { TraderClient } from '../index';

export async function createTestClient(options?: {
  privateKey?: `0x${string}`;
}): Promise<TraderClient> {
  return TraderClient.create({
    rpcUrl: process.env.TEST_RPC_URL || 'https://mainnet.base.org',
    ...options,
  });
}

export function mockPairInfo(overrides?: Partial<PairInfo>) {
  return {
    name: 'TEST/USD',
    pairIndex: 999,
    groupIndex: 0,
    feedId: '0x...',
    minLeverage: 1,
    maxLeverage: 50,
    ...overrides,
  };
}

export function mockOpenInterest(overrides?: Partial<OpenInterest>) {
  return {
    long: 1000000,
    short: 900000,
    ...overrides,
  };
}
```

### Environment Setup

Create a `.env.test` file:

```bash
# Test configuration
SKIP_INTEGRATION_TESTS=false
TEST_RPC_URL=https://mainnet.base.org

# For trade execution tests (optional)
TESTNET_RPC_URL=https://sepolia.base.org
TESTNET_PRIVATE_KEY=0x...
```

## Coverage Reports

Generate test coverage:

```bash
npm test -- --coverage
```

View coverage report:
```bash
open coverage/index.html
```

Target coverage thresholds:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Common Test Patterns

### Testing Async Operations

```typescript
it('should handle network timeouts', async () => {
  const client = await TraderClient.create({
    rpcUrl: 'https://slow-rpc.example.com',
  });

  await expect(
    client.pairsCache.getPairsInfo()
  ).rejects.toThrow('timeout');
});
```

### Testing Error Conditions

```typescript
it('should throw on invalid pair index', async () => {
  const client = await TraderClient.create();
  
  await expect(
    client.assetParameters.getUtilization(9999)
  ).rejects.toThrow('Pair 9999 not found');
});
```

### Snapshot Testing

```typescript
it('should match expected pair structure', async () => {
  const client = await TraderClient.create();
  const pair = await client.pairsCache.getPairByIndex(0);
  
  expect(pair).toMatchSnapshot();
});
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: SKIP_INTEGRATION_TESTS=true npm run test:run
      
      - name: Integration tests
        run: npm run test:run
        env:
          TEST_RPC_URL: ${{ secrets.TEST_RPC_URL }}
```

## Debugging Tests

### Verbose Output

```bash
npm test -- --reporter=verbose
```

### Single Test

```bash
npm test -- --grep "should fetch trading pairs"
```

### Debug Mode

```bash
node --inspect-brk node_modules/.bin/vitest run
```

Then open Chrome DevTools at `chrome://inspect`.
