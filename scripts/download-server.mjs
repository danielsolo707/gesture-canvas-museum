const crypto = await import('node:crypto');

const blobs = new Map();

export function addDownloadRoutes(server) {
  server.middlewares.use((req, res, next) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/upload' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const id = crypto.randomUUID();
        blobs.set(id, Buffer.concat(chunks));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ downloadUrl: `/api/download/${id}` }));
      });
      return;
    }

    const match = url.pathname.match(/^\/api\/download\/([a-f0-9-]+)$/);
    if (match && req.method === 'GET') {
      const id = match[1];
      const data = blobs.get(id);
      if (!data) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="gesture-canvas-${Date.now()}.jpg"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.end(data);
      return;
    }

    next();
  });
}

export function downloadHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/upload' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const id = crypto.randomUUID();
      blobs.set(id, Buffer.concat(chunks));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ downloadUrl: `/api/download/${id}` }));
    });
    return true;
  }

  const match = url.pathname.match(/^\/api\/download\/([a-f0-9-]+)$/);
  if (match && req.method === 'GET') {
    const id = match[1];
    const data = blobs.get(id);
    if (!data) {
      res.statusCode = 404;
      res.end('Not found');
      return true;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="gesture-canvas-${Date.now()}.jpg"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(data);
    return true;
  }

  return false;
}
