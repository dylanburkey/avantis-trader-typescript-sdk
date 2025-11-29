/**
 * @fileoverview Snapshot RPC Module
 *
 * Provides complete market snapshots including all pair and group data.
 *
 * @module rpc/snapshot
 */

import type {
  Snapshot,
  SimplifiedSnapshot,
  SnapshotGroup,
  PairInfoExtended,
  OpenInterest,
} from "../types";
import type { PairsCache } from "./pairs-cache";
import type { AssetParametersRPC } from "./asset-parameters";
import type { FeeParametersRPC } from "./fee-parameters";
import type { CategoryParametersRPC } from "./category-parameters";
import type { TraderClient } from "../client/trader-client";

// ============================================================================
// Snapshot RPC Class
// ============================================================================

/**
 * Provides complete market snapshots from the Avantis protocol
 *
 * @example
 * ```typescript
 * // Get a complete market snapshot
 * const snapshot = await client.snapshot.getSnapshot();
 *
 * // Get a simplified snapshot for lightweight queries
 * const simple = await client.snapshot.getSimplifiedSnapshot();
 * ```
 */
export class SnapshotRPC {
  private pairsCache: PairsCache;
  private assetParams: AssetParametersRPC;
  private feeParams: FeeParametersRPC;
  private categoryParams: CategoryParametersRPC;

  /**
   * Create a new SnapshotRPC
   * @param client - TraderClient instance
   */
  constructor(client: TraderClient) {
    this.pairsCache = client.pairsCache;
    this.assetParams = client.assetParameters;
    this.feeParams = client.feeParameters;
    this.categoryParams = client.categoryParameters;
  }

  /**
   * Get a complete market snapshot
   */
  async getSnapshot(): Promise<Snapshot> {
    // Fetch all data in parallel
    const [
      pairs,
      assetOi,
      _assetOiLimits,
      assetUtilization,
      assetSkew,
      groupOi,
      groupOiLimits,
      groupUtilization,
      groupSkew,
      marginFees,
      pairSpreads,
    ] = await Promise.all([
      this.pairsCache.getPairsInfo(),
      this.assetParams.getOi(),
      this.assetParams.getOiLimits(),
      this.assetParams.getUtilization(),
      this.assetParams.getAssetSkew(),
      this.categoryParams.getOi(),
      this.categoryParams.getOiLimits(),
      this.categoryParams.getUtilization(),
      this.categoryParams.getCategorySkew(),
      this.feeParams.getMarginFee(),
      this.feeParams.getPairSpread(),
    ]);
    // Note: _assetOiLimits fetched for potential future use in extended snapshots

    // Fetch depth and spreads for each pair
    const pairIndexes = Array.from(pairs.keys());
    const [depths, priceImpactSpreads, openingFees] = await Promise.all([
      this.assetParams.getAllOnePercentDepths(),
      this.fetchAllPriceImpactSpreads(pairIndexes),
      this.fetchAllOpeningFees(pairIndexes),
    ]);

    // Organize by group
    const groups: Record<number, SnapshotGroup> = {};

    for (const [pairIndex, pairInfo] of pairs) {
      const groupIndex = pairInfo.groupIndex;

      // Initialize group if not exists
      if (!groups[groupIndex]) {
        groups[groupIndex] = {
          groupOpenInterestLimit: groupOiLimits.get(groupIndex)?.limit || 0,
          groupOpenInterest: groupOi.get(groupIndex) || { long: 0, short: 0 },
          groupUtilization: groupUtilization.get(groupIndex) || 0,
          groupSkew: groupSkew.get(groupIndex) || 50,
          pairs: {},
        };
      }

      // Build extended pair info
      const extendedPair: PairInfoExtended = {
        ...pairInfo,
        assetOI: assetOi.get(pairIndex) || { long: 0, short: 0 },
        assetUtilization: assetUtilization.get(pairIndex) || 0,
        assetSkew: assetSkew.get(pairIndex) || 50,
        marginFee: marginFees.get(pairIndex) || {
          hourlyBaseFeeParameter: 0,
          longBps: 0,
          shortBps: 0,
        },
        depth: depths.get(pairIndex) || { above: 0, below: 0 },
        priceImpactSpread: priceImpactSpreads.get(pairIndex) || {
          long: 0,
          short: 0,
        },
        skewImpactSpread: { long: 0, short: 0 }, // Will be calculated separately
        openingFee: openingFees.get(pairIndex) || { long: 0, short: 0 },
        pairSpread: pairSpreads.get(pairIndex)?.spreadBps || 0,
      };

      groups[groupIndex].pairs[pairInfo.name] = extendedPair;
    }

    return { groups };
  }

