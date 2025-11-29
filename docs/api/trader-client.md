# TraderClient API Reference

The `TraderClient` is the main entry point for the Avantis TypeScript SDK.

## Constructor

```typescript
static async create(options?: TraderClientOptions): Promise<TraderClient>
```

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `rpcUrl` | `string` | No | `https://mainnet.base.org` | Base RPC endpoint |
| `privateKey` | `` `0x${string}` `` | No | - | Private key for signing transactions |
| `socketApiUrl` | `string` | No | `https://socket-api-pub.avantisfi.com/socket-api/v1/data` | Avantis Socket API URL |
| `cacheTtl` | `number` | No | `300000` (5 min) | Cache time-to-live in milliseconds |

### Example

```typescript
import { TraderClient } from 'avantisfi-sdk';

// Read-only mode
const readOnlyClient = await TraderClient.create();

// Trading mode
const tradingClient = await TraderClient.create({
  privateKey: '0x...',
  rpcUrl: 'https://base.llamarpc.com',
});
```

## Properties

### `walletAddress`

```typescript
readonly walletAddress: string | undefined
```

The wallet address derived from the private key. `undefined` if no private key was provided.

### `contracts`

```typescript
readonly contracts: ContractInstances
```

Viem contract instances for direct contract interaction.

| Contract | Description |
|----------|-------------|
| `Trading` | Main trading contract for opening/closing trades |
| `TradingStorage` | Storage contract for trade data |
| `PairInfos` | Pair configuration and limits |
| `USDC` | USDC token contract |
| `Multicall` | Multicall contract for batched reads |
| `PriceAggregator` | Price aggregator contract |

### `pairsCache`

```typescript
readonly pairsCache: PairsCache
```

Access to trading pair information. See [PairsCache API](./pairs-cache.md).

### `feedClient`

```typescript
readonly feedClient: FeedClient
```

Access to Pyth price feeds. See [FeedClient API](./feed-client.md).

### `assetParameters`

```typescript
readonly assetParameters: AssetParametersRPC
```

Asset-level market parameters. See [AssetParameters API](./asset-parameters.md).

### `categoryParameters`

```typescript
readonly categoryParameters: CategoryParametersRPC
```

Category-level market parameters. See [CategoryParameters API](./category-parameters.md).

### `feeParameters`

```typescript
readonly feeParameters: FeeParametersRPC
```

Fee calculations. See [FeeParameters API](./fee-parameters.md).

### `tradingParameters`

```typescript
readonly tradingParameters: TradingParametersRPC
```

Trading parameters and limits.

### `blended`

```typescript
readonly blended: BlendedRPC
```

Blended metrics combining asset and category data. See [BlendedRPC API](./blended-metrics.md).

### `trade`

```typescript
readonly trade: TradeRPC
```

Trade execution methods. See [TradeRPC API](./trade-rpc.md).

### `snapshot`

```typescript
readonly snapshot: SnapshotRPC
```

Market snapshot methods.

## Methods

### `getUsdcBalance`

```typescript
async getUsdcBalance(address?: string): Promise<number>
```

Get USDC balance for an address.

**Parameters:**
- `address` (optional): Address to check. Defaults to connected wallet.

**Returns:** USDC balance as a number (e.g., `1000.50`)

**Example:**
```typescript
const balance = await client.getUsdcBalance();
console.log(`Balance: $${balance.toFixed(2)}`);

// Check another address
const otherBalance = await client.getUsdcBalance('0x...');
```

### `approveUsdc`

```typescript
async approveUsdc(spender: string, amount: number): Promise<string>
```

Approve USDC spending for a contract.

**Parameters:**
- `spender`: Contract address to approve
- `amount`: Amount in USDC (e.g., `100` for $100)

**Returns:** Transaction hash

**Example:**
```typescript
const tradingAddress = client.contracts.Trading.address;
const txHash = await client.approveUsdc(tradingAddress, 1000);
console.log('Approved:', txHash);
```

### `getUsdcAllowance`

```typescript
async getUsdcAllowance(spender: string, owner?: string): Promise<number>
```

Get current USDC allowance for a spender.

**Parameters:**
- `spender`: Contract address to check allowance for
- `owner` (optional): Owner address. Defaults to connected wallet.

**Returns:** Allowance amount in USDC

**Example:**
```typescript
const allowance = await client.getUsdcAllowance(
  client.contracts.Trading.address
);
if (allowance < 100) {
  await client.approveUsdc(client.contracts.Trading.address, 100);
}
```

## Type Definitions

### TraderClientOptions

```typescript
interface TraderClientOptions {
  rpcUrl?: string;
  privateKey?: `0x${string}`;
  socketApiUrl?: string;
  cacheTtl?: number;
}
```

### ContractInstances

```typescript
interface ContractInstances {
  Trading: Contract;
  TradingStorage: Contract;
  PairInfos: Contract;
  USDC: Contract;
  Multicall: Contract;
  PriceAggregator: Contract;
}
```

## Error Handling

The TraderClient throws errors in these scenarios:

| Error | Cause |
|-------|-------|
| `Invalid private key format` | Private key doesn't match `0x{64 hex chars}` |
| `No wallet connected` | Method requires private key but none provided |
| `Insufficient USDC balance` | Not enough USDC for trade |
| `Transaction reverted` | On-chain transaction failed |

**Example:**
```typescript
try {
  const client = await TraderClient.create({
    privateKey: 'invalid',
  });
} catch (error) {
  console.error('Invalid private key format');
}
```

## Usage Patterns

### Read-Only Analysis

```typescript
const client = await TraderClient.create();

// Analyze market conditions
const pairs = await client.pairsCache.getPairsInfo();
const oi = await client.assetParameters.getOi();

for (const [index, pair] of pairs) {
  const pairOi = oi.get(index);
  console.log(`${pair.name}: Long $${pairOi?.long}, Short $${pairOi?.short}`);
}
```

### Trading Bot

```typescript
const client = await TraderClient.create({
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});

// Pre-approve large amount
await client.approveUsdc(
  client.contracts.Trading.address,
  10000 // $10,000
);

// Execute trades without approval delays
const trade1 = await client.trade.openTrade({ /* ... */ });
const trade2 = await client.trade.openTrade({ /* ... */ });
```

### Multi-Pair Monitoring

```typescript
const client = await TraderClient.create();

// Get all metrics for multiple pairs
const pairs = [0, 1, 2]; // ETH, BTC, SOL

const [oi, spreads, utilization] = await Promise.all([
  client.assetParameters.getOi(),
  Promise.all(pairs.map(i => client.feeParameters.getSpread(i))),
  Promise.all(pairs.map(i => client.blended.getBlendedUtilization(i))),
]);

pairs.forEach((pairIndex, i) => {
  console.log(`Pair ${pairIndex}:`, {
    oi: oi.get(pairIndex),
    spread: spreads[i],
    utilization: utilization[i],
  });
});
```
