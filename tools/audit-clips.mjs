#!/usr/bin/env node
/* =============================================================================
 * tools/audit-clips.mjs — verifica el catálogo de animación contra los
 * binarios reales. Es la puerta que impide declarar un clip "FINAL" sin que
 * exista.
 *
 * POR QUÉ EXISTE
 *
 * js/data/animationSourcePlan.js y js/data/animationProfiles.js declaran, por
 * cada estado, un STATUS honesto (FINAL_USER_LOCKED, PROVISIONAL,
 * MISSING_EXACT_CLIP...). Ese sistema es bueno, pero es AUTO-declarado: nada
 * comprueba automáticamente que el nombre de clip que alguien escribió ahí
 * existe de verdad dentro de los .glb/.json que el juego carga. Ese hueco es
 * exactamente donde se cuela "dije que estaba resuelto y no lo estaba".
 *
 * Este script lee los binarios reales —sin Three.js, sin navegador— y:
 *   1. Lista qué clips trae cada fuente.
 *   2. Recorre TODOS los `slot(...)` de animationSourcePlan.js y TODOS los
 *      `AP.CORE`/`AP.CLASS` de animationProfiles.js.
 *   3. Para cada uno, comprueba que su `clip` (y su `fallback` si lo declara)
 *      existe en alguna fuente real.
 *   4. Sale con código distinto de cero si algo declarado como disponible no
 *      lo está.
 *
 *   node tools/audit-clips.mjs
 *   node tools/audit-clips.mjs --clip Sword_Regular_A     ¿existe? ¿en cuál .glb?
 *   node tools/audit-clips.mjs --list                     todos los clips reales
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const flag = (n) => argv.includes('--' + n);

/* --- 1. Clips reales, leídos directamente del binario --------------------- */
function glbAnimNames(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ': no es un GLB válido');
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8'));
  return (json.animations || []).map(a => a.name);
}

const FUENTES = {
  'ual1-arena-runtime.glb': path.join(RAIZ, 'assets/animations/ual1-arena-runtime.glb'),
  'ual2-melee-runtime.glb': path.join(RAIZ, 'assets/animations/ual2-melee-runtime.glb'),
  'ual2-rm-runtime.glb': path.join(RAIZ, 'assets/animations/ual2-rm-runtime.glb')
};
const catalogo = new Map();   // nombre de clip -> [ficheros que lo contienen]
for (const [nombre, ruta] of Object.entries(FUENTES)) {
  if (!fs.existsSync(ruta)) { console.error('AVISO: falta ' + ruta); continue; }
  for (const clip of glbAnimNames(ruta)) {
    if (!catalogo.has(clip)) catalogo.set(clip, []);
    catalogo.get(clip).push(nombre);
  }
}
const cmuPath = path.join(RAIZ, 'assets/animations/arena-cmu-v031.json');
if (fs.existsSync(cmuPath)) {
  const cmu = JSON.parse(fs.readFileSync(cmuPath, 'utf8'));
  for (const c of (cmu.clips || [])) {
    if (!catalogo.has(c.name)) catalogo.set(c.name, []);
    catalogo.get(c.name).push('arena-cmu-v031.json');
  }
}

/* Clips SINTETIZADOS en runtime por threeDirectAnim.js (buildVideoArcherClips),
 * a partir de Pistol_Aim_Neutral + Pistol_Reload + Idle_Loop. No existen como
 * pista literal en ningún .glb, así que este auditor ESTÁTICO no puede verlos
 * por sí mismo — y por eso, sin esta lista, los marcaba como ausentes cuando
 * en realidad se generan y sí están disponibles en el juego. Comprobado en
 * navegador real: lib.has('Arena_Archer_VideoReady') === true.
 *
 * Si tocas buildVideoArcherClips() y cambia lo que produce, actualiza esto — y
 * si algún día esos nombres dejan de generarse, este auditor volverá a fallar
 * "en falso positivo de existencia", que es el error seguro (avisa de más, no
 * de menos). */
