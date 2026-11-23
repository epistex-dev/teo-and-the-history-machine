import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const port = Number(process.env.PORT ?? 19002);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2',
};

function parseHeaders(text) {
  const rules = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: {} };
      rules.push(current);
    } else if (current) {
      const i = line.indexOf(':');
      current.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

function matches(pattern, path) {
  const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return re.test(path);
}

const rules = parseHeaders(await readFile(join(root, '_headers'), 'utf8'));
const notFound = await readFile(join(root, '404.html'));

createServer(async (req, res) => {
  // the suite aborts requests mid-flight and sends malformed paths; neither may kill the server
  res.on('error', () => undefined);
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const rel = normalize(path === '/' ? '/index.html' : path);
    const file = join(root, rel);
    let body = null;
    let status = 200;
    let file2 = file;
    if (file.startsWith(root) && rel !== '/_headers') {
      try {
        if ((await stat(file)).isFile()) body = await readFile(file);
      } catch {
        /* falls through to 404 */
      }
    }
    if (!body) {
      status = 404;
      body = notFound;
      file2 = join(root, '404.html');
    }
    const headers = { 'Content-Type': types[extname(file2)] ?? 'application/octet-stream' };
    for (const rule of rules) {
      if (status === 200 && matches(rule.pattern, path)) Object.assign(headers, rule.headers);
      else if (status === 404 && rule.pattern === '/*') Object.assign(headers, rule.headers);
    }
    res.writeHead(status, headers);
    res.end(body);
  } catch {
    try {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(notFound);
    } catch {
      /* the socket is gone */
    }
  }
}).listen(port, '127.0.0.1');
