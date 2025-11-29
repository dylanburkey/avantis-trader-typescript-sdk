/**
 * @fileoverview Fee Parameters RPC Module
 *
 * Handles fetching of fee-related parameters including margin fees,
 * spreads, opening fees, and closing fees.
 *
 * @module rpc/fee-parameters
 */

import { type PublicClient, type Address } from "viem";
import {
  BORROWING_FEES_ADDRESS,
  REFERRAL_ADDRESS,
  TRADING_CALLBACKS_ADDRESS,
} from "../contracts/config";
import {
  BORROWING_FEES_ABI,
  REFERRAL_ABI,
  TRADING_CALLBACKS_ABI,
} from "../contracts/abis";
import type { MarginFee, Fee, PairSpread, TradeInput } from "../types";
import type { PairsCache } from "./pairs-cache";
import { toUsdcUnits, calculateFeeUsdc } from "../utils";
import type { TraderClient } from "../client/trader-client";

// ============================================================================
// Fee Parameters RPC Class
// ============================================================================

/**
 * Fetches fee-related parameters from the Avantis protocol
 *
 * @example
 * ```typescript
 * // Get margin fees for all pairs
 * const marginFees = await client.feeParameters.getMarginFee();
 *
 * // Get opening fee for a specific trade
 * const fee = await client.feeParameters.getOpeningFee({ pairIndex: 0, positionSize: 1000 });
 * ```
 */
export class FeeParametersRPC {
  private publicClient: PublicClient;
  private pairsCache: PairsCache;

  /**
   * Create a new FeeParametersRPC
   * @param client - TraderClient instance
   */
  constructor(client: TraderClient) {
    this.publicClient = client.publicClient;
    this.pairsCache = client.pairsCache;
  }

  /**
   * Get margin fee for all pairs
   */
  async getMarginFee(): Promise<Map<number, MarginFee>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const marginFees = new Map<number, MarginFee>();

    for (const [pairIndex] of pairs) {
      const [baseFee, longFee, shortFee] = await Promise.all([
        this.publicClient.readContract({
          address: BORROWING_FEES_ADDRESS,
          abi: BORROWING_FEES_ABI,
          functionName: "pairBaseFeeParameter",
          args: [BigInt(pairIndex)],
        }),
        this.publicClient.readContract({
          address: BORROWING_FEES_ADDRESS,
          abi: BORROWING_FEES_ABI,
          functionName: "pairHourlyBorrowingFee",
          args: [BigInt(pairIndex), true],
        }),
        this.publicClient.readContract({
          address: BORROWING_FEES_ADDRESS,
          abi: BORROWING_FEES_ABI,
          functionName: "pairHourlyBorrowingFee",
          args: [BigInt(pairIndex), false],
        }),
      ]);

      marginFees.set(pairIndex, {
        hourlyBaseFeeParameter: Number(baseFee),
        longBps: Number(longFee),
        shortBps: Number(shortFee),
      });
    }

