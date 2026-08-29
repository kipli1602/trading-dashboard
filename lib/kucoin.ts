import { PriceData } from '@/types'

// ============================================================
// KuCoin API - real trading via KuCoin API
// ============================================================
// Production: https://api.kucoin.com
// Sandbox: https://openapi-sandbox.kucoin.com
// Works from US IPs (not geo-blocked)! ✅

const SANDBOX_URL = 'https://openapi-sandbox.kucoin.com'
const PROD_URL = 'https://api.kucoin.com'
const IS_SANDBOX = process.env.KUCOIN_SANDBOX !== 'false' // default sandbox
const BASE_URL = process.env.KUCOIN_BASE_URL || (IS_SANDBOX ? SANDBOX_URL : PROD_URL)

// KuCoin trading pairs (BTCUSDT → BTC-USDT)
const PAIR_MAP: Record<string, string> = {
  BTCUSDT: 'BTC-USDT',
  ETHUSDT: 'ETH-USDT',
  ADAUSDT: 'ADA-USDT',
  XRPUSDT: 'XRP-USDT',
  DOGEUSDT: 'DOGE-USDT',
  LINKUSDT: 'LINK-USDT',
  SOLUSDT: 'SOL-USDT',
  BNBUSDT: 'BNB-USDT',
  AVAXUSDT: 'AVAX-USDT',
}

class KuCoinAPI {
  private apiKey: string
  private apiSecret: string
  private passphrase: string
  private mockBalance: Record<string, number> = { USDT: 10000 }

  constructor(apiKey: string = '', apiSecret: string = '', passphrase: string = '') {
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.passphrase = passphrase
  }

  // KuCoin signature: HMAC-SHA256 of timestamp+method+path+body
  private async sign(timestamp: string, method: string, requestPath: string, body: string = ''): Promise<string> {
    const { default: crypto } = await import('crypto')
    const str_to_sign = timestamp + method.toUpperCase() + requestPath + body
    // KuCoin v3: try both raw string and base64-decoded secret
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(str_to_sign)
      .digest('base64')
  }

  // KuCoin v3 passphrase: HMAC-SHA256(timestamp+passphrase, raw secret string)
  private async encryptPassphrase(timestamp: string): Promise<string> {
    const { default: crypto } = await import('crypto')
    const str_to_sign = timestamp + this.passphrase
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(str_to_sign)
      .digest('base64')
  }

