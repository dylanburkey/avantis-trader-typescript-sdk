/**
 * @fileoverview Trade RPC Module
 *
 * Handles all trade-related operations including opening, closing,
 * updating trades, and fetching trade information.
 *
 * @module rpc/trade
 */

import {
  encodeFunctionData,
  type Address,
  type TransactionReceipt,
} from "viem";

import {
  CONTRACT_ADDRESSES,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_EXECUTION_FEE,
  BPS_DIVISOR,
} from "../contracts/config";
import { TRADING_ABI, MULTICALL_ABI } from "../contracts/abis";
import type {
  TradeInput,
  TradeInputOrderType,
  TradeExtendedResponse,
  PendingLimitOrderExtendedResponse,
  MarginUpdateType,
  TransactionRequest,
} from "../types";
import {
  toUsdcUnits,
  fromUsdcUnits,
  toPriceUnits,
  fromPriceUnits,
  serializeTradeInput,
  validateTradeInput,
  calculateLiquidationPrice,
  calculatePnL,
  calculatePnLPercentage,
} from "../utils";
import type { TraderClient } from "../client/trader-client";
import type { FeedClient } from "../feed";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for building a trade open transaction
 */
export interface TradeOpenOptions {
  /** Trade input parameters */
  trade: TradeInput;
  /** Order type (market, limit, stop-limit) */
  orderType?: TradeInputOrderType;
  /** Slippage tolerance in basis points (default: 50 = 0.5%) */
  slippageBps?: number;
  /** Referral address (optional) */
  referrer?: Address;
}

/**
 * Options for building a trade close transaction
 */
export interface TradeCloseOptions {
  /** Pair index */
  pairIndex: number;
  /** Trade index */
  index: number;
  /** Percentage of position to close (1-100) */
  percentage?: number;
}

/**
 * Options for updating margin
 */
export interface MarginUpdateOptions {
  /** Pair index */
  pairIndex: number;
  /** Trade index */
  index: number;
  /** Collateral delta in USDC (positive for deposit, negative for withdraw) */
  collateralDelta: number;
  /** Update type */
  updateType: MarginUpdateType;
}

/**
 * Position data from Multicall contract
 */
interface PositionData {
  trade: {
    trader: Address;
    pairIndex: bigint;
    index: bigint;
    initialPosToken: bigint;
    positionSizeUSDC: bigint;
    openPrice: bigint;
    buy: boolean;
    leverage: bigint;
    tp: bigint;
    sl: bigint;
    timestamp: bigint;
  };
  tradeInfo: {
    openInterestUSDC: bigint;
    tpLastUpdated: bigint;
    slLastUpdated: bigint;
    beingMarketClosed: boolean;
    lossProtectionTier: bigint;
  };
  marginFee: bigint;
  liquidationPrice: bigint;
}

/**
 * Pending order data from Multicall contract
 */
interface PendingOrderData {
  order: {
    trader: Address;
    pairIndex: bigint;
    index: bigint;
    positionSize: bigint;
    buy: boolean;
    leverage: bigint;
    tp: bigint;
    sl: bigint;
    price: bigint;
    slippageP: bigint;
    block: bigint;
  };
  liquidationPrice: bigint;
}

// ============================================================================
// Trade RPC Class
// ============================================================================

/**
 * RPC module for trade operations
 *
 * @example
 * ```typescript
 * // Open a market trade
 * const tx = await client.trade.buildTradeOpenTx({
 *   trade: {
 *     trader: '0x...',
 *     pairIndex: 0,
 *     index: 0,
 *     positionSizeUsdc: 1000,
 *     openPrice: 0, // Market order
 *     buy: true,
 *     leverage: 10,
 *     tp: 0,
 *     sl: 0,
 *     orderType: TradeInputOrderType.MARKET,
 *     slippageP: 50,
 *   }
 * });
 * ```
 */
export class TradeRPC {
  private client: TraderClient;
  private feedClient: FeedClient;

  /**
   * Create a new TradeRPC instance
   * @param client - TraderClient instance
   * @param feedClient - FeedClient instance for price updates
   */
  constructor(client: TraderClient, feedClient: FeedClient) {
    this.client = client;
    this.feedClient = feedClient;
  }

