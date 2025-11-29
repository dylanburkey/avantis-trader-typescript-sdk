# Trade Flow Diagram

This document illustrates the complete lifecycle of a trade in the Avantis TypeScript SDK.

## Opening a Market Order

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          OPEN MARKET ORDER FLOW                               │
└──────────────────────────────────────────────────────────────────────────────┘

  User Application
        │
        │ 1. Prepare TradeInput
        │    { pairIndex, collateral, leverage, isLong, ... }
        │
        ▼
  ┌─────────────────┐
  │  TraderClient   │
  │                 │
  │  Pre-Trade      │
  │  Validation     │
  └────────┬────────┘
           │
           │ 2. Check USDC balance
           │ 3. Check USDC allowance
           │
           ▼
  ┌─────────────────┐     ┌─────────────────┐
  │ Approve USDC?   │────►│  USDC Contract  │
  │ (if needed)     │     │                 │
  └────────┬────────┘     │  approve()      │
           │              └─────────────────┘
           │
           │ 4. Fetch Pyth price update
           │
           ▼
  ┌─────────────────┐     ┌─────────────────┐
  │   FeedClient    │────►│  Pyth Hermes    │
  │                 │     │  (HTTP API)     │
  │  getUpdateData()│     └─────────────────┘
  └────────┬────────┘
           │
           │ 5. Build transaction
           │
           ▼
  ┌─────────────────┐
  │    TradeRPC     │
  │                 │
  │  openTrade()    │
  └────────┬────────┘
           │
           │ 6. Sign & broadcast
           │
           ▼
  ┌─────────────────┐     ┌─────────────────┐
  │  Wallet Client  │────►│  Base Network   │
  │                 │     │                 │
  │  sendTransaction│     │  RPC Node       │
  └────────┬────────┘     └─────────────────┘
           │
           │ 7. Wait for confirmation
           │
           ▼
  ┌─────────────────┐
  │ Trading Contract│
  │                 │
  │ openTrade()     │
  │   • Validate    │
  │   • Lock USDC   │
  │   • Create pos  │
  │   • Emit event  │
  └────────┬────────┘
           │
           │ 8. Return tx hash
           │
           ▼
  ┌─────────────────┐
  │   Application   │
  │                 │
  │  Handle result  │
  └─────────────────┘
```

## Closing a Trade

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CLOSE TRADE FLOW                                    │
└──────────────────────────────────────────────────────────────────────────────┘

  User Application
        │
        │ 1. Get open trades
        │
        ▼
  ┌─────────────────┐     ┌─────────────────┐
  │    TradeRPC     │────►│ TradingStorage  │
  │                 │     │                 │
  │ getOpenTrades() │     │ openTrades[]    │
  └────────┬────────┘     └─────────────────┘
           │
           │ 2. Select trade to close
           │    { pairIndex, tradeIndex }
           │
           ▼
  ┌─────────────────┐     ┌─────────────────┐
  │   FeedClient    │────►│  Pyth Hermes    │
  │                 │     │                 │
  │ getUpdateData() │     │  Latest price   │
  └────────┬────────┘     └─────────────────┘
           │
           │ 3. Execute close
           │
           ▼
  ┌─────────────────┐
  │    TradeRPC     │
  │                 │
  │closeTradeMarket │
  └────────┬────────┘
           │
           │ 4. Sign & broadcast
           │
           ▼
  ┌─────────────────┐
  │ Trading Contract│
  │                 │
  │closeTradeMarket │
  │   • Get price   │
  │   • Calc PnL    │
  │   • Pay fees    │
  │   • Return USDC │
  │   • Emit event  │
  └────────┬────────┘
           │
           │ 5. USDC transferred
           │    (collateral +/- PnL)
           │
           ▼
  ┌─────────────────┐
  │  User Wallet    │
  │                 │
  │  USDC received  │
  └─────────────────┘
```

## Limit Order Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           LIMIT ORDER FLOW                                    │
└──────────────────────────────────────────────────────────────────────────────┘

                                      ┌─────────────┐
                                      │   Market    │
                                      │   Price     │
                                      └──────┬──────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────┐
         │                                   │                               │
         ▼                                   ▼                               ▼
  ┌─────────────┐                    ┌─────────────┐                 ┌─────────────┐
  │ Submit      │                    │   Pending   │                 │  Cancelled  │
  │ Limit Order │───────────────────►│   Order     │────────────────►│   (User)    │
  │             │                    │             │                 │             │
  │ orderType=1 │                    │ Waiting for │                 │  Refund     │
  │ openPrice=X │                    │ price = X   │                 │  USDC       │
  └─────────────┘                    └──────┬──────┘                 └─────────────┘
                                            │
                                            │ Price reaches X
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │  Executed   │
                                     │             │
                                     │ Position    │
                                     │ opened at X │
                                     └─────────────┘


  Timeline:
  ────────────────────────────────────────────────────────────────────►
       │              │                    │                │
       │              │                    │                │
    Submit         Pending              Execute         Close/Liquidate
    Order          (waiting)            (price hit)     (later)
