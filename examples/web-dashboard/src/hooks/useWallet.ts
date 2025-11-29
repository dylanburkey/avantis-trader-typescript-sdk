'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getTradingClient, getReadOnlyClient } from '@/lib/avantis';
import { privateKeyToAccount } from 'viem/accounts';
import { WalletState } from '@/types';

const WALLET_STORAGE_KEY = 'avantis_wallet';

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    privateKey: null,
    balance: 0,
    isConnected: false,
  });

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(WALLET_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.privateKey) {
            connectWallet(parsed.privateKey);
          }
        } catch {}
      }
    }
  }, []);

  // Fetch balance
  const { data: balance, refetch: refetchBalance } = useQuery({
    queryKey: ['balance', wallet.address],
    queryFn: async () => {
      if (!wallet.address) return 0;
      const client = await getReadOnlyClient();
      return client.getUsdcBalance(wallet.address);
    },
    enabled: !!wallet.address,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (balance !== undefined) {
      setWallet((prev) => ({ ...prev, balance }));
    }
  }, [balance]);

  const connectWallet = useCallback((privateKey: string) => {
    try {
      // Validate private key format
      if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
        throw new Error('Invalid private key format');
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`);

      setWallet({
        address: account.address,
        privateKey,
        balance: 0,
        isConnected: true,
      });

      // Store in localStorage (be careful with this in production!)
      localStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ privateKey })
      );

      return account.address;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWallet({
      address: null,
      privateKey: null,
      balance: 0,
      isConnected: false,
    });
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

  return {
    wallet,
    connectWallet,
    disconnectWallet,
    refetchBalance,
  };
}

export function useApproveUsdc(privateKey: string | null) {
  return useMutation({
    mutationFn: async ({ spender, amount }: { spender: string; amount: number }) => {
      if (!privateKey) throw new Error('No private key');
      const client = await getTradingClient(privateKey as `0x${string}`);
      return client.approveUsdc(spender, amount);
    },
  });
}
