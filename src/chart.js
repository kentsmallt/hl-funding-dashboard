// Minimal dependency-free SVG line chart for funding history.
export function renderChart(el, points, { width = 860, height = 260 } = {}) {
  if (!points.length) { el.innerHTML = '<p class="muted">No history.</p>'; return; }
  const pad = { l: 64, r: 12, t: 12, b: 28 };
  const xs = points.map((p) => p.t), ys = points.map((p) => p.rate * 8760 * 100);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(0, ...ys), y1 = Math.max(0, ...ys) || 1;
  const X = (t) => pad.l + ((t - x0) / (x1 - x0 || 1)) * (width - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join('');
  const ticks = [y0, (y0 + y1) / 2, y1].map((v) =>
    `<text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(1)}%</text>`).join('');
  const d = (t) => new Date(t).toISOString().slice(5, 10);
  el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="Funding APR history">
    <line x1="${pad.l}" x2="${width - pad.r}" y1="${Y(0)}" y2="${Y(0)}" class="zero"/>
    <path d="${path}" class="line"/>${ticks}
    <text x="${pad.l}" y="${height - 6}">${d(x0)}</text>
    <text x="${width - pad.r}" y="${height - 6}" text-anchor="end">${d(x1)}</text></svg>`;
}