  // ============================================================================
  // Trade Building Methods
  // ============================================================================

  /**
   * Build a transaction to open a trade
   * @param options - Trade open options
   * @returns Transaction request ready to be signed and sent
   */
  async buildTradeOpenTx(
    options: TradeOpenOptions,
  ): Promise<TransactionRequest> {
    const {
      trade,
      orderType = trade.orderType,
      slippageBps = trade.slippageP || DEFAULT_SLIPPAGE_BPS,
    } = options;

    // Validate trade input
    validateTradeInput(trade);

    // Get price update data from Pyth
    const pairInfo = await this.client.pairsCache.getPairInfo(trade.pairIndex);
    const priceUpdateData = await this.feedClient.getPriceUpdateData([
      pairInfo.feed.feedId,
    ]);

    // Serialize trade input for contract
    const serializedTrade = serializeTradeInput(trade);

    // Encode function call
    const data = encodeFunctionData({
      abi: TRADING_ABI,
      functionName: "openTrade",
      args: [
        serializedTrade,
        orderType,
        BigInt(slippageBps),
        priceUpdateData.data,
      ],
    });

    // Calculate execution fee
    const executionFee = await this.getExecutionFee();
    const totalValue = executionFee + priceUpdateData.updateFee;

    return {
      to: CONTRACT_ADDRESSES.Trading,
      data,
      value: totalValue,
    };
  }

  /**
   * Build a transaction to close a trade at market
   * @param options - Trade close options
   * @returns Transaction request ready to be signed and sent
   */
  async buildTradeCloseTx(
    options: TradeCloseOptions,
  ): Promise<TransactionRequest> {
    const { pairIndex, index } = options;

    // Get price update data from Pyth
    const pairInfo = await this.client.pairsCache.getPairInfo(pairIndex);
    const priceUpdateData = await this.feedClient.getPriceUpdateData([
      pairInfo.feed.feedId,
    ]);

    // Encode function call
    const data = encodeFunctionData({
      abi: TRADING_ABI,
      functionName: "closeTradeMarket",
      args: [BigInt(pairIndex), BigInt(index), priceUpdateData.data],
    });

    return {
      to: CONTRACT_ADDRESSES.Trading,
      data,
      value: priceUpdateData.updateFee,
    };
  }

  /**
   * Build a transaction to cancel a limit order
   * @param pairIndex - Pair index
   * @param index - Order index
   * @returns Transaction request
   */
  async buildCancelLimitOrderTx(
    pairIndex: number,
    index: number,
  ): Promise<TransactionRequest> {
    const data = encodeFunctionData({
      abi: TRADING_ABI,
      functionName: "cancelOpenLimitOrder",
      args: [BigInt(pairIndex), BigInt(index)],
    });

    return {
      to: CONTRACT_ADDRESSES.Trading,
      data,
      value: 0n,
    };
  }

  /**
   * Build a transaction to update take profit
   * @param pairIndex - Pair index
   * @param index - Trade index
   * @param newTp - New take profit price
   * @returns Transaction request
   */
  async buildUpdateTpTx(
    pairIndex: number,
    index: number,
    newTp: number,
  ): Promise<TransactionRequest> {
    const data = encodeFunctionData({
      abi: TRADING_ABI,
      functionName: "updateTp",
      args: [BigInt(pairIndex), BigInt(index), toPriceUnits(newTp)],
    });

    return {
      to: CONTRACT_ADDRESSES.Trading,
      data,
      value: 0n,
    };
  }

  /**
   * Build a transaction to update stop loss
   * @param pairIndex - Pair index
   * @param index - Trade index
   * @param newSl - New stop loss price
   * @returns Transaction request
   */
  async buildUpdateSlTx(
    pairIndex: number,
    index: number,
    newSl: number,
  ): Promise<TransactionRequest> {
    const data = encodeFunctionData({
      abi: TRADING_ABI,
      functionName: "updateSl",
      args: [BigInt(pairIndex), BigInt(index), toPriceUnits(newSl)],
    });

    return {
      to: CONTRACT_ADDRESSES.Trading,
      data,
      value: 0n,
    };
  }

