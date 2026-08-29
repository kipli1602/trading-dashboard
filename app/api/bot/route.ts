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

      case 'debug':
        const hasKuCoin = !!process.env.KUCOIN_API_KEY && !!process.env.KUCOIN_API_SECRET && !!process.env.KUCOIN_PASSPHRASE
        const hasBybit = !!process.env.BYBIT_API_KEY && !!process.env.BYBIT_API_SECRET
        const hasCoinbase = !!process.env.CB_API_KEY && !!process.env.CB_API_SECRET && !!process.env.CB_PASSPHRASE
        const hasBinance = !!process.env.BINANCE_API_KEY && !!process.env.BINANCE_API_SECRET
        const apiMode = hasKuCoin ? 'kucoin-real-trading' : (hasCoinbase ? 'coinbase-real-trading' : (hasBybit ? 'bybit-real-trading' : (hasBinance ? 'binance-real-trading' : 'mock')))
        return NextResponse.json({
          apiMode,
          hasKuCoin,
          hasCoinbaseKey: hasCoinbase,
          hasBybitKey: !!(process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET),
          hasBinanceKey: !!(process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY),
          apiKeyLen: (process.env.KUCOIN_API_KEY || process.env.CB_API_KEY || process.env.BYBIT_API_KEY || process.env.BINANCE_API_KEY || '').length,
          useTestnet: process.env.USE_TESTNET,
          useSandbox: process.env.KUCOIN_SANDBOX !== 'false',
          status: tradingBot.getStatus(),
          exchangeStatus: await (async () => {
            const base = process.env.KUCOIN_SANDBOX !== 'false' ? 'https://openapi-sandbox.kucoin.com' : 'https://api.kucoin.com'
            try {
              const r = await fetch(`${base}/api/v1/timestamp`, { signal: AbortSignal.timeout(8000) })
              return { kucoin: r.ok ? 'connected' : `http_${r.status}`, url: base }
            } catch (e: any) { return { kucoin: 'failed', error: (e.message||'timeout').substring(0,80), url: base } }
          })(),
        })

      case 'test-balance':
        // Test KuCoin balance fetch directly
        const KuCoinAPI = (await import('@/lib/kucoin')).default
        const kc = new KuCoinAPI(
          process.env.KUCOIN_API_KEY || '',
          process.env.KUCOIN_API_SECRET || '',
          process.env.KUCOIN_PASSPHRASE || ''
        )
        try {
          const bal = await kc.getBalance()
          const rawAccounts = await (async () => {
            const ts = Math.floor(Date.now() / 1000).toString()
            const { default: crypto } = await import('crypto')
            const sig = crypto.createHmac('sha256', process.env.KUCOIN_API_SECRET!).update(ts + 'GET' + '/api/v1/accounts').digest('base64')
            const passHash = crypto.createHmac('sha256', process.env.KUCOIN_API_SECRET!).update(ts + (process.env.KUCOIN_PASSPHRASE || '')).digest('base64')
            const r = await fetch('https://api.kucoin.com/api/v1/accounts', {
              headers: {
                'KC-API-KEY': process.env.KUCOIN_API_KEY!,
                'KC-API-SIGN': sig,
                'KC-API-TIMESTAMP': ts,
                'KC-API-PASSPHRASE': passHash,
                'KC-API-KEY-VERSION': '2',
              }
            })
            return await r.json()
          })()
          return NextResponse.json({
            balance: bal,
            rawAccountsCode: rawAccounts.code,
            rawAccountsMsg: rawAccounts.msg,
            rawAccountsData: rawAccounts.data?.map((a: any) => ({
              currency: a.currency, type: a.type, balance: a.balance, available: a.available, holds: a.holds
            })) || rawAccounts.data
          })
        } catch (e: any) {
          return NextResponse.json({ error: e.message, stack: e.stack?.substring(0, 200) })
        }

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
            balance: riskManager.getBalance(),
            openPositions: Array.from(cronPositions.entries()).map(([sym, pos]) => ({
              ...pos,
              symbol: pos.symbol || sym,
            })),
            signalCount: cronResult.signals.length,
            pairCount: cronResult.pairCount,
          })
        } catch (err: any) {
          return NextResponse.json({ success: false, error: err.message, stack: err.stack })
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