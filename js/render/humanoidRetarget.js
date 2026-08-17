/* =============================================================================
 * render/humanoidRetarget.js — v0.18 · matemática de retargeting humanoide.
 *
 * Módulo PURO: sin Three.js, sin DOM, sin acceso a simulación. Existe separado
 * del puente de Three para que `tools/run-tests.js` pueda ejercitarlo en Node,
 * que es donde se puede demostrar que la matemática es correcta antes de que
 * nadie mire una captura.
 *
 * ── El problema, medido en docs/RETARGET_FORENSICS_V018.md ──────────────────
 *
 *   1. Los huesos `Left*` del Elfo Oscuro están en x<0, que es el lado DERECHO
 *      del personaje. Mapear por nombre lleva el brazo izquierdo de la fuente
 *      al brazo derecho del destino, sin reflejarlo. Un espejo no es una
 *      rotación: de ahí los codos invertidos y las piernas cruzadas.
 *
 *   2. UAL2 está en T-pose y el Elfo con los brazos colgando: 72° de diferencia
 *      en el hombro. El método anterior transfería el DELTA respecto al reposo,
 *      así que arrastraba esos 72° intactos en todos los fotogramas de todos
 *      los clips. Peor: el eje del balanceo de brazos de la T-pose es paralelo
 *      al brazo colgante del destino, así que el balanceo se convertía en
 *      TORSIÓN de hombro.
 *
 * ── La solución ────────────────────────────────────────────────────────────
 *
 * Para cada hueso se levanta un MARCO ANATÓMICO en reposo, con el mismo
 * procedimiento en los dos rigs y a partir de geometría, nunca de nombres:
 *
 *      columna 0 = eje del hueso     columna 1 = adelante     columna 2 = lateral
 *
 * Si se quiere que los dos marcos coincidan en todo instante:
 *
 *      At · (Rt⁻¹·Ct) = As · (Rs⁻¹·Cs)
 *  ⇒   At = As · B      con   B = (Rs⁻¹·Cs) · (Rt⁻¹·Ct)⁻¹
 *
 * `B` es constante por hueso y se calcula una vez. Para los huesos cuyos marcos
 * anatómicos ya coinciden en reposo (columna, piernas) esto se reduce
 * exactamente al método anterior — que es la razón de que ésos ya salieran bien.
 * ========================================================================== */
