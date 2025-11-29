# Front-End Integration Example

This guide provides a complete React/Next.js example for building a trading dashboard with the Avantis SDK.

## Project Setup

### Create Next.js App

```bash
npx create-next-app@latest avantis-trading-app --typescript --tailwind --app
cd avantis-trading-app
npm install avantisfi-sdk viem
```

### Project Structure

```
avantis-trading-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       └── market/route.ts
│   ├── components/
│   │   ├── MarketOverview.tsx
│   │   ├── PairSelector.tsx
│   │   ├── TradeForm.tsx
│   │   ├── PositionsList.tsx
│   │   └── MarketSnapshot.tsx
│   ├── hooks/
│   │   ├── useAvantis.ts
│   │   ├── useMarketData.ts
│   │   └── usePositions.ts
│   ├── lib/
│   │   └── avantis.ts
│   └── types/
│       └── index.ts
├── .env.local
└── package.json
```

## Core Implementation

### SDK Client Hook

```typescript
// src/lib/avantis.ts
import { TraderClient } from 'avantisfi-sdk';

let clientPromise: Promise<TraderClient> | null = null;

export async function getClient(): Promise<TraderClient> {
  if (!clientPromise) {
    clientPromise = TraderClient.create();
  }
  return clientPromise;
}

// For server-side use
export async function getServerClient(): Promise<TraderClient> {
  return TraderClient.create();
}
```

```typescript
// src/hooks/useAvantis.ts
'use client';

import { useState, useEffect } from 'react';
import { TraderClient } from 'avantisfi-sdk';
import { getClient } from '@/lib/avantis';

export function useAvantis() {
  const [client, setClient] = useState<TraderClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getClient()
      .then(setClient)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { client, loading, error };
}
```

### Market Data Hook

```typescript
// src/hooks/useMarketData.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAvantis } from './useAvantis';

export interface PairData {
  index: number;
  name: string;
  price: number;
  longOi: number;
  shortOi: number;
  utilization: { long: number; short: number };
  spread: number;
  maxLeverage: number;
}

export function useMarketData(refreshInterval = 10000) {
  const { client } = useAvantis();
  const [pairs, setPairs] = useState<PairData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!client) return;

    try {
      const pairsInfo = await client.pairsCache.getPairsInfo();
      const oi = await client.assetParameters.getOi();

      const pairData: PairData[] = [];

      for (const [index, pair] of pairsInfo) {
        const pairOi = oi.get(index);
        const util = await client.assetParameters.getUtilization(index);
        const spread = await client.feeParameters.getSpread(index);

        let price = 0;
        try {
          price = await client.feedClient.getPrice(index);
        } catch {
          // Price feed may not be available for all pairs
        }

        pairData.push({
          index,
          name: pair.name,
          price,
          longOi: pairOi?.long || 0,
          shortOi: pairOi?.short || 0,
          utilization: util,
          spread,
          maxLeverage: pair.maxLeverage,
        });
      }

      // Sort by total OI descending
      pairData.sort((a, b) => (b.longOi + b.shortOi) - (a.longOi + a.shortOi));

      setPairs(pairData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { pairs, loading, error, refetch: fetchData };
}
```

### Positions Hook

```typescript
// src/hooks/usePositions.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAvantis } from './useAvantis';

export interface Position {
  pairIndex: number;
  pairName: string;
  tradeIndex: number;
  isLong: boolean;
  collateral: number;
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  tp: number;
  sl: number;
}

export function usePositions(walletAddress?: string, refreshInterval = 5000) {
  const { client } = useAvantis();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPositions = useCallback(async () => {
    if (!client || !walletAddress) {
      setPositions([]);
      setLoading(false);
      return;
    }

    try {
      const [trades, tradesInfo] = await Promise.all([
        client.trade.getOpenTrades(walletAddress),
        client.trade.getOpenTradesInfo(walletAddress),
      ]);

      const positionsData: Position[] = [];

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

        positionsData.push({
          pairIndex: trade.pairIndex,
          pairName: pair?.name || `Pair ${trade.pairIndex}`,
          tradeIndex: trade.index,
          isLong: trade.isLong,
          collateral: trade.collateral,
          leverage: trade.leverage,
          entryPrice: trade.openPrice,
          currentPrice,
          pnl,
          pnlPercent,
          tp: info?.tp || 0,
          sl: info?.sl || 0,
        });
      }

      setPositions(positionsData);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    } finally {
      setLoading(false);
    }
  }, [client, walletAddress]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPositions, refreshInterval]);

  return { positions, loading, refetch: fetchPositions };
}
```

