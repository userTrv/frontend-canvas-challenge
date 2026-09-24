export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4001').replace(/\/$/, '');

export const SAVE_DEBOUNCE_MS = 500;
export const POLL_INTERVAL_MS = 500;
export const MAX_NODES = 20;
