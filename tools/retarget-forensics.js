#!/usr/bin/env node
/* =============================================================================
 * tools/retarget-forensics.js — FASE 0 de la v0.18.
 *
 * Mide los dos esqueletos y los 43 clips SIN navegador y SIN Three.js, para que
 * cada cifra del informe se pueda volver a generar con un comando y nadie tenga
 * que fiarse de una captura.
 *
 *   node tools/retarget-forensics.js            informe completo
 *   node tools/retarget-forensics.js --metodos  sólo la comparación matemática
 *   node tools/retarget-forensics.js --clips    sólo el catálogo de clips
 *   node tools/retarget-forensics.js --rm RUTA  usar un UAL2_Standard_RM.glb
 *
 * El fichero _RM (root motion horneado) NO está en el repo: es el gemelo del
 * que sí está, y sólo hace falta para MEDIR desplazamiento por ciclo. Sin él el
 * informe sale igual, con la columna de velocidad marcada como no medida.
 * ========================================================================== */
'use strict';
const path = require('path');
const G = require('./lib/glb.js');
const P = require('./lib/pose.js');

const ROOT = path.join(__dirname, '..');
const F_ELFO = path.join(ROOT, 'assets/models/dark-elf-base-rigged-50k.glb');
const F_UAL2 = path.join(ROOT, 'assets/animations/ual2-standard.glb');

const args = process.argv.slice(2);
const solo = args.filter(a => a.startsWith('--') && a !== '--rm');
const rmIdx = args.indexOf('--rm');
const F_RM = rmIdx >= 0 ? args[rmIdx + 1] : null;
const quiere = s => !solo.length || solo.includes('--' + s);

const elfo = G.load(F_ELFO);
const ual2 = G.load(F_UAL2);
let rm = null;
if (F_RM) { try { rm = G.load(F_RM); } catch (e) { console.error('AVISO: no se pudo leer ' + F_RM + ' — ' + e.message); } }

/* --------------------------------------------------------------------------
 * Contratos de esqueleto. `child` es el hueso que define el EJE del hueso
 * padre: sin él no existe «dirección del hueso» y no se puede comparar nada.
 * ----------------------------------------------------------------------- */
const T_PARENT = {
  Hips: null, Spine: 'Hips', Chest: 'Spine', Neck: 'Chest', Head: 'Neck',
  LeftUpperArm: 'Chest', LeftLowerArm: 'LeftUpperArm', LeftHand: 'LeftLowerArm',
  RightUpperArm: 'Chest', RightLowerArm: 'RightUpperArm', RightHand: 'RightLowerArm',
  LeftUpperLeg: 'Hips', LeftLowerLeg: 'LeftUpperLeg', LeftFoot: 'LeftLowerLeg',
  RightUpperLeg: 'Hips', RightLowerLeg: 'RightUpperLeg', RightFoot: 'RightLowerLeg'
};
const T_ORDER = Object.keys(T_PARENT);
const T_CHILD = {
  Hips: 'Spine', Spine: 'Chest', Chest: 'Neck', Neck: 'Head', Head: null,
  LeftUpperArm: 'LeftLowerArm', LeftLowerArm: 'LeftHand', LeftHand: null,
  RightUpperArm: 'RightLowerArm', RightLowerArm: 'RightHand', RightHand: null,
  LeftUpperLeg: 'LeftLowerLeg', LeftLowerLeg: 'LeftFoot', LeftFoot: null,
  RightUpperLeg: 'RightLowerLeg', RightLowerLeg: 'RightFoot', RightFoot: null
};
const S_CHILD = {
  pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01',
  neck_01: 'Head', Head: null,
  clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', hand_l: 'middle_01_l',
  clavicle_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r', hand_r: 'middle_01_r',
  thigh_l: 'calf_l', calf_l: 'foot_l', foot_l: 'ball_l', ball_l: 'ball_leaf_l',
  thigh_r: 'calf_r', calf_r: 'foot_r', foot_r: 'ball_r', ball_r: 'ball_leaf_r'
};

