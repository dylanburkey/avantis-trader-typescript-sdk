# Data Flow Diagram

This document illustrates how data flows through the Avantis TypeScript SDK.

## Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW OVERVIEW                                  │
└──────────────────────────────────────────────────────────────────────────────┘

                          External Data Sources
    ┌──────────────────┬──────────────────┬──────────────────┐
    │                  │                  │                  │
    ▼                  ▼                  ▼                  ▼
┌────────┐       ┌──────────┐      ┌──────────┐      ┌──────────┐
│ Socket │       │   Base   │      │   Pyth   │      │  Pyth    │
│  API   │       │   RPC    │      │  Hermes  │      │ WebSocket│
│        │       │          │      │  (HTTP)  │      │ (Stream) │
└────┬───┘       └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                │                 │                 │
     │ Pair info      │ Contracts       │ Price updates   │ Real-time
     │ OI data        │ Positions       │ VAA data        │ prices
     │ Group info     │ Transactions    │                 │
     │                │                 │                 │
     ▼                ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           TraderClient                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ PairsCache  │  │  Contract   │  │ FeedClient  │  │ PriceStream │     │
│  │             │  │ Instances   │  │             │  │ (optional)  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        RPC Modules                                  │ │
│  │                                                                     │ │
│  │  AssetParameters │ CategoryParameters │ FeeParameters │ TradeRPC   │ │
│  │                  │                    │               │            │ │
│  │  BlendedRPC      │ TradingParameters  │ SnapshotRPC   │            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
                                     ▼
                              Your Application
```

## Socket API Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SOCKET API DATA FLOW                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  Avantis Socket API
  https://socket-api-pub.avantisfi.com/socket-api/v1/data
        │
        │ GET request
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         API Response                                     │
  │                                                                          │
  │  {                                                                       │
  │    "data": {                                                            │
  │      "dataVersion": 12345,                                              │
  │      "groupInfo": {                                                     │
  │        "0": { "name": "Crypto", "groupMaxOI": "...", ... },            │
  │        "1": { "name": "Forex", ... }                                   │
  │      },                                                                 │
  │      "pairInfos": {                                                     │
  │        "0": { "name": "ETH/USD", "longOI": "...", ... },               │
  │        "1": { "name": "BTC/USD", ... }                                 │
  │      }                                                                  │
  │    }                                                                    │
  │  }                                                                      │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        │ Parse & cache
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                          PairsCache                                      │
  │                                                                          │
  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
  │  │    pairsMap     │  │    groupsMap    │  │    feedIdMap    │         │
  │  │                 │  │                 │  │                 │         │
  │  │ 0 → ETH/USD    │  │ 0 → Crypto      │  │ 0 → 0xff61...   │         │
  │  │ 1 → BTC/USD    │  │ 1 → Forex       │  │ 1 → 0xe62d...   │         │
  │  │ 2 → SOL/USD    │  │ ...             │  │ ...             │         │
  │  │ ...            │  │                 │  │                 │         │
  │  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
  │                                                                          │
  │  Cache TTL: 5 minutes                                                   │
  │  Auto-refresh on stale data                                             │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        │ Provide data to
        │
        ▼
  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
  │AssetParameters  │  │CategoryParameters│ │  FeedClient     │
  │                 │  │                  │ │                 │
  │ Uses pair OI,   │  │ Uses group OI,   │ │ Uses feed IDs   │
  │ max OI, etc.    │  │ max OI, etc.     │ │ for price lookup│
  └─────────────────┘  └──────────────────┘ └─────────────────┘
```

## Price Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PRICE DATA FLOW                                     │
└──────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────┐
                    │      Pyth Price Service         │
                    │                                 │
                    │  Aggregates from 90+ sources    │
                    │  Sub-second updates             │
                    └────────────────┬────────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                             │
              ▼                                             ▼
    ┌─────────────────────┐                    ┌─────────────────────┐
    │    Hermes HTTP      │                    │   Pyth WebSocket    │
    │                     │                    │                     │
    │ hermes.pyth.network │                    │ Streaming updates   │
    │                     │                    │                     │
    │ • On-demand prices  │                    │ • Real-time feed    │
    │ • VAA for txs       │                    │ • Low latency       │
    └──────────┬──────────┘                    └──────────┬──────────┘
               │                                          │
               ▼                                          ▼
    ┌─────────────────────┐                    ┌─────────────────────┐
    │     FeedClient      │                    │    PriceStream      │
    │                     │                    │    (optional)       │
    │ • getPrice(pair)    │                    │                     │
    │ • getPrices([...])  │                    │ • subscribe(pairs)  │
    │ • getUpdateData()   │                    │ • onPrice(callback) │
    └──────────┬──────────┘                    └──────────┬──────────┘
               │                                          │
               └──────────────────┬───────────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  Application    │
                         │                 │
                         │ Display prices  │
                         │ Execute trades  │
                         │ Calculate PnL   │
                         └─────────────────┘


  Price Data Structure:
  ┌───────────────────────────────────────────────────────────────┐
  │ {                                                              │
  │   "id": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665", │
  │   "price": {                                                   │
  │     "price": "350050000000",  // $3500.50 (8 decimals)        │
  │     "conf": "150000000",      // Confidence interval          │
  │     "expo": -8,               // Exponent                     │
  │     "publish_time": 1700000000                                │
  │   },                                                          │
  │   "ema_price": { ... }                                        │
  │ }                                                              │
  └───────────────────────────────────────────────────────────────┘
