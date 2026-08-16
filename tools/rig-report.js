#!/usr/bin/env node
/* =============================================================================
 * tools/rig-report.js — Dónde está cada hueso del modelo real, y dónde estaba
 * el nodo equivalente del maniquí procedural.
 *
 * Existe porque colgar equipo de un rig ajeno es un problema de MEDIDA, no de
 * intuición: el maniquí tenía los hombros 0.20 por encima del pecho y el Elfo
 * Oscuro los tiene 0.116. Adivinarlo cuesta una iteración de capturas por
 * pieza; medirlo, un comando.
 *
 *   node tools/rig-report.js
 *
 * Las posiciones del GLB se leen del propio fichero (nodos + jerarquía), sin
 * navegador. Las del maniquí salen de las constantes de characterVisual.js.
 * ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const GLB = path.join(ROOT, 'assets/models/dark-elf-base-rigged-50k.glb');

/* --- glTF: sólo la cabecera JSON, que es lo único que hace falta ---------- */
const buf = fs.readFileSync(GLB);
if (buf.readUInt32LE(0) !== 0x46546C67) { console.error('No es un GLB'); process.exit(2); }
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));

const nodes = gltf.nodes || [];
const padre = new Map();
nodes.forEach((n, i) => (n.children || []).forEach(c => padre.set(c, i)));

/** Posición mundial de un nodo componiendo traslaciones hasta la raíz. */
function mundo(i) {
  let x = 0, y = 0, z = 0, cur = i;
  while (cur !== undefined) {
    const n = nodes[cur];
    const t = n.translation || [0, 0, 0];
    x += t[0]; y += t[1]; z += t[2];
    cur = padre.get(cur);
  }
  return { x, y, z };
}

const ORDEN = ['Hips','Spine','Chest','Neck','Head',
  'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
  'LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'];

/* El maniquí procedural, derivado de sus propias constantes. */
const ANKLE = 0.075, HIP_SOCKET = 0.04, EXT = 0.985, THIGH = 0.45, SHIN = 0.43;
const UPPER_ARM = 0.30, LOWER_ARM = 0.29;
const limbs = 1.06;                       // elfo oscuro
const hip = ANKLE + (THIGH + SHIN) * limbs * EXT + HIP_SOCKET;
const PROC = {
  Hips: hip, Spine: hip + 0.06, Chest: hip + 0.20, Neck: hip + 0.50, Head: hip + 0.60,
  LeftUpperArm: hip + 0.40, LeftLowerArm: hip + 0.40 - UPPER_ARM,
  LeftHand: hip + 0.40 - UPPER_ARM - LOWER_ARM,
  LeftUpperLeg: hip - HIP_SOCKET, LeftLowerLeg: hip - HIP_SOCKET - THIGH * limbs,
  LeftFoot: hip - HIP_SOCKET - (THIGH + SHIN) * limbs
};
PROC.RightUpperArm = PROC.LeftUpperArm; PROC.RightLowerArm = PROC.LeftLowerArm;
PROC.RightHand = PROC.LeftHand; PROC.RightUpperLeg = PROC.LeftUpperLeg;
PROC.RightLowerLeg = PROC.LeftLowerLeg; PROC.RightFoot = PROC.LeftFoot;

console.log('\nHUESO                  GLB y      GLB x    maniquí y   anclaje (proc − glb)');
console.log('─'.repeat(74));
const idx = new Map(nodes.map((n, i) => [n.name, i]));
let faltan = [];
for (const b of ORDEN) {
  if (!idx.has(b)) { faltan.push(b); continue; }
  const p = mundo(idx.get(b));
  const pr = PROC[b];
  const anc = pr === undefined ? null : pr - p.y;
  console.log(b.padEnd(20) +
    p.y.toFixed(3).padStart(8) + p.x.toFixed(3).padStart(9) +
    (pr === undefined ? '       —' : pr.toFixed(3).padStart(12)) +
    (anc === null ? '' : (anc >= 0 ? '  +' : '  ') + anc.toFixed(3)));
}
if (faltan.length) { console.error('\nFALTAN huesos en el GLB: ' + faltan.join(', ')); process.exit(1); }
console.log('\nEl anclaje es lo que hay que sumar a un offset escrito para el maniquí');
console.log('para que caiga en el mismo sitio sobre el modelo real.\n');
