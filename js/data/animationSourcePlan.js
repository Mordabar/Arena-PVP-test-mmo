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
    contractVersion: '2026-08-20-warrior-literal-speed-facing-v034',
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

      /* Knockdown = slide triplet. Slide_Start entra al suelo, Slide_Loop
         mantiene el estado y Slide_Exit recupera al personaje. */
      knockdownStart: slot('Slide_Start', STATUS.FINAL, 'inicio noqueo / caída'),
      knockdownLoop:  slot('Slide_Loop', STATUS.FINAL, 'noqueado en el suelo'),
      knockdownExit:  slot('Slide_Exit', STATUS.FINAL, 'salida de noqueo / levantarse'),
      getup:           slot('Slide_Exit', STATUS.FINAL, 'levantarse después de noqueo'),

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
      kick: slot('Arena_CMU_Kick', STATUS.SOURCE_DERIVED, 'Puntapié / patada guerrero', {sourceFile:'135_04.fbx', sourceLabel:'Front Kick'}),

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
      archerBuffCharge:  slot('Arena_Archer_VideoBuff', STATUS.PLACEHOLDER, 'buff arquero sin gesto de disparo')
    },

    locomotion: {
      idle: slot('Idle_Loop', STATUS.FINAL, 'quieto'),
      walkForward: slot('Walk_Loop', STATUS.FINAL, 'caminar al frente'),
      runForward: slot('Jog_Fwd_Loop', STATUS.FINAL, 'correr/jog al frente'),
      sprintForward: slot('Sprint_Loop', STATUS.FINAL, 'correr al frente con buff de velocidad'),

      /* v0.36 · Retirados los 9 clips CMU direccionales (25-08-2026).
         generate-cmu-clips-v031.py cortaba cada uno de un archivo FBX crudo por
         VENTANA DE TIEMPO ADIVINADA a partir de una nota de texto ("walk
         sideways: left cycle") — nadie renderizó esa ventana para confirmar
         que el contenido correspondía de verdad a esa dirección antes de
         aceptarla. El propio script lo delata: Strafe_Left y Strafe_Right
         salen del MISMO archivo (143_40.fbx) en dos ventanas distintas, y
         Turn_Left/Turn_Right salen de dos tomas de mocap DISTINTAS (16_27 vs
         16_29) en vez de ser una mismo par espejado. El usuario confirmó en
         partida que girar, retroceder, lateral y diagonal se ven mal — y sin
         el paquete Anims_Only_FBX_V1.zip (no disponible en este entorno) no
         hay forma honesta de re-verificar esas ventanas.
         missingPolicy manda no fingir un clip fuente que no se puede probar:
         estos siete slots vuelven a Walk_Loop (ya verificado, USER_LOCKED en
         todos los estados que sí se auditaron esta sesión) en vez de a un
         contenido sin verificar; girar en el sitio no tiene sustituto
         direccional honesto, así que queda en blanco (Idle_Loop, sin fingir
         un pivote). Los clips Arena_CMU_* siguen en el runtime — sólo se
         desconectó su cableado — para poder re-mapearlos en cuanto llegue el
         paquete fuente o un vídeo de referencia. Arena_CMU_Kick no se toca:
         viene de una sola captura sin par izquierda/derecha que verificar. */
      walkBackward: slot('Walk_Loop', STATUS.PLACEHOLDER, 'caminar atrás (temporal: sin clip direccional verificado)'),
      walkBackLeft: slot('Walk_Loop', STATUS.PLACEHOLDER, 'atrás + izquierda (temporal: sin clip direccional verificado)'),
      walkBackRight:slot('Walk_Loop', STATUS.PLACEHOLDER, 'atrás + derecha (temporal: sin clip direccional verificado)'),
      strafeLeft:  slot('Walk_Loop', STATUS.PLACEHOLDER, 'lateral izquierda (temporal: sin clip direccional verificado)'),
      strafeRight: slot('Walk_Loop', STATUS.PLACEHOLDER, 'lateral derecha (temporal: sin clip direccional verificado)'),
      diagonalForwardLeft: slot('Walk_Loop', STATUS.PLACEHOLDER, 'frente + izquierda (temporal: sin clip direccional verificado)'),
      diagonalForwardRight:slot('Walk_Loop', STATUS.PLACEHOLDER, 'frente + derecha (temporal: sin clip direccional verificado)'),
      turnLeft:  slot(null, STATUS.MISSING, 'giro Q / izquierda (sin sustituto honesto: en blanco hasta re-verificar)'),
      turnRight: slot(null, STATUS.MISSING, 'giro E / derecha (sin sustituto honesto: en blanco hasta re-verificar)')
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
      greatsword: { bone:'RightHand', secondaryGrip:'LeftHand', policy:'PRIMARY_SOCKET_SECONDARY_GRIP_VISUAL' },
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
         Arena_CMU_Kick is unaffected: single capture, no L/R pair at risk. */
      reviewPolicy:'kick only; directional locomotion (walkBack*/strafe*/diagonal*/turn*) retired pending re-verification against raw source — see locomotion.* comment'
    }
  };

  P.missingSlots = [];
  Object.keys(P.slots).forEach(function(k){ if (!P.slots[k].clip) P.missingSlots.push(k); });
  Object.keys(P.locomotion).forEach(function(k){ if (!P.locomotion[k].clip) P.missingSlots.push('locomotion.'+k); });

  Arena.Data.AnimationSourcePlan = P;
  return P;
});
