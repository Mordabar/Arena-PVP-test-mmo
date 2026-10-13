// Carga en Node los clips propios (assets/animations/arena-own-v040.json) como THREE.AnimationClip,
// con el mismo formato que usa threeCmuClips.js en el navegador (pistas bone.quaternion).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../vendor/three-0.160.0/three.module.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function loadOwnClips() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/animations/arena-own-v040.json'), 'utf8'));
  return data.clips.map(src => new THREE.AnimationClip(src.name, src.duration, src.tracks.map(tr =>
    new THREE.QuaternionKeyframeTrack(tr.bone + '.quaternion', new Float32Array(tr.times), new Float32Array(tr.values)))));
}
