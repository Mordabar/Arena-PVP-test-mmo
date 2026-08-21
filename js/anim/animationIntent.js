/* =============================================================================
 * anim/animationIntent.js — QUÉ quiere representar el personaje.
 *
 * ESTE FICHERO ESTÁ FUERA DE render/** A PROPÓSITO.
 *
 * Describe la INTENCIÓN de animación: qué está haciendo el personaje, en qué
 * fase, con cuánta intensidad y bajo qué restricciones. No dice cómo dibujarlo.
 * No conoce WebGL, ni matrices, ni mallas, ni Three.js, ni Unity. Ese es
 * exactamente su valor: es el contrato que sobrevive al cambio de motor.
 *
 *   SIMULATION → AnimationIntent → ProceduralCharacterVisual      (hoy)
 *   SIMULATION → AnimationIntent → ThreeSkinnedCharacterVisual    (mañana)
 *   SIMULATION → AnimationIntent → UnityAnimatorBridge            (opcional)
 *
 * En los tres casos el combate no se toca.
 *
 * DE DÓNDE SALE CADA COSA
 *
 * La intención es el resultado de leer la simulación y el controlador de
 * locomoción. No al revés: `locomotion: "STRAFE_RIGHT"` es una deducción que
 * sólo puede hacer quien ha comparado posiciones entre fotogramas, y eso lo
 * hace el controlador. La simulación no sabe nada de estados de animación, y
 * debe seguir sin saberlo.
 *
 * LO QUE NO ENTRA AQUÍ
 *
 * Los puntos de anclaje de los pies en el mundo NO forman parte de la
 * intención. Son la solución concreta de un controlador procedural a un
 * problema de deslizamiento; una malla con skinning y root motion desactivado
 * resolvería lo mismo con su propio IK. La intención dice "va hacia la derecha
 * al 77 % de su velocidad", no "el pie izquierdo está clavado en (12.3, 0, 8.1)".
 *
 * REGLA QUE NO SE ROMPE: construir una intención LEE la entidad y jamás la
 * escribe. Ni una asignación a hp, posición, cooldowns o estados.
 * ========================================================================== */
