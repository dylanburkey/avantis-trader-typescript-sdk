/**
 * @fileoverview Avantis TypeScript SDK
 *
 * A comprehensive SDK for interacting with the Avantis perpetual trading
 * protocol on Base blockchain.
 *
 * @packageDocumentation
 * @module avantis-trader-sdk
 *
 * @example
 * ```typescript
 * import { TraderClient, createTraderClient } from '@avantisfi/trader-sdk';
 *
 * // Create a client with private key for signing transactions
 * const client = createTraderClient({
 *   rpcUrl: 'https://mainnet.base.org',
 *   privateKey: '0xYourPrivateKey'
 * });
 *
 * // Get pairs info
 * const pairs = await client.pairsCache.getPairsInfo();
 *
 * // Get market snapshot
 * const snapshot = await client.snapshot.getSnapshot();
 *
 * // Open a trade
 * const receipt = await client.trade.openTrade({
 *   trade: {
 *     trader: client.getSignerAddress()!,
 *     pairIndex: 0, // BTC/USD
 *     index: 0,
 *     positionSizeUsdc: 1000,
 *     openPrice: 0, // Market order
 *     buy: true, // Long
 *     leverage: 10,
 *     tp: 0, // No take profit
 *     sl: 0, // No stop loss
 *     orderType: 0, // Market
 *     slippageP: 50, // 0.5%
 *   }
 * });
 * ```
 */

// ============================================================================
// Client Exports (Primary API)
// ============================================================================

export { TraderClient, createTraderClient } from "./client/trader-client";
export type { TraderClientConfig, Contracts } from "./client/trader-client";

// ============================================================================
// Type Exports
// ============================================================================

export * from "./types";

// ============================================================================
// Contract Exports
// ============================================================================

export * from "./contracts";

// ============================================================================
// Utility Exports
// ============================================================================

export * from "./utils";

// ============================================================================
// Signer Exports
// ============================================================================

export * from "./signers";

// ============================================================================
// RPC Exports
// ============================================================================

export * from "./rpc";

// ============================================================================
// Feed Exports
// ============================================================================

export * from "./feed";
