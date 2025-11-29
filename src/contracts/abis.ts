/**
 * Avantis Contract ABIs
 *
 * Contains all ABI definitions for interacting with Avantis protocol contracts.
 */

// ============================================================================
// ERC20 ABI (for USDC)
// ============================================================================

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// ============================================================================
// Avantis Multicall ABI (custom contract)
// ============================================================================

export const MULTICALL_ABI = [
  {
    name: "aggregate",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "blockNumber", type: "uint256" },
      { name: "returnData", type: "bytes[]" },
    ],
  },
  {
    name: "tryAggregate",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "requireSuccess", type: "bool" },
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
  {
    name: "getPositions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [
      {
        name: "trades",
        type: "tuple[]",
        components: [
          {
            name: "trade",
            type: "tuple",
            components: [
              { name: "trader", type: "address" },
              { name: "pairIndex", type: "uint256" },
              { name: "index", type: "uint256" },
              { name: "initialPosToken", type: "uint256" },
              { name: "positionSizeUSDC", type: "uint256" },
              { name: "openPrice", type: "uint256" },
              { name: "buy", type: "bool" },
              { name: "leverage", type: "uint256" },
              { name: "tp", type: "uint256" },
              { name: "sl", type: "uint256" },
              { name: "timestamp", type: "uint256" },
            ],
          },
          {
            name: "tradeInfo",
            type: "tuple",
            components: [
              { name: "openInterestUSDC", type: "uint256" },
              { name: "tpLastUpdated", type: "uint256" },
              { name: "slLastUpdated", type: "uint256" },
              { name: "beingMarketClosed", type: "bool" },
              { name: "lossProtectionTier", type: "uint256" },
            ],
          },
          { name: "marginFee", type: "uint256" },
          { name: "liquidationPrice", type: "uint256" },
        ],
      },
      {
        name: "pendingOrders",
        type: "tuple[]",
        components: [
          {
            name: "order",
            type: "tuple",
            components: [
              { name: "trader", type: "address" },
              { name: "pairIndex", type: "uint256" },
              { name: "index", type: "uint256" },
              { name: "positionSize", type: "uint256" },
              { name: "buy", type: "bool" },
              { name: "leverage", type: "uint256" },
              { name: "tp", type: "uint256" },
              { name: "sl", type: "uint256" },
              { name: "price", type: "uint256" },
              { name: "slippageP", type: "uint256" },
              { name: "block", type: "uint256" },
            ],
          },
          { name: "liquidationPrice", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getLongShortRatios",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "longRatio", type: "uint256[]" },
      { name: "shortRatio", type: "uint256[]" },
    ],
  },
  {
    name: "getMargins",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "rolloverFeePerBlockP", type: "uint256[]" },
      { name: "rolloverFeePerBlockLong", type: "uint256[]" },
      { name: "rolloverFeePerBlockShort", type: "uint256[]" },
    ],
  },
] as const;

// ============================================================================
// Multicall3 ABI (standard)
// ============================================================================

export const MULTICALL3_ABI = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
  {
    name: "tryAggregate",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "requireSuccess", type: "bool" },
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

// ============================================================================
// Trading Storage ABI
// ============================================================================

