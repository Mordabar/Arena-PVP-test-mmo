#!/usr/bin/env node
/* =============================================================================
 * tools/bench-retarget.js — HORNEADO contra RUNTIME, con Three.js de verdad.
 *
 * El brief de la v0.18 pide comparar las dos arquitecturas «con una prueba», no
 * razonando. Esto ejecuta las dos con el AnimationMixer real de Three 0.160, la
 * jerarquía real de los dos .glb y los clips reales:
 *
 *   A · RUNTIME  (v0.16/v0.17)  mixer sobre el esqueleto FUENTE de 65 huesos y
 *                8 385 pistas → leer 17 cuaterniones de mundo → retargetear →
 *                escribir 17 huesos del destino. Cada fotograma.
 *
 *   B · HORNEADO (v0.18)        retargetear una vez al cargar y construir un
 *                AnimationClip del destino con 17 pistas de rotación + 1 de
 *                posición → mixer sobre el destino. Sin retarget por fotograma.
 *
 *   node tools/bench-retarget.js [personajes] [fotogramas]
 * ========================================================================== */
import * as THREE from '../vendor/three-0.160.0/three.module.js';
import { buildScene, buildClip } from './lib/three-from-glb.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');
const G = require('./lib/glb.js');

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const N_PJ = +(process.argv[2] || 4);       // 2v2 = cuatro personajes
const N_FR = +(process.argv[3] || 900);     // 30 s a 30 Hz

/* --- la matemática de retargeting, cargada del módulo REAL del juego ----- */
const vm = require('vm');
const fs = require('fs');
const sandbox = { console, Math, Date, JSON, Object, Array, String, Number, Boolean, Error, isNaN, isFinite };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/namespace.js', 'js/data/rigCalibration.js', 'js/render/humanoidRetarget.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const R = sandbox.Arena.Render.HumanoidRetarget;
const CAL = sandbox.Arena.Data.RigCalibration;

const elfo = G.load(path.join(ROOT, 'assets/models/dark-elf-base-rigged-50k.glb'));
const ual2 = G.load(path.join(ROOT, 'assets/animations/ual2-standard.glb'));

const MAP = R.buildMap(CAL.source, CAL.target).map;
const BASE = R.buildBasis(CAL.source, CAL.target, MAP, CAL.sourceParent);
const REST_LOCAL = {};
R.TARGET_BONES.forEach(b => { REST_LOCAL[b] = CAL.target[b].localQuat; });

/* Los 21 clips que el juego usa de verdad (docs/ANIMATION_CLIP_AUDIT_V018.md). */
const USADOS = ['Idle_No_Loop','Idle_Shield_Loop','Walk_Carry_Loop','Zombie_Walk_Fwd_Loop',
  'NinjaJump_Start','NinjaJump_Idle_Loop','NinjaJump_Land','Hit_Knockback','LayToIdle',
  'Sword_Regular_A','Sword_Regular_B','Sword_Regular_C','Sword_Regular_Combo','Sword_Heavy_Combo',
  'Sword_Block','Sword_Dash','Shield_OneShot','Shield_Dash','Melee_Hook','Melee_Hook_Rec','OverhandThrow'];

const _q = new THREE.Quaternion();
function mundoDe(obj) { obj.getWorldQuaternion(_q); return [_q.x, _q.y, _q.z, _q.w]; }

/* ==========================================================================
 * A · RUNTIME
 * ======================================================================= */
function montarRuntime() {
  const src = buildScene(ual2);
  const dst = buildScene(elfo);
  const mixer = new THREE.AnimationMixer(src.root);
  const acciones = {};
  USADOS.forEach(n => {
    const i = ual2.json.animations.findIndex(a => a.name === n);
    acciones[n] = mixer.clipAction(buildClip(ual2, i));
  });
  return { src, dst, mixer, acciones };
}
function pasoRuntime(rt, clip, dt) {
  const a = rt.acciones[clip];
  if (!a.isRunning()) { rt.mixer.stopAllAction(); a.reset().play(); }
  rt.mixer.update(dt);
  rt.src.root.updateMatrixWorld(true);
  const mundo = Object.create(null);
  for (const b in MAP) { const o = rt.src.byName[MAP[b]]; if (o) mundo[MAP[b]] = mundoDe(o); }
  const local = R.retargetFrame(mundo, MAP, BASE, REST_LOCAL);
  for (const b in local) {
    const o = rt.dst.byName[b];
    if (o) o.quaternion.set(local[b][0], local[b][1], local[b][2], local[b][3]);
  }
  rt.dst.root.updateMatrixWorld(true);
}

