'use client'

import { PortfolioStats as Stats } from '@/types'
import { TrendingUp, TrendingDown, DollarSign, Package, CheckCircle, XCircle, BarChart3 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PortfolioStatsProps {
  stats?: Stats
  onRefresh?: () => void
}

export default function PortfolioStats({ stats, onRefresh }: PortfolioStatsProps) {
  const [loading, setLoading] = useState(false)
  const [currentStats, setCurrentStats] = useState<Stats | null>(stats || null)

  useEffect(() => {
    if (stats) setCurrentStats(stats)
  }, [stats])

  const handleRefresh = async () => {
    if (!onRefresh) return
    setLoading(true)
    try {
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  if (!currentStats) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-dark-border rounded mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-dark-border/50 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  const isProfit = currentStats.totalPnL >= 0

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Portfolio Performance</h2>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-xs px-3 py-1 bg-dark-border/50 rounded hover:bg-dark-border transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Total Value */}
        <div className="bg-dark-border/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Total Portfolio
          </div>
          <div className="text-2xl font-bold">
            Rp{currentStats.totalValue.toLocaleString('id-ID')}
          </div>
          <div className={`flex items-center gap-1 text-sm ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isProfit ? '+' : ''}{currentStats.totalPnLPercent.toFixed(2)}%
          </div>
        </div>

        {/* PnL */}
        <div className="bg-dark-border/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            Total PnL
          </div>
          <div className={`text-2xl font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}Rp{currentStats.totalPnL.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-gray-500">
            {currentStats.totalPnLPercent.toFixed(2)}% total return
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-dark-border/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Win Rate
          </div>
          <div className="text-2xl font-bold text-profit">
            {currentStats.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">
            {currentStats.totalTrades} total trades
          </div>
        </div>

        {/* Active Positions */}
        <div className="bg-dark-border/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Package className="w-4 h-4" />
            Active Positions
          </div>
          <div className="text-2xl font-bold text-secondary">
            {currentStats.activePositions}
          </div>
          <div className="text-xs text-gray-500">
            Max: {5} open
          </div>
        </div>
      </div>

      {/* Day Change */}
      <div className="bg-dark-border/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Today's Change</span>
          <span className={`flex items-center gap-1 ${currentStats.dayChange >= 0 ? 'text-profit' : 'text-loss'}`}>
            {currentStats.dayChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {currentStats.dayChange >= 0 ? '+' : ''}Rp{currentStats.dayChange.toLocaleString('id-ID')} ({currentStats.dayChangePercent.toFixed(2)}%)
          </span>
        </div>

        {/* Avg Win/Loss */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Avg Win:</span>
            <span className="text-profit">{currentStats.avgWin.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Avg Loss:</span>
            <span className="text-loss">{currentStats.avgLoss.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Initial stats for display when loading
export const INITIAL_STATS: Stats = {
  totalValue: 500000,
  totalPnL: 0,
  totalPnLPercent: 0,
  dayChange: 0,
  dayChangePercent: 0,
  activePositions: 0,
  totalTrades: 0,
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
}