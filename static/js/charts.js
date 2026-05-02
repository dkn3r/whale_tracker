import { BUCKET_LABELS, BUCKET_COLORS, CHART_COLORS, ANOMALY_TX_PER_BUCKET } from './config.js';

// ── Chart.js defaults ─────────────────────────────────────────
Chart.defaults.color       = '#4a5568';
Chart.defaults.borderColor = '#1a2540';
Chart.defaults.font.family = "'Share Tech Mono', monospace";

const TT = {
  backgroundColor: '#0b1020',
  borderWidth: 1,
  titleColor: '#c8d8f0',
  bodyColor:  '#c8d8f0',
};

// ── Module state ──────────────────────────────────────────────
let chart1, chart2;
let anomalyOn   = false;
let priceOn     = false;
let _priceData  = [];

// ── CHART 1 — TX Count (5-min buckets, last hour) ─────────────
export function initChart1(minutelyData) {
  const ctx  = document.getElementById('chart1').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(0,255,170,.35)');
  grad.addColorStop(1, 'rgba(0,255,170,0)');

  chart1 = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'TX Count', data: [], backgroundColor: [], borderColor: [], borderWidth: 1.5, borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TT, borderColor: '#00ffaa44', titleColor: CHART_COLORS.green,
          callbacks: {
            label:      (c) => ` ${c.parsed.y} transactions`,
            afterLabel: (c) => {
              if (!anomalyOn) return '';
              const counts = chart1.data.datasets[0].data;
              return counts[c.dataIndex] > ANOMALY_TX_PER_BUCKET
                ? '  ⚠ Anomaly: exceeds 1 000 tx/hr rate' : '';
            },
          },
        },
      },
      scales: {
        x: { grid: { color: '#1a254040' }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#1a254040' }, ticks: { font: { size: 10 } } },
      },
    },
  });
  _applyChart1(minutelyData);
}

export function updateChart1(minutelyData) { _applyChart1(minutelyData); }

function _applyChart1(data) {
  if (!chart1) return;
  // Always show 12 buckets — fill with zeros if no data
  const filled = data && data.length
    ? data
    : Array.from({length: 12}, (_, i) => ({ label: `--:${String(i*5).padStart(2,'0')}`, count: 0, volume: 0 }));

  const counts    = filled.map((d) => d.count);
  const anomalies = counts.map((v) => v > ANOMALY_TX_PER_BUCKET);
  const anomCount = anomalies.filter(Boolean).length;

  chart1.data.labels                      = filled.map((d) => d.label);
  chart1.data.datasets[0].data            = counts;
  chart1.data.datasets[0].backgroundColor = counts.map((_, i) =>
    anomalyOn && anomalies[i] ? 'rgba(255,51,102,.5)' : 'rgba(0,255,170,.28)');
  chart1.data.datasets[0].borderColor     = counts.map((_, i) =>
    anomalyOn && anomalies[i] ? '#ff3366' : '#00ffaa');
  chart1.update('none');

  // Badge
  const badge = document.getElementById('anomaly-badge');
  badge.style.display = anomalyOn && anomCount > 0 ? 'inline-flex' : 'none';
  document.getElementById('anomaly-count').textContent = anomCount;
}

export function toggleAnomaly(minutelyData) {
  anomalyOn = !anomalyOn;
  document.getElementById('anomaly-toggle').classList.toggle('on', anomalyOn);
  _applyChart1(minutelyData);
}

// ── CHART 2 — ETH Volume (5-min, last hour) + price overlay ───
export function initChart2(minutelyData, correlationData) {
  _priceData = correlationData;
  const ctx  = document.getElementById('chart2').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(0,212,255,.35)');
  grad.addColorStop(1, 'rgba(0,212,255,0)');

  chart2 = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'ETH Volume', data: [], fill: true, backgroundColor: grad,
          borderColor: CHART_COLORS.cyan, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .4, yAxisID: 'y' },
        { label: 'ETH Price',  data: [], fill: false, borderColor: CHART_COLORS.orange,
          borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, tension: .4, yAxisID: 'y2', hidden: true },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TT, borderColor: '#00d4ff44',
          callbacks: { label: (c) => c.datasetIndex === 0
            ? ` ${c.parsed.y.toFixed(2)} Ξ`
            : ` $${c.parsed.y.toLocaleString()}` },
        },
      },
      scales: {
        x:  { grid: { color: '#1a254040' }, ticks: { font: { size: 10 } } },
        y:  { position: 'left',  grid: { color: '#1a254040' },
              ticks: { font: { size: 10 }, callback: (v) => v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(2) } },
        y2: { position: 'right', display: false, grid: { display: false },
              ticks: { font: { size: 10 }, color: CHART_COLORS.orange, callback: (v) => '$'+v.toLocaleString() } },
      },
    },
  });
  _applyChart2(minutelyData);
}

