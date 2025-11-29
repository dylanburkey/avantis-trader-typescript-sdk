/**
 * @fileoverview Avantis Trader Client
 *
 * The main client class for interacting with the Avantis protocol.
 * This mirrors the Python SDK's TraderClient class functionality.
 *
 * @module client/trader-client
 * @example
 * ```typescript
 * import { TraderClient } from '@avantisfi/trader-sdk';
 *
 * const client = new TraderClient({
 *   rpcUrl: 'https://mainnet.base.org',
 *   privateKey: '0x...' // optional, for signing transactions
 * });
 *
 * // Get pairs info
 * const pairs = await client.pairsCache.getPairsInfo();
 *
 * // Open a trade
 * const tx = await client.trade.buildTradeOpenTx(tradeInput, orderType, slippage);
 * ```
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  type Hash,
  type TransactionReceipt,
  getContract,
  parseUnits,
  formatUnits,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { base } from "viem/chains";

import {
  CONTRACT_ADDRESSES,
  RPC_URLS,
  RPC_TIMEOUT,
  USDC_DECIMALS,
  PRICE_DECIMALS,
} from "../contracts/config";
import {
  TRADING_STORAGE_ABI,
  TRADING_ABI,
  PAIR_INFOS_ABI,
  ERC20_ABI,
  MULTICALL_ABI,
  PRICE_AGGREGATOR_ABI,
  REFERRAL_ABI,
} from "../contracts/abis";

import { PairsCache } from "../rpc/pairs-cache";
import { AssetParametersRPC } from "../rpc/asset-parameters";
import { CategoryParametersRPC } from "../rpc/category-parameters";
import { FeeParametersRPC } from "../rpc/fee-parameters";
import { TradingParametersRPC } from "../rpc/trading-parameters";
import { BlendedRPC } from "../rpc/blended";
import { SnapshotRPC } from "../rpc/snapshot";
import { TradeRPC } from "../rpc/trade";
import { FeedClient } from "../feed";
import { BaseSigner, LocalSigner } from "../signers";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for TraderClient
 */
export interface TraderClientConfig {
  /** RPC URL for Base network */
  rpcUrl?: string;
  /** Private key for signing transactions (hex string with or without 0x prefix) */
  privateKey?: Hex;
  /** Optional custom signer instance */
  signer?: BaseSigner;
  /** Optional custom FeedClient instance */
  feedClient?: FeedClient;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Contract instances type
 */
export interface Contracts {
  TradingStorage: ReturnType<typeof getContract>;
  PairStorage: ReturnType<typeof getContract>;
  PairInfos: ReturnType<typeof getContract>;
  PriceAggregator: ReturnType<typeof getContract>;
  USDC: ReturnType<typeof getContract>;
  Trading: ReturnType<typeof getContract>;
  Multicall: ReturnType<typeof getContract>;
  Referral: ReturnType<typeof getContract>;
}

// ============================================================================
// TraderClient Class
// ============================================================================

/**
 * Main client for interacting with the Avantis protocol.
 *
 * Provides access to all RPC modules for trading, market data,
 * and protocol parameters.
 *
 * @example
 * ```typescript
 * // Create client with private key for signing
 * const client = new TraderClient({
 *   rpcUrl: 'https://mainnet.base.org',
 *   privateKey: '0xYourPrivateKey'
 * });
 *
 * // Or create read-only client
 * const readOnlyClient = new TraderClient({
 *   rpcUrl: 'https://mainnet.base.org'
 * });
 * ```
 */
export class TraderClient {
  /** Public client for read operations */
  public readonly publicClient: PublicClient;

  /** Wallet client for write operations (if signer is set) */
  public walletClient: WalletClient | null = null;

  /** Account for signing (if private key provided) */
  private account: PrivateKeyAccount | null = null;

  /** Signer instance */
  private _signer: BaseSigner | null = null;

  /** Chain ID */
  public readonly chainId: number;

  /** Contract instances */
  public readonly contracts: Contracts;

