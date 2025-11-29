# Avantis Web Dashboard

A complete web dashboard example built with Next.js and the Avantis TypeScript SDK.

## Features

- **Market Overview**: View all 91 trading pairs with real-time data
- **Market Stats**: Total open interest, long/short breakdown
- **Pair Details**: Detailed view of selected pair including utilization, skew, and spread
- **Trading Interface**: Open long/short positions with customizable leverage and TP/SL
- **Position Management**: View, modify, and close open positions
- **Wallet Connection**: Connect with private key (demo only)

## Screenshots

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Avantis                    Markets  Trade  Positions      [Connect]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Total OI │  │ Long OI  │  │ Short OI │  │  Pairs   │               │
│  │  $50.2M  │  │  $27.8M  │  │  $22.4M  │  │    91    │               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│                                                                         │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────┐ │
│  │ Markets                             │  │ ETH/USD                 │ │
│  │ ───────────────────────────────── │  │ $3,547.82               │ │
│  │ Pair      Price    L/S    OI      │  │                         │ │
│  │ ETH/USD   $3,547   55%   $12M     │  │ Long OI   Short OI      │ │
│  │ BTC/USD   $67,234  48%   $8.5M    │  │ $6.7M     $5.3M         │ │
│  │ SOL/USD   $142.50  62%   $3.2M    │  │ ████████░░░░            │ │
│  │ ...                               │  │                         │ │
│  └─────────────────────────────────────┘  │ Util: L=32% S=26%      │
│                                            │ Skew: Long +12%        │
│  ┌─────────────────────────────────────┐  │ Spread: 5 bps          │
│  │ Open Positions                      │  └─────────────────────────┘
│  │ ───────────────────────────────── │                              │
│  │ ETH/USD LONG 10x      +$45.20     │  ┌─────────────────────────┐ │
│  │ Entry: $3,500  Current: $3,547    │  │ Trade ETH/USD           │ │
│  │ [Modify] [Close]                  │  │ ┌─────────┐┌─────────┐  │ │
│  │                                    │  │ │  Long   ││  Short  │  │ │
│  └─────────────────────────────────────┘  │ └─────────┘└─────────┘  │ │
│                                            │ Collateral: $100       │ │
│                                            │ Leverage: ───●─── 10x  │ │
│                                            │ [Open Long]            │ │
│                                            └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Navigate to the web dashboard directory
cd examples/web-dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
web-dashboard/
├── src/
│   ├── app/
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Main page
│   ├── components/
│   │   ├── Header.tsx      # Navigation & wallet
│   │   ├── MarketStats.tsx # Stats cards
│   │   ├── MarketOverview.tsx  # Pairs table
│   │   ├── PairDetails.tsx # Selected pair info
│   │   ├── TradeForm.tsx   # Trading form
│   │   ├── PositionsList.tsx   # Open positions
│   │   └── Providers.tsx   # React Query provider
│   ├── hooks/
│   │   ├── useMarketData.ts    # Market data fetching
│   │   ├── usePositions.ts # Position management
│   │   └── useWallet.ts    # Wallet state
│   ├── lib/
│   │   └── avantis.ts      # SDK initialization
│   └── types/
│       └── index.ts        # TypeScript types
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Configuration

The dashboard connects to Base mainnet by default. No configuration is required for read-only mode.

For trading, you'll need to connect a wallet with:
1. USDC for collateral
2. ETH for gas fees

## Components

### MarketOverview
Displays a table of all trading pairs with:
- Current price
- Long/short ratio bar
- Total open interest
- Spread in basis points
- Maximum leverage

Click a pair to select it for detailed view and trading.

### PairDetails
Shows detailed metrics for the selected pair:
- Current price
- Long and short open interest with visual bar
- Utilization percentages
- Market skew
- Spread
- Maximum leverage

### TradeForm
Trading interface with:
- Long/short toggle
- Collateral input
- Leverage slider
- Position size calculation
- Take profit / stop loss inputs
- Estimated spread cost

### PositionsList
Displays all open positions with:
- Entry and current price
- Unrealized PnL ($ and %)
- Liquidation price
- TP/SL levels
- Modify and close buttons

## Security Warning

**This is a demo application!**

- Never enter your real private key on untrusted websites
- Use a dedicated test wallet with small amounts
- Private keys are stored in localStorage (not secure for production)
- Always verify transactions before signing

For production applications, use proper wallet connection libraries like:
- [wagmi](https://wagmi.sh)
- [RainbowKit](https://rainbowkit.com)
- [ConnectKit](https://docs.family.co/connectkit)

## Customization

### Adding Dark Mode Toggle

The dashboard supports dark mode via Tailwind CSS. Add a toggle:

```tsx
const [darkMode, setDarkMode] = useState(false);

useEffect(() => {
  document.documentElement.classList.toggle('dark', darkMode);
}, [darkMode]);
```

### Adding More Pairs to Display

In `MarketOverview.tsx`, change the slice limit:

```tsx
{pairs.slice(0, 50).map((pair) => (  // Show 50 pairs
```

### Customizing Refresh Intervals

In the hooks, modify `refetchInterval`:

```tsx
const { data } = useQuery({
  queryKey: ['marketData'],
  queryFn: fetchMarketData,
  refetchInterval: 5000, // 5 seconds
});
```

## Dependencies

- **next**: React framework
- **react-query**: Data fetching and caching
- **tailwindcss**: Styling
- **viem**: Ethereum library
- **avantisfi-sdk**: Avantis TypeScript SDK

## License

MIT
