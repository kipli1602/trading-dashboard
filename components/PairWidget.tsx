'use client'

import { useState, useEffect } from 'react'
import { Signal, PriceData } from '@/types'
import { TrendingUp, TrendingDown, Activity, Clock, BarChart2, Target, Shield } from 'lucide-react'
import Image from 'next/image'

interface PairWidgetProps {
  symbol: string
  price: number
  priceChange24h: number
  priceChangePercent24h: number
  signal?: Signal
  positionSize?: number
  stopLoss?: number
  takeProfit?: number
  currentPosition?: any
}

export default function PairWidget({
  symbol,
  price,
  priceChange24h,
  priceChangePercent24h,
  signal,
  positionSize,
  stopLoss,
  takeProfit,
  currentPosition,
}: PairWidgetProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [priceHistory, setPriceHistory] = useState<number[]>([])

  const isPositive = priceChangePercent24h >= 0
  const hasPosition = currentPosition && currentPosition.status === 'OPEN'
  const signalStrength = signal?.confidence || 0

  // Generate mini price chart
  useEffect(() => {
    // In production, fetch real price history
    const history = Array.from({ length: 20 }, (_, i) =>
      price * (1 + (Math.random() - 0.5) * 0.02 * (20 - i) / 20)
    )
    setPriceHistory(history)
  }, [price])

  // Get signal color
  const getSignalColor = () => {
    if (!signal || signal.action === 'HOLD') return 'text-gray-400'
    return signal.action === 'BUY' ? 'text-profit' : 'text-loss'
  }

  // Get confidence badge
  const getConfidenceBadge = () => {
    if (!signal || signal.confidence === 0) return null

    const color = signal.confidence > 0.7
      ? 'bg-profit/20 text-profit'
      : signal.confidence > 0.5
      ? 'bg-yellow-400/20 text-yellow-400'
      : 'bg-gray-400/20 text-gray-400'

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {Math.round(signal.confidence * 100)}%
      </span>
    )
  }

  // Render signal indicators
  const renderSignalIndicators = () => {
    if (!signal || signal.action === 'HOLD') return null

    const actionColor = signal.action === 'BUY' ? 'text-profit' : 'text-loss'
    const actionIcon = signal.action === 'BUY' ? 'BUY' : 'SELL'

    return (
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-xs font-bold ${actionColor} bg-dark-border/50 px-2 py-0.5 rounded`}>
          {actionIcon} SIGNAL
        </span>
        {getConfidenceBadge()}
      </div>
    )
  }

  // Render mini chart
  const renderMiniChart = () => {
    if (priceHistory.length === 0) return null

    const minPrice = Math.min(...priceHistory)
    const maxPrice = Math.max(...priceHistory)
    const range = maxPrice - minPrice || 1

    return (
      <div className="h-12 w-full mt-2">
        <svg width="100%" height="48" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke={isPositive ? '#22c55e' : '#ef4444'}
            strokeWidth="1.5"
            points={priceHistory
              .map((p, i) => `${(i * 100) / (priceHistory.length - 1)},${48 - ((p - minPrice) / range) * 48}`)
              .join(' ')}
          />
        </svg>
      </div>
    )
  }

  // Render position info
  const renderPositionInfo = () => {
    if (!hasPosition) return null

    const pnl = currentPosition.currentPnL || 0
    const pnlPercent = currentPosition.pnlPercent || 0
    const isProfit = pnl >= 0

    return (
      <div className="mt-3 pt-3 border-t border-dark-border space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Entry</span>
          <span className="text-gray-300">${currentPosition.entryPrice?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Qty</span>
          <span className="text-gray-300">{currentPosition.quantity} {symbol.replace('USDT', '')}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">PnL</span>
          <span className={isProfit ? 'text-profit' : 'text-loss'}>
            {isProfit ? '+' : ''}${pnl.toFixed(2)} ({pnlPercent.toFixed(1)}%)
          </span>
        </div>
        {currentPosition.stopLoss && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1">
              <Shield className="w-3 h-3 text-loss" />
              SL
            </span>
            <span className="text-loss">${currentPosition.stopLoss.toFixed(2)}</span>
          </div>
        )}
        {currentPosition.takeProfit && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1">
              <Target className="w-3 h-3 text-profit" />
              TP
            </span>
            <span className="text-profit">${currentPosition.takeProfit.toFixed(2)}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="glass-card p-4 transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ transform: isHovered ? 'translateY(-2px)' : 'none' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-dark-border flex items-center justify-center">
            <span className="text-xs font-bold">{symbol.replace('USDT', '').substring(0, 4)}</span>
          </div>
          <div>
            <h3 className="font-bold text-lg">{symbol}</h3>
            <div className="flex gap-2">
              {renderSignalIndicators()}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-bold text-lg">${price.toLocaleString()}</div>
          <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {isPositive ? '+' : ''}{priceChange24h.toFixed(2)} ({priceChangePercent24h.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Mini Chart */}
      {renderMiniChart()}

      {/* Signal Indicator Bar */}
      {signal && signal.action !== 'HOLD' && (
        <div className={`mt-2 h-1 rounded-full overflow-hidden ${signal.action === 'BUY' ? 'bg-profit/30' : 'bg-loss/30'}`}>
          <div
            className={`h-full ${signal.action === 'BUY' ? 'bg-profit' : 'bg-loss'}`}
            style={{ width: `${signal.confidence * 100}%` }}
          />
        </div>
      )}

      {/* Position Info */}
      {renderPositionInfo()}

      {/* Loading indicator if hovered */}
      {isHovered && !signal && (
        <div className="mt-2 flex items-center justify-center text-xs text-gray-500">
          <Clock className="w-3 h-3 mr-1" />
          Updating...
        </div>
      )}
    </div>
  )
}

// Helper function for crypto icon
function CryptoIcon({ symbol }: { symbol: string }) {
  // Simple colored circle with symbol initials
  const colors: Record<string, string> = {
    BTC: 'from-orange-400 to-orange-600',
    ETH: 'from-blue-400 to-blue-600',
    ADA: 'from-blue-300 to-blue-500',
    XRP: 'from-black to-gray-600',
    DOGE: 'from-yellow-300 to-yellow-500',
    LINK: 'from-blue-300 to-indigo-600',
    SOL: 'from-purple-400 to-purple-600',
    BNB: 'from-yellow-400 to-yellow-600',
    AVAX: 'from-blue-400 to-purple-500',
  }
  const color = colors[symbol.replace('USDT', '')] || 'from-gray-400 to-gray-600'

  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${color} flex items-center justify-center`}>
      <span className="text-xs font-bold text-white">{symbol.replace('USDT', '').substring(0, 3)}</span>
    </div>
  )
}