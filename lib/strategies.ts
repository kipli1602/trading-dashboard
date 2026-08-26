import { PriceData, StrategyResult } from '@/types'

// ============================================================
// Helper: Calculate Simple Moving Average
// ============================================================
function sma(values: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
  }
  return result
}

// ============================================================
// Helper: Calculate Exponential Moving Average
// ============================================================
function ema(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN)
  const multiplier = 2 / (period + 1)
  let prevEMA: number | null = null
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue
    if (prevEMA === null) {
      prevEMA = values.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1)
      result[i] = prevEMA
    } else {
      prevEMA = (values[i] - prevEMA) * multiplier + prevEMA
      result[i] = prevEMA
    }
  }
  return result
}

// ============================================================
// Helper: Calculate RSI
// ============================================================
function rsi(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN)
  const deltas = values.map((v, i) => i === 0 ? 0 : v - values[i - 1])
  let gain = 0, loss = 0
  for (let i = 0; i < values.length; i++) {
    if (i < period) continue
    if (i === period) {
      const slice = deltas.slice(1, i + 1)
      gain = slice.filter(d => d > 0).reduce((a, b) => a + b, 0) / period
      loss = Math.abs(slice.filter(d => d < 0).reduce((a, b) => a + b, 0)) / period
    } else {
      const delta = deltas[i]
      if (delta > 0) { gain = (gain * (period - 1) + delta) / period; loss *= (period - 1) / period }
      else if (delta < 0) { loss = (loss * (period - 1) + Math.abs(delta)) / period; gain *= (period - 1) / period }
    }
    const rs = loss === 0 ? 100 : gain / loss
    result[i] = 100 - (100 / (1 + rs))
  }
  return result
}

// ============================================================
// Helper: Calculate Bollinger Bands
// ============================================================
function bollinger(values: number[], period: number, stdDev: number) {
  const ma = sma(values, period)
  const result = { upper: new Array(values.length).fill(NaN), lower: new Array(values.length).fill(NaN) }
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue
    const slice = values.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
    const std = Math.sqrt(variance)
    result.upper[i] = mean + stdDev * std
    result.lower[i] = mean - stdDev * std
  }
  return result
}

// ============================================================
// Helper: Calculate MACD
// ============================================================
function macd(values: number[], fast: number, slow: number, signalPeriod: number) {
  const fastEMA = ema(values, fast)
  const slowEMA = ema(values, slow)
  const macdLine: number[] = values.map((_, i) => fastEMA[i] - slowEMA[i])
  const signalLine = ema(macdLine.filter(v => !isNaN(v)), signalPeriod)
  const paddedSignal = new Array(values.length - signalLine.length).fill(NaN).concat(signalLine)
  const histogram: number[] = macdLine.map((v, i) => !isNaN(v) && !isNaN(paddedSignal[i]) ? v - paddedSignal[i] : NaN)
  return { macd: macdLine, signal: paddedSignal, histogram }
}

// ============================================================
// Strategy 1: Moving Average Crossover
// ============================================================
export function strategyMACrossover(data: PriceData[], fast = 9, slow = 21): StrategyResult {
  const closes = data.map(d => d.close)
  const maFast = sma(closes, fast)
  const maSlow = sma(closes, slow)
  const idx = closes.length - 1
  const prevIdx = closes.length - 2

  const reasons: string[] = []
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence = 0

  if (!isNaN(maFast[idx]) && !isNaN(maSlow[idx]) && !isNaN(maFast[prevIdx]) && !isNaN(maSlow[prevIdx])) {
    const wasBelow = maFast[prevIdx] <= maSlow[prevIdx]
    const isAbove = maFast[idx] > maSlow[idx]
    const wasAbove = maFast[prevIdx] >= maSlow[prevIdx]
    const isBelow = maFast[idx] < maSlow[idx]

    if (isAbove && wasBelow) {
      signal = 'BUY'
      const crossStrength = Math.abs((maFast[idx] - maSlow[idx]) / maSlow[idx])
      confidence = Math.min(0.95, 0.5 + crossStrength * 10)
      reasons.push(`MA(${fast}) crossed above MA(${slow})`)
      reasons.push(`Cross strength: ${(crossStrength * 100).toFixed(2)}%`)
    } else if (isBelow && wasAbove) {
      signal = 'SELL'
      const crossStrength = Math.abs((maSlow[idx] - maFast[idx]) / maFast[idx])
      confidence = Math.min(0.95, 0.5 + crossStrength * 10)
      reasons.push(`MA(${fast}) crossed below MA(${slow})`)
      reasons.push(`Cross strength: ${(crossStrength * 100).toFixed(2)}%`)
    }

    const trend = maFast[idx] > maSlow[idx] ? 'bullish' : 'bearish'
    reasons.push(`Trend: ${trend}`)
  }

  return {
    name: 'ma_crossover',
    signal,
    confidence,
    indicators: {
      maFast: maFast[idx],
      maSlow: maSlow[idx],
      currentPrice: closes[idx],
    },
    reasons,
  }
}

