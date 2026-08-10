#!/usr/bin/env node
/* =============================================================================
 * tools/run-tests.js — Ejecuta la batería de combate sin navegador.
 *
 * No es un segundo motor: lee el orden de <script> de tests.html y evalúa los
 * MISMOS ficheros en un contexto de Node. Así el runner headless y el del
 * navegador no pueden divergir nunca.
 *
 *   node tools/run-tests.js [filtro]
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'tests.html');

const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [];
const re = /<script\s+src="([^"]+)"\s*>\s*<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) scripts.push(m[1]);

if (!scripts.length) {
  console.error('No se encontró ningún <script src> en tests.html');
  process.exit(2);
}

const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, Error,
  Float32Array, Uint16Array, Uint32Array, Int32Array, Uint8Array,
  isNaN, isFinite, parseInt, parseFloat, Infinity, NaN, undefined
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;
vm.createContext(sandbox);

for (const rel of scripts) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.error(`Falta el fichero declarado en tests.html: ${rel}`);
    process.exit(2);
  }
  try {
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: rel });
  } catch (err) {
    console.error(`\nError cargando ${rel}:\n  ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 6).join('\n'));
    process.exit(2);
  }
}

const filter = process.argv[2] || null;
const results = sandbox.Arena.Tests.run(filter);
console.log(sandbox.Arena.Tests.format(results));
process.exit(results.ok ? 0 : 1);