```

## Position Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         POSITION STATE MACHINE                                │
└──────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
             ┌─────────────┐                                  │
             │   PENDING   │◄───── Limit Order Submitted      │
             │   (Limit)   │                                  │
             └──────┬──────┘                                  │
                    │                                         │
        ┌───────────┴───────────┐                            │
        │                       │                            │
        ▼                       ▼                            │
  ┌───────────┐           ┌───────────┐                      │
  │ CANCELLED │           │  ACTIVE   │◄──── Market Order    │
  │           │           │           │                      │
  └───────────┘           └─────┬─────┘                      │
                                │                            │
        ┌───────────────────────┼───────────────────────┐    │
        │                       │                       │    │
        ▼                       ▼                       ▼    │
  ┌───────────┐           ┌───────────┐           ┌───────────┐
  │ CLOSED    │           │ TP/SL     │           │LIQUIDATED │
  │ (Manual)  │           │ (Auto)    │           │           │
  │           │           │           │           │           │
  │ User PnL  │           │ User PnL  │           │ Loss      │
  └───────────┘           └───────────┘           └───────────┘


  State Transitions:
  
  PENDING → ACTIVE     : Limit price reached
  PENDING → CANCELLED  : User cancels order
  ACTIVE  → CLOSED     : User closes manually
  ACTIVE  → TP/SL      : Price hits TP or SL level
  ACTIVE  → LIQUIDATED : Margin ratio breached
```

## Fee Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FEE STRUCTURE                                    │
└──────────────────────────────────────────────────────────────────────────────┘

  Position Size: $10,000
  Leverage: 10x
  Collateral: $1,000
  
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                           ENTRY FEES                                     │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                          │
  │   Base Spread         5 bps    ×  $10,000  =  $5.00                     │
  │   + Price Impact     10 bps    ×  $10,000  =  $10.00                    │
  │   + Skew Impact       3 bps    ×  $10,000  =  $3.00                     │
  │   ─────────────────────────────────────────────────                     │
  │   Total Spread       18 bps                 =  $18.00                   │
  │                                                                          │
  │   Execution Fee (Pyth)                      ≈  $0.50                    │
  │   ─────────────────────────────────────────────────                     │
  │   Total Entry Cost                          ≈  $18.50                   │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                           EXIT FEES                                      │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                          │
  │   Closing Fee (fixed)                       =  $5.00                    │
  │   Execution Fee (Pyth)                      ≈  $0.50                    │
  │   ─────────────────────────────────────────────────                     │
  │   Total Exit Cost                           ≈  $5.50                    │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         HOLDING FEES                                     │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                          │
  │   Funding Rate (hourly, variable based on skew)                         │
  │   Borrowing Fee (hourly, based on utilization)                          │
  │                                                                          │
  │   These fees accumulate over time and are deducted at close.            │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ERROR HANDLING FLOW                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐
  │  Trade Request  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐      ┌─────────────────┐
  │  Validation     │─────►│ INVALID_INPUT   │
  │                 │ fail │                 │
  │ • Pair exists   │      │ • Bad pair index│
  │ • Leverage OK   │      │ • Over max lev  │
  │ • Collateral OK │      │ • Under min col │
  └────────┬────────┘      └─────────────────┘
           │ pass
           ▼
  ┌─────────────────┐      ┌─────────────────┐
  │  Balance Check  │─────►│  INSUFFICIENT   │
  │                 │ fail │    FUNDS        │
  │ • USDC balance  │      │                 │
  │ • ETH for gas   │      │ Prompt user to  │
  └────────┬────────┘      │ add funds       │
           │ pass          └─────────────────┘
           ▼
  ┌─────────────────┐      ┌─────────────────┐
  │  Allowance      │─────►│  Approve and    │
  │  Check          │ low  │  Retry          │
  └────────┬────────┘      └────────┬────────┘
           │ ok                     │
           ▼                        │
  ┌─────────────────┐               │
  │  Submit TX      │◄──────────────┘
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐      ┌─────────────────┐
  │  TX Execution   │─────►│   TX_REVERTED   │
  │                 │ fail │                 │
  │  On-chain       │      │ • OI limit hit  │
  │  validation     │      │ • Price moved   │
  └────────┬────────┘      │ • Trading pause │
           │ success       └─────────────────┘
           ▼
  ┌─────────────────┐
  │    SUCCESS      │
  │                 │
  │  Position open  │
  └─────────────────┘
```
