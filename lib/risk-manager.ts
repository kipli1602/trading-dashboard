import { Position, Trade, PortfolioStats, BotConfig, PairConfig } from '@/types'
import { RISK_CONFIG } from '@/lib/config'

// ============================================================
// Risk Manager
// ============================================================
// Kelola position sizing, stop loss, take profit, dan portfolio risk

export class RiskManager {
  private config: BotConfig
  private positions: Map<string, Position>
  private tradeHistory: Trade[]
  private dailyPnL: number
  private lastResetDate: string

  constructor(config: BotConfig) {
    this.config = config
    this.positions = new Map()
    this.tradeHistory = []
    this.dailyPnL = 0
    this.lastResetDate = new Date().toISOString().split('T')[0]
  }

  // Check if new position is allowed based on risk rules
  canOpenPosition(symbol: string, confidence: number): { allowed: boolean; reason: string } {
    const today = new Date().toISOString().split('T')[0]
    if (today !== this.lastResetDate) {
      this.dailyPnL = 0
      this.lastResetDate = today
    }

    // Check daily loss limit
    if (this.dailyPnL < -this.config.dailyLossLimit) {
      return { allowed: false, reason: 'DAILY_LOSS_LIMIT_REACHED' }
    }

    // Check max open positions
    const openPositions = Array.from(this.positions.values()).filter(p => p.status === 'OPEN')
    if (openPositions.length >= RISK_CONFIG.maxOpenPositions) {
      return { allowed: false, reason: 'MAX_OPEN_POSITIONS_REACHED' }
    }

    // Check if already have position for this pair
    const existing = this.positions.get(symbol)
    if (existing && existing.status === 'OPEN') {
      return { allowed: false, reason: 'ALREADY_IN_POSITION' }
    }

    // Confidence threshold
    if (confidence < 0.3) {
      return { allowed: false, reason: 'CONFIDENCE_BELOW_THRESHOLD' }
    }

    return { allowed: true, reason: 'OK' }
  }

  // Calculate position size based on confidence and risk rules
  calculatePositionSize(symbol: string, currentPrice: number, confidence: number): number {
    const pairConfig = this.config.enabledPairs.find(p => p.symbol === symbol)
    if (!pairConfig) {
      return 0
    }

    // Base position size from pair config
    let positionSize = pairConfig.maxPositionSize

    // Scale by confidence
    positionSize *= confidence

    // Scale by daily PnL (reduce if losing)
    if (this.dailyPnL < 0) {
      const lossRatio = Math.min(1, Math.abs(this.dailyPnL) / this.config.dailyLossLimit)
      positionSize *= (1 - lossRatio * 0.5)
    }

    // Ensure within max position per pair
    positionSize = Math.min(positionSize, pairConfig.maxPositionSize)

    // Convert to quantity
    const quantity = Math.floor((positionSize / currentPrice) * 1000000) / 1000000
    return quantity
  }

  // Open a new position
  openPosition(signal: {
    symbol: string
    price: number
    confidence: number
    strategy: string
  }): Position | null {
    const symbol = signal.symbol
    const pairConfig = this.config.enabledPairs.find(p => p.symbol === symbol)
    if (!pairConfig) return null

    const canOpen = this.canOpenPosition(symbol, signal.confidence)
    if (!canOpen.allowed) {
      console.log(`Position rejected: ${canOpen.reason}`)
      return null
    }

    const quantity = this.calculatePositionSize(symbol, signal.price, signal.confidence)
    if (quantity <= 0) return null

    const stopLoss = signal.price * (1 - pairConfig.stopLossPercent / 100)
    const takeProfit = signal.price * (1 + pairConfig.takeProfitPercent / 100)

    const position: Position = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      entryPrice: signal.price,
      currentPrice: signal.price,
      quantity,
      side: 'LONG',
      entryTime: new Date().toISOString(),
      currentPnL: 0,
      pnlPercent: 0,
      status: 'OPEN',
      stopLoss,
      takeProfit,
    }

    this.positions.set(symbol, position)
    return position
  }

  // Close a position
  closePosition(symbol: string, exitPrice: number): Position | null {
    const position = this.positions.get(symbol)
    if (!position || position.status !== 'OPEN') return null

    const pnl = (exitPrice - position.entryPrice) * position.quantity
    const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100

    position.exitPrice = exitPrice
    position.exitTime = new Date().toISOString()
    position.status = 'CLOSED'
    position.currentPnL = pnl
    position.pnlPercent = pnlPercent
    position.currentPrice = exitPrice

    this.dailyPnL += pnl

    // Record trade
    const trade: Trade = {
      id: `trade-${Date.now()}-${symbol}`,
      symbol,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      side: 'LONG',
      entryTime: position.entryTime,
      exitTime: position.exitTime,
      pnl,
      pnlPercent,
      strategy: 'AI_Consensus',
      confidence: 0, // Would be set from the signal
      fee: (position.quantity * (position.entryPrice + exitPrice) * 0.001) / 2,
    }
    this.tradeHistory.push(trade)

    return position
  }

  // Check if any position hit SL/TP
  checkSLTP(currentPrices: Map<string, number>): { symbol: string; action: 'SL' | 'TP'; price: number }[] {
    const triggered: { symbol: string; action: 'SL' | 'TP'; price: number }[] = []

    for (const [symbol, position] of Array.from(this.positions.entries())) {
      if (position.status !== 'OPEN') continue

      const currentPrice = currentPrices.get(symbol)
      if (!currentPrice) continue

      position.currentPrice = currentPrice
      position.currentPnL = (currentPrice - position.entryPrice) * position.quantity
      position.pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100

      // Check stop loss
      if (position.stopLoss && currentPrice <= position.stopLoss) {
        triggered.push({ symbol, action: 'SL', price: currentPrice })
      }
      // Check take profit
      else if (position.takeProfit && currentPrice >= position.takeProfit) {
        triggered.push({ symbol, action: 'TP', price: currentPrice })
      }
    }

    return triggered
  }

  // Get current portfolio stats
  getPortfolioStats(): PortfolioStats {
    const openPositions = Array.from(this.positions.values()).filter(p => p.status === 'OPEN')
    const totalValue = openPositions.reduce((sum, p) => sum + p.currentPnL + (openPositions.length > 0 ? 0 : 0), 0)

    const closedTrades = this.tradeHistory
    const wins = closedTrades.filter(t => t.pnl > 0)
    const losses = closedTrades.filter(t => t.pnl < 0)
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length) : 0

    return {
      totalValue: totalValue + 500000, // initial capital
      totalPnL: this.tradeHistory.reduce((sum, t) => sum + t.pnl, 0),
      totalPnLPercent: ((totalValue + 500000 - 500000) / 500000) * 100,
      dayChange: this.dailyPnL,
      dayChangePercent: (this.dailyPnL / 500000) * 100,
      activePositions: openPositions.length,
      totalTrades: closedTrades.length,
      winRate: parseFloat(winRate.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
    }
  }

  // Get all positions (open and closed)
  getAllPositions(): Position[] {
    return Array.from(this.positions.values())
  }

  // Get trade history
  getTradeHistory(limit: number = 100): Trade[] {
    return this.tradeHistory.slice(-limit)
  }

  // Get open positions
  getOpenPositions(): Map<string, Position> {
    return this.positions
  }
}

// In-memory store (in production, use Redis/Vercel KV)
export const riskManager = new RiskManager({
  apiKey: process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',
  testnet: process.env.USE_TESTNET === 'true',
  maxPairs: 9,
  maxPositionPerPair: 150000,
  dailyLossLimit: 100000,
  enabledPairs: [],
  strategyWeights: {},
})