    return marginFees;
  }

  /**
   * Get margin fee for a specific pair
   * @param pairIndex - Pair index
   */
  async getPairMarginFee(pairIndex: number): Promise<MarginFee> {
    const [baseFee, longFee, shortFee] = await Promise.all([
      this.publicClient.readContract({
        address: BORROWING_FEES_ADDRESS,
        abi: BORROWING_FEES_ABI,
        functionName: "pairBaseFeeParameter",
        args: [BigInt(pairIndex)],
      }),
      this.publicClient.readContract({
        address: BORROWING_FEES_ADDRESS,
        abi: BORROWING_FEES_ABI,
        functionName: "pairHourlyBorrowingFee",
        args: [BigInt(pairIndex), true],
      }),
      this.publicClient.readContract({
        address: BORROWING_FEES_ADDRESS,
        abi: BORROWING_FEES_ABI,
        functionName: "pairHourlyBorrowingFee",
        args: [BigInt(pairIndex), false],
      }),
    ]);

    return {
      hourlyBaseFeeParameter: Number(baseFee),
      longBps: Number(longFee),
      shortBps: Number(shortFee),
    };
  }

  /**
   * Get pair spread for all pairs
   */
  async getPairSpread(): Promise<Map<number, PairSpread>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const spreads = new Map<number, PairSpread>();

    for (const [pairIndex, pairInfo] of pairs) {
      spreads.set(pairIndex, {
        pairIndex,
        spreadBps: pairInfo.spreadP,
      });
    }

    return spreads;
  }

  /**
   * Get opening fee
   * @param options - Options for calculating opening fee
   */
  async getOpeningFee(options: {
    positionSize?: number;
    isLong?: boolean;
    pairIndex?: number;
    pair?: string | number;
    tradeInput?: TradeInput;
  }): Promise<Fee | number> {
    // If tradeInput is provided, calculate full USDC fee with referral
    if (options.tradeInput) {
      return this.calculateOpeningFeeUsdc(options.tradeInput);
    }

    // Otherwise, return fee in bps
    let pairIndex: number;
    if (options.pair !== undefined) {
      const pairInfo = await this.pairsCache.getPairInfo(options.pair);
      pairIndex = pairInfo.pairIndex;
    } else if (options.pairIndex !== undefined) {
      pairIndex = options.pairIndex;
    } else {
      throw new Error("Either pair, pairIndex, or tradeInput must be provided");
    }

    const positionSize = options.positionSize || 1000; // Default $1000

    const [longFee, shortFee] = await Promise.all([
      this.publicClient.readContract({
        address: TRADING_CALLBACKS_ADDRESS,
        abi: TRADING_CALLBACKS_ABI,
        functionName: "getOpeningFee",
        args: [BigInt(pairIndex), toUsdcUnits(positionSize), true],
      }),
      this.publicClient.readContract({
        address: TRADING_CALLBACKS_ADDRESS,
        abi: TRADING_CALLBACKS_ABI,
        functionName: "getOpeningFee",
        args: [BigInt(pairIndex), toUsdcUnits(positionSize), false],
      }),
    ]);

    return {
      long: Number(longFee),
      short: Number(shortFee),
    };
  }

  /**
   * Calculate opening fee in USDC with referral rebate
   * @param tradeInput - Trade input parameters
   */
  private async calculateOpeningFeeUsdc(
    tradeInput: TradeInput,
  ): Promise<number> {
    const feeBps = await this.publicClient.readContract({
      address: TRADING_CALLBACKS_ADDRESS,
      abi: TRADING_CALLBACKS_ABI,
      functionName: "getOpeningFee",
      args: [
        BigInt(tradeInput.pairIndex),
        toUsdcUnits(tradeInput.positionSizeUsdc),
        tradeInput.buy,
      ],
    });

    const baseFee = calculateFeeUsdc(
      tradeInput.positionSizeUsdc,
      Number(feeBps),
    );

    // Apply referral rebate if applicable
    const rebatePercentage = await this.getReferralRebatePercentage(
      tradeInput.trader,
    );
    const rebate = (baseFee * rebatePercentage) / 100;

    return baseFee - rebate;
  }

  /**
   * Get referral rebate percentage for a trader
   * @param trader - Trader address
   */
  private async getReferralRebatePercentage(trader: Address): Promise<number> {
    try {
      const referrer = await this.publicClient.readContract({
        address: REFERRAL_ADDRESS,
        abi: REFERRAL_ABI,
        functionName: "referrerByTrader",
        args: [trader],
      });

      // If no referrer, no rebate
      if (referrer === "0x0000000000000000000000000000000000000000") {
        return 0;
      }

      const tier = await this.publicClient.readContract({
        address: REFERRAL_ADDRESS,
        abi: REFERRAL_ABI,
        functionName: "referralTiers",
        args: [referrer as Address],
      });

      // Rebate percentages by tier (example values)
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
   * Get closing fee
   * @param pairIndex - Pair index
   * @param positionSize - Position size in USDC
   * @param isLong - True for long positions
   */
  async getClosingFee(
    pairIndex: number,
    positionSize: number,
    isLong: boolean,
  ): Promise<number> {
    const fee = await this.publicClient.readContract({
      address: TRADING_CALLBACKS_ADDRESS,
      abi: TRADING_CALLBACKS_ABI,
      functionName: "getClosingFee",
      args: [BigInt(pairIndex), toUsdcUnits(positionSize), isLong],
    });

    return Number(fee);
  }

  /**
   * Get trade referral rebate percentage
   * @param trader - Trader address
   */
  async getTradeReferralRebatePercentage(trader: Address): Promise<number> {
    return this.getReferralRebatePercentage(trader);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FeeParametersRPC instance
 * @param client - TraderClient instance
 * @returns FeeParametersRPC instance
 */
export function createFeeParametersRPC(client: TraderClient): FeeParametersRPC {
  return new FeeParametersRPC(client);
}
