export interface PairData {
  index: number;
  name: string;
  price: number;
  priceChange24h: number;
  longOi: number;
  shortOi: number;
  utilization: {
    long: number;
    short: number;
  };
  skew: number;
  spread: number;
  maxLeverage: number;
  groupIndex: number;
}

export interface Position {
  pairIndex: number;
  pairName: string;
  tradeIndex: number;
  isLong: boolean;
  collateral: number;
  leverage: number;
  positionSize: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  liquidationPrice: number;
  tp: number;
  sl: number;
  openTime: number;
}

export interface TradeFormData {
  pairIndex: number;
  collateral: number;
  leverage: number;
  isLong: boolean;
  tp: number;
  sl: number;
}

export interface WalletState {
  address: string | null;
  privateKey: string | null;
  balance: number;
  isConnected: boolean;
}

export interface MarketStats {
  totalLongOi: number;
  totalShortOi: number;
  totalPairs: number;
  topGainers: PairData[];
  topLosers: PairData[];
}
