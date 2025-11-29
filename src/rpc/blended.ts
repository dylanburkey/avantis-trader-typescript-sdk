/**
 * @fileoverview Blended RPC Module
 *
 * Provides blended/combined metrics across asset and category levels,
 * including weighted utilization and skew calculations.
 *
 * @module rpc/blended
 */

import type { OpenInterest } from '../types';
import type { TraderClient } from '../client/trader-client';

// ============================================================================
// Types
// ============================================================================

/**
 * Blended utilization data for a pair
 */
export interface BlendedUtilization {
  /** Asset-level utilization percentage */
  assetUtilization: number;
  /** Category-level utilization percentage */
  categoryUtilization: number;
  /** Blended utilization (weighted average) */
  blendedUtilization: number;
  /** Weight applied to asset utilization */
  assetWeight: number;
  /** Weight applied to category utilization */
  categoryWeight: number;
}

/**
 * Blended skew data for a pair
 */
export interface BlendedSkew {
  /** Asset-level skew (50 = balanced) */
  assetSkew: number;
  /** Category-level skew (50 = balanced) */
  categorySkew: number;
  /** Blended skew (weighted average) */
  blendedSkew: number;
  /** Weight applied to asset skew */
  assetWeight: number;
  /** Weight applied to category skew */
  categoryWeight: number;
}

/**
 * Complete blended metrics for a pair
 */
export interface BlendedMetrics {
  /** Pair index */
  pairIndex: number;
  /** Pair name */
  pairName: string;
  /** Group/category index */
  groupIndex: number;
  /** Asset-level open interest */
  assetOI: OpenInterest;
  /** Category-level open interest */
  categoryOI: OpenInterest;
  /** Blended utilization metrics */
  utilization: BlendedUtilization;
  /** Blended skew metrics */
  skew: BlendedSkew;
}

// ============================================================================
// Default Weights
// ============================================================================

/**
 * Default weight for asset-level metrics (70%)
 */
const DEFAULT_ASSET_WEIGHT = 0.7;

/**
 * Default weight for category-level metrics (30%)
 */
const DEFAULT_CATEGORY_WEIGHT = 0.3;

// ============================================================================
// Blended RPC Class
// ============================================================================

/**
 * RPC module for blended/combined metrics
 *
 * @example
 * ```typescript
 * // Get blended utilization for a pair
 * const utilization = await client.blended.getBlendedUtilization(0);
 * console.log(`Blended utilization: ${utilization.blendedUtilization}%`);
 *
 * // Get all blended metrics
 * const metrics = await client.blended.getAllBlendedMetrics();
 * ```
 */
export class BlendedRPC {
  private client: TraderClient;
  private assetWeight: number;
  private categoryWeight: number;

