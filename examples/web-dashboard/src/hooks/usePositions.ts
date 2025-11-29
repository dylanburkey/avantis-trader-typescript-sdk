'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTradingClient, getReadOnlyClient } from '@/lib/avantis';
import { Position } from '@/types';

export function usePositions(walletAddress: string | null, privateKey: string | null) {
  return useQuery({
    queryKey: ['positions', walletAddress],
    queryFn: async (): Promise<Position[]> => {
      if (!walletAddress) return [];

      const client = await getReadOnlyClient();
      const trades = await client.trade.getOpenTrades(walletAddress);
      const tradesInfo = await client.trade.getOpenTradesInfo(walletAddress);

      const positions: Position[] = [];

      for (let i = 0; i < trades.length; i++) {
        const trade = trades[i];
        const info = tradesInfo[i];

        const pair = await client.pairsCache.getPairByIndex(trade.pairIndex);
        let currentPrice = trade.openPrice;

        try {
          currentPrice = await client.feedClient.getPrice(trade.pairIndex);
        } catch {}

        const priceDiff = trade.isLong
          ? currentPrice - trade.openPrice
          : trade.openPrice - currentPrice;

        const pnl = (priceDiff / trade.openPrice) * trade.positionSize;
        const pnlPercent = (pnl / trade.collateral) * 100;

        // Calculate liquidation price (simplified - 90% loss)
        const liqMovePercent = 0.9 / trade.leverage;
        const liquidationPrice = trade.isLong
          ? trade.openPrice * (1 - liqMovePercent)
          : trade.openPrice * (1 + liqMovePercent);

        positions.push({
          pairIndex: trade.pairIndex,
          pairName: pair?.name || `Pair ${trade.pairIndex}`,
          tradeIndex: trade.index,
          isLong: trade.isLong,
          collateral: trade.collateral,
          leverage: trade.leverage,
          positionSize: trade.positionSize,
          entryPrice: trade.openPrice,
          currentPrice,
          pnl,
          pnlPercent,
          liquidationPrice,
          tp: info?.tp || 0,
          sl: info?.sl || 0,
          openTime: info?.openTime || 0,
        });
      }

      return positions;
    },
    enabled: !!walletAddress,
    refetchInterval: 5000, // 5 seconds
  });
}

export function useClosePosition(privateKey: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pairIndex,
      tradeIndex,
    }: {
      pairIndex: number;
      tradeIndex: number;
    }) => {
      if (!privateKey) throw new Error('No private key');

      const client = await getTradingClient(privateKey as `0x${string}`);
      return client.trade.closeTradeMarket(pairIndex, tradeIndex);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
}

export function useUpdateTpSl(privateKey: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pairIndex,
      tradeIndex,
      tp,
      sl,
    }: {
      pairIndex: number;
      tradeIndex: number;
      tp?: number;
      sl?: number;
    }) => {
      if (!privateKey) throw new Error('No private key');

      const client = await getTradingClient(privateKey as `0x${string}`);

      const results = [];
      if (tp !== undefined) {
        results.push(await client.trade.updateTp(pairIndex, tradeIndex, tp));
      }
      if (sl !== undefined) {
        results.push(await client.trade.updateSl(pairIndex, tradeIndex, sl));
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
}
