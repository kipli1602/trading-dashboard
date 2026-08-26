import { NextRequest, NextResponse } from 'next/server'
import { tradingBot } from '@/lib/trading-bot'
import AISignalEngine from '@/lib/ai-signal'
import { DEFAULT_BOT_CONFIG } from '@/lib/config'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const confidence = parseFloat(searchParams.get('min_confidence') || '0.5')

  try {
    // Get fresh data
    if (symbol) {
      const data = await tradingBot.getPriceData(symbol, '1h', 500)
      const aiEngine = new AISignalEngine()
      const pairConfig = DEFAULT_BOT_CONFIG.enabledPairs.find(p => p.symbol === symbol)

      const signal = aiEngine.generateSignal(
        data,
        symbol,
        pairConfig?.strategies || []
      )

      const score = aiEngine.calculateScore(signal)

      if (signal.confidence >= confidence && signal.action !== 'HOLD') {
        return NextResponse.json({
          symbol,
          signal,
          score,
          timestamp: new Date().toISOString(),
        })
      }

      return NextResponse.json({
        symbol,
        signal,
        score,
        timestamp: new Date().toISOString(),
        message: 'No strong signal or below confidence threshold',
      })
    }

    // Get all signals
    const cycle = await tradingBot.runCycle()
    return NextResponse.json({
      signals: cycle.signals,
      positions: cycle.positions,
      stats: cycle.stats,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { symbol, action, confidence } = body

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    const data = await tradingBot.getPriceData(symbol, '1h', 500)
    const aiEngine = new AISignalEngine()
    const pairConfig = DEFAULT_BOT_CONFIG.enabledPairs.find(p => p.symbol === symbol)

    const signal = aiEngine.generateSignal(
      data, symbol, pairConfig?.strategies || []
    )
    const score = aiEngine.calculateScore(signal)

    return NextResponse.json({
      symbol,
      signal,
      score,
      price_data_points: data.length,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}