  /** Debug mode flag */
  private readonly debug: boolean;

  // RPC Modules
  /** Pairs cache for trading pair information */
  public readonly pairsCache: PairsCache;

  /** Asset parameters RPC module */
  public readonly assetParameters: AssetParametersRPC;

  /** Category parameters RPC module */
  public readonly categoryParameters: CategoryParametersRPC;

  /** Fee parameters RPC module */
  public readonly feeParameters: FeeParametersRPC;

  /** Trading parameters RPC module */
  public readonly tradingParameters: TradingParametersRPC;

  /** Blended parameters RPC module */
  public readonly blended: BlendedRPC;

  /** Snapshot RPC module */
  public readonly snapshot: SnapshotRPC;

  /** Trade RPC module for trade operations */
  public readonly trade: TradeRPC;

  /** Feed client for price updates */
  public readonly feedClient: FeedClient;

  /**
   * Create a new TraderClient instance
   * @param config - Client configuration
   */
  constructor(config: TraderClientConfig = {}) {
    const rpcUrl = config.rpcUrl || RPC_URLS[0];
    this.debug = config.debug || false;
    this.chainId = base.id;

    // Create public client for read operations
    // Type assertion needed due to Base chain's specific transaction types
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: RPC_TIMEOUT }),
    }) as PublicClient;

    // Set up signer if private key provided
    if (config.privateKey) {
      this.setLocalSigner(config.privateKey);
    } else if (config.signer) {
      this._signer = config.signer;
    }

    // Initialize contracts
    this.contracts = this.loadContracts();

    // Initialize RPC modules
    this.pairsCache = new PairsCache(this, config.cacheTtl);
    this.assetParameters = new AssetParametersRPC(this);
    this.categoryParameters = new CategoryParametersRPC(this);
    this.feeParameters = new FeeParametersRPC(this);
    this.tradingParameters = new TradingParametersRPC(this);
    this.blended = new BlendedRPC(this);
    this.snapshot = new SnapshotRPC(this);

    // Initialize feed client
    this.feedClient = config.feedClient || new FeedClient(this.pairsCache);

    // Initialize trade RPC (depends on feed client)
    this.trade = new TradeRPC(this, this.feedClient);

    if (this.debug) {
      console.log("TraderClient initialized with RPC:", rpcUrl);
    }
  }

  // ============================================================================
  // Contract Loading
  // ============================================================================

  /**
   * Load all contract instances
   * @returns Contract instances object
   */
  private loadContracts(): Contracts {
    return {
      TradingStorage: getContract({
        address: CONTRACT_ADDRESSES.TradingStorage,
        abi: TRADING_STORAGE_ABI,
        client: this.publicClient,
      }),
      PairStorage: getContract({
        address: CONTRACT_ADDRESSES.PairStorage,
        abi: PAIR_INFOS_ABI,
        client: this.publicClient,
      }),
      PairInfos: getContract({
        address: CONTRACT_ADDRESSES.PairInfos,
        abi: PAIR_INFOS_ABI,
        client: this.publicClient,
      }),
      PriceAggregator: getContract({
        address: CONTRACT_ADDRESSES.PriceAggregator,
        abi: PRICE_AGGREGATOR_ABI,
        client: this.publicClient,
      }),
      USDC: getContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ERC20_ABI,
        client: this.publicClient,
      }),
      Trading: getContract({
        address: CONTRACT_ADDRESSES.Trading,
        abi: TRADING_ABI,
        client: this.publicClient,
      }),
      Multicall: getContract({
        address: CONTRACT_ADDRESSES.Multicall,
        abi: MULTICALL_ABI,
        client: this.publicClient,
      }),
      Referral: getContract({
        address: CONTRACT_ADDRESSES.Referral,
        abi: REFERRAL_ABI,
        client: this.publicClient,
      }),
    };
  }

  // ============================================================================
  // Signer Management
  // ============================================================================

  /**
   * Set a local signer using a private key
   * @param privateKey - Private key (with or without 0x prefix)
   */
  setLocalSigner(privateKey: Hex): void {
    const formattedKey = privateKey.startsWith("0x")
      ? privateKey
      : (`0x${privateKey}` as Hex);

    this.account = privateKeyToAccount(formattedKey);

    this.walletClient = createWalletClient({
      account: this.account,
      chain: base,
      transport: http(this.publicClient.transport.url || RPC_URLS[0]),
    });

    this._signer = new LocalSigner(
      formattedKey,
      this.publicClient.transport.url || RPC_URLS[0],
    );

    if (this.debug) {
      console.log("Local signer set:", this.account.address);
    }
  }

  /**
   * Set a custom signer instance
   * @param signer - Signer instance
   */
  setSigner(signer: BaseSigner): void {
    this._signer = signer;
  }

  /**
   * Get the current signer
   * @returns Current signer or null if not set
   */
  getSigner(): BaseSigner | null {
    return this._signer;
  }

  /**
   * Remove the current signer
   */
  removeSigner(): void {
    this._signer = null;
    this.account = null;
    this.walletClient = null;
  }

  /**
   * Check if a signer is set
   * @returns True if signer is set
   */
  hasSigner(): boolean {
    return this._signer !== null;
  }

  /**
   * Get the signer's address
   * @returns Signer address or null if not set
   */
  getSignerAddress(): Address | null {
    if (this.account) {
      return this.account.address;
    }
    if (this._signer) {
      return this._signer.getAddress();
    }
    return null;
  }

  // ============================================================================
  // Transaction Methods
  // ============================================================================

  /**
   * Get the transaction count (nonce) for an address
   * @param address - Address to get nonce for (defaults to signer address)
   * @returns Transaction count
   */
  async getTransactionCount(address?: Address): Promise<number> {
    const addr = address || this.getSignerAddress();
    if (!addr) {
      throw new Error("No address provided and no signer set");
    }

    const count = await this.publicClient.getTransactionCount({
      address: addr,
    });
    return count;
  }

  /**
   * Get the current gas price
   * @returns Gas price in wei
   */
  async getGasPrice(): Promise<bigint> {
    return this.publicClient.getGasPrice();
  }

  /**
   * Estimate gas for a transaction
   * @param tx - Transaction to estimate
   * @returns Estimated gas
   */
  async estimateGas(tx: {
    to: Address;
    data?: Hex;
    value?: bigint;
    from?: Address;
  }): Promise<bigint> {
    const from = tx.from || this.getSignerAddress();
    if (!from) {
      throw new Error("No from address provided and no signer set");
    }

    return this.publicClient.estimateGas({
      ...tx,
      account: from,
    });
  }

  /**
   * Sign and send a transaction
   * @param tx - Transaction to sign and send
   * @returns Transaction receipt
   */
  async signAndSendTransaction(tx: {
    to: Address;
    data?: Hex;
    value?: bigint;
    gas?: bigint;
  }): Promise<TransactionReceipt> {
    if (!this.walletClient || !this.account) {
      throw new Error("No signer set. Use setLocalSigner() first.");
    }

    // Estimate gas if not provided
    const gas =
      tx.gas ||
      (await this.estimateGas({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        from: this.account.address,
      }));

    // Send transaction
    const hash = await this.walletClient.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gas,
      chain: base,
      account: this.account,
    });

    // Wait for receipt
    return this.waitForTransactionReceipt(hash);
  }

  /**
   * Wait for a transaction receipt
   * @param hash - Transaction hash
   * @returns Transaction receipt
   */
  async waitForTransactionReceipt(hash: Hash): Promise<TransactionReceipt> {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  // ============================================================================
  // Balance Methods
  // ============================================================================

  /**
   * Get ETH balance for an address
   * @param address - Address to check (defaults to signer address)
   * @returns Balance in ETH
   */
  async getBalance(address?: Address): Promise<number> {
    const addr = address || this.getSignerAddress();
    if (!addr) {
      throw new Error("No address provided and no signer set");
    }

    const balance = await this.publicClient.getBalance({ address: addr });
    return Number(formatUnits(balance, 18));
  }

  /**
   * Get USDC balance for an address
   * @param address - Address to check (defaults to signer address)
   * @returns Balance in USDC
   */
  async getUsdcBalance(address?: Address): Promise<number> {
    const addr = address || this.getSignerAddress();
    if (!addr) {
      throw new Error("No address provided and no signer set");
    }

    const balance = (await this.publicClient.readContract({
      address: CONTRACT_ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [addr],
    })) as bigint;

    return Number(formatUnits(balance, USDC_DECIMALS));
  }

  /**
   * Get USDC allowance for the Trading Storage contract
   * @param address - Address to check (defaults to signer address)
   * @returns Allowance in USDC
   */
  async getUsdcAllowanceForTrading(address?: Address): Promise<number> {
    const addr = address || this.getSignerAddress();
    if (!addr) {
      throw new Error("No address provided and no signer set");
    }

    const allowance = (await this.publicClient.readContract({
      address: CONTRACT_ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [addr, CONTRACT_ADDRESSES.TradingStorage],
    })) as bigint;

    return Number(formatUnits(allowance, USDC_DECIMALS));
  }

  /**
   * Approve USDC for the Trading Storage contract
   * @param amount - Amount to approve in USDC (default: 100,000)
   * @returns Transaction receipt
   */
  async approveUsdcForTrading(
    amount: number = 100000,
  ): Promise<TransactionReceipt> {
    if (!this.walletClient || !this.account) {
      throw new Error("No signer set. Use setLocalSigner() first.");
    }

    const amountWei = parseUnits(amount.toString(), USDC_DECIMALS);

    const hash = await this.walletClient.writeContract({
      address: CONTRACT_ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.TradingStorage, amountWei],
      chain: base,
      account: this.account,
    });

    return this.waitForTransactionReceipt(hash);
  }

  // ============================================================================
  // Contract Read Methods
  // ============================================================================

  /**
   * Read from a contract
   * @param contractName - Name of the contract
   * @param functionName - Function to call
   * @param args - Function arguments
   * @returns Function result
   */
  async readContract<T = unknown>(
    contractName: keyof typeof CONTRACT_ADDRESSES,
    functionName: string,
    ...args: unknown[]
  ): Promise<T> {
    const contract = this.contracts[contractName as keyof Contracts];
    if (!contract) {
      throw new Error(`Contract ${contractName} not found`);
    }

    const result = await this.publicClient.readContract({
      address: CONTRACT_ADDRESSES[contractName],
      abi: contract.abi as readonly unknown[],
      functionName,
      args,
    });

    return result as T;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Convert USDC amount to wei (6 decimals)
   * @param amount - Amount in USDC
   * @returns Amount in wei
   */
  static usdcToWei(amount: number): bigint {
    return parseUnits(amount.toString(), USDC_DECIMALS);
  }

  /**
   * Convert wei to USDC amount (6 decimals)
   * @param wei - Amount in wei
   * @returns Amount in USDC
   */
  static weiToUsdc(wei: bigint): number {
    return Number(formatUnits(wei, USDC_DECIMALS));
  }

  /**
   * Convert price to contract format (10 decimals)
   * @param price - Price value
   * @returns Price in contract format
   */
  static priceToWei(price: number): bigint {
    return parseUnits(price.toString(), PRICE_DECIMALS);
  }

  /**
   * Convert contract price to decimal
   * @param wei - Price in contract format
   * @returns Price as decimal
   */
  static weiToPrice(wei: bigint): number {
    return Number(formatUnits(wei, PRICE_DECIMALS));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new TraderClient instance
 * @param config - Client configuration
 * @returns TraderClient instance
 *
 * @example
 * ```typescript
 * const client = createTraderClient({
 *   rpcUrl: 'https://mainnet.base.org',
 *   privateKey: '0xYourPrivateKey'
 * });
 * ```
 */
export function createTraderClient(
  config: TraderClientConfig = {},
): TraderClient {
  return new TraderClient(config);
}
