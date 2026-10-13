/* =============================================================================
 * data/animationSourcePlan.js — v0.34 · warrior literal mapping + timing/facing contract.
 *
 * User-locked mapping (19-08-2026): for the warrior iteration, the latest
 * instruction wins whenever an action name was repeated. The animation layer
 * is presentation only; simulation continues to own movement, RELEASE, damage,
 * CC, GCD, cooldowns and legality.
 * ========================================================================== */
Arena.define('data/animationSourcePlan', [], function (Arena) {
  'use strict';

  var STATUS = {
    FINAL: 'FINAL_USER_LOCKED',
    PROVISIONAL: 'PROVISIONAL',
    SOURCE_DERIVED: 'SOURCE_DERIVED_PROVISIONAL',
    MISSING: 'EMPTY_INTENTIONAL',
    MISSING_EXACT: 'MISSING_EXACT_CLIP',
    PLAYABLE_FALLBACK: 'MISSING_EXACT_FALLBACK_PLAYABLE',
    PLACEHOLDER: 'ARENA_DEFAULT_PLACEHOLDER'
  };

  function slot(clip, status, role, extra) {
    var o = { clip: clip || null, status: status, role: role };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  var P = {
    contractVersion: '2026-10-09-native-presentation-v039',
    baseRig: 'QUATERNIUS_UAL_NATIVE_65',
    bodyPolicy: 'ONE_NATIVE_BODY_NO_ARMOR_NO_ACCESSORIES',
    equipmentPolicy: 'FUNCTIONAL_WEAPONS_ONLY_NATIVE_BONES',
    mappingPolicy: 'LATEST_USER_MAPPING_WINS_NO_SILENT_SUBSTITUTION',
    stancePolicy: 'NORMAL_AND_COMBAT_ARE_DISTINCT_SIMULATION_STATES',
    missingPolicy: 'LEAVE_VISUALLY_SIMPLE_OR_BLANK_DO_NOT_FAKE_SOURCE_CLIP',
    STATUS: STATUS,

    classPolicy: {
      devastador: { archetype:'melee', grip:'twoHand', weapon:'greatsword' },
      guardian:   { archetype:'melee', grip:'oneHandShield', weapon:'sword+shield' },
      centinela:  { archetype:'archer', grip:'bow', weapon:'bow' },
      rastreador: { archetype:'archer', grip:'bow', weapon:'bow' },
      arcanista:  { archetype:'caster', grip:'staff', weapon:'staff' },
      vinculador: { archetype:'caster', grip:'staff', weapon:'staff' }
    },

    slots: {
      /* General */
      normalIdle: slot('Idle_Loop', STATUS.FINAL, 'modo normal quieto / idle'),
      hitChest:   slot('Hit_Chest', STATUS.FINAL, 'daño de ataque normal'),
      hitHead:    slot('Hit_Head', STATUS.FINAL, 'daño de poder sin control duro'),
      death:      slot('Death01', STATUS.FINAL, 'muerte'),

      /* Fall and prone hold reuse Death01; LayToIdle supplies the real getup.
         Slide is a locomotion slide and must not stand in for unconsciousness. */
      knockdownStart: slot('Death01', STATUS.SOURCE_DERIVED, 'inicio noqueo / caída'),
      knockdownLoop:  slot('Death01', STATUS.SOURCE_DERIVED, 'noqueado en el suelo'),
      knockdownExit:  slot('LayToIdle', STATUS.FINAL, 'salida de noqueo / levantarse'),
      getup:           slot('LayToIdle', STATUS.FINAL, 'levantarse después de noqueo'),
      knockback: slot('Hit_Knockback', STATUS.PROVISIONAL, 'impacto fuerte sin traslación de gameplay'),
      stunHold: slot('Hit_Head', STATUS.SOURCE_DERIVED, 'aturdido: mantener pose de reacción, sin ataque'),
      casterUtility: slot('Spell_Simple_Enter', STATUS.PROVISIONAL, 'concentración para cura/buff/utility'),

      /* Warrior combat stance. Latest user instruction: all warriors use
         Sword_Idle, except the shield subclass, which uses Idle_Shield_Loop. */
      combatIdleOneHand: slot('Idle_Shield_Loop', STATUS.FINAL, 'Guardián guardia 1H + escudo'),
      combatIdleTwoHand: slot('Sword_Idle', STATUS.FINAL, 'Devastador guardia de espada'),

      /* Latest user instruction overrides the older Sword_Attack normal mapping:
         melee normals alternate Sword_Regular_A/B. Their dedicated *_Rec clips
         are used as recovery phases so the return to guard does not snap. */
      meleeNormalA:    slot('Sword_Regular_A', STATUS.FINAL, 'normal melee variante A'),
      meleeNormalARec: slot('Sword_Regular_A_Rec', STATUS.FINAL, 'recovery normal melee A'),
      meleeNormalB:    slot('Sword_Regular_B', STATUS.FINAL, 'normal melee variante B'),
      meleeNormalBRec: slot('Sword_Regular_B_Rec', STATUS.FINAL, 'recovery normal melee B'),
      meleeWeaponPower:slot('Sword_Regular_C', STATUS.FINAL, 'poder de daño de arma / Cruz del Sur y equivalentes'),

      /* Shield-specific actions. The dash is sourced from the RM binary and is
         renamed Shield_Dash_RM at packaging time. DirectPlayer still locks root
         X/Z so gameplay displacement remains simulation-authoritative. */
      shieldBash:  slot('Shield_Dash_RM', STATUS.FINAL, 'poder ofensivo con escudo / Shield_Dash RM'),
      shieldGuard: slot('Shield_OneShot', STATUS.FINAL, 'buff/guard de escudo'),
      oneHandBlock:slot('Sword_Block', STATUS.PROVISIONAL, 'bloqueo/parada 1H'),
      warriorCharge: slot('Sword_Dash', STATUS.PROVISIONAL, 'carga ofensiva disponible'),
      warriorBuff:   slot('Yes', STATUS.PROVISIONAL, 'buff/war cry genérico disponible'),
      kick: slot('Idle_Loop', STATUS.PROVISIONAL, 'Puntapié: patada frontal propia por IK sobre el rig nativo, sin clip Kick original', {presentation:'NATIVE_FRONT_KICK_IK'}),

      /* Caster: latest instruction asks to use the Spell_* family in its natural
         roles. Enter/Exit are mode transitions, Idle_Loop is combat/charge hold,
         Shoot is the release motion for normal and damaging spells. */
      combatIdleCaster: slot('Spell_Simple_Idle_Loop', STATUS.FINAL, 'modo combate mago'),
      combatEnterCaster:slot('Spell_Simple_Enter', STATUS.FINAL, 'entrar modo combate mago'),
      combatExitCaster: slot('Spell_Simple_Exit', STATUS.FINAL, 'salir modo combate mago'),
      casterCharge:     slot('Spell_Simple_Idle_Loop', STATUS.FINAL, 'posición de carga/casteo mago'),
      casterNormalAttack:slot('Spell_Simple_Shoot', STATUS.FINAL, 'ataque normal mago'),
      casterPowerRelease:slot('Spell_Simple_Shoot', STATUS.FINAL, 'release de poder mago'),

      /* Archer v0.35: instrucción explícita del usuario (25-08-2026) — "elimina
         las que tenemos, crea unas por defecto en cada estado y ya luego las
         reemplazamos con un video". Las UAL Standard/RM que sí tenemos NO
         contienen una familia Bow_*; fingir un nombre "Bow_Aim_Neutral" que
         nunca va a existir en los binarios sólo generaba una referencia
         colgante (ver tools/audit-clips.mjs). El default por estado es ahora
         directamente el clip sintetizado en runtime por buildVideoArcherClips()
         en threeDirectAnim.js (Pistol_Aim_Neutral + Pistol_Reload + Idle_Loop),
         sin capa intermedia de nombres aspiracionales. Cuando llegue el vídeo
         de referencia del arquero, esta familia se reemplaza por clips Source
         reales y estos slots vuelven a apuntar a nombres exactos. */
      combatIdleArcher:  slot('Arena_Archer_VideoReady', STATUS.SOURCE_DERIVED, 'modo combate arquero / aim neutral (default hasta vídeo de referencia)'),
      archerAttackCharge:slot('Arena_Archer_VideoNotch', STATUS.SOURCE_DERIVED, 'notch/draw previo al disparo (default hasta vídeo de referencia)'),
      archerNormalAttack:slot('Arena_Archer_VideoShoot', STATUS.SOURCE_DERIVED, 'ataque normal de arco (default hasta vídeo de referencia)'),
      archerPowerRelease:slot('Arena_Archer_VideoShoot', STATUS.SOURCE_DERIVED, 'release rápido/poder de arco (default hasta vídeo de referencia)'),
      archerBuffCharge:  slot('Spell_Simple_Enter', STATUS.PROVISIONAL, 'buff arquero sin gesto de disparo')
    },

    locomotion: {
      idle: slot('Idle_Loop', STATUS.FINAL, 'quieto'),
      walkForward: slot('Walk_Loop', STATUS.FINAL, 'caminar al frente'),
      runForward: slot('Jog_Fwd_Loop', STATUS.FINAL, 'correr/jog al frente'),
      sprintForward: slot('Sprint_Loop', STATUS.FINAL, 'correr al frente con buff de velocidad'),

      /* Standard has no native eight-way gait. Directional slots use native
         Idle as a neutral body base plus world-space foot IK in threeCharacter.
         These are custom provisional adaptations, never the missing Source clips. */
      walkBackward: slot('Idle_Loop', STATUS.PROVISIONAL, 'caminar atrás (base UAL + IK direccional propio)'),
      walkBackLeft: slot('Idle_Loop', STATUS.PROVISIONAL, 'atrás + izquierda (base UAL + IK direccional propio)'),
      walkBackRight:slot('Idle_Loop', STATUS.PROVISIONAL, 'atrás + derecha (base UAL + IK direccional propio)'),
      strafeLeft:  slot('Idle_Loop', STATUS.PROVISIONAL, 'lateral izquierda (base UAL + IK direccional propio)'),
      strafeRight: slot('Idle_Loop', STATUS.PROVISIONAL, 'lateral derecha (base UAL + IK direccional propio)'),
      diagonalForwardLeft: slot('Idle_Loop', STATUS.PROVISIONAL, 'frente + izquierda (base UAL + IK direccional propio)'),
      diagonalForwardRight:slot('Idle_Loop', STATUS.PROVISIONAL, 'frente + derecha (base UAL + IK direccional propio)'),
      turnLeft:  slot('Idle_Loop', STATUS.PROVISIONAL, 'giro Q / izquierda con ajuste de pies propio'),
      turnRight: slot('Idle_Loop', STATUS.PROVISIONAL, 'giro E / derecha con ajuste de pies propio')
    },

    jump: {
      active: ['Jump_Start','Jump_Loop','Jump_Land'],
      status: STATUS.FINAL,
      role: 'user-locked UAL1 jump triplet'
    },

    playbackPolicy: {
      /* UAL attack clips are intentionally punchy, but the previous recovery
         phase was compressed into the remaining simulation window and looked
         unnaturally fast. v0.34 keeps RELEASE authoritative while playing REC
         at a natural presentation rate. */
      meleeAttackFade:0.075,
      meleeRecoveryRate:0.72,
      meleeRecoveryFade:0.085,
      hitChestRate:0.82,
      hitHeadRate:0.80,
      jumpStartRate:0.88,
      jumpAirRate:0.94,
      jumpLandRate:0.82,
      shieldBuffRate:0.82,
      combatIdleRate:0.94
    },

    archerFacingPolicy: {
      /* The current Arena-authored fallback was reported aiming backwards in
         hardware. Offline inspection shows the UAL Pistol_Aim scaffold itself
         already reaches +Z, so a blind pelvis 180° would risk reintroducing the
         old contortion. v0.34 therefore derives bow-hand IK targets from the
         simulation-owned world yaw. The generic clip flip remains available in
         threeDirectAnim.js for truly -Z-authored external clips. */
      mode:'WORLD_FORWARD_IK',
      fallbackFlipY:false,
      orientationBone:'Hips',
      offsetRadians:3.141592653589793
    },

    weaponSockets: {
      sword:      { bone:'RightHand', policy:'NATIVE_BONE_SOCKET' },
      greatsword: { bone:'RightHand', secondaryGrip:'LeftHand', policy:'PRIMARY_SOCKET_NATIVE_WORLD_IK_SECONDARY_GRIP' },
      staff:      { bone:'RightHand', policy:'NATIVE_BONE_SOCKET_VERTICAL_CONSTRAINT' },
      bow:        { bone:'LeftHand', policy:'NATIVE_BONE_SOCKET_VERTICAL_CONSTRAINT' },
      shield:     { bone:'LeftLowerArm', policy:'NATIVE_FOREARM_SOCKET_DEFENSIVE_CONSTRAINT' }
    },

    recoveryPairs: {
      Sword_Regular_A:'Sword_Regular_A_Rec',
      Sword_Regular_B:'Sword_Regular_B_Rec'
    },

    rmSources: {
      Shield_Dash_RM:{sourceLibrary:'UAL2_Standard_RM.glb',sourceClip:'Shield_Dash',rootPolicy:'VISUAL_ROOT_XZ_LOCKED'}
    },

    hardControlDamagePolicy: {
      autoAttack:'Hit_Chest',
      pureDamagePower:'Hit_Head',
      hardControlEffects:['knockdown','stun','sourceDaze','stasis'],
      hardControlReaction:'USE_CC_ANIMATION_NOT_HIT_HEAD'
    },

    mocapPackAudit: {
      name:'Anims_Only_FBX_V1.zip',
      classification:'CMU_MOCAP_FBX_ROTATION_RETARGET',
      runtimePolicy:'SELECT_ONLY_RETARGETED_CLIPS_NO_RAW_FBX_IN_DEPLOY',
      selectedSources:['113_01.fbx','143_40.fbx','40_02.fbx','41_02.fbx','16_27.fbx','16_29.fbx','135_04.fbx'],
      /* v0.36 (25-08-2026): user confirmed in-game that the 7 directional-
         locomotion clips + the 2 turn clips read wrong (rigid arm during
         strafe; turning visually disagreeing with the body's real rotation).
         generate-cmu-clips-v031.py picked their source time-windows from a
         hand-typed note, never a rendered check — e.g. Strafe_Left/Right both
         slice the SAME 143_40.fbx at different windows, and Turn_Left/Right
         come from two UNRELATED takes (16_27 vs 16_29) instead of one
         mirrored pair. Without Anims_Only_FBX_V1.zip in this environment
         there is no way to re-verify those windows honestly, so
         `locomotion.*` no longer references them (see that block). The 9
         clips remain loaded in arena-cmu-v031.json for whenever the source
         pack or a reference video makes a real re-verification possible.
         v0.39 also retires Arena_CMU_Kick after the user reported the kick as
         visually wrong; its playable replacement is explicit native-rig IK. */
      reviewPolicy:'CMU kick retired after user visual feedback; directional locomotion (walkBack*/strafe*/diagonal*/turn*) retired pending re-verification against raw source — see locomotion.* comment'
    }
  };

  P.missingSlots = [];
  Object.keys(P.slots).forEach(function(k){ if (!P.slots[k].clip) P.missingSlots.push(k); });
  Object.keys(P.locomotion).forEach(function(k){ if (!P.locomotion[k].clip) P.missingSlots.push('locomotion.'+k); });

  Arena.Data.AnimationSourcePlan = P;
  return P;
});
