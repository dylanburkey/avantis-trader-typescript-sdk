'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getTradingClient } from '@/lib/avantis';
import { PairData } from '@/types';
import { TradeInput } from 'avantisfi-sdk';

interface TradeFormProps {
  pair: PairData | null;
  isConnected: boolean;
  privateKey: string | null;
  balance: number;
}

export function TradeForm({ pair, isConnected, privateKey, balance }: TradeFormProps) {
  const [isLong, setIsLong] = useState(true);
  const [collateral, setCollateral] = useState('100');
  const [leverage, setLeverage] = useState('10');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');

  const queryClient = useQueryClient();

  const openTrade = useMutation({
    mutationFn: async (trade: TradeInput) => {
      if (!privateKey) throw new Error('No wallet connected');
      const client = await getTradingClient(privateKey as `0x${string}`);

      // Approve USDC if needed
      const trading = client.contracts.Trading.address;
      const allowance = await client.getUsdcAllowance(trading);
      if (allowance < trade.collateral) {
        await client.approveUsdc(trading, trade.collateral * 2);
      }

      return client.trade.openTrade(trade);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      // Reset form
      setCollateral('100');
      setLeverage('10');
      setTp('');
      setSl('');
    },
  });

  if (!pair) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-center text-gray-500 dark:text-gray-400">
          Select a pair to trade
        </p>
      </div>
    );
  }

  const collateralNum = parseFloat(collateral) || 0;
  const leverageNum = parseFloat(leverage) || 1;
  const positionSize = collateralNum * leverageNum;
  const estimatedSpreadCost = (positionSize * pair.spread) / 10000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trade: TradeInput = {
      pairIndex: pair.index,
      collateral: collateralNum,
      openPrice: 0, // Market order
      isLong,
      leverage: leverageNum,
      takeProfit: parseFloat(tp) || 0,
      stopLoss: parseFloat(sl) || 0,
      orderType: 0, // Market
      timestamp: Math.floor(Date.now() / 1000),
    };

    openTrade.mutate(trade);
  };

  const canTrade = isConnected && collateralNum >= 10 && collateralNum <= balance;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Trade {pair.name}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Long/Short Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsLong(true)}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              isLong
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Long
          </button>
          <button
            type="button"
            onClick={() => setIsLong(false)}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              !isLong
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Short
          </button>
        </div>

        {/* Collateral */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Collateral (USDC)
            </label>
            {isConnected && (
              <button
                type="button"
                onClick={() => setCollateral(Math.floor(balance).toString())}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Max: ${balance.toFixed(2)}
              </button>
            )}
          </div>
          <input
            type="number"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            min="10"
            step="10"
            placeholder="100"
          />
        </div>

        {/* Leverage Slider */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Leverage
            </label>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {leverage}x
            </span>
          </div>
          <input
            type="range"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
            min="1"
            max={pair.maxLeverage}
            step="1"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>1x</span>
            <span>{Math.floor(pair.maxLeverage / 2)}x</span>
            <span>{pair.maxLeverage}x</span>
          </div>
        </div>

        {/* Position Info */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Position Size</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ${positionSize.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Est. Spread Cost</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ${estimatedSpreadCost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Entry Price</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ~${pair.price.toFixed(2)}
            </span>
          </div>
        </div>

        {/* TP/SL */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Take Profit
            </label>
            <input
              type="number"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stop Loss
            </label>
            <input
              type="number"
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
        </div>

        {/* Error Message */}
        {openTrade.isError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              {openTrade.error instanceof Error
                ? openTrade.error.message
                : 'Failed to open trade'}
            </p>
          </div>
        )}

        {/* Success Message */}
        {openTrade.isSuccess && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">
              Trade opened successfully!
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!canTrade || openTrade.isPending}
          className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
            isLong
              ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-300'
              : 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
          } disabled:cursor-not-allowed`}
        >
          {openTrade.isPending ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Opening Trade...
            </span>
          ) : !isConnected ? (
            'Connect Wallet to Trade'
          ) : collateralNum > balance ? (
            'Insufficient Balance'
          ) : (
            `Open ${isLong ? 'Long' : 'Short'}`
          )}
        </button>
      </form>
    </div>
  );
}
