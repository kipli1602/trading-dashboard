import BinanceAPI from '@/lib/binance'
import MockBinanceAPI from '@/lib/binance-mock'
import BybitAPI from '@/lib/bybit-mock'
import CoinbaseAPI from '@/lib/coinbase'
import KuCoinAPI from '@/lib/kucoin'
import AISignalEngine from '@/lib/ai-signal'
import { RiskManager, riskManager } from '@/lib/risk-manager'
import { DEFAULT_BOT_CONFIG, RISK_CONFIG } from '@/lib/config'
import { PriceData, Position, Signal } from '@/types'
import { PAIRS_9 } from '@/lib/config'

// ============================================================
// Trading Bot Engine
// ============================================================
// Menggabungkan: Data fetching + AI signals + Risk management + Auto execution
// Supports: KuCoin (US OK) > Coinbase (US OK) > Bybit (Singapore required) > Mock

export class TradingBot {
  private binance: BinanceAPI | MockBinanceAPI | BybitAPI | CoinbaseAPI | KuCoinAPI
  private aiEngine: AISignalEngine
  private riskMgr: RiskManager
  private isRunning: boolean = false
  private config = DEFAULT_BOT_CONFIG
  private intervalId: any = null
  private checkInterval: number = 300

  constructor(useMock: boolean = true, apiKey?: string, apiSecret?: string, passphrase?: string) {
    if (useMock) {
      // Use mock for dev/testing, CoinGecko for real prices
      this.binance = new MockBinanceAPI()
    } else if (passphrase && process.env.USE_COINBASE === 'true') {
      // Use Coinbase for real trading (works from US IPs!)
      this.binance = new CoinbaseAPI(apiKey || '', apiSecret || '', passphrase)
    } else if (process.env.KUCOIN_API_KEY || (apiKey && passphrase && process.env.USE_KUCOIN === 'true')) {
      // Use KuCoin for real trading (works from US IPs!)
      this.binance = new KuCoinAPI(
        process.env.KUCOIN_API_KEY || apiKey || '',
        process.env.KUCOIN_API_SECRET || apiSecret || '',
        process.env.KUCOIN_PASSPHRASE || passphrase || ''
      )
    } else {
      // Use Bybit as fallback for real trading
      this.binance = new BybitAPI(apiKey || '', apiSecret || '')
    }

    this.aiEngine = new AISignalEngine(this.config.strategyWeights)
    this.riskMgr = riskManager
  }

  // Update bot configuration at runtime
  updateConfig(newConfig: any): void {
    if (newConfig.apiKey || newConfig.apiSecret) {
      const useMock = !newConfig.useTestnet && (!newConfig.enableTrading || !newConfig.apiKey)
      if (useMock) {
        this.binance = new MockBinanceAPI()
      } else {
        this.binance = new BinanceAPI(newConfig.apiKey || '', newConfig.apiSecret || '', newConfig.useTestnet || false)
      }
    }
    if (newConfig.checkInterval !== undefined) this.checkInterval = newConfig.checkInterval
    if (newConfig.maxOpenPositions !== undefined) this.config.maxPairs = newConfig.maxOpenPositions
    if (newConfig.maxPositionPerPair !== undefined) this.config.maxPositionPerPair = newConfig.maxPositionPerPair
    if (newConfig.dailyLossLimit !== undefined) this.config.dailyLossLimit = newConfig.dailyLossLimit
    if (newConfig.pairs !== undefined) this.config.enabledPairs = newConfig.pairs
    if (newConfig.useTestnet !== undefined) this.config.testnet = newConfig.useTestnet
    if (newConfig.apiKey !== undefined) this.config.apiKey = newConfig.apiKey
    if (newConfig.apiSecret !== undefined) this.config.apiSecret = newConfig.apiSecret
    console.log('Bot config updated')
  }

  // Get current configuration
  getConfig(): any {
    return {
      config: this.config,
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      apiKey: this.config.apiKey || '',
      apiSecret: this.config.apiSecret || '',
      useTestnet: this.config.testnet,
    }
  }

