// POST /api/runs - the game submits a finished run (best time per wallet is kept).
import { route } from './_lib/http.js';
import { submitRun } from './_lib/core.js';

export default route(['POST'], submitRun);