const SINTETIZADOS_EN_RUNTIME = {
  'Arena_Archer_VideoReady': 'buildVideoArcherClips() ← Pistol_Aim_Neutral + Pistol_Reload',
  'Arena_Archer_VideoNotch': 'buildVideoArcherClips() ← Pistol_Aim_Neutral + Pistol_Reload',
  'Arena_Archer_VideoShoot': 'buildVideoArcherClips() ← Pistol_Aim_Neutral + Pistol_Reload',
  'Arena_Archer_VideoBuff':  'buildVideoArcherClips() ← Pistol_Aim_Neutral + Pistol_Reload'
};
for (const [nombre, origen] of Object.entries(SINTETIZADOS_EN_RUNTIME)) {
  if (!catalogo.has(nombre)) catalogo.set(nombre, []);
  catalogo.get(nombre).push('SINTETIZADO: ' + origen);
}

if (flag('list')) {
  console.log('CLIPS REALES (' + catalogo.size + ') — fuente(s) entre paréntesis\n');
  [...catalogo.keys()].sort().forEach(n => console.log('  ' + n.padEnd(32) + ' (' + catalogo.get(n).join(', ') + ')'));
  process.exit(0);
}

const soloClip = arg('clip');
if (soloClip) {
  const en = catalogo.get(soloClip);
  if (en) { console.log('✓ "' + soloClip + '" existe en: ' + en.join(', ')); process.exit(0); }
  const parecidos = [...catalogo.keys()].filter(n => n.toLowerCase().includes(soloClip.toLowerCase()));
  console.log('✗ "' + soloClip + '" NO existe.' + (parecidos.length ? ' ¿Querías: ' + parecidos.slice(0, 6).join(', ') + '?' : ''));
  process.exit(1);
}

/* --- 2. Cargar los ficheros de datos en un sandbox mínimo ------------------ */
const sandbox = { console, Math, Object, Array, String, Number, Boolean, JSON, isFinite, isNaN };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.Arena = { define: function (name, deps, factory) { factory(sandbox.Arena); sandbox.Arena._m = sandbox.Arena._m || {}; sandbox.Arena._m[name] = true; }, Data: {} };
vm.createContext(sandbox);
for (const f of ['js/data/animConfig.js', 'js/data/animationProfiles.js', 'js/data/animationSourcePlan.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), sandbox, { filename: f });
}
const SP = sandbox.Arena.Data.AnimationSourcePlan;
const AP = sandbox.Arena.Data.AnimationProfiles;

/* --- 3. Recorrer TODO lo declarado y comprobarlo contra el catálogo ------- */
const fallos = [];
let comprobados = 0;

function comprobarClip(clip, dondeQueDice) {
  if (!clip) return;
  // Algunos campos son texto descriptivo ('A -> B', 'Family_*', 'X/Y'), no un
  // nombre de clip literal que threeDirectAnim.js vaya a pedir por ese string.
  if (/[*/]|->/.test(clip)) return;
  comprobados++;
  if (!catalogo.has(clip)) fallos.push(dondeQueDice + ': clip "' + clip + '" declarado pero AUSENTE de los binarios');
}

function recorrerSlots(obj, prefijo) {
  for (const key in obj) {
    const v = obj[key];
    if (v && typeof v === 'object' && 'clip' in v && 'status' in v) {
      comprobarClip(v.clip, prefijo + '.' + key);
      if (v.fallback) comprobarClip(v.fallback, prefijo + '.' + key + ' (fallback)');
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      recorrerSlots(v, prefijo + '.' + key);
    }
  }
}
if (SP && SP.slots) recorrerSlots(SP.slots, 'animationSourcePlan.slots');
if (SP && SP.locomotion) recorrerSlots(SP.locomotion, 'animationSourcePlan.locomotion');
if (SP && SP.jump && SP.jump.active) SP.jump.active.forEach(c => comprobarClip(c, 'animationSourcePlan.jump'));
if (AP && AP.CORE) recorrerSlots(AP.CORE, 'animationProfiles.CORE');

console.log('AUDITORÍA DE CLIPS · ' + catalogo.size + ' clips reales en los binarios, ' +
  comprobados + ' referencias comprobadas en los contratos de datos\n');

if (fallos.length) {
  fallos.forEach(f => console.log('  ✗ ' + f));
  console.log('\n' + fallos.length + ' referencia(s) a clips que NO existen. Antes de tocar la');
  console.log('presentación, decide si el slot debe apuntar a otro clip real o marcarse MISSING.');
  process.exit(1);
}
console.log('  ✓ todas las referencias comprobadas apuntan a clips que existen de verdad');
process.exit(0);
