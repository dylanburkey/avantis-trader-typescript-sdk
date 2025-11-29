'use client';

import { useState } from 'react';
import { formatUsd, formatPrice, formatPercent } from '@/lib/avantis';
import { Position } from '@/types';
import { useClosePosition, useUpdateTpSl } from '@/hooks/usePositions';

interface PositionsListProps {
  positions: Position[];
  isLoading: boolean;
  isConnected: boolean;
  privateKey: string | null;
}

export function PositionsList({
  positions,
  isLoading,
  isConnected,
  privateKey,
}: PositionsListProps) {
  if (!isConnected) {
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="mt-2 text-sm">Connect wallet to view positions</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Open Positions
          </h2>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Loading positions...
          </p>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Open Positions
          </h2>
        </div>
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <p>No open positions</p>
          <p className="text-sm mt-1">Open a trade to get started</p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalCollateral = positions.reduce((sum, p) => sum + p.collateral, 0);
  const totalPnlPercent = (totalPnl / totalCollateral) * 100;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Open Positions ({positions.length})
          </h2>
          <div className="text-right">
            <p
              className={`text-lg font-semibold ${
                totalPnl >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatPercent(totalPnlPercent)}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {positions.map((position) => (
          <PositionRow
            key={`${position.pairIndex}-${position.tradeIndex}`}
            position={position}
            privateKey={privateKey}
          />
        ))}
      </div>
    </div>
  );
}

interface PositionRowProps {
  position: Position;
  privateKey: string | null;
}

function PositionRow({ position, privateKey }: PositionRowProps) {
  const [showActions, setShowActions] = useState(false);
  const [newTp, setNewTp] = useState(position.tp.toString());
  const [newSl, setNewSl] = useState(position.sl.toString());

  const closePosition = useClosePosition(privateKey);
  const updateTpSl = useUpdateTpSl(privateKey);

  const pnlColor =
    position.pnl >= 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  const handleClose = () => {
    if (confirm('Are you sure you want to close this position?')) {
      closePosition.mutate({
        pairIndex: position.pairIndex,
        tradeIndex: position.tradeIndex,
      });
    }
  };

  const handleUpdateTpSl = () => {
    const tp = parseFloat(newTp) || 0;
    const sl = parseFloat(newSl) || 0;

    updateTpSl.mutate({
      pairIndex: position.pairIndex,
      tradeIndex: position.tradeIndex,
      tp: tp !== position.tp ? tp : undefined,
      sl: sl !== position.sl ? sl : undefined,
    });
    setShowActions(false);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-900 dark:text-white">
              {position.pairName}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                position.isLong
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {position.isLong ? 'LONG' : 'SHORT'} {position.leverage}x
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Size: ${position.positionSize.toLocaleString()}
          </p>
        </div>

        <div className="text-right">
          <p className={`text-lg font-semibold ${pnlColor}`}>
            {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
          </p>
          <p className={`text-sm ${pnlColor}`}>
            {formatPercent(position.pnlPercent)}
          </p>
        </div>
      </div>

      {/* Price Info */}
      <div className="grid grid-cols-4 gap-2 text-sm mb-3">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Entry</p>
          <p className="text-gray-900 dark:text-white font-medium">
            {formatPrice(position.entryPrice)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Current</p>
          <p className="text-gray-900 dark:text-white font-medium">
            {formatPrice(position.currentPrice)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Liq. Price</p>
          <p className="text-orange-600 dark:text-orange-400 font-medium">
            {formatPrice(position.liquidationPrice)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Collateral</p>
          <p className="text-gray-900 dark:text-white font-medium">
            ${position.collateral.toFixed(2)}
          </p>
        </div>
      </div>

      {/* TP/SL */}
      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <span>
          TP: {position.tp > 0 ? formatPrice(position.tp) : 'Not set'}
        </span>
        <span>
          SL: {position.sl > 0 ? formatPrice(position.sl) : 'Not set'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={() => setShowActions(!showActions)}
          className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          {showActions ? 'Cancel' : 'Modify'}
        </button>
        <button
          onClick={handleClose}
          disabled={closePosition.isPending}
          className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          {closePosition.isPending ? 'Closing...' : 'Close'}
        </button>
      </div>

      {/* Modify Panel */}
      {showActions && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Take Profit
              </label>
              <input
                type="number"
                value={newTp}
                onChange={(e) => setNewTp(e.target.value)}
                placeholder="0 = None"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stop Loss
              </label>
              <input
                type="number"
                value={newSl}
                onChange={(e) => setNewSl(e.target.value)}
                placeholder="0 = None"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={handleUpdateTpSl}
            disabled={updateTpSl.isPending}
            className="w-full px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {updateTpSl.isPending ? 'Updating...' : 'Update TP/SL'}
          </button>
        </div>
      )}

      {/* Error Messages */}
      {(closePosition.isError || updateTpSl.isError) && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
          {closePosition.error?.message || updateTpSl.error?.message}
        </div>
      )}
    </div>
  );
}
