import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const BYBIT_BASE = "https://api-testnet.bybit.com";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const bybitPath = url.pathname.replace("/functions/v1/bybit-proxy", "");
    const bybitUrl = `${BYBIT_BASE}${bybitPath}${url.search}`;

    let body: string | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.text();
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      const k = key.toLowerCase();
      if (!["host", "content-length", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-for"].includes(k)) {
        headers[key] = value;
      }
    }

    const response = await fetch(bybitUrl, {
      method: req.method,
      headers,
      body: body ? body : undefined,
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    console.error("Proxy error:", e.message);
    return new Response(
      JSON.stringify({ code: 1, message: e.message || "Proxy error", retCode: 1, retMsg: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
