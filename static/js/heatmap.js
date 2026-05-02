import { HEATMAP_COLORS } from './config.js';

/**
 * Render the yearly activity heatmap.
 * @param {Array<{date:string, count:number, volume:number}>} data
 */
export function initHeatmap(data) {
  // Build lookup: "YYYY-MM-DD" → { count, volume }
  const dayMap = Object.fromEntries(data.map((d) => [d.date, d]));
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const color = (count) => {
    if (!count) return HEATMAP_COLORS[0];
    return HEATMAP_COLORS[Math.min(4, Math.ceil((count / maxCount) * 4))];
  };

  // Legend
  const legendEl = document.getElementById('hm-legend');
  HEATMAP_COLORS.forEach((c) => {
    const cell = document.createElement('div');
    cell.className = 'hm-legend-cell';
    cell.style.background = c;
    legendEl.appendChild(cell);
  });

  // Grid: 53 weeks × 7 days, starting from 364 days ago (aligned to Sunday)
  const grid    = document.getElementById('heatmap-grid');
  const months  = document.getElementById('heatmap-months');
  const tooltip = document.getElementById('hm-tooltip');
  const start   = new Date(Date.now() - 364 * 86400000);
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  let lastMonth = -1;

  for (let w = 0; w < 53; w++) {
    const col     = document.createElement('div');
    col.className = 'heatmap-col';

    // Month label slot above each column
    const ml      = document.createElement('div');
    ml.className  = 'hm-month-label';
    const wDate   = new Date(start.getTime() + w * 7 * 86400000);
    if (wDate.getMonth() !== lastMonth) {
      ml.textContent = wDate.toLocaleDateString('en', { month: 'short' });
      lastMonth = wDate.getMonth();
    }
    months.appendChild(ml);

    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 86400000);

      // Placeholder for future dates
      if (date > new Date()) {
        const sp   = document.createElement('div');
        sp.style.height = '12px';
        col.appendChild(sp);
        continue;
      }

      const key  = date.toISOString().slice(0, 10);
      const info = dayMap[key] || { count: 0, volume: 0 };
      const cell = document.createElement('div');
      cell.className      = 'heatmap-cell';
      cell.style.background = color(info.count);
      if (info.count > 0) cell.style.boxShadow = `0 0 4px ${color(info.count)}66`;

      cell.addEventListener('mousemove', (e) => {
        tooltip.style.display = 'block';
        tooltip.style.left    = `${e.clientX + 12}px`;
        tooltip.style.top     = `${e.clientY - 36}px`;
        tooltip.innerHTML     =
          `<b style="color:var(--cyan)">${key}</b><br>` +
          `${info.count} txs · ${Math.round(info.volume).toLocaleString()} Ξ`;
      });
      cell.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}
