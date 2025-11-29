/**
 * Example: Open a Trade on Avantis
 *
 * This script demonstrates how to open a leveraged position.
 *
 * IMPORTANT: This uses real funds! Test on a small amount first.
 *
 * Usage:
 *   # Read-only mode (no private key needed):
 *   npx tsx examples/open-trade.ts
 *
 *   # Full mode with trading capability:
 *   PRIVATE_KEY=0x... npx tsx examples/open-trade.ts
 *
 * Required environment variables:
 *   PRIVATE_KEY - Your wallet private key (with 0x prefix) - OPTIONAL for read-only
 *   RPC_URL - Base mainnet RPC URL (optional, defaults to public RPC)
 */

import { createTraderClient } from "../src";
import { TradeInputOrderType } from "../src/types";

// Validate private key format
function isValidPrivateKey(key: string | undefined): key is `0x${string}` {
  if (!key) return false;
  // Must be 0x followed by 64 hex characters
  return /^0x[a-fA-F0-9]{64}$/.test(key);
}

async function main() {
  // Load configuration from environment
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || "https://mainnet.base.org";

  const hasValidKey = isValidPrivateKey(privateKey);

  if (privateKey && !hasValidKey) {
    console.error("❌ Invalid PRIVATE_KEY format");
    console.log("\nPrivate key must be:");
    console.log("  - Prefixed with 0x");
    console.log("  - Followed by 64 hexadecimal characters");
    console.log("\nExample:");
    console.log("  PRIVATE_KEY=0x1234567890abcdef... (64 hex chars total)");
    console.log("\n💡 Run without PRIVATE_KEY for read-only mode:");
    console.log("  npx tsx examples/open-trade.ts");
    process.exit(1);
  }

  console.log("🚀 Initializing Avantis TraderClient...\n");

  // Create the client (with or without private key)
  const client = createTraderClient({
    rpcUrl,
    privateKey: hasValidKey ? privateKey : undefined,
    debug: true,
  });

  if (hasValidKey) {
    const signerAddress = client.getSignerAddress();
    console.log(`📍 Wallet Address: ${signerAddress}`);
    console.log("✅ Trading enabled\n");
  } else {
    console.log("📖 Running in READ-ONLY mode (no private key provided)");
    console.log("   To enable trading, set PRIVATE_KEY environment variable\n");
  }

  try {
    // Step 1: Get available trading pairs
    console.log("📊 Fetching available trading pairs...");
    const pairs = await client.pairsCache.getPairsInfo();
    console.log(`Found ${pairs.size} trading pairs`);

    // Show first 5 pairs
    const pairNames = await client.pairsCache.getPairNames();
    console.log("Available pairs:", pairNames.slice(0, 5).join(", "), "...");

    // Step 2: Get info for BTC/USD (pair index 0 is typically BTC)
    const pairIndex = 0; // BTC/USD
    const pairInfo = await client.pairsCache.getPairInfo(pairIndex);
    console.log(`\n📈 Selected pair: ${pairInfo.name} (index: ${pairIndex})`);
    console.log(`   Group: ${pairInfo.groupIndex}`);
    console.log(`   Min Leverage: ${pairInfo.leverages.minLeverage}x`);
    console.log(`   Max Leverage: ${pairInfo.leverages.maxLeverage}x`);

    // Step 3: Check current market data
    console.log("\n📉 Fetching market data...");
    const assetOI = await client.assetParameters.getOi();
    const pairOI = assetOI.get(pairIndex);
    if (pairOI) {
      console.log(`  Long OI: $${pairOI.long.toLocaleString()}`);
      console.log(`  Short OI: $${pairOI.short.toLocaleString()}`);
    }

    // Step 4: Get fee information
    const spread = await client.feeParameters.getPairSpread();
    const pairSpread = spread.get(pairIndex);
    console.log(`  Spread: ${pairSpread?.spreadBps || 0} bps`);

    // Step 5: Get execution fee
    const executionFee = await client.trade.getExecutionFee();
    console.log(`  Execution Fee: ${Number(executionFee) / 1e18} ETH`);

    // If we have a signer, show more detailed trade info
    if (hasValidKey) {
      const signerAddress = client.getSignerAddress()!;

      // Step 6: Build a sample trade (READ-ONLY - won't execute)
      console.log("\n📝 Building sample trade transaction...");

      const tradeInput = {
        trader: signerAddress,
        pairIndex: pairIndex,
        index: 0, // First trade slot
        positionSizeUsdc: 100, // $100 position size
        openPrice: 0, // 0 = market order
        buy: true, // Long position
        leverage: 10, // 10x leverage
        tp: 0, // No take profit
        sl: 0, // No stop loss
        orderType: TradeInputOrderType.MARKET,
        slippageP: 50, // 0.5% slippage
      };

      // Calculate trade cost
      const tradeCost = await client.trade.calculateTradeCost(tradeInput);
      console.log("\n💰 Trade Cost Breakdown:");
      console.log(`  Collateral: $${tradeCost.collateral.toFixed(2)}`);
      console.log(`  Opening Fee: $${tradeCost.openingFee.toFixed(4)}`);
      console.log(`  Execution Fee: ${tradeCost.executionFee.toFixed(6)} ETH`);
      console.log(`  Total USDC needed: $${tradeCost.total.toFixed(2)}`);

      // Estimate liquidation price
      const liqPrice = await client.trade.estimateLiquidationPrice(tradeInput);
      console.log(`\n⚠️  Estimated Liquidation Price: $${liqPrice.toFixed(2)}`);

      // Build the transaction (but don't send it)
      const tx = await client.trade.buildTradeOpenTx({ trade: tradeInput });
      console.log("\n✅ Transaction built successfully!");
      console.log(`  To: ${tx.to}`);
      console.log(`  Value: ${tx.value} wei`);
      console.log(`  Data length: ${tx.data.length} bytes`);

      console.log("\n" + "=".repeat(60));
      console.log("⚠️  DRY RUN COMPLETE - No transaction was sent");
      console.log("=".repeat(60));
      console.log(
        "\nTo actually open a trade, uncomment the execution code below.",
      );
      console.log("Make sure you have:");
      console.log("  1. Sufficient USDC balance");
      console.log("  2. USDC approved to the Trading contract");
      console.log("  3. ETH for gas and execution fee");

      // =========================================================================
      // UNCOMMENT BELOW TO ACTUALLY EXECUTE THE TRADE
      // =========================================================================
      // console.log('\n🔄 Executing trade...');
      // const receipt = await client.trade.openTrade({ trade: tradeInput });
      // console.log(`✅ Trade opened! TX: ${receipt.transactionHash}`);
      // =========================================================================

      // Step 7: Check existing positions
      console.log("\n📋 Checking existing positions...");
      const trades = await client.trade.getTrades(signerAddress);
      console.log(`Found ${trades.length} open positions`);

      for (const trade of trades) {
        console.log(`\n  Position #${trade.index} on pair ${trade.pairIndex}:`);
        console.log(`    Side: ${trade.buy ? "LONG" : "SHORT"}`);
        console.log(`    Size: $${trade.positionSizeUsdc.toFixed(2)}`);
        console.log(`    Leverage: ${trade.leverage}x`);
        console.log(`    Entry: $${trade.openPrice.toFixed(2)}`);
        console.log(`    Current: $${trade.currentPrice.toFixed(2)}`);
        console.log(
          `    PnL: $${trade.unrealizedPnl.toFixed(2)} (${trade.unrealizedPnlPercentage.toFixed(2)}%)`,
        );
      }
    }

    console.log("\n✨ Done!");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
