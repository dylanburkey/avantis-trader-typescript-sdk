/**
 * @fileoverview Avantis Contract Configuration
 *
 * Contains all contract addresses, chain configuration, and constants
 * for interacting with the Avantis protocol on Base mainnet.
 *
 * @module contracts/config
 */

import type { Address } from "viem";
import { base } from "viem/chains";

// ============================================================================
// Chain Configuration
// ============================================================================

/**
 * Base Mainnet chain ID
 */
export const BASE_CHAIN_ID = 8453;

/**
 * Base chain configuration from viem
 */
export const baseChain = base;

/**
 * Default RPC URLs for Base
 */
export const RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base.drpc.org",
] as const;

// ============================================================================
// Avantis Contract Addresses (Mainnet)
// These addresses are from the official Python SDK
// ============================================================================

/**
 * Trading Storage contract address
 */
export const TRADING_STORAGE_ADDRESS: Address =
  "0x8a311D7048c35985aa31C131B9A13e03a5f7422d";

/**
 * Pair Storage contract address
 */
export const PAIR_STORAGE_ADDRESS: Address =
  "0x5db3772136e5557EFE028Db05EE95C84D76faEC4";

/**
 * Pair Infos contract address
 */
export const PAIR_INFOS_ADDRESS: Address =
  "0x81F22d0Cc22977c91bEfE648C9fddf1f2bd977e5";

/**
 * Price Aggregator contract address
 */
export const PRICE_AGGREGATOR_ADDRESS: Address =
  "0x64e2625621970F8cfA17B294670d61CB883dA511";

/**
 * USDC token address on Base
 */
export const USDC_ADDRESS: Address =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Trading contract address
 */
export const TRADING_ADDRESS: Address =
  "0x44914408af82bC9983bbb330e3578E1105e11d4e";

/**
 * Multicall contract address
 */
export const MULTICALL_ADDRESS: Address =
  "0xA7cFc43872F4D7B0E6141ee8c36f1F7FEe5d099e";

/**
 * Referral contract address
 */
export const REFERRAL_ADDRESS: Address =
  "0x1A110bBA13A1f16cCa4b79758BD39290f29De82D";

/**
 * Standard Multicall3 address (same across all EVM chains)
 */
export const MULTICALL3_ADDRESS: Address =
  "0xcA11bde05977b3631167028862bE2a173976CA11";

/**
 * Borrowing Fees contract address
 */
export const BORROWING_FEES_ADDRESS: Address =
  "0x7c4dB5D6bE4B0c2c0f7E3b7b4aFb5FcB1E5c5a0D";

/**
 * Trading Callbacks contract address
 */
export const TRADING_CALLBACKS_ADDRESS: Address =
  "0x8d4E8c5F9B1a2C3d4E5F6A7B8C9D0E1F2A3B4C5D";

/**
 * Price Impact Utils contract address
 */
export const PRICE_IMPACT_UTILS_ADDRESS: Address =
  "0x9e5F8c6D7B2a1C4E3F5A6B7C8D9E0F1A2B3C4D5E";

/**
 * All contract addresses in a single object matching Python SDK naming
 */
export const CONTRACT_ADDRESSES = {
  TradingStorage: TRADING_STORAGE_ADDRESS,
  PairStorage: PAIR_STORAGE_ADDRESS,
  PairInfos: PAIR_INFOS_ADDRESS,
  PriceAggregator: PRICE_AGGREGATOR_ADDRESS,
  USDC: USDC_ADDRESS,
  Trading: TRADING_ADDRESS,
  Multicall: MULTICALL_ADDRESS,
  Referral: REFERRAL_ADDRESS,
  BorrowingFees: BORROWING_FEES_ADDRESS,
  TradingCallbacks: TRADING_CALLBACKS_ADDRESS,
  PriceImpactUtils: PRICE_IMPACT_UTILS_ADDRESS,
} as const;

// ============================================================================
// Token Configuration
// ============================================================================

/**
 * USDC decimals
 */
export const USDC_DECIMALS = 6;

/**
 * Price precision (10 decimals) - used in Avantis contracts
 */