  // Start the bot
  async start(intervalSeconds: number = 300): Promise<void> {
    if (this.isRunning) {
      console.log('Bot sudah berjalan')
      return
    }

    this.isRunning = true
    console.log('Trading Bot started!')

    // Run immediately
    await this.runCycle()

    // Set interval untuk cron-like behavior
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        try {
          await this.runCycle()
        } catch (e) {
          console.error('Bot cycle error:', e)
        }
      }
    }, intervalSeconds * 1000)
  }

  // Stop the bot
  stop(): void {
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('Trading Bot stopped')
  }

  // Main trading cycle
  async runCycle(): Promise<{
    signals: Signal[]
    positions: Position[]
    stats: any
    pairCount?: number
    errors?: string[]
  }> {
    console.log(`[${new Date().toISOString()}] Running trading cycle...`)
    const errors: string[] = []

    // Step 1: Fetch price data for all 9 pairs (staggered for CoinGecko rate limit)
    const pairData = new Map<string, PriceData[]>()

    const fetchPromises = this.config.enabledPairs
      .filter(p => p.enabled)
      .map(async (pairConfig, index) => {
        // Stagger requests to avoid CoinGecko rate limit (50/min, burst protected)
        await new Promise(resolve => setTimeout(resolve, index * 500))
        try {
          const data = await this.binance.getKlines(
            pairConfig.symbol,
            '1h',
            500
          )
          if (data && data.length > 0) {
            pairData.set(pairConfig.symbol, data)
          } else {
            errors.push(`${pairConfig.symbol}: no klines data returned`)
          }
        } catch (e: any) {
          errors.push(`${pairConfig.symbol}: ${e.message || 'fetch failed'}`)
        }
      })

    await Promise.all(fetchPromises)

    // Step 2: Generate AI signals for all pairs
    const activePairs = this.config.enabledPairs
      .filter(p => p.enabled)
      .map(p => ({ symbol: p.symbol, strategies: p.strategies }))

    const signals = this.aiEngine.generateAllSignals(pairData, activePairs)

    console.log(`Generated ${signals.length} signals`)

    // Step 3: Execute trades based on signals
    for (const signal of signals) {
      await this.processSignal(signal, pairData.get(signal.symbol))
    }

    // Step 4: Check SL/TP for existing positions
    await this.checkSLTP()

    // Step 5: Get current prices & update positions
    const currentPrices = new Map<string, number>()
    for (const pairConfig of this.config.enabledPairs) {
      try {
        const price = await this.binance.getPrice(pairConfig.symbol)
        currentPrices.set(pairConfig.symbol, price)
      } catch (e) {
        console.error(`Failed to get price for ${pairConfig.symbol}`, e)
      }
    }

    // Update positions with current prices
    const triggered = this.riskMgr.checkSLTP(currentPrices)
    for (const t of triggered) {
      await this.closePosition(t.symbol, t.price, t.action)
    }

    // Step 6: Get portfolio stats
    const stats = this.riskMgr.getPortfolioStats()

    return {
      signals,
      positions: this.riskMgr.getAllPositions(),
      stats,
      pairCount: pairData.size,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  // Process a single signal and execute if appropriate
  private async processSignal(signal: Signal, priceData?: PriceData[]): Promise<void> {
    const canOpen = this.riskMgr.canOpenPosition(signal.symbol, signal.confidence)

    if (!canOpen.allowed) {
      console.log(`Position rejected for ${signal.symbol}: ${canOpen.reason}`)
      return
    }

    // Only take BUY signals with confidence >0.3
    if (signal.action !== 'BUY' || signal.confidence < 0.3) {
      return
    }

    console.log(`AI Signal: BUY ${signal.symbol} (confidence: ${signal.confidence})`)

    // Calculate position size
    const currentPrice = priceData ? priceData[priceData.length - 1].close : signal.price
    const quantity = this.riskMgr.calculatePositionSize(signal.symbol, currentPrice, signal.confidence)

    if (quantity <= 0) {
      console.log(`Quantity too small for ${signal.symbol}`)
      return
    }

    // Get symbol info for step size (fallback to default if Bybit geo-blocked)
    const info = await this.binance.getSymbolInfo(signal.symbol)
    const lotSize = info?.lotSize || 0.001
    const formattedQty = this.binance.formatQuantity(quantity, lotSize)

    if (formattedQty <= 0) {
      console.log(`Quantity too small for ${signal.symbol}`)
      return
    }

    // Place BUY order
    try {
      const order = await this.binance.placeOrder(
        signal.symbol, 'BUY', 'MARKET', formattedQty
      )

      console.log(`BUY order placed: ${signal.symbol} x ${formattedQty}`, order)

      // Open position in risk manager
      const position = this.riskMgr.openPosition({
        symbol: signal.symbol,
        price: order.fills[0].price,
        confidence: signal.confidence,
        strategy: signal.strategy,
      })

      if (position) {
        // Set stop loss and take profit via OCO
        if (position.stopLoss && position.takeProfit) {
          await this.setSLTP(position)
        }
      }
    } catch (error) {
      console.error(`Real trading failed (likely geo-block), using mock execution: ${signal.symbol}`)
      // Mock execution fallback when Bybit/Binance geo-blocked from Vercel
      const mockPrice = currentPrice.toString()
      console.log(`SIMULATED BUY: ${signal.symbol} x ${formattedQty} @ ${mockPrice}`)

      // Open position in risk manager with mock order data
      const position = this.riskMgr.openPosition({
        symbol: signal.symbol,
        price: parseFloat(mockPrice),
        confidence: signal.confidence,
        strategy: signal.strategy,
      })

      if (position) {
        // Set TP/SL on mock position (won't actually place on exchange, but tracks levels)
        if (position.stopLoss && position.takeProfit) {
          try { await this.setSLTP(position) } catch { /* mock - ignore SL/TP errors */ }
        }
      }
    }
  }

  // Set Stop Loss and Take Profit after entry
  private async setSLTP(position: Position): Promise<void> {
    if (!position.stopLoss || !position.takeProfit) return

    try {
      const info = await this.binance.getSymbolInfo(position.symbol)
      if (!info) return

      // Place SELL OCO: Take Profit + Stop Loss
      await this.binance.placeOCO(
        position.symbol,
        'SELL',
        position.quantity,
        position.takeProfit,
        position.stopLoss,
        position.stopLoss * 0.995 // Stop limit slightly below stop loss
      )
      console.log(`SL/TP set for ${position.symbol}: TP=${position.takeProfit}, SL=${position.stopLoss}`)
    } catch (e) {
      console.error(`Failed to set SL/TP for ${position.symbol}:`, e)
    }
  }

  // Close a position manually or due to SL/TP
  private async closePosition(symbol: string, price: number, reason: 'SL' | 'TP' | 'SIGNAL'): Promise<void> {
    const openPositions = this.riskMgr.getOpenPositions()
    const position = openPositions.get(symbol)

    if (!position) return

    try {
      const info = await this.binance.getSymbolInfo(symbol)
      if (!info) return

      const quantity = this.binance.formatQuantity(position.quantity, info.lotSize)

      await this.binance.placeOrder(symbol, 'SELL', 'MARKET', quantity)
      const closed = this.riskMgr.closePosition(symbol, price)

      console.log(
        `${reason} triggered for ${symbol}: Entry=${position.entryPrice.toFixed(2)}, ` +
        `Exit=${price.toFixed(2)}, PnL=${closed?.currentPnL?.toFixed(2)}`
      )
    } catch (e) {
      console.error(`Failed to close position ${symbol}:`, e)
    }
  }

  // Check all positions for SL/TP triggers
  private async checkSLTP(): Promise<void> {
    const openPositions = this.riskMgr.getOpenPositions()
    const currentPrices = new Map<string, number>()

    for (const [symbol, position] of openPositions) {
      if (position.status !== 'OPEN') continue
      try {
        const price = await this.binance.getPrice(symbol)
        currentPrices.set(symbol, price)
      } catch (e) {
        console.error(`Failed to get price for ${symbol}`, e)
      }
    }

    const triggered = this.riskMgr.checkSLTP(currentPrices)
    for (const t of triggered) {
      await this.closePosition(t.symbol, t.price, t.action)
    }
  }

  // Get current bot status
  getStatus(): { isRunning: boolean; config: any } {
    return {
      isRunning: this.isRunning,
      config: {
        maxPairs: this.config.maxPairs,
        dailyLossLimit: this.config.dailyLossLimit,
        strategyWeights: this.config.strategyWeights,
        enabledPairs: this.config.enabledPairs.filter(p => p.enabled).map(p => p.symbol),
      },
    }
  }

  // Process manual signal (from API or UI)
  async processManualSignal(data: {
    symbol: string
    action: 'BUY' | 'SELL'
    quantity?: number
    price?: number
  }): Promise<{ success: boolean; message: string }> {
    try {
      if (data.action === 'SELL') {
        // Close existing position
        const openPositions = this.riskMgr.getOpenPositions()
        const position = openPositions.get(data.symbol)
        if (position && position.status === 'OPEN') {
          const closePrice = data.price || await this.binance.getPrice(data.symbol)
          await this.closePosition(data.symbol, closePrice, 'SIGNAL')
          return { success: true, message: `Position closed for ${data.symbol}` }
        }
        return { success: false, message: `No open position for ${data.symbol}` }
      }

      // BUY
      if (data.action === 'BUY') {
        const priceData = await this.binance.getKlines(data.symbol, '1h', 100)
        const signal = this.aiEngine.generateSignal(priceData, data.symbol,
          this.config.enabledPairs.find(p => p.symbol === data.symbol)?.strategies || []
        )

        if (signal.confidence < 0.5) {
          return { success: false, message: `Signal confidence too low: ${signal.confidence}` }
        }

        const price = data.price || priceData[priceData.length - 1].close
        const position = this.riskMgr.openPosition({
          symbol: data.symbol,
          price,
          confidence: signal.confidence,
          strategy: signal.strategy,
        })

        if (!position) {
          return { success: false, message: 'Position opening rejected by risk manager' }
        }

        const info = await this.binance.getSymbolInfo(data.symbol)
        if (info) {
          const qty = this.binance.formatQuantity(
            data.quantity || position.quantity,
            info.lotSize
          )
          await this.binance.placeOrder(data.symbol, 'BUY', 'MARKET', qty)
          return { success: true, message: `BUY order placed: ${data.symbol} x ${qty}` }
        }

        return { success: false, message: 'Symbol info not found' }
      }

      return { success: false, message: 'Invalid action' }
    } catch (e: any) {
      return { success: false, message: `Error: ${e.message}` }
    }
  }

  // Get price data for charts
  async getPriceData(symbol: string, interval: string = '1h', limit: number = 200): Promise<PriceData[]> {
    return await this.binance.getKlines(symbol, interval, limit)
  }

  // Get all 9 pair current prices
  async getAllPrices(): Promise<Record<string, number>> {
    // Try CoinGecko API for real prices (free, no IP block)
    const COINGECKO_IDS: Record<string, string> = {
      BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', ADAUSDT: 'cardano',
      XRPUSDT: 'ripple', DOGEUSDT: 'dogecoin', LINKUSDT: 'chainlink',
      SOLUSDT: 'solana', BNBUSDT: 'binancecoin', AVAXUSDT: 'avalanche-2',
    }
    try {
      const ids = Object.values(COINGECKO_IDS).join(',')
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)
      const data = await res.json() as Record<string, { usd: number }>
      const prices: Record<string, number> = {}
      for (const [symbol, cgId] of Object.entries(COINGECKO_IDS)) {
        prices[symbol] = data[cgId]?.usd || 0
      }
      return prices
    } catch (e) {
      console.log('[CoinGecko] Fallback to mock prices:', (e as Error).message)
      return this.binance.getAllPrices()
    }
  }
}

// Export singleton instance
// Priority: KuCoin (US OK) > Coinbase (US OK) > Bybit (SG) > Mock
const hasKuCoin = !!(process.env.KUCOIN_API_KEY && process.env.KUCOIN_API_SECRET && process.env.KUCOIN_PASSPHRASE)
const hasCoinbase = !!(process.env.CB_API_KEY && process.env.CB_API_SECRET && process.env.CB_PASSPHRASE)
const hasBybit = !!(process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET)

export const tradingBot = new TradingBot(
  !hasKuCoin && !hasCoinbase && !hasBybit, // useMock
  process.env.KUCOIN_API_KEY || process.env.CB_API_KEY || process.env.BYBIT_API_KEY || process.env.BINANCE_API_KEY || '',
  process.env.KUCOIN_API_SECRET || process.env.CB_API_SECRET || process.env.BYBIT_API_SECRET || process.env.BINANCE_API_SECRET || '',
  process.env.KUCOIN_PASSPHRASE || process.env.CB_PASSPHRASE || ''
)