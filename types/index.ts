export interface Position {
  id: string
  symbol: string
  entryPrice: number
  currentPrice: number
  quantity: number
  side: 'LONG' | 'SHORT'
  entryTime: string
  currentPnL: number
  pnlPercent: number
  status: 'OPEN' | 'CLOSED'
  exitPrice?: number
  exitTime?: string
  stopLoss?: number
  takeProfit?: number
}

export interface Trade {
  id: string
  symbol: string
  entryPrice: number
  exitPrice: number
  quantity: number
  side: 'LONG' | 'SHORT'
  entryTime: string
  exitTime: string
  pnl: number
  pnlPercent: number
  strategy: string
  confidence: number
  fee: number
}

export interface Signal {
  id: string
  symbol: string
  strategy: string
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  price: number
  timestamp: string
  indicators: Record<string, number | undefined>
  reasons: string[]
}

export interface StrategyResult {
  name: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  indicators: Record<string, number | undefined>
  reasons: string[]
}

export interface PairConfig {
  symbol: string
  enabled: boolean
  strategies: string[]
  maxPositionSize: number
  stopLossPercent: number
  takeProfitPercent: number
}

export interface BotConfig {
  apiKey: string
  apiSecret: string
  testnet: boolean
  maxPairs: number
  maxPositionPerPair: number
  dailyLossLimit: number
  enabledPairs: PairConfig[]
  strategyWeights: Record<string, number>
}

export interface PortfolioStats {
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  dayChange: number
  dayChangePercent: number
  activePositions: number
  totalTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
}

export type TimeFrame = '1h' | '4h' | '1d'

export interface PriceData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}