'use client';

import { useState } from 'react';
import { formatUsd, shortenAddress } from '@/lib/avantis';
import { WalletState } from '@/types';

interface HeaderProps {
  wallet: WalletState;
  onConnect: (privateKey: string) => void;
  onDisconnect: () => void;
}

export function Header({ wallet, onConnect, onDisconnect }: HeaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [error, setError] = useState('');

  const handleConnect = () => {
    try {
      setError('');
      onConnect(privateKey);
      setShowModal(false);
      setPrivateKey('');
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : 'Failed to connect') +
        '. Please ensure your private key is in the correct format: 0x followed by 64 hexadecimal characters.'
      );
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  Avantis
                </h1>
              </div>
              <nav className="hidden md:ml-8 md:flex md:space-x-4">
                <a
                  href="#markets"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium"
                >
                  Markets
                </a>
                <a
                  href="#trade"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium"
                >
                  Trade
                </a>
                <a
                  href="#positions"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium"
                >
                  Positions
                </a>
              </nav>
            </div>

            {/* Wallet */}
            <div className="flex items-center space-x-4">
              {wallet.isConnected ? (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatUsd(wallet.balance)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {shortenAddress(wallet.address!)}
                    </p>
                  </div>
                  <button
                    onClick={onDisconnect}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Connect Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Connect Wallet
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Private Key
                  </label>
                  <input
                    type="password"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Your private key is stored locally and never sent to any server.
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={!privateKey}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Connect
                  </button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Warning:</strong> This is a demo application. Never enter your
                  real private key on untrusted websites. Use a test wallet with small
                  amounts only.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
