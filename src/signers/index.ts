/**
 * Avantis SDK Signer Implementations
 *
 * Provides abstractions for signing transactions and messages,
 * supporting both local private key signing and external wallet integration.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type WalletClient,
  type PublicClient,
  type Account,
  type Chain,
  type Address,
  type Hash,
  type Hex,
  type TransactionRequest,
  type SignableMessage,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { base } from "viem/chains";
import { RPC_URLS } from "../contracts/config";

// ============================================================================
// Types
// ============================================================================

/**
 * Generic typed data for EIP-712 signing
 */
export interface TypedDataParams {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: Address;
    salt?: Hex;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

// ============================================================================
// Base Signer Abstract Class
// ============================================================================

/**
 * Abstract base class for signers
 * Provides a common interface for different signing implementations
 */
export abstract class BaseSigner {
  protected publicClient: PublicClient;
  protected chain: Chain;

  constructor(rpcUrl: string = RPC_URLS[0], chain: Chain = base) {
    this.chain = chain;
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Get the signer's Ethereum address
   */
  abstract getAddress(): Address;

  /**
   * Sign a transaction
   */
  abstract signTransaction(tx: TransactionRequest): Promise<Hex>;

  /**
   * Sign a message
   */
  abstract signMessage(message: SignableMessage): Promise<Hex>;

  /**
   * Sign typed data (EIP-712)
   */
  abstract signTypedData(typedData: TypedDataParams): Promise<Hex>;

  /**
   * Send a signed transaction
   */
  abstract sendTransaction(tx: TransactionRequest): Promise<Hash>;

  /**
   * Get the public client for read operations
   */
  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /**
   * Get the chain configuration
   */
  getChain(): Chain {
    return this.chain;
  }
}

// ============================================================================
// Local Signer (Private Key)
// ============================================================================

/**
 * Local signer using a private key
 * For server-side applications or development/testing
 */
export class LocalSigner extends BaseSigner {
  private account: PrivateKeyAccount;
  private walletClient: WalletClient;

  /**
   * Create a new LocalSigner
   * @param privateKey - Private key (with or without 0x prefix)
   * @param rpcUrl - RPC URL for the Base network
   * @param chain - Chain configuration (defaults to Base)
   */
  constructor(
    privateKey: Hex,
    rpcUrl: string = RPC_URLS[0],
    chain: Chain = base,
  ) {
    super(rpcUrl, chain);

    // Ensure private key has 0x prefix
    const formattedKey = privateKey.startsWith("0x")
      ? privateKey
      : (`0x${privateKey}` as Hex);

    this.account = privateKeyToAccount(formattedKey);
    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Get the signer's address
   */
  getAddress(): Address {
    return this.account.address;
  }

  /**
   * Get the underlying account
   */
  getAccount(): PrivateKeyAccount {
    return this.account;
  }

  /**
   * Get the wallet client
   */
  getWalletClient(): WalletClient {
    return this.walletClient;
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: TransactionRequest): Promise<Hex> {
    return this.account.signTransaction({
      ...tx,
      chainId: this.chain.id,
    } as any);
  }

  /**
   * Sign a message
   */
  async signMessage(message: SignableMessage): Promise<Hex> {
    return this.account.signMessage({ message });
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(typedData: TypedDataParams): Promise<Hex> {
    return this.account.signTypedData({
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    } as any);
  }

  /**
   * Send a transaction
   */
  async sendTransaction(tx: TransactionRequest): Promise<Hash> {
    return this.walletClient.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gas: tx.gas,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      chain: this.chain,
      account: this.account,
    } as any);
  }
}

// ============================================================================
// External Signer (Wallet Integration)
// ============================================================================

/**
 * External signer wrapping an existing WalletClient
 * For browser-based applications with MetaMask, WalletConnect, etc.
 */
export class ExternalSigner extends BaseSigner {
  private walletClient: WalletClient;
  private account: Account;

  /**
   * Create a new ExternalSigner
   * @param walletClient - Existing wallet client from wallet connection
   * @param account - Account from the wallet
   * @param rpcUrl - RPC URL for read operations
   */
  constructor(
    walletClient: WalletClient,
    account: Account,
    rpcUrl: string = RPC_URLS[0],
  ) {
    super(rpcUrl, walletClient.chain || base);
    this.walletClient = walletClient;
    this.account = account;
  }

  /**
   * Get the signer's address
   */
  getAddress(): Address {
    return this.account.address;
  }

  /**
   * Get the underlying account
   */
  getAccount(): Account {
    return this.account;
  }

  /**
   * Get the wallet client
   */
  getWalletClient(): WalletClient {
    return this.walletClient;
  }

  /**
   * Sign a transaction
   */
  async signTransaction(_tx: TransactionRequest): Promise<Hex> {
    // External signers typically don't expose raw signing
    // Instead, use sendTransaction which handles signing internally
    throw new Error(
      "External signers should use sendTransaction instead of signTransaction",
    );
  }

  /**
   * Sign a message
   */
  async signMessage(message: SignableMessage): Promise<Hex> {
    return this.walletClient.signMessage({
      account: this.account,
      message,
    });
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(typedData: TypedDataParams): Promise<Hex> {
    return this.walletClient.signTypedData({
      account: this.account,
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    } as any);
  }

  /**
   * Send a transaction
   */
  async sendTransaction(tx: TransactionRequest): Promise<Hash> {
    return this.walletClient.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gas: tx.gas,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      chain: this.chain,
      account: this.account,
    } as any);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a local signer from a private key
 * @param privateKey - Private key for signing
 * @param rpcUrl - RPC URL (optional)
 * @returns LocalSigner instance
 */
export function createLocalSigner(
  privateKey: Hex,
  rpcUrl: string = RPC_URLS[0],
): LocalSigner {
  return new LocalSigner(privateKey, rpcUrl);
}

/**
 * Create an external signer from a wallet client
 * @param walletClient - Wallet client from wallet connection
 * @param account - Account from the wallet
 * @param rpcUrl - RPC URL for read operations (optional)
 * @returns ExternalSigner instance
 */
export function createExternalSigner(
  walletClient: WalletClient,
  account: Account,
  rpcUrl: string = RPC_URLS[0],
): ExternalSigner {
  return new ExternalSigner(walletClient, account, rpcUrl);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a public client for read-only operations
 * @param rpcUrl - RPC URL
 * @param chain - Chain configuration
 * @returns PublicClient instance
 */
export function createReadOnlyClient(
  rpcUrl: string = RPC_URLS[0],
  chain: Chain = base,
): PublicClient {
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Validate that an address matches the signer's address
 * @param signer - Signer to validate
 * @param expectedAddress - Expected address
 * @throws If addresses don't match
 */
export function validateSignerAddress(
  signer: BaseSigner,
  expectedAddress: Address,
): void {
  const signerAddress = signer.getAddress().toLowerCase();
  const expected = expectedAddress.toLowerCase();

  if (signerAddress !== expected) {
    throw new Error(
      `Signer address mismatch. Expected ${expectedAddress}, got ${signer.getAddress()}`,
    );
  }
}
