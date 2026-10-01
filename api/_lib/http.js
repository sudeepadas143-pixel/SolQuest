// Wraps a core handler ({query, body, ip} -> {status, body}) as a Vercel
// Node function, which is also how the Vite dev/preview middleware calls it.
export function route(methods, fn) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!methods.includes(req.method)) {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    try {
      const url = new URL(req.url, 'http://local');
      const query = req.query ?? Object.fromEntries(url.searchParams);
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'local').split(',')[0].trim();
      const out = await fn({ query, body: body ?? {}, ip });
      res.statusCode = out.status;
      res.end(JSON.stringify(out.body));
    } catch (e) {
      res.statusCode = e.status ?? 500;
      res.end(JSON.stringify({ error: e.status ? e.message : 'Server error' }));
      if (!e.status) console.error(e);
    }
  };
}
