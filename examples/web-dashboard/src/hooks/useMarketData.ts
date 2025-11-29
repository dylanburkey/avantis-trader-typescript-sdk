'use client';

import { useQuery } from '@tanstack/react-query';
import { getReadOnlyClient } from '@/lib/avantis';
import { PairData, MarketStats } from '@/types';

export function useMarketData() {
  return useQuery({
    queryKey: ['marketData'],
    queryFn: async (): Promise<PairData[]> => {
      const client = await getReadOnlyClient();
      const pairs = await client.pairsCache.getPairsInfo();
      const oi = await client.assetParameters.getOi();

      const pairData: PairData[] = [];

      for (const [index, pair] of pairs) {
        const pairOi = oi.get(index);
        if (!pairOi) continue;

        let price = 0;
        try {
          price = await client.feedClient.getPrice(index);
        } catch {
          // Price feed may not be available
        }

        const [util, skew, spread] = await Promise.all([
          client.blended.getBlendedUtilization(index).catch(() => ({ long: 0, short: 0 })),
          client.blended.getBlendedSkew(index).catch(() => ({ value: 0 })),
          client.feeParameters.getSpread(index).catch(() => 0),
        ]);

        pairData.push({
          index,
          name: pair.name,
          price,
          priceChange24h: 0, // Would need historical data
          longOi: pairOi.long,
          shortOi: pairOi.short,
          utilization: util,
          skew: skew.value,
          spread,
          maxLeverage: pair.maxLeverage,
          groupIndex: pair.groupIndex,
        });
      }

      // Sort by total OI descending
      return pairData.sort((a, b) => (b.longOi + b.shortOi) - (a.longOi + a.shortOi));
    },
    refetchInterval: 30000, // 30 seconds
  });
}

export function useMarketStats(pairs: PairData[] | undefined) {
  if (!pairs) {
    return {
      totalLongOi: 0,
      totalShortOi: 0,
      totalPairs: 0,
      topGainers: [],
      topLosers: [],
    };
  }

  const stats: MarketStats = {
    totalLongOi: pairs.reduce((sum, p) => sum + p.longOi, 0),
    totalShortOi: pairs.reduce((sum, p) => sum + p.shortOi, 0),
    totalPairs: pairs.length,
    topGainers: [...pairs].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 5),
    topLosers: [...pairs].sort((a, b) => a.priceChange24h - b.priceChange24h).slice(0, 5),
  };

  return stats;
}

export function usePairData(pairIndex: number) {
  return useQuery({
    queryKey: ['pairData', pairIndex],
    queryFn: async () => {
      const client = await getReadOnlyClient();

      const [pair, oi, util, skew, spread, price] = await Promise.all([
        client.pairsCache.getPairByIndex(pairIndex),
        client.assetParameters.getOiForPair(pairIndex),
        client.blended.getBlendedUtilization(pairIndex),
        client.blended.getBlendedSkew(pairIndex),
        client.feeParameters.getSpread(pairIndex),
        client.feedClient.getPrice(pairIndex).catch(() => 0),
      ]);

      return {
        index: pairIndex,
        name: pair?.name || `Pair ${pairIndex}`,
        price,
        priceChange24h: 0,
        longOi: oi.long,
        shortOi: oi.short,
        utilization: util,
        skew: skew.value,
        spread,
        maxLeverage: pair?.maxLeverage || 50,
        groupIndex: pair?.groupIndex || 0,
      } as PairData;
    },
    refetchInterval: 5000, // 5 seconds for individual pair
  });
}
