'use client'

import { useEffect, useState } from 'react'
import { Position } from '@/types'
import { Shield, Target, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPositions = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/bot?action=positions')
      const data = await res.json()
      const posArray = data.positions || []
      setPositions(posArray)
    } catch (e) {
      console.error('Failed to fetch positions:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPositions()
    const interval = setInterval(fetchPositions, 15000)
    return () => clearInterval(interval)
  }, [])

  const openPositions = positions.filter(p => p.status === 'OPEN')
  const closedPositions = positions.filter(p => p.status === 'CLOSED')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Position Tracker
            </span>
          </h1>
          <p className="text-gray-400 mt-1">
            {openPositions.length} open positions | {closedPositions.length} closed trades
          </p>
        </div>
        <button
          onClick={fetchPositions}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-dark-border/50 rounded-lg hover:bg-dark-border transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Open Positions */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 text-profit">Open Positions ({openPositions.length})</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-dark-border/30 rounded-lg h-16"></div>
            ))}
          </div>
        ) : openPositions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No open positions</p>
            <p className="text-sm mt-1">Bot will open positions when signals are generated</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-3 text-sm font-medium text-gray-400">Symbol</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Entry</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Current</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Qty</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">PnL</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">SL</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">TP</th>
                  <th className="text-center py-3 text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((pos) => {
                  const isProfit = (pos.currentPnL || 0) >= 0
                  return (
                    <tr key={pos.id} className="border-b border-dark-border/50">
                      <td className="py-3">
                        <span className="font-bold">{pos.symbol}</span>
                      </td>
                      <td className="text-right py-3 text-gray-300">${pos.entryPrice?.toFixed(2)}</td>
                      <td className="text-right py-3 text-gray-300">${pos.currentPrice?.toFixed(2)}</td>
                      <td className="text-right py-3 text-gray-300">{pos.quantity}</td>
                      <td className={`text-right py-3 ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          ${pos.currentPnL?.toFixed(2)}
                        </div>
                        <div className="text-xs">
                          ({pos.pnlPercent?.toFixed(1)}%)
                        </div>
                      </td>
                      <td className="text-right py-3 text-loss">${pos.stopLoss?.toFixed(2)}</td>
                      <td className="text-right py-3 text-profit">${pos.takeProfit?.toFixed(2)}</td>
                      <td className="text-center py-3">
                        <span className="px-2 py-1 text-xs bg-green-400/20 text-green-400 rounded-full">
                          OPEN
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Trades */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 text-secondary">Trade History ({closedPositions.length})</h2>

        {closedPositions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No closed trades yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-3 text-sm font-medium text-gray-400">Symbol</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Entry</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Exit</th>
                  <th className="text-center py-3 text-sm font-medium text-gray-400">Date</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">PnL</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-400">Return</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.slice(0, 20).map((pos) => {
                  const isProfit = (pos.currentPnL || 0) >= 0
                  return (
                    <tr key={pos.id} className="border-b border-dark-border/50">
                      <td className="py-3 font-bold">{pos.symbol}</td>
                      <td className="text-right py-3 text-gray-300">
                        ${pos.entryPrice?.toFixed(2)}
                        <span className="block text-xs text-gray-500">
                          {new Date(pos.entryTime).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="text-right py-3 text-gray-300">
                        ${pos.exitPrice?.toFixed(2)}
                        <span className="block text-xs text-gray-500">
                          {pos.exitTime ? new Date(pos.exitTime).toLocaleDateString() : '-'}
                        </span>
                      </td>
                      <td className="text-center py-3 text-gray-300">
                        {new Date(pos.entryTime).toLocaleDateString()}
                      </td>
                      <td className={`text-right py-3 ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        ${pos.currentPnL?.toFixed(2)}
                      </td>
                      <td className={`text-right py-3 ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {pos.pnlPercent?.toFixed(2)}%
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