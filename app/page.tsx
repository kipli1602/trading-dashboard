/**
 * Crypto AI Trading Bot Dashboard
 * Auto-trading bot for 9 crypto pairs with AI-powered signals
 */
import Link from 'next/link'
import { Bot, TrendingUp, BarChart3, Shield, Clock, Zap } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-dark-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Bot className="w-10 h-10 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Crypto AI Trading Bot
            </h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Auto-trading bot for 9 crypto pairs powered by AI consensus engine.
            Combining 7 trading strategies into one intelligent signal system.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-6 text-center">
            <TrendingUp className="w-8 h-8 text-profit mx-auto mb-2" />
            <p className="text-2xl font-bold text-profit">+302.88%</p>
            <p className="text-sm text-gray-400">Best Backtest Return (XRP)</p>
          </div>
          <div className="glass-card p-6 text-center">
            <Shield className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary">7</p>
            <p className="text-sm text-gray-400">AI Strategies Combined</p>
          </div>
          <div className="glass-card p-6 text-center">
            <BarChart3 className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-2xl font-bold text-secondary">9</p>
            <p className="text-sm text-gray-400">Pairs Monitored</p>
          </div>
          <div className="glass-card p-6 text-center">
            <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-400">5 min</p>
            <p className="text-sm text-gray-400">Check Interval</p>
          </div>
        </div>

        {/* Main CTA */}
        <div className="text-center mb-12">
          <Link href="/dashboard" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/80 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-200 hover:shadow-lg hover:shadow-primary/30">
            <Zap className="w-6 h-6" />
            Buka Dashboard Trading
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="glass-card p-6">
            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              Auto Trading
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>7 strategi AI (MA, RSI, Bollinger, MACD, Momentum, ATR, VWAP)</li>
              <li>Weighted ensemble voting</li>
              <li>Confidence scoring 0-100%</li>
              <li>Auto SL/TP + position sizing</li>
            </ul>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-secondary" />
              9 Pair Monitoring
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>BTC, ETH, ADA, XRP, DOGE</li>
              <li>LINK, SOL, BNB, AVAX</li>
              <li>1H, 4H, Daily timeframes</li>
              <li>Real-time price & signals</li>
            </ul>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              <Shield className="w-6 h-6 text-profit" />
              Risk Management
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>Position size based on confidence</li>
              <li>Stop loss otomatis per pair</li>
              <li>Daily loss limit protection</li>
              <li>Max open positions limit</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Demo mode active | Data from Yahoo Finance API | Deploy to Vercel</p>
          <p className="mt-1">
            Disclaimer: Crypto trading involves high risk. Use demo first.
          </p>
        </div>
      </div>
    </main>
  )
}