/* Mapa por NOMBRE: el que usa js/render/three/threeRetarget.js hoy. */
const MAP_NOMBRE = {
  Hips: 'pelvis', Spine: 'spine_01', Chest: 'spine_03', Neck: 'neck_01', Head: 'Head',
  LeftUpperArm: 'upperarm_l', LeftLowerArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightUpperArm: 'upperarm_r', RightLowerArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpperLeg: 'thigh_l', LeftLowerLeg: 'calf_l', LeftFoot: 'foot_l',
  RightUpperLeg: 'thigh_r', RightLowerLeg: 'calf_r', RightFoot: 'foot_r'
};
/* Mapa por LADO FÍSICO: los huesos `Left*` del Elfo Oscuro están en −X, que es
   el lado DERECHO de un personaje que mira a +Z, así que les toca la fuente _r. */
const MAP_LADO = Object.assign({}, MAP_NOMBRE, {
  LeftUpperArm: 'upperarm_r', LeftLowerArm: 'lowerarm_r', LeftHand: 'hand_r',
  RightUpperArm: 'upperarm_l', RightLowerArm: 'lowerarm_l', RightHand: 'hand_l',
  LeftUpperLeg: 'thigh_r', LeftLowerLeg: 'calf_r', LeftFoot: 'foot_r',
  RightUpperLeg: 'thigh_l', RightLowerLeg: 'calf_l', RightFoot: 'foot_l'
});

/* --------------------------------------------------------------------------
 * Utilidades de medida
 * ----------------------------------------------------------------------- */
const gr = r => r * 180 / Math.PI;
const f3 = v => v.map(x => x.toFixed(3)).join(',');
const ang = (a, b) => gr(Math.acos(Math.max(-1, Math.min(1, G.dot(a, b)))));

function wpos(g, n) { const i = g.byName.get(n); return i === undefined ? null : G.pos(g.worldMatrix(i)); }
function wquat(g, n) { const i = g.byName.get(n); return i === undefined ? null : G.matToQuat(g.worldMatrix(i)); }
function ejeReposo(g, CH, n) {
  const c = CH[n]; if (!c || g.byName.get(c) === undefined) return null;
  return G.normV(G.sub(wpos(g, c), wpos(g, n)));
}
function largo(g, CH, n) {
  const c = CH[n]; if (!c || g.byName.get(c) === undefined) return 0;
  return G.len(G.sub(wpos(g, c), wpos(g, n)));
}

/**
 * Marco anatómico de un hueso en reposo, construido SÓLO con geometría:
 *   columna 0 = eje del hueso (hacia el hijo)
 *   columna 1 = «adelante» del personaje proyectado perpendicular al eje
 *   columna 2 = producto vectorial de los dos
 * Se construye idéntico en los dos rigs, así que dos huesos que se corresponden
 * anatómicamente obtienen marcos que se corresponden — sin mirar los nombres.
 */
function marco(g, CH, n) {
  let d = ejeReposo(g, CH, n) || [0, 1, 0];
  let ref = [0, 0, 1];
  if (Math.abs(G.dot(d, ref)) > 0.94) ref = [0, 1, 0];
  const k = G.dot(d, ref);
  const f = G.normV([ref[0] - d[0] * k, ref[1] - d[1] * k, ref[2] - d[2] * k]);
  const s = [d[1]*f[2] - d[2]*f[1], d[2]*f[0] - d[0]*f[2], d[0]*f[1] - d[1]*f[0]];
  return G.matToQuat([d[0],d[1],d[2],0, f[0],f[1],f[2],0, s[0],s[1],s[2],0, 0,0,0,1]);
}

const Rt = {}, RtLocal = {};
T_ORDER.forEach(b => { Rt[b] = wquat(elfo, b); RtLocal[b] = elfo.local(elfo.byName.get(b)).r; });
const Rs = {};
Object.keys(S_CHILD).forEach(n => { const q = wquat(ual2, n); if (q) Rs[n] = q; });

/** Cuaternión de corrección de base por hueso: B = (Rs⁻¹·Cs)·(Rt⁻¹·Ct)⁻¹ */
function bases(map) {
  const B = {};
  for (const b of T_ORDER) {
    const s = map[b]; if (!Rs[s]) continue;
    const CsL = G.mulQ(G.invQ(Rs[s]), marco(ual2, S_CHILD, s));
    const CtL = G.mulQ(G.invQ(Rt[b]), marco(elfo, T_CHILD, b));
    B[b] = G.mulQ(CsL, G.invQ(CtL));
  }
  return B;
}