  /**
   * Fetch price impact spreads for all pairs
   * @param pairIndexes - Array of pair indexes
   */
  private async fetchAllPriceImpactSpreads(
    pairIndexes: number[],
  ): Promise<Map<number, { long: number; short: number }>> {
    const spreads = new Map<number, { long: number; short: number }>();
    const testPositionSize = 1000; // $1000 test position

    const promises = pairIndexes.map(async (pairIndex) => {
      try {
        const [longSpread, shortSpread] = await Promise.all([
          this.assetParams.getPriceImpactSpread(
            testPositionSize,
            true,
            pairIndex,
          ),
          this.assetParams.getPriceImpactSpread(
            testPositionSize,
            false,
            pairIndex,
          ),
        ]);
        return { pairIndex, long: longSpread, short: shortSpread };
      } catch {
        return { pairIndex, long: 0, short: 0 };
      }
    });

    const results = await Promise.all(promises);

    for (const { pairIndex, long, short } of results) {
      spreads.set(pairIndex, { long, short });
    }

    return spreads;
  }

  /**
   * Fetch opening fees for all pairs
   * @param pairIndexes - Array of pair indexes
   */
  private async fetchAllOpeningFees(
    pairIndexes: number[],
  ): Promise<Map<number, { long: number; short: number }>> {
    const fees = new Map<number, { long: number; short: number }>();
    const testPositionSize = 1000; // $1000 test position

    const promises = pairIndexes.map(async (pairIndex) => {
      try {
        const fee = await this.feeParams.getOpeningFee({
          pairIndex,
          positionSize: testPositionSize,
        });
        if (typeof fee === "object") {
          return { pairIndex, long: fee.long, short: fee.short };
        }
        return { pairIndex, long: 0, short: 0 };
      } catch {
        return { pairIndex, long: 0, short: 0 };
      }
    });

    const results = await Promise.all(promises);

    for (const { pairIndex, long, short } of results) {
      fees.set(pairIndex, { long, short });
    }

    return fees;
  }

  /**
   * Get a simplified snapshot with basic OI and skew data
   */
  async getSimplifiedSnapshot(): Promise<SimplifiedSnapshot> {
    const [pairs, assetOi, assetSkew, groupOi, groupSkew] = await Promise.all([
      this.pairsCache.getPairsInfo(),
      this.assetParams.getOi(),
      this.assetParams.getAssetSkew(),
      this.categoryParams.getOi(),
      this.categoryParams.getCategorySkew(),
    ]);

    const pairsData: Record<
      string,
      { openInterest: OpenInterest; skew: number }
    > = {};

    for (const [pairIndex, pairInfo] of pairs) {
      pairsData[pairInfo.name] = {
        openInterest: assetOi.get(pairIndex) || { long: 0, short: 0 },
        skew: assetSkew.get(pairIndex) || 50,
      };
    }

    const groupsData: Record<
      number,
      { openInterest: OpenInterest; skew: number }
    > = {};

    for (const [groupIndex, oi] of groupOi) {
      groupsData[groupIndex] = {
        openInterest: oi,
        skew: groupSkew.get(groupIndex) || 50,
      };
    }

    return {
      pairs: pairsData,
      groups: groupsData,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new SnapshotRPC instance
 * @param client - TraderClient instance
 * @returns SnapshotRPC instance
 */
export function createSnapshotRPC(client: TraderClient): SnapshotRPC {
  return new SnapshotRPC(client);
}
