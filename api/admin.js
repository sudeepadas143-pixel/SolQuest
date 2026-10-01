// POST /api/admin {key, action, ...} - review runs, record payouts, set the season (needs ADMIN_KEY).
import { route } from './_lib/http.js';
import { admin } from './_lib/core.js';

export default route(['POST'], admin);
