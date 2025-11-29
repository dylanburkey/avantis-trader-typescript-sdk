# SDK Architecture

This document provides a visual overview of the Avantis TypeScript SDK architecture.

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              Your Application                               │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                             TraderClient                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Configuration                                 │  │
│  │  • rpcUrl: Base RPC endpoint                                         │  │
│  │  • privateKey: Optional signer key                                   │  │
│  │  • cacheTtl: Cache duration                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  Public Client  │  │  Wallet Client  │  │     Contract Instances      │ │
│  │  (Read Ops)     │  │  (Write Ops)    │  │  • TradingStorage           │ │
│  │                 │  │                 │  │  • Trading                  │ │
│  │  viem           │  │  viem           │  │  • PairInfos                │ │
│  └────────┬────────┘  └────────┬────────┘  │  • USDC                     │ │
│           │                    │           │  • Multicall                │ │
│           └────────────────────┘           └─────────────────────────────┘ │
│                      │                                                      │
│  ┌───────────────────┴──────────────────────────────────────────────────┐  │
│  │                           RPC Modules                                 │  │
│  │                                                                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │  │
│  │  │  TradeRPC   │ │ PairsCache  │ │  FeedClient │ │ AssetParameters │ │  │
│  │  │             │ │             │ │             │ │                 │ │  │
│  │  │ • openTrade │ │ • getPairs  │ │ • getPrice  │ │ • getOi         │ │  │
│  │  │ • closeTrade│ │ • getPair   │ │ • subscribe │ │ • getUtilization│ │  │
│  │  │ • getTrades │ │ • getNames  │ │             │ │ • getSkew       │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘ │  │
│  │                                                                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │  │
│  │  │ Category    │ │   Fee       │ │  Trading    │ │    Blended      │ │  │
│  │  │ Parameters  │ │ Parameters  │ │ Parameters  │ │    Metrics      │ │  │
│  │  │             │ │             │ │             │ │                 │ │  │
│  │  │ • getOi     │ │ • getSpread │ │ • getParams │ │ • getBlendedUtil│ │  │
│  │  │ • getSkew   │ │ • getMargin │ │ • getLiqPx  │ │ • getBlendedSkew│ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
        ┌───────────────────┐ ┌─────────────┐ ┌─────────────────┐
        │   Base Mainnet    │ │ Pyth Network│ │  Avantis API    │
        │   (Chain ID 8453) │ │ Price Feeds │ │  Socket API     │
        │                   │ │             │ │                 │
        │ • Smart Contracts │ │ • WebSocket │ │ • Pair Data     │
        │ • Transaction Exec│ │ • HTTP API  │ │ • Market Info   │
        └───────────────────┘ └─────────────┘ └─────────────────┘
```

## Module Dependency Graph

```
                                TraderClient
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
       PairsCache              FeedClient                 Signers
            │                        │                        │
            │                        │                        │
    ┌───────┴────────┐               │                   LocalSigner
    │                │               │                        │
    ▼                ▼               │                        ▼
AssetParams    CategoryParams        │                  WalletClient
    │                │               │
    │                │               │
    ▼                ▼               ▼
    └────────────────┴───────────────┘
                     │
                     ▼
              ┌─────────────┐
              │  BlendedRPC │
              └─────────────┘
                     │
                     ▼
              ┌─────────────┐
              │   TradeRPC  │
              └─────────────┘
