// Cloudflare Worker - KuCoin API Proxy Relay
// Deploy ke region Singapore/Tokyo untuk bypass geo-block

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    }

    try {
      const url = new URL(request.url)
      const targetPath = url.searchParams.get('path') || '/api/v1/timestamp'
      const targetMethod = request.method
      const targetBody = targetMethod !== 'GET' ? await request.text() : undefined

      // Forward ALL KuCoin headers
      const headers = {}
      for (const [key, value] of request.headers) {
        if (key.toLowerCase().startsWith('kc-') || key.toLowerCase() === 'content-type') {
          headers[key] = value
        }
      }

      const kucoinUrl = `https://api.kucoin.com${targetPath}`
      const response = await fetch(kucoinUrl, {
        method: targetMethod,
        headers,
        body: targetBody,
      })

      const data = await response.text()
      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}