Arena.define('anim/animationIntent',
  ['data/animConfig', 'data/castFamilies', 'data/balance'], function (Arena) {
  'use strict';

  var AI = {};

  /* Estados de control, en orden de prioridad. DEATH gana siempre; después el
     control duro; después todo lo demás. Es el mismo orden que aplica la
     presentación, escrito una sola vez y en un sitio neutral. */
  AI.CC = {
    NONE: null,
    DEATH: 'DEATH',
    STASIS: 'STASIS',
    KNOCKDOWN: 'KNOCKDOWN',
    STUN: 'STUN',
    ROOT: 'ROOT',
    SILENCE: 'SILENCE',
    DISARM: 'DISARM'
  };

  /* Orden de consulta. La lista es la prioridad: el primero que exista gana. */
  var CC_ORDER = [
    ['stasis', AI.CC.STASIS],
    ['knockdown', AI.CC.KNOCKDOWN],
    ['stun', AI.CC.STUN],
    ['root', AI.CC.ROOT],
    ['silence', AI.CC.SILENCE],
    ['disarm', AI.CC.DISARM]
  ];

  /**
   * Objeto reutilizable. Se crea uno por personaje y se rellena cada fotograma:
   * asignar un objeto nuevo por entidad y por frame produce basura justo en el
   * peor momento posible, que es en mitad de un combate.
   */
  AI.create = function () {
    return {
      /* Identidad */
      entityId: null, classId: null, archetype: 'melee', weaponType: 'sword',
      alive: true,

      /* Locomoción — parámetros continuos, no un enum suelto */
      locomotion: 'IDLE',
      moveForward: 0, moveRight: 0, speedNormalized: 0,
      turnRate: 0, accelerating: false, decelerating: false,
      gait: 0,                  // 0 = andar · 1 = correr, con fase de vuelo
      speedBoosted: false,      // buff/poder que aumenta velocidad real de movimiento
      airborne: false, jumpProgress: 0,

      /* Orientación */
      facingYaw: 0, targetYaw: 0, hasTarget: false, combatMode: false,

      /* Acción de combate */
      actionFamily: null,       // 'light' | 'heavy' | 'ranged' | 'pulse' | 'cast' | …
      actionPhase: null,        // 'ANTICIPATION' | 'ACTIVE' | 'IMPACT' | 'RECOVERY'
      actionProgress: 0,        // 0..1 dentro de la acción
      actionWeight: 0,          // cuánto pesa la acción sobre la guardia
      actionVariant: 0,         // variante visual determinista (p.ej. normal horizontal/diagonal)
      visualAction: null,       // kick | shield | charge | archer | cast | … (data-driven)
      actionType: null,          // weapon | ability | idle (semántica de simulación)
      releaseOccurred: false,

      /* Reloj del arma — independiente del GCD. */
      weaponPhase: 'READY',
      weaponProgress: 0,
      weaponReady: true,
      weaponReadyIn: 0,
      queuedAction: null,
      queuedKind: null,

      /* Casteo — lo gobierna la simulación, no un reloj de animación */
      casting: false,
      castFamily: null,         // data/castFamilies.js
      spellGesture: null,       // hurl | meteor | freeze | lightning | storm | ...
      castPhase: null,          // 'PREPARE' | 'GATHER' | 'CHANNEL'
      castProgress: 0,
      /* Si la habilidad permite moverse. La decide la SIMULACIÓN; la animación
         sólo la transporta para que la capa de piernas sepa si debe seguir
         caminando o si el personaje está clavado por regla. */
      allowMovementDuringAction: false,

      /* Reacción al daño, aditiva */
      hitReaction: { amount: 0, front: 0, side: 0 },

      /* Control */
      crowdControl: null, crowdControlBlend: 0
    };
  };

  /** Fase legible de una acción a partir de su progreso normalizado. */
  AI.actionPhaseOf = function (t) {
    if (t < 0.30) return 'ANTICIPATION';
    if (t < 0.52) return 'ACTIVE';
    if (t < 0.70) return 'IMPACT';
    return 'RECOVERY';
  };

  /** Qué control manda ahora mismo, en orden de prioridad. */
  AI.crowdControlOf = function (entity) {
    if (!entity.alive) return AI.CC.DEATH;
    for (var i = 0; i < CC_ORDER.length; i++) {
      if (entity.hasStatus(CC_ORDER[i][0])) return CC_ORDER[i][1];
    }
    return AI.CC.NONE;
  };

  /**
   * Rellena la intención leyendo la entidad y el controlador de animación.
   *
   * @param intent objeto de AI.create(), se muta in situ
   * @param entity entidad de simulación — SÓLO LECTURA
   * @param world  mundo, para resolver el objetivo y el reloj — SÓLO LECTURA
   * @param loco   estado de locomoción (puede ser null antes del primer update)
   * @param action estado de acción (puede ser null)
   * @returns intent
   */
  AI.build = function (intent, entity, world, loco, action) {
    intent.entityId = entity.id;
    intent.classId = entity.classId;
    intent.archetype = Arena.Data.archetypeOf(entity.classId);
    intent.weaponType = Arena.Data.weaponOf(entity.classId);
    intent.alive = !!entity.alive;
    intent.facingYaw = entity.yaw;
    var moveMods = entity.mods ? entity.mods() : null;
    intent.speedBoosted = !!(moveMods && (moveMods.moveSpeedPct || 0) > 0.01);

    /* --- Locomoción -------------------------------------------------------- */
    if (loco) {
      intent.locomotion = loco.state;
      intent.moveForward = loco.moveForward;
      intent.moveRight = loco.moveRight;
      intent.speedNormalized = loco.moveSpeed;
      intent.turnRate = loco.turnRate;
      intent.accelerating = loco.acceleration > 0.05;
      intent.decelerating = loco.deceleration > 0.05;
      intent.gait = loco.gait || 0;
      intent.airborne = !!loco.airborne;
      intent.jumpProgress = loco.jumpPhase || 0;
      intent.targetYaw = entity.yaw + loco.headYaw;
    }

    /* --- Objetivo ---------------------------------------------------------- */
    var tgt = (entity.targetId && world && world.getEntity)
      ? world.getEntity(entity.targetId) : null;
    intent.hasTarget = !!(tgt && tgt.alive);
    /* Modo de combate es una decisión del jugador/simulación, distinta de
       simplemente tener un objetivo seleccionado. Seleccionar a alguien NO
       debe levantar arma/arco/báculo ni convertir Idle en guardia de ataque. */
    intent.combatMode = !!entity.combatMode;

    /* --- Acción ------------------------------------------------------------ */
    if (action && action.family) {
      intent.actionFamily = action.family;
      intent.actionProgress = action.t;
      intent.actionPhase = AI.actionPhaseOf(action.t);
      intent.actionWeight = action.weight;
    } else {
      intent.actionFamily = null;
      intent.actionPhase = null;
      intent.actionProgress = 0;
      intent.actionWeight = 0;
    }
    if (action) {
      /* `visualAction` también existe durante PRE-RELEASE cuando todavía no hay
         `actionFamily` activa. Es imprescindible para un backend skinned futuro. */
      intent.actionVariant = action.variant || 0;
      intent.visualAction = action.visualAction || null;
      intent.hitReaction.amount = action.react.amount;
      intent.hitReaction.front = action.react.front;
      intent.hitReaction.side = action.react.side;
      intent.castFamily = action.castFamily;
      intent.spellGesture = action.spellGesture || null;
    } else {
      intent.actionVariant = 0;
      intent.visualAction = null;
      intent.spellGesture = null;
    }

    /* --- Timeline autoritativo de arma/acción ------------------------------ */
    var ws = entity.weaponState;
    if (ws && world) {
      intent.weaponPhase = ws.phase || 'READY';
      intent.weaponReadyIn = Math.max(0, (ws.readyAt || 0) - world.time);
      intent.weaponReady = intent.weaponReadyIn <= 1e-6 && intent.weaponPhase === 'READY';
      if (ws.phase === 'WINDUP') {
        intent.weaponProgress = Math.max(0, Math.min(1,
          (world.time - ws.windupStartedAt) / Math.max(1e-3, ws.releaseAt - ws.windupStartedAt)));
      } else if (ws.phase === 'RECOVERY') {
        intent.weaponProgress = Math.max(0, Math.min(1,
          (world.time - ws.recoveryStartedAt) / Math.max(1e-3, ws.readyAt - ws.recoveryStartedAt)));
      } else intent.weaponProgress = ws.phase === 'RELEASE' ? 1 : 0;
      intent.releaseOccurred = (world.time - (ws.lastReleaseAt || -999)) <= (Arena.Data.balance.TICK_DT * 1.25);
    } else {
      intent.weaponPhase = 'READY'; intent.weaponProgress = 0;
      intent.weaponReady = true; intent.weaponReadyIn = 0; intent.releaseOccurred = false;
    }
    intent.actionType = entity.actionState ? entity.actionState.kind : null;
    var qa = entity.queuedAction || entity.queued;
    intent.queuedAction = qa ? qa.abilityId : null;
    intent.queuedKind = qa ? qa.kind : null;

    /* --- Casteo -------------------------------------------------------------
     * El progreso sale de la simulación, no de un reloj propio: si la animación
     * llevara su propia cuenta, la barra de casteo y el cuerpo contarían cosas
     * distintas y el enemigo no podría fiarse de lo que ve para interrumpir. */
    var cast = entity.pendingCast || entity.cast;
    if (cast && world) {
      intent.casting = true;
      intent.castProgress = Math.min(1,
        (world.time - cast.startTime) / Math.max(cast.duration, 1e-3));
      intent.allowMovementDuringAction = !!cast.movable;
      intent.castPhase = intent.castProgress < 0.20 ? 'PREPARE'
                       : (intent.castProgress < 0.52 ? 'GATHER' : 'CHANNEL');
    } else {
      intent.casting = false;
      intent.castProgress = 0;
      intent.castPhase = null;
      // Sin casteo activo no hay restricción de movimiento por casteo. Las
      // demás restricciones (root, knockdown) las expresa `crowdControl`.
      intent.allowMovementDuringAction = true;
    }

    /* --- Control ----------------------------------------------------------- */
    intent.crowdControl = AI.crowdControlOf(entity);
    return intent;
  };

  /** Volcado compacto para el overlay de depuración. */
  AI.describe = function (intent) {
    if (!intent) return [];
    function n(v) { return (v < 0 ? '' : ' ') + v.toFixed(2); }
    var lines = [
      'INTENT     ' + intent.archetype + '/' + intent.weaponType +
        (intent.alive ? '' : '  MUERTO'),
      '  modo     ' + (intent.combatMode ? 'COMBAT' : 'NORMAL') + (intent.hasTarget ? '  target' : '') ,
      '  loco     ' + intent.locomotion + '  v' + n(intent.speedNormalized) +
        '  fwd' + n(intent.moveForward) + '  right' + n(intent.moveRight) +
        (intent.airborne ? '  JUMP ' + Math.round(intent.jumpProgress * 100) + '%' : '')
    ];
    if (intent.actionFamily) {
      lines.push('  acción   ' + intent.actionFamily + ':' + intent.actionPhase +
        '  t' + n(intent.actionProgress) + '  peso' + n(intent.actionWeight) +
        (intent.visualAction ? '  gesto=' + intent.visualAction : '') +
        (intent.actionVariant ? '  var=' + intent.actionVariant : ''));
    }
    lines.push('  arma     ' + intent.weaponPhase + '  ' + Math.round(intent.weaponProgress * 100) + '%' +
      (intent.weaponReady ? '  READY' : '  ' + intent.weaponReadyIn.toFixed(2) + 's'));
    if (intent.queuedAction) lines.push('  cola     ' + intent.queuedKind + ' → ' + intent.queuedAction);
    if (intent.casting) {
      lines.push('  casteo   ' + (intent.castFamily || '—') + (intent.spellGesture ? '/'+intent.spellGesture : '') + ':' + intent.castPhase +
        '  ' + Math.round(intent.castProgress * 100) + '%' +
        (intent.allowMovementDuringAction ? '  MÓVIL' : '  ANCLADO'));
    }
    if (intent.crowdControl) lines.push('  control  ' + intent.crowdControl);
    return lines;
  };

  Arena.Anim = Arena.Anim || {};
  Arena.Anim.AnimationIntent = AI;
});
