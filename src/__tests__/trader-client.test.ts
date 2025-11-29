/**
 * @fileoverview TraderClient Tests
 *
 * Contains both unit tests and integration tests for the TraderClient.
 * Unit tests run without RPC calls.
 * Integration tests require RPC and can be skipped with SKIP_INTEGRATION_TESTS=true.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TraderClient, createTraderClient } from "../client/trader-client";
import { RPC_URLS } from "../contracts/config";

// Skip integration tests if env var is set or if we detect CI without RPC URL
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === "true";
const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe;

describe("TraderClient", () => {
  let client: TraderClient;

  beforeAll(() => {
    // Create a read-only client for testing
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
      debug: false,
    });
  });

  describe("Initialization", () => {
    it("should create a client instance", () => {
      expect(client).toBeInstanceOf(TraderClient);
    });

    it("should have a public client", () => {
      expect(client.publicClient).toBeDefined();
    });

    it("should have all RPC modules initialized", () => {
      expect(client.pairsCache).toBeDefined();
      expect(client.assetParameters).toBeDefined();
      expect(client.categoryParameters).toBeDefined();
      expect(client.feeParameters).toBeDefined();
      expect(client.tradingParameters).toBeDefined();
      expect(client.blended).toBeDefined();
      expect(client.snapshot).toBeDefined();
      expect(client.trade).toBeDefined();
      expect(client.feedClient).toBeDefined();
    });

    it("should not have a signer by default", () => {
      expect(client.hasSigner()).toBe(false);
      expect(client.getSignerAddress()).toBeNull();
    });
  });

  describe("Signer Management", () => {
    it("should set a local signer with private key", () => {
      const testClient = createTraderClient({
        rpcUrl: RPC_URLS[0],
        privateKey:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
      });

      expect(testClient.hasSigner()).toBe(true);
      expect(testClient.getSignerAddress()).toBeDefined();
      expect(testClient.getSignerAddress()).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should remove signer", () => {
      const testClient = createTraderClient({
        rpcUrl: RPC_URLS[0],
        privateKey:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
      });

      expect(testClient.hasSigner()).toBe(true);
      testClient.removeSigner();
      expect(testClient.hasSigner()).toBe(false);
    });
  });

  describe("Utility Methods", () => {
    it("should convert USDC to wei correctly", () => {
      const amount = 100;
      const wei = TraderClient.usdcToWei(amount);
      expect(wei).toBe(100000000n); // 100 * 10^6
    });

    it("should convert wei to USDC correctly", () => {
      const wei = 100000000n;
      const amount = TraderClient.weiToUsdc(wei);
      expect(amount).toBe(100);
    });

    it("should convert price to wei correctly", () => {
      const price = 2500.5;
      const wei = TraderClient.priceToWei(price);
      expect(wei).toBe(25005000000000n); // 2500.5 * 10^10
    });

    it("should convert wei to price correctly", () => {
      const wei = 25005000000000n;
      const price = TraderClient.weiToPrice(wei);
      expect(price).toBe(2500.5);
    });
  });

  describe("Contract Instances", () => {
    it("should expose contract instances", () => {
      expect(client.contracts).toBeDefined();
      // Contract instances have address property
      expect(client.contracts.TradingStorage).toBeDefined();
      expect(client.contracts.TradingStorage.address).toMatch(
        /^0x[a-fA-F0-9]{40}$/,
      );
      expect(client.contracts.Trading).toBeDefined();
      expect(client.contracts.Trading.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(client.contracts.PairInfos).toBeDefined();
      expect(client.contracts.PairInfos.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(client.contracts.USDC).toBeDefined();
      expect(client.contracts.USDC.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});

describe("BlendedRPC Unit Tests", () => {
  let client: TraderClient;

  beforeAll(() => {
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
    });
  });

  it("should allow changing weights", () => {
    const newAssetWeight = 0.6;
    const newCategoryWeight = 0.4;

    client.blended.setWeights(newAssetWeight, newCategoryWeight);
    const weights = client.blended.getWeights();

    expect(weights.assetWeight).toBe(newAssetWeight);
    expect(weights.categoryWeight).toBe(newCategoryWeight);

    // Reset to defaults
    client.blended.setWeights(0.7, 0.3);
  });

  it("should throw on invalid weights (sum != 1)", () => {
    expect(() => client.blended.setWeights(0.5, 0.3)).toThrow();
    expect(() => client.blended.setWeights(0.8, 0.3)).toThrow();
  });

  it("should accept valid weights that sum to 1", () => {
    // Even edge cases like negative + positive that sum to 1 are accepted
    // (validation only checks sum, not individual values)
    expect(() => client.blended.setWeights(0.5, 0.5)).not.toThrow();
    expect(() => client.blended.setWeights(1, 0)).not.toThrow();
    expect(() => client.blended.setWeights(0, 1)).not.toThrow();
    // Reset to defaults
    client.blended.setWeights(0.7, 0.3);
  });
});

describe("CategoryParameters Unit Tests", () => {
  let client: TraderClient;

  beforeAll(() => {
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
    });
  });

  it("should get group name for known groups", () => {
    expect(client.categoryParameters.getGroupName(0)).toBe("Crypto 1");
    expect(client.categoryParameters.getGroupName(1)).toBe("Crypto 2");
    expect(client.categoryParameters.getGroupName(2)).toBe("Forex");
    expect(client.categoryParameters.getGroupName(3)).toBe("Commodities");
  });

  it("should return fallback name for unknown group", () => {
    // Unknown groups return "Group {index}" format
    expect(client.categoryParameters.getGroupName(999)).toBe("Group 999");
  });
});

// ============================================================================
// Integration Tests (require live RPC)
// ============================================================================

describeIntegration("PairsCache Integration", () => {
  let client: TraderClient;

  beforeAll(() => {
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
    });
  });

  it("should fetch pairs count", async () => {
    const count = await client.pairsCache.getPairsCount();
    expect(count).toBeGreaterThan(0);
  }, 30000);

  it("should fetch pairs info", async () => {
    const pairs = await client.pairsCache.getPairsInfo();
    expect(pairs.size).toBeGreaterThan(0);

    // Check first pair has expected structure
    const firstPair = pairs.get(0);
    expect(firstPair).toBeDefined();
    if (firstPair) {
      expect(firstPair.name).toBeDefined();
      expect(firstPair.pairIndex).toBe(0);
      expect(firstPair.groupIndex).toBeDefined();
      expect(firstPair.feed).toBeDefined();
      expect(firstPair.feed.feedId).toMatch(/^0x[a-fA-F0-9]+$/);
    }
  }, 60000);

  it("should get pair by name", async () => {
    // First fetch pairs to populate cache
    await client.pairsCache.getPairsInfo();

    // Now get pair by name
    const pairNames = await client.pairsCache.getPairNames();
    if (pairNames.length > 0) {
      const pairInfo = await client.pairsCache.getPairInfo(pairNames[0]);
      expect(pairInfo).toBeDefined();
      expect(pairInfo.name).toBe(pairNames[0]);
    }
  }, 30000);

  it("should check if pair exists", async () => {
    await client.pairsCache.getPairsInfo();

    const exists = await client.pairsCache.pairExists(0);
    expect(exists).toBe(true);

    const notExists = await client.pairsCache.pairExists(9999);
    expect(notExists).toBe(false);
  }, 30000);
});

describeIntegration("AssetParameters Integration", () => {
  let client: TraderClient;

  beforeAll(() => {
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
    });
  });

  it("should fetch open interest for all pairs", async () => {
    const oi = await client.assetParameters.getOi();
    expect(oi.size).toBeGreaterThan(0);

    // Check OI structure
    const firstOi = oi.get(0);
    expect(firstOi).toBeDefined();
    if (firstOi) {
      expect(typeof firstOi.long).toBe("number");
      expect(typeof firstOi.short).toBe("number");
      expect(firstOi.long).toBeGreaterThanOrEqual(0);
      expect(firstOi.short).toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  it("should fetch OI limits", async () => {
    const limits = await client.assetParameters.getOiLimits();
    expect(limits.size).toBeGreaterThan(0);

    const firstLimit = limits.get(0);
    expect(firstLimit).toBeDefined();
    if (firstLimit) {
      expect(firstLimit.limit).toBeGreaterThan(0);
    }
  }, 60000);

  it("should calculate utilization", async () => {
    const utilization = await client.assetParameters.getUtilization();
    expect(utilization.size).toBeGreaterThan(0);

    const firstUtil = utilization.get(0);
    expect(firstUtil).toBeDefined();
    if (firstUtil !== undefined) {
      expect(firstUtil).toBeGreaterThanOrEqual(0);
      expect(firstUtil).toBeLessThanOrEqual(100);
    }
  }, 60000);

  it("should calculate asset skew", async () => {
    const skew = await client.assetParameters.getAssetSkew();
    expect(skew.size).toBeGreaterThan(0);

    const firstSkew = skew.get(0);
    expect(firstSkew).toBeDefined();
    if (firstSkew !== undefined) {
      expect(firstSkew).toBeGreaterThanOrEqual(0);
      expect(firstSkew).toBeLessThanOrEqual(100);
    }
  }, 60000);
});

describeIntegration("CategoryParameters Integration", () => {
  let client: TraderClient;

  beforeAll(() => {
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
    });
  });

  it("should fetch group OI", async () => {
    const oi = await client.categoryParameters.getOi();
    expect(oi.size).toBeGreaterThan(0);
  }, 60000);

  it("should fetch group OI limits", async () => {
    const limits = await client.categoryParameters.getOiLimits();
    expect(limits.size).toBeGreaterThan(0);
  }, 60000);

  it("should calculate group skew", async () => {
    const skew = await client.categoryParameters.getCategorySkew();
    expect(skew.size).toBeGreaterThan(0);
  }, 60000);
});

describeIntegration("FeeParameters Integration", () => {
  let client: TraderClient;

  beforeAll(() => {
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
    });
  });

  it("should fetch margin fees", async () => {
    const marginFees = await client.feeParameters.getMarginFee();
    expect(marginFees.size).toBeGreaterThan(0);

    const firstFee = marginFees.get(0);
    expect(firstFee).toBeDefined();
    if (firstFee) {
      expect(typeof firstFee.hourlyBaseFeeParameter).toBe("number");
      expect(typeof firstFee.longBps).toBe("number");
      expect(typeof firstFee.shortBps).toBe("number");
    }
  }, 60000);

  it("should fetch pair spreads", async () => {
    const spreads = await client.feeParameters.getPairSpread();
    expect(spreads.size).toBeGreaterThan(0);

    const firstSpread = spreads.get(0);
    expect(firstSpread).toBeDefined();
    if (firstSpread) {
      expect(firstSpread.pairIndex).toBe(0);
      expect(typeof firstSpread.spreadBps).toBe("number");
    }
  }, 60000);
});

describeIntegration("BlendedRPC Integration", () => {
  let client: TraderClient;

  beforeAll(() => {
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
    });
  });

  it("should get blended utilization", async () => {
    const utilization = await client.blended.getBlendedUtilization(0);
    expect(utilization).toBeDefined();
    expect(typeof utilization.assetUtilization).toBe("number");
    expect(typeof utilization.categoryUtilization).toBe("number");
    expect(typeof utilization.blendedUtilization).toBe("number");
    expect(utilization.assetWeight + utilization.categoryWeight).toBeCloseTo(
      1,
      3,
    );
  }, 60000);

  it("should get blended skew", async () => {
    const skew = await client.blended.getBlendedSkew(0);
    expect(skew).toBeDefined();
    expect(skew.blendedSkew).toBeGreaterThanOrEqual(0);
    expect(skew.blendedSkew).toBeLessThanOrEqual(100);
  }, 60000);

  it("should get directional bias", async () => {
    const bias = await client.blended.getDirectionalBias(0);
    expect(bias).toBeDefined();
    expect(["long", "short", "neutral"]).toContain(bias.direction);
    expect(typeof bias.strength).toBe("number");
  }, 60000);
});

describeIntegration("TradeRPC Integration", () => {
  let client: TraderClient;

  beforeAll(() => {
    client = createTraderClient({
      rpcUrl: RPC_URLS[0],
    });
  });

  it("should get execution fee", async () => {
    const fee = await client.trade.getExecutionFee();
    expect(fee).toBeDefined();
    expect(fee).toBeGreaterThan(0n);
  }, 30000);

  it("should get long/short ratios", async () => {
    const ratios = await client.trade.getLongShortRatios();
    expect(ratios.size).toBeGreaterThan(0);

    const firstRatio = ratios.get(0);
    expect(firstRatio).toBeDefined();
    if (firstRatio) {
      expect(typeof firstRatio.long).toBe("number");
      expect(typeof firstRatio.short).toBe("number");
    }
  }, 30000);

  it("should get margin info", async () => {
    const margins = await client.trade.getMarginInfo();
    expect(margins.size).toBeGreaterThan(0);
  }, 30000);
});
