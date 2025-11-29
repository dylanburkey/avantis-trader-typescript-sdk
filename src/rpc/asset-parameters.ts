/**
 * @fileoverview Asset Parameters RPC Module
 *
 * Handles fetching of pair-level parameters including open interest,
 * utilization, skew, and price impact spreads.
 *
 * Uses data from the Socket API (via PairsCache) for reliability.
 *
 * @module rpc/asset-parameters
 */

import type { OpenInterest, OpenInterestLimits, Fee, Depth } from "../types";
import type { PairsCache } from "./pairs-cache";
import { fromUsdcUnits } from "../utils";
import type { TraderClient } from "../client/trader-client";

// ============================================================================
// Asset Parameters RPC Class
// ============================================================================

/**
 * Fetches pair-level parameters from the Avantis protocol
 *
 * @example
 * ```typescript
 * // Get open interest for all pairs
 * const oi = await client.assetParameters.getOi();
 *
 * // Get utilization for a specific pair
 * const utilization = await client.assetParameters.getUtilization();
 * console.log(`BTC/USD utilization: ${utilization.get(0)}%`);
 * ```
 */
export class AssetParametersRPC {
  private pairsCache: PairsCache;

  /**
   * Create a new AssetParametersRPC
   * @param client - TraderClient instance
   */
  constructor(client: TraderClient) {
    this.pairsCache = client.pairsCache;
  }

  /**
   * Get open interest limits for all pairs
   * Uses data from Socket API via PairsCache
   */
  async getOiLimits(): Promise<Map<number, OpenInterestLimits>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const limits = new Map<number, OpenInterestLimits>();

    for (const [pairIndex, pairInfo] of pairs) {
      limits.set(pairIndex, {
        limit: fromUsdcUnits(pairInfo.data.oiLimit),
      });
    }

