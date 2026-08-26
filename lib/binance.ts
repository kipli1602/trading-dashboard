import crypto from 'crypto'
import axios from 'axios'
import { PriceData } from '@/types'

// ============================================================
// Binance API Integration
// ============================================================
// Support both Spot Testnet & Mainnet
// All trading operations are handled here

class BinanceAPI {
  private apiKey: string
  private apiSecret: string
  private isTestnet: boolean
  private baseURL: string

  constructor(apiKey: string, apiSecret: string, isTestnet: boolean = false) {
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.isTestnet = isTestnet
    this.baseURL = isTestnet
      ? 'https://testnet.binance.vision'
      : 'https://api.binance.com'
  }

  // Generate HMAC SHA256 signature
  private sign(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex')
  }

  // Get server time
  async getServerTime(): Promise<number> {
    const res = await axios.get(`${this.baseURL}/api/v3/time`)
    return res.data.serverTime
  }

  // Get account information & balances
  async getAccountInfo(): Promise<any> {
    const timestamp = Date.now()
    const queryString = `timestamp=${timestamp}`
    const signature = this.sign(queryString)

    const res = await axios.get(`${this.baseURL}/api/v3/account`, {
      headers: { 'X-MBX-APIKEY': this.apiKey },
      params: { timestamp, signature },
    })
    return res.data
  }

  // Get account balances (only non-zero)
  async getBalances(): Promise<any[]> {
    const account = await this.getAccountInfo()
    return account.balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
  }

  // Get current price for a symbol
  async getPrice(symbol: string): Promise<number> {
    const res = await axios.get(`${this.baseURL}/api/v3/ticker/price`, {
      params: { symbol },
    })
    return parseFloat(res.data.price)
  }

  // Get 24h price stats
  async get24hStats(symbol: string): Promise<any> {
    const res = await axios.get(`${this.baseURL}/api/v3/ticker/24hr`, {
      params: { symbol },
    })
    return res.data
  }

  // Get klines/candlestick data
  async getKlines(symbol: string, interval: string, limit: number = 500): Promise<PriceData[]> {
    const res = await axios.get(`${this.baseURL}/api/v3/klines`, {
      params: { symbol, interval, limit },
    })

    return res.data.map((d: any[]) => ({
      timestamp: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }))
  }

  // Place a LIMIT order
  async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'LIMIT' | 'MARKET' = 'MARKET',
    quantity: number,
    price?: number,
    stopPrice?: number
  ): Promise<any> {
    const timestamp = Date.now()
    const params: any = {
      symbol,
      side,
      type,
      quantity: type === 'MARKET' ? quantity : quantity.toString(),
      timestamp,
      newOrderRespType: 'RESULT',
    }

    if (type === 'LIMIT' && price) {
      params.price = price.toString()
      params.timeInForce = 'GTC'
    }

    if (stopPrice) {
      params.stopPrice = stopPrice.toString()
    }

    const signature = this.sign(Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&'))

    const res = await axios.post(`${this.baseURL}/api/v3/order`, null, {
      headers: { 'X-MBX-APIKEY': this.apiKey },
      params: { ...params, signature },
    })

    return res.data
  }

  // Place OCO (One-Cancels-the-Other) order for TP + SL
  async placeOCO(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,        // Take Profit price
    stopPrice: number,    // Stop Loss trigger
    stopLimitPrice: number // Stop Loss limit
  ): Promise<any> {
    const timestamp = Date.now()
    const params = {
      symbol,
      side,
      quantity: quantity.toString(),
      price: price.toString(),
      stopPrice: stopPrice.toString(),
      stopLimitPrice: stopLimitPrice.toString(),
      stopLimitTimeInForce: 'GTC',
      timestamp,
    }

    const signature = this.sign(Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&'))

    const res = await axios.post(`${this.baseURL}/api/v3/order/oco`, null, {
      headers: { 'X-MBX-APIKEY': this.apiKey },
      params: { ...params, signature },
    })

    return res.data
  }

  // Cancel order
  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    const timestamp = Date.now()
    const params = { symbol, orderId, timestamp }
    const signature = this.sign(Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&'))

    const res = await axios.delete(`${this.baseURL}/api/v3/order`, {
      headers: { 'X-MBX-APIKEY': this.apiKey },
      params: { ...params, signature },
    })

    return res.data
  }

  // Get exchange info (lot sizes, min quantities)
  async getExchangeInfo(): Promise<any> {
    const res = await axios.get(`${this.baseURL}/api/v3/exchangeInfo`)
    return res.data
  }

  // Get symbol lot size info
  async getSymbolInfo(symbol: string): Promise<any> {
    const info = await this.getExchangeInfo()
    const symInfo = info.symbols.find((s: any) => s.symbol === symbol)
    if (!symInfo) return null

    const lotSize = symInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE')
    const minNotional = symInfo.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL')

    return {
      lotSize: parseFloat(lotSize?.stepSize || '1'),
      minQty: parseFloat(lotSize?.minQty || '1'),
      minPrice: parseFloat(minNotional?.minNotional || '10'),
      precision: symInfo.quotePrecision,
    }
  }

  // Format quantity to valid step size
  formatQuantity(quantity: number, stepSize: number): number {
    const precision = Math.max(0, Math.floor(-Math.log10(stepSize)))
    const rounded = Math.floor(quantity * Math.pow(10, precision)) / Math.pow(10, precision)
    return Math.max(rounded, stepSize)
  }

  // Health check
  async healthCheck(): Promise<{ connected: boolean; serverTime: number; error?: string }> {
    try {
      const data = await this.getServerTime()
      return { connected: true, serverTime: data }
    } catch (e: any) {
      return { connected: false, serverTime: 0, error: e.message }
    }
  }
}

export default BinanceAPI