// ============================================================
// Strategy 2: RSI
// ============================================================
export function strategyRSI(data: PriceData[], period = 14, oversold = 30, overbought = 70): StrategyResult {
  const closes = data.map(d => d.close)
  const rsiValues = rsi(closes, period)
  const idx = closes.length - 1

  const reasons: string[] = []
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence = 0

  if (!isNaN(rsiValues[idx])) {
    if (rsiValues[idx] < oversold) {
      signal = 'BUY'
      const extortion = (oversold - rsiValues[idx]) / oversold
      confidence = Math.min(0.9, 0.5 + extortion)
      reasons.push(`RSI oversold: ${rsiValues[idx].toFixed(2)} < ${oversold}`)
      reasons.push(`Bargain zone detected`)
    } else if (rsiValues[idx] > overbought) {
      signal = 'SELL'
      const extortion = (rsiValues[idx] - overbought) / (100 - overbought)
      confidence = Math.min(0.9, 0.5 + extortion)
      reasons.push(`RSI overbought: ${rsiValues[idx].toFixed(2)} > ${overbought}`)
      reasons.push(`Sell zone detected`)
    } else {
      reasons.push(`RSI neutral: ${rsiValues[idx].toFixed(2)}`)
    }
  }

  return {
    name: 'rsi',
    signal,
    confidence,
    indicators: { rsi: rsiValues[idx], currentPrice: closes[idx] },
    reasons,
  }
}

// ============================================================
// Strategy 3: Bollinger Bands Squeeze
// ============================================================
export function strategyBollinger(data: PriceData[], period = 20, stdDev = 2): StrategyResult {
  const closes = data.map(d => d.close)
  const { upper, lower } = bollinger(closes, period, stdDev)
  const ma = sma(closes, period)
  const idx = closes.length - 1

  const reasons: string[] = []
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence = 0

  if (!isNaN(upper[idx]) && !isNaN(lower[idx]) && !isNaN(ma[idx])) {
    const bbWidth = (upper[idx] - lower[idx]) / ma[idx]
    const pricePosition = (closes[idx] - lower[idx]) / (upper[idx] - lower[idx])

    if (closes[idx] < lower[idx]) {
      signal = 'BUY'
      const touchStrength = (lower[idx] - closes[idx]) / lower[idx]
      confidence = Math.min(0.95, 0.6 + touchStrength * 5)
      reasons.push(`Price below lower BB: ${closes[idx].toFixed(2)} < ${lower[idx].toFixed(2)}`)
      reasons.push(`BB width: ${(bbWidth * 100).toFixed(2)}% - ${bbWidth > 0.03 ? 'High volatility' : 'Low volatility'}`)
    } else if (closes[idx] > upper[idx]) {
      signal = 'SELL'
      const touchStrength = (closes[idx] - upper[idx]) / upper[idx]
      confidence = Math.min(0.95, 0.6 + touchStrength * 5)
      reasons.push(`Price above upper BB: ${closes[idx].toFixed(2)} > ${upper[idx].toFixed(2)}`)
      reasons.push(`BB width: ${(bbWidth * 100).toFixed(2)}%`)
    } else {
      if (bbWidth < 0.02) {
        reasons.push(`BB squeeze detected: width ${(bbWidth * 100).toFixed(2)}% - breakout imminent`)
        if (pricePosition > 0.9) {
          reasons.push(`Price near upper band (${(pricePosition * 100).toFixed(0)}%) - possible breakout up`)
        } else if (pricePosition < 0.1) {
          reasons.push(`Price near lower band (${(pricePosition * 100).toFixed(0)}%) - possible breakout down`)
        }
      }
    }
  }

  return {
    name: 'bollinger',
    signal,
    confidence,
    indicators: {
      price: closes[idx],
      upper: upper[idx],
      lower: lower[idx],
      bbWidth: (!isNaN(upper[idx]) && !isNaN(lower[idx])) ? (upper[idx] - lower[idx]) / ma[idx] : NaN,
    },
    reasons,
  }
}

