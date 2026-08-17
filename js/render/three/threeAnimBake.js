/* =============================================================================
 * threeAnimBake.js — v0.18 · horneado de clips UAL2 → Elfo Oscuro
 *
 * PRESENTACIÓN PURA. Nunca escribe vida, recurso, cooldown, GCD, posición, yaw,
 * objetivo ni resultado de habilidad. El root motion de UAL2 se mide fuera de
 * línea para calibrar zancada y velocidad, y aquí se DESCARTA: la posición y el
 * yaw del personaje siguen siendo de la simulación.
 *
 * Qué hace, y por qué así (docs/RETARGET_ARCHITECTURE_V018.md):
 *
 *   1. Mide la pose de REPOSO de los dos esqueletos, en vivo, del propio .glb.
 *   2. Deriva el mapa fuente→destino comparando el LADO FÍSICO, no los nombres.
 *      Los huesos `Left*` del Elfo están en x<0, que es el lado derecho de un
 *      personaje que mira a +Z; mapear por nombre metía el brazo izquierdo de
 *      la fuente en el brazo derecho del modelo, sin reflejarlo.
 *   3. Hornea UNA VEZ cada clip usado, muestreando en sus llaves originales
 *      (30 Hz exactos, sin remuestreo), y produce un THREE.AnimationClip con 17
 *      pistas de rotación local + 1 de posición de cadera.
 *   4. En runtime sólo corre un AnimationMixer sobre el destino. Medido: 11.3×
 *      más barato por fotograma que retargetear 65 huesos cada vez.
 * ========================================================================== */
import * as THREE from 'three';

const _q = new THREE.Quaternion(), _p = new THREE.Vector3();

/** Reposo de un esqueleto: mundo y local por hueso, tal y como lo pide el módulo puro. */
function medirReposo(root, nombres) {
  root.updateMatrixWorld(true);
  const out = Object.create(null);
  for (const n of nombres) {
    const o = root.getObjectByName(n);
    if (!o) continue;
    o.getWorldQuaternion(_q); o.getWorldPosition(_p);
    out[n] = {
      worldQuat: [_q.x, _q.y, _q.z, _q.w],
      worldPos: [_p.x, _p.y, _p.z],
      localQuat: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w],
      localPos: [o.position.x, o.position.y, o.position.z],
      parent: o.parent ? o.parent.name : null
    };
  }
  return out;
}

/**
 * Biblioteca compartida por TODOS los personajes: los clips horneados son
 * inmutables, así que se calculan una vez y se reparten. Lo que es por
 * personaje es el mixer, no el clip.
 */
