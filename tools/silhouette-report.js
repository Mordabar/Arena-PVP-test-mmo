#!/usr/bin/env node
/* =============================================================================
 * tools/silhouette-report.js — El contorno de las seis clases, en números.
 *
 * Carga los mismos ficheros que tests.html, construye la pose de cada clase y
 * imprime su perfil de silueta banda a banda desde tres vistas, más la matriz
 * de distancias entre clases.
 *
 * Es la herramienta con la que se ajusta la identidad visual: cambiar un radio
 * en `data/classVisuals.js` y ver inmediatamente qué banda se movió, en vez de
 * pintar un fotograma y opinar.
 *
 *   node tools/silhouette-report.js            perfil + matriz
 *   node tools/silhouette-report.js --bandas   además, cada banda
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'tests.html'), 'utf8');
const scripts = [];
const re = /<script\s+src="([^"]+)"\s*>\s*<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) {
  if (m[1].indexOf('js/tests/') === 0) continue;   // sólo el producto
  scripts.push(m[1]);
}

const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, Error,
  Float32Array, Float64Array, Uint16Array, Uint32Array, Int32Array, Uint8Array,
  isNaN, isFinite, parseInt, parseFloat, Infinity, NaN, undefined
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;
vm.createContext(sandbox);
for (const rel of scripts) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), sandbox, { filename: rel });
}

const A = sandbox.Arena;
const CV = A.Render.CharacterVisual;
const PM = A.Render.PoseMetrics;
const CLASSES = A.Data.CLASS_VISUAL_ORDER;
const BOUNDS = PM.boundsOf(CV.buildMeshes());
const detalle = process.argv.includes('--bandas');

function poseOf(classId, opts) {
  opts = opts || {};
  const e = {
    id: 'sr-' + classId, classId, raceId: 'darkElf',
    pos: { x: 0, y: 0, z: 0 }, yaw: 0, height: 1.85, moveSpeedBase: 5.4,
    alive: true, targetId: null, cast: null, weaponState: null,
    hasStatus: () => false
  };
  const w = { time: 0, getEntity: () => null };
  const st = CV.createState(e.id);
  const dt = 1 / 30, frames = opts.frames || 20;
  for (let i = 0; i < frames; i++) {
    e.pos.z += (opts.forward || 0) * dt;
    e.pos.x += -(opts.right || 0) * dt;
    w.time += dt;
    CV.update(st, e, dt, w);
  }
  const out = [];
  CV.buildPose(out, st, e, e.pos, e.yaw, CV.paletteFor(e, true));
  return out;
}

/* La espalda no entra: en proyección ortográfica su contorno es el espejo del
   frontal y daría exactamente los mismos números. El perfil sí es información
   nueva. */
const VIEWS = [['frontal', 0], ['3/4', Math.PI * 0.25], ['perfil', Math.PI * 0.5]];
const poses = {};
for (const c of CLASSES) poses[c] = poseOf(c);

for (const [vname, az] of VIEWS) {
  console.log('\n\x1b[1m══ VISTA ' + vname.toUpperCase() + ' ══\x1b[0m');
  const prof = {};
  for (const c of CLASSES) prof[c] = PM.profile(poses[c], BOUNDS, { azimuth: az });

  console.log('clase        piezas  alto  ancho  cintura/hombro  bajo/hombro  desvío  esbeltez  relleno');
  for (const c of CLASSES) {
    const d = PM.descriptors(prof[c]);
    console.log(
      c.padEnd(12) + String(prof[c].pieces).padStart(5) +
      d.height.toFixed(2).padStart(7) + d.width.toFixed(2).padStart(7) +
      d.taper.toFixed(2).padStart(15) + d.flare.toFixed(2).padStart(13) +
      d.asym.toFixed(3).padStart(9) + d.slender.toFixed(2).padStart(10) + d.fill.toFixed(2).padStart(9));
  }

  if (detalle) {
    console.log('\nbandas (de los pies a la coronilla):');
    for (const c of CLASSES) {
      console.log('  ' + c.padEnd(12) +
        prof[c].bands.map(b => b.toFixed(2).padStart(5)).join(''));
    }
  }

  console.log('\ndistancia de contorno (%):');
  process.stdout.write('              ');
  for (const c of CLASSES) process.stdout.write(c.slice(0, 6).padStart(8));
  console.log();
  let peor = 100, peorPar = '';
  for (let i = 0; i < CLASSES.length; i++) {
    process.stdout.write('  ' + CLASSES[i].padEnd(12));
    for (let j = 0; j < CLASSES.length; j++) {
      if (i === j) { process.stdout.write('       ·'); continue; }
      const d = PM.distance(prof[CLASSES[i]], prof[CLASSES[j]]) * 100;
      if (j > i && d < peor) { peor = d; peorPar = CLASSES[i] + ' ≈ ' + CLASSES[j]; }
      const s = d.toFixed(1).padStart(8);
      process.stdout.write(d < 15 ? '\x1b[31m' + s + '\x1b[0m' : s);
    }
    console.log();
  }
  console.log('  peor pareja: ' + peorPar + ' con ' + peor.toFixed(1) + ' %' +
    (peor < 15 ? '  \x1b[31m← por debajo del umbral\x1b[0m' : '  \x1b[32m✓\x1b[0m'));
}
