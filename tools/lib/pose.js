/* =============================================================================
 * tools/lib/pose.js — muestrear un clip glTF en un instante y componer mundo.
 *
 * Sin Three.js y sin navegador, a propósito: la FASE 0 de la v0.18 tiene que
 * medir lo que hay EN EL FICHERO, no lo que un motor decide después. Three.js
 * rellena valores por defecto, normaliza cuaterniones y elige el camino corto
 * en los slerp; todo eso es correcto en runtime y contaminante en una auditoría.
 * ========================================================================== */
'use strict';
const G = require('./glb.js');

/** Interpolación lineal de un sampler glTF en el instante t. */
function sampleTrack(track, t, isQuat) {
  const times = track.times, vals = track.values;
  if (!times.length) return null;
  if (track.interpolation === 'STEP') {
    let i = 0; while (i + 1 < times.length && times[i + 1] <= t) i++;
    return vals[i].slice();
  }
  if (track.interpolation === 'CUBICSPLINE') {
    /* Cada keyframe son 3 valores: tangente de entrada, valor, tangente de
       salida. Se toma el valor; el proyecto no usa splines y aproximar aquí
       sería inventar precisión que no se necesita para medir. */
    let i = 0; while (i + 1 < times.length && times[i + 1] <= t) i++;
    return vals[i * 3 + 1].slice();
  }
  if (t <= times[0]) return vals[0].slice();
  if (t >= times[times.length - 1]) return vals[times.length - 1].slice();
  let i = 0; while (i + 1 < times.length && times[i + 1] < t) i++;
  const t0 = times[i], t1 = times[i + 1];
  const a = vals[i], b = vals[i + 1];
  const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  if (isQuat) return slerp(a, b, u);
  return a.map((v, k) => v + (b[k] - v) * u);
}

function slerp(a, b, u) {
  let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  let bb = b;
  if (d < 0) { bb = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) return G.normQ(a.map((v, k) => v + (bb[k] - v) * u));
  const th = Math.acos(Math.min(1, d)), s = Math.sin(th);
  const wa = Math.sin((1 - u) * th) / s, wb = Math.sin(u * th) / s;
  return G.normQ(a.map((v, k) => v * wa + bb[k] * wb));
}

/**
 * Pose completa en el instante t.
 * Devuelve { world:{nombre:mat4}, local:{nombre:{t,r,s}} } para TODOS los nodos.
 */
function samplePose(glb, animIndex, t) {
  const A = typeof animIndex === 'number' ? glb.animation(animIndex) : animIndex;
  const local = new Array(glb.nodes.length);
  for (let i = 0; i < glb.nodes.length; i++) {
    const base = glb.local(i), tr = A.tracks[i];
    if (tr) {
      if (tr.translation) base.t = sampleTrack(tr.translation, t, false);
      if (tr.rotation) base.r = G.normQ(sampleTrack(tr.rotation, t, true));
      if (tr.scale) base.s = sampleTrack(tr.scale, t, false);
    }
    local[i] = base;
  }
  const world = new Array(glb.nodes.length);
  function walk(i, parentM) {
    const m = G.mul(parentM, G.compose(local[i].t, local[i].r, local[i].s));
    world[i] = m;
    (glb.nodes[i].children || []).forEach(c => walk(c, m));
  }
  for (let i = 0; i < glb.nodes.length; i++) if (glb.parent[i] === -1) walk(i, G.identity());
  return { world, local, anim: A };
}

/** Matriz mundial de un nodo por nombre. */
function wm(pose, glb, name) {
  const i = glb.byName.get(name);
  return i === undefined ? null : pose.world[i];
}
function wp(pose, glb, name) { const m = wm(pose, glb, name); return m ? G.pos(m) : null; }
function wq(pose, glb, name) { const m = wm(pose, glb, name); return m ? G.matToQuat(m) : null; }

module.exports = { samplePose, sampleTrack, slerp, wm, wp, wq };