/** Los cuatro métodos candidatos. Todos devuelven el cuaternión MUNDIAL destino. */
const METODOS = {
  'M1 delta mundial (actual)': (b, m, As) => G.mulQ(G.mulQ(As, G.invQ(Rs[m[b]])), Rt[b]),
  'M2 delta local sin base':   (b, m, As) => G.mulQ(Rt[b], G.mulQ(G.invQ(Rs[m[b]]), As)),
  'M3 base conjug. (delta)':   (b, m, As, B) => {
    const D = G.mulQ(G.invQ(Rs[m[b]]), As);
    return G.mulQ(Rt[b], G.mulQ(G.invQ(B[b]), G.mulQ(D, B[b])));
  },
  'M4 base conjug. (absoluta)': (b, m, As, B) => G.mulQ(As, B[b])
};

function dirDestino(b, q) {
  const c = T_CHILD[b]; if (!c) return null;
  return G.normV(G.applyQ(q, elfo.local(elfo.byName.get(c)).t));
}
function dirFuente(s, pose) {
  const c = S_CHILD[s]; if (!c || ual2.byName.get(c) === undefined) return null;
  return G.normV(G.sub(P.wp(pose, ual2, c), P.wp(pose, ual2, s)));
}

/* ==========================================================================
 * A · jerarquías y correspondencia
 * ======================================================================= */