## React Components

### Market Overview Component

```typescript
// src/components/MarketOverview.tsx
'use client';

import { useMarketData, PairData } from '@/hooks/useMarketData';

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatPrice(value: number): string {
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `$${value.toFixed(4)}`;
}

interface MarketRowProps {
  pair: PairData;
  onSelect: (pair: PairData) => void;
}

function MarketRow({ pair, onSelect }: MarketRowProps) {
  const totalOi = pair.longOi + pair.shortOi;
  const longPercent = totalOi > 0 ? (pair.longOi / totalOi) * 100 : 50;

  return (
    <tr
      onClick={() => onSelect(pair)}
      className="hover:bg-gray-50 cursor-pointer border-b"
    >
      <td className="px-4 py-3 font-medium">{pair.name}</td>
      <td className="px-4 py-3 text-right">{formatPrice(pair.price)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${longPercent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {longPercent.toFixed(0)}% L
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">{formatUsd(totalOi)}</td>
      <td className="px-4 py-3 text-right">{pair.spread} bps</td>
      <td className="px-4 py-3 text-right">{pair.maxLeverage}x</td>
    </tr>
  );
}

interface MarketOverviewProps {
  onSelectPair: (pair: PairData) => void;
}

export function MarketOverview({ onSelectPair }: MarketOverviewProps) {
  const { pairs, loading, error } = useMarketData();

  if (loading) {
    return (
      <div className="animate-pulse p-8 text-center text-gray-500">
        Loading market data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Pair</th>
            <th className="px-4 py-3 text-right font-semibold">Price</th>
            <th className="px-4 py-3 text-left font-semibold">Long/Short</th>
            <th className="px-4 py-3 text-right font-semibold">Total OI</th>
            <th className="px-4 py-3 text-right font-semibold">Spread</th>
            <th className="px-4 py-3 text-right font-semibold">Max Lev</th>
          </tr>
        </thead>
        <tbody>
          {pairs.slice(0, 20).map((pair) => (
            <MarketRow key={pair.index} pair={pair} onSelect={onSelectPair} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Market Snapshot Component

```typescript
// src/components/MarketSnapshot.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAvantis } from '@/hooks/useAvantis';

interface SnapshotData {
  pairName: string;
  price: number;
  longOi: number;
  shortOi: number;
  utilization: { long: number; short: number };
  skew: number;
  spread: number;
}

interface MarketSnapshotProps {
  pairIndex: number;
}

