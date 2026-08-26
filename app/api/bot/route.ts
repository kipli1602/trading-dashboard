import { NextRequest, NextResponse } from 'next/server'
import { tradingBot } from '@/lib/trading-bot'
import { riskManager } from '@/lib/risk-manager'
import { PAIRS_9 } from '@/lib/config'
import MockBinanceAPI from '@/lib/binance-mock'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'status':
        return NextResponse.json(tradingBot.getStatus())

      case 'prices':
        const prices = await tradingBot.getAllPrices()
        return NextResponse.json(prices)

      case 'pair-stats':
        // Get price + 24h stats for all 9 pairs
        const binance = new MockBinanceAPI()
        const allStats: Record<string, any> = {}

        for (const pair of PAIRS_9) {
          try {
            const price = await binance.getPrice(pair.symbol)
            const stats24h = await binance.get24hStats(pair.symbol)
            allStats[pair.symbol] = {
              price,
              change24h: parseFloat(stats24h.priceChange) || price * 0.02,
              changePercent24h: parseFloat(stats24h.priceChangePercent) || 2.0,
            }
          } catch (e) {
            allStats[pair.symbol] = {
              price: 0,
              change24h: 0,
              changePercent24h: 0,
            }
          }
        }
        return NextResponse.json(allStats)

      case 'portfolio':
        const stats = riskManager.getPortfolioStats()
        return NextResponse.json(stats)

      case 'positions':
        const allPositions = riskManager.getAllPositions()
        const openPositions = riskManager.getOpenPositions()
        return NextResponse.json({
          positions: allPositions,
          openPositions: Array.from(openPositions.entries()).map(([_sym, pos]) => ({
            ...pos,
            symbol: pos.symbol || _sym,
          })),
        })

      case 'trades':
        const limit = parseInt(searchParams.get('limit') || '50')
        const trades = riskManager.getTradeHistory(limit)
        return NextResponse.json(trades)

      case 'signal':
        // Run one cycle and return signals
        const cycle = await tradingBot.runCycle()
        return NextResponse.json(cycle)

      case 'cron':
        // Scheduled cron cycle — auto-trade every 5 minutes
        console.log(`[CRON] Running scheduled cycle at ${new Date().toISOString()}`)
        try {
          const cronResult = await tradingBot.runCycle()
          const cronStats = riskManager.getPortfolioStats()
          const cronPositions = riskManager.getOpenPositions()
          return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            cycle: cronResult,
            portfolio: cronStats,
            openPositions: Array.from(cronPositions.entries()).map(([sym, pos]) => ({
              ...pos,
              symbol: pos.symbol || sym,
            })),
          })
        } catch (err: any) {
          return NextResponse.json({ success: false, error: err.message })
        }

      case 'config':
        const configModule = await import('@/lib/config')
        return NextResponse.json({
          pairs: configModule.PAIRS_9,
          strategyWeights: configModule.DEFAULT_BOT_CONFIG.strategyWeights,
          riskConfig: configModule.RISK_CONFIG,
        })

      default:
        return NextResponse.json({
          status: 'running',
          ...tradingBot.getStatus(),
          message: 'Add ?action=status|prices|pair-stats|portfolio|positions|trades|signal|config'
        })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'start':
        const interval = body.interval || 300
        await tradingBot.start(interval)
        return NextResponse.json({ success: true, message: 'Bot started', interval })

      case 'stop':
        tradingBot.stop()
        return NextResponse.json({ success: true, message: 'Bot stopped' })

      case 'manual_trade':
        const result = await tradingBot.processManualSignal(body.trade)
        return NextResponse.json(result)

      case 'run_cycle':
        const cycleResult = await tradingBot.runCycle()
        return NextResponse.json(cycleResult)

      case 'price_data':
        const { symbol, interval: dataInterval, limit } = body
        const data = await tradingBot.getPriceData(symbol, dataInterval || '1h', limit || 200)
        return NextResponse.json(data)

      case 'save-config':
        if (body.config) {
          tradingBot.updateConfig(body.config)
        }
        return NextResponse.json({ success: true, message: 'Config saved' })

      case 'get-config':
        return NextResponse.json({ config: tradingBot.getConfig() })

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}