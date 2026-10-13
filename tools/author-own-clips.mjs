#!/usr/bin/env node
/* =============================================================================
 * tools/author-own-clips.mjs — autoría PROPIA de animaciones de arco sobre el
 * maniquí UAL de 65 huesos, horneadas offline.
 *
 *   node --experimental-loader ./tools/tests/three-loader.mjs tools/author-own-clips.mjs
 *
 * POR QUÉ ASÍ
 *   El arco no tiene clip real en las UAL Standard, y el parche anterior lo
 *   fabricaba con clips de PISTOLA más una IK en runtime. Aquí cada pose se
 *   construye desde cero sobre el rig real, sin ningún asset de terceros:
 *     1. se toma Idle_Loop como cuerpo base (dedos, cabeza, respiración),
 *     2. se tuerce la cadera y la columna (arquero de lado),
 *     3. se colocan los pies con IK (postura abierta y plantada),
 *     4. se colocan ambas manos con IK sobre el arco y la cuerda,
 *     5. se guardan los cuaterniones locales de los 65 huesos por fotograma.
 *   El resultado es un JSON de pistas de cuaterniones (mismo formato que
 *   arena-cmu-v031.json), revisable y reproducible: sin IK ni parches en runtime.
 *
 * Canales de pose (cada clip es un conjunto de curvas sobre ellos):
 *   twist    0..1  torsión de cadera/columna hacia la postura de tiro
 *   raise    0..1  brazo del arco: de reposo a extendido hacia el objetivo
 *   draw     0..1  mano de la cuerda: del arco al ancla junto a la cara
 *   release  0..1  retroceso de la mano de la cuerda tras soltar
 *
 * Eje: el personaje mira a +Z, su izquierda es +X. El arco va en la mano
 * IZQUIERDA y la cuerda en la derecha. La dirección de tiro es siempre +Z.
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from '../vendor/three-0.160.0/three.module.js';
import { GLTFLoader } from '../vendor/three-0.160.0/examples/jsm/loaders/GLTFLoader.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'assets/animations/arena-own-v040.json');
const FPS = 30;

/* --- carga del rig real y pose base --------------------------------------- */
const buf = fs.readFileSync(path.join(RAIZ, 'assets/animations/ual1-arena-runtime.glb'));
const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const scene = gltf.scene;
let skinned = null;
scene.traverse(o => { if (o.isSkinnedMesh) skinned = o; });
const bones = skinned.skeleton.bones;
const B = Object.fromEntries(bones.map(b => [b.name, b]));
const need = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
for (const n of need) if (!B[n]) throw new Error('falta el hueso ' + n);

const idle = gltf.animations.find(a => a.name === 'Idle_Loop');
const mixer = new T.AnimationMixer(scene);
mixer.clipAction(idle).play();
mixer.update(idle.duration * 0.5);
scene.updateMatrixWorld(true);
const base = bones.map(b => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
mixer.stopAllAction();

const reset = () => {
  bones.forEach((b, i) => { b.position.copy(base[i].p); b.quaternion.copy(base[i].q); b.scale.copy(base[i].s); });
  scene.updateMatrixWorld(true);
};

/* --- utilidades geométricas ------------------------------------------------ */
const UP = new T.Vector3(0, 1, 0);
const wp = o => o.getWorldPosition(new T.Vector3());
const wq = o => o.getWorldQuaternion(new T.Quaternion());
function setWorldQuat(o, q) {
  const pq = o.parent.getWorldQuaternion(new T.Quaternion()).invert();
  o.quaternion.copy(pq.multiply(q).normalize());
  o.updateMatrixWorld(true);
}
function rotWorld(o, axis, ang) {
  setWorldQuat(o, new T.Quaternion().setFromAxisAngle(axis, ang).multiply(wq(o)));
}

/* IK de dos huesos (hombro→codo→mano, cadera→rodilla→pie) sobre objetos reales. */
function ik(upper, mid, end, target, pole) {
  for (let pass = 0; pass < 2; pass++) {
    const S = wp(upper), E = wp(mid), H = wp(end);
    const l1 = S.distanceTo(E), l2 = E.distanceTo(H);
    const d = target.clone().sub(S), raw = d.length();
    if (raw < 1e-5) return;
    const dir = d.clone().multiplyScalar(1 / raw);
    const dist = Math.max(Math.abs(l1 - l2) + 1e-4, Math.min(l1 + l2 - 1e-4, raw));
    const adj = S.clone().addScaledVector(dir, dist);
    const n = pole.clone().sub(S); n.addScaledVector(dir, -n.dot(dir));
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const elbow = S.clone().addScaledVector(dir, x).addScaledVector(n, h);
    const q1 = new T.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), elbow.clone().sub(S).normalize());
    setWorldQuat(upper, q1.multiply(wq(upper)));
    const E2 = wp(mid), H2 = wp(end);
    const q2 = new T.Quaternion().setFromUnitVectors(H2.clone().sub(E2).normalize(), adj.clone().sub(E2).normalize());
    setWorldQuat(mid, q2.multiply(wq(mid)));
  }
}