export function MarketSnapshot({ pairIndex }: MarketSnapshotProps) {
  const { client } = useAvantis();
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;

    async function fetchSnapshot() {
      try {
        const [pair, oi, util, skew, spread, price] = await Promise.all([
          client!.pairsCache.getPairByIndex(pairIndex),
          client!.assetParameters.getOiForPair(pairIndex),
          client!.blended.getBlendedUtilization(pairIndex),
          client!.blended.getBlendedSkew(pairIndex),
          client!.feeParameters.getSpread(pairIndex),
          client!.feedClient.getPrice(pairIndex).catch(() => 0),
        ]);

        setData({
          pairName: pair?.name || `Pair ${pairIndex}`,
          price,
          longOi: oi.long,
          shortOi: oi.short,
          utilization: util,
          skew: skew.value,
          spread,
        });
      } catch (error) {
        console.error('Failed to fetch snapshot:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 5000);
    return () => clearInterval(interval);
  }, [client, pairIndex]);

  if (loading || !data) {
    return <div className="animate-pulse h-48 bg-gray-100 rounded-lg" />;
  }

  const totalOi = data.longOi + data.shortOi;
  const longPercent = totalOi > 0 ? (data.longOi / totalOi) * 100 : 50;
  const skewDirection = data.skew > 0 ? 'Long' : data.skew < 0 ? 'Short' : 'Neutral';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{data.pairName}</h2>
        <span className="text-3xl font-mono">
          ${data.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Open Interest */}
        <div className="bg-gray-50 rounded p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Open Interest</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-600">Long</span>
              <span>${data.longOi.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">Short</span>
              <span>${data.shortOi.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-red-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500"
                style={{ width: `${longPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Utilization */}
        <div className="bg-gray-50 rounded p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Utilization</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-600">Long</span>
              <span>{data.utilization.long.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">Short</span>
              <span>{data.utilization.short.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Skew */}
        <div className="bg-gray-50 rounded p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Market Skew</h3>
          <div className="text-center">
            <span className={`text-2xl font-bold ${
              data.skew > 0 ? 'text-green-600' : 
              data.skew < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {skewDirection}
            </span>
            <p className="text-sm text-gray-500">
              {(Math.abs(data.skew) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Spread */}
        <div className="bg-gray-50 rounded p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Spread</h3>
          <div className="text-center">
            <span className="text-2xl font-bold">{data.spread}</span>
            <span className="text-gray-500 ml-1">bps</span>
            <p className="text-sm text-gray-500">
              {(data.spread / 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Trade Form Component

```typescript
// src/components/TradeForm.tsx
'use client';

import { useState } from 'react';
import { PairData } from '@/hooks/useMarketData';

interface TradeFormProps {
  pair: PairData;
  onSubmit: (trade: {
    pairIndex: number;
    collateral: number;
    leverage: number;
    isLong: boolean;
    tp: number;
    sl: number;
  }) => Promise<void>;
}

export function TradeForm({ pair, onSubmit }: TradeFormProps) {
  const [isLong, setIsLong] = useState(true);
  const [collateral, setCollateral] = useState('100');
  const [leverage, setLeverage] = useState('10');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const collateralNum = parseFloat(collateral) || 0;
  const leverageNum = parseFloat(leverage) || 1;
  const positionSize = collateralNum * leverageNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await onSubmit({
        pairIndex: pair.index,
        collateral: collateralNum,
        leverage: leverageNum,
        isLong,
        tp: parseFloat(tp) || 0,
        sl: parseFloat(sl) || 0,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Trade {pair.name}</h2>

      {/* Long/Short Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setIsLong(true)}
          className={`flex-1 py-3 rounded font-semibold transition ${
            isLong
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Long
        </button>
        <button
          type="button"
          onClick={() => setIsLong(false)}
          className={`flex-1 py-3 rounded font-semibold transition ${
            !isLong
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Short
        </button>
      </div>

      {/* Collateral Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Collateral (USDC)
        </label>
        <input
          type="number"
          value={collateral}
          onChange={(e) => setCollateral(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          min="10"
          step="10"
        />
      </div>

      {/* Leverage Slider */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Leverage: {leverage}x
        </label>
        <input
          type="range"
          value={leverage}
          onChange={(e) => setLeverage(e.target.value)}
          className="w-full"
          min="1"
          max={pair.maxLeverage}
          step="1"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>1x</span>
          <span>{pair.maxLeverage}x</span>
        </div>
      </div>

      {/* Position Size Display */}
      <div className="bg-gray-50 rounded p-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Position Size</span>
          <span className="font-semibold">${positionSize.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Est. Spread Cost</span>
          <span className="font-semibold">
            ${((positionSize * pair.spread) / 10000).toFixed(2)}
          </span>
        </div>
      </div>

      {/* TP/SL Inputs */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Take Profit
          </label>
          <input
            type="number"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stop Loss
          </label>
          <input
            type="number"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting || collateralNum < 10}
        className={`w-full py-3 rounded-lg font-semibold text-white transition ${
          isLong
            ? 'bg-green-500 hover:bg-green-600'
            : 'bg-red-500 hover:bg-red-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {submitting ? 'Opening Trade...' : `Open ${isLong ? 'Long' : 'Short'}`}
      </button>
    </form>
  );
}
```

### Positions List Component

```typescript
// src/components/PositionsList.tsx
'use client';

import { usePositions, Position } from '@/hooks/usePositions';

interface PositionsListProps {
  walletAddress?: string;
  onClose: (pairIndex: number, tradeIndex: number) => Promise<void>;
}

export function PositionsList({ walletAddress, onClose }: PositionsListProps) {
  const { positions, loading } = usePositions(walletAddress);

  if (!walletAddress) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        Connect wallet to view positions
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-gray-100 rounded" />
          <div className="h-12 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        No open positions
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <h2 className="text-xl font-bold p-4 border-b">Open Positions</h2>
      <div className="divide-y">
        {positions.map((pos) => (
          <PositionRow key={`${pos.pairIndex}-${pos.tradeIndex}`} position={pos} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

interface PositionRowProps {
  position: Position;
  onClose: (pairIndex: number, tradeIndex: number) => Promise<void>;
}

function PositionRow({ position, onClose }: PositionRowProps) {
  const pnlColor = position.pnl >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-semibold">{position.pairName}</span>
          <span
            className={`ml-2 px-2 py-0.5 text-xs rounded ${
              position.isLong
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {position.isLong ? 'LONG' : 'SHORT'} {position.leverage}x
          </span>
        </div>
        <button
          onClick={() => onClose(position.pairIndex, position.tradeIndex)}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Size</span>
          <p className="font-medium">
            ${(position.collateral * position.leverage).toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Entry</span>
          <p className="font-medium">${position.entryPrice.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-500">Current</span>
          <p className="font-medium">${position.currentPrice.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-500">PnL</span>
          <p className={`font-medium ${pnlColor}`}>
            {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
            <span className="text-xs ml-1">
              ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(1)}%)
            </span>
          </p>
        </div>
      </div>

      {(position.tp > 0 || position.sl > 0) && (
        <div className="mt-2 text-xs text-gray-500">
          {position.tp > 0 && <span className="mr-4">TP: ${position.tp}</span>}
          {position.sl > 0 && <span>SL: ${position.sl}</span>}
        </div>
      )}
    </div>
  );
}
```

## Main Page

```typescript
// src/app/page.tsx
'use client';

import { useState } from 'react';
import { MarketOverview } from '@/components/MarketOverview';
import { MarketSnapshot } from '@/components/MarketSnapshot';
import { TradeForm } from '@/components/TradeForm';
import { PositionsList } from '@/components/PositionsList';
import { PairData } from '@/hooks/useMarketData';

export default function Home() {
  const [selectedPair, setSelectedPair] = useState<PairData | null>(null);
  const walletAddress = undefined; // Replace with wallet connection

  const handleTrade = async (trade: {
    pairIndex: number;
    collateral: number;
    leverage: number;
    isLong: boolean;
    tp: number;
    sl: number;
  }) => {
    console.log('Trade submitted:', trade);
    // Implement wallet connection and trade execution
    alert('Connect wallet to trade. Check console for trade details.');
  };

  const handleClosePosition = async (pairIndex: number, tradeIndex: number) => {
    console.log('Close position:', { pairIndex, tradeIndex });
    // Implement close position logic
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Avantis Trading Dashboard</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Market Overview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow mb-8">
              <h2 className="text-xl font-bold p-4 border-b">Markets</h2>
              <MarketOverview onSelectPair={setSelectedPair} />
            </div>

            {/* Positions */}
            <PositionsList
              walletAddress={walletAddress}
              onClose={handleClosePosition}
            />
          </div>

          {/* Right Column - Trading */}
          <div className="space-y-8">
            {selectedPair ? (
              <>
                <MarketSnapshot pairIndex={selectedPair.index} />
                <TradeForm pair={selectedPair} onSubmit={handleTrade} />
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                Select a pair from the market overview to trade
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
```

## API Routes (Server-Side)

```typescript
// src/app/api/market/route.ts
import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/avantis';

export async function GET() {
  try {
    const client = await getServerClient();
    const pairs = await client.pairsCache.getPairsInfo();
    const oi = await client.assetParameters.getOi();

    const data = [];
    for (const [index, pair] of pairs) {
      const pairOi = oi.get(index);
      data.push({
        index,
        name: pair.name,
        longOi: pairOi?.long || 0,
        shortOi: pairOi?.short || 0,
        maxLeverage: pair.maxLeverage,
      });
    }

    return NextResponse.json({ pairs: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
```

## Running the App

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

Visit `http://localhost:3000` to see the trading dashboard.

## Next Steps

- Add wallet connection (wagmi, RainbowKit, or ConnectKit)
- Implement real trade execution
- Add price charts (TradingView or lightweight-charts)
- Add notifications for trade execution
- Implement portfolio analytics

See also:
- [Trading Opportunities](./trading-opportunities.md) - Finding profitable trades
- [Automated Trading](./automated-trading.md) - Building trading bots
