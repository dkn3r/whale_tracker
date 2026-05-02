// API base — change to your deployed host if needed
export const API_BASE = '/api';

export const CHART_COLORS = {
  green:  '#00ffaa',
  cyan:   '#00d4ff',
  purple: '#a855f7',
  orange: '#ff8c00',
  red:    '#ff3366',
};

// Filter threshold presets shown in the UI
export const FILTER_PRESETS = [100, 500, 1000, 5000];

export const BUCKET_LABELS  = ['0–100', '100–500', '500–1000', '1000–5000', '5000+'];
export const BUCKET_COLORS  = ['#00ffaa', '#00d4ff', '#a855f7', '#ff8c00', '#ff3366'];
export const HEATMAP_COLORS = ['#1a2540', '#0d3d2a', '#0a6640', '#00aa66', '#00ffaa'];

// Anomaly: flag any 5-min bucket where tx count exceeds this per-bucket equivalent
// 1000 tx/hour  →  ~83 tx per 5-min bucket
export const ANOMALY_TX_PER_BUCKET = 50; // 50 tx per 5-min = 600 tx/hour

export const PERIODS = [
  { label: 'Hour',  key: 'hour'  },
  { label: 'Day',   key: 'day'   },
  { label: 'Month', key: 'month' },
  { label: 'Year',  key: 'year'  },
];

// How often (ms) to refresh live data
export const POLL_INTERVAL_MS = 30_000;
