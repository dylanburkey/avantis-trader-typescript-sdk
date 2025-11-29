/**
 * Price Feed Module
 * 
 * Handles WebSocket connections to Pyth price feeds for real-time
 * price updates and price data retrieval.
 */

import WebSocket from 'ws';
import {
  PYTH_WS_URL,
  PYTH_HTTP_URL,
  PYTH_FEED_IDS,
  PRICE_CACHE_TTL,
} from '../contracts/config';
import type {
  PriceFeedResponse,
  PriceFeesUpdateBinary,
  PriceUpdateCallback,
  ErrorCallback,
  CloseCallback,
  Hex,
} from '../types';
import { PairsCache } from '../rpc/pairs-cache';

// ============================================================================
// Types
// ============================================================================

interface PythPriceMessage {
  type: string;
  price_feed?: {
    id: string;
    price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
  };
}

interface CachedPrice {
  price: number;
  confidence: number;
  timestamp: number;
  cachedAt: number;
}

// ============================================================================
// Feed Client Class
// ============================================================================

/**
 * Client for subscribing to Pyth price feeds via WebSocket
 */
export class FeedClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private httpUrl: string;
  private pairsCache: PairsCache;
  private priceCallbacks: Map<string, PriceUpdateCallback[]> = new Map();
  private errorCallback: ErrorCallback | null = null;
  private closeCallback: CloseCallback | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private isConnecting: boolean = false;
  private subscribedFeeds: Set<string> = new Set();
  private priceCache: Map<string, CachedPrice> = new Map();
  private cacheTtl: number;

  /**
   * Create a new FeedClient
   * @param pairsCache - PairsCache instance for pair info
   * @param wsUrl - WebSocket URL for Pyth
   * @param httpUrl - HTTP URL for Pyth
   * @param cacheTtl - Cache TTL in milliseconds
   */
  constructor(
    pairsCache: PairsCache,
    wsUrl: string = PYTH_WS_URL,
    httpUrl: string = PYTH_HTTP_URL,
    cacheTtl: number = PRICE_CACHE_TTL
  ) {
    this.pairsCache = pairsCache;
    this.wsUrl = wsUrl;
    this.httpUrl = httpUrl;
    this.cacheTtl = cacheTtl;
  }

  /**
   * Connect to the Pyth WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          // Resubscribe to feeds
          for (const feedId of this.subscribedFeeds) {
            this.sendSubscription(feedId);
          }

          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error: Error) => {
          this.isConnecting = false;
          if (this.errorCallback) {
            this.errorCallback(error);
          }
          reject(error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.isConnecting = false;
          if (this.closeCallback) {
            this.closeCallback(code, reason.toString());
          }
          this.attemptReconnect();
        });
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribedFeeds.clear();
    this.priceCallbacks.clear();
  }

  /**
   * Subscribe to price updates for a pair
   * @param pair - Pair name (e.g., "ETH/USD") or feed ID
   * @param callback - Callback for price updates
   */
  async subscribe(pair: string, callback: PriceUpdateCallback): Promise<void> {
    // Ensure connected
    await this.connect();

    // Get feed ID
    let feedId: string;
    if (pair.startsWith('0x')) {
      feedId = pair;
    } else {
      feedId = PYTH_FEED_IDS[pair] || '';
      if (!feedId) {
        // Try to get from pairs cache
        const pairInfo = await this.pairsCache.getPairInfo(pair);
        feedId = pairInfo.feed.feedId;
      }
    }

    if (!feedId) {
      throw new Error(`No feed ID found for pair: ${pair}`);
    }

    // Add callback
    const callbacks = this.priceCallbacks.get(feedId) || [];
    callbacks.push(callback);
    this.priceCallbacks.set(feedId, callbacks);

    // Subscribe if not already
    if (!this.subscribedFeeds.has(feedId)) {
      this.subscribedFeeds.add(feedId);
      this.sendSubscription(feedId);
    }
  }

  /**
   * Unsubscribe from price updates for a pair
   * @param pair - Pair name or feed ID
   * @param callback - Specific callback to remove (optional)
   */
  unsubscribe(pair: string, callback?: PriceUpdateCallback): void {
    const feedId = pair.startsWith('0x') ? pair : PYTH_FEED_IDS[pair] || '';

    if (callback) {
      const callbacks = this.priceCallbacks.get(feedId) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.priceCallbacks.delete(feedId);
        this.subscribedFeeds.delete(feedId);
      } else {
        this.priceCallbacks.set(feedId, callbacks);
      }
    } else {
      this.priceCallbacks.delete(feedId);
      this.subscribedFeeds.delete(feedId);
    }
  }

  /**
   * Set error callback
   * @param callback - Error callback
   */
  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  /**
   * Set close callback
   * @param callback - Close callback
   */
  onClose(callback: CloseCallback): void {
    this.closeCallback = callback;
  }

  /**
   * Get current price for a pair (from cache or API)
   * @param pair - Pair name or feed ID
   */
  async getPrice(pair: string): Promise<PriceFeedResponse | null> {
    const feedId = pair.startsWith('0x') ? pair : PYTH_FEED_IDS[pair] || '';

    if (!feedId) {
      throw new Error(`No feed ID found for pair: ${pair}`);
    }

    // Check cache
    const cached = this.priceCache.get(feedId);
    const now = Date.now();

    if (cached && now - cached.cachedAt < this.cacheTtl) {
      const pairIndex = await this.getPairIndexForFeedId(feedId);
      return {
        pairIndex,
        price: cached.price,
        timestamp: cached.timestamp,
        confidence: cached.confidence,
      };
    }

    // Fetch from API
    return this.fetchPriceFromApi(feedId);
  }

  /**
   * Get price update data for contract calls
   * @param feedIds - Array of feed IDs
   */
  async getPriceUpdateData(feedIds: string[]): Promise<PriceFeesUpdateBinary> {
    const cleanIds = feedIds.map((id) =>
      id.startsWith('0x') ? id.slice(2) : id
    );

    const response = await fetch(
      `${this.httpUrl}/latest_vaas?ids[]=${cleanIds.join('&ids[]=')}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch price update data: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      data: data.map((vaa: string) => `0x${vaa}` as Hex),
      updateFee: BigInt(feedIds.length), // 1 wei per feed
    };
  }

  /**
   * Send subscription message to WebSocket
   * @param feedId - Feed ID to subscribe to
   */
  private sendSubscription(feedId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type: 'subscribe',
        ids: [feedId.startsWith('0x') ? feedId.slice(2) : feedId],
      });
      this.ws.send(message);
    }
  }

  /**
   * Handle incoming WebSocket message
   * @param data - Message data
   */
  private handleMessage(data: string): void {
    try {
      const message: PythPriceMessage = JSON.parse(data);

      if (message.type === 'price_update' && message.price_feed) {
        const feedId = `0x${message.price_feed.id}`;
        const priceData = message.price_feed.price;

        const price =
          Number(priceData.price) * Math.pow(10, priceData.expo);
        const confidence =
          Number(priceData.conf) * Math.pow(10, priceData.expo);

        // Update cache
        this.priceCache.set(feedId, {
          price,
          confidence,
          timestamp: priceData.publish_time,
          cachedAt: Date.now(),
        });

        // Notify callbacks
        const callbacks = this.priceCallbacks.get(feedId);
        if (callbacks) {
          this.getPairIndexForFeedId(feedId).then((pairIndex) => {
            const response: PriceFeedResponse = {
              pairIndex,
              price,
              timestamp: priceData.publish_time,
              confidence,
            };

            for (const callback of callbacks) {
              callback([response]);
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Fetch price from Pyth HTTP API
   * @param feedId - Feed ID
   */
  private async fetchPriceFromApi(feedId: string): Promise<PriceFeedResponse | null> {
    try {
      const cleanId = feedId.startsWith('0x') ? feedId.slice(2) : feedId;
      const response = await fetch(
        `${this.httpUrl}/latest_price_feeds?ids[]=${cleanId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch price: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.length === 0) {
        return null;
      }

      const priceData = data[0].price;
      const price = Number(priceData.price) * Math.pow(10, priceData.expo);
      const confidence = Number(priceData.conf) * Math.pow(10, priceData.expo);

      // Update cache
      this.priceCache.set(feedId, {
        price,
        confidence,
        timestamp: priceData.publish_time,
        cachedAt: Date.now(),
      });

      const pairIndex = await this.getPairIndexForFeedId(feedId);

      return {
        pairIndex,
        price,
        timestamp: priceData.publish_time,
        confidence,
      };
    } catch (error) {
      console.error('Failed to fetch price from API:', error);
      return null;
    }
  }

  /**
   * Get pair index for a feed ID
   * @param feedId - Feed ID
   */
  private async getPairIndexForFeedId(feedId: string): Promise<number> {
    const pairs = await this.pairsCache.getPairsInfo();

    for (const [pairIndex, pairInfo] of pairs) {
      if (pairInfo.feed.feedId.toLowerCase() === feedId.toLowerCase()) {
        return pairIndex;
      }
    }

    return -1;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FeedClient instance
 * @param pairsCache - PairsCache instance
 * @param wsUrl - WebSocket URL
 * @param httpUrl - HTTP URL
 */
export function createFeedClient(
  pairsCache: PairsCache,
  wsUrl: string = PYTH_WS_URL,
  httpUrl: string = PYTH_HTTP_URL
): FeedClient {
  return new FeedClient(pairsCache, wsUrl, httpUrl);
}
