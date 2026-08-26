import { PriceData, StrategyResult, Signal } from '@/types'
import { STRATEGY_FUNCTIONS, ALL_STRATEGY_NAMES } from '@/lib/strategies'
import { DEFAULT_BOT_CONFIG } from '@/lib/config'
 function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ============================================================
// AI Signal Engine
// ============================================================
// Menggabungkan semua strategi menjadi satu sinyal AI
// dengan confidence scoring berbasis weighted voting

class AISignalEngine {
  private strategyWeights: Record<string, number>

  constructor(weights?: Record<string, number>) {
    this.strategyWeights = weights || DEFAULT_BOT_CONFIG.strategyWeights
  }

  // Generate consensus signal dari semua strategi
  generateSignal(data: PriceData[], symbol: string, enabledStrategies: string[]): Signal {
    const results: StrategyResult[] = []
    const activeStrategies = enabledStrategies.length > 0
      ? enabledStrategies
      : ALL_STRATEGY_NAMES

    for (const stratName of activeStrategies) {
      const stratFunc = STRATEGY_FUNCTIONS[stratName]
      if (stratFunc) {
        const result = stratFunc(data)
        results.push(result)
      }
    }

    // Weighted voting
    const buyVotes = results
      .filter(r => r.signal === 'BUY')
      .reduce((sum, r) => sum + (this.strategyWeights[r.name] || 1), 0)

    const sellVotes = results
      .filter(r => r.signal === 'SELL')
      .reduce((sum, r) => sum + (this.strategyWeights[r.name] || 1), 0)

    const holdVotes = results
      .filter(r => r.signal === 'HOLD')
      .reduce((sum, r) => sum + (this.strategyWeights[r.name] || 1), 0)

    const totalWeight = buyVotes + sellVotes + holdVotes
    const currentPrice = data[data.length - 1].close

    // Determine final action
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
    let confidence = 0
    const allReasons: string[] = []
    const allIndicators: Record<string, number | undefined> = {}

    // Collect all indicators and reasons
    for (const r of results) {
      Object.assign(allIndicators, r.indicators)
      allReasons.push(`[${r.name}] ${r.reasons.join('; ')}`)
    }

    // Decision logic
    if (buyVotes > sellVotes && buyVotes > holdVotes) {
      // Calculate consensus strength
      const consensusRatio = buyVotes / totalWeight
      // Boost confidence based on how many strategies agree
      const agreementFactor = results.filter(r => r.signal === 'BUY').length / results.length
      const avgConfidence = results
        .filter(r => r.signal === 'BUY')
        .reduce((sum, r) => sum + r.confidence, 0) / Math.max(1, results.filter(r => r.signal === 'BUY').length)

      action = 'BUY'
      confidence = Math.min(0.95, consensusRatio * agreementFactor * avgConfidence * 1.5 + 0.3)
      allReasons.push(`AI CONFIDENCE: ${buyVotes.toFixed(2)} buy votes vs ${(sellVotes + holdVotes).toFixed(2)} others`)
      allReasons.push(`Consensus ratio: ${(consensusRatio * 100).toFixed(1)}% | Agreement: ${(agreementFactor * 100).toFixed(1)}%`)
    } else if (sellVotes > buyVotes && sellVotes > holdVotes) {
      const consensusRatio = sellVotes / totalWeight
      const agreementFactor = results.filter(r => r.signal === 'SELL').length / results.length
      const avgConfidence = results
        .filter(r => r.signal === 'SELL')
        .reduce((sum, r) => sum + r.confidence, 0) / Math.max(1, results.filter(r => r.signal === 'SELL').length)

      action = 'SELL'
      confidence = Math.min(0.95, consensusRatio * agreementFactor * avgConfidence * 1.5 + 0.3)
      allReasons.push(`AI CONFIDENCE: ${sellVotes.toFixed(2)} sell votes vs ${(buyVotes + holdVotes).toFixed(2)} others`)
      allReasons.push(`Consensus ratio: ${(consensusRatio * 100).toFixed(1)}% | Agreement: ${(agreementFactor * 100).toFixed(1)}%`)
    } else {
      action = 'HOLD'
      confidence = 0
      allReasons.push(`No clear signal: Buy=${buyVotes.toFixed(2)}, Sell=${sellVotes.toFixed(2)}, Hold=${holdVotes.toFixed(2)}`)
    }

    // Add market regime analysis
    const marketRegime = this.analyzeMarketRegime(data)
    allReasons.push(`Market regime: ${marketRegime.regime} | Trend strength: ${(marketRegime.strength * 100).toFixed(1)}%`)

    // Adjust confidence based on market regime
    confidence *= marketRegime.confidenceMultiplier

    return {
      id: generateId(),
      symbol,
      strategy: 'AI_Consensus',
      action,
      confidence: parseFloat(confidence.toFixed(3)),
      price: currentPrice,
      timestamp: new Date().toISOString(),
      indicators: {
        ...allIndicators,
        buyVotes: parseFloat(buyVotes.toFixed(2)),
        sellVotes: parseFloat(sellVotes.toFixed(2)),
        holdVotes: parseFloat(holdVotes.toFixed(2)),
        ...marketRegime.indicators,
      },
      reasons: allReasons,
    }
  }