export function updateChart2(minutelyData) { _applyChart2(minutelyData); }

function _applyChart2(data) {
  if (!chart2) return;
  const filled = data && data.length
    ? data
    : Array.from({length: 12}, (_, i) => ({ label: `--:${String(i*5).padStart(2,'0')}`, count: 0, volume: 0 }));
  const latestPrices = _priceData.slice(-12).map((d) => d.price);
  chart2.data.labels                       = filled.map((d) => d.label);
  chart2.data.datasets[0].data             = filled.map((d) => +d.volume.toFixed(2));
  chart2.data.datasets[1].data             = latestPrices;
  chart2.data.datasets[1].hidden           = !priceOn;
  chart2.options.scales.y2.display         = priceOn;
  chart2.update('none');
}

export function togglePriceOverlay(minutelyData) {
  priceOn = !priceOn;
  document.getElementById('price-toggle').classList.toggle('on', priceOn);
  _applyChart2(minutelyData);
}

// ── CHART 3 — TX size distribution (donut) ────────────────────
export function initChart3(transactions) {
  // Dynamic buckets: 100-500, 500-1000, 1000-5000, 5000+
  // (0-100 hidden as bot only records whale txs)
  const labels  = ['100–500', '500–1000', '1000–5000', '5000+'];
  const colors  = ['#00d4ff', '#a855f7', '#ff8c00', '#ff3366'];
  const buckets = [0, 0, 0, 0];

  transactions.forEach((t) => {
    const a = t.amount;
    if      (a < 500)   buckets[0]++;
    else if (a < 1000)  buckets[1]++;
    else if (a < 5000)  buckets[2]++;
    else                buckets[3]++;
  });

  // Only show buckets that have data
  const filtered = labels.map((l, i) => ({ label: l, color: colors[i], count: buckets[i] }))
                         .filter(b => b.count > 0);

  new Chart(document.getElementById('chart3'), {
    type: 'doughnut',
    data: {
      labels: filtered.map(b => b.label),
      datasets: [{
        data: filtered.map(b => b.count),
        backgroundColor: filtered.map(b => b.color + '30'),
        borderColor: filtered.map(b => b.color),
        borderWidth: 2,
        hoverBackgroundColor: filtered.map(b => b.color + '66'),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { display: true, position: 'right', labels: { color: '#5a6a8a', font: { size: 10 }, boxWidth: 12, padding: 10 } },
        tooltip: { ...TT, callbacks: {
          label: (c) => ` ${c.parsed} txs`,
          title: (c) => `${c[0].label} ETH`,
        }},
      },
    },
  });
}

// ── CHART CORR — 30-day price vs volume ───────────────────────
export function initChartCorr(correlationData) {
  const labels  = correlationData.map((d) => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  });
  const hasPrice = correlationData.some((d) => d.price !== null);

  new Chart(document.getElementById('chart-corr'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'ETH Price',    data: correlationData.map((d) => d.price),
          fill: false, borderColor: CHART_COLORS.orange, borderWidth: 2, pointRadius: 2, tension: .4,
          yAxisID: 'yP', hidden: !hasPrice },
        { label: 'Whale Volume', data: correlationData.map((d) => +d.volume.toFixed(2)),
          fill: true, backgroundColor: 'rgba(168,85,247,.14)',
          borderColor: CHART_COLORS.purple, borderWidth: 2, pointRadius: 2, tension: .4, yAxisID: 'yV' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { ...TT, borderColor: '#1a254080',
          callbacks: { label: (c) => c.datasetIndex === 0
            ? ` ETH: $${c.parsed.y.toLocaleString()}`
            : ` Volume: ${c.parsed.y.toFixed(2)} Ξ` } },
      },
      scales: {
        x:  { grid: { color: '#1a254030' }, ticks: { font: { size: 10 }, maxTicksLimit: 10 } },
        yP: { position: 'left',  display: hasPrice, grid: { color: '#1a254030' },
              ticks: { font: { size: 10 }, color: CHART_COLORS.orange, callback: (v) => '$'+v.toLocaleString() } },
        yV: { position: 'right', grid: { display: false },
              ticks: { font: { size: 10 }, color: CHART_COLORS.purple,
                       callback: (v) => v >= 1000 ? (v/1000).toFixed(1)+'k Ξ' : v.toFixed(2)+' Ξ' } },
      },
    },
  });
}