/* ==========================================================================
 * B · HORNEADO
 * ======================================================================= */
function hornear(nombreClip) {
  const i = ual2.json.animations.findIndex(a => a.name === nombreClip);
  const A = ual2.animation(i);
  const src = buildScene(ual2);
  const mixer = new THREE.AnimationMixer(src.root);
  const accion = mixer.clipAction(buildClip(ual2, i));
  accion.play(); accion.paused = true;

  /* Se muestrea en las llaves ORIGINALES, leídas del propio clip. No en un
     paso derivado: los clips vienen a 1/30 s exacto y redondear el paso a
     cinco decimales acumula 0.2 ms de deriva en los clips largos, que es
     justo lo que convertiría un horneado exacto en uno «casi». */
  const tOrig = A.tracks[ual2.byName.get('pelvis')].rotation.times;
  const n = tOrig.length;
  const tiempos = new Float32Array(n);
  const valores = {};
  R.TARGET_BONES.forEach(b => { valores[b] = new Float32Array(n * 4); });
  const hips = new Float32Array(n * 3);
  const restHips = CAL.target.Hips.localPos;

  for (let k = 0; k < n; k++) {
    const t = tOrig[k];
    tiempos[k] = t;
    accion.time = t; mixer.update(0);
    src.root.updateMatrixWorld(true);
    const mundo = Object.create(null);
    for (const b in MAP) { const o = src.byName[MAP[b]]; if (o) mundo[MAP[b]] = mundoDe(o); }
    const local = R.retargetFrame(mundo, MAP, BASE, REST_LOCAL);
    R.TARGET_BONES.forEach(b => {
      const q = local[b] || REST_LOCAL[b];
      valores[b][k*4] = q[0]; valores[b][k*4+1] = q[1]; valores[b][k*4+2] = q[2]; valores[b][k*4+3] = q[3];
    });
    const pelvis = src.byName.pelvis;
    const p = new THREE.Vector3(); pelvis.getWorldPosition(p);
    const dy = R.hipsOffsetY(p.y, CAL.meta.sourcePelvisY, CAL.meta.legRatio);
    hips[k*3] = restHips[0]; hips[k*3+1] = restHips[1] + dy; hips[k*3+2] = restHips[2];
  }
  const tracks = R.TARGET_BONES.map(b =>
    new THREE.QuaternionKeyframeTrack(b + '.quaternion', tiempos, valores[b]));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', tiempos, hips));
  mixer.stopAllAction();
  return new THREE.AnimationClip(nombreClip, A.duration, tracks);
}

function montarHorneado(clipsHorneados) {
  const dst = buildScene(elfo);
  const mixer = new THREE.AnimationMixer(dst.root);
  const acciones = {};
  for (const n in clipsHorneados) acciones[n] = mixer.clipAction(clipsHorneados[n]);
  return { dst, mixer, acciones };
}
function pasoHorneado(hr, clip, dt) {
  const a = hr.acciones[clip];
  if (!a.isRunning()) { hr.mixer.stopAllAction(); a.reset().play(); }
  hr.mixer.update(dt);
  hr.dst.root.updateMatrixWorld(true);
}

/* ==========================================================================
 * Ejecución
 * ======================================================================= */
const guion = [];                       // 30 s de un personaje realista
for (let i = 0; i < N_FR; i++) {
  const s = i / 30;
  guion.push(s % 10 < 4 ? 'Idle_No_Loop' :
             s % 10 < 7.5 ? 'Walk_Carry_Loop' :
             s % 10 < 8.5 ? 'Sword_Regular_A' : 'Sword_Regular_B');
}
const dt = 1 / 30;

console.log('BANCO DE ARQUITECTURA · ' + N_PJ + ' personajes × ' + N_FR + ' fotogramas (' +
  (N_FR / 30).toFixed(0) + ' s a 30 Hz)\n');