const baseFoot = { l: null, r: null };
reset();
baseFoot.l = wq(B.foot_l).clone();
baseFoot.r = wq(B.foot_r).clone();
const baseFootPos = { l: wp(B.foot_l).clone(), r: wp(B.foot_r).clone() };
const baseHeadQ = wq(B.Head).clone();
const baseNeckQ = wq(B.neck_01).clone();

const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerpV = (a, b, t) => a.clone().lerp(b, t);
const DEG = Math.PI / 180;

/* Pose para un estado de canales. `modo`: 'planted' (cadera torcida y pies con
 * IK) o 'run' (cadera al frente, sólo tronco y brazos: para correr/strafear). */
function pose(ch, modo = 'planted') {
  reset();
  const tw = ch.twist;
  /* Cadera y piernas son parte de la MÁSCARA INFERIOR: en juego la base inferior
     de toda la familia 'planted' es Ready (twist fijo), así que aquí no cambian
     entre clips. Sólo la columna y los brazos se animan con `twist`. */
  const LT = modo === 'planted' ? 0.78 : 0;
  const pelvisYaw = -30 * DEG * LT;
  const spine = (modo === 'planted' ? [-12, -12, -11] : [-20, -20, -18]).map(a => a * DEG * tw);
  if (pelvisYaw) rotWorld(B.pelvis, UP, pelvisYaw);
  rotWorld(B.spine_01, UP, spine[0]);
  rotWorld(B.spine_02, UP, spine[1]);
  rotWorld(B.spine_03, UP, spine[2]);
  /* Cabeza: mirar a lo largo de +Z compensando la torsión acumulada. */
  const total = pelvisYaw + spine[0] + spine[1] + spine[2];
  rotWorld(B.neck_01, UP, -total * 0.45);
  rotWorld(B.Head, UP, -total * 0.55 + 4 * DEG * tw);

  /* Pies plantados: postura abierta a lo largo de la línea de tiro. */
  if (modo === 'planted') {
    const px = wp(B.pelvis);
    const fl = new T.Vector3(px.x + 0.06 * LT + baseFootPos.l.x * (1 - LT), 0.103, px.z + 0.30 * LT + baseFootPos.l.z * (1 - LT));
    const fr = new T.Vector3(px.x - 0.06 * LT + baseFootPos.r.x * (1 - LT), 0.104, px.z - 0.26 * LT + baseFootPos.r.z * (1 - LT));
    const face = new T.Vector3(Math.sin(pelvisYaw), 0, Math.cos(pelvisYaw));
    for (const [side, tgt] of [['l', fl], ['r', fr]]) {
      const th = B['thigh_' + side], ca = B['calf_' + side], fo = B['foot_' + side];
      ik(th, ca, fo, tgt, wp(ca).addScaledVector(face, 0.6));
      const footQ = new T.Quaternion().setFromAxisAngle(UP, pelvisYaw * 1.25).multiply(baseFoot[side]);
      setWorldQuat(fo, footQ);
    }
  }

  /* Referencias del torso ya torcido. */
  const Ls = wp(B.upperarm_l), Rs = wp(B.upperarm_r), Hp = wp(B.Head);
  const lat = Ls.clone().sub(Rs).setY(0).normalize();             // hombro derecho → izquierdo
  const fwd = new T.Vector3().crossVectors(lat, UP).normalize();  // hacia donde mira el pecho
  const at = (o, a, f, u) => o.clone().addScaledVector(lat, a).addScaledVector(fwd, f).addScaledVector(UP, u);

  /* Mano del arco. */
  const Llow = at(Ls, 0.30, 0.10, -0.17);
  const Lext = new T.Vector3(Ls.x, Ls.y + 0.03, Ls.z + 0.53);
  let L = lerpV(Llow, Lext, ease(ch.raise));
  /* Mano de la cuerda. */
  const Rlow = at(Rs, 0.10, 0.14, -0.40);
  const Rnock = Lext.clone().add(new T.Vector3(0, -0.02, -0.20));
  const anchor = new T.Vector3(Lext.x, Hp.y - 0.07, Hp.z + 0.04);
  let R = lerpV(lerpV(Rlow, Rnock, ease(ch.raise)), anchor, ease(ch.draw));
  /* Suelta: la cuerda tira de la mano hacia atrás y fuera; el arco cae un poco. */
  R.add(new T.Vector3(0, 0.02, -0.17).multiplyScalar(ch.release)).addScaledVector(fwd, 0.10 * ch.release);
  L.add(new T.Vector3(0, -0.025, 0.02).multiplyScalar(ch.release));
  /* Respiración suave en reposo. */
  L.y += (ch.breath || 0) * 0.008; R.y += (ch.breath || 0) * 0.010;

  const poleL = Ls.clone().add(new T.Vector3(0.25, -0.55, 0.0));
  const poleR = Rs.clone().add(new T.Vector3(-0.50, 0.10, -0.60));
  ik(B.upperarm_l, B.lowerarm_l, B.hand_l, L, poleL);
  ik(B.upperarm_r, B.lowerarm_r, B.hand_r, R, poleR);
  scene.updateMatrixWorld(true);
  return { L, R, anchor, Lext };
}

