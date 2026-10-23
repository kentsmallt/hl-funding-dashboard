// Pure data-transform helpers (no DOM, no network) so they can be unit tested.
export const HOURS_PER_YEAR = 24 * 365;

/** Hourly funding rate -> annualized APR (fraction). */
export function annualize(rate, intervalHours = 1) {
  const r = Number(rate);
  if (!Number.isFinite(r) || intervalHours <= 0) return NaN;
  return (r / intervalHours) * HOURS_PER_YEAR;
}

/** Normalize the `metaAndAssetCtxs` response into one row per live perp. */
export function buildRows(metaAndCtxs) {
  if (!Array.isArray(metaAndCtxs) || metaAndCtxs.length < 2) return [];
  const [meta, ctxs] = metaAndCtxs;
  const rows = [];
  (meta.universe || []).forEach((asset, i) => {
    const c = ctxs[i];
    if (!c || asset.isDelisted) return;
    const funding = Number(c.funding);
    const mark = Number(c.markPx);
    const oiCoins = Number(c.openInterest);
    rows.push({
      coin: asset.name,
      maxLeverage: asset.maxLeverage,
      funding,
      apr: annualize(funding, 1),
      markPx: mark,
      oiUsd: oiCoins * mark,
      volumeUsd: Number(c.dayNtlVlm),
      premium: c.premium == null ? NaN : Number(c.premium),
    });
  });
  return rows.filter((r) => Number.isFinite(r.funding));
}

/** Top-N most positive and most negative funding rows. */
export function topBottom(rows, n = 10, minOiUsd = 0) {
  const eligible = rows.filter((r) => r.oiUsd >= minOiUsd);
  const sorted = [...eligible].sort((a, b) => b.funding - a.funding);
  return {
    positive: sorted.filter((r) => r.funding > 0).slice(0, n),
    negative: sorted.filter((r) => r.funding < 0).reverse().slice(0, n),
  };
}

/** Normalize `predictedFundings` into { coin: { venue: {rate, apr, intervalHours} } }. */
export function parsePredicted(resp) {
  const out = {};
  if (!Array.isArray(resp)) return out;
  for (const [coin, venues] of resp) {
    out[coin] = {};
    for (const [venue, v] of venues || []) {
      if (!v) continue;
      const h = Number(v.fundingIntervalHours) || 1;
      out[coin][venue] = {
        rate: Number(v.fundingRate),
        intervalHours: h,
        apr: annualize(v.fundingRate, h),
      };
    }
  }
  return out;
}

/** Largest APR spread between Hyperliquid and another venue for a coin. */
export function venueSpread(venues) {
  const hl = venues && venues.HlPerp;
  if (!hl) return null;
  let best = null;
  for (const [name, v] of Object.entries(venues)) {
    if (name === 'HlPerp' || !Number.isFinite(v.apr)) continue;
    const spread = hl.apr - v.apr;
    if (!best || Math.abs(spread) > Math.abs(best.spread)) best = { venue: name, spread };
  }
  return best;
}

/** Normalize `fundingHistory` into sorted points + summary stats. */
export function summarizeHistory(hist) {
  const points = (Array.isArray(hist) ? hist : [])
    .map((h) => ({ t: Number(h.time), rate: Number(h.fundingRate) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.rate))
    .sort((a, b) => a.t - b.t);
  if (!points.length) return { points, mean: NaN, meanApr: NaN, positiveShare: NaN };
  const mean = points.reduce((s, p) => s + p.rate, 0) / points.length;
  return {
    points,
    mean,
    meanApr: annualize(mean, 1),
    positiveShare: points.filter((p) => p.rate > 0).length / points.length,
  };
}

/** Rows whose |APR| crosses the user's thresholds (fractions, e.g. 0.5 = 50%). */
export function checkAlerts(rows, { highApr = 0.5, lowApr = -0.25, minOiUsd = 0 } = {}) {
  return rows
    .filter((r) => r.oiUsd >= minOiUsd && (r.apr >= highApr || r.apr <= lowApr))
    .map((r) => ({ coin: r.coin, apr: r.apr, kind: r.apr >= highApr ? 'high' : 'low' }))
    .sort((a, b) => Math.abs(b.apr) - Math.abs(a.apr));
}

export function fmtPct(x, digits = 2) {
  return Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : '–';
}

export function fmtUsd(x) {
  if (!Number.isFinite(x)) return '–';
  const a = Math.abs(x);
  if (a >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(x / 1e3).toFixed(1)}K`;
  return `$${x.toFixed(0)}`;
}
