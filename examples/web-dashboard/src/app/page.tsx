'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { MarketStats } from '@/components/MarketStats';
import { MarketOverview } from '@/components/MarketOverview';
import { PairDetails } from '@/components/PairDetails';
import { TradeForm } from '@/components/TradeForm';
import { PositionsList } from '@/components/PositionsList';
import { useMarketData, useMarketStats, usePairData } from '@/hooks/useMarketData';
import { usePositions } from '@/hooks/usePositions';
import { useWallet } from '@/hooks/useWallet';
import { PairData } from '@/types';

export default function Home() {
  const [selectedPairIndex, setSelectedPairIndex] = useState<number | null>(null);

  const { wallet, connectWallet, disconnectWallet } = useWallet();
  const { data: pairs, isLoading: pairsLoading } = useMarketData();
  const stats = useMarketStats(pairs);

  const { data: selectedPairData, isLoading: pairLoading } = usePairData(
    selectedPairIndex === null ? undefined : selectedPairIndex
  );

  const { data: positions, isLoading: positionsLoading } = usePositions(
    wallet.address,
    wallet.privateKey
  );

  const handleSelectPair = (pair: PairData) => {
    setSelectedPairIndex(pair.index);
  };

  const selectedPair = selectedPairIndex !== null ? selectedPairData : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header
        wallet={wallet}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Market Stats */}
        <section className="mb-8">
          <MarketStats stats={stats} isLoading={pairsLoading} />
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Markets */}
          <div className="lg:col-span-2 space-y-8">
            <section id="markets">
              <MarketOverview
                pairs={pairs || []}
                isLoading={pairsLoading}
                onSelectPair={handleSelectPair}
                selectedPairIndex={selectedPairIndex}
              />
            </section>

            {/* Positions */}
            <section id="positions">
              <PositionsList
                positions={positions || []}
                isLoading={positionsLoading}
                isConnected={wallet.isConnected}
                privateKey={wallet.privateKey}
              />
            </section>
          </div>

          {/* Right Column - Trading */}
          <div className="space-y-6" id="trade">
            <PairDetails pair={selectedPair || null} isLoading={pairLoading && selectedPairIndex !== null} />
            <TradeForm
              pair={selectedPair || null}
              isConnected={wallet.isConnected}
              privateKey={wallet.privateKey}
              balance={wallet.balance}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 py-8 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Avantis TypeScript SDK Demo</p>
            <p className="mt-1">
              <a
                href="https://github.com/dylanburkey/avantis-trader-typescript-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700"
              >
                View on GitHub
              </a>
              {' | '}
              <a
                href="https://avantisfi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700"
              >
                Avantis Protocol
              </a>
            </p>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 max-w-xl mx-auto">
              This is a demo application for educational purposes. Use at your own risk.
              Never enter your real private key on untrusted websites.
              Always use a test wallet with small amounts.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
