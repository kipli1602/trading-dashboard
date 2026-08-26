'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Activity, PauseCircle, PlayCircle } from 'lucide-react'
import PairWidget from '@/components/PairWidget'
import PortfolioStats, { INITIAL_STATS } from '@/components/PortfolioStats'
import SignalPanel from '@/components/SignalPanel'
import { PAIRS_9 } from '@/lib/config'
import { Signal, PortfolioStats as Stats } from '@/types'

interface PairData {
  symbol: string
  price: number
  priceChange24h: number
  priceChangePercent24h: number
  signal?: Signal
  currentPosition?: any
}

export default function DashboardPage() {
  const [pairData, setPairData] = useState<Record<string, PairData>>({})
  const [signals, setSignals] = useState<Signal[]>([])
  const [stats, setStats] = useState<Stats>(INITIAL_STATS)
  const [loading, setLoading] = useState(true)
  const [botStatus, setBotStatus] = useState<'online' | 'offline'>('offline')
  const [refreshing, setRefreshing] = useState(false)

  const fetchAllData = useCallback(async () => {
    setRefreshing(true)
    try {
      // 1) Get prices + 24h change via internal API
      const pairStatsRes = await fetch('/api/bot?action=pair-stats')
      const pairStats: Record<string, { price: number; change24h: number; changePercent24h: number }> = await pairStatsRes.json()

      // 2) Portfolio stats
      const portfolioRes = await fetch('/api/bot?action=portfolio')
      const portfolioData: Stats = await portfolioRes.json()
      setStats(portfolioData)

      // 3) Positions
      const positionsRes = await fetch('/api/bot?action=positions')
      const positionsData = await positionsRes.json()
      const openPositions = positionsData.openPositions || []

      // 4) AI Signals
      const signalsRes = await fetch('/api/bot?action=signal')
      const signalsData = await signalsRes.json()
      setSignals(signalsData.signals || [])
      setBotStatus(signalsData.stats ? 'online' : 'offline')

      // 5) Build pairData
      const newData: Record<string, PairData> = {}
      for (const pair of PAIRS_9) {
        const ps = pairStats[pair.symbol] || { price: 0, change24h: 0, changePercent24h: 0 }
        const signal = (signalsData.signals || []).find((s: Signal) => s.symbol === pair.symbol)
        const position = openPositions.find((p: any) => p.symbol === pair.symbol)

        newData[pair.symbol] = {
          symbol: pair.symbol,
          price: ps.price,
          priceChange24h: ps.change24h,
          priceChangePercent24h: ps.changePercent24h,
          signal,
          currentPosition: position,
        }
      }
      setPairData(newData)
    } catch (e) {
      console.error('Dashboard fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const toggleBot = async () => {
    const action = botStatus === 'online' ? 'stop' : 'start'
    await fetch('/api/bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, interval: 300 }),
    })
    setBotStatus(action === 'start' ? 'online' : 'offline')
  }

  useEffect(() => {
    fetchAllData()
    const interval = setInterval(fetchAllData, 30000)
    return () => clearInterval(interval)
  }, [fetchAllData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Crypto AI Trading Dashboard
            </span>
          </h1>
          <p className="text-gray-400 mt-1">
            Monitoring {PAIRS_9.length} pairs | {stats.activePositions} active positions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-dark-border/50 rounded-lg hover:bg-dark-border transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            onClick={toggleBot}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              botStatus === 'online'
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {botStatus === 'online' ? (
              <PauseCircle className="w-5 h-5" />
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
            {botStatus === 'online' ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>
      </div>

      {/* Portfolio Stats */}
      <PortfolioStats stats={stats} onRefresh={fetchAllData} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signal Panel */}
        <div className="lg:col-span-1">
          <SignalPanel signals={signals} loading={loading} onRefresh={fetchAllData} />
        </div>

        {/* Pair Grid */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-4">9 Pair Monitor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {PAIRS_9.map((pair) => {
              const data = pairData[pair.symbol]
              return (
                <PairWidget
                  key={pair.symbol}
                  symbol={pair.symbol}
                  price={data?.price || 0}
                  priceChange24h={data?.priceChange24h || 0}
                  priceChangePercent24h={data?.priceChangePercent24h || 0}
                  signal={data?.signal}
                  currentPosition={data?.currentPosition}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="glass-card p-4 text-center text-sm text-gray-400">
        <Activity className="w-4 h-4 inline mr-1" />
        Bot: {botStatus === 'online' ? 'Running' : 'Stopped'} |
        Monitoring {PAIRS_9.length} pairs |
        Auto-check every 30s
      </div>
    </div>
  )
}