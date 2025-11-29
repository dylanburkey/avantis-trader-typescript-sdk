'use client';

import { formatUsd } from '@/lib/avantis';
import { MarketStats as MarketStatsType } from '@/types';

interface MarketStatsProps {
  stats: MarketStatsType;
  isLoading: boolean;
}

export function MarketStats({ stats, isLoading }: MarketStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  const totalOi = stats.totalLongOi + stats.totalShortOi;
  const longDominance = totalOi > 0 ? (stats.totalLongOi / totalOi) * 100 : 50;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total OI */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Total Open Interest</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
          {formatUsd(totalOi)}
        </p>
      </div>

      {/* Long OI */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Long Open Interest</p>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
          {formatUsd(stats.totalLongOi)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {longDominance.toFixed(1)}% of total
        </p>
      </div>

      {/* Short OI */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Short Open Interest</p>
        <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
          {formatUsd(stats.totalShortOi)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {(100 - longDominance).toFixed(1)}% of total
        </p>
      </div>

      {/* Trading Pairs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Trading Pairs</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
          {stats.totalPairs}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Available for trading
        </p>
      </div>
    </div>
  );
}
