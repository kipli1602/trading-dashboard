'use client'

import Link from 'next/link'
import { Bot, Home, BarChart3, History, Settings, Activity, PauseCircle, PlayCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

interface HeaderProps {
  currentPage?: string
}

export default function Header({ currentPage = 'dashboard' }: HeaderProps) {
  const [botStatus, setBotStatus] = useState<'online' | 'offline'>('offline')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const navItems = [
    { name: 'Dashboard', icon: Home, path: '/dashboard', key: 'dashboard' },
    { name: 'Positions', icon: BarChart3, path: '/positions', key: 'positions' },
    { name: 'Trade History', icon: History, path: '/trades', key: 'trades' },
    { name: 'Settings', icon: Settings, path: '/settings', key: 'settings' },
  ]

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/bot?action=status')
        const data = await res.json()
        setBotStatus(data.isRunning ? 'online' : 'offline')
      } catch (e) {
        setBotStatus('offline')
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const toggleBot = async () => {
    setIsRefreshing(true)
    try {
      const action = botStatus === 'online' ? 'stop' : 'start'
      await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, interval: 300 }),
      })
      setBotStatus(action === 'start' ? 'online' : 'offline')
    } catch (e) {
      console.error('Failed to toggle bot:', e)
    }
    setIsRefreshing(false)
  }

  return (
    <header className="glass-card border-b border-dark-border px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        {/* Logo & Title */}
        <Link href="/" className="flex items-center gap-2">
          <Bot className="w-7 h-7 text-primary" />
          <span className="font-bold text-xl text-white">Crypto AI Bot</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                currentPage === item.key
                  ? 'bg-primary/20 text-primary shadow-lg shadow-primary/20'
                  : 'text-gray-400 hover:text-white hover:bg-dark-border/50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Bot Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${botStatus === 'online' ? 'status-online' : 'status-offline'}`}></span>
            <span className="text-sm text-gray-300">
              Bot: {botStatus === 'online' ? 'Running' : 'Stopped'}
            </span>
          </div>

          <button
            onClick={toggleBot}
            disabled={isRefreshing}
            className={`p-2 rounded-lg transition-all ${
              botStatus === 'online'
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            } disabled:opacity-50`}
            title={botStatus === 'online' ? 'Stop Bot' : 'Start Bot'}
          >
            {isRefreshing ? (
              <Activity className="w-5 h-5 animate-pulse" />
            ) : botStatus === 'online' ? (
              <PauseCircle className="w-5 h-5" />
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}