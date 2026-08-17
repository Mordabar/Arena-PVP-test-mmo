/* =============================================================================
 * tools/lib/three-from-glb.mjs — construye el grafo de Three.js y los
 * AnimationClip a partir de un .glb ya parseado, sin GLTFLoader.
 *
 * GLTFLoader necesita `fetch` y un DOM. Para poder ejecutar el banco de pruebas
 * de arquitectura (horneado contra runtime) en Node con el Three.js REAL —no
 * con una maqueta— basta con reconstruir a mano lo que el loader construye:
 * jerarquía de nodos y pistas de animación. Es lo único que el AnimationMixer
 * mira.
 * ========================================================================== */
import * as THREE from '../../vendor/three-0.160.0/three.module.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const G = require('./glb.js');

export function buildScene(glb) {
  const objs = glb.nodes.map((n, i) => {
    const o = new THREE.Bone();
    o.name = n.name || ('node' + i);
    const l = glb.local(i);
    o.position.fromArray(l.t);
    o.quaternion.fromArray(l.r);
    o.scale.fromArray(l.s);
    return o;
  });
  glb.nodes.forEach((n, i) => (n.children || []).forEach(c => objs[i].add(objs[c])));
  const root = new THREE.Group();
  glb.nodes.forEach((n, i) => { if (glb.parent[i] === -1) root.add(objs[i]); });
  root.updateMatrixWorld(true);
  const byName = Object.create(null);
  objs.forEach(o => { if (!byName[o.name]) byName[o.name] = o; });
  return { root, objs, byName };
}

const PATH = { translation: '.position', rotation: '.quaternion', scale: '.scale' };
const TRACK = { translation: THREE.VectorKeyframeTrack, rotation: THREE.QuaternionKeyframeTrack, scale: THREE.VectorKeyframeTrack };

/** AnimationClip de Three con TODAS las pistas del clip original. */
export function buildClip(glb, index, opts) {
  opts = opts || {};
  const A = glb.animation(index);
  const tracks = [];
  for (const node in A.tracks) {
    const nombre = glb.nodes[node].name;
    if (opts.only && !opts.only.has(nombre)) continue;
    for (const p in A.tracks[node]) {
      if (opts.skip && opts.skip.has(p)) continue;
      const t = A.tracks[node][p];
      tracks.push(new TRACK[p](nombre + PATH[p],
        Float32Array.from(t.times),
        Float32Array.from([].concat.apply([], t.values))));
    }
  }
  return new THREE.AnimationClip(A.name, A.duration, tracks);
}