export function createBakedLibrary(sourceGltf, targetSampleRoot) {
  const R = window.Arena && window.Arena.Render && window.Arena.Render.HumanoidRetarget;
  const SM = window.Arena && window.Arena.Render && window.Arena.Render.AnimationStateMachine;
  if (!R || !SM || !sourceGltf || !sourceGltf.scene || !targetSampleRoot) return null;

  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* --- 1. reposo medido en vivo de los dos esqueletos ------------------- */
  const nombresFuente = [];
  for (const b in R.SOURCE_CHILD) {
    nombresFuente.push(b);
    if (R.SOURCE_CHILD[b]) nombresFuente.push(R.SOURCE_CHILD[b]);
  }
  const srcRoot = sourceGltf.scene;
  const restSrc = medirReposo(srcRoot, nombresFuente);
  const restDst = medirReposo(targetSampleRoot, R.TARGET_BONES);
  const padreFuente = Object.create(null);
  for (const n in restSrc) padreFuente[n] = restSrc[n].parent;

  /* --- 2. mapa por lado físico y corrección de base --------------------- */
  const mapa = R.buildMap(restSrc, restDst);
  const MAP = mapa.map;
  const BASE = R.buildBasis(restSrc, restDst, MAP, padreFuente);
  const REST_LOCAL = Object.create(null);
  R.TARGET_BONES.forEach(b => { if (restDst[b]) REST_LOCAL[b] = restDst[b].localQuat; });

  /* Razón de pierna medida en vivo; si algo falta, cae al valor horneado. */
  const cal = (window.Arena.Data && window.Arena.Data.RigCalibration) || null;
  let legRatio = (cal && cal.meta && cal.meta.legRatio) || 1;
  let restPelvisY = (cal && cal.meta && cal.meta.sourcePelvisY) || 0;
  if (restSrc.thigh_l && restSrc.calf_l && restSrc.foot_l && restDst.LeftUpperLeg) {
    const d = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
    const ls = d(restSrc.thigh_l.worldPos, restSrc.calf_l.worldPos) +
               d(restSrc.calf_l.worldPos, restSrc.foot_l.worldPos);
    const ld = d(restDst.LeftUpperLeg.worldPos, restDst.LeftLowerLeg.worldPos) +
               d(restDst.LeftLowerLeg.worldPos, restDst.LeftFoot.worldPos);
    if (ls > 1e-4) legRatio = ld / ls;
    restPelvisY = restSrc.pelvis.worldPos[1];
  }

  /* --- 3. horneado ------------------------------------------------------ */
  const clipsFuente = Object.create(null);
  (sourceGltf.animations || []).forEach(c => { clipsFuente[c.name] = c; });

  /* Un único esqueleto de muestreo y un único mixer para hornear los 21 clips.
     Se clona la escena fuente para no tocar la que el loader entregó. */
  const muestra = srcRoot.clone(true);
  muestra.visible = false;
  const mixerMuestra = new THREE.AnimationMixer(muestra);
  const nodosFuente = Object.create(null);
  muestra.traverse(o => { if (o.name && !nodosFuente[o.name]) nodosFuente[o.name] = o; });

  const horneados = Object.create(null);
  const mundo = Object.create(null);
  const restHipsPos = restDst.Hips ? restDst.Hips.localPos : [0, 0, 0];

  function hornear(nombre) {
    const clip = clipsFuente[nombre];
    if (!clip) return null;
    /* Tiempos: las llaves ORIGINALES de una pista de rotación cualquiera. Los
       43 clips vienen a 30 Hz exactos, así que esto es sin pérdida. Derivar el
       paso de una constante redondeada acumulaba deriva en los clips largos. */
    let tiempos = null;
    for (const tr of clip.tracks) {
      if (/\.quaternion$/.test(tr.name)) { tiempos = tr.times; break; }
    }
    if (!tiempos || tiempos.length < 2) return null;

    const accion = mixerMuestra.clipAction(clip);
    mixerMuestra.stopAllAction();
    accion.reset().play(); accion.paused = true; accion.setEffectiveWeight(1);

    const n = tiempos.length;
    const times = new Float32Array(n);
    const vals = Object.create(null);
    R.TARGET_BONES.forEach(b => { vals[b] = new Float32Array(n * 4); });
    const hips = new Float32Array(n * 3);

    for (let k = 0; k < n; k++) {
      const t = tiempos[k];
      times[k] = t;
      accion.time = t; mixerMuestra.update(0);
      muestra.updateMatrixWorld(true);
      for (const b in MAP) {
        const o = nodosFuente[MAP[b]];
        if (!o) continue;
        o.getWorldQuaternion(_q);
        mundo[MAP[b]] = [_q.x, _q.y, _q.z, _q.w];
      }
      const local = R.retargetFrame(mundo, MAP, BASE, REST_LOCAL);
      R.TARGET_BONES.forEach(b => {
        const q = local[b] || REST_LOCAL[b] || [0, 0, 0, 1];
        vals[b][k*4] = q[0]; vals[b][k*4+1] = q[1]; vals[b][k*4+2] = q[2]; vals[b][k*4+3] = q[3];
      });
      const pel = nodosFuente.pelvis;
      let dy = 0;
      if (pel) { pel.getWorldPosition(_p); dy = R.hipsOffsetY(_p.y, restPelvisY, legRatio); }
      hips[k*3] = restHipsPos[0];
      hips[k*3+1] = restHipsPos[1] + dy;
      hips[k*3+2] = restHipsPos[2];
    }
    mixerMuestra.stopAllAction();
    mixerMuestra.uncacheAction(clip);

    /* Se guardan las pistas SUELTAS: cada máscara arma su propio AnimationClip
       con el subconjunto que le toca, sin volver a muestrear nada. */
    const pistas = Object.create(null);
    R.TARGET_BONES.forEach(b => {
      pistas[b] = new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, vals[b]);
    });
    pistas.__hips = new THREE.VectorKeyframeTrack('Hips.position', times, hips);
    return { duration: clip.duration, pistas: pistas };
  }

  const usados = SM.clipsUsados();
  const crudos = Object.create(null);
  usados.forEach(n => { const h = hornear(n); if (h) crudos[n] = h; });

  /* Un AnimationClip por (clip, máscara). Comparten los mismos objetos de pista
     —Three no los muta— así que esto no duplica datos, sólo referencias. */
  const MASKS = SM.MASKS;
  for (const nombre in crudos) {
    const h = crudos[nombre];
    horneados[nombre] = Object.create(null);
    for (const m in MASKS) {
      const tracks = MASKS[m].map(b => h.pistas[b]).filter(Boolean);
      if (MASKS[m].indexOf('Hips') >= 0) tracks.push(h.pistas.__hips);
      horneados[nombre][m] = new THREE.AnimationClip(nombre + ':' + m, h.duration, tracks);
    }
  }

  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  const faltan = usados.filter(n => !crudos[n]);

  return {
    map: MAP, basis: BASE, restLocal: REST_LOCAL, restTarget: restDst, restSource: restSrc,
    legRatio: legRatio, clips: horneados,
    /* Diagnóstico para las puertas y el Animation Lab. No se usa en el dibujado. */
    report: {
      bakeMs: Math.round(ms),
      clips: Object.keys(crudos).length,
      pedidos: usados.length,
      faltan: faltan,
      sides: mapa.sides,
      bones: R.TARGET_BONES.length
    },
    has: function (n) { return !!horneados[n]; },
    clipFor: function (n, m) { return horneados[n] ? horneados[n][m || 'full'] : null; },
    createPlayer: function (targetRoot) { return new Player(this, targetRoot); }
  };
}