// ============================================================
// Strategy 4: MACD
// ============================================================
export function strategyMACD(data: PriceData[], fast = 12, slow = 26, signalPeriod = 9): StrategyResult {
  const closes = data.map(d => d.close)
  const { histogram } = macd(closes, fast, slow, signalPeriod)
  const idx = histogram.length - 1
  const prevIdx = histogram.length - 2

  const reasons: string[] = []
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence = 0

  if (!isNaN(histogram[idx]) && !isNaN(histogram[prevIdx])) {
    if (histogram[idx] > 0 && histogram[prevIdx] <= 0) {
      signal = 'BUY'
      const strength = Math.abs(histogram[idx])
      confidence = Math.min(0.95, 0.5 + strength * 20)
      reasons.push(`MACD histogram crossed positive`)
      reasons.push(`Histogram: ${histogram[idx].toFixed(6)}`)
    } else if (histogram[idx] < 0 && histogram[prevIdx] >= 0) {
      signal = 'SELL'
      const strength = Math.abs(histogram[idx])
      confidence = Math.min(0.95, 0.5 + strength * 20)
      reasons.push(`MACD histogram crossed negative`)
      reasons.push(`Histogram: ${histogram[idx].toFixed(6)}`)
    } else if (histogram[idx] > 0) {
      reasons.push(`MACD bullish momentum (histogram: ${histogram[idx].toFixed(6)})`)
    } else if (histogram[idx] < 0) {
      reasons.push(`MACD bearish momentum (histogram: ${histogram[idx].toFixed(6)})`)
    }
  }

  return {
    name: 'macd',
    signal,
    confidence,
    indicators: {
      macdHist: histogram[idx],
      macdPrev: histogram[prevIdx],
    },
    reasons,
  }
}

// ============================================================
// Strategy 5: Momentum (Price Action)
// ============================================================
export function strategyMomentum(data: PriceData[], lookback = 5, threshold = 0.02): StrategyResult {
  const closes = data.map(d => d.close)
  const idx = closes.length - 1

  const reasons: string[] = []
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence = 0

  if (idx >= lookback) {
    const lookbackReturn = (closes[idx] - closes[idx - lookback]) / closes[idx - lookback]

    if (lookbackReturn > threshold) {
      signal = 'BUY'
      confidence = Math.min(0.9, 0.4 + (lookbackReturn / 0.1) * 0.5)
      reasons.push(`Momentum ${lookback}h: +${(lookbackReturn * 100).toFixed(2)}% > ${threshold * 100}%`)
      reasons.push(`Price accelerating upward`)
    } else if (lookbackReturn < -threshold) {
      signal = 'SELL'
      confidence = Math.min(0.9, 0.4 + (Math.abs(lookbackReturn) / 0.1) * 0.5)
      reasons.push(`Momentum ${lookback}h: ${(lookbackReturn * 100).toFixed(2)}% < -${threshold * 100}%`)
      reasons.push(`Price accelerating downward`)
    } else {
      reasons.push(`Momentum ${lookback}h: ${(lookbackReturn * 100).toFixed(2)}%`)
    }

    // Check volume confirmation
    const volumes = data.map(d => d.volume)
    const volAvg = sma(volumes.slice(Math.max(0, idx - 50), idx), 20)
    const volCurrent = volumes[idx]
    if (!isNaN(volAvg[volAvg.length - 1]) && volCurrent > volAvg[volAvg.length - 1] * 1.2) {
      reasons.push(`Volume surge: ${(volCurrent / volAvg[volAvg.length - 1]).toFixed(1)}x average`)
    }
  }

  return {
    name: 'momentum',
    signal,
    confidence,
    indicators: {
      lookbackReturn: ((closes[idx] - closes[idx - lookback]) / closes[idx - lookback]) * 100,
      currentPrice: closes[idx],
    },
    reasons,
  }
}