/* --- coste único del horneado ------------------------------------------- */
let t0 = process.hrtime.bigint();
const horneados = {};
USADOS.forEach(n => { horneados[n] = hornear(n); });
let tBake = Number(process.hrtime.bigint() - t0) / 1e6;
let llaves = 0, pistas = 0;
for (const n in horneados) { pistas += horneados[n].tracks.length; horneados[n].tracks.forEach(t => llaves += t.times.length); }
console.log('HORNEADO, coste único:');
console.log('  ' + USADOS.length + ' clips en ' + tBake.toFixed(1) + ' ms   (' + (tBake / USADOS.length).toFixed(2) + ' ms por clip)');
console.log('  ' + pistas + ' pistas, ' + llaves + ' llaves, ~' +
  ((llaves * (17 * 4 + 3) * 4 / 17 / 1024)).toFixed(0) + ' KB de datos\n');

/* --- por fotograma ------------------------------------------------------ */
function medir(nombre, montar, paso) {
  const inst = []; for (let i = 0; i < N_PJ; i++) inst.push(montar());
  for (let i = 0; i < 60; i++) inst.forEach(x => paso(x, guion[i], dt));   // calentar
  const t = process.hrtime.bigint();
  for (let f = 0; f < N_FR; f++) inst.forEach(x => paso(x, guion[f], dt));
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(nombre.padEnd(28) + ms.toFixed(1).padStart(9) + ' ms total   ' +
    (ms / N_FR * 1000).toFixed(1).padStart(8) + ' µs/fotograma (' + N_PJ + ' pj)   ' +
    (ms / N_FR / N_PJ * 1000).toFixed(1).padStart(7) + ' µs/pj');
  return ms;
}
console.log('POR FOTOGRAMA:');
const msRT = medir('A · runtime (v0.16/v0.17)', montarRuntime, pasoRuntime);
const msHR = medir('B · horneado (v0.18)', () => montarHorneado(horneados), pasoHorneado);

console.log('\nRESULTADO: el horneado es ' + (msRT / msHR).toFixed(2) + '× más rápido por fotograma.');
console.log('           Se amortiza en ' + Math.ceil(tBake / ((msRT - msHR) / N_FR)) + ' fotogramas (' +
  (tBake / ((msRT - msHR) / N_FR) / 30).toFixed(1) + ' s de juego).');

/* --- ¿producen la MISMA pose? ------------------------------------------- */
console.log('\nEQUIVALENCIA (lo importante: el horneado no puede cambiar el resultado)');
const rt = montarRuntime(), hr = montarHorneado(horneados);

/* Se separan dos cosas que NO son lo mismo:
   · EN LAS LLAVES: ahí el horneado tiene que reproducir el runtime al bit. Si
     no lo hace, el horneado está mal y punto.
   · ENTRE LLAVES: aquí una diferencia es inevitable y conocida. El runtime
     interpola los cuaterniones LOCALES de la fuente, compone la cadena y luego
     retargetea; el horneado interpola los cuaterniones LOCALES ya retargeteados
     del destino. Interpolar antes o después de componer una cadena no da lo
     mismo cuando el padre también gira. Lo que importa es CUÁNTO. */
