import test from 'node:test';
import assert from 'node:assert/strict';
import { annualize, buildRows, topBottom, parsePredicted, venueSpread,
  summarizeHistory, checkAlerts, fmtPct, fmtUsd } from '../src/transform.js';

const meta = [
  { universe: [
    { name: 'BTC', maxLeverage: 40 },
    { name: 'OLD', maxLeverage: 5, isDelisted: true },
    { name: 'DOGE', maxLeverage: 10 },
    { name: 'XYZ', maxLeverage: 3 },
  ] },
  [
    { funding: '0.0000125', markPx: '100000', openInterest: '10', dayNtlVlm: '5e8', premium: '0.0001' },
    { funding: '0.01', markPx: '1', openInterest: '1', dayNtlVlm: '0' },
    { funding: '-0.0001', markPx: '0.2', openInterest: '1e8', dayNtlVlm: '1e7' },
    { funding: '0.0002', markPx: '2', openInterest: '100', dayNtlVlm: '1' },
  ],
];

test('annualize hourly and multi-hour rates', () => {
  assert.ok(Math.abs(annualize(0.0000125) - 0.1095) < 1e-9);
  assert.ok(Math.abs(annualize('0.00005', 4) - 0.1095) < 1e-9);
  assert.ok(Number.isNaN(annualize('x')));
  assert.ok(Number.isNaN(annualize(0.01, 0)));
});

test('buildRows skips delisted and computes OI in USD', () => {
  const rows = buildRows(meta);
  assert.deepEqual(rows.map((r) => r.coin), ['BTC', 'DOGE', 'XYZ']);
  assert.equal(rows[0].oiUsd, 1e6);
  assert.equal(rows[1].oiUsd, 2e7);
  assert.deepEqual(buildRows(null), []);
});

test('topBottom splits by sign and respects min OI', () => {
  const rows = buildRows(meta);
  const { positive, negative } = topBottom(rows, 5);
  assert.deepEqual(positive.map((r) => r.coin), ['XYZ', 'BTC']);
  assert.deepEqual(negative.map((r) => r.coin), ['DOGE']);
  assert.deepEqual(topBottom(rows, 5, 1e5).positive.map((r) => r.coin), ['BTC']);
});

test('parsePredicted + venueSpread', () => {
  const p = parsePredicted([
    ['ETH', [['BinPerp', { fundingRate: '0.0001', fundingIntervalHours: 8 }],
             ['HlPerp', { fundingRate: '0.00005', fundingIntervalHours: 1 }],
             ['BybitPerp', null]]],
  ]);
  assert.ok(Math.abs(p.ETH.BinPerp.apr - 0.1095) < 1e-9);
  assert.equal(p.ETH.BybitPerp, undefined);
  const s = venueSpread(p.ETH);
  assert.equal(s.venue, 'BinPerp');
  assert.ok(Math.abs(s.spread - (0.438 - 0.1095)) < 1e-9);
  assert.equal(venueSpread({}), null);
});

test('summarizeHistory sorts and averages', () => {
  const s = summarizeHistory([
    { time: 2, fundingRate: '-0.0001' }, { time: 1, fundingRate: '0.0003' }, { time: 3, fundingRate: 'bad' },
  ]);
  assert.deepEqual(s.points.map((p) => p.t), [1, 2]);
  assert.ok(Math.abs(s.mean - 0.0001) < 1e-12);
  assert.equal(s.positiveShare, 0.5);
  assert.ok(Number.isNaN(summarizeHistory([]).mean));
});

test('checkAlerts flags both directions, sorted by magnitude', () => {
  const a = checkAlerts(buildRows(meta), { highApr: 0.5, lowApr: -0.5, minOiUsd: 0 });
  assert.deepEqual(a.map((x) => [x.coin, x.kind]), [['XYZ', 'high'], ['DOGE', 'low']]);
});

test('formatters', () => {
  assert.equal(fmtPct(0.1234, 1), '12.3%');
  assert.equal(fmtPct(NaN), '–');
  assert.equal(fmtUsd(2.5e9), '$2.50B');
  assert.equal(fmtUsd(-3.2e6), '$-3.20M');
  assert.equal(fmtUsd(1500), '$1.5K');
});
