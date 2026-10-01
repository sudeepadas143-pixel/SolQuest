// GET /api/player?wallet=... - a wallet's rank, best run, projected payout and payout history.
import { route } from './_lib/http.js';
import { player } from './_lib/core.js';

export default route(['GET'], player);