    return limits;
  }

  /**
   * Get open interest for all pairs
   * Uses data from Socket API via PairsCache
   */
  async getOi(): Promise<Map<number, OpenInterest>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const oi = new Map<number, OpenInterest>();

    for (const [pairIndex, pairInfo] of pairs) {
      oi.set(pairIndex, {
        long: fromUsdcUnits(pairInfo.data.longOI),
        short: fromUsdcUnits(pairInfo.data.shortOI),
      });
    }

    return oi;
  }

  /**
   * Get open interest for a specific pair
   * @param pairIndex - Pair index
   */
  async getPairOi(pairIndex: number): Promise<OpenInterest> {
    const pairInfo = await this.pairsCache.getPairInfo(pairIndex);

    return {
      long: fromUsdcUnits(pairInfo.data.longOI),
      short: fromUsdcUnits(pairInfo.data.shortOI),
    };
  }

  /**
   * Get OI limit for a specific pair
   * @param pairIndex - Pair index
   */
  async getPairOiLimit(pairIndex: number): Promise<OpenInterestLimits> {
    const pairInfo = await this.pairsCache.getPairInfo(pairIndex);

    return {
      limit: fromUsdcUnits(pairInfo.data.oiLimit),
    };
  }

  /**
   * Get utilization for all pairs
   * Utilization = totalOI / oiLimit * 100
   */
  async getUtilization(): Promise<Map<number, number>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const utilization = new Map<number, number>();

    for (const [pairIndex, pairInfo] of pairs) {
      const longOI = fromUsdcUnits(pairInfo.data.longOI);
      const shortOI = fromUsdcUnits(pairInfo.data.shortOI);
      const limit = fromUsdcUnits(pairInfo.data.oiLimit);

      if (limit > 0) {
        const totalOi = longOI + shortOI;
        utilization.set(pairIndex, (totalOi / limit) * 100);
      } else {
        utilization.set(pairIndex, 0);
      }
    }

    return utilization;
  }

  /**
   * Get utilization for a specific pair
   * @param pairIndex - Pair index
   */
  async getPairUtilization(pairIndex: number): Promise<number> {
    const pairInfo = await this.pairsCache.getPairInfo(pairIndex);

    const longOI = fromUsdcUnits(pairInfo.data.longOI);
    const shortOI = fromUsdcUnits(pairInfo.data.shortOI);
    const limit = fromUsdcUnits(pairInfo.data.oiLimit);

    if (limit > 0) {
      return ((longOI + shortOI) / limit) * 100;
    }
    return 0;
  }

  /**
   * Get skew for all pairs
   * Skew = longOI / totalOI * 100 (50 = balanced)
   */
  async getAssetSkew(): Promise<Map<number, number>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const skew = new Map<number, number>();

    for (const [pairIndex, pairInfo] of pairs) {
      const longOI = fromUsdcUnits(pairInfo.data.longOI);
      const shortOI = fromUsdcUnits(pairInfo.data.shortOI);
      const totalOi = longOI + shortOI;

      if (totalOi > 0) {
        skew.set(pairIndex, (longOI / totalOi) * 100);
      } else {
        skew.set(pairIndex, 50); // Default to balanced
      }
    }

    return skew;
  }

  /**
   * Get skew for a specific pair
   * @param pairIndex - Pair index
   */
  async getPairSkew(pairIndex: number): Promise<number> {
    const pairInfo = await this.pairsCache.getPairInfo(pairIndex);

    const longOI = fromUsdcUnits(pairInfo.data.longOI);
    const shortOI = fromUsdcUnits(pairInfo.data.shortOI);
    const totalOi = longOI + shortOI;

    if (totalOi > 0) {
      return (longOI / totalOi) * 100;
    }
    return 50; // Default to balanced
  }

  /**
   * Get price impact spread for a position
   * Estimated based on pair parameters and position size
   * @param positionSize - Position size in USDC
   * @param isLong - True for long positions
   * @param pair - Pair name or index
   */
  async getPriceImpactSpread(
    positionSize: number,
    _isLong: boolean,
    pair: string | number,
  ): Promise<number> {
    const pairInfo = await this.pairsCache.getPairInfo(pair);

    // Estimate price impact based on position size and multiplier
    // This is a simplified calculation - actual impact depends on depth
    const priceImpactMultiplier = pairInfo.priceImpactParameter;
    const oiLimit = fromUsdcUnits(pairInfo.data.oiLimit);

    if (oiLimit > 0) {
      const impactRatio = positionSize / oiLimit;
      return impactRatio * priceImpactMultiplier * 100; // Return in bps
    }

    return 0;
  }

  /**
   * Get skew impact spread for a position
   * Estimated based on current skew and position direction
   * @param positionSize - Position size in USDC
   * @param isLong - True for long positions
   * @param pair - Pair name or index
   */
  async getSkewImpactSpread(
    positionSize: number,
    isLong: boolean,
    pair: string | number,
  ): Promise<number> {
    const pairInfo = await this.pairsCache.getPairInfo(pair);

    const longOI = fromUsdcUnits(pairInfo.data.longOI);
    const shortOI = fromUsdcUnits(pairInfo.data.shortOI);
    const totalOi = longOI + shortOI;
    const oiLimit = fromUsdcUnits(pairInfo.data.oiLimit);
    const skewImpactMultiplier = pairInfo.skewImpactParameter;

    if (totalOi > 0 && oiLimit > 0) {
      // Calculate how much the position worsens the skew
      const currentSkew = longOI / totalOi;
      const skewDeviation = Math.abs(currentSkew - 0.5); // Distance from balanced

      // If going with the dominant side, impact is higher
      const goingWithSkew =
        (isLong && currentSkew > 0.5) || (!isLong && currentSkew < 0.5);
      const skewFactor = goingWithSkew ? skewDeviation * 2 : skewDeviation;

      // Scale by position size relative to OI limit
      const sizeImpact = positionSize / oiLimit;

      return skewFactor * skewImpactMultiplier * sizeImpact * 100; // Return in bps
    }

    return 0;
  }

  /**
   * Get combined opening price impact spread
   * @param pair - Pair name or index
   * @param positionSize - Position size in USDC
   * @param _openPrice - Open price (unused but kept for API compatibility)
   * @param _isLong - True for long positions (unused but kept for API compatibility)
   */
  async getOpeningPriceImpactSpread(
    pair: string | number,
    positionSize: number,
    _openPrice: number,
    _isLong: boolean,
  ): Promise<Fee> {
    const [priceImpactLong, priceImpactShort, skewImpactLong, skewImpactShort] =
      await Promise.all([
        this.getPriceImpactSpread(positionSize, true, pair),
        this.getPriceImpactSpread(positionSize, false, pair),
        this.getSkewImpactSpread(positionSize, true, pair),
        this.getSkewImpactSpread(positionSize, false, pair),
      ]);

    return {
      long: priceImpactLong + skewImpactLong,
      short: priceImpactShort + skewImpactShort,
    };
  }

  /**
   * Get one percent depth for a pair
   * Estimated from OI limit - actual depth requires on-chain call
   * @param pairIndex - Pair index
   */
  async getOnePercentDepth(pairIndex: number): Promise<Depth> {
    const pairInfo = await this.pairsCache.getPairInfo(pairIndex);

    // Estimate depth as a percentage of OI limit
    // This is an approximation - actual depth comes from price impact calculations
    const oiLimit = fromUsdcUnits(pairInfo.data.oiLimit);
    const estimatedDepth = oiLimit * 0.01; // 1% of limit as rough estimate

    return {
      above: estimatedDepth,
      below: estimatedDepth,
    };
  }

  /**
   * Get one percent depth for all pairs
   */
  async getAllOnePercentDepths(): Promise<Map<number, Depth>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const depths = new Map<number, Depth>();

    for (const [pairIndex] of pairs) {
      const depth = await this.getOnePercentDepth(pairIndex);
      depths.set(pairIndex, depth);
    }

    return depths;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new AssetParametersRPC instance
 * @param client - TraderClient instance
 * @returns AssetParametersRPC instance
 */
export function createAssetParametersRPC(
  client: TraderClient,
): AssetParametersRPC {
  return new AssetParametersRPC(client);
}