export const TRADING_STORAGE_ABI = [
  {
    name: "openTrades",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "trader", type: "address" },
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "trader", type: "address" },
          { name: "pairIndex", type: "uint256" },
          { name: "index", type: "uint256" },
          { name: "initialPosToken", type: "uint256" },
          { name: "positionSizeUsdc", type: "uint256" },
          { name: "openPrice", type: "uint256" },
          { name: "buy", type: "bool" },
          { name: "leverage", type: "uint256" },
          { name: "tp", type: "uint256" },
          { name: "sl", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "openTradesInfo",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "trader", type: "address" },
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "tokenPriceUsdc", type: "uint256" },
          { name: "openInterestUsdc", type: "uint256" },
          { name: "tpLastUpdated", type: "uint256" },
          { name: "slLastUpdated", type: "uint256" },
          { name: "beingMarketClosed", type: "bool" },
          { name: "lossProtectionPercentage", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "openLimitOrders",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "trader", type: "address" },
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "trader", type: "address" },
          { name: "pairIndex", type: "uint256" },
          { name: "index", type: "uint256" },
          { name: "positionSize", type: "uint256" },
          { name: "spreadReductionP", type: "uint256" },
          { name: "buy", type: "bool" },
          { name: "leverage", type: "uint256" },
          { name: "tp", type: "uint256" },
          { name: "sl", type: "uint256" },
          { name: "minPrice", type: "uint256" },
          { name: "maxPrice", type: "uint256" },
          { name: "block", type: "uint256" },
          { name: "tokenId", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "openTradesCount",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "trader", type: "address" },
      { name: "pairIndex", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "openLimitOrdersCount",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "trader", type: "address" },
      { name: "pairIndex", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "pairsCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "maxTradesPerPair",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "USDC",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

// ============================================================================
// Trading ABI
// ============================================================================

export const TRADING_ABI = [
  {
    name: "openTrade",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "t",
        type: "tuple",
        components: [
          { name: "trader", type: "address" },
          { name: "pairIndex", type: "uint256" },
          { name: "index", type: "uint256" },
          { name: "initialPosToken", type: "uint256" },
          { name: "positionSizeUsdc", type: "uint256" },
          { name: "openPrice", type: "uint256" },
          { name: "buy", type: "bool" },
          { name: "leverage", type: "uint256" },
          { name: "tp", type: "uint256" },
          { name: "sl", type: "uint256" },
        ],
      },
      { name: "orderType", type: "uint8" },
      { name: "slippageP", type: "uint256" },
      { name: "priceUpdateData", type: "bytes[]" },
    ],
    outputs: [],
  },
  {
    name: "closeTradeMarket",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
      { name: "priceUpdateData", type: "bytes[]" },
    ],
    outputs: [],
  },
  {
    name: "cancelOpenLimitOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "updateTp",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
      { name: "newTp", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "updateSl",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
      { name: "newSl", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "updateMargin",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
      { name: "collateralDelta", type: "uint256" },
      { name: "leverageUpdate", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "executionFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ============================================================================
// Pair Infos ABI
// ============================================================================

export const PAIR_INFOS_ABI = [
  {
    name: "pairs",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pairIndex", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "from", type: "string" },
          { name: "to", type: "string" },
          {
            name: "feed",
            type: "tuple",
            components: [
              { name: "maxDeviationP", type: "uint256" },
              { name: "feedId", type: "bytes32" },
            ],
          },
          {
            name: "backupFeed",
            type: "tuple",
            components: [
              { name: "linkFeed", type: "address" },
              { name: "api3Feed", type: "address" },
            ],
          },
          { name: "spreadP", type: "uint256" },
          { name: "priceImpactParameter", type: "uint256" },
          { name: "skewImpactParameter", type: "uint256" },
          { name: "groupIndex", type: "uint256" },
          { name: "feeIndex", type: "uint256" },
          {
            name: "leverages",
            type: "tuple",
            components: [
              { name: "minLeverage", type: "uint256" },
              { name: "maxLeverage", type: "uint256" },
            ],
          },
          {
            name: "values",
            type: "tuple",
            components: [
              { name: "maxGainP", type: "uint256" },
              { name: "maxSlP", type: "uint256" },
              { name: "maxOIP", type: "uint256" },
              { name: "usdcAlignment", type: "uint256" },
            ],
          },
          { name: "tierThresholds", type: "uint256[]" },
          { name: "tierTimers", type: "uint256[]" },
        ],
      },
    ],
  },
  {
    name: "pairData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pairIndex", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "longOI", type: "uint256" },
          { name: "shortOI", type: "uint256" },
          { name: "oiLimit", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "pairsCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "groupOI",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "groupIndex", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "groupOILimit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "groupIndex", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "pairOI",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "pairOILimit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pairIndex", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ============================================================================
// Borrowing Fees ABI
// ============================================================================

export const BORROWING_FEES_ABI = [
  {
    name: "getTradeBorrowingFee",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "trader", type: "address" },
      { name: "pairIndex", type: "uint256" },
      { name: "index", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "pairHourlyBorrowingFee",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "pairBaseFeeParameter",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pairIndex", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ============================================================================
// Price Aggregator ABI
// ============================================================================

export const PRICE_AGGREGATOR_ABI = [
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pairIndex", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getPriceWithPrecision",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "precision", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ============================================================================
// Referral ABI
// ============================================================================

export const REFERRAL_ABI = [
  {
    name: "referrerByTrader",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "referralTiers",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "referrer", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ============================================================================
// Trading Callbacks ABI
// ============================================================================

export const TRADING_CALLBACKS_ABI = [
  {
    name: "getLossProtectionTier",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "positionSize", type: "uint256" },
      { name: "leverage", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getLossProtectionPercentage",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tier", type: "uint256" },
      { name: "pairIndex", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getOpeningFee",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "positionSize", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getClosingFee",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "positionSize", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ============================================================================
// Price Impact Utils ABI
// ============================================================================

export const PRICE_IMPACT_UTILS_ABI = [
  {
    name: "getPriceImpactSpread",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "positionSize", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getSkewImpactSpread",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pairIndex", type: "uint256" },
      { name: "positionSize", type: "uint256" },
      { name: "long", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getOnePercentDepth",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pairIndex", type: "uint256" }],
    outputs: [
      { name: "above", type: "uint256" },
      { name: "below", type: "uint256" },
    ],
  },
] as const;

// ============================================================================
// Export all ABIs
// ============================================================================

export const ABIS = {
  erc20: ERC20_ABI,
  multicall3: MULTICALL3_ABI,
  tradingStorage: TRADING_STORAGE_ABI,
  trading: TRADING_ABI,
  pairInfos: PAIR_INFOS_ABI,
  borrowingFees: BORROWING_FEES_ABI,
  priceAggregator: PRICE_AGGREGATOR_ABI,
  referral: REFERRAL_ABI,
  tradingCallbacks: TRADING_CALLBACKS_ABI,
  priceImpactUtils: PRICE_IMPACT_UTILS_ABI,
} as const;
