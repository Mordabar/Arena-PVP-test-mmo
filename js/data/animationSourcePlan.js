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

      /* Archer v0.33: the user supplied a video of Quaternius' UAL2 Source
         viewer showing the intended Bow_* family. Those exact Source clips are
         NOT in the Standard binaries we can execute, so the contract requests
         their real names and resolves to explicit Arena-authored VIDEO-DERIVED
         fallbacks on the same 65-joint rig. Normal mode remains Idle_Loop and
         never uses these combat poses. */
      combatIdleArcher:  slot('Bow_Aim_Neutral', STATUS.PLAYABLE_FALLBACK, 'modo combate arquero / aim neutral', {fallback:'Arena_Archer_VideoReady', reference:'user videos 19.08.2026_20.18.59_REC.mp4 + 19.08.2026_20.55.49_REC.mp4'}),
      archerAttackCharge:slot('Bow_Notch', STATUS.PLAYABLE_FALLBACK, 'notch/draw previo al disparo', {fallback:'Arena_Archer_VideoNotch', reference:'user video'}),
      archerNormalAttack:slot('Bow_Shoot', STATUS.PLAYABLE_FALLBACK, 'ataque normal de arco', {fallback:'Arena_Archer_VideoShoot', reference:'user video'}),
      archerPowerRelease:slot('Bow_RapidShoot', STATUS.PLAYABLE_FALLBACK, 'release rápido/poder de arco', {fallback:'Arena_Archer_VideoShoot', reference:'user video'}),
      archerBuffCharge:  slot('Arena_Archer_VideoBuff', STATUS.PLACEHOLDER, 'buff arquero sin gesto de disparo')
    },

    locomotion: {
      idle: slot('Idle_Loop', STATUS.FINAL, 'quieto'),
      walkForward: slot('Walk_Loop', STATUS.FINAL, 'caminar al frente'),
      runForward: slot('Jog_Fwd_Loop', STATUS.FINAL, 'correr/jog al frente'),
      sprintForward: slot('Sprint_Loop', STATUS.FINAL, 'correr al frente con buff de velocidad'),

      /* Directional locomotion remains from the already integrated CMU pass;
         this warrior wave does not reinterpret those clips. */
      walkBackward: slot('Arena_CMU_Walk_Backward', STATUS.SOURCE_DERIVED, 'caminar atrás', {sourceFile:'113_01.fbx'}),
      walkBackLeft: slot('Arena_CMU_Diagonal_BL', STATUS.SOURCE_DERIVED, 'atrás + izquierda', {sourceFile:'41_02.fbx'}),
      walkBackRight:slot('Arena_CMU_Diagonal_BR', STATUS.SOURCE_DERIVED, 'atrás + derecha', {sourceFile:'41_02.fbx'}),
      strafeLeft:  slot('Arena_CMU_Strafe_Left', STATUS.SOURCE_DERIVED, 'lateral izquierda', {sourceFile:'143_40.fbx'}),
      strafeRight: slot('Arena_CMU_Strafe_Right', STATUS.SOURCE_DERIVED, 'lateral derecha', {sourceFile:'143_40.fbx'}),
      diagonalForwardLeft: slot('Arena_CMU_Diagonal_FL', STATUS.SOURCE_DERIVED, 'frente + izquierda', {sourceFile:'41_02.fbx'}),
      diagonalForwardRight:slot('Arena_CMU_Diagonal_FR', STATUS.SOURCE_DERIVED, 'frente + derecha', {sourceFile:'40_02.fbx'}),
      turnLeft:  slot('Arena_CMU_Turn_Left', STATUS.SOURCE_DERIVED, 'giro Q / izquierda', {sourceFile:'16_27.fbx'}),
      turnRight: slot('Arena_CMU_Turn_Right', STATUS.SOURCE_DERIVED, 'giro E / derecha', {sourceFile:'16_29.fbx'})
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
      reviewPolicy:'directional locomotion + kick only; v0.34 locks warrior UAL mapping and corrects archer fallback facing without changing gameplay yaw'
    }
  };

  P.missingSlots = [];
  Object.keys(P.slots).forEach(function(k){ if (!P.slots[k].clip) P.missingSlots.push(k); });
  Object.keys(P.locomotion).forEach(function(k){ if (!P.locomotion[k].clip) P.missingSlots.push('locomotion.'+k); });

  Arena.Data.AnimationSourcePlan = P;
  return P;
});
