/**
 * @fileoverview Pairs Cache RPC Module
 *
 * Handles caching and fetching of trading pair information from the Avantis protocol.
 * Uses the Avantis Socket API as the primary data source for reliability.
 *
 * @module rpc/pairs-cache
 */

import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import {
  RPC_URLS,
  DEFAULT_CACHE_TTL,
  SOCKET_API_URL,
} from "../contracts/config";
import type {
  PairInfo,
  PairData,
  PairInfoWithData,
  PairFeedMapping,
} from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for PairsCache
 */
export interface PairsCacheConfig {
  /** Public client for RPC calls (optional if rpcUrl provided) */
  publicClient?: PublicClient;
  /** RPC URL for Base network (optional if publicClient provided) */
  rpcUrl?: string;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtl?: number;
  /** Socket API URL (default: Avantis public API) */
  socketApiUrl?: string;
}

/**
 * Raw pair info from Socket API
 */
interface SocketPairInfo {
  index: number;
  from: string;
  to: string;
  groupIndex: number;
  feeIndex: number;
  feed: {
    feedId: string;
    maxOpenDeviationP: number;
    maxCloseDeviationP: number;
    attributes?: {
      symbol: string;
      asset_type: string;
      is_open: boolean;
    };
  };
  backupFeed?: {
    maxDeviationP: number;
    feedId: string;
  };
  spreadP: number;
  priceImpactMultiplier: number;
  skewImpactMultiplier: number;
  leverages: {
    minLeverage: number;
    maxLeverage: number;
    pnlMinLeverage?: number;
    pnlMaxLeverage?: number;
  };
  values: {
    maxGainP: number;
    maxSlP: number;
    maxLongOiP: number;
    maxShortOiP: number;
    maxWalletOIP?: number;
    isUSDCAligned?: boolean;
  };
  openInterest: {
    long: number;
    short: number;
  };
  pairOI: number;
  pairMaxOI: number;
  timer?: {
    numTiers: number;
    positionSizeToThresholdTierMap: Record<string, number>;
    thresholdTierToTimerMap: Record<string, number>;
  };
  isPairListed?: boolean;
}

/**
 * Socket API response structure
 */
interface SocketAPIResponse {
  data: {
    dataVersion: number;
    groupInfo: Record<
      string,
      {
        groupMaxOI: number;
        groupOI: number;
        name: string;
        maxOpenInterestP: number;
        isSpreadDynamic: boolean;
      }
    >;
    pairInfos: Record<string, SocketPairInfo>;
  };
}

// ============================================================================
// Pairs Cache Class
// ============================================================================

/**
 * Manages caching of trading pair information
 *
 * @example
 * ```typescript
 * // Create standalone PairsCache
 * const cache = new PairsCache({ rpcUrl: 'https://mainnet.base.org' });
 *
 * // Or use from TraderClient
 * const pairs = await client.pairsCache.getPairsInfo();
 * ```
 */
export class PairsCache {
  private publicClient: PublicClient;
  private pairsByIndex: Map<number, PairInfoWithData> = new Map();
  private pairsByName: Map<string, number> = new Map();
  private groupIndexes: Set<number> = new Set();
  private groupInfo: Map<
    number,
    { name: string; maxOI: number; currentOI: number }
  > = new Map();
  private lastUpdated: number = 0;
  private cacheTtl: number;
  private pairsCount: number = 0;
  private socketApiUrl: string;

  /**
   * Create a new PairsCache
   * @param configOrClient - Configuration object, TraderClient, or RPC URL string
   * @param cacheTtl - Cache TTL in milliseconds (default: 5 minutes) - only used when first param is string
   */
  constructor(
    configOrClient:
      | PairsCacheConfig
      | { publicClient: PublicClient }
      | string = {},
    cacheTtl: number = DEFAULT_CACHE_TTL,
  ) {
    // Handle string (RPC URL) for backward compatibility
    if (typeof configOrClient === "string") {
      this.publicClient = createPublicClient({
        chain: base,
        transport: http(configOrClient),
      }) as PublicClient;
      this.cacheTtl = cacheTtl;
      this.socketApiUrl = SOCKET_API_URL;
    }
    // Handle object with publicClient (from TraderClient)
    else if ("publicClient" in configOrClient && configOrClient.publicClient) {
      this.publicClient = configOrClient.publicClient;
      this.cacheTtl =
        (configOrClient as PairsCacheConfig).cacheTtl || DEFAULT_CACHE_TTL;
      this.socketApiUrl =
        (configOrClient as PairsCacheConfig).socketApiUrl || SOCKET_API_URL;
    }
    // Handle config object
    else {
      const config = configOrClient as PairsCacheConfig;
      this.publicClient = createPublicClient({
        chain: base,
        transport: http(config.rpcUrl || RPC_URLS[0]),
      }) as PublicClient;
      this.cacheTtl = config.cacheTtl || DEFAULT_CACHE_TTL;
      this.socketApiUrl = config.socketApiUrl || SOCKET_API_URL;
    }
  }

