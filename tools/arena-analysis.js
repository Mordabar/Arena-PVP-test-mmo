#!/usr/bin/env node
/* =============================================================================
 * tools/arena-analysis.js — Mide la arena como espacio de PvP, no como decorado.
 *
 * El diseño de un mapa de duelo se puede discutir con adjetivos o se puede
 * medir. Esto mide: dónde hay cobertura, dónde se rompe la línea de visión,
 * cuánto espacio hay para kitear en círculo y si los dos bandos reciben lo
 * mismo. Los números salen del MISMO `sim/arena` y del MISMO `math/ray` que usa
 * la simulación, así que no hay una segunda verdad.
 *
 *   node tools/arena-analysis.js
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
while ((m = re.exec(html)) !== null) scripts.push(m[1]);

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
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), sandbox, { filename: rel });
}

const Arena = sandbox.Arena;
const A = Arena.Sim.Arena.build();
const M = Arena.Sim.ArenaMetrics;

function fmt(n, d) { return Number(n).toFixed(d === undefined ? 2 : d); }

console.log('ARENA ' + A.width + ' × ' + A.depth + '  ·  muro ' + A.wallHeight +
  '  ·  ' + A.obstacles.length + ' obstáculos  ·  ' + A.platforms.length + ' plataformas');
console.log('');

/* --- Simetría ------------------------------------------------------------- */
const sym = M.symmetryReport(A);
console.log('SIMETRÍA 180°  ' + (sym.symmetric ? 'SÍ' : 'NO — ' + sym.unmatched.length + ' piezas sin pareja'));
sym.unmatched.slice(0, 8).forEach(u => console.log('   sin pareja: ' + u));
console.log('');

/* --- Spawns --------------------------------------------------------------- */
console.log('SPAWNS');
const spawnRows = [
  ['jugador', A.spawns.player],
  ['enemigo', A.spawns.enemy]
];
for (const [name, s] of spawnRows) {
  const r = M.spawnReport(A, s);
  console.log('  ' + name.padEnd(9) +
    ' (' + fmt(s.x, 1) + ', ' + fmt(s.z, 1) + ')' +
    '  al centro ' + fmt(r.toCenter) +
    '  cobertura más cercana ' + fmt(r.nearestCover) +
    '  espalda libre ' + fmt(r.backClearance) +
    '  LoS al rival ' + (r.losToOpponent ? 'sí' : 'NO'));
}
const d = M.dist2(A.spawns.player, A.spawns.enemy);
console.log('  separación entre spawns: ' + fmt(d));
console.log('');

/* --- Cobertura ------------------------------------------------------------ */
const cov = M.coverageReport(A, 1.0);
console.log('COBERTURA (rejilla de 1 u, ' + cov.samples + ' puntos jugables)');
console.log('  puntos con cobertura a ≤ 4 u ....... ' + fmt(cov.coverWithin4 * 100, 1) + ' %');
console.log('  puntos con cobertura a ≤ 8 u ....... ' + fmt(cov.coverWithin8 * 100, 1) + ' %');
console.log('  distancia media a la cobertura ..... ' + fmt(cov.meanCoverDistance) + ' u');
console.log('  peor caso (campo abierto) .......... ' + fmt(cov.maxCoverDistance) +
  ' u en (' + fmt(cov.worstPoint.x, 1) + ', ' + fmt(cov.worstPoint.z, 1) + ')');
console.log('');

/* --- Línea de visión ------------------------------------------------------ */
const los = M.losReport(A, 2.0);
console.log('LÍNEA DE VISIÓN (pares de puntos a rejilla de 2 u)');
console.log('  pares con LoS ...................... ' + fmt(los.openRatio * 100, 1) + ' %');
console.log('  pares a rango de arquero (18-26 u) con LoS ... ' + fmt(los.longRangeOpen * 100, 1) + ' %');
console.log('');

/* --- Kiteo ---------------------------------------------------------------- */
console.log('CARRILES DE KITEO (anillo transitable alrededor del centro)');
for (const radius of [6, 9, 12, 14]) {
  const k = M.kiteRing(A, radius);
  console.log('  r=' + String(radius).padStart(2) + '  transitable ' +
    fmt(k.walkable * 100, 1).padStart(6) + ' %   tramo bloqueado más largo ' +
    fmt(k.longestBlockArc) + ' u');
}
console.log('');

/* --- Conectividad y vuelta completa --------------------------------------- */
const conn = M.connectivityReport(A, 1.0);
console.log('CONECTIVIDAD');
console.log('  piezas del espacio jugable ......... ' + conn.components +
  (conn.components === 1 ? ' (una sola, sin bolsas aisladas)' : ' ← hay zonas inalcanzables'));
console.log('  mayor pieza ........................ ' + fmt(conn.largestRatio * 100, 1) + ' %');
conn.strays.slice(0, 4).forEach(s =>
  console.log('    bolsa de ' + s.size + ' puntos en (' + fmt(s.at.x, 1) + ', ' + fmt(s.at.z, 1) + ')'));
console.log('');
console.log('VUELTA COMPLETA AL FOSO (se puede rodear el centro sin embudo)');
for (const inner of [5, 7, 9]) {
  const lp = M.loopAroundCenter(A, inner, 1.0);
  console.log('  disco central r=' + inner + '  ' + (lp.closed ? 'CERRADA' : 'ABIERTA') +
    '  cobertura ' + fmt(lp.angularCoverage * 100, 1) + ' %  hueco mayor ' +
    fmt(lp.worstGapDegrees, 0) + '°');
}
console.log('');

/* --- Zonas declaradas ----------------------------------------------------- */
console.log('ZONAS DECLARADAS');
for (const z of (A.zones || [])) {
  console.log('  ' + z.id.padEnd(14) + ' ' + z.role.padEnd(22) + ' (' +
    fmt(z.x, 1) + ', ' + fmt(z.z, 1) + ')  r=' + fmt(z.radius, 1));
}
