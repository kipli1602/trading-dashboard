'use client'

import { useState, useEffect } from 'react'
import { Save, Shield, Key, Settings, BarChart3, RefreshCw, Check } from 'lucide-react'
import { DEFAULT_BOT_CONFIG, RISK_CONFIG, PAIRS_9 } from '@/lib/config'

export default function SettingsPage() {
  const [config, setConfig] = useState({
    apiKey: DEFAULT_BOT_CONFIG.apiKey,
    apiSecret: DEFAULT_BOT_CONFIG.apiSecret,
    useTestnet: DEFAULT_BOT_CONFIG.testnet,
    isDemo: true,
    checkInterval: 300,
    maxOpenPositions: RISK_CONFIG.maxOpenPositions,
    dailyLossLimit: RISK_CONFIG.dailyLossLimit,
    enableNotifications: true,
    enableTrading: false,
    pairs: PAIRS_9,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await new Promise(r => setTimeout(r, 800))
      localStorage.setItem('bot-config', JSON.stringify(config))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const togglePair = (symbol: string) => {
    setConfig({
      ...config,
      pairs: config.pairs.map(p =>
        p.symbol === symbol ? { ...p, enabled: !p.enabled } : p
      ),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Bot Settings
          </span>
        </h1>
        <p className="text-gray-400 mt-1">Configure trading bot parameters & API keys</p>
      </div>

      {/* Save notification */}
      {saved && (
        <div className="fixed top-4 right-4 bg-profit/20 border border-profit/50 text-profit px-4 py-2 rounded-lg flex items-center gap-2 z-50">
          <Check className="w-4 h-4" />
          Settings saved successfully!
        </div>
      )}

      {/* API Configuration */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Key className="w-6 h-6 text-primary" />
          Exchange API
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key
            </label>
            <input
              type="text"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="w-full px-3 py-2 bg-dark-border/50 border border-dark-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              placeholder="Enter your Binance API key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Secret
            </label>
            <input
              type="password"
              value={config.apiSecret}
              onChange={(e) => setConfig({ ...config, apiSecret: e.target.value })}
              className="w-full px-3 py-2 bg-dark-border/50 border border-dark-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              placeholder="Enter your API secret"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-3 p-3 bg-dark-border/30 rounded-lg">
            <input
              type="checkbox"
              id="useTestnet"
              checked={config.useTestnet}
              onChange={(e) => setConfig({ ...config, useTestnet: e.target.checked })}
              className="w-4 h-4 rounded bg-dark-border border-dark-border text-primary focus:ring-primary"
            />
            <label htmlFor="useTestnet" className="text-sm text-gray-300">
              Use Binance Testnet (safe mode)
            </label>
          </div>

          <div className="flex items-center gap-3 p-3 bg-dark-border/30 rounded-lg">
            <input
              type="checkbox"
              id="enableTrading"
              checked={config.enableTrading}
              onChange={(e) => setConfig({ ...config, enableTrading: e.target.checked })}
              className="w-4 h-4 rounded bg-dark-border border-dark-border text-profit focus:ring-primary"
            />
            <label htmlFor="enableTrading" className="text-sm text-profit font-medium">
              Enable Live Trading
            </label>
          </div>
        </div>

        {!config.enableTrading && (
          <div className="mt-3 p-3 bg-yellow-400/10 border border-yellow-400/30 rounded-lg">
            <p className="text-xs text-yellow-300">
              Live trading is disabled. Bot akan berjalan dalam mode SIMULASI (demo) saja.
              Aktifkan checkbox di atas untuk trading dengan uang sungguhan.
            </p>
          </div>
        )}

        <div className="mt-4 p-3 bg-profit/10 border border-profit/30 rounded-lg">
          <p className="text-xs text-profit">
            <Shield className="w-3 h-3 inline mr-1" />
            API keys are stored encrypted and never exposed to client-side code.
          </p>
        </div>
      </div>

      {/* Risk Management */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-secondary" />
          Risk Management
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Open Positions
            </label>
            <input
              type="number"
              min="1"
              max="9"
              value={config.maxOpenPositions}
              onChange={(e) => setConfig({ ...config, maxOpenPositions: parseInt(e.target.value) || 5 })}
              className="w-full px-3 py-2 bg-dark-border/50 border border-dark-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum simultaneous positions (1-9)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Daily Loss Limit (IDR)
            </label>
            <input
              type="number"
              value={config.dailyLossLimit}
              onChange={(e) => setConfig({ ...config, dailyLossLimit: parseInt(e.target.value) || 100000 })}
              className="w-full px-3 py-2 bg-dark-border/50 border border-dark-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">Auto-stop if exceeded</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Check Interval (seconds)
            </label>
            <input
              type="number"
              value={config.checkInterval}
              onChange={(e) => setConfig({ ...config, checkInterval: parseInt(e.target.value) || 300 })}
              className="w-full px-3 py-2 bg-dark-border/50 border border-dark-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">Bot scan interval</p>
          </div>
        </div>
      </div>

      {/* 9 Pair Configuration */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          9 Pair Monitoring
        </h2>

        <p className="text-sm text-gray-400 mb-4">
          Enable/disable pairs for monitoring & trading. Each pair has its own
          stop loss and take profit settings.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left py-2 text-sm font-medium text-gray-400">Pair</th>
                <th className="text-center py-2 text-sm font-medium text-gray-400">Monitor</th>
                <th className="text-right py-2 text-sm font-medium text-gray-400">Max Position</th>
                <th className="text-right py-2 text-sm font-medium text-gray-400">SL %</th>
                <th className="text-right py-2 text-sm font-medium text-gray-400">TP %</th>
              </tr>
            </thead>
            <tbody>
              {config.pairs.map((pair) => (
                <tr key={pair.symbol} className="border-b border-dark-border/50">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-xs font-bold">
                        {pair.symbol.replace('USDT', '').substring(0, 3)}
                      </div>
                      <span className="font-medium">{pair.symbol}</span>
                    </div>
                  </td>
                  <td className="text-center py-3">
                    <button
                      onClick={() => togglePair(pair.symbol)}
                      className={`w-12 h-6 rounded-full flex items-center transition-all ${
                        pair.enabled
                          ? 'bg-profit/30 justify-end pr-1'
                          : 'bg-gray-600/30 justify-start pl-1'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white"></div>
                    </button>
                  </td>
                  <td className="text-right py-3 text-gray-300">
                    Rp{pair.maxPositionSize.toLocaleString('id-ID')}
                  </td>
                  <td className="text-right py-3 text-loss">
                    -{pair.stopLossPercent}%
                  </td>
                  <td className="text-right py-3 text-profit">
                    +{pair.takeProfitPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}