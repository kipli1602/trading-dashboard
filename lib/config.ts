import { BotConfig, PairConfig } from '@/types'

export const PAIRS_9: PairConfig[] = [
  { symbol: 'BTCUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 150000, stopLossPercent: 7, takeProfitPercent: 15 },
  { symbol: 'ETHUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 150000, stopLossPercent: 8, takeProfitPercent: 15 },
  { symbol: 'ADAUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 100000, stopLossPercent: 8, takeProfitPercent: 20 },
  { symbol: 'XRPUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 100000, stopLossPercent: 9, takeProfitPercent: 25 },
  { symbol: 'DOGEUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 80000, stopLossPercent: 10, takeProfitPercent: 25 },
  { symbol: 'LINKUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 100000, stopLossPercent: 8, takeProfitPercent: 20 },
  { symbol: 'SOLUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 100000, stopLossPercent: 9, takeProfitPercent: 20 },
  { symbol: 'BNBUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 100000, stopLossPercent: 7, takeProfitPercent: 18 },
  { symbol: 'AVAXUSDT', enabled: true, strategies: ['ma_crossover', 'rsi', 'bollinger', 'macd', 'momentum'], maxPositionSize: 80000, stopLossPercent: 10, takeProfitPercent: 20 },
]

export const DEFAULT_BOT_CONFIG: BotConfig = {
  apiKey: process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',
  testnet: process.env.USE_TESTNET === 'true',
  maxPairs: 9,
  maxPositionPerPair: 150000,
  dailyLossLimit: 100000,
  enabledPairs: PAIRS_9,
  strategyWeights: {
    ma_crossover: 0.25,
    rsi: 0.20,
    bollinger: 0.15,
    macd: 0.20,
    momentum: 0.20,
  },
}

export const STRATEGY_NAMES: Record<string, string> = {
  ma_crossover: 'MA Crossover',
  rsi: 'RSI',
  bollinger: 'Bollinger Bands',
  macd: 'MACD',
  momentum: 'Momentum',
  atr_momentum: 'ATR Momentum',
  vwap: 'VWAP Bounce',
}

export const TIMEFRAME_CONFIG = {
  interval: '1h' as const,
  lookback: 500,
}

export const RISK_CONFIG = {
  maxPositionPerPair: 150000,
  stopLossPercent: 7,
  takeProfitPercent: 15,
  trailingStop: 5,
  dailyLossLimit: 100000,
  maxOpenPositions: 5,
}