# Installation & Setup Guide

This guide walks you through setting up and running the Avantis Web Dashboard.

## Quick Start

```bash
# 1. Clone the repository (if you haven't already)
git clone https://github.com/dylanburkey/avantis-trader-typescript-sdk.git
cd avantis-trader-typescript-sdk

# 2. Navigate to the web dashboard
cd examples/web-dashboard

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev

# 5. Open in browser
open http://localhost:3000
```

## Detailed Setup

### Step 1: Prerequisites

Ensure you have the following installed:

| Requirement | Minimum Version | Check Command |
|-------------|-----------------|---------------|
| Node.js | 18.0.0 | `node --version` |
| npm | 9.0.0 | `npm --version` |

**Install Node.js:**
- macOS: `brew install node`
- Windows: Download from [nodejs.org](https://nodejs.org)
- Linux: `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs`

### Step 2: Clone the Repository

```bash
git clone https://github.com/dylanburkey/avantis-trader-typescript-sdk.git
cd avantis-trader-typescript-sdk
```

Or if you already have it:
```bash
cd /path/to/avantis-trader-typescript-sdk
git pull origin main
```

### Step 3: Build the SDK (Required)

The web dashboard depends on the SDK, so build it first:

```bash
# From the repository root
npm install
npm run build
```

This creates the `dist/` folder with compiled SDK files.

### Step 4: Install Dashboard Dependencies

```bash
cd examples/web-dashboard
npm install
```

This installs:
- Next.js 14
- React 18
- React Query
- Tailwind CSS
- viem
- The local SDK (linked via `file:../../`)

### Step 5: Run the Dashboard

**Development mode** (with hot reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm run build
npm start
```

### Step 6: Open in Browser

Navigate to [http://localhost:3000](http://localhost:3000)

You should see:
- Market stats cards showing total OI
- A table of 91 trading pairs
- Trading interface on the right

## Using the Dashboard

### View Market Data (No Wallet Required)

The dashboard fetches live data from Avantis automatically:
1. **Market Stats**: Total long/short open interest
2. **Pairs Table**: Click any row to select a pair
3. **Pair Details**: View utilization, skew, spread

### Connect Wallet (For Trading)

1. Click **"Connect Wallet"** in the header
2. Enter your private key (0x... format)
3. Click **"Connect"**

Your wallet address and USDC balance will appear.

> **Security Warning**: This is a demo. Never use your main wallet's private key. Create a test wallet with small amounts.

### Open a Trade

1. Select a pair from the Markets table
2. Choose **Long** or **Short**
3. Enter collateral amount (minimum $10)
4. Adjust leverage with the slider
5. Optionally set Take Profit / Stop Loss
6. Click **"Open Long"** or **"Open Short"**

### Manage Positions

Once you have open positions:
1. View them in the **Open Positions** section
2. Click **"Modify"** to update TP/SL
3. Click **"Close"** to close at market price

## Troubleshooting

### "Module not found: avantisfi-sdk"

The SDK needs to be built first:
```bash
cd ../..  # Go to repository root
npm install
npm run build
cd examples/web-dashboard
npm install
```

### "ENOENT: no such file or directory"

Make sure you're in the correct directory:
```bash
pwd
# Should show: .../avantis-trader-typescript-sdk/examples/web-dashboard
```

### Port 3000 already in use

Use a different port:
```bash
npm run dev -- -p 3001
```

### Build errors

Clear cache and reinstall:
```bash
rm -rf node_modules .next
npm install
npm run dev
```

### Wallet connection fails

- Ensure your private key starts with `0x`
- Private key must be 66 characters (0x + 64 hex chars)
- Check browser console for detailed error

### No market data showing

- Check your internet connection
- The Avantis Socket API must be accessible
- Try refreshing the page

## Environment Variables (Optional)

Create a `.env.local` file for custom configuration:

```bash
# Custom RPC URL (optional, defaults to public Base RPC)
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org

# Custom Socket API URL (optional)
NEXT_PUBLIC_SOCKET_API_URL=https://socket-api-pub.avantisfi.com/socket-api/v1/data
```

## Development

### File Structure

```
src/
├── app/           # Next.js app router pages
├── components/    # React components
├── hooks/         # Custom React hooks
├── lib/           # Utilities and SDK setup
└── types/         # TypeScript interfaces
```

### Making Changes

1. Edit files in `src/`
2. Changes auto-reload in dev mode
3. Check browser console for errors

### Adding New Features

1. Create components in `src/components/`
2. Add hooks in `src/hooks/`
3. Import and use in `src/app/page.tsx`

## Deployment

### Vercel

```bash
npm install -g vercel
vercel
```

### Cloudflare Workers (Recommended)

Deploy your Next.js app to Cloudflare's edge network using the OpenNext adapter.

#### Option 1: New Deployment with C3

If starting fresh, use Cloudflare's create tool:

```bash
npm create cloudflare@latest -- avantis-dashboard --framework=next
```

#### Option 2: Deploy Existing Project

1. **Install dependencies**

```bash
npm install @opennextjs/cloudflare@latest
npm install -D wrangler@latest
```

2. **Create `wrangler.toml`** in project root:

```toml
main = ".open-next/worker.js"
name = "avantis-dashboard"
compatibility_date = "2025-03-25"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"
```

3. **Create `open-next.config.ts`** in project root:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

4. **Update `package.json`** scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
  }
}
```

5. **Preview locally** (uses Cloudflare's workerd runtime):

```bash
npm run preview
```

6. **Deploy to Cloudflare**:

```bash
npm run deploy
```

Your app will be available at `https://avantis-dashboard.<your-subdomain>.workers.dev`.

#### Cloudflare Workers Features

| Feature | Status |
|---------|--------|
| App Router | Supported |
| Server-Side Rendering | Supported |
| React Server Components | Supported |
| API Routes | Supported |
| Middleware | Supported |
| Image Optimization | Supported (via Cloudflare Images) |

#### Environment Variables on Cloudflare

Set secrets using Wrangler:

```bash
wrangler secret put NEXT_PUBLIC_RPC_URL
```

Or add to `wrangler.toml`:

```toml
[vars]
NEXT_PUBLIC_RPC_URL = "https://mainnet.base.org"
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t avantis-dashboard .
docker run -p 3000:3000 avantis-dashboard
```

### Static Export

```bash
npm run build
# Output in .next/ folder
```

## Support

- **Issues**: [GitHub Issues](https://github.com/dylanburkey/avantis-trader-typescript-sdk/issues)
- **SDK Docs**: See `/docs` folder in repository
- **Avantis Protocol**: [avantisfi.com](https://avantisfi.com)
