// Client for the leaderboard / earnings API (api/*.js on Vercel; the Vite
// dev/preview servers serve the same handlers). Finished runs are submitted
// when Cooker falls, and retried from the menu screens if that failed.
import { getSave, writeSave } from './save.js';

const API = '/api';

async function call(path, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${API}/${path}`, { ...opts, signal: ctrl.signal, headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) } });
    let body = null;
    try { body = await r.json(); } catch { /* not JSON: no API here */ }
    if (!body) return { ok: false, error: 'The leaderboard is offline right now.' };
    if (!r.ok) return { ok: false, status: r.status, error: body.error ?? 'Something went wrong.' };
    return { ok: true, ...body };
  } catch {
    return { ok: false, error: "Couldn't reach the leaderboard. Check your connection." };
  } finally {
    clearTimeout(t);
  }
}

export const fetchLeaderboard = (offset = 0, limit = 50) => call(`leaderboard?offset=${offset}&limit=${limit}`);
export const fetchPlayer = (wallet) => call(`player?wallet=${encodeURIComponent(wallet)}`);

/** Has this save's clear been accepted by the leaderboard? */
export const clearSubmitted = (s = getSave()) => !!(s?.run?.clearMs && s.run.submitted?.clearMs === s.run.clearMs);

/** Send this save's finished run. Remembers the result in the save. */
export async function submitClear(s = getSave()) {
  if (!s?.run?.clearMs) return { ok: false, error: 'No finished run yet.' };
  const lead = s.hallOfFame?.team?.[0] ?? s.party?.[0];
  const res = await call('runs', {
    method: 'POST',
    body: JSON.stringify({
      wallet: s.player.wallet,
      name: s.player.name,
      run: { clearMs: s.run.clearMs, startedAt: s.run.startedAt, clearedAt: s.run.clearedAt },
      starter: s.starter ?? s.party?.[0]?.species ?? null,
      species: lead?.species ?? null,
      level: lead?.level ?? null,
      score: s.score,
      seedSource: s.seedSource,
      version: String(s.version ?? ''),
    }),
  });
  if (res.ok) {
    s.run.submitted = { clearMs: s.run.clearMs, rank: res.rank, at: new Date().toISOString() };
    writeSave();
  } else {
    s.run.submitError = res.error;
  }
  return res;
}

/** Retry a finished run that never reached the board (offline at the time). */
export async function resubmitIfNeeded(s = getSave()) {
  if (s?.run?.clearMs && !clearSubmitted(s)) return submitClear(s);
  return null;
}

export const shortWallet = (w) => (w && w.length > 10 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w ?? '');
