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
    ARCHER_SHOT: 'ranged',
    CAST: 'cast'
  };

  /** Qué familia usa cada arquetipo según sea ataque normal o poder. */
  Act.familyFor = function (archetype, isPower) {
    if (archetype === 'archer') return Act.FAMILY.ARCHER_SHOT;
    if (archetype === 'caster') return Act.FAMILY.CAST;
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
      // Reacción al daño: aditiva y direccional.
      react: { amount: 0, front: 0, side: 0 },
      // Ruido de respiración de las manos en reposo.
      idleNoise: (s < 0 ? -s : s) / 1000
    };
  };

  Act.trigger = function (st, family, cfg, isPower) {
    st.family = family;
    st.duration = (cfg.actionTime[family] || 0.42);
    st.t = 0;
    st.isPower = !!isPower;
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
  };

  /** Nombre legible del estado de acción, para el overlay de depuración. */
  Act.stateName = function (st) {
    if (!st || !st.family) return 'IDLE';
    var ph = st.t < 0.30 ? 'ANTICIPATION' : (st.t < 0.52 ? 'ACTIVE'
           : (st.t < 0.70 ? 'IMPACT' : 'RECOVERY'));
    return 'ACTION_' + st.family.toUpperCase() + (st.isPower ? '_POWER' : '') + ':' + ph;
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
      left:  { pitch: armSwing, yaw: 0, roll: 0.16, elbow: cfg.elbowBaseBend },
      right: { pitch: -armSwing, yaw: 0, roll: -0.16, elbow: cfg.elbowBaseBend },
      weaponPitch: 0.40, weaponRoll: 0,
      draw: 0, gemFlash: 0, bowPitch: 1.0, bowYaw: 0,
      chestPitch: 0, chestYaw: 0, chestRoll: 0,
      kneeAbsorb: 0, bowShake: 0
    };
  }

  var ARM_KEYS = ['pitch', 'yaw', 'roll', 'elbow'];
  var TOP_KEYS = ['weaponPitch', 'weaponRoll', 'draw', 'gemFlash', 'bowPitch',
                  'bowYaw', 'chestPitch', 'chestYaw', 'chestRoll',
                  'kneeAbsorb', 'bowShake'];

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
    Act._guard(A, cfg, archetype, loadout, st);

    // Casteo sostenido: tiene prioridad sobre la guardia, pero no sobre un
    // ataque en curso, porque la simulación no permite ambos a la vez.
    // `castProgress` ya entra y sale de forma continua, así que la propia curva
    // hace de mezcla.
    if (casting || castProgress > 0.02) {
      var C = blankPose(cfg, armSwing);
      Act._guard(C, cfg, archetype, loadout, st);
      Act._castPose(C, cfg, castProgress);
      blendPose(A, C, smooth(castProgress / 0.35));
      return Act._applyReaction(A, st, cfg);
    }

    if (st.family && st.weight > 0.001) {
      // La acción se calcula sobre una copia de la guardia y luego se mezcla:
      // así el arranque y el final de cada golpe son continuos por construcción.
      var B = blankPose(cfg, armSwing);
      Act._guard(B, cfg, archetype, loadout, st);
      var ph = cfg.phases[st.family] || cfg.phases.light;
      switch (st.family) {
        case Act.FAMILY.LIGHT_SWING: Act._lightSwing(B, st.t, ph); break;
        case Act.FAMILY.HEAVY_SWING: Act._heavySwing(B, st.t, ph); break;
        case Act.FAMILY.THRUST: Act._thrust(B, st.t, ph); break;
        case Act.FAMILY.ARCHER_SHOT: Act._archerShot(B, st.t, ph, st.isPower); break;
        case Act.FAMILY.CAST: Act._castRelease(B, st.t, ph); break;
      }
      blendPose(A, B, st.weight);
    }
    return Act._applyReaction(A, st, cfg);
  };

  /* --- Guardias de reposo --------------------------------------------------- */
  Act._guard = function (A, cfg, archetype, loadout, st) {
    var idle = Math.sin(st.idleNoise) * 0.02;   // micro-movimiento de manos
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
      A.right.pitch = 0.08 + idle;
      A.right.elbow = 0.34;
      A.right.roll = -0.26;   // el báculo se separa del cuerpo: si queda
                              // pegado a la túnica, la gema no se ve
      // El arma cancela la inclinación del antebrazo para quedar vertical.
      A.weaponPitch = -(0.08 + 0.34) + 0.06;
      A.left.pitch = -0.14;
      A.left.elbow = 0.42 + idle;
      A.chestPitch = 0.02;
    }
  };

  /* --- MELEE: tajo ligero ---------------------------------------------------
   * El pecho rota primero, el hombro sigue, después el codo y por último el
   * arma. Esa cadena es lo que hace que un golpe parezca un acto físico y no
   * una rotación de hueso.                                                    */
  Act._lightSwing = function (A, t, ph) {
    var ant = smooth(t / ph.active);
    var hit = smooth((t - ph.active) / (ph.recovery - ph.active));
    var rec = smooth((t - ph.recovery) / (ph.end - ph.recovery));

    A.chestYaw = 0.28 * ant - 0.42 * hit + 0.14 * rec;
    A.right.pitch = 1.05 * ant - 2.25 * hit + 0.60 * rec + 0.15;
    A.right.yaw = 0.60 * ant - 1.10 * hit + 0.50 * rec;
    A.right.roll = -0.28 - 0.50 * hit + 0.28 * rec;
    A.right.elbow = 1.45 * ant - 1.25 * hit + 0.45 * rec + 0.25;
    A.weaponPitch = 0.50 - 0.15 * hit;
    A.weaponRoll = -0.32 * hit;
    A.left.elbow = 0.55 + 0.25 * ant;
  };

  /* --- MELEE: golpe pesado --------------------------------------------------
   * La cadera participa mucho más, el arma sube, el cuerpo carga peso y al
   * caer las rodillas absorben. Recuperación más larga: eso es el peso.       */
  Act._heavySwing = function (A, t, ph) {
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
    A.kneeAbsorb = hit * (1 - rec) * 0.22;   // lo consume la capa de piernas
  };

  /* --- MELEE: estocada ------------------------------------------------------ */
  Act._thrust = function (A, t, ph) {
    var ant = smooth(t / ph.active);
    var hit = smooth((t - ph.active) / (ph.recovery - ph.active));
    var rec = smooth((t - ph.recovery) / (ph.end - ph.recovery));

    A.chestYaw = -0.22 * ant + 0.30 * hit;
    A.right.pitch = 0.70 * ant - 1.85 * hit + 0.85 * rec;
    A.right.elbow = 1.70 * ant - 1.60 * hit + 0.50 * rec + 0.25;
    A.weaponPitch = -0.10 - 0.35 * hit;
    A.left.pitch = -0.30 * ant;
  };

  /* --- ARQUERO: RAISE → NOCK → DRAW → AIM → RELEASE → FOLLOW_THROUGH --------
   * El brazo del arco permanece casi extendido; el codo de la cuerda retrocede
   * hasta la mejilla; el pecho rota; al soltar hay recoil y el arco vibra.    */
  Act._archerShot = function (A, t, ph, isPower) {
    var raise = smooth(t / 0.18);
    var nock = smooth((t - 0.12) / 0.16);
    var drawEnd = isPower ? 0.62 : ph.impact;
    var pull = smooth((t - 0.24) / (drawEnd - 0.24));
    var aim = smooth((t - drawEnd * 0.85) / Math.max(0.05, drawEnd * 0.15));
    var rel = smooth((t - drawEnd) / 0.10);
    var follow = smooth((t - drawEnd - 0.10) / Math.max(0.05, ph.end - drawEnd - 0.10));

    // Brazo del arco: sube y se queda casi recto apuntando al objetivo.
    A.left.pitch = -1.50 * raise;
    A.left.yaw = -0.16 * raise;
    A.left.elbow = 0.12 + 0.08 * raise;

    // Brazo de la cuerda: encaja la flecha, tira hasta la mejilla, suelta.
    A.right.pitch = -1.22 * raise - 0.10 * nock;
    A.right.yaw = (0.50 + (isPower ? 0.30 : 0)) * pull;
    A.right.elbow = 0.55 + (1.55 + (isPower ? 0.35 : 0)) * pull - 1.30 * rel;

    // El pecho rota con el tensado: sin torsión no hay potencia legible.
    A.chestYaw = (0.22 + (isPower ? 0.16 : 0)) * pull - 0.30 * rel;
    A.chestPitch = -0.06 * aim;

    A.draw = clamp(pull - rel, 0, 1);
    A.bowPitch = 1.42;
    // Recoil del brazo de cuerda y vibración del arco tras soltar.
    A.right.pitch += 0.45 * rel - 0.20 * follow;
    A.bowShake = Math.max(0, rel - follow) * 0.06;
  };

  /* --- MAGO: canalización ---------------------------------------------------
   * Pies afirmados, torso abierto, báculo en alto y mano libre recogiendo
   * energía. Postura estática y distinta de todo lo demás: telegrafía el cast. */
  Act._castPose = function (A, cfg, c) {
    var e = smooth(c);
    A.right.pitch = -0.30 - 1.90 * e;
    A.right.elbow = 0.30 + 0.55 * e;
    A.right.roll = -0.10;
    A.weaponPitch = -0.28 - 0.50 * e;
    A.left.pitch = -1.20 - 0.30 * e;
    A.left.elbow = 0.95 + 0.30 * e;
    A.left.roll = 0.20;
    // El pecho se expande al canalizar, como quien toma aire.
    A.chestPitch = -0.10 * e;
    A.chestYaw = 0.06 * Math.sin(c * 9.0) * e;
  };

  /* --- MAGO: liberación / estocada de báculo -------------------------------- */
  Act._castRelease = function (A, t, ph) {
    var jab = smooth((t - ph.active) / (ph.impact - ph.active));
    var back = smooth((t - ph.impact) / (ph.end - ph.impact));
    // El torso dirige, el brazo termina y el báculo acompaña.
    A.chestPitch = -0.14 * jab + 0.10 * back;
    A.right.pitch = 0.30 - 1.70 * jab + 1.15 * back;
    A.right.elbow = 0.95 - 0.80 * jab + 0.60 * back;
    A.weaponPitch = 0.28 - 1.05 * jab + 0.78 * back;
    A.left.pitch = -0.42 * jab + 0.30 * back;
    A.left.elbow = 0.60 + 0.35 * jab;
    A.gemFlash = Math.max(0, jab - back);
  };

  /* --- Reacción al daño: ADITIVA -------------------------------------------
   * Se suma encima de lo que esté ocurriendo. Un golpe sin CC sacude el torso
   * y compensa un brazo, pero no congela al personaje: convertir cada impacto
   * en una estatua es lo que hace que un combate se sienta a trompicones.     */
  Act._applyReaction = function (A, st, cfg) {
    var r = st.react.amount;
    if (r <= 0.001) return A;
    var k = r * r * cfg.hitReactAmount;    // decae rápido
    A.chestPitch += st.react.front * k * 1.4;
    A.chestRoll = (A.chestRoll || 0) + st.react.side * k * 1.1;
    A.chestYaw += -st.react.side * k * 0.6;
    A.left.pitch += st.react.front * k * 0.5;
    A.right.pitch += st.react.front * k * 0.5;
    return A;
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
