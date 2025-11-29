/**
 * Avantis TypeScript SDK - Type Definitions
 * 
 * This module contains all TypeScript interfaces and types that mirror
 * the Python SDK's Pydantic models for type-safe interaction with the
 * Avantis trading protocol.
 */

import type { Address, Hash, Hex } from 'viem';

// ============================================================================
// Enums
// ============================================================================

/**
 * Type of margin update operation
 */
export enum MarginUpdateType {
  /** Add collateral to position */
  DEPOSIT = 0,
  /** Remove collateral from position */
  WITHDRAW = 1,
}

/**
 * Type of trade order
 */
export enum TradeInputOrderType {
  /** Execute at current market price */
  MARKET = 0,
  /** Execute when price reaches stop price, then limit */
  STOP_LIMIT = 1,
  /** Execute at specified limit price or better */
  LIMIT = 2,
  /** Market order with zero execution fee */
  MARKET_ZERO_FEE = 3,
}

// ============================================================================
// Basic Market Data Types
// ============================================================================

/**
 * Single depth value for one side of the order book
 */
export interface DepthSingle {
  /** Depth value in USDC */
  depth: number;
}

/**
 * Market depth for both sides
 */
export interface Depth {
  /** Depth above current price */
  above: number;
  /** Depth below current price */
  below: number;
}

/**
 * Fee structure with long/short rates
 */
export interface Fee {
  /** Fee for long positions in basis points */
  long: number;
  /** Fee for short positions in basis points */
  short: number;
}

/**
 * Spread value in basis points
 */
export interface Spread {
  /** Spread value in basis points */
  bps: number;
}

/**
 * Pair-specific spread information
 */
export interface PairSpread {
  /** Pair index */
  pairIndex: number;
  /** Spread in basis points */
  spreadBps: number;
}

/**
 * Market skew information
 */
export interface Skew {
  /** Skew percentage (50 = balanced, >50 = more longs, <50 = more shorts) */
  skew: number;
}

/**
 * Utilization percentage
 */
export interface Utilization {
  /** Utilization as percentage of OI limit */
  utilization: number;
}

// ============================================================================
// Open Interest Types
// ============================================================================

/**
 * Open interest for a trading pair
 */
export interface OpenInterest {
  /** Long open interest in USDC */
  long: number;
  /** Short open interest in USDC */
  short: number;
}

/**
 * Open interest limits
 */
export interface OpenInterestLimits {
  /** Maximum allowed open interest in USDC */
  limit: number;
}

// ============================================================================
// Margin Fee Types
// ============================================================================

/**
 * Single margin fee value
 */
export interface MarginFeeSingle {
  /** Fee in basis points */
  bps: number;
}

/**
 * Complete margin fee structure for a pair
 */
export interface MarginFee {
  /** Hourly base fee parameter */
  hourlyBaseFeeParameter: number;
  /** Long position margin fee in basis points */
  longBps: number;
  /** Short position margin fee in basis points */
  shortBps: number;
}

// ============================================================================
// Pair Information Types
// ============================================================================

/**
 * Primary price feed information for a pair
 */
export interface PairInfoFeed {
  /** Maximum allowed deviation from oracle price */
  maxDeviationP: number;
  /** Pyth price feed ID */
  feedId: Hex;
}

/**
 * Backup price feed information
 */
export interface PairInfoBackupFeed {
  /** Chainlink feed address */
  linkFeed: Address;
  /** API3 feed address */
  api3Feed: Address;
}

/**
 * Leverage limits for a pair
 */
export interface PairInfoLeverages {
  /** Minimum leverage allowed */
  minLeverage: number;
  /** Maximum leverage allowed */
  maxLeverage: number;
}

/**
 * Pair-specific parameter values
 */
export interface PairInfoValues {
  /** Maximum gain percentage (e.g., 500 = 500%) */
  maxGainP: number;
  /** Maximum stop loss percentage */
  maxSlP: number;
  /** Maximum open interest percentage relative to limit */
  maxOIP: number;
  /** USDC alignment value */
  usdcAlignment: number;
}

/**
 * Core pair information from contract
 */
export interface PairInfo {
  /** Trading pair name (e.g., "ETH/USD") */
  name: string;
  /** Pair index in the contract */
  pairIndex: number;
  /** Group index (0=crypto1, 1=crypto2, 2=forex, 3=commodities) */
  groupIndex: number;
  /** Fee index for this pair */
  feeIndex: number;
  /** Primary price feed configuration */
  feed: PairInfoFeed;
  /** Backup price feed configuration */
  backupFeed: PairInfoBackupFeed;
  /** Spread configuration */
  spreadP: number;
  /** Price impact parameter */
  priceImpactParameter: number;
  /** Skew impact parameter */
  skewImpactParameter: number;
  /** Leverage limits */
  leverages: PairInfoLeverages;
  /** Pair-specific values */
  values: PairInfoValues;
  /** Tier thresholds for loss protection */
  tierThresholds: number[];
  /** Tier timer values */
  tierTimers: number[];
}

