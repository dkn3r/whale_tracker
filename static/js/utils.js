/** Normalize hash — strip duplicate 0x prefix if present */
export const normHash = (h) => {
  if (!h) return '';
  const s = String(h);
  // Remove duplicate 0x0x... prefix
  return s.startsWith('0x0x') ? '0x' + s.slice(4) : s;
};

/** Shorten a TX hash:  0xabcd…1234 */
export const shortHash = (h) => { const n = normHash(h); return `${n.slice(0, 8)}…${n.slice(-5)}`; };

/** Shorten an address: 0xabcd…ef12 */
export const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** ISO string → "2024-01-15 13:42" */
export const fmtDate = (iso) => (iso || '').replace('T', ' ').slice(0, 16);

/** CSS class for an ETH amount cell */
export const amtClass = (v) =>
  v >= 1500 ? 'amount-cell amount-xl' :
  v >= 500  ? 'amount-cell amount-lg' :
              'amount-cell amount-md';

/** Classify amount for ticker badge */
export const amtTier = (v) => v >= 1500 ? 'xl' : v >= 500 ? 'lg' : 'md';

/** Compute anomaly flags: hours > mean + 1.5σ */
export function detectAnomalies(counts) {
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const std  = Math.sqrt(counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length);
  return counts.map((v) => v > mean + 1.5 * std);
}