  /**
   * Get the total number of pairs
   */
  async getPairsCount(): Promise<number> {
    if (this.pairsCount > 0) {
      return this.pairsCount;
    }

    // Fetch from socket API to get count
    await this.getPairsInfo();
    return this.pairsCount;
  }

  /**
   * Get all pairs info, using cache if available
   * Uses the Socket API as the primary data source
   * @param forceUpdate - Force refresh from API
   */
  async getPairsInfo(
    forceUpdate: boolean = false,
  ): Promise<Map<number, PairInfoWithData>> {
    const now = Date.now();

    // Return cached data if still valid
    if (
      !forceUpdate &&
      this.pairsByIndex.size > 0 &&
      now - this.lastUpdated < this.cacheTtl
    ) {
      return this.pairsByIndex;
    }

    // Fetch fresh data from Socket API
    try {
      const response = await fetch(this.socketApiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch pairs: ${response.statusText}`);
      }

      const apiResponse: SocketAPIResponse = await response.json();
      const { pairInfos, groupInfo } = apiResponse.data;

      // Clear existing cache
      this.pairsByIndex.clear();
      this.pairsByName.clear();
      this.groupIndexes.clear();
      this.groupInfo.clear();

      // Process group info
      for (const [groupIndexStr, group] of Object.entries(groupInfo)) {
        const groupIndex = parseInt(groupIndexStr, 10);
        this.groupIndexes.add(groupIndex);
        this.groupInfo.set(groupIndex, {
          name: group.name,
          maxOI: group.groupMaxOI,
          currentOI: group.groupOI,
        });
      }

      // Process pair infos
      for (const [pairIndexStr, pairData] of Object.entries(pairInfos)) {
        const pairIndex = parseInt(pairIndexStr, 10);

        // Skip unlisted pairs
        if (pairData.isPairListed === false) {
          continue;
        }

        const pairInfo = this.convertSocketPairInfo(pairIndex, pairData);
        this.pairsByIndex.set(pairIndex, pairInfo);
        this.pairsByName.set(pairInfo.name.toUpperCase(), pairIndex);
      }

      this.pairsCount = this.pairsByIndex.size;
      this.lastUpdated = now;

      return this.pairsByIndex;
    } catch (error) {
      console.error("Failed to fetch pairs from Socket API:", error);
      throw error;
    }
  }

  /**
   * Convert Socket API pair info to internal format
   */
  private convertSocketPairInfo(
    pairIndex: number,
    data: SocketPairInfo,
  ): PairInfoWithData {
    const pairInfo: PairInfo = {
      name: `${data.from}/${data.to}`,
      pairIndex,
      groupIndex: data.groupIndex,
      feeIndex: data.feeIndex,
      feed: {
        maxDeviationP: data.feed.maxOpenDeviationP,
        feedId: data.feed.feedId as Hex,
      },
      backupFeed: {
        linkFeed: (data.backupFeed?.feedId ||
          "0x0000000000000000000000000000000000000000") as Address,
        api3Feed: "0x0000000000000000000000000000000000000000" as Address,
      },
      spreadP: data.spreadP * 100, // Convert to basis points
      priceImpactParameter: data.priceImpactMultiplier,
      skewImpactParameter: data.skewImpactMultiplier,
      leverages: {
        minLeverage: data.leverages.minLeverage,
        maxLeverage: data.leverages.maxLeverage,
      },
      values: {
        maxGainP: data.values.maxGainP,
        maxSlP: data.values.maxSlP,
        maxOIP: data.values.maxLongOiP,
        usdcAlignment: data.values.isUSDCAligned ? 1 : 0,
      },
      tierThresholds: data.timer
        ? Object.values(data.timer.positionSizeToThresholdTierMap).map(Number)
        : [],
      tierTimers: data.timer
        ? Object.values(data.timer.thresholdTierToTimerMap).map(Number)
        : [],
    };

    // Parse pair data (OI info)
    const pairData: PairData = {
      longOI: BigInt(Math.round(data.openInterest.long * 1e6)), // Convert to USDC units
      shortOI: BigInt(Math.round(data.openInterest.short * 1e6)),
      oiLimit: BigInt(Math.round(data.pairMaxOI * 1e6)),
    };

    return {
      ...pairInfo,
      data: pairData,
    };
  }

  /**
   * Get pair index by name
   * @param pairName - Pair name (e.g., "ETH/USD")
   */
  async getPairIndex(pairName: string): Promise<number> {
    await this.getPairsInfo();

    const index = this.pairsByName.get(pairName.toUpperCase());
    if (index === undefined) {
      throw new Error(`Pair not found: ${pairName}`);
    }

    return index;
  }

  /**
   * Get all group indexes
   */
  async getGroupIndexes(): Promise<Set<number>> {
    await this.getPairsInfo();
    return this.groupIndexes;
  }

  /**
   * Get group info by index
   * @param groupIndex - Group index
   */
  async getGroupInfo(
    groupIndex: number,
  ): Promise<{ name: string; maxOI: number; currentOI: number } | undefined> {
    await this.getPairsInfo();
    return this.groupInfo.get(groupIndex);
  }

  /**
   * Get pair info by name or index
   * @param pair - Pair name or index
   */
  async getPairInfo(pair: string | number): Promise<PairInfoWithData> {
    await this.getPairsInfo();

    let pairIndex: number;
    if (typeof pair === "string") {
      const index = this.pairsByName.get(pair.toUpperCase());
      if (index === undefined) {
        throw new Error(`Pair not found: ${pair}`);
      }
      pairIndex = index;
    } else {
      pairIndex = pair;
    }

    const pairInfo = this.pairsByIndex.get(pairIndex);
    if (!pairInfo) {
      throw new Error(`Pair not found with index: ${pairIndex}`);
    }

    return pairInfo;
  }

  /**
   * Fetch pair feed mappings from Avantis Socket API
   * @param socketApiUrl - Socket API URL (optional)
   * @deprecated Use getPairsInfo() instead
   */
  async getPairInfoFromSocket(
    socketApiUrl: string = this.socketApiUrl,
  ): Promise<PairFeedMapping[]> {
    try {
      const response = await fetch(socketApiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch pair feeds: ${response.statusText}`);
      }

      const apiResponse: SocketAPIResponse = await response.json();
      const mappings: PairFeedMapping[] = [];

      for (const [pairIndexStr, pairData] of Object.entries(
        apiResponse.data.pairInfos,
      )) {
        mappings.push({
          pairIndex: parseInt(pairIndexStr, 10),
          pairName: `${pairData.from}/${pairData.to}`,
          feedId: pairData.feed.feedId as Hex,
        });
      }

      return mappings;
    } catch (error) {
      console.error("Failed to fetch pair feeds from socket API:", error);
      throw error;
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.pairsByIndex.clear();
    this.pairsByName.clear();
    this.groupIndexes.clear();
    this.groupInfo.clear();
    this.lastUpdated = 0;
    this.pairsCount = 0;
  }

  /**
   * Get all pair names
   */
  async getPairNames(): Promise<string[]> {
    await this.getPairsInfo();
    return Array.from(this.pairsByName.keys());
  }

  /**
   * Check if a pair exists
   * @param pair - Pair name or index
   */
  async pairExists(pair: string | number): Promise<boolean> {
    await this.getPairsInfo();

    if (typeof pair === "string") {
      return this.pairsByName.has(pair.toUpperCase());
    }
    return this.pairsByIndex.has(pair);
  }

  /**
   * Get the public client
   */
  getPublicClient(): PublicClient {
    return this.publicClient;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new PairsCache instance
 * @param rpcUrl - RPC URL
 * @param cacheTtl - Cache TTL in milliseconds
 */
export function createPairsCache(
  rpcUrl: string = RPC_URLS[0],
  cacheTtl: number = DEFAULT_CACHE_TTL,
): PairsCache {
  return new PairsCache(rpcUrl, cacheTtl);
}
