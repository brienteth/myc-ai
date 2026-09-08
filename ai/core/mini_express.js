/**
 * Zero-Dependency Built-In HTTP Server (Drop-in replacement for Express)
 * Uses 100% native Node.js 'http', 'fs', and 'path' modules.
 * Eliminates express and 70+ transitive dependencies.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

export function createExpressApp() {
  const routes = [];
  const middlewares = [];
  let staticDir = null;

  const app = {
    use(fn) {
      if (typeof fn === 'function') {
        middlewares.push(fn);
      } else if (fn && fn._isStatic) {
        staticDir = fn.dir;
      }
    },
    get(routePath, handler) {
      routes.push({ method: 'GET', path: routePath, handler });
    },
    post(routePath, handler) {
      routes.push({ method: 'POST', path: routePath, handler });
    },
    hasRoute(method, pathname) {
      for (const r of routes) {
        if (r.method === method) {
          if (r.path === pathname) return true;
          if (r.path.includes(':')) {
            const rParts = r.path.split('/');
            const uParts = pathname.split('/');
            if (rParts.length === uParts.length) {
              let match = true;
              for (let i = 0; i < rParts.length; i++) {
                if (!rParts[i].startsWith(':') && rParts[i] !== uParts[i]) {
                  match = false;
                  break;
                }
              }
              if (match) return true;
            }
          }
        }
      }
      return false;
    },
    async handle(req, res, fallback) {
      // Enhance response if not already enhanced
      if (!res.header) res.header = function(k, v) { res.setHeader(k, v); return res; };
      if (!res.set) res.set = res.header;
      if (!res.status) {
        res.status = function(code) {
          res.statusCode = code;
          return res;
        };
      }
      if (!res.json) {
        res.json = function(data) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
          return res;
        };
      }
      if (!res.send) {
        res.send = function(body) {
          if (typeof body === 'object') return res.json(body);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(body);
          return res;
        };
      }
      if (!res.sendFile) {
        res.sendFile = function(filePath) {
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
        };
      }

      const parsedUrl = url.parse(req.url, true);
      req.query = parsedUrl.query || {};
      req.params = {};
      const pathname = parsedUrl.pathname;

      // Run middlewares
      for (const mw of middlewares) {
        let nextCalled = false;
        await new Promise((resolve) => {
          mw(req, res, () => {
            nextCalled = true;
            resolve();
          });
          setTimeout(() => { if (!nextCalled) resolve(); }, 10);
        });
      }

      // Parse JSON body for POST/PUT if not already parsed
      if (!req.body && (req.method === 'POST' || req.method === 'PUT')) {
        try {
          const buffers = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const rawBody = Buffer.concat(buffers).toString('utf8');
          if (rawBody) {
            try {
              req.body = JSON.parse(rawBody);
            } catch (e) {
              req.body = rawBody;
            }
          } else {
            req.body = {};
          }
        } catch (e) {
          req.body = {};
        }
      }

      // Match route
      for (const r of routes) {
        if (r.method === req.method) {
          if (r.path === pathname) {
            return r.handler(req, res);
          }
          // Parameterized route: /experiments/:id
          if (r.path.includes(':')) {
            const rParts = r.path.split('/');
            const uParts = pathname.split('/');
            if (rParts.length === uParts.length) {
              let match = true;
              const params = {};
              for (let i = 0; i < rParts.length; i++) {
                if (rParts[i].startsWith(':')) {
                  params[rParts[i].slice(1)] = uParts[i];
                } else if (rParts[i] !== uParts[i]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                req.params = params;
                return r.handler(req, res);
              }
            }
          }
        }
      }

      // If fallback provided, delegate
      if (typeof fallback === 'function') {
        return fallback();
      }

      // Static files fallback
      if (staticDir) {
        let reqPath = pathname === '/' ? '/index.html' : pathname;
        const safePath = path.join(staticDir, path.normalize(reqPath));
        if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
          const ext = path.extname(safePath).toLowerCase();
          const mimeTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json',
            '.wasm': 'application/wasm',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          return fs.createReadStream(safePath).pipe(res);
        }
      }

      res.status(404).json({ error: 'Endpoint Not Found', path: pathname });
    },
    listen(port, callback) {
      const server = http.createServer((req, res) => app.handle(req, res));
      return server.listen(port, callback);
    }
  };

  return app;
}

createExpressApp.json = function() {
  return (req, res, next) => next();
};

createExpressApp.static = function(dir) {
  return { _isStatic: true, dir };
};

export default createExpressApp;