/**
 * Dynamic pair data from contract
 */
export interface PairData {
  /** Current long open interest */
  longOI: bigint;
  /** Current short open interest */
  shortOI: bigint;
  /** Open interest limit */
  oiLimit: bigint;
}

/**
 * Combined pair info and data
 */
export interface PairInfoWithData extends PairInfo {
  /** Dynamic pair data */
  data: PairData;
}

/**
 * Extended pair information with all market data
 */
export interface PairInfoExtended extends PairInfoWithData {
  /** Asset open interest */
  assetOI: OpenInterest;
  /** Asset utilization percentage */
  assetUtilization: number;
  /** Asset skew percentage */
  assetSkew: number;
  /** Margin fee structure */
  marginFee: MarginFee;
  /** Market depth */
  depth: Depth;
  /** Price impact spread in bps */
  priceImpactSpread: Fee;
  /** Skew impact spread in bps */
  skewImpactSpread: Fee;
  /** Opening fee in bps */
  openingFee: Fee;
  /** Constant spread in bps */
  pairSpread: number;
}

// ============================================================================
// Trade Types
// ============================================================================

/**
 * Input parameters for opening a trade
 */
export interface TradeInput {
  /** Trader's wallet address */
  trader: Address;
  /** Trading pair index */
  pairIndex: number;
  /** Trade index (usually 0 for new trades) */
  index: number;
  /** Initial position margin (deprecated, use initialPosToken) */
  initialPosToken?: number;
  /** Position size in USDC */
  positionSizeUsdc: number;
  /** Open price (0 for market orders) */
  openPrice: number;
  /** True for long, false for short */
  buy: boolean;
  /** Leverage multiplier */
  leverage: number;
  /** Take profit price (0 for none) */
  tp: number;
  /** Stop loss price (0 for none) */
  sl: number;
  /** Order type */
  orderType: TradeInputOrderType;
  /** Slippage tolerance in basis points */
  slippageP: number;
  /** Execution timestamp */
  executionTimestamp?: number;
}

/**
 * Serialized trade input for contract calls
 */
export interface TradeInputSerialized {
  trader: Address;
  pairIndex: bigint;
  index: bigint;
  initialPosToken: bigint;
  positionSizeUsdc: bigint;
  openPrice: bigint;
  buy: boolean;
  leverage: bigint;
  tp: bigint;
  sl: bigint;
  orderType: number;
}

/**
 * Response from trade execution
 */