function seccionEsqueletos() {
  console.log('\n══ A · ESQUELETOS ═════════════════════════════════════════════════');
  console.log('Elfo Oscuro : ' + elfo.skin(0).joints.length + ' huesos, ' +
    elfo.nodes.length + ' nodos, malla de ' +
    (elfo.json.accessors[elfo.json.meshes[0].primitives[0].indices].count / 3) + ' triángulos');
  console.log('UAL2        : ' + ual2.skin(0).joints.length + ' huesos, ' +
    ual2.nodes.length + ' nodos, ' + ual2.json.animations.length + ' clips');

  console.log('\n-- bind (IBM⁻¹) frente a reposo (nodos) --');
  let peorE = 0, peorU = 0;
  [[elfo, 'Elfo'], [ual2, 'UAL2']].forEach(([g, et]) => {
    const sk = g.skin(0); let peor = 0, quien = '';
    sk.joints.forEach((j, k) => {
      const d = G.len(G.sub(G.pos(G.invert(sk.ibm[k])), G.pos(g.worldMatrix(j))));
      const a = G.angleBetweenQ(G.matToQuat(G.invert(sk.ibm[k])), G.matToQuat(g.worldMatrix(j)));
      const e = Math.max(d, gr(a) / 1000);
      if (e > peor) { peor = e; quien = g.nodes[j].name; }
    });
    if (et === 'Elfo') peorE = peor; else peorU = peor;
    console.log('  ' + et.padEnd(6) + ' desviación máx ' + peor.toFixed(6) + (quien ? ' (' + quien + ')' : '') +
      (peor < 1e-5 ? '   → bind Y reposo son LA MISMA POSE' : '   → OJO: bind ≠ reposo'));
  });

  console.log('\n-- ejes de hueso en reposo (dirección mundial hacia el hijo) --');
  console.log('hueso destino    Elfo Oscuro           fuente        UAL2                  Δ por nombre  Δ por lado');
  for (const b of T_ORDER) {
    const dt = ejeReposo(elfo, T_CHILD, b); if (!dt) continue;
    const sN = MAP_NOMBRE[b], sL = MAP_LADO[b];
    const dN = ejeReposo(ual2, S_CHILD, sN), dL = ejeReposo(ual2, S_CHILD, sL);
    if (!dN) continue;
    console.log(b.padEnd(16) + f3(dt).padEnd(22) + sN.padEnd(14) + f3(dN).padEnd(22) +
      (ang(dt, dN).toFixed(1) + '°').padStart(9) + (dL ? (ang(dt, dL).toFixed(1) + '°').padStart(12) : ''));
  }

  console.log('\n-- lateralidad: ¿de qué lado está cada hueso? (personaje mirando a +Z ⇒ su DERECHA es −X) --');
  [['Elfo', elfo, 'LeftUpperArm', 'RightUpperArm'], ['UAL2', ual2, 'upperarm_l', 'upperarm_r']]
    .forEach(([et, g, izq, der]) => {
      const xi = wpos(g, izq)[0], xd = wpos(g, der)[0];
      console.log('  ' + et.padEnd(6) + izq.padEnd(15) + 'x=' + xi.toFixed(3) +
        '  → lado físico ' + (xi < 0 ? 'DERECHO' : 'IZQUIERDO') +
        (xi < 0 ? '   ✗ el nombre miente' : '   ✓'));
      console.log('  ' + ''.padEnd(6) + der.padEnd(15) + 'x=' + xd.toFixed(3) +
        '  → lado físico ' + (xd > 0 ? 'IZQUIERDO' : 'DERECHO') +
        (xd > 0 ? '   ✗ el nombre miente' : '   ✓'));
    });

  console.log('\n-- longitudes de cadena --');
  console.log('cadena                     Elfo      UAL2    Elfo/UAL2');
  const CAD = [['Hips→Spine','Hips'],['Spine→Chest','Spine'],['Chest→Neck','Chest'],['Neck→Head','Neck'],
    ['UpperArm→LowerArm','LeftUpperArm'],['LowerArm→Hand','LeftLowerArm'],
    ['UpperLeg→LowerLeg','LeftUpperLeg'],['LowerLeg→Foot','LeftLowerLeg']];
  for (const [n, b] of CAD) {
    const a = largo(elfo, T_CHILD, b), c = largo(ual2, S_CHILD, MAP_LADO[b]);
    console.log(n.padEnd(26) + a.toFixed(4).padStart(7) + c.toFixed(4).padStart(10) +
      (c ? (a / c).toFixed(3) : '—').padStart(12));
  }
  const pierna = largo(elfo, T_CHILD, 'LeftUpperLeg') + largo(elfo, T_CHILD, 'LeftLowerLeg');
  const piernaU = largo(ual2, S_CHILD, 'thigh_l') + largo(ual2, S_CHILD, 'calf_l');
  console.log('PIERNA (cadera→tobillo)'.padEnd(26) + pierna.toFixed(4).padStart(7) + piernaU.toFixed(4).padStart(10) +
    (pierna / piernaU).toFixed(3).padStart(12));
  console.log('cadera sobre el suelo'.padEnd(26) + wpos(elfo, 'Hips')[1].toFixed(4).padStart(7) +
    wpos(ual2, 'pelvis')[1].toFixed(4).padStart(10) +
    (wpos(elfo, 'Hips')[1] / wpos(ual2, 'pelvis')[1]).toFixed(3).padStart(12));

  console.log('\n-- articulaciones de la fuente que el destino NO tiene --');
  const usados = new Set(Object.values(MAP_LADO));
  const jn = ual2.skin(0).joints.map(j => ual2.nodes[j].name);
  const dedos = jn.filter(n => /_(0[1-4])_(l|r)$|leaf/.test(n));
  const otras = jn.filter(n => !usados.has(n) && !dedos.includes(n));
  console.log('  dedos y hojas terminales : ' + dedos.length + ' huesos (sin equivalente y sin uso en este juego)');
  console.log('  ESTRUCTURALES perdidas   : ' + otras.join(', '));
  return { peorE, peorU };
}

/* ==========================================================================
 * B · comparación de métodos de retargeting
 * ======================================================================= */
