/**
 * Cloudflare Worker: private data server for the TAKER BUY / SELL table.
 *
 * GET /api/taker?range=5m   (range: 5m, 15m, 30m, 1h, 4h, 12h, 24h)
 *
 * The CoinGlass API key lives only here, as a Worker secret named COINGLASS_API_KEY.
 * It is never put in index.html. Everything that is not /api/* is served as normal
 * website files (see wrangler.jsonc).
 */
const API = "https://open-api-v4.coinglass.com/api/futures/taker-buy-sell-volume/exchange-list";
const RANGES = ["5m", "15m", "30m", "1h", "4h", "12h", "24h"];

const reply = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });

const num = v => {
  const n = Number(v);
  return v !== null && v !== "" && v !== undefined && Number.isFinite(n) ? n : null;
};

// Websites allowed to read /api/taker from the browser (your own sites only).
const ALLOWED_ORIGINS = ["https://lexerito.github.io"];

const withCors = (request, response) => {
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return response;
  const out = new Response(response.body, response);
  out.headers.set("Access-Control-Allow-Origin", origin);
  out.headers.set("Vary", "Origin");
  return out;
};

const handler = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/taker") {
      if (request.method !== "GET") return reply({ ok: false, code: "METHOD", error: "Method not allowed" }, 405);

      const range = url.searchParams.get("range") || "5m";
      if (!RANGES.includes(range)) return reply({ ok: false, code: "BAD_RANGE", error: "range must be one of " + RANGES.join(", ") }, 400);

      if (!env.COINGLASS_API_KEY) {
        return reply({ ok: false, code: "NO_KEY", error: "The CoinGlass API key (COINGLASS_API_KEY) has not been added to this Worker yet." }, 503);
      }

      try {
        const upstream = await fetch(API + "?symbol=BTC&range=" + range, {
          headers: { accept: "application/json", "CG-API-KEY": env.COINGLASS_API_KEY },
          cf: { cacheTtl: 5, cacheEverything: true }
        });
        let body = null;
        try { body = await upstream.json(); } catch (e) { body = null; }

        if (!upstream.ok || !body || String(body.code) !== "0" || !body.data) {
          return reply({
            ok: false,
            code: "UPSTREAM",
            error: (body && body.msg) ? String(body.msg) : "CoinGlass returned HTTP " + upstream.status
          }, 502);
        }

        const d = body.data;
        const list = Array.isArray(d.exchange_list) ? d.exchange_list : [];
        return reply({
          ok: true,
          source: "CoinGlass",
          symbol: d.symbol || "BTC",
          range: range,
          fetchedAt: Date.now(),
          total: {
            buyRatio: num(d.buy_ratio),
            sellRatio: num(d.sell_ratio),
            buyUsd: num(d.buy_vol_usd),
            sellUsd: num(d.sell_vol_usd)
          },
          exchanges: list.map(r => ({
            exchange: String(r.exchange),
            buyRatio: num(r.buy_ratio),
            sellRatio: num(r.sell_ratio),
            buyUsd: num(r.buy_vol_usd),
            sellUsd: num(r.sell_vol_usd)
          }))
        });
      } catch (e) {
        return reply({ ok: false, code: "FETCH", error: "Could not reach CoinGlass: " + String((e && e.message) || e) }, 502);
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return reply({ ok: false, code: "NOT_FOUND", error: "Not found" }, 404);
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/taker" && request.method === "OPTIONS") {
      return withCors(request, new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "600" }
      }));
    }
    const res = await handler.fetch(request, env);
    return url.pathname === "/api/taker" ? withCors(request, res) : res;
  }
};
