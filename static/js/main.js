import {
  fetchStats, fetchWotd, fetchTopHourly, fetchTransactions,
  fetchMinutely, fetchHeatmap, fetchLeaderboard, fetchCorrelation, fetchNetwork,
  fetchLargestEver, fetchTransactionsMonth,
} from './data.js';

import { initTicker, updateTicker }                                      from './ticker.js';
import { initChart1, initChart2, initChart3, initChartCorr,
         updateChart1, updateChart2, toggleAnomaly, togglePriceOverlay } from './charts.js';
import { initHeatmap }                                                   from './heatmap.js';
import { initNetwork }                                                   from './network.js';
import { openProfiler, closeModal }                                      from './profiler.js';
import { shortAddr, shortHash, normHash, amtClass, fmtDate }                      from './utils.js';
import { PERIODS, FILTER_PRESETS, POLL_INTERVAL_MS }                    from './config.js';

const ETHERSCAN = 'https://etherscan.io';

let th1 = FILTER_PRESETS[0];
let th2 = FILTER_PRESETS[0];
let th3 = FILTER_PRESETS[0];
let th4 = FILTER_PRESETS[0];  // leaderboard threshold
let currentMinutely1 = [];
let currentMinutely2 = [];

// ── safe fetch — never throws, returns fallback on error ──────
async function safe(promise, fallback, label) {
  try {
    return await promise;
  } catch (e) {
    console.warn(`[${label}] failed:`, e.message);
    return fallback;
  }
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  showLoader(true);

  const [stats, largestEver, wotd, topHourly, transactions, chart3Txs, minutely, heatmapData, correlation, network] =
    await Promise.all([
      safe(fetchStats(),                  {total_txs:0,total_volume:0,max_amount:0,txs_1h:0,volume_1h:0,senders_1h:0},  'stats'),
      safe(fetchLargestEver(),           {},           'largest-ever'),
      safe(fetchWotd(),                   {},           'wotd'),
      safe(fetchTopHourly(10),            [],           'top-hourly'),
      safe(fetchTransactions(th1, 60),    [],           'transactions'),
      safe(fetchTransactionsMonth(500),      [],           'chart3-txs'),
      safe(fetchMinutely(th1),            [],           'minutely'),
      safe(fetchHeatmap(),                [],           'heatmap'),
      safe(fetchCorrelation(30),          [],           'correlation'),
      safe(fetchNetwork(10),              {nodes:[],edges:[]}, 'network'),
    ]);

  currentMinutely1 = minutely;
  currentMinutely2 = minutely;

  renderStats(stats);
  renderLargestEver(largestEver);
  renderWotd(wotd);
  initTicker(topHourly);

  // Charts — only init if Chart.js is loaded
  if (typeof Chart !== 'undefined') {
    initChart1(minutely);
    initChart2(minutely, correlation);
    initChart3(chart3Txs.length ? chart3Txs : transactions);
    initChartCorr(correlation);
  } else {
    console.error('Chart.js not loaded');
  }

  if (typeof d3 !== 'undefined') {
    if (heatmapData.length) initHeatmap(heatmapData);
    if (network.nodes.length) initNetwork(network, openProfiler);
  }

  renderTable(transactions);
  renderLeaderboard();
  wireEvents();
  showLoader(false);
  startPolling();
}

// ── LOADING OVERLAY ───────────────────────────────────────────
function showLoader(on) {
  let el = document.getElementById('page-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'page-loader';
    el.innerHTML = '<div class="loader-inner"><div class="loader-whale">🐋</div><div class="loader-text">Loading data…</div></div>';
    document.body.appendChild(el);
  }
  el.style.display = on ? 'flex' : 'none';
}

// ── WIRE UI EVENTS ────────────────────────────────────────────
function wireEvents() {
  bindFilters('f1', async (v) => {
    th1 = v;
    currentMinutely1 = await safe(fetchMinutely(v), [], 'minutely-f1');
    updateChart1(currentMinutely1);
  });
  bindFilters('f2', async (v) => {
    th2 = v;
    currentMinutely2 = await safe(fetchMinutely(v), [], 'minutely-f2');
    updateChart2(currentMinutely2);
  });
  bindFilters('f3', async (v) => {
    th3 = v;
    const txs = await safe(fetchTransactions(v), [], 'tx-filter');
    renderTable(txs);
  });
  bindFilters('f4', async (v) => {
    th4 = v;
    await renderLeaderboard(v);
  });

  document.getElementById('anomaly-toggle')
    .addEventListener('click', () => toggleAnomaly(currentMinutely1));
  document.getElementById('price-toggle')
    .addEventListener('click', () => togglePriceOverlay(currentMinutely2));

  document.getElementById('anomaly-info-btn')
    .addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('anomaly-info-popup').classList.toggle('visible');
    });
  document.addEventListener('click', () =>
    document.getElementById('anomaly-info-popup')?.classList.remove('visible'));

  document.getElementById('modal-close')
    .addEventListener('click', closeModal);
  document.getElementById('modal-overlay')
    .addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });

  document.getElementById('wotd-etherscan')
    .addEventListener('click', () => {
      const hash = document.getElementById('wotd-etherscan').dataset.hash;
      if (hash) window.open(`${ETHERSCAN}/tx/${normHash(hash)}`, '_blank');
    });
  document.getElementById('wotd-addr')
    .addEventListener('click', () => {
      const addr = document.getElementById('wotd-addr').dataset.addr;
      if (addr) openProfiler(addr);
    });
}

