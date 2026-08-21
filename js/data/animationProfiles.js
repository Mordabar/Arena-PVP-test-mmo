/* =============================================================================
 * data/animationProfiles.js — v0.34 · literal UAL timing + archer facing correction.
 *
 * Presentación pura expresada como DATOS. No contiene ids de habilidades ni
 * reglas de combate. El objetivo es que BASE → ARQUETIPO → CLASE pueda alterar
 * silueta, guardia y lenguaje de casteo sin ramificar el renderer por poder.
 *
 * `source` describe con honestidad de dónde sale cada estado central. Un estado
 * procedural puede ser FINAL si está diseñado específicamente para Arena; lo que
 * no puede ser es un clip semánticamente incorrecto disfrazado de solución.
 * ========================================================================== */
Arena.define('data/animationProfiles', ['data/animConfig'], function (Arena) {
  'use strict';

  var AP = {};
  AP.SOURCE = {
    EXTERNAL_CC0: 'EXTERNAL_CC0',
    ARENA_PROCEDURAL: 'ARENA_PROCEDURAL',
    ARENA_AUTHORED: 'ARENA_AUTHORED',
    ARENA_ADDITIVE: 'ARENA_ADDITIVE',
    EXTERNAL_DERIVED: 'EXTERNAL_CC0_DERIVED'
  };
  AP.STATUS = {
    FINAL: 'FINAL',
    ADDITIVE: 'ADDITIVE',
    MISSING: 'MISSING',
    SEMANTIC_PLACEHOLDER: 'SEMANTIC_PLACEHOLDER',
    PROVISIONAL: 'PROVISIONAL',
    BLOCKED_SOURCE_CLIP: 'BLOCKED_SOURCE_CLIP',
    EMPTY_INTENTIONAL: 'EMPTY_INTENTIONAL'
  };

  /* Cobertura canónica del vertical slice. Esta tabla no elige clips; permite
     auditar que ningún core state acabe marcado como placeholder o missing. */
  AP.CORE = {
    IDLE:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Idle_Loop'},
    WALK:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Walk_Loop'},
    RUN:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Jog_Fwd_Loop'},
    SPRINT:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Sprint_Loop'},
    BACKPEDAL:{source:AP.SOURCE.EXTERNAL_DERIVED,status:AP.STATUS.PROVISIONAL,clip:'Arena_CMU_Walk_Backward'},
    STRAFE:{source:AP.SOURCE.EXTERNAL_DERIVED,status:AP.STATUS.PROVISIONAL,clip:'Arena_CMU_Strafe_Left/Right'},
    DIAGONAL:{source:AP.SOURCE.EXTERNAL_DERIVED,status:AP.STATUS.PROVISIONAL,clip:'Arena_CMU_Diagonal_*'},
    TURN:{source:AP.SOURCE.EXTERNAL_DERIVED,status:AP.STATUS.PROVISIONAL,clip:'Arena_CMU_Turn_Left/Right'},
    JUMP_START:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Jump_Start'},
    AIRBORNE:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Jump_Loop'},
    LAND:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Jump_Land'},
    HIT_NORMAL:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Hit_Chest'},
    HIT_POWER:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Hit_Head'},
    KNOCKDOWN:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Slide_Start/Slide_Loop'},
    GETUP:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Slide_Exit'},
    DEATH:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Death01'},
    WARRIOR_COMBAT:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Sword_Idle'},
    GUARDIAN_COMBAT:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Idle_Shield_Loop'},
    NORMAL_1H:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Sword_Regular_A/B + *_Rec'},
    POWER_1H:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Sword_Regular_C'},
    NORMAL_2H:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Sword_Regular_A/B + *_Rec'},
    POWER_2H:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Sword_Regular_C'},
    KICK:{source:AP.SOURCE.EXTERNAL_DERIVED,status:AP.STATUS.PROVISIONAL,clip:'Arena_CMU_Kick'},
    SHIELD_POWER:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Shield_Dash_RM'},
    SHIELD_BUFF:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Shield_OneShot'},
    CHARGE:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.PROVISIONAL,clip:'Sword_Dash'},
    WARRIOR_BUFF:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.PROVISIONAL,clip:'Yes'},
    ARCHER_READY:{source:AP.SOURCE.ARENA_AUTHORED,status:AP.STATUS.PROVISIONAL,clip:'Bow_Aim_Neutral -> Arena_Archer_VideoReady'},
    ARCHER_SHOT:{source:AP.SOURCE.ARENA_AUTHORED,status:AP.STATUS.PROVISIONAL,clip:'Bow_Shoot -> Arena_Archer_VideoShoot'},
    ARCHER_CHARGE:{source:AP.SOURCE.ARENA_AUTHORED,status:AP.STATUS.PROVISIONAL,clip:'Bow_Notch -> Arena_Archer_VideoNotch'},
    CASTER_READY:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Spell_Simple_Idle_Loop'},
    STAFF_NORMAL:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Spell_Simple_Shoot'},
    CAST:{source:AP.SOURCE.EXTERNAL_CC0,status:AP.STATUS.FINAL,clip:'Spell_Simple_Enter/Idle_Loop/Shoot/Exit'},
    ROOT:{source:AP.SOURCE.ARENA_ADDITIVE,status:AP.STATUS.ADDITIVE},
    STUN:{source:AP.SOURCE.ARENA_ADDITIVE,status:AP.STATUS.ADDITIVE}
  };

  /* Legacy canonical overlays retained only for procedural states that remain
     blocked. Native UAL clips bypass them; no armor/equipment identity depends
     on this table in v0.25. */
  AP.CLASSES = {
    devastador: {
      readiness:1.04, hipsY:-0.034,
      hips:{x:-0.070,y:0.055,z:0}, spine:{x:-0.075,y:-0.040,z:0}, chest:{x:-0.125,y:0.075,z:0.020}, head:{x:0.025,y:-0.025,z:0},
      lLeg:{x:0.030,y:0,z:0.075}, rLeg:{x:0.030,y:0,z:-0.075},
      lArm:{x:-0.10,y:-0.05,z:0.10}, rArm:{x:-0.22,y:0.08,z:-0.12}
    },
    guardian: {
      readiness:1.03, hipsY:-0.052,
      hips:{x:0.025,y:-0.030,z:0}, spine:{x:0.030,y:0.015,z:0}, chest:{x:0.010,y:-0.045,z:0}, head:{x:-0.010,y:0.020,z:0},
      lLeg:{x:0.080,y:0,z:0.120}, rLeg:{x:0.080,y:0,z:-0.120},
      lArm:{x:-0.34,y:-0.16,z:0.24}, rArm:{x:-0.11,y:0.025,z:-0.065}
    },
    centinela: {
      readiness:0.92, hipsY:-0.006,
      hips:{x:-0.015,y:0.015,z:0}, spine:{x:-0.010,y:-0.015,z:0}, chest:{x:-0.025,y:0.025,z:0}, head:{x:0.010,y:-0.010,z:0},
      lLeg:{x:0,y:0,z:0.025}, rLeg:{x:0,y:0,z:-0.025},
      lArm:{x:-0.11,y:-0.02,z:-0.02}, rArm:{x:-0.05,y:0.025,z:0.035}
    },
    rastreador: {
      readiness:1.04, hipsY:-0.038,
      hips:{x:0.065,y:-0.035,z:0.018}, spine:{x:0.055,y:0.030,z:-0.015}, chest:{x:0.075,y:-0.040,z:-0.018}, head:{x:-0.035,y:0.025,z:0.015},
      lLeg:{x:0.055,y:0,z:0.055}, rLeg:{x:0.055,y:0,z:-0.055},
      lArm:{x:-0.03,y:-0.04,z:0.07}, rArm:{x:0.02,y:0.06,z:-0.05}
    },
    arcanista: {
      readiness:1.00, hipsY:-0.010,
      hips:{x:-0.015,y:0.030,z:0}, spine:{x:-0.025,y:-0.050,z:0.010}, chest:{x:-0.045,y:0.090,z:0.018}, head:{x:0.010,y:-0.045,z:-0.008},
      lLeg:{x:0,y:0,z:0.020}, rLeg:{x:0,y:0,z:-0.020},
      lArm:{x:-0.16,y:-0.08,z:0.12}, rArm:{x:-0.07,y:0.03,z:-0.04}
    },
    vinculador: {
      readiness:0.88, hipsY:-0.004,
      hips:{x:0.005,y:-0.018,z:0}, spine:{x:-0.018,y:0.018,z:0}, chest:{x:-0.070,y:-0.035,z:0}, head:{x:0.012,y:0.018,z:0},
      lLeg:{x:0,y:0,z:0.030}, rLeg:{x:0,y:0,z:-0.030},
      lArm:{x:-0.24,y:-0.10,z:0.20}, rArm:{x:-0.03,y:0.00,z:-0.02}
    }
  };

  AP.CAST = {
    projectile:{ staffFwd:0.38, freeHand:0.48, chest:0.14, open:-0.08, stanceLow:0.02, staffDown:0.00, releaseYaw:0.24 },
    control:   { staffFwd:-0.02,freeHand:1.18, chest:0.30, open:0.16,  stanceLow:0.10, staffDown:0.00, releaseYaw:0.34 },
    buff:      { staffFwd:-0.20,freeHand:0.70, chest:-0.06,open:-0.15, stanceLow:0.00, staffDown:0.00, releaseYaw:0.12 },
    heal:      { staffFwd:-0.20,freeHand:1.12, chest:-0.22,open:0.62,  stanceLow:0.00, staffDown:0.00, releaseYaw:-0.08 },
    aoe:       { staffFwd:0.06, freeHand:0.34, chest:0.26, open:0.28,  stanceLow:0.42, staffDown:0.78, releaseYaw:0.12 },
    channel:   { staffFwd:0.15, freeHand:0.85, chest:0.06, open:0.25,  stanceLow:0.12, staffDown:0.00, releaseYaw:0.18 },
    instant:   { staffFwd:0.25, freeHand:0.45, chest:0.08, open:0.00,  stanceLow:0.00, staffDown:0.00, releaseYaw:0.16 }
  };


  /* -----------------------------------------------------------------------
   * v0.20 · WARRIOR AUTHORED CLIPS
   *
   * Los paquetes Standard suministrados no contienen backpedal/strafe/turn dedicados. En v0.19
   * esos estados se sintetizaban continuamente con senos/cosenos. Funcionaban,
   * pero en captura seguían leyendo como marioneta. v0.20 los convierte en
   * clips keyframed propios de Arena: siguen siendo originales, se mezclan con
   * AnimationMixer y dejan la simulación como única autoridad de posición/yaw.
   *
   * Las rotaciones son offsets locales XYZ sobre el bind canónico; en el camino
   * directo de guerrero se hornean sobre el rig UAL de 65 joints. `t` es
   * 0..1 del clip; `hipsY` es desplazamiento vertical visual, nunca root motion.
   * --------------------------------------------------------------------- */
  function P(t, hipsY, bones) { return {t:t, hipsY:hipsY||0, bones:bones||{}}; }
  function B(x,y,z){ return [x||0,y||0,z||0]; }
  /* Old Arena-authored melee/directional clips were deleted in the v0.25
     reset. Missing Source clips remain blocked instead of silently replaced. */
  AP.AUTHORED_CLIPS = {};

  /* v0.21 — directional locomotion derived offline-at-load from the native
     UAL gait. The Standard package does not ship backward/strafe/turn clips.
     These transforms preserve the source cycle and 65-joint hierarchy while
     changing only PRESENTATION pose; entity translation/yaw remains simulation-owned. */
  /* Failed v0.21 experiment intentionally disabled: remapping a forward jog
     produced cross-legged strafe and a forward-leaning backpedal in runtime.
     Directional states use Arena-authored clips until a real 8-way source pack
     is available. */
  AP.DERIVED_LOCOMOTION = {};

  AP.ACTION_CLIPS = {
    Sword_Attack:{start:0.08,contact:0.60,end:0.80},
    Sword_Regular_A:{start:0.02,contact:0.58,end:0.88},
    Sword_Regular_B:{start:0.02,contact:0.56,end:0.88},
    Sword_Regular_C:{start:0.02,contact:0.48,end:0.74},
    Sword_Block:{start:0.02,contact:0.42,end:0.90},
    Shield_OneShot:{start:0.00,contact:0.34,end:0.78},
    Shield_Dash:{start:0.08,contact:0.34,end:0.58},
    Shield_Dash_RM:{start:0.08,contact:0.34,end:0.58},
    Sword_Dash:{start:0.08,contact:0.22,end:0.74},
    Yes:{start:0.04,contact:0.46,end:0.92},
    OverhandThrow:{start:0.00,contact:0.50,end:0.84},
    Spell_Simple_Shoot:{start:0.02,contact:0.58,end:0.94},
    Arena_CMU_Kick:{start:0.02,contact:0.39,end:0.98},
  };

  AP.ARCHER_ACTION = {
    normal:  { draw:1.00, torso:1.00, hold:1.00, recoil:1.00, elevation:0.00 },
    quick:   { draw:0.82, torso:0.82, hold:0.62, recoil:1.10, elevation:-0.03 },
    power:   { draw:1.08, torso:1.22, hold:1.10, recoil:1.18, elevation:0.04 },
    control: { draw:1.02, torso:0.92, hold:1.18, recoil:0.82, elevation:0.07 },
    volley:  { draw:1.05, torso:1.28, hold:1.05, recoil:1.00, elevation:-0.16 }
  };

  AP.profileFor = function (classId) { return AP.CLASSES[classId] || AP.CLASSES.devastador; };
  AP.castFor = function (family) { return AP.CAST[family] || AP.CAST.projectile; };
  AP.actionClipFor = function (clip) { return AP.ACTION_CLIPS[clip] || {start:0,contact:0.5,end:1}; };
  AP.authoredClipFor = function (clip) { return AP.AUTHORED_CLIPS[clip] || null; };
  AP.archerActionFor = function (visualAction, isPower) {
    if (visualAction === 'archerQuick') return AP.ARCHER_ACTION.quick;
    if (visualAction === 'archerControl') return AP.ARCHER_ACTION.control;
    if (visualAction === 'archerVolley') return AP.ARCHER_ACTION.volley;
    if (visualAction === 'archerPower') return AP.ARCHER_ACTION.power;
    return isPower ? AP.ARCHER_ACTION.power : AP.ARCHER_ACTION.normal;
  };
  AP.coreFailures = function () {
    var out=[];
    for (var k in AP.CORE) {
      var r=AP.CORE[k];
      if (r.status===AP.STATUS.MISSING || r.status===AP.STATUS.SEMANTIC_PLACEHOLDER || r.status===AP.STATUS.BLOCKED_SOURCE_CLIP) out.push(k);
    }
    return out;
  };

  Arena.Data.AnimationProfiles = AP;
  return AP;
});
