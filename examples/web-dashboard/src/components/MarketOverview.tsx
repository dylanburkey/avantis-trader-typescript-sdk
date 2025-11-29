'use client';

import { formatUsd, formatPrice } from '@/lib/avantis';
import { PairData } from '@/types';

interface MarketOverviewProps {
  pairs: PairData[];
  isLoading: boolean;
  onSelectPair: (pair: PairData) => void;
  selectedPairIndex: number | null;
}

export function MarketOverview({
  pairs,
  isLoading,
  onSelectPair,
  selectedPairIndex,
}: MarketOverviewProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Markets
          </h2>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Loading market data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Markets
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {pairs.length} pairs
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pair
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Long/Short
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total OI
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Spread
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Max Lev
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {pairs.slice(0, 20).map((pair) => (
              <MarketRow
                key={pair.index}
                pair={pair}
                isSelected={selectedPairIndex === pair.index}
                onSelect={() => onSelectPair(pair)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pairs.length > 20 && (
        <div className="p-3 text-center border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing 20 of {pairs.length} pairs
          </p>
        </div>
      )}
    </div>
  );
}

interface MarketRowProps {
  pair: PairData;
  isSelected: boolean;
  onSelect: () => void;
}

function MarketRow({ pair, isSelected, onSelect }: MarketRowProps) {
  const totalOi = pair.longOi + pair.shortOi;
  const longPercent = totalOi > 0 ? (pair.longOi / totalOi) * 100 : 50;

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer transition-colors ${
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center">
          <span className="font-medium text-gray-900 dark:text-white">
            {pair.name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-gray-900 dark:text-white font-mono">
          {formatPrice(pair.price)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="w-20 h-2 bg-red-200 dark:bg-red-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${longPercent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12">
            {longPercent.toFixed(0)}% L
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-gray-600 dark:text-gray-300">
          {formatUsd(totalOi)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-gray-600 dark:text-gray-300">
          {pair.spread} bps
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-gray-600 dark:text-gray-300">
          {pair.maxLeverage}x
        </span>
      </td>
    </tr>
  );
}