  /**
   * Create a new BlendedRPC instance
   * @param client - TraderClient instance
   * @param assetWeight - Weight for asset-level metrics (default: 0.7)
   * @param categoryWeight - Weight for category-level metrics (default: 0.3)
   */
  constructor(
    client: TraderClient,
    assetWeight: number = DEFAULT_ASSET_WEIGHT,
    categoryWeight: number = DEFAULT_CATEGORY_WEIGHT
  ) {
    this.client = client;
    this.assetWeight = assetWeight;
    this.categoryWeight = categoryWeight;

    // Validate weights sum to 1
    const totalWeight = assetWeight + categoryWeight;
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new Error(`Weights must sum to 1. Got: ${totalWeight}`);
    }
  }

  // ============================================================================
  // Blended Utilization Methods
  // ============================================================================

  /**
   * Get blended utilization for a specific pair
   * @param pair - Pair name or index
   * @returns Blended utilization data
   */
  async getBlendedUtilization(pair: string | number): Promise<BlendedUtilization> {
    const pairInfo = await this.client.pairsCache.getPairInfo(pair);

    // Get asset and category utilization
    const assetUtilization = await this.client.assetParameters.getUtilization();
    const categoryUtilization = await this.client.categoryParameters.getUtilization();

    const assetUtil = assetUtilization.get(pairInfo.pairIndex) || 0;
    const categoryUtil = categoryUtilization.get(pairInfo.groupIndex) || 0;

    // Calculate blended utilization
    const blendedUtil =
      assetUtil * this.assetWeight + categoryUtil * this.categoryWeight;

    return {
      assetUtilization: assetUtil,
      categoryUtilization: categoryUtil,
      blendedUtilization: blendedUtil,
      assetWeight: this.assetWeight,
      categoryWeight: this.categoryWeight,
    };
  }

  /**
   * Get blended utilization for all pairs
   * @returns Map of pair index to blended utilization
   */
  async getAllBlendedUtilization(): Promise<Map<number, BlendedUtilization>> {
    const pairs = await this.client.pairsCache.getPairsInfo();

    // Get all utilizations in parallel
    const [assetUtilization, categoryUtilization] = await Promise.all([
      this.client.assetParameters.getUtilization(),
      this.client.categoryParameters.getUtilization(),
    ]);

    const result = new Map<number, BlendedUtilization>();

    for (const [pairIndex, pairInfo] of pairs) {
      const assetUtil = assetUtilization.get(pairIndex) || 0;
      const categoryUtil = categoryUtilization.get(pairInfo.groupIndex) || 0;

      const blendedUtil =
        assetUtil * this.assetWeight + categoryUtil * this.categoryWeight;

      result.set(pairIndex, {
        assetUtilization: assetUtil,
        categoryUtilization: categoryUtil,
        blendedUtilization: blendedUtil,
        assetWeight: this.assetWeight,
        categoryWeight: this.categoryWeight,
      });
    }

    return result;
  }

  // ============================================================================
  // Blended Skew Methods
  // ============================================================================

  /**
   * Get blended skew for a specific pair
   * @param pair - Pair name or index
   * @returns Blended skew data
   */
  async getBlendedSkew(pair: string | number): Promise<BlendedSkew> {
    const pairInfo = await this.client.pairsCache.getPairInfo(pair);

    // Get asset and category skew
    const assetSkew = await this.client.assetParameters.getAssetSkew();
    const categorySkew = await this.client.categoryParameters.getCategorySkew();

    const assetSkewValue = assetSkew.get(pairInfo.pairIndex) || 50;
    const categorySkewValue = categorySkew.get(pairInfo.groupIndex) || 50;

    // Calculate blended skew
    const blendedSkewValue =
      assetSkewValue * this.assetWeight + categorySkewValue * this.categoryWeight;

    return {
      assetSkew: assetSkewValue,
      categorySkew: categorySkewValue,
      blendedSkew: blendedSkewValue,
      assetWeight: this.assetWeight,
      categoryWeight: this.categoryWeight,
    };
  }

  /**
   * Get blended skew for all pairs
   * @returns Map of pair index to blended skew
   */
  async getAllBlendedSkew(): Promise<Map<number, BlendedSkew>> {
    const pairs = await this.client.pairsCache.getPairsInfo();

    // Get all skews in parallel
    const [assetSkew, categorySkew] = await Promise.all([
      this.client.assetParameters.getAssetSkew(),
      this.client.categoryParameters.getCategorySkew(),
    ]);

    const result = new Map<number, BlendedSkew>();

    for (const [pairIndex, pairInfo] of pairs) {
      const assetSkewValue = assetSkew.get(pairIndex) || 50;
      const categorySkewValue = categorySkew.get(pairInfo.groupIndex) || 50;

      const blendedSkewValue =
        assetSkewValue * this.assetWeight + categorySkewValue * this.categoryWeight;

      result.set(pairIndex, {
        assetSkew: assetSkewValue,
        categorySkew: categorySkewValue,
        blendedSkew: blendedSkewValue,
        assetWeight: this.assetWeight,
        categoryWeight: this.categoryWeight,
      });
    }

    return result;
  }

  // ============================================================================
  // Combined Metrics Methods
  // ============================================================================

  /**
   * Get all blended metrics for a specific pair
   * @param pair - Pair name or index
   * @returns Complete blended metrics
   */
  async getBlendedMetrics(pair: string | number): Promise<BlendedMetrics> {
    const pairInfo = await this.client.pairsCache.getPairInfo(pair);

    // Get all data in parallel
    const [
      assetOI,
      categoryOI,
      utilization,
      skew,
    ] = await Promise.all([
      this.client.assetParameters.getPairOi(pairInfo.pairIndex),
      this.client.categoryParameters.getGroupOi(pairInfo.groupIndex),
      this.getBlendedUtilization(pairInfo.pairIndex),
      this.getBlendedSkew(pairInfo.pairIndex),
    ]);

    return {
      pairIndex: pairInfo.pairIndex,
      pairName: pairInfo.name,
      groupIndex: pairInfo.groupIndex,
      assetOI,
      categoryOI,
      utilization,
      skew,
    };
  }

  /**
   * Get all blended metrics for all pairs
   * @returns Map of pair index to complete blended metrics
   */
  async getAllBlendedMetrics(): Promise<Map<number, BlendedMetrics>> {
    const pairs = await this.client.pairsCache.getPairsInfo();

    // Get all data in parallel
    const [
      assetOI,
      categoryOI,
      assetUtilization,
      categoryUtilization,
      assetSkew,
      categorySkew,
    ] = await Promise.all([
      this.client.assetParameters.getOi(),
      this.client.categoryParameters.getOi(),
      this.client.assetParameters.getUtilization(),
      this.client.categoryParameters.getUtilization(),
      this.client.assetParameters.getAssetSkew(),
      this.client.categoryParameters.getCategorySkew(),
    ]);

    const result = new Map<number, BlendedMetrics>();

    for (const [pairIndex, pairInfo] of pairs) {
      const pairAssetOI = assetOI.get(pairIndex) || { long: 0, short: 0 };
      const pairCategoryOI = categoryOI.get(pairInfo.groupIndex) || { long: 0, short: 0 };

      const assetUtil = assetUtilization.get(pairIndex) || 0;
      const categoryUtil = categoryUtilization.get(pairInfo.groupIndex) || 0;
      const blendedUtil =
        assetUtil * this.assetWeight + categoryUtil * this.categoryWeight;

      const assetSkewValue = assetSkew.get(pairIndex) || 50;
      const categorySkewValue = categorySkew.get(pairInfo.groupIndex) || 50;
      const blendedSkewValue =
        assetSkewValue * this.assetWeight + categorySkewValue * this.categoryWeight;

      result.set(pairIndex, {
        pairIndex,
        pairName: pairInfo.name,
        groupIndex: pairInfo.groupIndex,
        assetOI: pairAssetOI,
        categoryOI: pairCategoryOI,
        utilization: {
          assetUtilization: assetUtil,
          categoryUtilization: categoryUtil,
          blendedUtilization: blendedUtil,
          assetWeight: this.assetWeight,
          categoryWeight: this.categoryWeight,
        },
        skew: {
          assetSkew: assetSkewValue,
          categorySkew: categorySkewValue,
          blendedSkew: blendedSkewValue,
          assetWeight: this.assetWeight,
          categoryWeight: this.categoryWeight,
        },
      });
    }

    return result;
  }

  // ============================================================================
  // Weight Configuration
  // ============================================================================

  /**
   * Get current weights
   * @returns Current asset and category weights
   */
  getWeights(): { assetWeight: number; categoryWeight: number } {
    return {
      assetWeight: this.assetWeight,
      categoryWeight: this.categoryWeight,
    };
  }

  /**
   * Set new weights
   * @param assetWeight - Weight for asset-level metrics
   * @param categoryWeight - Weight for category-level metrics
   * @throws If weights don't sum to 1
   */
  setWeights(assetWeight: number, categoryWeight: number): void {
    const totalWeight = assetWeight + categoryWeight;
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new Error(`Weights must sum to 1. Got: ${totalWeight}`);
    }

    this.assetWeight = assetWeight;
    this.categoryWeight = categoryWeight;
  }

  // ============================================================================
  // Directional Bias Methods
  // ============================================================================

  /**
   * Get directional bias for a pair based on blended skew
   * @param pair - Pair name or index
   * @returns Bias direction and strength
   */
  async getDirectionalBias(pair: string | number): Promise<{
    direction: 'long' | 'short' | 'neutral';
    strength: number;
    skew: BlendedSkew;
  }> {
    const skew = await this.getBlendedSkew(pair);

    // Calculate bias: 50 = neutral, >50 = long bias, <50 = short bias
    const deviation = skew.blendedSkew - 50;
    const strength = Math.abs(deviation);

    let direction: 'long' | 'short' | 'neutral';
    if (deviation > 5) {
      direction = 'long';
    } else if (deviation < -5) {
      direction = 'short';
    } else {
      direction = 'neutral';
    }

    return {
      direction,
      strength,
      skew,
    };
  }

  /**
   * Get directional bias for all pairs
   * @returns Map of pair index to directional bias
   */
  async getAllDirectionalBias(): Promise<Map<number, {
    direction: 'long' | 'short' | 'neutral';
    strength: number;
    skew: BlendedSkew;
  }>> {
    const allSkew = await this.getAllBlendedSkew();
    const result = new Map<number, {
      direction: 'long' | 'short' | 'neutral';
      strength: number;
      skew: BlendedSkew;
    }>();

    for (const [pairIndex, skew] of allSkew) {
      const deviation = skew.blendedSkew - 50;
      const strength = Math.abs(deviation);

      let direction: 'long' | 'short' | 'neutral';
      if (deviation > 5) {
        direction = 'long';
      } else if (deviation < -5) {
        direction = 'short';
      } else {
        direction = 'neutral';
      }

      result.set(pairIndex, {
        direction,
        strength,
        skew,
      });
    }

    return result;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new BlendedRPC instance
 * @param client - TraderClient instance
 * @param assetWeight - Weight for asset-level metrics (default: 0.7)
 * @param categoryWeight - Weight for category-level metrics (default: 0.3)
 * @returns BlendedRPC instance
 */
export function createBlendedRPC(
  client: TraderClient,
  assetWeight: number = DEFAULT_ASSET_WEIGHT,
  categoryWeight: number = DEFAULT_CATEGORY_WEIGHT
): BlendedRPC {
  return new BlendedRPC(client, assetWeight, categoryWeight);
}