// ============================================================
// Strategy 6: ATR Momentum
// ============================================================
export function strategyATRMomentum(data: PriceData[], maPeriod = 14, atrMult = 1.5): StrategyResult {
  const closes = data.map(d => d.close)
  const highs = data.map(d => d.high)
  const lows = data.map(d => d.low)
  const ma = sma(closes, maPeriod)
  const tr: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const range1 = highs[i] - lows[i]
    const range2 = Math.abs(highs[i] - closes[i - 1])
    const range3 = Math.abs(lows[i] - closes[i - 1])
    tr.push(Math.max(range1, range2, range3))
  }
  const atr = sma(tr, maPeriod - 1)
  const idx = closes.length - 1

  const reasons: string[] = []
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence = 0

  if (!isNaN(ma[idx]) && atr[atr.length - 1] !== undefined && !isNaN(atr[atr.length - 1])) {
    const upperBound = ma[idx] + atr[atr.length - 1] * atrMult
    const lowerBound = ma[idx] - atr[atr.length - 1] * atrMult

    if (closes[idx] > upperBound) {
      signal = 'BUY'
      const breakoutStrength = (closes[idx] - upperBound) / upperBound
      confidence = Math.min(0.9, 0.5 + breakoutStrength * 5)
      reasons.push(`Price above MA + ATR: ${closes[idx].toFixed(2)} > ${upperBound.toFixed(2)}`)
      reasons.push(`Breakout strength: ${(breakoutStrength * 100).toFixed(2)}%`)
    } else if (closes[idx] < lowerBound) {
      signal = 'SELL'
      const breakdownStrength = (lowerBound - closes[idx]) / lowerBound
      confidence = Math.min(0.9, 0.5 + breakdownStrength * 5)
      reasons.push(`Price below MA - ATR: ${closes[idx].toFixed(2)} < ${lowerBound.toFixed(2)}`)
      reasons.push(`Breakdown strength: ${(breakdownStrength * 100).toFixed(2)}%`)
    } else {
      reasons.push(`Price within MA +/- ATR band`)
    }
  }

  return {
    name: 'atr_momentum',
    signal,
    confidence,
    indicators: {
      ma: ma[idx],
      atr: atr[atr.length - 1],
      currentPrice: closes[idx],
    },
    reasons,
  }
}

// ============================================================
// Strategy 7: VWAP Bounce
// ============================================================
export function strategyVWAP(data: PriceData[], maPeriod = 50, vwapStd = 1.5): StrategyResult {
  const idx = data.length - 1
  const closes = data.map(d => d.close)
  const volumes = data.map(d => d.volume)
  const highs = data.map(d => d.high)
  const lows = data.map(d => d.low)

  // Calculate VWAP
  const tp: number[] = []
  for (let i = 0; i < data.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3)
  }
  let cumPV = 0, cumVol = 0
  const vwap: number[] = []
  for (let i = 0; i < data.length; i++) {
    cumPV += tp[i] * volumes[i]
    cumVol += volumes[i]
    vwap.push(cumVol > 0 ? cumPV / cumVol : NaN)
  }

  // Calculate standard deviation
  const ma = sma(closes, maPeriod)
  const idx2 = closes.length - 1

  const reasons: string[] = []
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence = 0

  if (!isNaN(vwap[idx]) && !isNaN(ma[idx2])) {
    const upperBand = vwap[idx] + ma[idx2] * vwapStd
    const lowerBand = vwap[idx] - ma[idx2] * vwapStd

    if (closes[idx] < lowerBand) {
      signal = 'BUY'
      const distance = (lowerBand - closes[idx]) / closes[idx]
      confidence = Math.min(0.9, 0.6 + distance * 5)
      reasons.push(`Price below VWAP - ${vwapStd}std band`)
      reasons.push(`Undervalued relative to volume-weighted average`)
    } else if (closes[idx] > upperBand) {
      signal = 'SELL'
      const distance = (closes[idx] - upperBand) / closes[idx]
      confidence = Math.min(0.9, 0.6 + distance * 5)
      reasons.push(`Price above VWAP + ${vwapStd}std band`)
      reasons.push(`Overvalued relative to volume-weighted average`)
    } else {
      reasons.push(`Price within VWAP bands`)
    }

    const vwapPosition = closes[idx] > vwap[idx] ? 'above' : 'below'
    reasons.push(`Price is ${vwapPosition} VWAP`)
  }

  return {
    name: 'vwap',
    signal,
    confidence,
    indicators: {
      vwap: vwap[idx],
      currentPrice: closes[idx],
      priceToVwap: vwap[idx] !== 0 ? ((closes[idx] - vwap[idx]) / vwap[idx]) * 100 : 0,
    },
    reasons,
  }
}

// ============================================================
// Strategy Registry
// ============================================================
export const STRATEGY_FUNCTIONS: Record<string, (data: PriceData[], ...args: any[]) => StrategyResult> = {
  ma_crossover: strategyMACrossover,
  rsi: strategyRSI,
  bollinger: strategyBollinger,
  macd: strategyMACD,
  momentum: strategyMomentum,
  atr_momentum: strategyATRMomentum,
  vwap: strategyVWAP,
}

export const ALL_STRATEGY_NAMES = Object.keys(STRATEGY_FUNCTIONS)