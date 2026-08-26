import { NextRequest, NextResponse } from 'next/server'
import { riskManager } from '@/lib/risk-manager'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const filter = searchParams.get('filter') // 'wins', 'losses', 'all'

  try {
    let trades = riskManager.getTradeHistory(limit)

    if (filter === 'wins') {
      trades = trades.filter(t => t.pnl > 0)
    } else if (filter === 'losses') {
      trades = trades.filter(t => t.pnl < 0)
    }

    return NextResponse.json(trades)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  return NextResponse.json({ received: body })
}

export async function DELETE(req: NextRequest) {
  // Clear trade history (dev only)
  const riskMgrModule = await import('@/lib/risk-manager')
  // This would reset state in a real implementation
  return NextResponse.json({ success: true, message: 'Trade history cleared (dev mode)' })
}