function seccionMetodos(clipName) {
  clipName = clipName || 'Walk_Carry_Loop';
  const ci = ual2.json.animations.findIndex(a => a.name === clipName);
  const A = ual2.animation(ci);
  const N = 24;
  const HUESOS = ['LeftUpperArm','LeftLowerArm','RightUpperArm','RightLowerArm',
    'LeftUpperLeg','LeftLowerLeg','RightUpperLeg','RightLowerLeg','Spine','Chest'];
  const poses = [];
  for (let k = 0; k < N; k++) poses.push(P.samplePose(ual2, A, A.duration * k / N));

  console.log('\n══ B · MÉTODOS DE RETARGETING — clip ' + clipName + ' ════════════════');
  console.log('Error angular medio/máx entre la dirección MUNDIAL del hueso fuente y la del');
  console.log('hueso retargeteado. La dirección del hueso es lo que el ojo ve.');
  const salida = {};
  for (const [etq, map] of [['MAPEO POR NOMBRE (el actual)', MAP_NOMBRE], ['MAPEO POR LADO FÍSICO', MAP_LADO]]) {
    const B = bases(map);
    console.log('\n  ' + etq);
    console.log('  ' + 'hueso'.padEnd(15) + Object.keys(METODOS).map(m => m.padEnd(24)).join(''));
    const tot = {}; Object.keys(METODOS).forEach(m => tot[m] = { s: 0, n: 0, mx: 0 });
    for (const b of HUESOS) {
      const s = map[b]; if (!Rs[s]) continue;
      const cel = [];
      for (const m of Object.keys(METODOS)) {
        let sum = 0, mx = 0, n = 0;
        for (const pose of poses) {
          const As = G.matToQuat(pose.world[ual2.byName.get(s)]);
          const dt = dirDestino(b, METODOS[m](b, map, As, B)), ds = dirFuente(s, pose);
          if (!dt || !ds) continue;
          const a = ang(dt, ds); sum += a; n++; if (a > mx) mx = a;
        }
        tot[m].s += sum; tot[m].n += n; if (mx > tot[m].mx) tot[m].mx = mx;
        cel.push((n ? (sum / n).toFixed(1) + '° / ' + mx.toFixed(1) + '°' : '—').padEnd(24));
      }
      console.log('  ' + b.padEnd(15) + cel.join(''));
    }
    console.log('  ' + '─'.repeat(15 + 24 * 4));
    console.log('  ' + 'TOTAL'.padEnd(15) + Object.keys(METODOS).map(m =>
      ((tot[m].s / tot[m].n).toFixed(1) + '° / ' + tot[m].mx.toFixed(1) + '°').padEnd(24)).join(''));
    salida[etq] = tot;
  }
  console.log('\n  AVISO DE HONESTIDAD: M4 da 0.0° POR CONSTRUCCIÓN — la corrección de base');
  console.log('  se define para que los marcos anatómicos coincidan, y esta métrica mide');
  console.log('  exactamente eso. El 0.0° NO es una nota de calidad de M4; es la prueba de');
  console.log('  que M1/M2/M3 no reproducen la pose de origen. La calidad de M4 se juzga');
  console.log('  con contacto de pie, torsión, y el ojo en el Animation Lab.');
  return salida;
}

/* ==========================================================================
 * C · catálogo de clips
 * ======================================================================= */
function seccionClips() {
  console.log('\n══ C · CATÁLOGO DE LOS ' + ual2.json.animations.length + ' CLIPS ════════════════════════════════');
  console.log('brazo = elevación media del húmero (0°=colgando, 90°=horizontal T-pose)');
  console.log('bucle = diferencia angular entre el primer y el último fotograma');
  console.log(rm ? 'vel   = medida en UAL2_Standard_RM (root motion horneado)'
                 : 'vel   = NO MEDIDA (falta el fichero _RM; pásalo con --rm RUTA)');
  console.log('\nclip                          dur   bucle   brazoI brazoD  apoyo  vel m/s  zancada');
  const filas = [];
  ual2.json.animations.forEach((a, i) => {
    const A = ual2.animation(i), N = 25;
    const eI = [], eD = [], plantado = [];
    let p0 = null, p1 = null;
    for (let k = 0; k < N; k++) {
      const p = P.samplePose(ual2, A, A.duration * k / (N - 1));
      const dI = G.normV(G.sub(P.wp(p, ual2, 'lowerarm_l'), P.wp(p, ual2, 'upperarm_l')));
      const dD = G.normV(G.sub(P.wp(p, ual2, 'lowerarm_r'), P.wp(p, ual2, 'upperarm_r')));
      eI.push(ang(dI, [0, -1, 0])); eD.push(ang(dD, [0, -1, 0]));
      plantado.push(P.wp(p, ual2, 'ball_leaf_l')[1] < 0.03 ? 1 : 0);
      if (k === 0) p0 = p; if (k === N - 1) p1 = p;
    }
    let bucle = 0;
    for (const n of ['pelvis','spine_02','upperarm_l','lowerarm_l','thigh_l','calf_l','foot_l','Head']) {
      const j = ual2.byName.get(n);
      const d = gr(G.angleBetweenQ(G.matToQuat(p0.world[j]), G.matToQuat(p1.world[j])));
      if (d > bucle) bucle = d;
    }
    let vel = null, dist = null;
    if (rm) {
      const ri = rm.json.animations.findIndex(x => x.name === a.name);
      if (ri >= 0) {
        const RA = rm.animation(ri);
        dist = G.len(G.sub(P.wp(P.samplePose(rm, RA, RA.duration), rm, 'root'),
                           P.wp(P.samplePose(rm, RA, 0), rm, 'root')));
        vel = dist / RA.duration;
      }
    }
    const media = x => x.reduce((s, v) => s + v, 0) / x.length;
    const apoyo = 100 * media(plantado);
    filas.push({ name: a.name, dur: A.duration, bucle, eI: media(eI), eD: media(eD), apoyo, vel, dist });
    console.log(a.name.padEnd(28) + A.duration.toFixed(2).padStart(6) +
      ((bucle < 8 ? 'sí ' : 'no ') + '(' + bucle.toFixed(0) + '°)').padStart(10) +
      (media(eI).toFixed(0) + '°').padStart(7) + (media(eD).toFixed(0) + '°').padStart(7) +
      (apoyo.toFixed(0) + '%').padStart(7) +
      (vel === null ? '      —' : vel.toFixed(3).padStart(9)) +
      (dist === null ? '' : dist.toFixed(3).padStart(9)));
  });
  return filas;
}

