#!/usr/bin/env node
/* =============================================================================
 * tools/bake-rig-calibration.js — genera js/data/rigCalibration.js
 *
 * La pose de reposo de los dos esqueletos y la velocidad real de cada clip son
 * DATOS MEDIDOS, no constantes escritas a mano. Este generador los saca de los
 * .glb y los deja en un módulo de datos para que:
 *
 *   · las pruebas de Node puedan ejercitar la matemática de retargeting sin
 *     poder leer ficheros binarios (el sandbox de run-tests.js no tiene fs);
 *   · las velocidades del gemelo _RM —que NO está en el repo por tamaño—
 *     sobrevivan como número aunque el fichero no viaje;
 *   · una puerta pueda comparar lo medido en vivo con lo horneado y avisar si
 *     alguien cambia un asset sin regenerar.
 *
 *   node tools/bake-rig-calibration.js [--rm RUTA_AL_UAL2_Standard_RM.glb]
 * ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const G = require('./lib/glb.js');
const P = require('./lib/pose.js');

const ROOT = path.join(__dirname, '..');
const SALIDA = path.join(ROOT, 'js/data/rigCalibration.js');
const rmIdx = process.argv.indexOf('--rm');
const F_RM = rmIdx >= 0 ? process.argv[rmIdx + 1] : null;

const elfo = G.load(path.join(ROOT, 'assets/models/dark-elf-base-rigged-50k.glb'));
const ual2 = G.load(path.join(ROOT, 'assets/animations/ual2-standard.glb'));
let rm = null;
if (F_RM) { try { rm = G.load(F_RM); } catch (e) { console.error('AVISO: sin _RM — ' + e.message); } }

const T_BONES = ['Hips','Spine','Chest','Neck','Head',
  'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
  'LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'];
const S_BONES = ['pelvis','spine_01','spine_02','spine_03','neck_01','Head',
  'clavicle_l','upperarm_l','lowerarm_l','hand_l','clavicle_r','upperarm_r','lowerarm_r','hand_r',
  'thigh_l','calf_l','foot_l','ball_l','thigh_r','calf_r','foot_r','ball_r'];

const r4 = v => Math.round(v * 1e5) / 1e5;
function reposo(g, nombres) {
  const out = {};
  for (const n of nombres) {
    const i = g.byName.get(n); if (i === undefined) continue;
    const w = g.worldMatrix(i), l = g.local(i);
    out[n] = {
      worldPos: G.pos(w).map(r4),
      worldQuat: G.matToQuat(w).map(r4),
      localPos: l.t.map(r4),
      localQuat: G.normQ(l.r).map(r4),
      parent: g.parent[i] >= 0 ? (g.nodes[g.parent[i]].name || null) : null
    };
  }
  return out;
}
const restElfo = reposo(elfo, T_BONES);
const restUal2 = reposo(ual2, S_BONES);

/* Padre de cada hueso fuente, que la regla de eje 'parent' necesita. */
const padreUal2 = {};
S_BONES.forEach(n => { if (restUal2[n]) padreUal2[n] = restUal2[n].parent; });

/* Metadatos por clip: duración, ritmo real de llaves y velocidad del _RM. */
const clips = {};
ual2.json.animations.forEach((a, i) => {
  const A = ual2.animation(i);
  const t = A.tracks[ual2.byName.get('pelvis')].rotation.times;
  let dt = 0; for (let k = 1; k < t.length; k++) dt = Math.max(dt, t[k] - t[k - 1]);
  let dist = null;
  if (rm) {
    const ri = rm.json.animations.findIndex(x => x.name === a.name);
    if (ri >= 0) {
      const RA = rm.animation(ri);
      dist = G.len(G.sub(P.wp(P.samplePose(rm, RA, RA.duration), rm, 'root'),
                         P.wp(P.samplePose(rm, RA, 0), rm, 'root')));
    }
  }
  clips[a.name] = {
    duration: r4(A.duration),
    keys: t.length,
    keyStep: r4(dt),
    rootDistance: dist === null ? null : r4(dist),
    rootSpeed: dist === null ? null : r4(dist / Math.max(1e-4, A.duration))
  };
});

const pierna = (r, a, b, c) =>
  Math.hypot(...G.sub(r[b].worldPos, r[a].worldPos)) + Math.hypot(...G.sub(r[c].worldPos, r[b].worldPos));
const legElfo = pierna(restElfo, 'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot');
const legUal2 = pierna(restUal2, 'thigh_l', 'calf_l', 'foot_l');

const meta = {
  generado: 'tools/bake-rig-calibration.js',
  fuente: 'assets/animations/ual2-standard.glb',
  destino: 'assets/models/dark-elf-base-rigged-50k.glb',
  rmMedido: !!rm,
  legRatio: r4(legElfo / legUal2),
  targetHipsY: r4(restElfo.Hips.worldPos[1]),
  sourcePelvisY: r4(restUal2.pelvis.worldPos[1])
};

const js = `/* =============================================================================
 * data/rigCalibration.js — GENERADO. No editar a mano.
 *
 *   node tools/bake-rig-calibration.js --rm RUTA_AL_UAL2_Standard_RM.glb
 *
 * Pose de reposo medida de los dos esqueletos y metadatos de los ${ual2.json.animations.length} clips.
 * Las velocidades salen del gemelo con root motion horneado, que NO viaja en el
 * repo por tamaño: aquí sobreviven como número.
 * ========================================================================== */
Arena.define('data/rigCalibration', [], function (Arena) {
  'use strict';
  var C = ${JSON.stringify({ meta: meta, target: restElfo, source: restUal2, sourceParent: padreUal2, clips: clips }, null, 1)};
  Arena.Data.RigCalibration = C;
  return C;
});
`;
fs.writeFileSync(SALIDA, js);
console.log('escrito ' + path.relative(ROOT, SALIDA) + '  (' + (js.length / 1024).toFixed(1) + ' KB)');
console.log('  huesos destino ' + Object.keys(restElfo).length + ', fuente ' + Object.keys(restUal2).length +
  ', clips ' + Object.keys(clips).length);
console.log('  legRatio ' + meta.legRatio + '   root motion medido: ' + (rm ? 'sí' : 'NO'));