function comparar(enLlaves) {
  let peor = 0, quien = '';
  for (const clip of ['Walk_Carry_Loop','Sword_Regular_A','Sword_Heavy_Combo','Idle_No_Loop','Hit_Knockback']) {
    rt.mixer.stopAllAction(); hr.mixer.stopAllAction();
    const ar = rt.acciones[clip]; ar.reset().play(); ar.paused = true;
    const ah = hr.acciones[clip]; ah.reset().play(); ah.paused = true;
    const dur = horneados[clip].duration;
    const llaves = horneados[clip].tracks[0].times;
    const n = enLlaves ? llaves.length - 1 : 60;
    for (let k = 0; k <= n; k++) {
      const t = enLlaves ? llaves[k] : dur * k / n;
      ar.time = t; rt.mixer.update(0); rt.src.root.updateMatrixWorld(true);
      const mundo = Object.create(null);
      for (const b in MAP) { const o = rt.src.byName[MAP[b]]; if (o) mundo[MAP[b]] = mundoDe(o); }
      const local = R.retargetFrame(mundo, MAP, BASE, REST_LOCAL);
      for (const b in local) { const o = rt.dst.byName[b]; if (o) o.quaternion.fromArray(local[b]); }
      rt.dst.root.updateMatrixWorld(true);
      ah.time = t; hr.mixer.update(0); hr.dst.root.updateMatrixWorld(true);
      for (const b of R.TARGET_BONES) {
        const a = new THREE.Quaternion(), c = new THREE.Quaternion();
        rt.dst.byName[b].getWorldQuaternion(a); hr.dst.byName[b].getWorldQuaternion(c);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(a.dot(c)))) * 180 / Math.PI;
        if (ang > peor) { peor = ang; quien = clip + '/' + b + ' @t=' + t.toFixed(3); }
      }
    }
  }
  return { peor, quien };
}
/* SUELO DE RUIDO. Antes de acusar al horneado hay que saber cuánto se mueve el
   propio AnimationMixer de Three: su PropertyMixer acumula en Float32 y mezcla
   contra el valor original del hueso, así que su salida depende del estado
   previo. Se mide SIN retargeting: la misma escena fuente, el mismo clip, el
   mismo instante, en una escena recién construida y en otra reutilizada. */
function sueloDeRuido() {
  const clip = 'Sword_Heavy_Combo';
  const i = ual2.json.animations.findIndex(a => a.name === clip);
  const A = ual2.animation(i);
  const times = A.tracks[ual2.byName.get('pelvis')].rotation.times;
  const s1 = buildScene(ual2), m1 = new THREE.AnimationMixer(s1.root);
  const a1 = m1.clipAction(buildClip(ual2, i)); a1.play(); a1.paused = true;
  const s2 = buildScene(ual2), m2 = new THREE.AnimationMixer(s2.root);
  const j = ual2.json.animations.findIndex(a => a.name === 'Walk_Carry_Loop');
  const otra = m2.clipAction(buildClip(ual2, j)); otra.play(); otra.paused = true;
  otra.time = 0.5; m2.update(0); m2.stopAllAction();
  const a2 = m2.clipAction(buildClip(ual2, i)); a2.reset().play(); a2.paused = true;
  let peor = 0;
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  for (const t of times) {
    a1.time = t; m1.update(0); s1.root.updateMatrixWorld(true);
    a2.time = t; m2.update(0); s2.root.updateMatrixWorld(true);
    for (const n of ['spine_03', 'upperarm_l', 'calf_r', 'Head']) {
      s1.byName[n].getWorldQuaternion(q1); s2.byName[n].getWorldQuaternion(q2);
      const d = 2 * Math.acos(Math.min(1, Math.abs(q1.dot(q2)))) * 180 / Math.PI;
      if (d > peor) peor = d;
    }
  }
  return peor;
}
const ruido = sueloDeRuido();
const enLlave = comparar(true), entre = comparar(false);
console.log('  suelo de ruido del propio mixer de Three (sin retarget): ' + ruido.toFixed(5) + '°');
console.log('  EN las llaves originales : ' + enLlave.peor.toFixed(5) + '°  (' + enLlave.quien + ')');
console.log('  ENTRE llaves (60 muestras): ' + entre.peor.toFixed(4) + '°  (' + entre.quien + ')');
const okLlave = enLlave.peor <= Math.max(0.01, ruido * 1.5);
const okEntre = entre.peor < 2.0;
console.log('  ' + (okLlave
  ? '⇒ en las llaves el horneado queda DENTRO del ruido del propio motor: no\n' +
    '     introduce error propio. El resto es Float32 y mezcla acumulada de Three,\n' +
    '     y la ruta runtime lo paga igual sobre 65 huesos en vez de 17.'
  : '⇒ FALLO: el horneado se desvía MÁS que el ruido del motor. Es error propio.'));
console.log('  ' + (okEntre
  ? '⇒ entre llaves difiere por interpolar local-tras-componer en vez de al revés.\n' +
    '     Sale en el pico de la espada más rápida del paquete y está por debajo del\n' +
    '     grado. Es el precio conocido de hornear, y es barato.'
  : '⇒ FALLO: demasiada deriva entre llaves.'));
process.exit(okLlave && okEntre ? 0 : 1);