/* ==========================================================================
 * D · pistas de translation y scale
 * ======================================================================= */
function seccionPistas() {
  console.log('\n══ D · PISTAS DE TRANSLATION Y SCALE ══════════════════════════════');
  const conjuntos = rm ? [[ual2, 'ual2-standard.glb (el del repo)'], [rm, 'UAL2_Standard_RM.glb']]
                       : [[ual2, 'ual2-standard.glb (el del repo)']];
  for (const [g, et] of conjuntos) {
    let mT = 0, mTn = '', mS = 0, mSn = '', mueven = new Set(), nT = 0, nS = 0, nR = 0;
    for (let i = 0; i < g.json.animations.length; i++) {
      const A = g.animation(i);
      for (const n in A.tracks) {
        const nm = g.nodes[n].name, t = A.tracks[n];
        if (t.rotation) nR++;
        if (t.translation) {
          nT++;
          for (let c = 0; c < 3; c++) {
            const col = t.translation.values.map(x => x[c]);
            const d = Math.max(...col) - Math.min(...col);
            if (d > mT) { mT = d; mTn = A.name + '/' + nm; }
            if (d > 0.0005) mueven.add(nm);
          }
        }
        if (t.scale) {
          nS++;
          for (let c = 0; c < 3; c++) {
            const col = t.scale.values.map(x => x[c]);
            const d = Math.max(...col) - Math.min(...col);
            if (d > mS) { mS = d; mSn = A.name + '/' + nm; }
          }
        }
      }
    }
    console.log('  ' + et);
    console.log('    pistas totales: ' + nR + ' rotation, ' + nT + ' translation, ' + nS + ' scale');
    console.log('    variación máx TRANSLATION: ' + mT.toFixed(5) + ' m  (' + mTn + ')');
    console.log('    variación máx SCALE      : ' + mS.toFixed(6) + '  (' + mSn + ')');
    console.log('    huesos que SÍ trasladan  : ' + ([...mueven].join(', ') || 'ninguno'));
    console.log('    ⇒ ' + (mS < 1e-4 ? 'las ' + nS + ' pistas de SCALE son constantes: descartables enteras' : 'hay scale real'));
  }
}

/* ==========================================================================
 * E · calibración con A_TPose y contacto de pie
 * ======================================================================= */