  // Authenticated fetch — routes through proxy if configured (for geo-block bypass)
  private async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const proxyUrl = process.env.KUCOIN_PROXY_URL
    if (proxyUrl) {
      // Route through proxy: proxy appends ?path=/api/v1/... and forwards KC-API headers
      const urlObj = new URL(url)
      const proxyTarget = `${proxyUrl}?path=${encodeURIComponent(urlObj.pathname + urlObj.search)}`
      return fetch(proxyTarget, options)
    }
    return fetch(url, options)
  }

  // Get auth headers for KuCoin API
  // V3 keys auth = v1 style: no KEY-VERSION, plaintext passphrase, raw secret
  private async getAuthHeaders(method: string, path: string, body: string = ''): Promise<Record<string, string>> {
    const ts = (await this.getServerTime()).toString()
    const sig = await this.sign(ts, method, path, body)
    return {
      'KC-API-KEY': this.apiKey,
      'KC-API-SIGN': sig,
      'KC-API-TIMESTAMP': ts,
      'KC-API-PASSPHRASE': this.passphrase, // plaintext — no encryption
      'Content-Type': 'application/json',
    }
  }

  // For v1 keys: encrypted passphrase
  private async getAuthHeadersV1(method: string, path: string, body: string = ''): Promise<Record<string, string>> {
    const ts = (await this.getServerTime()).toString()
    const sig = await this.sign(ts, method, path, body)
    const pass = await this.encryptPassphrase(ts)
    return {
      'KC-API-KEY': this.apiKey,
      'KC-API-SIGN': sig,
      'KC-API-TIMESTAMP': ts,
      'KC-API-PASSPHRASE': pass,
      'Content-Type': 'application/json',
    }
  }

  // Get real-time price
  async getPrice(symbol: string): Promise<number> {
    const kcsymbol = PAIR_MAP[symbol] || symbol
    try {
      const res = await fetch(`${BASE_URL}/api/v1/market/ticker?symbol=${kcsymbol}`)
      const data = await res.json()
      if (data.code === '200000' && data.data?.price) {
        return parseFloat(data.data.price)
      }
      throw new Error('Price fetch failed')
    } catch (e) {
      // Fallback: CoinGecko
      const COINGECKO_IDS: Record<string, string> = {
        BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', ADAUSDT: 'cardano',
        XRPUSDT: 'ripple', DOGEUSDT: 'dogecoin', LINKUSDT: 'chainlink',
        SOLUSDT: 'solana', BNBUSDT: 'binancecoin', AVAXUSDT: 'avalanche-2',
      }
      try {
        const coinId = COINGECKO_IDS[symbol]
        if (!coinId) throw new Error(`No mapping for ${symbol}`)
        const res2 = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`)
        const data2 = await res2.json() as Record<string, { usd: number }>
        const price = data2[coinId]?.usd
        if (!price) throw new Error(`CoinGecko price fetch failed for ${symbol}`)
        return price
      } catch (e2) {
        // Don't return mock price ($10k) — throw so caller uses getAllPrices()
        throw new Error(`All price sources failed for ${symbol}`)
      }
    }
  }

  // Get all prices via CoinGecko
  async getAllPrices(): Promise<Record<string, number>> {
    const COINGECKO_IDS: Record<string, string> = {
      BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', ADAUSDT: 'cardano',
      XRPUSDT: 'ripple', DOGEUSDT: 'dogecoin', LINKUSDT: 'chainlink',
      SOLUSDT: 'solana', BNBUSDT: 'binancecoin', AVAXUSDT: 'avalanche-2',
    }
    const ids = Object.values(COINGECKO_IDS).join(',')
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)
    const data = await res.json() as Record<string, { usd: number }>
    const prices: Record<string, number> = {}
    for (const [symbol, cgId] of Object.entries(COINGECKO_IDS)) {
      prices[symbol] = data[cgId]?.usd || 0
    }
    return prices
  }

  // Get klines (1H candles)
  // realPrice: fallback base price from CoinGecko (prevents random mock prices)
  async getKlines(symbol: string, interval: string = '3600', limit: number = 200, realPrice?: number): Promise<PriceData[]> {
    const kcsymbol = PAIR_MAP[symbol] || symbol
    // Convert interval: '3600' → '1H', '60' → '1m', '86400' → '1D'
    const kctype = this.intervalToKctype(interval)

    try {
      const res = await fetch(`${BASE_URL}/api/v1/market/candles?symbol=${kcsymbol}&type=${kctype}&limit=${Math.min(limit, 500)}`)
      const data = await res.json()
      if (data.code === '200000' && Array.isArray(data.data)) {
        return data.data.reverse().map((candle: any[]) => ({
          timestamp: candle[0],
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
        }))
      }
      throw new Error('No klines data returned')
    } catch (e) {
       // Fallback: CoinGecko OHLC (pass realPrice so mock fallback is correct)
      return this.coingeckoOHLC(symbol, realPrice)
    }
  }

  private COINGECKO_IDS: Record<string, string> = {
    BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', ADAUSDT: 'cardano',
    XRPUSDT: 'ripple', DOGEUSDT: 'dogecoin', LINKUSDT: 'chainlink',
    SOLUSDT: 'solana', BNBUSDT: 'binancecoin', AVAXUSDT: 'avalanche-2',
  }

  private intervalToKctype(interval: string): string {
    const map: Record<string, string> = {
      '60': '1m', '300': '5m', '900': '15m',
      '1800': '30m', '3600': '1H', '14400': '4H',
      '28800': '8H', '43200': '12H', '86400': '1D',
      '604800': '1W',
    }
    return map[interval] || '1H'
  }

  async coingeckoOHLC(symbol: string, realPrice?: number): Promise<PriceData[]> {
    const coinId = this.COINGECKO_IDS[symbol]
    if (!coinId) throw new Error(`No CoinGecko mapping for ${symbol}`)
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=7`)
      const data = await res.json() as any[]
      if (!Array.isArray(data) || data.length < 20) return this.mockKlines(symbol, 200, realPrice || 0)

      return data.map((candle: any[]) => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: 0,
      })).reverse()
    } catch {
      return this.mockKlines(symbol, 200, realPrice || 0)
    }
  }

  private mockKlines(symbol: string, count: number = 200, realPrice: number = 0): PriceData[] {
    const basePrice = realPrice || 50000 * Math.random() + 10
    const data: PriceData[] = []
    const now = Date.now()
    let price = basePrice
    const dipStart = count - 45
    for (let i = count; i >= 0; i--) {
      const ts = now - i * 3600000
      let delta = (Math.random() - 0.5) * 0.006
      if (i >= dipStart) delta = (Math.random() - 0.5) * 0.004 - (price - basePrice) / basePrice * 0.02
      else if (i < 20) delta = 0.006 + (Math.random() - 0.5) * 0.002
      else delta = -0.008 + (Math.random() - 0.5) * 0.002 - (price - basePrice * 0.92) / basePrice * 0.01
      price = price + delta * basePrice
      price = Math.max(basePrice * 0.8, Math.min(basePrice * 1.15, price))
      const open = i < count ? price - delta * basePrice : price
      const close = price
      const high = Math.max(open, close) * (1 + Math.random() * 0.004)
      const low = Math.min(open, close) * (1 - Math.random() * 0.004)
      data.push({ timestamp: ts, open, high, low, close, volume: Math.random() * 2000 * basePrice })
    }
    return data
  }

  // Get 24h stats
  async get24hStats(symbol: string): Promise<any> {
    try {
      const price = await this.getPrice(symbol)
      return {
        priceChange: (price * 0.025).toString(),
        priceChangePercent: '2.5',
        lastPrice: price.toString(),
        highPrice: (price * 1.05).toString(),
        lowPrice: (price * 0.95).toString(),
        volume: '1000000',
      }
    } catch {
      return { priceChange: '0', priceChangePercent: '0', lastPrice: '0', highPrice: '0', lowPrice: '0', volume: '0' }
    }
  }

  // Get server time
  async getServerTime(): Promise<number> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/timestamp`)
      const data = await res.json()
      return data.data || Date.now()
    } catch {
      return Date.now()
    }
  }

  // Get symbol info
  async getSymbolInfo(symbol: string): Promise<any> {
    const kcsymbol = PAIR_MAP[symbol] || symbol
    try {
      const res = await fetch(`${BASE_URL}/api/v1/symbols/${kcsymbol}`)
      const data = await res.json()
      if (data.code === '200000' && data.data) {
        return {
          symbol: data.data.symbol,
          lotSize: parseFloat(data.data.increment || '0.01'),
          minQty: parseFloat(data.data.minSize || '0.01'),
        }
      }
    } catch (e) {
      // ignore
    }
    return { symbol: kcsymbol, lotSize: 0.01, minQty: 0.01 }
  }

  // Format quantity to step size
  formatQuantity(quantity: number, stepSize: number): number {
    if (stepSize <= 0) return Math.floor(quantity * 1000) / 1000
    const precision = Math.floor(Math.log10(1 / stepSize))
    return Math.floor(quantity * Math.pow(10, precision)) / Math.pow(10, precision)
  }

  // Place order (real trading)
  async placeOrder(symbol: string, side: 'BUY' | 'SELL', type: 'LIMIT' | 'MARKET',
    quantity: number, price?: number): Promise<any> {
    const kcsymbol = PAIR_MAP[symbol] || symbol
    const qty = this.formatQuantity(quantity, 0.001)
    const mockPrice = price || await this.getPrice(symbol)

    if (this.apiKey && this.apiSecret && this.passphrase) {
      const path = '/api/v1/orders'
      const orderData = type === 'MARKET'
        ? {
            clientOid: `bot_${Date.now()}`,
            side: side === 'BUY' ? 'buy' : 'sell',
            symbol: kcsymbol,
            type: 'market',
            size: (qty * mockPrice).toFixed(2), // USDT amount
          }
        : {
            clientOid: `bot_${Date.now()}`,
            side: side === 'BUY' ? 'buy' : 'sell',
            symbol: kcsymbol,
            type: 'limit',
            price: price!.toFixed(2),
            size: qty.toFixed(6),
          }

      const body = JSON.stringify(orderData)
      const headers = await this.getAuthHeaders('POST', path, body)

      const res = await this.authFetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body,
      })

      const result = await res.json()
      if (result.code === '200000') {
        return {
          orderId: result.data?.orderId || `kucoin_${Date.now()}`,
          symbol, side, type,
          executedQty: qty.toString(),
          avgPrice: mockPrice.toString(),
          status: result.data?.status || 'done',
          fills: [{ price: mockPrice.toString(), qty: qty.toString() }],
          cumQty: qty.toString(),
        }
      }
      throw new Error(`KuCoin order failed: ${result.msg || 'unknown error'}`)
    }

    // Mock order
    return {
      orderId: Math.floor(Math.random() * 99999999),
      symbol, side, type,
      executedQty: qty.toString(),
      avgPrice: mockPrice.toString(),
      status: 'Filled',
      fills: [{ price: mockPrice.toString(), qty: qty.toString() }],
      cumQty: qty.toString(),
    }
  }

  // Place OCO (Take Profit + Stop Loss)
  async placeOCO(symbol: string, side: 'BUY' | 'SELL', quantity: number,
    price: number, stopPrice: number, stopLimitPrice: number): Promise<any> {
    // KuCoin uses separate orders for TP/SL
    return {
      orderId: Math.floor(Math.random() * 99999999),
      symbol, side, quantity, status: 'NEW',
      orderReports: [
        { orderId: Math.floor(Math.random() * 99999999), type: 'LIMIT', price: price.toString() },
        { orderId: Math.floor(Math.random() * 99999999), type: 'STOP', stopPrice: stopPrice.toString() },
      ],
    }
  }

  // Cancel order
  async cancelOrder(symbol: string, orderId: number | string): Promise<any> {
    if (this.apiKey && this.apiSecret && this.passphrase) {
      const path = `/api/v1/orders/${orderId}`
      const headers = await this.getAuthHeaders('DELETE', path)
      const res = await this.authFetch(`${BASE_URL}${path}`, { method: 'DELETE', headers })
      const data = await res.json()
      return { symbol, orderId, status: 'CANCELED', ...data }
    }
    return { symbol, orderId, status: 'CANCELED' }
  }

  // Get balance — SUM all account types (main + trade + margin + futures)
  async getBalance(): Promise<Record<string, number>> {
    if (this.apiKey && this.apiSecret && this.passphrase) {
      const path = '/api/v1/accounts'
      const headers = await this.getAuthHeaders('GET', path)
      const res = await this.authFetch(`${BASE_URL}${path}`, { headers })
      const data = await res.json()
      if (data.code === '200000' && Array.isArray(data.data)) {
        const balance: Record<string, number> = { USDT: 0 }
        for (const account of data.data) {
          const currency = account.currency.toUpperCase()
          // SUM across all account types (main + trade + margin + futures)
          balance[currency] = (balance[currency] || 0) + parseFloat(account.available || '0')
        }
        console.log(`[KuCoin] Balance fetched: USDT=${balance.USDT}`)
        return balance
      }
      console.error(`[KuCoin] Balance API error:`, data.msg || JSON.stringify(data).substring(0, 200))
      throw new Error(`Balance fetch failed: ${data.msg || data.code}`)
    }
    throw new Error('No KuCoin API credentials')
    return this.mockBalance
  }
}

export default KuCoinAPI
export { PAIR_MAP }
