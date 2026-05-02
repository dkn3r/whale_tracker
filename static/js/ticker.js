import { shortAddr, normHash } from './utils.js';

const ETHERSCAN = 'https://etherscan.io';

/**
 * Populate the scrolling ticker with the top 10 largest transactions
 * of the last hour. Each item is a clickable link to Etherscan.
 * @param {Array} topTxs - from /api/top-hourly
 */
export function initTicker(topTxs) {
  renderTicker(topTxs);
}

export function updateTicker(topTxs) {
  renderTicker(topTxs);
}

function renderTicker(topTxs) {
  if (!topTxs.length) return;

  const items = topTxs.map((tx, i) => {
    const cls = tx.amount >= 5000 ? 'xl' : tx.amount >= 1000 ? 'lg' : 'md';
    return `
      <a class="ticker-item ticker-link" href="${ETHERSCAN}/tx/${normHash(tx.hash)}" target="_blank" rel="noopener">
        <span class="t-rank">#${i + 1}</span>
        <span class="t-amt ${cls}">${tx.amount.toFixed(2)} Ξ</span>
        <span class="ticker-sep">·</span>
        <span style="color:var(--muted)">${shortAddr(tx.from)} → ${shortAddr(tx.to || '?')}</span>
        <span class="ticker-sep">·</span>
        <span class="t-hash">${(tx.hash||'').slice(0,10)}…</span>
      </a>`;
  }).join('');

  const track = document.getElementById('ticker-track');
  // Duplicate for seamless CSS loop
  track.innerHTML = items + items;
}
