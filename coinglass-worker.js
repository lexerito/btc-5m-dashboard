/**
 * Cloudflare Worker: private CoinGlass proxy for the BTC 5m dashboard.
 * Set COINGLASS_API_KEY as a Worker secret. Never put it in index.html.
 *
 * GET /api/flow?symbol=BTC
 */
const API = "https://open-api-v4.coinglass.com/api/futures/coin/netflow";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "https://lexerito.github.io").split(",").map(x => x.trim());
    const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname === "/") {
      return Response.json({
        ok: true,
        service: "CoinGlass BTC futures flow proxy",
        endpoint: "/api/flow",
        status: "Worker is running"
      }, { status: 200, headers });
    }
    if (url.pathname !== "/api/flow") {
      return Response.json({ ok: false, error: "Not found" }, { status: 404, headers });
    }
    if (request.method !== "GET") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405, headers });
    }
    if (!env.COINGLASS_API_KEY) {
      return Response.json({ ok: false, error: "Worker secret COINGLASS_API_KEY is not configured." }, { status: 503, headers });
    }
    try {
      const upstream = await fetch(API + "?symbol=BTC&exchange_list=Binance,Bybit,OKX", {
        headers: { "accept": "application/json", "CG-API-KEY": env.COINGLASS_API_KEY },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      const body = await upstream.json();
      if (!upstream.ok || String(body.code) !== "0" || !body.data) {
        return Response.json({
          ok: false,
          error: body.msg || ("CoinGlass HTTP " + upstream.status),
          code: body.code || String(upstream.status)
        }, { status: 502, headers });
      }
      const d = body.data;
      const number = key => {
        const n = Number(d[key]);
        return Number.isFinite(n) ? n : null;
      };
      const result = {
        ok: true,
        source: "CoinGlass",
        symbol: d.symbol || "BTC",
        exchanges: ["Binance", "Bybit", "OKX"],
        fetchedAt: Date.now(),
        windows: {
          "5m": {
            buyUsd: number("taker_buy_volume_usd_5m"),
            sellUsd: number("taker_sell_volume_usd_5m"),
            netUsd: number("net_flow_usd_5m"),
            changePct: number("net_flow_usd_change_percent_5m")
          },
          "15m": {
            buyUsd: number("taker_buy_volume_usd_15m"),
            sellUsd: number("taker_sell_volume_usd_15m"),
            netUsd: number("net_flow_usd_15m"),
            changePct: number("net_flow_usd_change_percent_15m")
          },
          "1h": {
            buyUsd: number("taker_buy_volume_usd_1h"),
            sellUsd: number("taker_sell_volume_usd_1h"),
            netUsd: number("net_flow_usd_1h"),
            changePct: number("net_flow_usd_change_percent_1h")
          }
        }
      };
      return Response.json(result, { status: 200, headers });
    } catch (error) {
      return Response.json({ ok: false, error: "CoinGlass request failed: " + String(error.message || error) }, { status: 502, headers });
    }
  }
};
