/**
 * @fileoverview Trading Parameters RPC Module
 *
 * Handles fetching of trading-specific parameters including
 * loss protection, referrals, and trade-specific calculations.
 *
 * @module rpc/trading-parameters
 */

import { type PublicClient, type Address } from "viem";
import {
  TRADING_CALLBACKS_ADDRESS,
  REFERRAL_ADDRESS,
} from "../contracts/config";
import { TRADING_CALLBACKS_ABI, REFERRAL_ABI } from "../contracts/abis";
import type { TradeInput, LossProtectionInfo, TradeInfo } from "../types";
import type { PairsCache } from "./pairs-cache";
import { toUsdcUnits } from "../utils";
import type { TraderClient } from "../client/trader-client";

// ============================================================================
// Trading Parameters RPC Class
// ============================================================================

/**
 * Fetches trading-specific parameters from the Avantis protocol
 *
 * @example
 * ```typescript
 * // Get loss protection for a trade
 * const lossProtection = await client.tradingParameters.getLossProtectionForTradeInput(trade, openingFee);
 *
 * // Get referral rebate
 * const rebate = await client.tradingParameters.getTradeReferralRebatePercentage(traderAddress);
 * ```
 */
export class TradingParametersRPC {
  private publicClient: PublicClient;
  private pairsCache: PairsCache;

  /**
   * Create a new TradingParametersRPC
   * @param client - TraderClient instance
   */
  constructor(client: TraderClient) {
    this.publicClient = client.publicClient;
    this.pairsCache = client.pairsCache;
  }

  /**
   * Get loss protection percentage for a trade
   * @param trade - Trade info or trade input
   */
  async getLossProtectionPercentage(
    trade: TradeInfo | TradeInput,
  ): Promise<number> {
    const tier = await this.getLossProtectionTier(trade);
    return this.getLossProtectionPercentageByTier(tier, trade.pairIndex);
  }

  /**
   * Get loss protection percentage by tier and pair
   * @param tier - Loss protection tier (0-3)
   * @param pairIndex - Pair index
   */
  async getLossProtectionPercentageByTier(
    tier: number,
    pairIndex: number,
  ): Promise<number> {
    try {
      const percentage = await this.publicClient.readContract({
        address: TRADING_CALLBACKS_ADDRESS,
        abi: TRADING_CALLBACKS_ABI,
        functionName: "getLossProtectionPercentage",
        args: [BigInt(tier), BigInt(pairIndex)],
      });

      return Number(percentage);
    } catch {
      // Fallback logic based on pair and tier
      // Pairs 0-1 (major crypto) with tiers 1-3 get 20%
      // Other pairs with tier 1+ get 10%
      if (pairIndex <= 1 && tier >= 1 && tier <= 3) {
        return 20;
      }
      if (tier >= 1) {
        return 10;
      }
      return 0;
    }
  }

  /**
   * Get loss protection tier for a trade
   * @param trade - Trade info or trade input
   */
  async getLossProtectionTier(trade: TradeInfo | TradeInput): Promise<number> {
    // Both TradeInfo and TradeInput have positionSizeUsdc
    const positionSize = trade.positionSizeUsdc;
    // Both have buy property
    const isLong = trade.buy;

    try {
      const tier = await this.publicClient.readContract({
        address: TRADING_CALLBACKS_ADDRESS,
        abi: TRADING_CALLBACKS_ABI,
        functionName: "getLossProtectionTier",
        args: [
          BigInt(trade.pairIndex),
          toUsdcUnits(positionSize),
          BigInt(trade.leverage),
          isLong,
        ],
      });

      return Number(tier);
    } catch {
      return 0;
    }
  }

  /**
   * Get loss protection info for a trade input
   * @param trade - Trade input parameters
   * @param openingFeeUsdc - Opening fee in USDC
   */
  async getLossProtectionForTradeInput(
    trade: TradeInput,
    openingFeeUsdc: number,
  ): Promise<LossProtectionInfo> {
    const percentage = await this.getLossProtectionPercentage(trade);
    const collateral = trade.positionSizeUsdc / trade.leverage;
    const effectiveCollateral = collateral - openingFeeUsdc;
    const amountUsdc = (effectiveCollateral * percentage) / 100;

    return {
      percentage,
      amountUsdc,
    };
  }

  /**
   * Get referral rebate percentage for a trader
   * @param trader - Trader address
   */
  async getTradeReferralRebatePercentage(trader: Address): Promise<number> {
    try {
      const referrer = await this.getReferrerByTrader(trader);

      if (!referrer) {
        return 0;
      }

      const tier = await this.publicClient.readContract({
        address: REFERRAL_ADDRESS,
        abi: REFERRAL_ABI,
        functionName: "referralTiers",
        args: [referrer],
      });

      // Rebate percentages by tier
      const rebateByTier: Record<number, number> = {
        0: 0,
        1: 5,
        2: 10,
        3: 15,
      };

      return rebateByTier[Number(tier)] || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get referrer address for a trader
   * @param trader - Trader address
   */
  async getReferrerByTrader(trader: Address): Promise<Address | null> {
    try {
      const referrer = await this.publicClient.readContract({
        address: REFERRAL_ADDRESS,
        abi: REFERRAL_ABI,
        functionName: "referrerByTrader",
        args: [trader],
      });

      const referrerAddress = referrer as Address;

      // Check if zero address (no referrer)
      if (referrerAddress === "0x0000000000000000000000000000000000000000") {
        return null;
      }

      return referrerAddress;
    } catch {
      return null;
    }
  }

  /**
   * Get the pairs cache instance
   */
  getPairsCache(): PairsCache {
    return this.pairsCache;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new TradingParametersRPC instance
 * @param client - TraderClient instance
 * @returns TradingParametersRPC instance
 */
export function createTradingParametersRPC(
  client: TraderClient,
): TradingParametersRPC {
  return new TradingParametersRPC(client);
}
