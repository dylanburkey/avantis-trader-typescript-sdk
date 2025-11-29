'use client';

import { formatUsd, formatPrice, formatPercent } from '@/lib/avantis';
import { PairData } from '@/types';

interface PairDetailsProps {
  pair: PairData | null;
  isLoading: boolean;
}

export function PairDetails({ pair, isLoading }: PairDetailsProps) {
  if (!pair) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="text-gray-400 dark:text-gray-500">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          <p className="mt-2 text-sm">Select a pair to view details</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalOi = pair.longOi + pair.shortOi;
  const longPercent = totalOi > 0 ? (pair.longOi / totalOi) * 100 : 50;
  const skewDirection = pair.skew > 0 ? 'Long' : pair.skew < 0 ? 'Short' : 'Neutral';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {pair.name}
          </h2>
          <span className="text-2xl font-mono text-gray-900 dark:text-white">
            {formatPrice(pair.price)}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Open Interest Bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-green-600 dark:text-green-400">
              Long: {formatUsd(pair.longOi)}
            </span>
            <span className="text-red-600 dark:text-red-400">
              Short: {formatUsd(pair.shortOi)}
            </span>
          </div>
          <div className="h-3 bg-red-200 dark:bg-red-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${longPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
            {longPercent.toFixed(1)}% Long / {(100 - longPercent).toFixed(1)}% Short
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Utilization */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Long Utilization
            </p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {pair.utilization.long.toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Short Utilization
            </p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
              {pair.utilization.short.toFixed(1)}%
            </p>
          </div>

          {/* Skew */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Market Skew
            </p>
            <p
              className={`text-lg font-semibold ${
                pair.skew > 0
                  ? 'text-green-600 dark:text-green-400'
                  : pair.skew < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {skewDirection} {formatPercent(Math.abs(pair.skew) * 100, 1)}
            </p>
          </div>

          {/* Spread */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Spread
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {pair.spread} bps
            </p>
          </div>

          {/* Max Leverage */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Max Leverage
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {pair.maxLeverage}x
            </p>
          </div>

          {/* Total OI */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Total OI
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatUsd(totalOi)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
