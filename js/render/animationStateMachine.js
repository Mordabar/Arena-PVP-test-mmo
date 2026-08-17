/* =============================================================================
 * render/animationStateMachine.js — v0.18 · qué clip toca y con qué mezcla.
 *
 * Módulo PURO: sin Three, sin DOM, sin simulación. Recibe el AnimationIntent ya
 * autoritativo y devuelve un estado con su clip, su máscara y su crossfade.
 *
 * Sustituye a la selección por fotograma de la v0.16, que devolvía «clip + fase»
 * y obligaba a re-muestrear el esqueleto fuente entero cada fotograma. Aquí sólo
 * se decide el ESTADO; el tiempo lo lleva el AnimationMixer de Three sobre clips
 * ya horneados (docs/RETARGET_ARCHITECTURE_V018.md §2).
 *
 * REGLA DE HONESTIDAD: un estado que no tiene clip real en UAL2 devuelve
 * `clip:null` y `procedural:true`. No se finge un strafe girando el andar de
 * frente, y no se finge un retroceso reproduciendo el andar al revés — invertir
 * el tiempo no invierte el contacto y sale moonwalk.
 * ========================================================================== */
Arena.define('render/animationStateMachine', [], function (Arena) {
  'use strict';

  var S = {};

  /**
   * Los estados. `clip` a null significa: no hay animación real para esto en el
   * paquete y manda la gramática propia del proyecto.
   *
   *   mask  'full'   los 17 huesos
   *         'lower'  cadera, columna y piernas; los brazos quedan para las
   *                  guardias de arma de cada clase
   *         'upper'  de la columna hacia arriba; no secuestra la locomoción
   *   fade  segundos de crossfade AL ENTRAR en este estado
   */
  S.STATES = {
    IDLE:        { clip:'Idle_No_Loop',        mask:'lower', loop:true,  fade:0.20 },
    IDLE_SHIELD: { clip:'Idle_Shield_Loop',    mask:'lower', loop:true,  fade:0.20 },
    WALK:        { clip:'Walk_Carry_Loop',     mask:'lower', loop:true,  fade:0.16, speed:0.650 },
    RUN:         { clip:'Zombie_Walk_Fwd_Loop',mask:'lower', loop:true,  fade:0.16, speed:1.050 },
    BACKPEDAL:   { clip:null,                  mask:'lower', loop:true,  fade:0.16, procedural:true },
    STRAFE:      { clip:null,                  mask:'lower', loop:true,  fade:0.14, procedural:true },
    TURN:        { clip:null,                  mask:'lower', loop:true,  fade:0.14, procedural:true },
    JUMP_START:  { clip:'NinjaJump_Start',     mask:'lower', loop:false, fade:0.10 },
    AIRBORNE:    { clip:'NinjaJump_Idle_Loop', mask:'lower', loop:true,  fade:0.10 },
    LAND:        { clip:'NinjaJump_Land',      mask:'lower', loop:false, fade:0.10 },
    HIT:         { clip:'Hit_Knockback',       mask:'upper', loop:false, fade:0.08, window:[0, 0.34] },
    KNOCKDOWN:   { clip:'Hit_Knockback',       mask:'full',  loop:false, fade:0.12 },
    GETUP:       { clip:'LayToIdle',           mask:'full',  loop:false, fade:0.12 },
    DEATH:       { clip:'Hit_Knockback',       mask:'full',  loop:false, fade:0.12 },
    ACTION:      { clip:null,                  mask:'full',  loop:false, fade:0.08 }
  };

  /** Familia de acción de combate → clip. Sólo melé tiene material real. */
  S.ACTION_CLIP = {
    light:  ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'],
    heavy:  ['Sword_Heavy_Combo'],
    thrust: ['Sword_Regular_C'],
    shield: ['Shield_OneShot'],
    charge: ['Sword_Dash'],
    block:  ['Sword_Block'],
    kick:   ['Melee_Hook'],
    throw:  ['OverhandThrow']
  };
  /* Casteo y arco NO tienen clip en UAL2 Standard. Se dice, no se disimula. */
  S.SIN_CLIP = ['cast', 'pulse', 'ranged'];

  S.MASKS = {
    full: ['Hips','Spine','Chest','Neck','Head',
      'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
      'LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'],
    lower: ['Hips','Spine','Chest','LeftUpperLeg','LeftLowerLeg','LeftFoot',
      'RightUpperLeg','RightLowerLeg','RightFoot'],
    upper: ['Spine','Chest','Neck','Head',
      'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand']
  };

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  /**
   * Decide el estado del fotograma.
   *
   *   handle     el AnimationIntent ya resuelto (loco/action/cast/cc)
   *   archetype  'melee' | 'archer' | 'caster'
   *
   * Devuelve { state, clip, mask, loop, fade, rate, procedural, window }.
   * `rate` sale de la zancada MEDIDA del clip, nunca de un número inventado.
   */
  S.select = function (handle, archetype, calibration) {
    var L = (handle && handle.loco) || {};
    var A = (handle && handle.action) || {};
    var speed = clamp(L.moveSpeed || 0, 0, 1.6);

    function hecho(nombre, extra) {
      var st = S.STATES[nombre];
      var o = {
        state: nombre, clip: st.clip, mask: st.mask, loop: st.loop, fade: st.fade,
        rate: 1, procedural: !!st.procedural, window: st.window || null
      };
      if (extra) for (var k in extra) o[k] = extra[k];
      return o;
    }

    /* Muerte y control duro mandan sobre todo lo demás.
       El derribo y la levantada salen del MISMO estado de la simulación: la
       mezcla de CC sube deprisa al caer y baja despacio al levantarse (ya era
       así en characterVisual), así que la bajada ES la levantada. */
    if (handle && handle.deadTime > 0) return hecho('DEATH');
    if (handle && handle.cc && handle.cc.rootPitch > 0.8 && (handle.ccBlend || 0) > 0.02) {
      return (handle.ccBlend > 0.5) ? hecho('KNOCKDOWN') : hecho('GETUP');
    }

    /* Salto. La fase la lleva la simulación; aquí sólo se elige el tramo. */
    if (L.airborne) {
      var jp = clamp(L.jumpPhase || 0, 0, 1);
      if (jp < 0.20) return hecho('JUMP_START');
      if (jp > 0.82) return hecho('LAND');
      return hecho('AIRBORNE');
    }
    if ((L.landingAmount || 0) > 0.08) return hecho('LAND');

    /* Acción de combate. Sólo melé tiene clips reales; el resto sigue con la
       gramática propia y se marca como tal para que nadie lo cuente como
       resuelto. La simulación es quien dice cuándo empieza y acaba: el clip no
       decide RELEASE ni libera el GCD. */
    if (A.family) {
      var sinClip = S.SIN_CLIP.indexOf(A.family) >= 0;
      var lista = S.ACTION_CLIP[A.family];
      if (archetype === 'melee' && !sinClip && lista && lista.length) {
        var v = (A.variant || 0) % lista.length;
        return hecho('ACTION', { clip: lista[v], procedural: false, family: A.family });
      }
      return hecho('ACTION', { clip: null, procedural: true, family: A.family });
    }

    /* Golpe recibido: sólo tronco, y nunca congela las piernas. */
    var hit = clamp(L.hitAmount || 0, 0, 1);
    if (hit > 0.08 && !(handle && handle.casting)) return hecho('HIT', { amount: hit });

    /* Locomoción. Adelante tiene clip; atrás, lateral y giro no. */
    var f = L.moveForward || 0, r = L.moveRight || 0;
    if (speed > 0.06) {
      var lateral = Math.abs(r) > 0.55 && Math.abs(f) < 0.45;
      if (lateral) return hecho('STRAFE');
      if (f < -0.20) return hecho('BACKPEDAL');
      if (Math.abs(f) >= 0.20) {
        /* La velocidad real del personaje viene en m/s de la simulación. El
           clip se estira o se encoge para que la zancada case. */
        var mps = L.metersPerSecond;
        if (mps === undefined) mps = speed * 4.2;   // sin dato, escala nominal
        if (f < 0) mps = Math.abs(mps);
        var usarRun = mps > 0.95;
        var nombre = usarRun ? 'RUN' : 'WALK';
        var clipSpeed = S.STATES[nombre].speed;
        if (calibration && calibration.clips && calibration.clips[S.STATES[nombre].clip]) {
          var med = calibration.clips[S.STATES[nombre].clip].rootSpeed;
          if (med) clipSpeed = med;
        }
        var rate = Arena.Render.HumanoidRetarget
          ? Arena.Render.HumanoidRetarget.playbackRate(mps, clipSpeed)
          : 1;
        return hecho(nombre, { rate: rate });
      }
    }
    if (Math.abs(L.turnRate || 0) > 0.12) return hecho('TURN');
    return hecho(archetype === 'melee' && handle && handle.shield ? 'IDLE_SHIELD' : 'IDLE');
  };

  /** Clips que hay que hornear: los que algún estado puede pedir. */
  S.clipsUsados = function () {
    var set = Object.create(null), n;
    for (n in S.STATES) if (S.STATES[n].clip) set[S.STATES[n].clip] = true;
    for (n in S.ACTION_CLIP) S.ACTION_CLIP[n].forEach(function (c) { set[c] = true; });
    return Object.keys(set);
  };

  Arena.Render.AnimationStateMachine = S;
  return S;
});
