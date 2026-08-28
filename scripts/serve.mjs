import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/vnd.microsoft.icon',
};
let port = Number(process.env.PORT ?? 5173);
let attempts = 0;

const server = createServer(async (request, response) => {
  const reply = (status, body = '') => {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(body);
  };
  if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'Method not allowed');
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') return reply(204);
    if (pathname === '/') pathname = '/index.html';
    const path = resolve(root, `.${pathname}`);
    const type = types[extname(path).toLowerCase()];
    const publicFile = path === resolve(root, 'index.html')
      || (path.startsWith(resolve(root, 'src') + sep) && type?.startsWith('text/'))
      || (path.startsWith(resolve(root, 'assets') + sep) && type?.startsWith('image/'));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !type || !publicFile) return reply(404, 'Not found');
    const file = await readFile(path);
    response.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch (error) {
    reply(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400, 'Not found');
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE' && attempts++ < 10) server.listen(++port, '127.0.0.1');
  else { console.error(error.message); process.exitCode = 1; }
});
server.on('listening', () => console.log(`Foxfire is ready at http://127.0.0.1:${server.address().port}`));
server.listen(port, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