Arena.define('render/humanoidRetarget', [], function (Arena) {
  'use strict';

  var R = {};

  /* --- contrato del esqueleto destino (el del .glb del Elfo Oscuro) ------- */
  R.TARGET_BONES = [
    'Hips','Spine','Chest','Neck','Head',
    'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
    'LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'
  ];
  R.TARGET_PARENT = {
    Hips:null, Spine:'Hips', Chest:'Spine', Neck:'Chest', Head:'Neck',
    LeftUpperArm:'Chest', LeftLowerArm:'LeftUpperArm', LeftHand:'LeftLowerArm',
    RightUpperArm:'Chest', RightLowerArm:'RightUpperArm', RightHand:'RightLowerArm',
    LeftUpperLeg:'Hips', LeftLowerLeg:'LeftUpperLeg', LeftFoot:'LeftLowerLeg',
    RightUpperLeg:'Hips', RightLowerLeg:'RightUpperLeg', RightFoot:'RightLowerLeg'
  };
  R.TARGET_CHILD = {
    Hips:'Spine', Spine:'Chest', Chest:'Neck', Neck:'Head', Head:null,
    LeftUpperArm:'LeftLowerArm', LeftLowerArm:'LeftHand', LeftHand:null,
    RightUpperArm:'RightLowerArm', RightLowerArm:'RightHand', RightHand:null,
    LeftUpperLeg:'LeftLowerLeg', LeftLowerLeg:'LeftFoot', LeftFoot:null,
    RightUpperLeg:'RightLowerLeg', RightLowerLeg:'RightFoot', RightFoot:null
  };

  /* --- contrato del esqueleto fuente (UAL2) ------------------------------- */
  R.SOURCE_CHILD = {
    pelvis:'spine_01', spine_01:'spine_02', spine_02:'spine_03', spine_03:'neck_01',
    neck_01:'Head', Head:null,
    upperarm_l:'lowerarm_l', lowerarm_l:'hand_l', hand_l:null,
    upperarm_r:'lowerarm_r', lowerarm_r:'hand_r', hand_r:null,
    thigh_l:'calf_l', calf_l:'foot_l', foot_l:null,
    thigh_r:'calf_r', calf_r:'foot_r', foot_r:null
  };

  /**
   * PAPEL anatómico de cada hueso destino, y qué huesos de la fuente pueden
   * desempeñarlo. Para los papeles con lado, el candidato correcto NO se elige
   * por el sufijo `_l`/`_r` sino midiendo de qué lado está cada uno.
   * Así el bug del espejo es estructuralmente imposible de repetir.
   */
  R.ROLE = {
    Hips:'pelvis', Spine:'spine', Chest:'chest', Neck:'neck', Head:'head',
    LeftUpperArm:'upperArm', RightUpperArm:'upperArm',
    LeftLowerArm:'lowerArm', RightLowerArm:'lowerArm',
    LeftHand:'hand', RightHand:'hand',
    LeftUpperLeg:'upperLeg', RightUpperLeg:'upperLeg',
    LeftLowerLeg:'lowerLeg', RightLowerLeg:'lowerLeg',
    LeftFoot:'foot', RightFoot:'foot'
  };
  R.ROLE_SOURCE = {
    pelvis:['pelvis'], spine:['spine_01'], chest:['spine_03'], neck:['neck_01'], head:['Head'],
    upperArm:['upperarm_l','upperarm_r'], lowerArm:['lowerarm_l','lowerarm_r'], hand:['hand_l','hand_r'],
    upperLeg:['thigh_l','thigh_r'], lowerLeg:['calf_l','calf_r'], foot:['foot_l','foot_r']
  };

  /**
   * De dónde sale el eje anatómico de cada hueso. Las tres reglas están
   * justificadas con medida en docs/RETARGET_FORENSICS_V018.md §4:
   *
   *   'child'  el hueso tiene hijo en los dos rigs → dirección al hijo.
   *   'parent' hueso hoja que continúa a su padre (la mano sigue al antebrazo).
   *   'world'  hueso hoja que en REPOSO está nivelado igual en los dos rigs.
   *            Medido: los dos personajes miran a +Z, tienen la cabeza recta y
   *            la planta del pie plana en el suelo. Con marcos idénticos, B se
   *            reduce a Rs⁻¹·Rt y la orientación de reposo se conserva exacta.
   */
  R.AXIS_RULE = {
    Hips:'child', Spine:'child', Chest:'child', Neck:'child', Head:'world',
    LeftUpperArm:'child', LeftLowerArm:'child', LeftHand:'parent',
    RightUpperArm:'child', RightLowerArm:'child', RightHand:'parent',
    LeftUpperLeg:'child', LeftLowerLeg:'child', LeftFoot:'world',
    RightUpperLeg:'child', RightLowerLeg:'child', RightFoot:'world'
  };

  /* ======================================================================
   * Cuaterniones [x,y,z,w] y vectores [x,y,z]. Arrays planos a propósito:
   * este módulo tiene que correr igual en Node y en el navegador.
   * =================================================================== */
  function qMul(a, b) {
    return [
      a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
      a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
      a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
      a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
    ];
  }
  function qInv(q) { return [-q[0], -q[1], -q[2], q[3]]; }
  function qNorm(q) {
    var l = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
    if (!(l > 1e-12)) return [0, 0, 0, 1];
    return [q[0]/l, q[1]/l, q[2]/l, q[3]/l];
  }
  function qFromBasis(d, f, s) {
    /* Matriz de rotación por columnas [d f s] → cuaternión. */
    var m00 = d[0], m10 = d[1], m20 = d[2];
    var m01 = f[0], m11 = f[1], m21 = f[2];
    var m02 = s[0], m12 = s[1], m22 = s[2];
    var tr = m00 + m11 + m22, k, x, y, z, w;
    if (tr > 0) { k = 0.5 / Math.sqrt(tr + 1); w = 0.25 / k; x = (m21-m12)*k; y = (m02-m20)*k; z = (m10-m01)*k; }
    else if (m00 > m11 && m00 > m22) { k = 2*Math.sqrt(1+m00-m11-m22); w=(m21-m12)/k; x=0.25*k; y=(m01+m10)/k; z=(m02+m20)/k; }
    else if (m11 > m22) { k = 2*Math.sqrt(1+m11-m00-m22); w=(m02-m20)/k; x=(m01+m10)/k; y=0.25*k; z=(m12+m21)/k; }
    else { k = 2*Math.sqrt(1+m22-m00-m11); w=(m10-m01)/k; x=(m02+m20)/k; y=(m12+m21)/k; z=0.25*k; }
    return qNorm([x, y, z, w]);
  }
  function vSub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function vNorm(v) {
    var l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return l > 1e-9 ? [v[0]/l, v[1]/l, v[2]/l] : [0, 1, 0];
  }
  function vDot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
  function vCross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  R.q = { mul:qMul, inv:qInv, norm:qNorm, fromBasis:qFromBasis };
  R.v = { sub:vSub, norm:vNorm, dot:vDot, cross:vCross };

  /**
   * Marco anatómico ortonormal a partir del eje del hueso.
   * `+Z` es el frente del personaje en los dos ficheros (medido: nariz y punta
   * del pie). Si el eje del hueso es casi paralelo a `+Z`, se usa `+Y` como
   * referencia para que la base no degenere.
   */
  R.frame = function (eje) {
    var d = vNorm(eje);
    var ref = Math.abs(vDot(d, [0, 0, 1])) > 0.94 ? [0, 1, 0] : [0, 0, 1];
    var k = vDot(d, ref);
    var f = vNorm([ref[0]-d[0]*k, ref[1]-d[1]*k, ref[2]-d[2]*k]);
    return qFromBasis(d, f, vCross(d, f));
  };

  /**
   * Mapa destino→fuente derivado MIDIENDO el lado físico, no leyendo nombres.
   *
   *   rest = { nombre: { worldPos:[x,y,z], worldQuat:[x,y,z,w] } }
   *
   * Devuelve { huesoDestino: huesoFuente } y, en `sides`, de qué lado quedó
   * cada uno para que un test lo pueda comprobar.
   */
  R.buildMap = function (sourceRest, targetRest) {
    var map = Object.create(null), sides = Object.create(null), i, b, role, cand;
    for (i = 0; i < R.TARGET_BONES.length; i++) {
      b = R.TARGET_BONES[i];
      role = R.ROLE[b];
      cand = R.ROLE_SOURCE[role] || [];
      if (!targetRest[b]) continue;
      if (cand.length === 1) { if (sourceRest[cand[0]]) map[b] = cand[0]; continue; }
      /* Papel con lado: gana el candidato cuyo x de reposo tiene el MISMO signo
         que el del hueso destino. El nombre no interviene. */
      var xt = targetRest[b].worldPos[0], mejor = null, mejorD = Infinity;
      for (var c = 0; c < cand.length; c++) {
        var s = sourceRest[cand[c]]; if (!s) continue;
        var xs = s.worldPos[0];
        if ((xs < 0) !== (xt < 0)) continue;              // lado equivocado
        var d = Math.abs(Math.abs(xs) - Math.abs(xt));
        if (d < mejorD) { mejorD = d; mejor = cand[c]; }
      }
      if (mejor) { map[b] = mejor; sides[b] = xt < 0 ? 'derecha' : 'izquierda'; }
    }
    return { map: map, sides: sides };
  };

  /** Eje anatómico en reposo de un hueso, según su regla. */
  function ejeDe(rest, nombre, child, parent, regla) {
    if (regla === 'world') return null;                    // marco = mundo
    var r = rest[nombre]; if (!r) return null;
    if (regla === 'parent') {
      var p = parent && rest[parent];
      return p ? vNorm(vSub(r.worldPos, p.worldPos)) : null;
    }
    var c = child && rest[child];
    return c ? vNorm(vSub(c.worldPos, r.worldPos)) : null;
  }

  /**
   * Corrección de base constante por hueso: B = (Rs⁻¹·Cs)·(Rt⁻¹·Ct)⁻¹
   *
   * `sourceParent` hace falta para la regla 'parent' de las manos.
   */
  R.buildBasis = function (sourceRest, targetRest, map, sourceParent) {
    var B = Object.create(null), i, b;
    for (i = 0; i < R.TARGET_BONES.length; i++) {
      b = R.TARGET_BONES[i];
      var s = map[b]; if (!s || !sourceRest[s] || !targetRest[b]) continue;
      var regla = R.AXIS_RULE[b] || 'child';
      var ejeT = ejeDe(targetRest, b, R.TARGET_CHILD[b], R.TARGET_PARENT[b], regla);
      var ejeS = ejeDe(sourceRest, s, R.SOURCE_CHILD[s], sourceParent && sourceParent[s], regla);
      var Ct = ejeT ? R.frame(ejeT) : [0, 0, 0, 1];
      var Cs = ejeS ? R.frame(ejeS) : [0, 0, 0, 1];
      var CsL = qMul(qInv(sourceRest[s].worldQuat), Cs);
      var CtL = qMul(qInv(targetRest[b].worldQuat), Ct);
      B[b] = qNorm(qMul(CsL, qInv(CtL)));
    }
    return B;
  };

  /**
   * Un fotograma: rotaciones MUNDIALES de la fuente → rotaciones LOCALES del
   * destino, listas para escribir en los huesos.
   *
   *   sourceWorld = { huesoFuente: [x,y,z,w] }
   *   devuelve      { huesoDestino: [x,y,z,w] }   en espacio local del padre
   *
   * `fallbackLocal` es la pose local de reposo del destino; se usa para los
   * huesos que el clip no alimenta. Sin ella el método absoluto dejaría esos
   * huesos en T-pose, que es su único riesgo real.
   */
  R.retargetFrame = function (sourceWorld, map, basis, targetRestLocal, out) {
    out = out || Object.create(null);
    var world = Object.create(null), i, b;
    for (i = 0; i < R.TARGET_BONES.length; i++) {
      b = R.TARGET_BONES[i];
      var s = map[b], q = s && sourceWorld[s];
      if (q && basis[b]) world[b] = qNorm(qMul(q, basis[b]));
    }
    /* De mundo a local, en orden de jerarquía. Si a un hueso le falta clip, se
       reconstruye su mundo a partir del padre ya resuelto más su local de
       reposo, para que la cadena siga siendo continua y no aparezca T-pose. */
    for (i = 0; i < R.TARGET_BONES.length; i++) {
      b = R.TARGET_BONES[i];
      var p = R.TARGET_PARENT[b];
      var pw = p ? world[p] : null;
      if (!world[b]) {
        var rl = targetRestLocal && targetRestLocal[b];
        if (!rl) continue;
        world[b] = pw ? qNorm(qMul(pw, rl)) : rl.slice();
        out[b] = rl.slice();
        continue;
      }
      out[b] = pw ? qNorm(qMul(qInv(pw), world[b])) : world[b].slice();
    }
    return out;
  };

  /**
   * Altura de cadera. La zancada y la oscilación vertical de la fuente se
   * trasladan escaladas por la razón de longitud de pierna; la posición
   * horizontal NUNCA se toca — ésa es de la simulación.
   *
   * Devuelve el desplazamiento en Y respecto al reposo del destino, en metros
   * de mundo (el llamante lo divide por la escala del modelo si la hay).
   */
  R.hipsOffsetY = function (sourcePelvisY, sourceRestPelvisY, legRatio) {
    var d = (sourcePelvisY - sourceRestPelvisY) * (legRatio || 1);
    /* Tope de seguridad: ningún clip legítimo mueve la cadera más de 40 cm
       respecto a su reposo, y si lo hace es un clip de suelo que no debería
       estar alimentando la locomoción. */
    return d < -0.40 ? -0.40 : (d > 0.40 ? 0.40 : d);
  };

  /**
   * Velocidad de reproducción para que la zancada del clip case con la
   * velocidad real del personaje. `clipSpeed` se MIDE del clip con root motion
   * (docs/ANIMATION_CLIP_AUDIT_V018.md), no se inventa.
   */
  R.playbackRate = function (desiredSpeed, clipSpeed, min, max) {
    if (!(clipSpeed > 1e-4)) return 1;
    var r = desiredSpeed / clipSpeed;
    min = min === undefined ? 0.55 : min;
    max = max === undefined ? 1.65 : max;
    return r < min ? min : (r > max ? max : r);
  };

  Arena.Render.HumanoidRetarget = R;
  return R;
});
