// GET /api/leaderboard?limit=50&offset=0 - the season's board (see _lib/core.js).
import { route } from './_lib/http.js';
import { leaderboard } from './_lib/core.js';

export default route(['GET'], leaderboard);
