/* =============================================================================
 * render/anim/actions.js — Acciones de combate, reacciones y control.
 *
 * TRES CAPAS QUE SE COMPONEN, NO SE PISAN (sección 16 y 25 del brief):
 *
 *   LOWER BODY   locomoción — la calcula render/anim/locomotion.js
 *   UPPER BODY   acción de combate — la calcula este fichero
 *   ADDITIVE     reacción al daño y micro-ruido — se suma encima
 *
 * Un arquero puede desplazarse lateralmente mientras dispara porque las piernas
 * y los brazos no comparten estado. Un golpe recibido sin CC sacude el torso
 * pero no congela las piernas. Sólo el control duro sustituye la pose entera, y
 * porque las reglas de combate lo dicen, no porque el renderer lo decida.
 *
 * PRIORIDAD (se resuelve por composición, no por ifs anidados):
 *   DEATH > CC DURO > ACCIÓN > REACCIÓN > LOCOMOCIÓN > IDLE
 *
 * Toda acción tiene ANTICIPATION → ACTIVE → IMPACT → RECOVERY. El instante de
 * impacto visual se alinea con el evento de la simulación: la presentación
 * nunca decide si algo golpea, sólo cuándo se ve el golpe.
 * ========================================================================== */
Arena.define('render/anim/actions',
  ['render/anim/skeleton', 'data/animConfig'], function (Arena) {
  'use strict';

  var SK = Arena.Render.Skeleton;
  var clamp = SK.clamp, smooth = SK.smooth, damp = SK.damp;

  var Act = {};

  /* --- Familias de acción -------------------------------------------------- */
  Act.FAMILY = {
    LIGHT_SWING: 'light',
    HEAVY_SWING: 'heavy',
    THRUST: 'thrust',
    KICK: 'kick',
    SHIELD_BASH: 'shield',
    CHARGE: 'charge',
    WAR_CRY: 'cry',
    ARCHER_SHOT: 'ranged',
    ARCANE_PULSE: 'pulse',   // ataque normal del mago: NO es una estocada
    CAST: 'cast'             // liberación de hechizo
  };

  /* Fases del CASTEO, gobernadas por el progreso que dicta la simulación —no
     por un reloj propio, o la barra de casteo y el cuerpo contarían cosas
     distintas. Son fracciones de castProgress. */
  Act.CAST_PHASE = { PREPARE: 'PREPARE', GATHER: 'GATHER', CHANNEL: 'CHANNEL' };
  var CAST_PREPARE_END = 0.20, CAST_GATHER_END = 0.52;

  /** En qué fase del casteo está un progreso dado. */
  Act.castPhaseOf = function (c) {
    if (c < CAST_PREPARE_END) return Act.CAST_PHASE.PREPARE;
    if (c < CAST_GATHER_END) return Act.CAST_PHASE.GATHER;
    return Act.CAST_PHASE.CHANNEL;
  };

  /** Qué familia usa cada arquetipo según sea ataque normal o poder. */
  Act.familyFor = function (archetype, isPower, visualAction) {
    /* Las acciones especiales vienen de DATA (`combatTiming.visualAction`).
       El renderer conoce categorías de movimiento, nunca ids de habilidades. */
    if (visualAction) {
      if (visualAction === 'kick') return Act.FAMILY.KICK;
      if (visualAction === 'shield') return Act.FAMILY.SHIELD_BASH;
      if (visualAction === 'charge') return Act.FAMILY.CHARGE;
      if (visualAction === 'cry') return Act.FAMILY.WAR_CRY;
      if (visualAction === 'thrust') return Act.FAMILY.THRUST;
      if (visualAction === 'heavy') return Act.FAMILY.HEAVY_SWING;
      if (visualAction.indexOf && visualAction.indexOf('archer') === 0) return Act.FAMILY.ARCHER_SHOT;
    }
    if (archetype === 'archer') return Act.FAMILY.ARCHER_SHOT;
    // El mago tiene DOS gestos distintos, no uno con variación: el ataque
    // normal canaliza energía por el báculo, el poder libera un hechizo.
    if (archetype === 'caster') return isPower ? Act.FAMILY.CAST : Act.FAMILY.ARCANE_PULSE;
    return isPower ? Act.FAMILY.HEAVY_SWING : Act.FAMILY.LIGHT_SWING;
  };

  /* Fracción de la acción dedicada a entrar y a salir de la pose. Nunca hay un
     salto: se mezcla contra la guardia en ambos extremos. */
  var BLEND_IN = 0.10, BLEND_OUT = 0.18;

  /**
   * @param seed entero estable por entidad. NADA de Math.random: aunque el
   *        ruido de manos sea cosmético, dos ejecuciones con la misma semilla
   *        de mundo deben producir el mismo fotograma.
   */
  Act.createState = function (seed) {
    var s = (seed | 0) * 2654435761 % 6283;   // desfase determinista 0..2π·1000
    return {
      family: null, t: 0, duration: 0, isPower: false,
      weight: 0,             // 0..1 — cuánto pesa la acción sobre la guardia
      variant: 0, normalSequence: 0, visualAction: null,
      /* Familia VISUAL del hechizo en curso (data/castFamilies.js). La fija la
         simulación al empezar el casteo y sobrevive hasta la recuperación: es
         lo que hace que curar y enraizar no se vean igual. */
      castFamily: null, spellGesture: null,
      // Reacción al daño: aditiva y direccional.
      react: { amount: 0, front: 0, side: 0 },
      // Ruido de respiración de las manos en reposo.
      idleNoise: (s < 0 ? -s : s) / 1000,
      /* INERCIA DEL ARMA. `target` es lo que la pose pide este fotograma;
         `lag` es dónde está el arma de verdad, persiguiéndolo con retardo. Un
         arma que obedece al instante no pesa nada: el retardo ES la masa. */
      weaponTarget: { pitch: 0, roll: 0, yaw: 0 },
      weaponLag: { pitch: 0, roll: 0, yaw: 0 },
      weaponInit: false
    };
  };

  Act.trigger = function (st, family, cfg, isPower, castFamily, visualAction, visualVariant, spellGesture) {
    st.family = family;
    st.duration = (cfg.actionTime[family] || 0.42);
    st.t = 0;
    st.isPower = !!isPower;
    st.visualAction = visualAction || null;
    /* Dos normales melee alternan de forma DETERMINISTA: horizontal y diagonal.
       No cambia daño/timing de simulación; sólo evita el metronómico mismo tajo. */
    if (family === Act.FAMILY.LIGHT_SWING && !isPower) {
      st.variant = st.normalSequence & 1;
      st.normalSequence++;
    } else st.variant = Math.max(0, Math.min(3, visualVariant || 0));
    if (castFamily !== undefined && castFamily !== null) st.castFamily = castFamily;
    if (spellGesture !== undefined && spellGesture !== null) st.spellGesture = spellGesture;
  };

  /** La simulación ha empezado un casteo: fija la familia visual del gesto. */
  Act.beginCast = function (st, castFamily, visualAction, spellGesture) {
    st.castFamily = castFamily || null;
    st.visualAction = visualAction || null;
    st.spellGesture = spellGesture || null;
  };

  /** Cancela sólo la representación de una acción aún no liberada. La simulación
   * ya tomó la decisión; aquí simplemente dejamos que BLEND_OUT la disuelva. */
  Act.cancelVisual = function (st) {
    if (!st || !st.family) return;
    st.t = 1;
  };

  Act.update = function (st, cfg, dt) {
    st.idleNoise += dt * 0.9;
    if (st.family) {
      if (st.t < 1) {
        st.t = Math.min(1, st.t + dt / Math.max(0.05, st.duration));
        // Entrada rápida (el golpe debe sentirse inmediato) y salida algo más
        // larga: el cuerpo REGRESA a la guardia, no se teletransporta a ella.
        st.weight = Math.min(1, Math.min(smooth(st.t / BLEND_IN), 1));
      } else {
        // La acción terminó pero la pose sigue disolviéndose hacia la guardia.
        st.weight -= dt / Math.max(0.02, BLEND_OUT);
        if (st.weight <= 0) { st.weight = 0; st.family = null; st.t = 0; }
      }
    }
    if (st.react.amount > 0) {
      st.react.amount = Math.max(0, st.react.amount - dt * cfg.hitReactDecay);
    }

    /* El arma persigue el objetivo que dejó la pose del fotograma anterior. Un
       fotograma de latencia en un filtro de retardo es irrelevante, y a cambio
       `upperBodyPose` no necesita conocer dt ni el reloj del frame. */
    var rate = cfg.weaponLagRate === undefined ? 16 : cfg.weaponLagRate;
    if (!st.weaponInit) {
      st.weaponLag.pitch = st.weaponTarget.pitch;
      st.weaponLag.roll = st.weaponTarget.roll;
      st.weaponLag.yaw = st.weaponTarget.yaw;
      st.weaponInit = true;
    } else {
      st.weaponLag.pitch = damp(st.weaponLag.pitch, st.weaponTarget.pitch, rate, dt);
      st.weaponLag.roll = damp(st.weaponLag.roll, st.weaponTarget.roll, rate, dt);
      st.weaponLag.yaw = damp(st.weaponLag.yaw, st.weaponTarget.yaw, rate, dt);
    }
  };

  /**
   * Sustituye los ángulos del arma por su versión retardada.
   * Se llama al final de cada pose: la pose dice adónde DEBERÍA apuntar el arma
   * y esto dice dónde está realmente, que no es lo mismo cuando el arma pesa.
   */
  Act._applyWeaponInertia = function (A, st, cfg) {
    st.weaponTarget.pitch = A.weaponPitch;
    st.weaponTarget.roll = A.weaponRoll;
    st.weaponTarget.yaw = A.weaponYaw || 0;
    var k = cfg.weaponLagAmount === undefined ? 1 : cfg.weaponLagAmount;
    if (k <= 0 || !st.weaponInit) return A;
    A.weaponPitch += (st.weaponLag.pitch - A.weaponPitch) * k;
    A.weaponRoll += (st.weaponLag.roll - A.weaponRoll) * k;
    A.weaponYaw = (A.weaponYaw || 0) + (st.weaponLag.yaw - (A.weaponYaw || 0)) * k;
    return A;
  };

  /** Nombre legible del estado de acción, para el overlay de depuración. */
  Act.stateName = function (st) {
    if (!st || !st.family) return 'IDLE';
    var ph = st.t < 0.30 ? 'ANTICIPATION' : (st.t < 0.52 ? 'ACTIVE'
           : (st.t < 0.70 ? 'IMPACT' : 'RECOVERY'));
    var fam = st.family.toUpperCase() + (st.castFamily ? '/' + st.castFamily.toUpperCase() : '');
    return 'ACTION_' + fam + (st.isPower ? '_POWER' : '') + ':' + ph;
  };

  /** Reacción direccional al daño. front/side en espacio local del receptor. */
  Act.react = function (st, front, side) {
    st.react.amount = 1;
    st.react.front = front;
    st.react.side = side;
  };

  /* =========================================================================
   * Pose de la parte superior del cuerpo
   *
   * Devuelve ángulos de ambos brazos y del arma. Nunca toca las piernas: eso es
   * lo que permite disparar mientras se strafea.
   * ====================================================================== */
  function blankPose(cfg, armSwing) {
    return {
      left:  { pitch: armSwing, yaw: 0, roll: 0.16, elbow: cfg.elbowBaseBend, wrist: 0 },
      right: { pitch: -armSwing, yaw: 0, roll: -0.16, elbow: cfg.elbowBaseBend, wrist: 0 },
      weaponPitch: 0.40, weaponRoll: 0, weaponYaw: 0,
      weaponOffsetX: 0, weaponOffsetY: 0, weaponOffsetZ: 0,
      draw: 0, gemFlash: 0, bowPitch: 1.0, bowYaw: 0,
      chestPitch: 0, chestYaw: 0, chestRoll: 0,
      kneeAbsorb: 0, bowShake: 0, kick: 0
    };
  }

  var ARM_KEYS = ['pitch', 'yaw', 'roll', 'elbow', 'wrist'];
  var TOP_KEYS = ['weaponPitch', 'weaponRoll', 'weaponYaw', 'weaponOffsetX', 'weaponOffsetY', 'weaponOffsetZ',
                  'draw', 'gemFlash', 'bowPitch',
                  'bowYaw', 'chestPitch', 'chestYaw', 'chestRoll',
                  'kneeAbsorb', 'bowShake', 'kick'];

  /** Mezcla `from` hacia `to` con peso w. Sin esto, cada acción daría un salto. */
  function blendPose(from, to, w) {
    var i, k;
    for (i = 0; i < ARM_KEYS.length; i++) {
      k = ARM_KEYS[i];
      from.left[k] += (to.left[k] - from.left[k]) * w;
      from.right[k] += (to.right[k] - from.right[k]) * w;
    }
    for (i = 0; i < TOP_KEYS.length; i++) {
      k = TOP_KEYS[i];
      from[k] += ((to[k] || 0) - from[k]) * w;
    }
    return from;
  }

  Act.upperBodyPose = function (st, cfg, archetype, loadout, castProgress, casting, armSwing) {
    var A = blankPose(cfg, armSwing);
    var swingBend = cfg.elbowSwingBend * Math.abs(armSwing);
    A.left.elbow += swingBend;
    A.right.elbow += swingBend;

    // Guardia base por arquetipo: lo que se ve el 90 % del tiempo.
    Act._guard(A, cfg, archetype, loadout, st, armSwing);

    // Casteo sostenido: tiene prioridad sobre la guardia, pero no sobre un
    // ataque en curso, porque la simulación no permite ambos a la vez.
    // `castProgress` ya entra y sale de forma continua, así que la propia curva
    // hace de mezcla.
    var acting = st.family && st.weight > 0.001;

    /* ORDEN IMPORTANTE. `castProgress` decae suavemente tras completar el
       casteo, así que si la pose de canalización se comprobara primero seguiría
       ganando durante casi medio segundo — justo el medio segundo en el que
       debe verse la LIBERACIÓN. Ese era el motivo real de que soltar un hechizo
       no se viera: la pose de release existía y nunca llegaba a pintarse. */
    if (!acting && (casting || castProgress > 0.02)) {
      var C = blankPose(cfg, armSwing);
      Act._guard(C, cfg, archetype, loadout, st, armSwing);
      /* PRE-RELEASE por arquetipo. Antes, cualquier habilidad con castTime
         adoptaba la pose de mago, incluso un arquero tensando una flecha. */
      if (archetype === 'archer') Act._archerCastPose(C, castProgress, st.visualAction);
      else if (archetype === 'melee') Act._meleeCastPose(C, castProgress, st.visualAction);
      else Act._castPose(C, cfg, castProgress, st.castFamily, st);
      // PREPARE tiene que sentirse INMEDIATO: el jugador ha pulsado y el cuerpo
      // debe responder ya. Por eso la mezcla se completa en el primer 12 % del
      // casteo, no gradualmente a lo largo de todo él.
      blendPose(A, C, smooth(castProgress / 0.12));
      return Act._applyReaction(A, st, cfg);
    }

    if (acting) {
      // La acción se calcula sobre una copia de la guardia y luego se mezcla:
      // así el arranque y el final de cada golpe son continuos por construcción.
      var B = blankPose(cfg, armSwing);
      Act._guard(B, cfg, archetype, loadout, st, armSwing);
      var ph = cfg.phases[st.family] || cfg.phases.light;
      switch (st.family) {
        case Act.FAMILY.LIGHT_SWING: Act._lightSwing(B, st.t, ph, st.variant); break;
        case Act.FAMILY.HEAVY_SWING: Act._heavySwing(B, st.t, ph, st.variant); break;
        case Act.FAMILY.THRUST: Act._thrust(B, st.t, ph, st.variant); break;
        case Act.FAMILY.KICK: Act._kick(B, st.t, ph, st.variant); break;
        case Act.FAMILY.SHIELD_BASH: Act._shieldBash(B, st.t, ph, st.variant); break;
        case Act.FAMILY.CHARGE: Act._charge(B, st.t, ph, st.variant); break;
        case Act.FAMILY.WAR_CRY: Act._warCry(B, st.t, ph, st.variant); break;
        case Act.FAMILY.ARCHER_SHOT: Act._archerShot(B, st.t, ph, st.isPower, st.visualAction, st.variant); break;
        case Act.FAMILY.ARCANE_PULSE: Act._arcanePulse(B, st.t, ph); break;
        case Act.FAMILY.CAST: Act._castRelease(B, st.t, ph, st.castFamily, st.variant, st.spellGesture); break;
      }
      blendPose(A, B, st.weight);
    }
    return Act._applyReaction(A, st, cfg);
  };

  /* --- Guardias de reposo --------------------------------------------------- */
  Act._guard = function (A, cfg, archetype, loadout, st, armSwing) {
    var idle = Math.sin(st.idleNoise) * 0.02;   // micro-movimiento de manos
    armSwing = armSwing || 0;
    if (archetype === 'melee') {
      // GUARDIA ALTA. El arma no cuelga: se sostiene lista, cruzada delante del
      // cuerpo, con el codo cerrado. Un guerrero con la espada colgando parece
      // que va de paseo, no que está en un duelo.
      A.right.roll = -0.30;
      A.right.elbow = 1.15 + idle;
      A.right.pitch = -0.42;
      A.right.yaw = 0.18;
      A.weaponPitch = 0.18;
      A.weaponRoll = -0.12;
      A.chestPitch = -0.05;
      A.chestYaw = 0.10;
      if (loadout.left === 'shield') { A.left.pitch = -0.72; A.left.elbow = 1.15; }
      else { A.left.pitch = -0.18; A.left.elbow = 0.55 + idle; }
    } else if (archetype === 'archer') {
      // Arco bajo y CASI VERTICAL a un costado, mano de cuerda cerca del carcaj.
      // Un arco cruzado en diagonal delante del pecho tapa la silueta y no se
      // parece a cómo lo lleva nadie que sepa usarlo.
      A.left.pitch = -0.22 + idle;
      A.left.elbow = 0.42;
      A.left.roll = 0.22;
      A.left.yaw = -0.10;
      A.right.pitch = 0.14 + idle;
      A.right.elbow = 0.62;
      A.right.roll = -0.20;
      A.bowPitch = 0.30;
      A.bowYaw = 0.20;
      A.chestYaw = -0.08;
    } else {
      // Postura vertical con el báculo APOYADO EN EL SUELO, no cruzado en
      // diagonal delante del cuerpo. Un bastón atravesado tapa la túnica, que
      // es justo la silueta que identifica al mago.
      /* La MANO camina y el BÁCULO se estabiliza. Antes el brazo se quedaba
         casi congelado y el arma parecía soldada al cuerpo. `armSwing` viene
         de la locomoción real: lo usamos poco en hombro/codo y compensamos en
         la muñeca para que la punta tenga inercia sin bailar. */
      var counter = cfg.staffWalkCounter === undefined ? 0.40 : cfg.staffWalkCounter;
      var inertia = cfg.staffStrideInertia === undefined ? 0.18 : cfg.staffStrideInertia;
      var staffWalk = armSwing * counter;
      A.right.pitch = 0.06 - staffWalk + idle;
      A.right.elbow = 0.40 + Math.abs(staffWalk) * 0.16;
      A.right.roll = -0.25 + staffWalk * 0.08;
      A.right.wrist = 0.08 + staffWalk * 0.12;
      /* La mano acompaña el paso; la punta del báculo intenta quedarse estable.
         Esta oposición mano↔asta vende peso sin convertirla en una goma. */
      A.weaponPitch = -(A.right.pitch + A.right.elbow) + 0.06 - staffWalk * inertia;
      A.weaponRoll = -staffWalk * 0.12;
      A.weaponOffsetY = Math.abs(armSwing) * (cfg.staffGripLift || 0.024);
      A.weaponOffsetZ = -staffWalk * 0.026;
      A.left.pitch = -0.12 + armSwing * 0.22;
      A.left.elbow = 0.46 + idle + Math.abs(armSwing) * 0.10;
      A.left.wrist = -armSwing * 0.08;
      A.chestPitch = 0.015;
      A.chestYaw += -armSwing * 0.10;
    }
  };

  /* --- MELEE: tajo ligero ---------------------------------------------------
   * El pecho rota primero, el hombro sigue, después el codo y por último el
   * arma. Esa cadena es lo que hace que un golpe parezca un acto físico y no
   * una rotación de hueso.                                                    */
  Act._lightSwing = function (A, t, ph, variant) {
    var ant = smooth(t / ph.active);
    var hit = smooth((t - ph.active) / (ph.recovery - ph.active));
    var rec = smooth((t - ph.recovery) / (ph.end - ph.recovery));
    variant = variant || 0;

    if (variant === 0) {
      /* Normal A — corte horizontal: el pecho carga primero y el arma llega
         última. La recuperación cruza ligeramente el centro para vender masa. */
      A.chestYaw = 0.32 * ant - 0.48 * hit + 0.16 * rec;
      A.chestPitch = -0.05 * ant + 0.08 * hit;
      A.right.pitch = 1.02 * ant - 2.22 * hit + 0.62 * rec + 0.12;
      A.right.yaw = 0.66 * ant - 1.18 * hit + 0.52 * rec;
      A.right.roll = -0.30 - 0.46 * hit + 0.26 * rec;
      A.right.elbow = 1.42 * ant - 1.20 * hit + 0.42 * rec + 0.28;
      A.weaponPitch = 0.46 - 0.18 * hit;
      A.weaponRoll = -0.34 * hit + 0.12 * rec;
    } else {
      /* Normal B — diagonal descendente. Misma ventana lógica, silueta distinta:
         no modifica DPS ni weapon interval, sólo rompe la repetición robótica. */
      A.chestYaw = -0.22 * ant + 0.36 * hit - 0.12 * rec;
      A.chestPitch = -0.14 * ant + 0.22 * hit - 0.08 * rec;
      A.right.pitch = 1.62 * ant - 2.72 * hit + 0.82 * rec + 0.22;
      A.right.yaw = -0.32 * ant + 0.64 * hit - 0.20 * rec;
      A.right.roll = -0.12 - 0.62 * ant + 0.42 * hit + 0.10 * rec;
      A.right.elbow = 1.52 * ant - 1.32 * hit + 0.52 * rec + 0.22;
      A.weaponPitch = 0.22 - 0.32 * hit + 0.10 * rec;
      A.weaponRoll = 0.28 * ant - 0.46 * hit + 0.16 * rec;
    }
    A.left.elbow = 0.58 + 0.22 * ant;
    A.kneeAbsorb = hit * (1 - rec) * 0.09;
    A.chestRoll += (variant === 0 ? -0.07 : 0.09) * ant + (variant === 0 ? 0.10 : -0.12) * hit;
  };

  /* --- MELEE: golpe pesado --------------------------------------------------
   * La cadera participa mucho más, el arma sube, el cuerpo carga peso y al
   * caer las rodillas absorben. Recuperación más larga: eso es el peso.       */
  Act._heavySwing = function (A, t, ph, variant) {
    var ant = smooth(t / ph.active);
    var hit = smooth((t - ph.active) / (ph.recovery - ph.active));
    var rec = smooth((t - ph.recovery) / (ph.end - ph.recovery));

    A.chestPitch = -0.22 * ant + 0.34 * hit - 0.12 * rec;
    A.chestYaw = 0.20 * ant - 0.26 * hit;
    A.right.pitch = 2.45 * ant - 3.15 * hit + 1.15 * rec + 0.55;
    A.right.roll = -0.08 - 0.22 * ant + 0.12 * hit;
    A.right.elbow = 1.25 * ant - 1.15 * hit + 0.40 * rec + 0.20;
    A.weaponPitch = 0.10 - 0.30 * hit;
    A.left.pitch = -0.60 * ant - 0.35 * hit + 0.40 * rec;
    A.left.elbow = 0.85 + 0.35 * ant;
    A.kneeAbsorb = hit * (1 - rec) * 0.28;   // lo consume la capa de piernas
    A.chestRoll = -0.10 * ant + 0.16 * hit - 0.06 * rec;
    variant = variant || 0;
    if (variant === 1) { A.chestYaw -= 0.18*ant; A.right.roll -= 0.22*hit; A.kneeAbsorb += 0.08*ant; }
    else if (variant === 2) { A.chestPitch -= 0.16*ant; A.weaponPitch -= 0.22*hit; A.left.pitch -= 0.20*ant; }
    else if (variant === 3) { A.chestRoll += 0.18*ant-0.24*hit; A.right.yaw += 0.24*ant; A.kneeAbsorb += 0.12*hit; }
  };

  /* --- MELEE: estocada ------------------------------------------------------ */
  Act._thrust = function (A, t, ph, variant) {
    var ant = smooth(t / ph.active);
    var hit = smooth((t - ph.active) / (ph.recovery - ph.active));
    var rec = smooth((t - ph.recovery) / (ph.end - ph.recovery));

    A.chestYaw = -0.22 * ant + 0.30 * hit;
    A.right.pitch = 0.70 * ant - 1.85 * hit + 0.85 * rec;
    A.right.elbow = 1.70 * ant - 1.60 * hit + 0.50 * rec + 0.25;
    A.weaponPitch = -0.10 - 0.35 * hit;
    A.left.pitch = -0.30 * ant;
    variant = variant || 0;
    if (variant === 1) { A.chestPitch -= 0.12*ant; A.right.yaw += 0.16*hit; }
    else if (variant === 2) { A.chestRoll -= 0.16*ant; A.left.pitch -= 0.26*hit; A.kneeAbsorb=0.08*ant; }
    else if (variant === 3) { A.chestYaw += 0.18*ant; A.weaponRoll=0.18*hit; A.kneeAbsorb=0.12*hit; }
  };

  /* --- MELEE: puntapié / control táctico ------------------------------- */
  Act._kick = function (A, t, ph, variant) {
    var load = smooth(t / ph.active);
    var hit = smooth((t - ph.active) / Math.max(0.06, ph.impact - ph.active));
    var rec = smooth((t - ph.impact) / Math.max(0.08, ph.end - ph.impact));
    A.chestPitch = -0.10 * load + 0.24 * hit - 0.12 * rec;
    A.chestYaw = 0.14 * load - 0.12 * rec;
    A.right.pitch = -0.30 - 0.18 * load + 0.26 * rec; // arma se aparta, no protagoniza
    A.right.elbow = 1.05 + 0.18 * load - 0.22 * rec;
    A.left.pitch = -0.48 * load + 0.22 * rec;
    A.kneeAbsorb = 0.18 * load - 0.08 * rec;
    A.kick = clamp(load * 0.35 + hit * 0.90 - rec * 0.95, 0, 1);
    A.weaponPitch = 0.16;
    variant = variant || 0;
    A.chestRoll += ((variant===1)?0.10:(variant===2?-0.12:(variant===3?0.17:0))) * load;
    A.kick *= (variant===2 ? 0.92 : 1);
  };

  /* --- MELEE: golpe de escudo --------------------------------------------- */
  Act._shieldBash = function (A, t, ph, variant) {
    var load = smooth(t / ph.active);
    var hit = smooth((t - ph.active) / Math.max(0.06, ph.impact - ph.active));
    var rec = smooth((t - ph.impact) / Math.max(0.08, ph.end - ph.impact));
    A.chestPitch = -0.13 * load + 0.25 * hit - 0.10 * rec;
    A.chestYaw = -0.18 * load + 0.24 * hit - 0.08 * rec;
    A.left.pitch = -0.70 - 0.30 * load + 0.42 * hit + 0.20 * rec;
    A.left.elbow = 1.12 + 0.24 * load - 0.48 * hit + 0.18 * rec;
    A.left.yaw = -0.22 + 0.46 * hit;
    A.right.pitch = -0.28 + 0.18 * load;
    A.right.elbow = 1.10;
    A.kneeAbsorb = 0.10 * hit * (1 - rec);
    variant = variant || 0;
    if (variant===1) { A.left.yaw += 0.22*load; A.chestRoll=0.12*hit; }
    else if (variant===2) { A.left.pitch -= 0.22*load; A.kneeAbsorb += 0.10*load; }
    else if (variant===3) { A.chestYaw -= 0.20*load; A.right.pitch -= 0.16*hit; }
  };

  /* --- MELEE: carga -------------------------------------------------------- */
  Act._charge = function (A, t, ph, variant) {
    var brace = smooth(t / ph.active);
    var drive = smooth((t - ph.active) / Math.max(0.08, ph.impact - ph.active));
    var rec = smooth((t - ph.impact) / Math.max(0.08, ph.end - ph.impact));
    A.chestPitch = -0.28 * brace - 0.18 * drive + 0.34 * rec;
    A.chestYaw = 0.10 * brace - 0.12 * drive;
    A.right.pitch = -0.62 * brace - 0.24 * drive + 0.50 * rec;
    A.right.elbow = 1.28 + 0.12 * brace;
    A.left.pitch = -0.42 * brace;
    A.kneeAbsorb = 0.15 * brace + 0.08 * drive - 0.12 * rec;
    variant = variant || 0;
    if (variant===1) { A.chestYaw += 0.18*brace; A.right.roll -= 0.18*drive; }
    else if (variant===2) { A.chestPitch -= 0.14*drive; A.kneeAbsorb += 0.09*brace; }
    else if (variant===3) { A.chestRoll=-0.14*brace+0.18*drive; A.left.pitch -= 0.20*brace; }
  };

  /* --- MELEE: grito táctico ------------------------------------------------ */
  Act._warCry = function (A, t, ph, variant) {
    var open = smooth(t / ph.active);
    var peak = smooth((t - ph.active) / Math.max(0.08, ph.impact - ph.active));
    var rec = smooth((t - ph.impact) / Math.max(0.08, ph.end - ph.impact));
    A.chestPitch = -0.18 * open - 0.10 * peak + 0.22 * rec;
    A.chestYaw = 0;
    A.left.pitch = -0.82 * open + 0.54 * rec;
    A.right.pitch = -0.92 * open + 0.62 * rec;
    A.left.elbow = 0.62 + 0.20 * open;
    A.right.elbow = 0.82 + 0.18 * open;
    A.weaponPitch = -0.18 * open + 0.16 * rec;
    A.kneeAbsorb = 0.06 * open;
    variant = variant || 0;
    if (variant===1) { A.left.roll=-0.30*open; A.right.roll=0.30*open; }
    else if (variant===2) { A.chestPitch -= 0.14*peak; A.kneeAbsorb += 0.08*peak; }
    else if (variant===3) { A.chestYaw=0.16*open-0.16*rec; A.weaponPitch -= 0.18*peak; }
  };

  /* --- PRE-RELEASE: arquero ----------------------------------------------
   * Un cast de arco es literalmente RAISE→NOCK→DRAW. Nunca usa la pose de mago.
   * Se queda justo antes de RELEASE; el evento autoritativo inicia el recoil. */
  Act._archerCastPose = function (A, c, visualAction) {
    var ph = { impact: 0.62, end: 1.0 };
    Act._archerShot(A, Math.min(0.60, c * 0.60), ph, true, visualAction);
    A.gemFlash = 0;
  };

  /* --- PRE-RELEASE: weapon skill melee ------------------------------------ */
  Act._meleeCastPose = function (A, c, visualAction) {
    var load = smooth(c);
    if (visualAction === 'kick') {
      A.chestPitch = -0.08 * load;
      A.right.pitch = -0.34 - 0.14 * load;
      A.right.elbow = 1.08;
      A.left.pitch = -0.28 * load;
      A.kneeAbsorb = 0.10 * load;
      return;
    }
    if (visualAction === 'shield') {
      A.left.pitch = -0.72 - 0.24 * load;
      A.left.elbow = 1.10 + 0.18 * load;
      A.chestPitch = -0.10 * load;
      return;
    }
    /* Heavy/thrust: el cuerpo carga sin cruzar todavía la ventana de impacto. */
    A.chestPitch = -0.18 * load;
    A.chestYaw = 0.20 * load;
    A.right.pitch = 0.42 + 1.45 * load;
    A.right.yaw = 0.34 * load;
    A.right.elbow = 0.82 + 0.52 * load;
    A.weaponPitch = 0.18 - 0.12 * load;
    A.left.pitch = -0.24 - 0.28 * load;
    A.kneeAbsorb = 0.06 * load;
  };

  /* --- ARQUERO: RAISE → NOCK → DRAW → AIM → RELEASE → FOLLOW_THROUGH --------
   * El brazo del arco permanece casi extendido; el codo de la cuerda retrocede
   * hasta la mejilla; el pecho rota; al soltar hay recoil y el arco vibra.    */
  Act._archerShot = function (A, t, ph, isPower, visualAction, variant) {
    /* Cuatro lecturas corporales para poderes de arco. La lógica de combate no
       cambia: sólo la silueta alrededor del mismo RELEASE autoritativo. */
    var isVolley = visualAction === 'archerVolley';
    var isControl = visualAction === 'archerControl';
    var isQuick = visualAction === 'archerQuick';
    var isPowerShot = visualAction === 'archerPower' || (!!isPower && !visualAction);
    var raiseSpeed = isQuick ? 0.11 : (isVolley ? 0.20 : 0.16);
    var raise = smooth(t / raiseSpeed);
    var nock = smooth((t - 0.10) / 0.15);
    var drawEnd = isQuick ? Math.min(0.48, ph.impact) : ((isPower || isVolley || isControl || isPowerShot) ? 0.62 : ph.impact);
    var pull = smooth((t - 0.24) / (drawEnd - 0.24));
    var aim = smooth((t - drawEnd * 0.85) / Math.max(0.05, drawEnd * 0.15));
    var rel = smooth((t - drawEnd) / 0.10);
    var follow = smooth((t - drawEnd - 0.10) / Math.max(0.05, ph.end - drawEnd - 0.10));

    // Brazo del arco: sube y se queda casi recto apuntando al objetivo.
    A.left.pitch = (-1.48 + (isVolley ? -0.32 : 0) + (isControl ? 0.12 : 0)) * raise;
    A.left.yaw = (-0.18 + (isVolley ? 0.16 : 0) + (isControl ? -0.18 : 0)) * raise;
    A.left.elbow = 0.10 + 0.06 * raise;
    A.left.wrist = -0.06 * raise;

    // Brazo de la cuerda: encaja la flecha, tira hasta la mejilla, suelta.
    A.right.pitch = -1.22 * raise - 0.10 * nock;
    A.right.yaw = (0.50 + (isPowerShot ? 0.36 : 0) + (isControl ? 0.16 : 0) - (isQuick ? 0.10 : 0)) * pull;
    A.right.elbow = 0.58 + (1.62 + (isPowerShot ? 0.42 : 0) + (isVolley ? 0.18 : 0) - (isQuick ? 0.22 : 0)) * pull - 1.34 * rel;
    A.right.wrist = -0.10 * nock + 0.16 * pull - 0.20 * rel;

    // El pecho rota con el tensado: sin torsión no hay potencia legible.
    A.chestYaw = (0.22 + (isPowerShot ? 0.20 : 0) + (isControl ? -0.10 : 0)) * pull - 0.30 * rel;
    A.chestPitch = (-0.06 + (isVolley ? -0.20 : 0) + (isControl ? 0.08 : 0)) * aim;
    A.chestRoll = (isControl ? -0.12 : (isVolley ? 0.08 : 0)) * pull;
    A.kneeAbsorb = (isPowerShot ? 0.05 : 0) * pull + (isVolley ? 0.10 : 0) * aim;

    A.draw = clamp(pull - rel, 0, 1);
    A.bowPitch = 1.40 - 0.05 * pull + 0.04 * rel + (isVolley ? -0.25 : 0) + (isControl ? 0.10 : 0);
    A.bowYaw = -0.06 * pull + 0.03 * follow + (isControl ? -0.12 : 0);
    // Recoil del brazo de cuerda y vibración del arco tras soltar.
    A.right.pitch += 0.45 * rel - 0.20 * follow;
    A.bowShake = Math.max(0, rel - follow) * 0.06;
    variant = variant || 0;
    if (variant===1) { A.chestRoll += 0.10*pull; A.left.yaw -= 0.12*raise; }
    else if (variant===2) { A.chestPitch -= 0.10*aim; A.right.yaw += 0.16*pull; A.kneeAbsorb += 0.05*pull; }
    else if (variant===3) { A.chestYaw -= 0.12*pull; A.bowYaw += 0.14*raise; A.left.roll += 0.10*raise; }
  };

  /* =========================================================================
   * EL MAGO
   *
   * Antes de esto el caster tenía dos poses: una interpolación lineal de cinco
   * ángulos sobre castProgress, y una estocada de báculo. De ahí salían todos
   * sus problemas: sin fases, el cuerpo recorría el casteo entero a velocidad
   * constante; sin familias, curar y enraizar eran el mismo gesto; y sin cadena
   * cinética, torso, hombro y arma arrancaban en el mismo fotograma.
   *
   * El pipeline es ahora:
   *
   *   PREPARE → GATHER → CHANNEL   ← gobernados por castProgress (simulación)
   *   RELEASE → RECOVERY           ← gobernados por el reloj de la acción
   *
   * La simulación sigue decidiendo cuánto dura el casteo, si es interrumpible y
   * si permite moverse. Esto sólo decide cómo se ve cada tramo.
   * ====================================================================== */

  /* --- Modificadores por familia -------------------------------------------
   * Un solo eje por familia, deliberadamente pequeño. Siete poses
   * independientes serían siete cosas que mantener; siete DESVIACIONES sobre
   * una base común se leen distintas y siguen siendo el mismo personaje.      */
  /* Mantiene el báculo bajo un ángulo de mundo legible. Como el arma cuelga
     de hombro→codo→mano, sumar otro pitch grande en la muñeca duplicaba la
     rotación y producía el típico báculo que se voltea dentro de la mano. */
  function orientStaff(A, desiredPitch) {
    A.weaponPitch = desiredPitch - (A.right.pitch + A.right.elbow);
  }

  var CAST_MOD = {
    //            báculo↔frente  mano libre  torso  apertura  base baja  golpe suelo  arranque
    projectile: { staffFwd: 0.38, freeHand: 0.48, chest: 0.14, open: -0.08, stanceLow: 0.02, staffDown: 0.00, startRaise: 1.00 },
    control:    { staffFwd: -0.02, freeHand: 1.18, chest: 0.30, open: 0.16, stanceLow: 0.10, staffDown: 0.00, startRaise: 1.00 },
    buff:       { staffFwd: -0.20, freeHand: 0.70, chest: -0.06, open: -0.15, stanceLow: 0.00, staffDown: 0.00, startRaise: 0.85 },
    heal:       { staffFwd: -0.20, freeHand: 1.12, chest: -0.22, open: 0.62, stanceLow: 0.00, staffDown: 0.00, startRaise: 0.86 },
    aoe:        { staffFwd: 0.06, freeHand: 0.34, chest: 0.26, open: 0.28, stanceLow: 0.42, staffDown: 0.78, startRaise: 1.00 },
    channel:    { staffFwd: 0.15, freeHand: 0.85, chest: 0.06, open: 0.25, stanceLow: 0.12, staffDown: 0.00, startRaise: 1.00 },
    /* INSTANT no viene precedido de canalización: no hay pose alta desde la que
       continuar, así que arranca casi desde la guardia. Fingir el arranque alto
       produciría un salto de brazo de 130° en tres fotogramas. */
    instant:    { staffFwd: 0.25, freeHand: 0.45, chest: 0.08, open: 0.00, stanceLow: 0.00, staffDown: 0.00, startRaise: 0.22 }
  };
  function modOf(family) { return CAST_MOD[family] || CAST_MOD.projectile; }

  /* --- PREPARE → GATHER → CHANNEL ------------------------------------------
   *
   * PREPARE  el cuerpo se afirma y reorienta el báculo. Corto y con respuesta
   *          inmediata: es lo que confirma al jugador que su pulsación entró.
   * GATHER   la mano libre empieza a recoger energía, el báculo se eleva.
   * CHANNEL  tensión mantenida. NO congelada: hay respiración contenida y
   *          microcompensaciones, porque un mago inmóvil parece un maniquí y
   *          además hace imposible saber si el casteo sigue vivo.
   */
  function applySpellGesture(A, gesture, k, release) {
    if (!gesture || gesture==='cast') return;
    k=Math.max(0,Math.min(1,k||0));
    if (gesture==='meteor') {
      // Invocation overhead: both hands rise and the torso opens before the
      // downward command. Silhouette intentionally unlike a forward projectile.
      A.right.pitch -= 0.42*k; A.right.elbow += 0.22*k;
      A.left.pitch -= 0.78*k; A.left.elbow += 0.18*k; A.left.yaw -= 0.18*k;
      A.chestPitch -= 0.15*k; A.kneeAbsorb += 0.025*k;
      orientStaff(A, -0.18-0.18*k);
      if (release) { A.right.pitch += 0.78*k; A.left.pitch += 0.42*k; A.chestPitch += 0.24*k; }
    } else if (gesture==='hurl') {
      A.chestYaw += 0.18*k; A.right.yaw += 0.22*k; A.right.pitch += 0.10*k;
      A.left.pitch -= 0.42*k; A.left.elbow += 0.16*k; A.left.yaw -= 0.20*k;
      if (release) { A.chestYaw -= 0.44*k; A.left.pitch -= 0.38*k; A.left.elbow -= 0.20*k; A.weaponYaw += 0.22*k; }
    } else if (gesture==='freeze' || gesture==='shatter') {
      A.left.pitch -= 0.72*k; A.left.elbow -= 0.18*k; A.left.roll += 0.42*k;
      A.right.pitch -= 0.14*k; A.chestYaw -= 0.12*k; A.kneeAbsorb += 0.018*k;
      if (release) { A.left.pitch -= 0.25*k; A.chestPitch += 0.12*k; A.weaponRoll -= 0.18*k; }
    } else if (gesture==='lightning') {
      A.right.pitch -= 0.62*k; A.right.elbow += 0.24*k; orientStaff(A,-0.28);
      A.left.pitch -= 0.52*k; A.left.yaw -= 0.42*k; A.chestPitch -= 0.12*k;
      if (release) { A.right.pitch += 0.72*k; A.left.pitch += 0.28*k; A.chestYaw += 0.36*k; A.weaponYaw += 0.30*k; }
    } else if (gesture==='storm') {
      A.right.pitch -= 0.38*k; A.left.pitch -= 0.56*k; A.left.yaw -= 0.56*k;
      A.right.yaw += 0.24*k; A.chestPitch -= 0.10*k; A.kneeAbsorb += 0.05*k;
      if (release) { A.left.roll += 0.48*k; A.right.roll -= 0.28*k; A.chestPitch += 0.18*k; }
    } else if (gesture==='groundSpike' || gesture==='groundFlame') {
      A.right.pitch += 0.34*k; A.left.pitch += 0.18*k; A.chestPitch += 0.28*k; A.kneeAbsorb += 0.07*k;
      orientStaff(A, -0.42+0.58*k);
      if (release) { A.right.pitch += 0.30*k; A.weaponRoll -= 0.22*k; }
    } else if (gesture==='shadow' || gesture==='drain' || gesture==='dominate') {
      A.chestPitch += 0.12*k; A.chestYaw -= 0.16*k; A.left.pitch -= 0.38*k;
      A.left.elbow += 0.40*k; A.right.elbow += 0.18*k;
      if (release) { A.left.pitch -= 0.34*k; A.chestPitch -= 0.22*k; A.weaponYaw -= 0.24*k; }
    } else if (gesture==='ward' || gesture==='heal') {
      A.chestPitch -= 0.12*k; A.left.pitch -= 0.62*k; A.left.yaw -= 0.58*k; A.left.elbow -= 0.10*k;
      A.right.pitch -= 0.18*k; orientStaff(A,-0.05);
      if (release) { A.left.roll += 0.30*k; A.chestPitch += 0.08*k; }
    } else if (gesture==='bind') {
      A.left.pitch -= 0.58*k; A.left.elbow += 0.10*k; A.left.roll -= 0.35*k; A.chestYaw += 0.15*k;
      if (release) { A.left.pitch -= 0.28*k; A.right.pitch += 0.18*k; }
    } else if (gesture==='summon') {
      A.right.pitch -= 0.48*k; A.left.pitch -= 0.48*k; A.left.yaw -= 0.36*k; A.chestPitch -= 0.10*k;
      if (release) { A.kneeAbsorb += 0.04*k; A.chestPitch += 0.18*k; }
    }
  }

  Act._castPose = function (A, cfg, c, family, st) {
    var m = modOf(family);
    var prep = smooth(c / CAST_PREPARE_END);
    var gath = smooth((c - CAST_PREPARE_END * 0.6) / (CAST_GATHER_END - CAST_PREPARE_END * 0.6));
    var chan = smooth((c - CAST_GATHER_END) / (1 - CAST_GATHER_END));

    // Microtemblor de canalización: dos frecuencias, no una. Con una sola se
    // reconoce el seno y la tensión pasa a parecer vibración mecánica.
    var n = st ? st.idleNoise : 0;
    var tremor = (Math.sin(n * 5.3) * 0.6 + Math.sin(n * 8.9 + 1.1) * 0.4) * 0.020 * chan;
    var breath = Math.sin(n * 2.1) * 0.014 * chan;

    /* Brazo del báculo: se afirma, luego se eleva, y en canal queda sostenido. */
    A.right.pitch = -0.18 - 0.38 * prep - (0.68 + m.staffFwd * 0.42) * gath - 0.06 * chan + tremor;
    A.right.elbow = 0.42 + 0.18 * prep + 0.30 * gath - 0.05 * chan;
    A.right.roll = -0.24 - 0.08 * gath;
    A.right.wrist = 0.08 + 0.12 * gath - 0.05 * chan;
    /* El brazo mueve el asta; la muñeca sólo corrige. Evitar giros de más de
       ~90° elimina el efecto de báculo que se voltea dentro de la mano. */
    var staffHold = 0.06 - 0.10 * prep - (0.24 + m.staffDown * 0.32) * gath + tremor * 0.65;
    orientStaff(A, staffHold);
    A.weaponRoll = -0.045 * gath;
    A.weaponYaw = tremor * 0.55;
    A.weaponOffsetY = 0.012 * prep + 0.026 * gath;
    A.weaponOffsetZ = -0.018 * gath;

    /* Mano libre: es la que domina el gesto y la que cambia entre familias. */
    A.left.pitch = -0.35 * prep - (0.95 * m.freeHand) * gath - 0.12 * chan + breath;
    A.left.yaw = -0.22 * m.open * gath;
    A.left.roll = 0.20 + 0.28 * m.open * gath;
    A.left.elbow = 0.40 + 0.35 * prep + (0.55 - 0.30 * m.open) * gath;

    /* Tronco: se abre al tomar aire y sostiene la tensión. */
    A.chestPitch = -0.05 * prep - (0.14 + m.chest * 0.5) * gath + breath * 1.6;
    A.chestYaw = m.chest * 0.5 * gath + tremor * 1.2;
    A.chestRoll = tremor * 0.6;

    // Rodillas: afirmar los pies es lo primero que hace alguien que va a soltar
    // algo pesado. Lo consume la capa de piernas, no lo decide ella.
    A.kneeAbsorb = (0.030 + m.stanceLow * 0.055) * prep;
    A.gemFlash = 0.35 * gath + 0.55 * chan;    // la gema anuncia el hechizo
    applySpellGesture(A, st && st.spellGesture, Math.max(gath,chan), false);
  };

  /* --- RELEASE → RECOVERY --------------------------------------------------
   *
   * CADENA CINÉTICA. El torso arranca, el hombro le sigue, después el codo y
   * por último el báculo. Cada eslabón entra con un retardo propio: es esa
   * secuencia, y no la amplitud, lo que hace que una descarga parezca un acto
   * físico en vez de una rotación simultánea de cuatro huesos.
   *
   * RECOVERY es corto a propósito. Esto es PvP: quedarse admirando la pose es
   * tiempo en el que el jugador no puede reaccionar.
   */
  Act._castRelease = function (A, t, ph, family, variant, spellGesture) {
    var m = modOf(family);
    var raise = m.startRaise === undefined ? 1 : m.startRaise;
    var a = ph.active;                       // instante de disparo del gesto
    var span = Math.max(0.08, ph.impact - ph.active);

    function link(delay) { return smooth((t - a - delay) / span); }
    var torso = link(0.000);
    var shoulder = link(0.035);
    var elbow = link(0.070);
    var weapon = link(0.105);
    var back = smooth((t - ph.impact) / Math.max(0.08, ph.end - ph.impact));

    /* El brazo arranca donde lo dejó la canalización —arriba y atrás— y BAJA
       hacia el objetivo. La versión anterior lo subía todavía más, así que la
       liberación acababa en el mismo sitio donde había empezado y el gesto no
       se leía.
       
       El instantáneo no viene de ninguna canalización: arranca casi en guardia
       y hace lo contrario, un golpe corto hacia ARRIBA y adelante. Por eso el
       destino depende de `raise`: sin esto, un instantáneo salía de un punto
       que ya estaba pasado el objetivo y el brazo no se movía en absoluto. */
    var startPitch = -1.30 * raise - 0.12;
    var aimPitch = -0.78 - (1 - raise) * 0.28
                 + m.staffDown * 0.46;          // el área baja el brazo al suelo

    A.chestPitch = -0.24 * raise - 0.14 * torso + 0.36 * back;
    A.chestYaw = (0.24 + m.chest) * torso - 0.34 * back;
    A.chestRoll = 0;

    A.right.pitch = startPitch + (aimPitch - startPitch) * shoulder * (1 + m.staffFwd * 0.4);
    A.right.pitch += (0.08 - aimPitch) * back;
    A.right.elbow = (0.88 * raise + 0.34 * (1 - raise)) - 0.58 * elbow + 0.18 * back;
    A.right.roll = -0.26 + 0.12 * shoulder;
    A.right.wrist = 0.16 * weapon - 0.10 * back;

    // El báculo se adelanta un instante más que la mano: es el último eslabón.
    // El báculo NO se voltea hacia atrás en las áreas: se clava hacia delante y
    // abajo. Quien marca el suelo es el brazo, no un giro de muñeca imposible.
    var releaseStaff = -0.08 * raise - (0.44 + m.staffDown * 0.30) * weapon;
    releaseStaff += (0.08 - releaseStaff) * back;
    orientStaff(A, releaseStaff);
    A.weaponRoll = -0.10 * weapon + 0.08 * back;
    A.weaponYaw = 0.10 * m.open * weapon;
    A.weaponOffsetY = 0.025 * (1 - back);
    A.weaponOffsetZ = -0.045 * weapon + 0.035 * back;
    variant = variant || 0;
    if (variant===1) { A.chestRoll += 0.12*torso-0.10*back; A.left.yaw -= 0.18*weapon; }
    else if (variant===2) { A.chestPitch -= 0.10*torso; A.left.pitch -= 0.20*weapon; A.weaponYaw += 0.12*weapon; }
    else if (variant===3) { A.chestYaw -= 0.16*torso; A.right.roll -= 0.14*weapon; A.weaponRoll += 0.16*weapon; }

    /* La mano libre empuja o se abre según la familia: es la lectura más rápida
       de qué clase de hechizo acaba de salir. */
    var lStart = -0.35 - 0.95 * m.freeHand * raise - 0.12 * raise;
    A.left.pitch = lStart - 0.42 * m.freeHand * shoulder + (-0.18 - lStart) * back;
    A.left.yaw = -0.34 * m.open * shoulder;
    A.left.roll = 0.22 + 0.44 * m.open * shoulder;
    A.left.elbow = (0.90 * raise + 0.55 * (1 - raise)) - 0.42 * elbow + 0.24 * back;

    A.kneeAbsorb = (0.035 + m.stanceLow * 0.06) * weapon * (1 - back);
    A.gemFlash = Math.max(0, weapon - back * 1.4);
    applySpellGesture(A, spellGesture, Math.max(weapon,shoulder)*(1-back*.65), true);
  };

  /* --- MAGO: ataque normal — PULSO ARCANO ----------------------------------
   *
   * GUARD → PREP → PULSE → FOLLOW → RECOVER.
   *
   * NO es una estocada. El mago no apuñala con el báculo: orienta la gema,
   * deja que se cargue un instante y suelta el pulso, y el arma retrocede
   * después. La diferencia con un golpe melee está en que aquí el cuerpo
   * participa poco y el arma participa mucho: el gesto es de canalizar, no de
   * empujar.
   */
  Act._arcanePulse = function (A, t, ph) {
    var prep = smooth(t / ph.active);
    var pulse = smooth((t - ph.active) / Math.max(0.08, ph.impact - ph.active));
    var follow = smooth((t - ph.impact) / Math.max(0.08, ph.recovery - ph.impact));
    var rec = smooth((t - ph.recovery) / Math.max(0.08, ph.end - ph.recovery));

    // El báculo se orienta y la gema se adelanta; el codo se cierra cargando.
    A.right.pitch = 0.02 - 0.44 * prep - 0.36 * pulse + 0.66 * rec;
    A.right.elbow = 0.38 + 0.38 * prep - 0.28 * pulse + 0.22 * rec;
    A.right.roll = -0.26 - 0.10 * prep;
    A.right.wrist = 0.10 * prep + 0.14 * pulse - 0.12 * rec;
    // La orientación final del asta se expresa en espacio corporal y después
    // se descuenta lo que ya rotaron hombro+codo: así la gema apunta y vuelve
    // sin que el bastón atraviese la muñeca.
    var pulseStaff = -0.02 - 0.10 * prep - 0.42 * pulse + 0.20 * follow;
    pulseStaff += (0.08 - pulseStaff) * rec;
    orientStaff(A, pulseStaff);
    A.weaponYaw = -0.08 * pulse + 0.055 * follow;
    A.weaponOffsetY = 0.018 * prep + 0.010 * pulse;
    A.weaponOffsetZ = -0.035 * pulse + 0.022 * rec;

    // La mano libre estabiliza el báculo durante la carga: es lo que comunica
    // que el arma está haciendo algo, no simplemente moviéndose.
    A.left.pitch = -0.18 - 0.68 * prep + 0.30 * follow + 0.50 * rec;
    A.left.elbow = 0.42 + 0.50 * prep - 0.20 * follow;
    A.left.roll = 0.22 + 0.10 * prep;

    A.chestPitch = -0.04 - 0.09 * prep + 0.07 * follow;
    A.chestYaw = 0.10 + 0.12 * prep - 0.16 * pulse + 0.08 * rec;

    A.gemFlash = Math.max(0, prep * 0.55 + pulse - follow * 1.3);
  };

  /* --- Reacción al daño: ADITIVA -------------------------------------------
   * Se suma encima de lo que esté ocurriendo. Un golpe sin CC sacude el torso
   * y compensa un brazo, pero no congela al personaje: convertir cada impacto
   * en una estatua es lo que hace que un combate se sienta a trompicones.     */
  Act._applyReaction = function (A, st, cfg) {
    var r = st.react.amount;
    if (r <= 0.001) return Act._applyWeaponInertia(A, st, cfg);
    var k = r * r * cfg.hitReactAmount;    // decae rápido
    A.chestPitch += st.react.front * k * 1.4;
    A.chestRoll = (A.chestRoll || 0) + st.react.side * k * 1.1;
    A.chestYaw += -st.react.side * k * 0.6;
    A.left.pitch += st.react.front * k * 0.5;
    A.right.pitch += st.react.front * k * 0.5;
    return Act._applyWeaponInertia(A, st, cfg);
  };

  /* =========================================================================
   * CROWD CONTROL: lenguaje corporal por tipo
   *
   * Cada control necesita leerse distinto a veinte unidades de distancia. La
   * simulación decide QUÉ impide cada estado; esto sólo decide cómo se ve.
   * ====================================================================== */
  Act.ccPose = function (entity, blend) {
    if (blend <= 0.001) return null;
    var p = { rootPitch: 0, rootRoll: 0, rootLift: 0, kneeBend: 0, armDrop: 0,
              headTilt: 0, sway: 0, frozen: false, weight: blend };

    if (!entity.alive) {
      // Muerte: caída controlada, nunca desaparecer de golpe.
      p.rootPitch = 1.48; p.rootLift = 0.22; p.armDrop = 1.0; p.kneeBend = 0.35;
      return p;
    }
    if (entity.hasStatus('stasis')) {
      // Estasis: pose congelada, no dejar de actualizar sin más.
      p.frozen = true; p.rootPitch = 0.05; p.armDrop = 0.15; p.headTilt = 0.10;
      return p;
    }
    if (entity.hasStatus('knockdown')) {
      // Derribo: pérdida de equilibrio, contacto con el suelo, permanencia.
      p.rootPitch = 1.42; p.rootLift = 0.22; p.armDrop = 0.85; p.kneeBend = 0.55;
      return p;
    }
    if (entity.hasStatus('stun')) {
      // Aturdimiento: sigue DE PIE. Piernas poco reactivas, torso inestable,
      // cabeza desorientada. Confundirlo con un derribo sería un fallo de
      // lectura que cuesta la pelea.
      p.rootPitch = 0.16; p.kneeBend = 0.30; p.armDrop = 0.55;
      p.headTilt = 0.32; p.sway = 1.0;
      return p;
    }
    if (entity.hasStatus('root')) {
      // Enraizar: pies bloqueados, cuerpo tenso intentando avanzar. El tren
      // superior sigue funcionando si las reglas lo permiten.
      p.kneeBend = 0.22; p.rootPitch = -0.10; p.sway = 0.25;
      return p;
    }
    if (entity.hasStatus('silence')) {
      // Mareo: NO impide moverse. La señal va en la cabeza y las manos.
      p.headTilt = 0.20; p.sway = 0.45; p.armDrop = 0.15;
      return p;
    }
    if (entity.hasStatus('disarm')) {
      p.armDrop = 0.75;   // el arma baja, inutilizada
      return p;
    }
    return null;
  };

  Arena.Render.Actions = Act;
});