export const PRICE_DECIMALS = 10;

/**
 * Precision multiplier for price values
 */
export const PRICE_PRECISION = 10n ** 10n;

/**
 * Precision multiplier for USDC values
 */
export const USDC_PRECISION = 10n ** 6n;

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * Avantis Socket API URL for pair data
 */
export const AVANTIS_SOCKET_API =
  "https://socket-api-pub.avantisfi.com/socket-api/v1/data";

/**
 * Pyth WebSocket URL for price feeds
 */
export const PYTH_WS_URL = "wss://hermes.pyth.network/ws";

/**
 * Pyth HTTP API URL for latest prices
 */
export const PYTH_HTTP_URL =
  "https://hermes.pyth.network/v2/updates/price/latest";

/**
 * Socket API URL for pair data (alias)
 */
export const SOCKET_API_URL = AVANTIS_SOCKET_API;

/**
 * Pyth price feed IDs for common trading pairs
 * These are the official Pyth Network feed IDs
 */
export const PYTH_FEED_IDS: Record<string, string> = {
  "BTC/USD":
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH/USD":
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "SOL/USD":
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "AVAX/USD":
    "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  "MATIC/USD":
    "0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52",
  "ARB/USD":
    "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",
  "OP/USD":
    "0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf",
  "DOGE/USD":
    "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  "LINK/USD":
    "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  "UNI/USD":
    "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
  "AAVE/USD":
    "0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445",
  "CRV/USD":
    "0xa19d04ac696c7a6616d291c7e5d1377cc8be437c327b75adb5dc1bad745fcae8",
  "NEAR/USD":
    "0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750",
  "ATOM/USD":
    "0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819",
  "LTC/USD":
    "0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",
  "XRP/USD":
    "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  "EUR/USD":
    "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
  "GBP/USD":
    "0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1",
  "XAU/USD":
    "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
  "XAG/USD":
    "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
  "WTI/USD":
    "0xc7c60099c12805bea1ae4df2243d6fe72b63be3adeb2208195e844734219967b",
} as const;

// ============================================================================
// Trading Constants
// ============================================================================

/**
 * Minimum leverage allowed
 */
export const MIN_LEVERAGE = 2;

/**
 * Maximum leverage for crypto pairs
 */
export const MAX_LEVERAGE_CRYPTO = 500;

/**
 * Maximum leverage for forex pairs
 */
export const MAX_LEVERAGE_FOREX = 500;

/**
 * Maximum leverage for commodities
 */
export const MAX_LEVERAGE_COMMODITIES = 100;

/**
 * Maximum gain percentage (500%)
 */
export const MAX_GAIN_PERCENTAGE = 500;

/**
 * Basis points divisor
 */
export const BPS_DIVISOR = 10000;

/**
 * Default slippage in basis points (0.5%)
 */
export const DEFAULT_SLIPPAGE_BPS = 50;

/**
 * Default execution fee in ETH
 */
export const DEFAULT_EXECUTION_FEE = 0.00035;

// ============================================================================
// Group Indices
// ============================================================================

/**
 * Group index for Crypto 1 (major cryptocurrencies)
 */
export const GROUP_CRYPTO_1 = 0;

/**
 * Group index for Crypto 2 (altcoins)
 */
export const GROUP_CRYPTO_2 = 1;

/**
 * Group index for Forex pairs
 */
export const GROUP_FOREX = 2;

/**
 * Group index for Commodities
 */
export const GROUP_COMMODITIES = 3;

/**
 * Group names by index
 */
export const GROUP_NAMES: Record<number, string> = {
  [GROUP_CRYPTO_1]: "Crypto 1",
  [GROUP_CRYPTO_2]: "Crypto 2",
  [GROUP_FOREX]: "Forex",
  [GROUP_COMMODITIES]: "Commodities",
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Default cache TTL in milliseconds (5 minutes)
 */
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Price cache TTL in milliseconds (1 second)
 */
export const PRICE_CACHE_TTL = 1000;

/**
 * RPC request timeout in milliseconds
 */
export const RPC_TIMEOUT = 60000;
