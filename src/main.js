import { getMetaAndCtxs, getPredicted, getHistory } from './api.js';
import { buildRows, topBottom, parsePredicted, venueSpread, summarizeHistory,
  checkAlerts, fmtPct, fmtUsd } from './transform.js';
import { renderChart } from './chart.js';

const $ = (s) => document.querySelector(s);
const state = { rows: [], predicted: {}, sort: 'oiUsd', dir: -1 };
const VENUE = { BinPerp: 'Binance', BybitPerp: 'Bybit', HlPerp: 'Hyperliquid' };

function settings() {
  return {
    highApr: Number($('#high').value) / 100,
    lowApr: Number($('#low').value) / 100,
    minOiUsd: Number($('#minoi').value) * 1e6,
  };
}

function cls(x) { return x > 0 ? 'pos' : x < 0 ? 'neg' : ''; }

function renderLists() {
  const { minOiUsd } = settings();
  const { positive, negative } = topBottom(state.rows, 8, minOiUsd);
  const li = (r) => `<li><a href="#" data-coin="${r.coin}">${r.coin}</a><span class="${cls(r.apr)}">${fmtPct(r.apr, 1)}</span></li>`;
  $('#top-pos').innerHTML = positive.map(li).join('');
  $('#top-neg').innerHTML = negative.map(li).join('');
}

function renderAlerts() {
  const alerts = checkAlerts(state.rows, settings());
  $('#alerts').innerHTML = alerts.length
    ? alerts.slice(0, 20).map((a) => `<span class="chip ${a.kind}">${a.coin} ${fmtPct(a.apr, 0)}</span>`).join('')
    : '<span class="muted">No coins beyond thresholds.</span>';
  const prev = JSON.parse(localStorage.getItem('hlfd-alerted') || '[]');
  const fresh = alerts.filter((a) => !prev.includes(a.coin));
  if (fresh.length && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('Funding alert', { body: fresh.map((a) => `${a.coin} ${fmtPct(a.apr, 0)}`).join(', ') });
  }
  localStorage.setItem('hlfd-alerted', JSON.stringify(alerts.map((a) => a.coin)));
}

function renderTable() {
  const q = $('#search').value.trim().toUpperCase();
  const { minOiUsd } = settings();
  const rows = state.rows
    .filter((r) => r.oiUsd >= minOiUsd && (!q || r.coin.includes(q)))
    .sort((a, b) => (a[state.sort] > b[state.sort] ? 1 : -1) * state.dir);
  $('#tbody').innerHTML = rows.map((r) => {
    const sp = venueSpread(state.predicted[r.coin]);
    return `<tr data-coin="${r.coin}"><td>${r.coin}</td>
      <td class="${cls(r.funding)}">${fmtPct(r.funding, 4)}</td>
      <td class="${cls(r.apr)}">${fmtPct(r.apr, 1)}</td>
      <td>${fmtUsd(r.oiUsd)}</td><td>${fmtUsd(r.volumeUsd)}</td>
      <td>${sp ? `<span class="${cls(sp.spread)}">${fmtPct(sp.spread, 1)}</span> <small>vs ${VENUE[sp.venue] || sp.venue}</small>` : '–'}</td></tr>`;
  }).join('');
}

async function showCoin(coin) {
  $('#coin-title').textContent = `${coin} — funding APR, last 7 days`;
  $('#chart').innerHTML = '<p class="muted">Loading…</p>';
  try {
    const s = summarizeHistory(await getHistory(coin, 7));
    renderChart($('#chart'), s.points);
    const venues = state.predicted[coin] || {};
    const v = Object.entries(venues).map(([k, x]) => `${VENUE[k] || k}: <b class="${cls(x.apr)}">${fmtPct(x.apr, 1)}</b>`).join(' · ');
    $('#coin-stats').innerHTML = `7d mean APR <b class="${cls(s.meanApr)}">${fmtPct(s.meanApr, 1)}</b> · positive ${fmtPct(s.positiveShare, 0)} of hours${v ? `<br>Predicted next funding (annualized): ${v}` : ''}`;
  } catch (e) { $('#chart').innerHTML = `<p class="neg">${e.message}</p>`; }
}

function renderAll() { renderLists(); renderAlerts(); renderTable(); }

async function refresh() {
  $('#status').textContent = 'Refreshing…';
  try {
    const [m, p] = await Promise.all([getMetaAndCtxs(), getPredicted().catch(() => [])]);
    state.rows = buildRows(m);
    state.predicted = parsePredicted(p);
    renderAll();
    $('#status').textContent = `${state.rows.length} perps · updated ${new Date().toLocaleTimeString()}`;
  } catch (e) { $('#status').textContent = `Error: ${e.message}`; }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-coin]');
  if (el) { e.preventDefault(); showCoin(el.dataset.coin); }
  const th = e.target.closest('th[data-sort]');
  if (th) { const k = th.dataset.sort; state.dir = state.sort === k ? -state.dir : -1; state.sort = k; renderTable(); }
});
for (const id of ['#high', '#low', '#minoi']) {
  const el = $(id);
  el.value = localStorage.getItem(`hlfd${id}`) ?? el.value;
  el.addEventListener('change', () => { localStorage.setItem(`hlfd${id}`, el.value); renderAll(); });
}
$('#search').addEventListener('input', renderTable);
$('#notify').addEventListener('click', () => 'Notification' in window && Notification.requestPermission());

await refresh();
showCoin('BTC');
setInterval(refresh, 60_000);