  /**
   * Build a transaction to update margin (add/remove collateral)
   * @param options - Margin update options
   * @returns Transaction request
   */
  async buildUpdateMarginTx(
    options: MarginUpdateOptions,
  ): Promise<TransactionRequest> {
    const { pairIndex, index, collateralDelta, updateType } = options;

    const data = encodeFunctionData({
      abi: TRADING_ABI,
      functionName: "updateMargin",
      args: [
        BigInt(pairIndex),
        BigInt(index),
        toUsdcUnits(Math.abs(collateralDelta)),
        updateType,
      ],
    });

    return {
      to: CONTRACT_ADDRESSES.Trading,
      data,
      value: 0n,
    };
  }

  // ============================================================================
  // Trade Execution Methods
  // ============================================================================

  /**
   * Open a trade (builds and sends transaction)
   * @param options - Trade open options
   * @returns Transaction receipt
   */
  async openTrade(options: TradeOpenOptions): Promise<TransactionReceipt> {
    const tx = await this.buildTradeOpenTx(options);
    return this.client.signAndSendTransaction(tx);
  }

  /**
   * Close a trade at market (builds and sends transaction)
   * @param options - Trade close options
   * @returns Transaction receipt
   */
  async closeTrade(options: TradeCloseOptions): Promise<TransactionReceipt> {
    const tx = await this.buildTradeCloseTx(options);
    return this.client.signAndSendTransaction(tx);
  }

  /**
   * Cancel a limit order
   * @param pairIndex - Pair index
   * @param index - Order index
   * @returns Transaction receipt
   */
  async cancelLimitOrder(
    pairIndex: number,
    index: number,
  ): Promise<TransactionReceipt> {
    const tx = await this.buildCancelLimitOrderTx(pairIndex, index);
    return this.client.signAndSendTransaction(tx);
  }

  /**
   * Update take profit for a trade
   * @param pairIndex - Pair index
   * @param index - Trade index
   * @param newTp - New take profit price
   * @returns Transaction receipt
   */
  async updateTp(
    pairIndex: number,
    index: number,
    newTp: number,
  ): Promise<TransactionReceipt> {
    const tx = await this.buildUpdateTpTx(pairIndex, index, newTp);
    return this.client.signAndSendTransaction(tx);
  }

  /**
   * Update stop loss for a trade
   * @param pairIndex - Pair index
   * @param index - Trade index
   * @param newSl - New stop loss price
   * @returns Transaction receipt
   */
  async updateSl(
    pairIndex: number,
    index: number,
    newSl: number,
  ): Promise<TransactionReceipt> {
    const tx = await this.buildUpdateSlTx(pairIndex, index, newSl);
    return this.client.signAndSendTransaction(tx);
  }

  /**
   * Update margin for a trade
   * @param options - Margin update options
   * @returns Transaction receipt
   */
  async updateMargin(
    options: MarginUpdateOptions,
  ): Promise<TransactionReceipt> {
    const tx = await this.buildUpdateMarginTx(options);
    return this.client.signAndSendTransaction(tx);
  }

  // ============================================================================
  // Trade Query Methods
  // ============================================================================

