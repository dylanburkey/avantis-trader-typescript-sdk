/**
 * @fileoverview Category Parameters RPC Module
 *
 * Handles fetching of group/category-level parameters including
 * open interest, utilization, and skew at the group level.
 *
 * Uses data from the Socket API (via PairsCache) for reliability.
 *
 * @module rpc/category-parameters
 */

import { GROUP_NAMES } from "../contracts/config";
import type { OpenInterest, OpenInterestLimits } from "../types";
import type { PairsCache } from "./pairs-cache";
import { fromUsdcUnits } from "../utils";
import type { TraderClient } from "../client/trader-client";

// ============================================================================
// Category Parameters RPC Class
// ============================================================================

/**
 * Fetches group/category-level parameters from the Avantis protocol
 *
 * @example
 * ```typescript
 * // Get group open interest
 * const oi = await client.categoryParameters.getOi();
 *
 * // Get group skew
 * const skew = await client.categoryParameters.getCategorySkew();
 * ```
 */
export class CategoryParametersRPC {
  private pairsCache: PairsCache;

  /**
   * Create a new CategoryParametersRPC
   * @param client - TraderClient instance
   */
  constructor(client: TraderClient) {
    this.pairsCache = client.pairsCache;
  }

  /**
   * Get open interest limits for all groups
   * Uses data from Socket API via PairsCache
   */
  async getOiLimits(): Promise<Map<number, OpenInterestLimits>> {
    const groupIndexes = await this.pairsCache.getGroupIndexes();
    const limits = new Map<number, OpenInterestLimits>();

    for (const groupIndex of groupIndexes) {
      const groupInfo = await this.pairsCache.getGroupInfo(groupIndex);
      if (groupInfo) {
        limits.set(groupIndex, {
          limit: groupInfo.maxOI,
        });
      }
    }

    return limits;
  }

  /**
   * Get open interest limit for a specific group
   * @param groupIndex - Group index
   */
  async getGroupOiLimit(groupIndex: number): Promise<OpenInterestLimits> {
    const groupInfo = await this.pairsCache.getGroupInfo(groupIndex);

    if (groupInfo) {
      return {
        limit: groupInfo.maxOI,
      };
    }

    return { limit: 0 };
  }

  /**
   * Get open interest for all groups
   * Aggregates OI from all pairs in each group
   */
  async getOi(): Promise<Map<number, OpenInterest>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const oi = new Map<number, OpenInterest>();

    // Aggregate OI by group
    for (const [, pairInfo] of pairs) {
      const groupIndex = pairInfo.groupIndex;
      const existing = oi.get(groupIndex) || { long: 0, short: 0 };

      oi.set(groupIndex, {
        long: existing.long + fromUsdcUnits(pairInfo.data.longOI),
        short: existing.short + fromUsdcUnits(pairInfo.data.shortOI),
      });
    }

    return oi;
  }

  /**
   * Get open interest for a specific group
   * @param groupIndex - Group index
   */
  async getGroupOi(groupIndex: number): Promise<OpenInterest> {
    const pairs = await this.pairsCache.getPairsInfo();
    let longOI = 0;
    let shortOI = 0;

    // Sum OI from all pairs in this group
    for (const [, pairInfo] of pairs) {
      if (pairInfo.groupIndex === groupIndex) {
        longOI += fromUsdcUnits(pairInfo.data.longOI);
        shortOI += fromUsdcUnits(pairInfo.data.shortOI);
      }
    }

    return { long: longOI, short: shortOI };
  }

  /**
   * Get utilization for all groups
   */
  async getUtilization(): Promise<Map<number, number>> {
    const [oi, limits] = await Promise.all([this.getOi(), this.getOiLimits()]);

    const utilization = new Map<number, number>();

    for (const [groupIndex, groupOi] of oi) {
      const limit = limits.get(groupIndex);
      if (limit && limit.limit > 0) {
        const totalOi = groupOi.long + groupOi.short;
        utilization.set(groupIndex, (totalOi / limit.limit) * 100);
      } else {
        utilization.set(groupIndex, 0);
      }
    }

    return utilization;
  }

  /**
   * Get utilization for a specific group
   * @param groupIndex - Group index
   */
  async getGroupUtilization(groupIndex: number): Promise<number> {
    const [oi, limit] = await Promise.all([
      this.getGroupOi(groupIndex),
      this.getGroupOiLimit(groupIndex),
    ]);

    if (limit.limit > 0) {
      const totalOi = oi.long + oi.short;
      return (totalOi / limit.limit) * 100;
    }
    return 0;
  }

  /**
   * Get skew for all groups
   * Skew = longOI / totalOI * 100 (50 = balanced)
   */
  async getCategorySkew(): Promise<Map<number, number>> {
    const oi = await this.getOi();
    const skew = new Map<number, number>();

    for (const [groupIndex, groupOi] of oi) {
      const totalOi = groupOi.long + groupOi.short;
      if (totalOi > 0) {
        skew.set(groupIndex, (groupOi.long / totalOi) * 100);
      } else {
        skew.set(groupIndex, 50); // Default to balanced
      }
    }

    return skew;
  }

  /**
   * Get skew for a specific group
   * @param groupIndex - Group index
   */
  async getGroupSkew(groupIndex: number): Promise<number> {
    const oi = await this.getGroupOi(groupIndex);
    const totalOi = oi.long + oi.short;

    if (totalOi > 0) {
      return (oi.long / totalOi) * 100;
    }
    return 50; // Default to balanced
  }

  /**
   * Get group name by index
   * @param groupIndex - Group index
   */
  getGroupName(groupIndex: number): string {
    return GROUP_NAMES[groupIndex] || `Group ${groupIndex}`;
  }

  /**
   * Get all group names
   */
  async getAllGroupNames(): Promise<Map<number, string>> {
    const groupIndexes = await this.pairsCache.getGroupIndexes();
    const names = new Map<number, string>();

    for (const groupIndex of groupIndexes) {
      // Try to get name from Socket API first
      const groupInfo = await this.pairsCache.getGroupInfo(groupIndex);
      if (groupInfo) {
        names.set(groupIndex, groupInfo.name);
      } else {
        names.set(groupIndex, this.getGroupName(groupIndex));
      }
    }

    return names;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new CategoryParametersRPC instance
 * @param client - TraderClient instance
 * @returns CategoryParametersRPC instance
 */
export function createCategoryParametersRPC(
  client: TraderClient,
): CategoryParametersRPC {
  return new CategoryParametersRPC(client);
}
