#!/usr/bin/env node
/* =============================================================================
 * tools/serve.js — Servidor estático mínimo, sin dependencias.
 *
 * POR QUÉ EXISTE
 *
 * `index.html` se abre con doble clic y seguirá haciéndolo. `index-three.html`
 * NO puede: usa módulos ES, y el navegador los bloquea sobre file:// por
 * política de origen cruzado. No es una decisión del proyecto, es cómo funciona
 * el estándar de módulos.
 *
 * Este servidor cubre esa necesidad en local. En Hostinger no hace falta: allí
 * el propio hosting sirve los ficheros por HTTPS, que es exactamente el caso
 * para el que está pensada la versión de Three.js.
 *
 *   node tools/serve.js [puerto]
 *   → http://localhost:8080/index-three.html
 * ========================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2], 10) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  // Nunca servir fuera de la raíz del proyecto.
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('403');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Sirviendo ' + ROOT + ' en http://localhost:' + PORT + '/');
  console.log('  WebGL2 nativo : http://localhost:' + PORT + '/index.html');
  console.log('  Three.js      : http://localhost:' + PORT + '/index-three.html');
});
