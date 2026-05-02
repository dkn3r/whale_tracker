import { fetchAddress } from './data.js';
import { shortHash, shortAddr, amtClass, fmtDate, normHash } from './utils.js';

let miniChart = null;

/** Open the profiler modal for a given Ethereum address. */
export async function openProfiler(addr) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('open');
  document.getElementById('modal-addr-full').textContent = addr;

  // Clear previous content while loading
  ['p-txcount', 'p-vol', 'p-max', 'p-first', 'p-last'].forEach(
    (id) => { document.getElementById(id).textContent = '…'; },
  );
  document.getElementById('p-tx-list').innerHTML = '';

  try {
    const d = await fetchAddress(addr);

    document.getElementById('p-txcount').textContent = d.sent_count;
    document.getElementById('p-vol').textContent     = `${d.sent_volume.toFixed(2)} ETH`;
    document.getElementById('p-max').textContent     = `${d.max_amount.toFixed(2)} ETH`;
    document.getElementById('p-first').textContent   = d.first_seen ? fmtDate(d.first_seen) + ' UTC' : '—';
    document.getElementById('p-last').textContent    = d.last_seen  ? fmtDate(d.last_seen)  + ' UTC' : '—';

    _renderMiniChart(d.daily_activity);
    _renderRecentTxs(d.recent_txs);
  } catch (err) {
    console.error('Profiler fetch error:', err);
  }
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ── Internal helpers ──────────────────────────────────────────

function _renderMiniChart(dailyActivity) {
  if (miniChart) { miniChart.destroy(); miniChart = null; }

  const pc   = document.getElementById('p-chart').getContext('2d');
  const grad = pc.createLinearGradient(0, 0, 0, 80);
  grad.addColorStop(0, 'rgba(0,255,170,.3)');
  grad.addColorStop(1, 'rgba(0,255,170,0)');

  miniChart = new Chart(pc, {
    type: 'bar',
    data: {
      labels:   dailyActivity.map((d) => {
        const dt = new Date(d.date);
        return dt.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      }),
      datasets: [{
        data:            dailyActivity.map((d) => d.count),
        backgroundColor: grad,
        borderColor:     '#00ffaa',
        borderWidth:     1,
        borderRadius:    3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0b1020', callbacks: { label: (c) => ` ${c.parsed.y} txs` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 7 } },
        y: { grid: { color: '#1a254040' }, ticks: { font: { size: 9 } } },
      },
    },
  });
}

function _renderRecentTxs(txs) {
  const container = document.getElementById('p-tx-list');
  if (!txs || txs.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px 0">No transactions found</div>';
    return;
  }
  container.innerHTML = txs.map((tx) => `
    <div class="profile-tx-row" style="cursor:pointer"
         onclick="window.open('https://etherscan.io/tx/${normHash(tx.hash)}','_blank')">
      <a href="https://etherscan.io/tx/${normHash(tx.hash)}" target="_blank"
         onclick="event.stopPropagation()"
         style="color:var(--cyan);font-size:10px;text-decoration:none">${shortHash(tx.hash)}</a>
      <span class="${amtClass(tx.amount)}">${(+tx.amount).toFixed(2)} ETH</span>
      <span class="time-cell">${fmtDate(tx.time)}</span>
    </div>`).join('');
}