function seccionCalibracion() {
  console.log('\n══ E · CALIBRACIÓN Y CONTACTO ════════════════════════════════════');
  const i = ual2.json.animations.findIndex(a => a.name === 'A_TPose');
  let peor = 0, quien = '';
  if (i >= 0) {
    const A = ual2.animation(i);
    for (const t of [0, A.duration * 0.25, A.duration * 0.5, A.duration * 0.99]) {
      const pose = P.samplePose(ual2, A, t);
      for (const n of Object.keys(S_CHILD)) {
        const j = ual2.byName.get(n); if (j === undefined) continue;
        const d = gr(G.angleBetweenQ(G.matToQuat(pose.world[j]), G.matToQuat(ual2.worldMatrix(j))));
        if (d > peor) { peor = d; quien = n + ' @t=' + t.toFixed(2); }
      }
    }
  }
  console.log('  A_TPose vs pose de reposo del fichero: desviación máx ' + peor.toFixed(4) + '°' +
    (peor < 0.01 ? '  → A_TPose ES la pose de bind. Sirve como referencia de calibración.'
                 : '  → ' + quien + '. NO es la pose de bind.'));

  const wi = ual2.json.animations.findIndex(a => a.name === 'Walk_Carry_Loop');
  const A = ual2.animation(wi), N = 60;
  const py = [], tI = [], tD = [];
  for (let k = 0; k < N; k++) {
    const p = P.samplePose(ual2, A, A.duration * k / N);
    py.push(P.wp(p, ual2, 'pelvis')[1]);
    tI.push(P.wp(p, ual2, 'ball_leaf_l')[1]); tD.push(P.wp(p, ual2, 'ball_leaf_r')[1]);
  }
  console.log('  Walk_Carry_Loop:');
  console.log('    oscilación vertical de pelvis : ' + (Math.max(...py) - Math.min(...py)).toFixed(4) + ' m');
  console.log('    pelvis en reposo ' + wpos(ual2, 'pelvis')[1].toFixed(4) + ' m, en marcha ' +
    (py.reduce((s, v) => s + v, 0) / N).toFixed(4) + ' m  (baja ' +
    (wpos(ual2, 'pelvis')[1] - py.reduce((s, v) => s + v, 0) / N).toFixed(4) + ')');
  console.log('    punta izq bajo 3 cm: ' + (100 * tI.filter(v => v < 0.03).length / N).toFixed(0) +
    '% del ciclo   punta der: ' + (100 * tD.filter(v => v < 0.03).length / N).toFixed(0) + '%');
  console.log('    penetración máx bajo el suelo: ' + Math.min(0, Math.min(...tI, ...tD)).toFixed(4) + ' m');
}

/* ==========================================================================
 * F · pesos de skinning del Elfo Oscuro
 * ======================================================================= */