```

## Trade Execution Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       TRADE EXECUTION DATA FLOW                               │
└──────────────────────────────────────────────────────────────────────────────┘

  User Trade Request
  { pairIndex: 0, collateral: 100, leverage: 10, isLong: true }
        │
        │ 1. Validate parameters
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                           TradeRPC                                       │
  │                                                                          │
  │  Input Validation:                                                       │
  │  • pairIndex exists in PairsCache                                       │
  │  • leverage within pair limits                                          │
  │  • collateral above minimum                                             │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        │ 2. Prepare price data
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                          FeedClient                                      │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │                    Pyth VAA (Signed Price)                         │ │
  │  │                                                                     │ │
  │  │  Contains:                                                          │ │
  │  │  • Price at timestamp                                               │ │
  │  │  • Signatures from Wormhole guardians                               │ │
  │  │  • Used by contract to verify price                                 │ │
  │  │                                                                     │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        │ 3. Build transaction
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                       Transaction Builder                                │
  │                                                                          │
  │  {                                                                       │
  │    to: Trading.address,                                                 │
  │    data: encodeFunctionData({                                           │
  │      abi: TradingABI,                                                   │
  │      functionName: 'openTrade',                                         │
  │      args: [trade, priceUpdateData, referrer]                           │
  │    }),                                                                   │
  │    value: executionFee  // ETH for Pyth update                          │
  │  }                                                                       │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        │ 4. Sign transaction
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         LocalSigner                                      │
  │                                                                          │
  │  Uses viem WalletClient with private key                                │
  │  Signs transaction locally (never sends key to RPC)                     │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        │ 5. Broadcast to network
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         Base Network                                     │
  │                                                                          │
  │  Transaction flows through:                                             │
  │  1. RPC node → Mempool                                                  │
  │  2. Mempool → Block builder                                             │
  │  3. Block → L2 sequencer                                                │
  │  4. Sequencer → L1 rollup                                               │
  │                                                                          │
  │  ~2 second confirmation on Base                                         │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        │ 6. Return result
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                       Transaction Receipt                                │
  │                                                                          │
  │  {                                                                       │
  │    hash: "0x...",                                                       │
  │    status: "success",                                                   │
  │    blockNumber: 12345678,                                               │
  │    logs: [                                                              │
  │      { event: "TradeOpened", args: { ... } }                           │
  │    ]                                                                    │
  │  }                                                                       │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
```

## Data Transformation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          DATA TRANSFORMATION                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  Raw Contract Data                    SDK Types                 User Display
  ─────────────────                    ─────────                 ────────────
  
  positionSizeUsdc                     
  100000000n          ──────────────►  100           ──────────►  "$100.00"
  (6 decimals)                         (number)                   (formatted)
  
  openPrice                            
  35005000000000n     ──────────────►  3500.50       ──────────►  "$3,500.50"
  (10 decimals)                        (number)                   (formatted)
  
  leverage                             
  10n                 ──────────────►  10            ──────────►  "10x"
  (bigint)                             (number)                   (formatted)
  
  
  Conversion Functions:
  ─────────────────────
  
  ┌────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │  toUsdcUnits(100)           → 100000000n        // USDC has 6 decimals │
  │  fromUsdcUnits(100000000n)  → 100               // Back to number      │
  │                                                                         │
  │  toPriceUnits(3500.50)      → 35005000000000n   // 10 decimal precision│
  │  fromPriceUnits(...)        → 3500.50           // Back to number      │
  │                                                                         │
  │  formatUsd(3500.50)         → "$3,500.50"       // Display string      │
  │  formatLeverage(10)         → "10x"             // Display string      │
  │                                                                         │
  └────────────────────────────────────────────────────────────────────────┘
```

## Caching Layers

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CACHING LAYERS                                     │
└──────────────────────────────────────────────────────────────────────────────┘

  Request
     │
     ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  L1: In-Memory Cache (fastest)                                          │
  │  TTL: 5 minutes                                                         │
  │                                                                          │
  │  Cached:                                                                │
  │  • Pair info (name, index, leverage limits)                            │
  │  • Group info (name, OI limits)                                        │
  │  • Feed IDs (Pyth identifiers)                                         │
  │                                                                          │
  │  Cache Hit?                                                             │
  │  ├─── Yes ──► Return cached data                                       │
  │  └─── No  ──► Continue to L2                                           │
  └─────────────────────────────────────────────────────────────────────────┘
     │
     │ Cache miss
     │
     ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  L2: Socket API (remote cache)                                          │
  │  Updates: Every few seconds                                             │
  │                                                                          │
  │  Provides:                                                              │
  │  • Current OI data                                                      │
  │  • Live spread calculations                                             │
  │  • Aggregated market state                                              │
  │                                                                          │
  │  Available?                                                             │
  │  ├─── Yes ──► Return API data, update L1 cache                         │
  │  └─── No  ──► Fall back to L3                                          │
  └─────────────────────────────────────────────────────────────────────────┘
     │
     │ API unavailable
     │
     ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  L3: Direct Contract Calls (fallback)                                   │
  │  Latency: ~100-500ms per call                                           │
  │                                                                          │
  │  Used for:                                                              │
  │  • Real-time position data                                              │
  │  • Transaction execution                                                │
  │  • Fallback when API is down                                            │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
```