/* --- curvas por clip -------------------------------------------------------- */
const key = (pts, t) => {                       // pts: [[t, v], ...] con suavizado
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * ease((t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  }
  return pts[pts.length - 1][1];
};

const CLIPS = [
  { name: 'Arena_Archer_Ready', dur: 2.4, loop: true, modo: 'planted',
    ch: t => ({ twist: 0.78, raise: 0, draw: 0, release: 0, breath: Math.sin(t * Math.PI * 2) }) },
  { name: 'Arena_Archer_ReadyRun', dur: 2.4, loop: true, modo: 'run',
    ch: t => ({ twist: 0.78, raise: 0, draw: 0, release: 0, breath: Math.sin(t * Math.PI * 2) }) },
  /* Cargar el arco: de reposo a tensión completa. Al terminar es la pose de
     Shoot en 0.56, así que el paso Notch → Shoot no salta. */
  { name: 'Arena_Archer_Notch', dur: 1.0, loop: false, modo: 'planted',
    ch: t => ({ twist: key([[0, 0.78], [0.45, 1]], t), raise: key([[0, 0], [0.38, 1]], t),
                draw: key([[0.22, 0], [1.0, 1]], t), release: 0 }) },
  /* Disparo completo. La suelta (RELEASE) cae en 0.56, igual que `phases.ranged.impact`. */
  { name: 'Arena_Archer_Shoot', dur: 1.0, loop: false, modo: 'planted',
    ch: t => ({ twist: key([[0, 0.78], [0.20, 1], [0.80, 1], [1, 0.78]], t),
                raise: key([[0, 0], [0.22, 1], [0.78, 1], [1, 0]], t),
                draw: key([[0.10, 0], [0.50, 1], [0.78, 1], [1, 0]], t),
                release: key([[0.55, 0], [0.62, 1], [0.84, 0.35], [1, 0]], t) }) },
  { name: 'Arena_Archer_Buff', dur: 1.2, loop: false, modo: 'planted',
    ch: t => ({ twist: 0.78, raise: key([[0, 0], [0.4, 0.55], [1, 0]], t), draw: 0, release: 0 }) }
];

/* --- horneado --------------------------------------------------------------- */
const out = [];
const frames = {};   // para la hoja de revisión
for (const c of CLIPS) {
  const n = Math.round(c.dur * FPS);
  const times = [], vals = bones.map(() => []);
  const prev = bones.map(() => null);
  frames[c.name] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;                              // 0..1 normalizado para las curvas
    const info = pose(c.ch(t), c.modo);
    // Las curvas reciben t normalizado 0..1; el bucle de respiración da un ciclo exacto.
    times.push(+(t * c.dur).toFixed(5));
    bones.forEach((b, k) => {
      const q = b.quaternion.clone();
      if (prev[k] && prev[k].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      prev[k] = q;
      vals[k].push(q.x, q.y, q.z, q.w);
    });
    const joints = {};
    for (const nm of ['Head', 'neck_01', 'spine_03', 'pelvis', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r',
      'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r']) joints[nm] = wp(B[nm]).toArray().map(v => +v.toFixed(4));
    frames[c.name].push({ t: +t.toFixed(3), joints, targetL: info.L.toArray(), targetR: info.R.toArray() });
  }
  const tracks = [];
  bones.forEach((b, k) => {
    const v = vals[k];
    let moves = false;
    for (let i = 4; i < v.length; i++) if (Math.abs(v[i] - v[i % 4]) > 1e-5) { moves = true; break; }
    if (moves) tracks.push({ bone: b.name, times, values: v.map(x => +x.toFixed(5)) });
    else tracks.push({ bone: b.name, times: [0, +c.dur.toFixed(5)], values: [...v.slice(0, 4), ...v.slice(0, 4)].map(x => +x.toFixed(5)) });
  });
  out.push({ name: c.name, source: 'ARENA_AUTHORED_IK', duration: c.dur, fps: FPS, loop: c.loop, tracks });
}

fs.writeFileSync(SALIDA, JSON.stringify({
  version: '0.40.0', sourcePack: 'ninguno: autoría propia (IK horneada sobre el rig UAL)',
  policy: 'Animaciones originales de Arena. Sin assets de terceros.', clips: out
}));
fs.mkdirSync(path.join(RAIZ, 'agent-qa/own-clips'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'agent-qa/own-clips/frames.json'), JSON.stringify(frames));
console.log('escrito ' + path.relative(RAIZ, SALIDA) + ' · ' + out.map(c => c.name + ' ' + c.tracks.length + 'p').join(' · '));
console.log('tamaño ' + (fs.statSync(SALIDA).size / 1024).toFixed(0) + ' KB');