```

## Contract Interaction Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Smart Contracts                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────┐      ┌────────────────────┐                     │
│  │   TradingStorage   │◄────►│      Trading       │                     │
│  │                    │      │                    │                     │
│  │ • openTrades       │      │ • openTrade        │                     │
│  │ • openTradesInfo   │      │ • closeTradeMarket │                     │
│  │ • openLimitOrders  │      │ • updateTp/Sl      │                     │
│  │ • pairsCount       │      │ • cancelLimitOrder │                     │
│  └────────────────────┘      └────────────────────┘                     │
│            │                           │                                 │
│            │                           │                                 │
│            ▼                           ▼                                 │
│  ┌────────────────────┐      ┌────────────────────┐                     │
│  │     PairInfos      │      │   PriceAggregator  │                     │
│  │                    │      │                    │                     │
│  │ • pairs            │      │ • getPrice         │                     │
│  │ • pairData         │      │                    │                     │
│  │ • groupOI/Limit    │      └────────────────────┘                     │
│  │ • pairOI/Limit     │                │                                 │
│  └────────────────────┘                │                                 │
│            │                           │                                 │
│            └───────────────────────────┘                                 │
│                           │                                              │
│                           ▼                                              │
│            ┌────────────────────────────┐                               │
│            │        Multicall           │                               │
│            │                            │                               │
│            │ • getPositions             │                               │
│            │ • getLongShortRatios       │                               │
│            │ • getMargins               │                               │
│            └────────────────────────────┘                               │
│                                                                          │
│  ┌────────────────────┐      ┌────────────────────┐                     │
│  │        USDC        │      │      Referral      │                     │
│  │                    │      │                    │                     │
│  │ • approve          │      │ • referrerByTrader │                     │
│  │ • balanceOf        │      │                    │                     │
│  │ • transfer         │      │                    │                     │
│  └────────────────────┘      └────────────────────┘                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Types Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Input    │     │   SDK Types     │     │ Contract Types  │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│                 │     │                 │     │                 │
│ positionSize:   │     │ TradeInput:     │     │ Trade tuple:    │
│   100 (USDC)    │────►│ positionSizeUsdc│────►│ positionSizeUsdc│
│                 │     │   100           │     │   100000000n    │
│                 │     │                 │     │   (6 decimals)  │
│ price:          │     │ openPrice:      │     │ openPrice:      │
│   50000.50      │────►│   50000.50      │────►│ 500005000000000n│
│                 │     │                 │     │   (10 decimals) │
│                 │     │                 │     │                 │
│ leverage: 10    │────►│ leverage: 10    │────►│ leverage: 10n   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘

        ▲                       │                       │
        │                       │                       │
        │         Validation    │    Serialization      │
        │         & Conversion  │    (toUsdcUnits,      │
        │                       │     toPriceUnits)     │
        │                       ▼                       ▼
        │               ┌─────────────────────────────────┐
        │               │      Contract Execution          │
        │               └─────────────────────────────────┘
        │                               │
        │                               │ Response
        │                               ▼
        │               ┌─────────────────────────────────┐
        │               │     Deserialization              │
        │               │  (fromUsdcUnits, fromPriceUnits) │
        └───────────────┴─────────────────────────────────┘
```

## File Structure

```
src/
├── index.ts                 # Main entry point, exports all public APIs
│
├── client/
│   ├── index.ts            # Client exports
│   └── trader-client.ts    # Main TraderClient class
│
├── contracts/
│   ├── abis.ts             # Contract ABI definitions
│   └── config.ts           # Addresses, constants, configuration
│
├── rpc/
│   ├── index.ts            # RPC module exports
│   ├── pairs-cache.ts      # Trading pair cache
│   ├── asset-parameters.ts # Asset-level parameters
│   ├── category-parameters.ts # Category-level parameters
│   ├── fee-parameters.ts   # Fee calculations
│   ├── trading-parameters.ts # Trading parameters
│   ├── blended.ts          # Blended metrics
│   ├── snapshot.ts         # Market snapshots
│   └── trade.ts            # Trade operations
│
├── feed/
│   ├── index.ts            # Feed exports
│   └── feed-client.ts      # Pyth price feed client
│
├── signers/
│   ├── index.ts            # Signer exports
│   ├── base-signer.ts      # Abstract signer interface
│   └── local-signer.ts     # Local private key signer
│
├── types/
│   └── index.ts            # TypeScript type definitions
│
├── utils/
│   └── index.ts            # Utility functions
│
└── __tests__/
    └── trader-client.test.ts # Test suite
```

## Cache Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        Caching Layers                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: PairsCache (TTL: 5 minutes)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Pair info (name, index, group, feed ID)                 │  │
│  │ • Pair count                                               │  │
│  │ • Group indexes                                            │  │
│  │ • Pair names                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Layer 2: Price Cache (TTL: 1 second)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Current prices from Pyth                                 │  │
│  │ • Price update data                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Layer 3: No Cache (Real-time)                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Open interest                                            │  │
│  │ • Trade data                                               │  │
│  │ • Pending orders                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ User Call   │────►│  Validation  │────►│  RPC Request    │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │                      │
                           │ ValidationError      │ RPC Error
                           ▼                      ▼
                    ┌──────────────┐      ┌─────────────────┐
                    │ Throw with   │      │ Retry with      │
                    │ descriptive  │      │ exponential     │
                    │ message      │      │ backoff         │
                    └──────────────┘      └─────────────────┘
                                                  │
                                                  │ Max retries
                                                  ▼
                                          ┌─────────────────┐
                                          │ Throw original  │
                                          │ error           │
                                          └─────────────────┘
```
