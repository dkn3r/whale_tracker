import { API_BASE } from './config.js';

// Fetch with 8-second timeout — never hangs forever
const get = async (path) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

export const fetchStats        = ()                             => get('/stats');
export const fetchLargestEver       = ()                        => get('/largest-ever');
export const fetchTransactionsMonth = (limit = 500)               => get(`/transactions-month?limit=${limit}`);
export const fetchWotd         = ()                             => get('/wotd');
export const fetchTopHourly    = (n = 10)                      => get(`/top-hourly?n=${n}`);
export const fetchTransactions = (threshold = 100, limit = 60) => get(`/transactions?threshold=${threshold}&limit=${limit}`);
export const fetchMinutely     = (threshold = 100)             => get(`/minutely?threshold=${threshold}`);
export const fetchHourly       = (threshold = 100, hours = 24) => get(`/hourly?threshold=${threshold}&hours=${hours}`);
export const fetchHeatmap      = ()                             => get('/heatmap');
export const fetchLeaderboard  = (period = 'day', n = 5, threshold = 100) => get(`/leaderboard?period=${period}&n=${n}&threshold=${threshold}`);
export const fetchAddress      = (addr)                        => get(`/address/${addr}`);
export const fetchCorrelation  = (days = 30)                   => get(`/correlation?days=${days}`);
export const fetchNetwork      = (limit = 10)                  => get(`/network?limit=${limit}`);
