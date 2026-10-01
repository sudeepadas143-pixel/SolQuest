// Save file (localStorage). Everything here is CLIENT-SIDE and therefore
// editable by the player - see BUILD_NOTES.md "Score integrity".
import { SAVE_KEY, SAVE_VERSION } from '../config.js';
import { STARTING_BAG } from '../data/items.js';
import { PLAYER_START } from '../data/map.js';
import { TRAINER_ORDER } from '../data/trainers.js';
import { generateTeams, makeSeed, normalizeWallet, fixDesigns, migrateRoster } from './teams.js';
import { createCreature } from './creature.js';
import { Rng, randomSeed } from './rng.js';

let current = null;

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.version !== SAVE_VERSION) return null;
    current = s;
    // fields added after the first release
    s.run ??= { ms: s.stats?.playMs ?? 0, clearMs: s.hallOfFame ? s.stats.playMs : null, clearedAt: s.hallOfFame?.at ?? null };
    s.pickedItems ??= [];
    const migrated = migrateRoster(s);
    const swapped = fixFireLine(s);
    s.checkpoints ??= ['start'];
    if (fixDesigns(s) || migrated || swapped) writeSave();
    return s;
  } catch {
    return null;
  }
}

export function getSave() { return current; }

/** The fire line used to run Emby -> Emberfox -> Embrute; it's Emby -> Embrute
 *  -> Emberfox (the fox is the final form). Saves from before the fix keep
 *  their creature's stage, only the name swaps. */
function fixFireLine(s) {
  if (s.fireLine2) return false;
  const swap = { emberfox: 'embrute', embrute: 'emberfox' };
  for (const c of [...(s.party ?? []), ...(s.hallOfFame?.team ?? [])]) if (swap[c.species]) c.species = swap[c.species];
  s.fireLine2 = true;
  return true;
}

const savedListeners = new Set();
/** Hear about every successful save (the HUD shows a small "Saved" mark). */
export function onSaved(fn) { savedListeners.add(fn); return () => savedListeners.delete(fn); }

export function writeSave() {
  if (!current) return;
  current.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(current));
    savedListeners.forEach((fn) => fn());
  } catch (e) { console.warn('save failed', e); }
}

export function deleteSave() {
  current = null;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

/** Build a fresh save once intro, look, starter and wallet are chosen. */
export function createSave({ name, gender, starter, wallet }) {
  const { seed, seedSource } = makeSeed(wallet);
  const starterRng = new Rng(randomSeed());
  current = {
    version: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    seed,
    seedSource,
    player: { name, gender, wallet: normalizeWallet(wallet), walletAtSeed: normalizeWallet(wallet) },
    party: [createCreature(starter, 5, starterRng, { ivFloor: 16 })],
    bag: { ...STARTING_BAG },
    pos: { ...PLAYER_START },
    respawn: { ...PLAYER_START },
    teams: generateTeams(seed),
    defeated: Object.fromEntries(TRAINER_ORDER.map((id) => [id, false])),
    score: 0,
    scoreLog: [],
    hallOfFame: null,
    stats: { wildWins: 0, battles: 0, losses: 0, steps: 0, playMs: 0 },
    // speedrun: time from gaining control to beating Cooker (see runClock.js)
    run: { ms: 0, clearMs: null, startedAt: null, clearedAt: null },
    pickedItems: [],
    checkpoints: ['start'],      // unlocked blackout return points (see CHECKPOINTS in map.js)
    fireLine2: true,
  };
  writeSave();
  return current;
}
