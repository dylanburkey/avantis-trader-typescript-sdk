import { TraderClient } from 'avantisfi-sdk';

let clientPromise: Promise<TraderClient> | null = null;
let tradingClientPromise: Promise<TraderClient> | null = null;

/**
 * Get a read-only client for fetching market data
 */
export async function getReadOnlyClient(): Promise<TraderClient> {
  if (!clientPromise) {
    clientPromise = TraderClient.create();
  }
  return clientPromise;
}

/**
 * Get a trading client with private key
 */
export async function getTradingClient(
  privateKey: `0x${string}`
): Promise<TraderClient> {
  // Always create a new client for different private keys
  return TraderClient.create({ privateKey });
}

/**
 * Format USD values for display
 */
export function formatUsd(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(value: number): string {
  if (value >= 10000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (value >= 1) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(6)}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Shorten wallet address
 */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