  // Analyze market regime (trend, volatility, momentum)
  private analyzeMarketRegime(data: PriceData[]) {
    const closes = data.map(d => d.close)
    const idx = closes.length - 1
    const lookback = Math.min(20, closes.length - 1)

    if (idx < lookback) return { regime: 'unknown', strength: 0, confidenceMultiplier: 0.5, indicators: {} }

    // Trend detection (price vs MA)
    const ma20 = closes.slice(idx - lookback, idx + 1).reduce((a, b) => a + b, 0) / lookback
    const currentPrice = closes[idx]
    const trendStrength = Math.abs((currentPrice - ma20) / ma20)
    const trendDirection = currentPrice > ma20 ? 'uptrend' : 'downtrend'

    // Volatility detection (ATR-like)
    const recentVolatility = closes.slice(idx - lookback, idx + 1)
      .reduce((sum, c, i, arr) => i > 0 ? sum + Math.abs(c - arr[i - 1]) : sum, 0) / lookback / currentPrice

    // Momentum (recent return)
    const recentReturn = (closes[idx] - closes[idx - lookback]) / closes[idx - lookback]

    let regime = 'consolidation'
    let confidenceMultiplier = 0.7
    let strength = 0

    if (trendStrength > 0.02 && Math.abs(recentReturn) > 0.01) {
      regime = trendDirection
      strength = trendStrength
      confidenceMultiplier = trendStrength > 0.05 ? 1.1 : 1.0
    }

    if (recentVolatility > 0.02) {
      regime += ' (high_vol)'
      confidenceMultiplier *= 0.9 // Lower confidence in high volatility
    }

    return {
      regime,
      strength,
      confidenceMultiplier,
      indicators: {
        trendStrength,
        volatility: parseFloat(recentVolatility.toFixed(4)),
        recentReturn: parseFloat((recentReturn * 100).toFixed(2)),
      },
    }
  }

  // Generate signal for all 9 pairs
  generateAllSignals(
    pairData: Map<string, PriceData[]>,
    pairConfigs: { symbol: string, strategies: string[] }[]
  ): Signal[] {
    const signals: Signal[] = []

    for (const config of pairConfigs) {
      const data = pairData.get(config.symbol)
      if (data && data.length >= 20) {
        const signal = this.generateSignal(data, config.symbol, config.strategies)
        if (signal.action !== 'HOLD' && signal.confidence >= 0.5) {
          signals.push(signal)
        }
      }
    }

    // Sort by confidence
    return signals.sort((a, b) => b.confidence - a.confidence)
  }

  // Calculate ensemble score (0-100) for a signal
  calculateScore(signal: Signal): number {
    const baseScore = signal.confidence * 100

    // Boost for multiple strategies agreeing
    const agreementCount = Object.entries(signal.indicators)
      .filter(([key]) => ['buyVotes', 'sellVotes', 'holdVotes'].includes(key))
      .length

    // Adjust for market conditions
    const volatility = signal.indicators.volatility || 0
    const trendStrength = signal.indicators.trendStrength || 0

    // Higher score if low volatility + strong trend
    let adjustment = 0
    if (volatility < 0.02 && trendStrength > 0.03) adjustment += 10
    if (volatility > 0.02) adjustment -= 10

    return Math.max(0, Math.min(100, baseScore + adjustment))
  }
}

export default AISignalEngine