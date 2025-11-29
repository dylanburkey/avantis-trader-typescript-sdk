/**
 * Avantis SDK Utility Functions
 * 
 * Contains helper functions for number conversions, trade calculations,
 * address validation, and other common operations.
 */

import { getAddress, isAddress } from 'viem';
import type { Address, Hex } from 'viem';
import {
  USDC_DECIMALS,
  PRICE_DECIMALS,
  BPS_DIVISOR,
  MIN_LEVERAGE,
  MAX_LEVERAGE_CRYPTO,
} from '../contracts/config';
import type { TradeInput, TradeInputSerialized } from '../types';

// ============================================================================
// Number Conversion Utilities
// ============================================================================

/**
 * Convert a human-readable USDC amount to contract units (6 decimals)
 * @param amount - Amount in USDC (e.g., 100.5)
 * @returns Amount in USDC units (bigint)
 */
export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

/**
 * Convert contract USDC units to human-readable amount
 * @param units - Amount in USDC units (bigint)
 * @returns Amount in USDC (number)
 */
export function fromUsdcUnits(units: bigint): number {
  return Number(units) / 10 ** USDC_DECIMALS;
}

/**
 * Convert a human-readable price to contract units (10 decimals)
 * @param price - Price (e.g., 2500.50)
 * @returns Price in contract units (bigint)
 */
export function toPriceUnits(price: number): bigint {
  return BigInt(Math.round(price * 10 ** PRICE_DECIMALS));
}

/**
 * Convert contract price units to human-readable price
 * @param units - Price in contract units (bigint)
 * @returns Price (number)
 */
export function fromPriceUnits(units: bigint): number {
  return Number(units) / 10 ** PRICE_DECIMALS;
}

/**
 * Convert basis points to percentage
 * @param bps - Basis points (e.g., 50 = 0.5%)
 * @returns Percentage (e.g., 0.5)
 */
export function bpsToPercentage(bps: number): number {
  return bps / 100;
}

/**
 * Convert percentage to basis points
 * @param percentage - Percentage (e.g., 0.5%)
 * @returns Basis points (e.g., 50)
 */
export function percentageToBps(percentage: number): number {
  return Math.round(percentage * 100);
}

// ============================================================================
// Trade Utilities
// ============================================================================

/**
 * Serialize a TradeInput for contract calls
 * @param trade - Trade input parameters
 * @returns Serialized trade input for contract
 */
export function serializeTradeInput(trade: TradeInput): TradeInputSerialized {
  return {
    trader: trade.trader,
    pairIndex: BigInt(trade.pairIndex),
    index: BigInt(trade.index),
    initialPosToken: BigInt(0), // Deprecated field
    positionSizeUsdc: toUsdcUnits(trade.positionSizeUsdc),
    openPrice: toPriceUnits(trade.openPrice),
    buy: trade.buy,
    leverage: BigInt(trade.leverage),
    tp: toPriceUnits(trade.tp),
    sl: toPriceUnits(trade.sl),
    orderType: trade.orderType,
  };
}

/**
 * Calculate position size from collateral and leverage
 * @param collateral - Collateral in USDC
 * @param leverage - Leverage multiplier
 * @returns Position size in USDC
 */
export function calculatePositionSize(collateral: number, leverage: number): number {
  return collateral * leverage;
}

/**
 * Calculate collateral from position size and leverage
 * @param positionSize - Position size in USDC
 * @param leverage - Leverage multiplier
 * @returns Collateral in USDC
 */
export function calculateCollateral(positionSize: number, leverage: number): number {
  return positionSize / leverage;
}

/**
 * Calculate liquidation price for a position
 * @param entryPrice - Entry price
 * @param leverage - Leverage multiplier
 * @param isLong - True for long positions
 * @param marginFeePercentage - Accumulated margin fee as percentage (optional)
 * @returns Liquidation price
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  isLong: boolean,
  marginFeePercentage: number = 0
): number {
  // Liquidation occurs at 90% loss (10% remaining margin)
  const liquidationThreshold = 0.9;
  const effectiveThreshold = liquidationThreshold - marginFeePercentage / 100;
  const priceChange = (effectiveThreshold / leverage) * entryPrice;

  return isLong ? entryPrice - priceChange : entryPrice + priceChange;
}

/**
 * Calculate PnL for a position
 * @param entryPrice - Entry price
 * @param currentPrice - Current market price
 * @param positionSize - Position size in USDC
 * @param isLong - True for long positions
 * @param fees - Total fees paid (opening + margin)
 * @returns PnL in USDC
 */
export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  positionSize: number,
  isLong: boolean,
  fees: number = 0
): number {
  const priceChange = isLong
    ? (currentPrice - entryPrice) / entryPrice
    : (entryPrice - currentPrice) / entryPrice;

  return positionSize * priceChange - fees;
}

/**
 * Calculate PnL percentage for a position
 * @param entryPrice - Entry price
 * @param currentPrice - Current market price
 * @param leverage - Leverage multiplier
 * @param isLong - True for long positions
 * @returns PnL percentage
 */
export function calculatePnLPercentage(
  entryPrice: number,
  currentPrice: number,
  leverage: number,
  isLong: boolean
): number {
  const priceChangePercentage = isLong
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100;

  return priceChangePercentage * leverage;
}

// ============================================================================
// Address Utilities
// ============================================================================

/**
 * Validate and checksum an Ethereum address
 * @param address - Address string to validate
 * @returns Checksummed address
 * @throws If address is invalid
 */
export function validateAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return getAddress(address);
}