  /**
   * Get all open trades for a trader
   * @param trader - Trader address (defaults to signer address)
   * @returns Array of open trades with extended info
   */
  async getTrades(trader?: Address): Promise<TradeExtendedResponse[]> {
    const traderAddress = trader || this.client.getSignerAddress();
    if (!traderAddress) {
      throw new Error("No trader address provided and no signer set");
    }

    // Use Multicall to get all positions
    const result = (await this.client.publicClient.readContract({
      address: CONTRACT_ADDRESSES.Multicall,
      abi: MULTICALL_ABI,
      functionName: "getPositions",
      args: [traderAddress],
    })) as [PositionData[], PendingOrderData[]];

    const [positions] = result;

    // Get current prices for all pairs
    const trades: TradeExtendedResponse[] = [];

    for (const pos of positions) {
      const pairIndex = Number(pos.trade.pairIndex);
      const pairInfo = await this.client.pairsCache.getPairInfo(pairIndex);

      // Get current price
      const priceData = await this.feedClient.getPrice(pairInfo.name);
      const currentPrice = priceData?.price || 0;

      const openPrice = fromPriceUnits(pos.trade.openPrice);
      const positionSize = fromUsdcUnits(pos.trade.positionSizeUSDC);
      const leverage = Number(pos.trade.leverage);
      const isLong = pos.trade.buy;
      const marginFee = fromUsdcUnits(pos.marginFee);

      // Calculate PnL
      const pnl = calculatePnL(
        openPrice,
        currentPrice,
        positionSize,
        isLong,
        marginFee,
      );
      const pnlPercentage = calculatePnLPercentage(
        openPrice,
        currentPrice,
        leverage,
        isLong,
      );

      trades.push({
        id: `${traderAddress}-${pairIndex}-${pos.trade.index}`,
        trader: pos.trade.trader,
        pairIndex,
        index: Number(pos.trade.index),
        positionSizeUsdc: positionSize,
        openPrice,
        buy: isLong,
        leverage,
        tp: fromPriceUnits(pos.trade.tp),
        sl: fromPriceUnits(pos.trade.sl),
        openTimestamp: Number(pos.trade.timestamp),
        tradeType: 0, // Market trade
        unrealizedPnl: pnl,
        unrealizedPnlPercentage: pnlPercentage,
        liquidationPrice: fromPriceUnits(pos.liquidationPrice),
        currentPrice,
        accruedMarginFee: marginFee,
      });
    }

    return trades;
  }

  /**
   * Get all pending limit orders for a trader
   * @param trader - Trader address (defaults to signer address)
   * @returns Array of pending limit orders
   */
  async getPendingOrders(
    trader?: Address,
  ): Promise<PendingLimitOrderExtendedResponse[]> {
    const traderAddress = trader || this.client.getSignerAddress();
    if (!traderAddress) {
      throw new Error("No trader address provided and no signer set");
    }

    // Use Multicall to get all positions
    const result = (await this.client.publicClient.readContract({
      address: CONTRACT_ADDRESSES.Multicall,
      abi: MULTICALL_ABI,
      functionName: "getPositions",
      args: [traderAddress],
    })) as [PositionData[], PendingOrderData[]];

    const [, pendingOrders] = result;

    const orders: PendingLimitOrderExtendedResponse[] = [];

    for (const order of pendingOrders) {
      const pairIndex = Number(order.order.pairIndex);
      const pairInfo = await this.client.pairsCache.getPairInfo(pairIndex);

      // Get current price
      const priceData = await this.feedClient.getPrice(pairInfo.name);
      const currentPrice = priceData?.price || 0;

      const limitPrice = fromPriceUnits(order.order.price);
      const distanceToLimit =
        currentPrice > 0
          ? Math.abs((currentPrice - limitPrice) / currentPrice) * 100
          : 0;

      orders.push({
        id: `${traderAddress}-${pairIndex}-${order.order.index}-limit`,
        trader: order.order.trader,
        pairIndex,
        index: Number(order.order.index),
        positionSizeUsdc: fromUsdcUnits(order.order.positionSize),
        openPrice: limitPrice,
        buy: order.order.buy,
        leverage: Number(order.order.leverage),
        tp: fromPriceUnits(order.order.tp),
        sl: fromPriceUnits(order.order.sl),
        minPrice: 0, // Not available in this response
        maxPrice: 0, // Not available in this response
        currentPrice,
        distanceToLimitPercentage: distanceToLimit,
      });
    }

    return orders;
  }

