'use client'

import { Signal } from '@/types'
import { Bot, TrendingUp, TrendingDown, Shield, Clock, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'

interface SignalPanelProps {
  signals: Signal[]
  loading?: boolean
  onRefresh?: () => void
}

export default function SignalPanel({ signals, loading = false, onRefresh }: SignalPanelProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  // Sort signals by confidence
  const sortedSignals = [...signals].sort((a, b) => b.confidence - a.confidence)

  // Get signal badge color
  const getSignalColor = (signal: Signal) => {
    if (signal.action === 'BUY') return 'bg-profit/20 text-profit border-profit/50'
    if (signal.action === 'SELL') return 'bg-loss/20 text-loss border-loss/50'
    return 'bg-gray-400/20 text-gray-400 border-gray-500/50'
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400'
    if (confidence >= 0.6) return 'text-yellow-400'
    if (confidence >= 0.4) return 'text-orange-400'
    return 'text-gray-400'
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          AI Signal Generator
        </h2>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs px-3 py-1 bg-dark-border/50 rounded hover:bg-dark-border transition-colors flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Scanning...' : 'Scan Now'}
          </button>
        )}
      </div>

      {loading || refreshing ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-dark-border/30 rounded-lg h-16"></div>
          ))}
        </div>
      ) : sortedSignals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active signals at the moment</p>
          <p className="text-sm mt-1">Bot is monitoring 9 pairs. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sortedSignals.map((signal) => (
            <div
              key={signal.id}
              className={`border-l-2 p-3 rounded-lg transition-all duration-200 ${getSignalColor(signal)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-bold text-lg">{signal.symbol}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {signal.strategy}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSignalColor(signal)}`}>
                    {signal.action === 'BUY' && <TrendingUp className="w-3 h-3 inline mr-1" />}
                    {signal.action === 'SELL' && <TrendingDown className="w-3 h-3 inline mr-1" />}
                    {signal.action}
                  </span>
                </div>

                <div className="text-right">
                  <span className={`font-bold ${getConfidenceColor(signal.confidence)}`}>
                    {(signal.confidence * 100).toFixed(0)}%
                  </span>
                  <div className="text-xs text-gray-500">confidence</div>
                </div>
              </div>

              {/* Price */}
              <div className="mt-1 text-sm">
                <span className="text-gray-500">Entry price:</span>
                <span className="font-medium ml-1">${signal.price.toFixed(2)}</span>
              </div>

              {/* Reasons */}
              {signal.reasons && signal.reasons.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-gray-500 mb-1">Reasoning:</div>
                  <ul className="text-xs space-y-0.5">
                    {signal.reasons.slice(0, 3).map((reason, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-400">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{new Date(signal.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-dark-border flex justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-profit" /> BUY signal
        </span>
        <span className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3 text-loss" /> SELL signal
        </span>
      </div>
    </div>
  )
}