/* ==========================================================================
 * Player — un mixer por personaje, con crossfade de verdad.
 * ======================================================================= */
function Player(lib, root) {
  this.lib = lib;
  this.root = root;
  this.mixer = new THREE.AnimationMixer(root);
  this.actual = null;          // clave 'clip:mask'
  this.accion = null;
  this.estado = null;
  this.tiempoEstado = 0;
  this.ultimoRate = 1;
}

/**
 * Pide un estado. Si es el mismo que ya sonaba, sólo ajusta la velocidad; si es
 * otro, hace crossfade. Nunca reinicia un clip que ya estaba puesto — ése era
 * el «reinicio involuntario por fotograma» que la lista de defectos pide evitar.
 */
Player.prototype.play = function (sel, dt) {
  this.tiempoEstado += dt;
  if (!sel || !sel.clip) { this.estado = sel ? sel.state : null; return false; }
  const clip = this.lib.clipFor(sel.clip, sel.mask);
  if (!clip) return false;
  const clave = sel.clip + ':' + sel.mask;

  if (clave !== this.actual) {
    const nueva = this.mixer.clipAction(clip);
    nueva.enabled = true;
    nueva.setLoop(sel.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    nueva.clampWhenFinished = !sel.loop;
    nueva.reset().play();
    if (this.accion && this.accion !== nueva) {
      nueva.crossFadeFrom(this.accion, Math.max(0.01, sel.fade || 0.15), true);
    } else {
      nueva.setEffectiveWeight(1);
    }
    this.accion = nueva;
    this.actual = clave;
    this.estado = sel.state;
    this.tiempoEstado = 0;
  } else if (sel.state !== this.estado) {
    this.estado = sel.state;
    this.tiempoEstado = 0;
  }
  const rate = sel.rate || 1;
  if (Math.abs(rate - this.ultimoRate) > 1e-3) {
    this.accion.setEffectiveTimeScale(rate);
    this.ultimoRate = rate;
  }
  /* Una acción no-loop con ventana (el flinch usa el primer tercio del derribo)
     se posiciona a mano: la simulación es quien lleva el reloj del golpe. */
  if (sel.window && sel.amount !== undefined) {
    const d = clip.duration;
    const a = sel.window[0] * d, b = sel.window[1] * d;
    this.accion.time = a + (1 - Math.max(0, Math.min(1, sel.amount))) * (b - a);
  }
  return true;
};

Player.prototype.update = function (dt) { this.mixer.update(Math.max(0, Math.min(0.1, dt))); };
Player.prototype.dispose = function () {
  this.mixer.stopAllAction();
  this.mixer.uncacheRoot(this.root);
  this.lib = null; this.root = null; this.accion = null;
};