  /**
   * Get a specific trade by pair index and trade index
   * @param pairIndex - Pair index
   * @param index - Trade index
   * @param trader - Trader address (defaults to signer address)
   * @returns Trade info or null if not found
   */
  async getTrade(
    pairIndex: number,
    index: number,
    trader?: Address,
  ): Promise<TradeExtendedResponse | null> {
    const trades = await this.getTrades(trader);
    return (
      trades.find((t) => t.pairIndex === pairIndex && t.index === index) || null
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the execution fee for trades
   * @returns Execution fee in wei
   */
  async getExecutionFee(): Promise<bigint> {
    try {
      const fee = (await this.client.publicClient.readContract({
        address: CONTRACT_ADDRESSES.Trading,
        abi: TRADING_ABI,
        functionName: "executionFee",
      })) as bigint;
      return fee;
    } catch {
      // Fallback to default execution fee
      return BigInt(Math.floor(DEFAULT_EXECUTION_FEE * 10 ** 18));
    }
  }

  /**
   * Calculate the total cost to open a trade
   * @param trade - Trade input
   * @returns Total cost including collateral, fees, and execution fee
   */
  async calculateTradeCost(trade: TradeInput): Promise<{
    collateral: number;
    openingFee: number;
    executionFee: number;
    total: number;
  }> {
    const collateral = trade.positionSizeUsdc / trade.leverage;

    // Get opening fee
    const openingFee = (await this.client.feeParameters.getOpeningFee({
      tradeInput: trade,
    })) as number;

    // Get execution fee in ETH
    const executionFeeWei = await this.getExecutionFee();
    const executionFee = Number(executionFeeWei) / 10 ** 18;

    return {
      collateral,
      openingFee,
      executionFee,
      total: collateral + openingFee,
    };
  }

  /**
   * Estimate liquidation price for a trade
   * @param trade - Trade input
   * @returns Estimated liquidation price
   */
  async estimateLiquidationPrice(trade: TradeInput): Promise<number> {
    // Get current price if not provided
    let entryPrice = trade.openPrice;
    if (entryPrice === 0) {
      const pairInfo = await this.client.pairsCache.getPairInfo(
        trade.pairIndex,
      );
      const priceData = await this.feedClient.getPrice(pairInfo.name);
      entryPrice = priceData?.price || 0;
    }

    // Get margin fee estimate (hourly rate for 24h as initial estimate)
    const marginFee = await this.client.feeParameters.getPairMarginFee(
      trade.pairIndex,
    );
    const marginFeeEstimate =
      (trade.buy ? marginFee.longBps : marginFee.shortBps) * 24;

    return calculateLiquidationPrice(
      entryPrice,
      trade.leverage,
      trade.buy,
      marginFeeEstimate / BPS_DIVISOR,
    );
  }

  /**
   * Get long/short ratios for all pairs
   * @returns Map of pair index to long/short ratios
   */
  async getLongShortRatios(): Promise<
    Map<number, { long: number; short: number }>
  > {
    const result = (await this.client.publicClient.readContract({
      address: CONTRACT_ADDRESSES.Multicall,
      abi: MULTICALL_ABI,
      functionName: "getLongShortRatios",
    })) as [bigint[], bigint[]];

    const [longRatios, shortRatios] = result;
    const ratios = new Map<number, { long: number; short: number }>();

    for (let i = 0; i < longRatios.length; i++) {
      ratios.set(i, {
        long: Number(longRatios[i]) / 100, // Assuming 2 decimal precision
        short: Number(shortRatios[i]) / 100,
      });
    }

    return ratios;
  }

  /**
   * Get margin info for all pairs
   * @returns Margin fee information by pair
   */
  async getMarginInfo(): Promise<
    Map<
      number,
      {
        rolloverFeePerBlock: number;
        rolloverFeePerBlockLong: number;
        rolloverFeePerBlockShort: number;
      }
    >
  > {
    const result = (await this.client.publicClient.readContract({
      address: CONTRACT_ADDRESSES.Multicall,
      abi: MULTICALL_ABI,
      functionName: "getMargins",
    })) as [bigint[], bigint[], bigint[]];

    const [baseFees, longFees, shortFees] = result;
    const margins = new Map<
      number,
      {
        rolloverFeePerBlock: number;
        rolloverFeePerBlockLong: number;
        rolloverFeePerBlockShort: number;
      }
    >();

    for (let i = 0; i < baseFees.length; i++) {
      margins.set(i, {
        rolloverFeePerBlock: Number(baseFees[i]),
        rolloverFeePerBlockLong: Number(longFees[i]),
        rolloverFeePerBlockShort: Number(shortFees[i]),
      });
    }

    return margins;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new TradeRPC instance
 * @param client - TraderClient instance
 * @param feedClient - FeedClient instance
 * @returns TradeRPC instance
 */
export function createTradeRPC(
  client: TraderClient,
  feedClient: FeedClient,
): TradeRPC {
  return new TradeRPC(client, feedClient);
}