export interface TradeResponse {
  /** Transaction hash */
  txHash: Hash;
  /** Whether trade was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Information about an open trade
 */
export interface TradeInfo {
  /** Trade ID */
  id: string;
  /** Trader address */
  trader: Address;
  /** Pair index */
  pairIndex: number;
  /** Trade index for this pair */
  index: number;
  /** Position size in USDC */
  positionSizeUsdc: number;
  /** Open price */
  openPrice: number;
  /** True for long */
  buy: boolean;
  /** Leverage */
  leverage: number;
  /** Take profit price */
  tp: number;
  /** Stop loss price */
  sl: number;
  /** Timestamp when opened */
  openTimestamp: number;
  /** Trade type (0=market, 1=limit) */
  tradeType: number;
}

/**
 * Extended trade response with full details
 */
export interface TradeExtendedResponse extends TradeInfo {
  /** Current unrealized PnL */
  unrealizedPnl: number;
  /** Current unrealized PnL percentage */
  unrealizedPnlPercentage: number;
  /** Liquidation price */
  liquidationPrice: number;
  /** Current market price */
  currentPrice: number;
  /** Accrued margin fee */
  accruedMarginFee: number;
}

/**
 * Pending limit order information
 */
export interface PendingLimitOrderResponse {
  /** Order ID */
  id: string;
  /** Trader address */
  trader: Address;
  /** Pair index */
  pairIndex: number;
  /** Order index */
  index: number;
  /** Position size in USDC */
  positionSizeUsdc: number;
  /** Limit price */
  openPrice: number;
  /** True for long */
  buy: boolean;
  /** Leverage */
  leverage: number;
  /** Take profit price */
  tp: number;
  /** Stop loss price */
  sl: number;
  /** Min price for stop limit orders */
  minPrice: number;
  /** Max price for stop limit orders */
  maxPrice: number;
}

/**
 * Extended pending limit order with current market data
 */
export interface PendingLimitOrderExtendedResponse extends PendingLimitOrderResponse {
  /** Current market price */
  currentPrice: number;
  /** Distance to limit price in percentage */
  distanceToLimitPercentage: number;
}

// ============================================================================
// Loss Protection Types
// ============================================================================

/**
 * Loss protection tier information
 */
export interface LossProtectionInfo {
  /** Loss protection percentage */
  percentage: number;
  /** Loss protection amount in USDC */
  amountUsdc: number;
}

// ============================================================================
// Price Feed Types
// ============================================================================

/**
 * Single price feed response
 */
export interface PriceFeedResponse {
  /** Pair index */
  pairIndex: number;
  /** Current price */
  price: number;
  /** Price timestamp */
  timestamp: number;
  /** Confidence interval */
  confidence: number;
}

/**
 * Binary price update data for Pyth
 */
export interface PriceFeesUpdateBinary {
  /** Binary encoded price data */
  data: Hex[];
  /** Update fee in wei */
  updateFee: bigint;
}

/**
 * Multiple price feed updates response
 */
export interface PriceFeedUpdatesResponse {
  /** Array of price feeds */
  prices: PriceFeedResponse[];
  /** Binary update data */
  binary: PriceFeesUpdateBinary;
}

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Open interest snapshot for a group/category
 */
export interface SnapshotOpenInterest {
  /** Long OI in USDC */
  long: number;
  /** Short OI in USDC */
  short: number;
  /** OI limit in USDC */
  limit: number;
}

/**
 * Group/category snapshot with all pairs
 */
export interface SnapshotGroup {
  /** Group open interest limit */
  groupOpenInterestLimit: number;
  /** Group open interest */
  groupOpenInterest: OpenInterest;
  /** Group utilization percentage */
  groupUtilization: number;
  /** Group skew percentage */
  groupSkew: number;
  /** Pairs in this group */
  pairs: Record<string, PairInfoExtended>;
}

/**
 * Complete market snapshot
 */
export interface Snapshot {
  /** Groups indexed by group ID */
  groups: Record<number, SnapshotGroup>;
}

/**
 * Simplified snapshot for lightweight queries
 */
export interface SimplifiedSnapshot {
  /** Pairs with basic OI data */
  pairs: Record<string, {
    openInterest: OpenInterest;
    skew: number;
  }>;
  /** Groups with basic OI data */
  groups: Record<number, {
    openInterest: OpenInterest;
    skew: number;
  }>;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction request parameters
 */
export interface TransactionRequest {
  /** Target contract address */
  to: Address;
  /** Encoded function data */
  data: Hex;
  /** Value in wei to send */
  value?: bigint;
  /** Gas limit */
  gas?: bigint;
  /** Max fee per gas */
  maxFeePerGas?: bigint;
  /** Max priority fee per gas */
  maxPriorityFeePerGas?: bigint;
}

/**
 * Transaction receipt after execution
 */
export interface TransactionReceipt {
  /** Transaction hash */
  transactionHash: Hash;
  /** Block number */
  blockNumber: bigint;
  /** Gas used */
  gasUsed: bigint;
  /** Transaction status (1 = success) */
  status: 'success' | 'reverted';
  /** Contract address if deployment */
  contractAddress?: Address;
  /** Event logs */
  logs: Array<{
    address: Address;
    topics: Hex[];
    data: Hex;
  }>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Contract configuration
 */
export interface ContractConfig {
  /** Contract address */
  address: Address;
  /** Contract ABI */
  abi: readonly unknown[];
}

/**
 * SDK configuration options
 */
export interface SDKConfig {
  /** RPC URL for Base network */
  rpcUrl: string;
  /** Private key for signing (optional) */
  privateKey?: Hex;
  /** Chain ID (default: 8453 for Base) */
  chainId?: number;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Pair to Pyth feed mapping
 */
export interface PairFeedMapping {
  /** Pair index */
  pairIndex: number;
  /** Pair name */
  pairName: string;
  /** Pyth feed ID */
  feedId: Hex;
}

// ============================================================================
// Callback Types
// ============================================================================

/**
 * Callback for price updates
 */
export type PriceUpdateCallback = (prices: PriceFeedResponse[]) => void;

/**
 * Callback for errors
 */
export type ErrorCallback = (error: Error) => void;

/**
 * Callback for connection close
 */
export type CloseCallback = (code: number, reason: string) => void;

// ============================================================================
// Re-exports from viem for convenience
// ============================================================================

export type { Address, Hash, Hex } from 'viem';
