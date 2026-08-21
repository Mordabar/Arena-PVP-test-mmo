/* =============================================================================
 * render/three/threeCmuClips.js — v0.30 · CMU mocap adapter.
 *
 * Converts the offline-retargeted, rotation-only JSON generated from
 * Anims_Only_FBX_V1 into native THREE.AnimationClip objects. Root translation
 * is deliberately absent: simulation owns world motion/yaw and combat RELEASE.
 * ========================================================================== */
import * as THREE from 'three';

export async function loadCmuClips(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error('No se pudo cargar biblioteca CMU Arena: HTTP ' + res.status);
  const data = await res.json();
  const clips = [];
  for (const src of (data.clips || [])) {
    const tracks = [];
    for (const tr of (src.tracks || [])) {
      if (!tr.bone || !Array.isArray(tr.times) || !Array.isArray(tr.values)) continue;
      tracks.push(new THREE.QuaternionKeyframeTrack(
        tr.bone + '.quaternion',
        new Float32Array(tr.times),
        new Float32Array(tr.values)
      ));
    }
    if (!tracks.length) continue;
    const clip = new THREE.AnimationClip(src.name, Number(src.duration) || -1, tracks);
    clip.userData = {
      arenaSource: 'CMU_MOCAP_RETARGET',
      sourceFile: src.source,
      sourceWindow: src.sourceWindow,
      notes: src.notes || ''
    };
    clips.push(clip);
  }
  return { data, clips };
}