// ── POLLING ───────────────────────────────────────────────────
function startPolling() {
  setInterval(async () => {
    const [stats, wotd, topHourly, m1, m2, txs] = await Promise.all([
      safe(fetchStats(),              {total_txs:0,total_volume:0,max_amount:0,txs_1h:0,volume_1h:0,senders_1h:0}, 'poll-stats'),
      safe(fetchWotd(),               {},  'poll-wotd'),
      safe(fetchTopHourly(10),        [],  'poll-ticker'),
      safe(fetchMinutely(th1),        [],  'poll-m1'),
      safe(fetchMinutely(th2),        [],  'poll-m2'),
      safe(fetchTransactions(th3,60), [],  'poll-txs'),
    ]);
    currentMinutely1 = m1;
    currentMinutely2 = m2;
    renderStats(stats);
    renderWotd(wotd);
    updateTicker(topHourly);
    updateChart1(m1);
    updateChart2(m2);
    renderTable(txs);
  }, POLL_INTERVAL_MS);
}

// ── RENDERERS ─────────────────────────────────────────────────
function renderStats(s) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stat-total',   s.total_txs?.toLocaleString() ?? '—');
  set('stat-1h',      `${s.txs_1h ?? 0} txs`);
  set('stat-vol',     `${(+s.total_volume||0).toFixed(2)} Ξ`);
  set('stat-vol1h',   (+s.volume_1h||0).toFixed(2));
  // stat-max is owned by renderLargestEver — do not overwrite here
  set('stat-senders', s.senders_1h ?? '—');
}

function renderWotd(w) {
  if (!w?.address) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  document.getElementById('wotd-addr').dataset.addr  = w.address;
  document.getElementById('wotd-etherscan').dataset.hash = w.hash || '';
  set('wotd-addr',   shortAddr(w.address));
  set('wotd-amount', `${(+w.amount||0).toFixed(2)} Ξ`);
  set('wotd-time',   fmtDate(w.time) + ' UTC');
  set('wotd-total',  (+w.total_hour||0).toFixed(2));
  set('wotd-txc',    w.tx_count_hour ?? '—');
}


function renderLargestEver(d) {
  if (!d || !d.address) return;

  const el = (id) => document.getElementById(id);
  if (el('stat-max')) el('stat-max').textContent = `${(d.amount||0).toFixed(2)} ETH`;

  const addrEl = el('alltime-addr');
  if (addrEl) {
    addrEl.textContent  = shortAddr(d.address);
    addrEl.dataset.addr = d.address;
    addrEl.onclick = () => openProfiler(d.address);
  }

  // Expose as global functions for inline onclick in HTML
  window._profileAlltime = () => openProfiler(d.address);
  window._scanAlltime    = () => {
    if (d.hash) window.open(`https://etherscan.io/tx/${normHash(d.hash)}`, '_blank');
  };
}

function renderTable(txs) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('tbl-count', `${txs.length} rows`);
  const body = document.getElementById('tx-body');
  if (!body) return;
  body.innerHTML = txs.map((tx) => `
    <tr class="${tx.amount >= 5000 ? 'hot-row' : ''}"
        onclick="window.open('${ETHERSCAN}/tx/${normHash(tx.hash)}','_blank')">
      <td><a class="hash-cell" href="${ETHERSCAN}/tx/${normHash(tx.hash)}"
             target="_blank" onclick="event.stopPropagation()">${shortHash(tx.hash)}</a></td>
      <td class="${amtClass(tx.amount)}">${(+tx.amount).toFixed(2)} Ξ</td>
      <td><span class="addr-link"
               onclick="event.stopPropagation();window._openProfiler('${tx.from}')">${shortAddr(tx.from)}</span></td>
      <td><span class="addr-link"
               onclick="event.stopPropagation();window._openProfiler('${tx.to||''}')">${shortAddr(tx.to||'?')}</span></td>
      <td class="block-cell">${(tx.block||'').toLocaleString()}</td>
      <td class="time-cell">${fmtDate(tx.time)} UTC</td>
    </tr>`).join('');
}

async function renderLeaderboard(threshold = th4) {
  const grid = document.getElementById('leader-grid');
  if (!grid) return;

  // Show loading state
  grid.querySelectorAll('.leader-card').forEach(c => c.style.opacity = '0.4');

  const cards = await Promise.all(
    PERIODS.map(async ({ label, key }) => {
      const entries = await safe(fetchLeaderboard(key, 5, threshold), [], `lb-${key}`);
      const rows = entries.map(({ address, count, volume }, i) => `
        <div class="leader-entry" onclick="window._openProfiler('${address}')">
          <div class="rank rank-${i < 3 ? i+1 : 'n'}">${i+1}</div>
          <div class="leader-addr">${shortAddr(address)}</div>
          <div style="text-align:right">
            <div class="leader-count">${count} tx</div>
            <div style="font-size:10px;color:var(--muted)">${volume.toFixed(2)} Ξ</div>
          </div>
        </div>`).join('') || '<div style="color:var(--dim);font-size:11px;padding:8px 0">No data for this threshold</div>';
      return `<div class="leader-card"><div class="leader-period">${label}</div>${rows}</div>`;
    }),
  );
  grid.innerHTML = cards.join('');
}

function bindFilters(groupId, callback) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      callback(+btn.dataset.v);
    });
  });
}

window._openProfiler = openProfiler;
init();
