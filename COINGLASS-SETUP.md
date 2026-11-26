# CoinGlass proxy for BTC 5m dashboard

This Worker keeps the CoinGlass API key off the public GitHub Pages frontend.

## Deploy (one-time, no coding)

1. Open https://dash.cloudflare.com/ and create/sign in to an account.
2. Go to **Workers & Pages** → **Create** → **Create Worker**.
3. Name it `btc-coinglass-proxy`, then choose **Edit code**.
4. Replace the starter code with the contents of `coinglass-worker.js` from this repository, then **Deploy**.
5. Open the Worker **Settings** → **Variables and Secrets**.
6. Add a secret named `COINGLASS_API_KEY` with your newly rotated CoinGlass API key. Do not use the key previously pasted into chat.
7. Add a text variable named `ALLOWED_ORIGIN` with value `https://lexerito.github.io`.
8. Save/deploy. Your endpoint will be `https://btc-coinglass-proxy.<your-account-subdomain>.workers.dev/api/flow`.

## What it returns

The Worker calls CoinGlass V4 `/api/futures/coin/netflow` for BTC and aggregates Binance, Bybit and OKX. It returns the official rolling 5m, 15m and 1h taker-buy, taker-sell and net-flow values. CoinGlass defines net flow as taker buy minus taker sell. This is a rolling window snapshot, not a historical candle series.

## Important
- The Worker is the only place the API key is used.
- Do not paste the new key into GitHub, browser code, or chat.
- CoinGlass plan permissions determine whether this endpoint is available.
- Poll responsibly; the dashboard should not request faster than every 15 seconds.
