// Thin client for Hyperliquid's public, read-only info endpoint. No keys needed.
export const INFO_URL = 'https://api.hyperliquid.xyz/info';

async function post(body) {
  const res = await fetch(INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API ${res.status}`);
  return res.json();
}

export const getMetaAndCtxs = () => post({ type: 'metaAndAssetCtxs' });
export const getPredicted = () => post({ type: 'predictedFundings' });
export const getHistory = (coin, days = 7) =>
  post({ type: 'fundingHistory', coin, startTime: Date.now() - days * 864e5 });
