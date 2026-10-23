// Optional smoke test against the real public API: `LIVE=1 npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getMetaAndCtxs, getPredicted, getHistory } from '../src/api.js';
import { buildRows, parsePredicted, summarizeHistory } from '../src/transform.js';

test('live Hyperliquid API', { skip: !process.env.LIVE }, async () => {
  const rows = buildRows(await getMetaAndCtxs());
  assert.ok(rows.length > 50);
  assert.ok(rows.find((r) => r.coin === 'BTC').oiUsd > 1e8);
  const p = parsePredicted(await getPredicted());
  assert.ok(p.BTC && p.BTC.HlPerp);
  const h = summarizeHistory(await getHistory('BTC', 2));
  assert.ok(h.points.length > 20);
});
