import { PriceData } from '@/types'

// ============================================================
// Mock Binance API - untuk development & testing tanpa API keys
// ============================================================
// Simulasi semua fungsi BinanceAPI dengan data mock
// Cocok untuk demo & backtesting tanpa deposit

const MOCK_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT',
                       'LINKUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT']

// Generate realistic mock price data
function generateMockKlines(symbol: string, interval: string, limit: number): PriceData[] {
  const data: PriceData[] = []
  let basePrice = getBasePrice(symbol)
  const now = Date.now()

  for (let i = limit - 1; i >= 0; i--) {
    const timeOffset = parseInterval(interval) * i * 1000
    const timestamp = now - timeOffset

    // Simulate price movement with random walk
    const volatility = getBasePrice(symbol) * 0.02 // 2% volatility
    const change = (Math.random() - 0.5) * 2 * volatility
    basePrice = Math.max(basePrice + change, basePrice * 0.5)

    const open = basePrice + (Math.random() - 0.5) * basePrice * 0.005
    const close = basePrice + (Math.random() - 0.5) * basePrice * 0.005
    const high = Math.max(open, close) + Math.random() * basePrice * 0.003
    const low = Math.min(open, close) - Math.random() * basePrice * 0.003
    const volume = Math.random() * 100000 + 50000

    data.push({
      timestamp,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(0)),
    })
  }

  return data
}

function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    BTCUSDT: 60000,
    ETHUSDT: 3500,
    ADAUSDT: 0.5,
    XRPUSDT: 0.5,
    DOGEUSDT: 0.08,
    LINKUSDT: 14,
    SOLUSDT: 150,
    BNBUSDT: 600,
    AVAXUSDT: 40,
  }
  return prices[symbol] || 100
}

function parseInterval(interval: string): number {
  const num = parseInt(interval.match(/\d+/)?.[0] || '1')
  if (interval.includes('m')) return num * 60
  if (interval.includes('h')) return num * 3600
  if (interval.includes('d')) return num * 86400
  if (interval.includes('w')) return num * 604800
  return 3600
}

// ============================================================
// Mock Binance API Class
// ============================================================
class MockBinanceAPI {
  private mockBalance: Record<string, number> = {
    USDT: 500.0,
    BUSD: 0,
    BNB: 1.0,
  }

  async getServerTime(): Promise<number> {
    return Date.now()
  }

  async getAccountInfo(): Promise<any> {
    return {
      balances: Object.entries(this.mockBalance).map(([asset, free]) => ({
        asset,
        free: free.toString(),
        locked: '0.00000000',
      })),
      assetsBetween: {},
    }
  }

  async getBalances(): Promise<any[]> {
    return Object.entries(this.mockBalance)
      .filter(([, v]) => v > 0)
      .map(([asset, free]) => ({ asset, free: free.toString(), locked: '0.00000000' }))
  }

  async getPrice(symbol: string): Promise<number> {
    return getBasePrice(symbol) * (0.95 + Math.random() * 0.1)
  }

  async get24hStats(symbol: string): Promise<any> {
    const basePrice = getBasePrice(symbol)
    const change = (Math.random() - 0.5) * 0.1
    return {
      priceChangePercent: (change * 100).toFixed(2),
      lastPrice: (basePrice * (1 + change)).toFixed(2),
      highPrice: (basePrice * 1.05).toFixed(2),
      lowPrice: (basePrice * 0.95).toFixed(2),
      volume: '1000000',
    }
  }

  async getKlines(symbol: string, interval: string, limit: number = 500): Promise<PriceData[]> {
    return generateMockKlines(symbol, interval, limit)
  }

  async placeOrder(symbol: string, side: 'BUY' | 'SELL', type: 'LIMIT' | 'MARKET',
                    quantity: number, price?: number): Promise<any> {
    const mockPrice = await this.getPrice(symbol)
    const orderValue = quantity * (price || mockPrice)

    if (side === 'BUY') {
      this.mockBalance.USDT -= orderValue
      const asset = symbol.replace('USDT', '')
      this.mockBalance[asset] = (this.mockBalance[asset] || 0) + quantity
    } else {
      this.mockBalance.USDT += orderValue
      const asset = symbol.replace('USDT', '')
      this.mockBalance[asset] = (this.mockBalance[asset] || 0) - quantity
    }

    return {
      orderId: Math.floor(Math.random() * 99999999),
      symbol,
      side,
      type,
      executedQty: quantity.toString(),
      cumQty: quantity.toString(),
      fills: [{ price: (price || mockPrice).toString(), qty: quantity.toString() }],
      status: 'FILLED',
      clientOrderId: `mock-${Date.now()}`,
    }
  }

  async placeOCO(symbol: string, side: 'BUY' | 'SELL', quantity: number,
    price: number, stopPrice: number, stopLimitPrice: number): Promise<any> {
    const mockPrice = await this.getPrice(symbol)
    const orderValue = quantity * mockPrice
    this.mockBalance.USDT = (this.mockBalance.USDT || 0) + (side === 'SELL' ? orderValue : -orderValue)
    return {
      orderId: Math.floor(Math.random() * 99999999),
      symbol, side, quantity, status: 'FILLED',
      orderReports: [
        { orderId: Math.floor(Math.random() * 99999999), type: 'LIMIT_MAKER', price: price.toString() },
        { orderId: Math.floor(Math.random() * 99999999), type: 'STOP_LOSS_LIMIT', stopPrice: stopPrice.toString() },
      ],
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    return { symbol, orderId, status: 'CANCELED' }
  }

  async getExchangeInfo(): Promise<any> {
    return {
      symbols: MOCK_SYMBOLS.map(s => ({
        symbol: s,
        status: 'TRADING',
        quotePrecision: 8,
        basePrecision: 8,
        filters: [
          { filterType: 'LOT_SIZE', stepSize: '0.1', minQty: '0.1' },
          { filterType: 'MIN_NOTIONAL', minNotional: '10' },
        ],
      })),
    }
  }

  async getSymbolInfo(symbol: string): Promise<any> {
    return {
      lotSize: 0.1,
      minQty: 0.1,
      minPrice: 10,
      precision: 8,
    }
  }

  formatQuantity(quantity: number, stepSize: number): number {
    const precision = Math.max(0, Math.floor(-Math.log10(stepSize)))
    return parseFloat((Math.floor(quantity * Math.pow(10, precision)) / Math.pow(10, precision)).toFixed(precision))
  }

  async healthCheck(): Promise<{ connected: boolean; serverTime: number; error?: string }> {
    return { connected: true, serverTime: Date.now() }
  }

  // Update mock balance (for testing)
  setBalance(asset: string, amount: number) {
    this.mockBalance[asset] = amount
  }

  getBalance(asset: string): number {
    return this.mockBalance[asset] || 0
  }
}

export default MockBinanceAPI