/**
 * Check if a string is a valid Ethereum address
 * @param address - Address string to check
 * @returns True if valid
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Shorten an address for display
 * @param address - Full address
 * @param chars - Number of characters to show on each side (default: 4)
 * @returns Shortened address (e.g., "0x1234...5678")
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!isAddress(address)) {
    return address;
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// ============================================================================
// Hex Utilities
// ============================================================================

/**
 * Ensure a string has 0x prefix
 * @param value - String to check
 * @returns String with 0x prefix
 */
export function ensureHexPrefix(value: string): Hex {
  if (value.startsWith('0x')) {
    return value as Hex;
  }
  return `0x${value}` as Hex;
}

/**
 * Remove 0x prefix from a string
 * @param value - String to process
 * @returns String without 0x prefix
 */
export function removeHexPrefix(value: string): string {
  if (value.startsWith('0x')) {
    return value.slice(2);
  }
  return value;
}

// ============================================================================
// Pair Utilities
// ============================================================================

/**
 * Format a pair name from base and quote
 * @param base - Base asset (e.g., "ETH")
 * @param quote - Quote asset (e.g., "USD")
 * @returns Formatted pair name (e.g., "ETH/USD")
 */
export function formatPairName(base: string, quote: string): string {
  return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}

/**
 * Parse a pair name into base and quote
 * @param pairName - Pair name (e.g., "ETH/USD")
 * @returns Object with base and quote
 */
export function parsePairName(pairName: string): { base: string; quote: string } {
  const parts = pairName.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid pair name format: ${pairName}`);
  }
  return {
    base: parts[0].toUpperCase(),
    quote: parts[1].toUpperCase(),
  };
}

// ============================================================================
// Slippage Utilities
// ============================================================================

/**
 * Calculate slippage amount from price and slippage percentage
 * @param price - Current price
 * @param slippageBps - Slippage in basis points
 * @returns Slippage amount
 */
export function calculateSlippageAmount(price: number, slippageBps: number): number {
  return (price * slippageBps) / BPS_DIVISOR;
}

/**
 * Apply slippage to a price
 * @param price - Original price
 * @param slippageBps - Slippage in basis points
 * @param isLong - True for long (price increases), false for short (price decreases)
 * @returns Price with slippage applied
 */
export function applySlippage(price: number, slippageBps: number, isLong: boolean): number {
  const slippageAmount = calculateSlippageAmount(price, slippageBps);
  return isLong ? price + slippageAmount : price - slippageAmount;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate leverage is within bounds
 * @param leverage - Leverage to validate
 * @param minLeverage - Minimum allowed (default: MIN_LEVERAGE)
 * @param maxLeverage - Maximum allowed (default: MAX_LEVERAGE_CRYPTO)
 * @returns True if valid
 * @throws If leverage is out of bounds
 */
export function validateLeverage(
  leverage: number,
  minLeverage: number = MIN_LEVERAGE,
  maxLeverage: number = MAX_LEVERAGE_CRYPTO
): boolean {
  if (leverage < minLeverage || leverage > maxLeverage) {
    throw new Error(
      `Leverage ${leverage} is out of bounds. Must be between ${minLeverage} and ${maxLeverage}`
    );
  }
  return true;
}

/**
 * Validate collateral amount is positive
 * @param collateral - Collateral amount
 * @returns True if valid
 * @throws If collateral is not positive
 */
export function validateCollateral(collateral: number): boolean {
  if (collateral <= 0) {
    throw new Error('Collateral must be positive');
  }
  return true;
}

/**
 * Validate a complete trade input
 * @param trade - Trade input to validate
 * @throws If any validation fails
 */
export function validateTradeInput(trade: TradeInput): void {
  validateAddress(trade.trader);
  validateCollateral(trade.positionSizeUsdc / trade.leverage);
  validateLeverage(trade.leverage);

  if (trade.pairIndex < 0) {
    throw new Error('Pair index must be non-negative');
  }

  if (trade.index < 0) {
    throw new Error('Trade index must be non-negative');
  }

  if (trade.slippageP < 0 || trade.slippageP > BPS_DIVISOR) {
    throw new Error('Slippage must be between 0 and 10000 bps');
  }

  // Validate TP/SL relative to entry price for limit/market orders
  if (trade.openPrice > 0) {
    if (trade.tp > 0) {
      if (trade.buy && trade.tp <= trade.openPrice) {
        throw new Error('Take profit must be above entry price for long positions');
      }
      if (!trade.buy && trade.tp >= trade.openPrice) {
        throw new Error('Take profit must be below entry price for short positions');
      }
    }

    if (trade.sl > 0) {
      if (trade.buy && trade.sl >= trade.openPrice) {
        throw new Error('Stop loss must be below entry price for long positions');
      }
      if (!trade.buy && trade.sl <= trade.openPrice) {
        throw new Error('Stop loss must be above entry price for short positions');
      }
    }
  }
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Get current timestamp in seconds
 * @returns Current Unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format a timestamp to ISO string
 * @param timestamp - Unix timestamp in seconds
 * @returns ISO date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Delay execution for a specified time
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, attempt);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Fee Calculation Utilities
// ============================================================================

/**
 * Calculate fee amount in USDC
 * @param positionSize - Position size in USDC
 * @param feeBps - Fee in basis points
 * @returns Fee amount in USDC
 */
export function calculateFeeUsdc(positionSize: number, feeBps: number): number {
  return (positionSize * feeBps) / BPS_DIVISOR;
}

/**
 * Calculate effective collateral after fees
 * @param collateral - Initial collateral in USDC
 * @param openingFeeBps - Opening fee in basis points
 * @param leverage - Leverage multiplier
 * @returns Effective collateral after fees
 */
export function calculateEffectiveCollateral(
  collateral: number,
  openingFeeBps: number,
  leverage: number
): number {
  const positionSize = collateral * leverage;
  const openingFee = calculateFeeUsdc(positionSize, openingFeeBps);
  return collateral - openingFee;
}
