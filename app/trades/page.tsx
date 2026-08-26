'use client'

import { useEffect, useState } from 'react'
import { Trade } from '@/types'
import { RefreshCw, Filter, TrendingUp, TrendingDown, Award } from 'lucide-react'

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchTrades = async (filterType = filter) => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/bot?action=trades&filter=${filterType}`)
      const data = await res.json()
      setTrades(data)
    } catch (e) {
      console.error('Failed to fetch trades:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTrades()
    const interval = setInterval(fetchTrades, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilter = (f: 'all' | 'wins' | 'losses') => {
    setFilter(f)
    fetchTrades(f)
  }

  // Calculate summary stats
  const totalTrades = trades.length
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0)
  const totalFee = trades.reduce((sum, t) => sum + t.fee, 0)
  const avgTrade = totalTrades > 0 ? trades.reduce((sum, t) => sum + t.pnl, 0) / totalTrades : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Trade History
            </span>
          </h1>
          <p className="text-gray-400 mt-1">
            {totalTrades} total trades | Win rate: {winRate.toFixed(1)}%
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-dark-border/50 rounded-lg p-1">
            {(['all', 'wins', 'losses'] as const).map(f => (
              <button
                key={f}
                onClick={() => handleFilter(f)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-primary/20 text-primary'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' && 'All'}
                {f === 'wins' && '✓ Wins'}
                {f === 'losses' && '✗ Losses'}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchTrades()}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-dark-border/50 rounded-lg hover:bg-dark-border transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{totalTrades}</div>
          <div className="text-sm text-gray-400">Total Trades</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">Total PnL</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-profit">{winRate.toFixed(1)}%</div>
          <div className="text-sm text-gray-400">Win Rate</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-secondary">{avgTrade.toFixed(2)}%</div>
          <div className="text-sm text-gray-400">Avg Return</div>
        </div>
      </div>

      {/* Trades Table */}
      <div className="glass-card p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse bg-dark-border/30 rounded-lg h-12"></div>
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No trades recorded yet</p>
            <p className="text-sm mt-1">Trades will appear here after bot executes them</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-3 text-sm font-medium text-gray-400">Symbol</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Entry</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Exit</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Qty</th>
                  <th className="text-center py-3 text-sm font-medium text-gray-400">Strategy</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Confidence</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Fee</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">PnL</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const isProfit = trade.pnl > 0
                  return (
                    <tr key={trade.id} className="border-b border-dark-border/50 hover:bg-dark-border/20">
                      <td className="py-3 font-bold">
                        <div className="flex items-center gap-2">
                          {isProfit ? (
                            <TrendingUp className="w-3 h-3 text-profit" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-loss" />
                          )}
                          {trade.symbol}
                        </div>
                      </td>
                      <td className="text-right py-3 text-gray-300">${trade.entryPrice?.toFixed(2)}</td>
                      <td className="text-right py-3 text-gray-300">${trade.exitPrice?.toFixed(2)}</td>
                      <td className="text-right py-3 text-gray-300">{trade.quantity}</td>
                      <td className="text-center py-3 text-xs text-gray-400">{trade.strategy}</td>
                      <td className="text-right py-3 text-xs">
                        <span className={trade.confidence > 0.7 ? 'text-profit' : 'text-gray-400'}>
                          {(trade.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="text-right py-3 text-xs text-gray-500">${trade.fee.toFixed(2)}</td>
                      <td className={`text-right py-3 font-medium ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        ${trade.pnl.toFixed(2)}
                        <span className="text-xs block">({trade.pnlPercent.toFixed(1)}%)</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}