function seccionSkinning() {
  console.log('\n══ F · SKINNING DEL ELFO OSCURO ══════════════════════════════════');
  const prim = elfo.json.meshes[0].primitives[0];
  const J = elfo.accessor(prim.attributes.JOINTS_0), W = elfo.accessor(prim.attributes.WEIGHTS_0);
  const Pv = elfo.accessor(prim.attributes.POSITION);
  const names = elfo.skin(0).joints.map(j => elfo.nodes[j].name);
  const peso = new Array(names.length).fill(0), verts = new Array(names.length).fill(0);
  let maxInf = 0;
  for (let i = 0; i < J.length; i++) {
    let n = 0;
    for (let k = 0; k < 4; k++) if (W[i][k] > 1e-4) { n++; peso[J[i][k]] += W[i][k]; verts[J[i][k]]++; }
    if (n > maxInf) maxInf = n;
  }
  const tot = peso.reduce((a, b) => a + b, 0);
  console.log('  atributos: ' + Object.keys(prim.attributes).join(', '));
  console.log('  NORMAL en el fichero: ' + (prim.attributes.NORMAL !== undefined ? 'sí' :
    'NO — hay que calcularlas al cargar o la piel sale facetada'));
  console.log('  influencias máx por vértice: ' + maxInf + '   huesos sin peso: ' +
    (names.filter((n, i) => !verts[i]).join(', ') || 'ninguno'));
  console.log('\n  hueso            vértices   % del peso');
  names.forEach((n, i) => console.log('  ' + n.padEnd(16) + String(verts[i]).padStart(8) +
    (100 * peso[i] / tot).toFixed(1).padStart(11)));
  /* El hueso Head domina la mitad del peso. Antes de llamarlo defecto hay que
     mirar DÓNDE están esos vértices: pelo largo por la espalda es correcto. */
  const iH = names.indexOf('Head'); const bajos = [];
  for (let i = 0; i < J.length; i++) {
    let w = 0; for (let k = 0; k < 4; k++) if (J[i][k] === iH) w += W[i][k];
    if (w > 0.5 && Pv[i][1] < 1.45) bajos.push(Pv[i]);
  }
  const z = bajos.map(v => v[2]);
  /* Peso máximo por hueso y AUTORIDAD (peso medio sobre lo que domina). Un
     hueso que nunca pasa de 0.7 no manda de verdad sobre su propia piel. */
  const maxW = new Array(names.length).fill(0), n09 = new Array(names.length).fill(0);
  function autoridad(gamma) {
    const s = new Array(names.length).fill(0), c = new Array(names.length).fill(0);
    for (let i = 0; i < J.length; i++) {
      const acc = {};
      for (let k = 0; k < 4; k++) acc[J[i][k]] = (acc[J[i][k]] || 0) + Math.pow(W[i][k], gamma);
      let t = 0; for (const b in acc) t += acc[b];
      let mejor = -1, mw = 0;
      for (const b in acc) { const w = acc[b] / t; if (w > mw) { mw = w; mejor = +b; } }
      if (mejor >= 0 && mw > 0.34) { s[mejor] += mw; c[mejor]++; }
    }
    return names.map((n, i) => c[i] ? s[i] / c[i] : 0);
  }
  for (let i = 0; i < J.length; i++) {
    const acc = {};
    for (let k = 0; k < 4; k++) acc[J[i][k]] = (acc[J[i][k]] || 0) + W[i][k];
    for (const b in acc) { if (acc[b] > maxW[b]) maxW[b] = acc[b]; if (acc[b] > 0.9) n09[b]++; }
  }
  const a1 = autoridad(1), a2 = autoridad(2), a3 = autoridad(3);
  console.log('\n  hueso            peso máx  w>0.9   autoridad   γ=2    γ=3');
  names.forEach((n, i) => console.log('  ' + n.padEnd(16) + maxW[i].toFixed(3).padStart(8) +
    String(n09[i]).padStart(8) + a1[i].toFixed(3).padStart(11) +
    a2[i].toFixed(3).padStart(7) + a3[i].toFixed(3).padStart(7)));
  const med = a => a.reduce((s, v) => s + v, 0) / a.length;
  console.log('  ' + 'MEDIA'.padEnd(16) + ''.padStart(16) + med(a1).toFixed(3).padStart(11) +
    med(a2).toFixed(3).padStart(7) + med(a3).toFixed(3).padStart(7));
  console.log('  ⇒ sólo ' + names.filter((n, i) => maxW[i] > 0.9).length + ' de ' + names.length +
    ' huesos llegan a controlar del todo un vértice. Pesos muy difuminados.');

  /* ¿Está la articulación del pie donde está el tobillo de la malla? */
  const tob = [];
  for (let i = 0; i < Pv.length; i++) if (Pv[i][1] > 0.09 && Pv[i][1] < 0.12 && Pv[i][0] < 0) tob.push(Pv[i][2]);
  const fz = wpos(elfo, 'LeftFoot')[2];
  console.log('\n  a la altura del tobillo la pierna ocupa z [' + Math.min(...tob).toFixed(3) + ', ' +
    Math.max(...tob).toFixed(3) + ']; el hueso LeftFoot está en z = ' + fz.toFixed(3) +
    (fz > Math.max(...tob) ? '  ⇒ FUERA, por delante: la articulación no está en el tobillo' : '  ⇒ dentro'));

  console.log('\n  vértices dominados por Head por debajo del cuello: ' + bajos.length);
  console.log('    Z [' + Math.min(...z).toFixed(3) + ', ' + Math.max(...z).toFixed(3) + ']  ' +
    'detrás ' + z.filter(v => v < 0).length + ' / delante ' + z.filter(v => v > 0).length);
  console.log('    ⇒ ' + (z.every(v => v < 0)
    ? 'TODOS detrás del cuerpo: es PELO LARGO, no un error de pesado.'
    : 'hay masa delante: revisar, el hueso de la cabeza arrastra el torso.'));
}

/* ------------------------------------------------------------------------ */
console.log('PROJECT ARENA · FASE 0 v0.18 — auditoría forense de retargeting');
console.log('Elfo Oscuro: ' + path.relative(ROOT, F_ELFO));
console.log('UAL2       : ' + path.relative(ROOT, F_UAL2));
console.log('UAL2 _RM   : ' + (rm ? F_RM : 'NO SUMINISTRADO — la columna de velocidad saldrá vacía'));
if (quiere('esqueletos')) seccionEsqueletos();
if (quiere('metodos')) seccionMetodos();
if (quiere('clips')) seccionClips();
if (quiere('pistas')) seccionPistas();
if (quiere('calibracion')) seccionCalibracion();
if (quiere('skinning')) seccionSkinning();
console.log('');
