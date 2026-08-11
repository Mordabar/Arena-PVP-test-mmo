/* =============================================================================
 * render/characterVisual.js — Humanoide procedural, raza y animación.
 *
 * No hay modelos ni rigs: el personaje es una jerarquía de primitivas cuya pose
 * se calcula cada fotograma. Sustituible por mallas reales sin tocar una sola
 * regla de combate (documento §29, fase 7).
 *
 * TRES CAPAS DE IDENTIDAD, en este orden de lectura:
 *   1. BANDO      → anillo del suelo, luz de contorno y banda de tabardo
 *   2. ARQUETIPO  → silueta, atuendo y, sobre todo, CÓMO SE MUEVE
 *   3. RAZA       → proporciones, piel, pelo, orejas
 *
 * Convención de esqueleto: cada extremidad se genera COLGANDO desde su
 * articulación (pivote en y = 0, malla hacia −Y). Un ángulo de 0 es "brazo
 * caído" y el pitch gira el miembro desde el hombro o la cadera.
 *
 *   pitch = 0  → colgando · pitch > 0 → atrás (−Z) · pitch < 0 → adelante (+Z)
 *
 * ANIMACIÓN POR ARQUETIPO (lo que pidió el diseño):
 *   melee   ataque normal = tajo lateral rápido
 *           poder         = golpe descendente amplio, con anticipación
 *   archer  ataque normal = alza, tensa y suelta
 *           poder         = misma base, tensado más largo y cuerpo girado
 *   caster  ataque normal = golpe corto de báculo, la gema destella
 *           casteo        = báculo en alto y luz creciente entre las manos
 * ========================================================================== */
Arena.define('render/characterVisual',
  ['render/primitives', 'math/mat4', 'data/races'], function (Arena) {
  'use strict';

  var P = Arena.Render.primitives;
  var M = Arena.Math.Mat4;
  var V = Arena.Math.Vec3;

  var CV = {};

  var ARM_LEN = 0.66;
  var LEG_LEN = 0.88;

  /** Cápsula que cuelga: pivote arriba, cuerpo hacia −Y. */
  function hanging(radius, length, segs) {
    return P.translate(P.capsule(radius, length, segs || 10), 0, -length, 0);
  }

  /* =========================================================================
   * Mallas
   * ====================================================================== */
  CV.buildMeshes = function () {
    return {
      torso: P.translate(P.box(0.36, 0.50, 0.21), 0, 0.25, 0),
      chestPlate: P.translate(P.box(0.13, 0.46, 0.225), 0, 0.26, 0),   // tabardo vertical
      collar: P.translate(P.box(0.40, 0.09, 0.225), 0, 0.46, 0),
      hips: P.translate(P.box(0.31, 0.21, 0.20), 0, -0.10, 0),
      pauldron: P.sphere(0.102, 8, 12),
      neck: P.translate(P.cylinder(0.058, 0.09, 8, 1), 0, 0, 0),

      head: P.merge([
        P.translate(P.sphere(0.118, 10, 14), 0, 0.12, 0),
        P.translate(P.box(0.125, 0.075, 0.145), 0, 0.085, 0.070)   // mandíbula
      ]),
      // Oreja élfica: cono largo y plano. Es el rasgo que más identifica la raza
      // de perfil, así que se exagera respecto a una oreja real.
      ear: P.scale(P.cone(0.045, 1.0, 7), 0.55, 1, 1),
      eye: P.sphere(0.024, 6, 8),

      hairCap: P.merge([
        P.scale(P.sphere(0.125, 8, 12), 1.02, 0.85, 1.02),
        P.translate(P.scale(P.box(0.20, 0.10, 0.16), 1, 1, 1), 0, 0.04, -0.09)
      ]),
      hairSwept: P.translate(P.scale(P.box(0.19, 0.09, 0.26), 1, 1, 1), 0, 0.10, -0.14),

      arm: hanging(0.062, ARM_LEN, 10),
      forearmGuard: P.translate(P.cylinder(0.076, 0.22, 8, 0.92), 0, -ARM_LEN * 0.90, 0),
      hand: P.sphere(0.055, 6, 8),
      leg: hanging(0.092, LEG_LEN, 10),
      boot: P.translate(P.box(0.145, 0.12, 0.26), 0, -LEG_LEN + 0.02, 0.045),

      /* Túnica del lanzador: cono invertido que sustituye a las piernas.
         Es la silueta que separa a un mago de un guerrero a 20 unidades. */
      robe: P.translate(P.cylinder(0.34, 0.86, 14, 0.42), 0, -0.86, 0),
      robeTrim: P.translate(P.cylinder(0.345, 0.07, 14, 1), 0, -0.86, 0),
      hood: P.merge([
        P.scale(P.sphere(0.165, 9, 12), 1.0, 1.05, 1.0),
        P.translate(P.scale(P.cone(0.16, 0.30, 9), 1, 1, 1), 0, 0.06, -0.05)
      ]),

      /* Armas: pivote en la empuñadura, hoja hacia +Y */
      sword: P.merge([
        P.translate(P.box(0.110, 0.82, 0.042), 0, 0.52, 0),
        P.translate(P.box(0.075, 0.14, 0.050), 0, 0.94, 0),
        P.translate(P.box(0.28, 0.065, 0.085), 0, 0.10, 0),
        P.translate(P.box(0.072, 0.20, 0.072), 0, 0.00, 0)
      ]),
      shield: P.merge([
        P.box(0.46, 0.60, 0.060),
        P.translate(P.sphere(0.085, 8, 10), 0, 0, 0.048)
      ]),
      /* Arco: dos brazos curvados. El pivote queda en la empuñadura central. */
      bow: P.merge([
        P.translate(P.rotateY(P.cylinder(0.024, 0.52, 7, 0.35), 0), 0, 0.06, 0),
        P.translate(P.rotateY(P.scale(P.cylinder(0.024, 0.52, 7, 0.35), 1, -1, 1), Math.PI), 0, -0.06, 0),
        P.translate(P.box(0.042, 0.18, 0.052), 0, -0.09, 0.015)
      ]),
      bowString: P.translate(P.box(0.010, 1.06, 0.010), 0, 0, 0),
      arrow: P.merge([
        P.translate(P.rotateY(P.cylinder(0.014, 0.62, 5, 1), 0), 0, 0, 0),
        P.translate(P.cone(0.030, 0.09, 5), 0, 0.62, 0)
      ]),
      staff: P.merge([
        P.translate(P.cylinder(0.032, 1.45, 8, 0.88), 0, -0.55, 0),
        P.translate(P.scale(P.sphere(0.055, 7, 9), 1, 1.6, 1), 0, 0.92, 0)   // engarce
      ]),
      gem: P.sphere(0.085, 8, 10),
      orb: P.sphere(0.12, 8, 12),
      cape: P.translate(P.box(0.40, 0.70, 0.04), 0, -0.35, 0)
    };
  };

  /* =========================================================================
   * Arquetipo y atuendo por clase
   * ====================================================================== */
  var ARCHETYPE = {
    devastador: 'melee', guardian: 'melee',
    centinela: 'archer', rastreador: 'archer',
    arcanista: 'caster', vinculador: 'caster'
  };
  CV.archetypeOf = function (classId) { return ARCHETYPE[classId] || 'melee'; };

  var LOADOUT = {
    devastador: { right: 'sword', left: null, outfit: 'plate', scale: 1.10 },
    guardian:   { right: 'sword', left: 'shield', outfit: 'plate', scale: 0.92 },
    centinela:  { right: 'bow', left: null, outfit: 'leather', scale: 1.20 },
    rastreador: { right: 'bow', left: null, outfit: 'leather', scale: 1.00, cape: true },
    arcanista:  { right: 'staff', left: null, outfit: 'robe', scale: 1.00, hood: true },
    vinculador: { right: 'staff', left: 'orb', outfit: 'robe', scale: 0.95, hood: true }
  };

  /** Color de atuendo por arquetipo. La clase se reconoce por el tono; el
   *  bando, por el anillo, el contorno y el tabardo del pecho. */
  var OUTFIT = {
    plate:   { cloth: [0.17, 0.17, 0.21], metal: [0.52, 0.53, 0.58], trim: [0.86, 0.70, 0.30] },
    leather: { cloth: [0.26, 0.30, 0.19], metal: [0.38, 0.31, 0.22], trim: [0.68, 0.55, 0.30] },
    robe:    { cloth: [0.42, 0.055, 0.075], metal: [0.34, 0.28, 0.22], trim: [0.92, 0.76, 0.36] }
  };

  /* =========================================================================
   * Estado de animación
   * ====================================================================== */
  CV.createState = function () {
    return {
      phase: 0, speed: 0,
      attack: 0,               // 1 → 0 durante un ataque
      attackPower: false,      // ¿fue un poder o el ataque normal?
      attackKind: 'melee',
      cast: 0, casting: false,
      hurt: 0, downed: 0, deadTime: 0,
      breathe: Math.random() * 6.28,
      lean: 0,
      lastPos: null
    };
  };

  /** Duración de la animación de ataque por arquetipo, en segundos. */
  var ATTACK_TIME = { melee: 0.42, archer: 0.55, caster: 0.34 };

  CV.update = function (st, entity, dt, world) {
    if (!st.lastPos) st.lastPos = V.clone(entity.pos);

    var moved = V.distXZ(entity.pos, st.lastPos) / Math.max(dt, 1e-4);
    V.copy(st.lastPos, entity.pos);

    var targetSpeed = Math.min(1, moved / Math.max(entity.moveSpeedBase, 0.001));
    st.speed += (targetSpeed - st.speed) * Math.min(1, dt * 12);

    st.phase += dt * (1.7 + st.speed * 8.5);
    st.breathe += dt * 1.5;
    st.lean += (st.speed * 0.20 - st.lean) * Math.min(1, dt * 8);

    if (st.attack > 0) {
      var dur = ATTACK_TIME[st.attackKind] || 0.42;
      st.attack = Math.max(0, st.attack - dt / dur);
    }
    if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt * 3.5);

    var m = entity.mods();
    var isDown = !m.canMove && !m.canUseAbility;
    var target = (!entity.alive) ? 1 : (isDown ? 1 : 0);
    st.downed += (target - st.downed) * Math.min(1, dt * (target > st.downed ? 11 : 5.5));

    if (entity.cast) {
      st.casting = true;
      var c = entity.cast;
      st.cast = Math.min(1, (world.time - c.startTime) / Math.max(c.duration, 1e-3));
    } else {
      st.casting = false;
      st.cast += (0 - st.cast) * Math.min(1, dt * 9);
    }

    if (!entity.alive) st.deadTime += dt; else st.deadTime = 0;
  };

  /**
   * Dispara la animación de ataque.
   * @param kind 'melee' | 'archer' | 'caster'
   * @param isPower true si viene de una habilidad, false si es ataque normal
   */
  CV.triggerAttack = function (st, kind, isPower) {
    st.attack = 1;
    st.attackKind = kind || 'melee';
    st.attackPower = !!isPower;
  };
  CV.triggerHurt = function (st) { st.hurt = 1; };

  /* =========================================================================
   * Curvas de animación
   *
   * Toda animación de ataque tiene tres tiempos. Sin anticipación un golpe no
   * se lee; sin recuperación no pesa.
   * ====================================================================== */
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  /** Progreso 0→1 de la animación (st.attack va de 1 a 0). */
  function progress(st) { return 1 - st.attack; }

  /** Fase de anticipación: 0 en reposo, 1 al final del retroceso. */
  function anticipation(p, end) { return smooth(p / end); }

  /** Fase de acción: 0 antes de empezar, 1 al terminar el golpe. */
  function strike(p, start, end) { return smooth((p - start) / (end - start)); }

  /* =========================================================================
   * Pose
   * ====================================================================== */
  CV.buildPose = function (out, st, entity, pos, yaw, palette) {
    out.length = 0;

    var loadout = LOADOUT[entity.classId] || LOADOUT.devastador;
    var arche = CV.archetypeOf(entity.classId);
    var race = Arena.Data.getRace(entity.raceId);
    var build = race.build;
    var feat = race.features;

    var walk = Math.sin(st.phase) * st.speed;
    var walkB = -walk;
    var bob = Math.abs(Math.sin(st.phase * 2)) * 0.035 * st.speed;
    var breath = Math.sin(st.breathe) * 0.014 * (1 - st.speed);

    var downPitch = st.downed * 1.42;
    var downLift = st.downed * 0.22;

    var root = M.create();
    M.composeFull(root, { x: pos.x, y: pos.y + downLift, z: pos.z }, yaw, -downPitch, 0,
      { x: build.shoulders, y: build.height, z: build.shoulders });

    var skin = palette.skin, cloth = palette.cloth, metal = palette.metal;
    var accent = palette.accent, steel = palette.steel, hair = palette.hair;
    var trim = palette.trim, team = palette.team, eyeCol = palette.eye;

    function node(parent, x, y, z, pitch, yawL, roll, sx, sy, sz) {
      var local = M.create();
      M.composeFull(local, { x: x, y: y, z: z }, yawL || 0, pitch || 0, roll || 0,
        { x: sx === undefined ? 1 : sx, y: sy === undefined ? 1 : sy, z: sz === undefined ? 1 : sz });
      var world = M.create();
      M.multiply(world, parent, local);
      return world;
    }
    function draw(matrix, mesh, color, emissive) {
      out.push({ mesh: mesh, matrix: matrix, color: color || cloth, emissive: emissive || null });
    }

    var hipY = 0.94 + bob + breath;
    var chestPitch = -st.lean;

    /* --- Tronco ---------------------------------------------------------- */
    var pelvis = node(root, 0, hipY, 0, 0, 0, 0);
    var chest = node(root, 0, hipY, 0, chestPitch, 0, 0);
    draw(chest, 'torso', cloth);
    // Tabardo del pecho: la única pieza que lleva el color de bando puro.
    draw(chest, 'chestPlate', [team[0] * 0.70, team[1] * 0.70, team[2] * 0.70]);
    draw(chest, 'collar', metal);
    draw(node(chest, -0.235, 0.47, 0, 0, 0, -0.22), 'pauldron', metal);
    draw(node(chest, 0.235, 0.47, 0, 0, 0, 0.22), 'pauldron', metal);

    /* --- Cabeza, orejas, ojos y pelo -------------------------------------- */
    var hs = build.head;
    draw(node(chest, 0, 0.50, 0, 0, 0, 0, 1, build.neck, 1), 'neck', skin);
    var headM = node(chest, 0, 0.58, 0.01, -chestPitch * 0.4,
      Math.sin(st.breathe * 0.6) * 0.06, 0, hs, hs, hs);
    draw(headM, 'head', skin);

    if (!loadout.hood) {
      draw(node(headM, 0, 0.13, -0.01, 0, 0, 0), 'hairCap', hair);
      if (feat.hairStyle === 'swept') draw(node(headM, 0, 0.13, 0, 0.25, 0, 0), 'hairSwept', hair);
    }

    // Orejas: largas, inclinadas atrás y arriba. El rasgo racial dominante.
    var el = feat.earLength;
    draw(node(headM, -0.108, 0.11, -0.01, feat.earPitch, -0.55, -feat.earFlare, el, el, el),
      'ear', skin);
    draw(node(headM, 0.108, 0.11, -0.01, feat.earPitch, 0.55, feat.earFlare, el, el, el),
      'ear', skin);

    // Ojos luminosos: se ven incluso bajo la capucha, y eso es intencional.
    var eyeEm = feat.glowingEyes
      ? [eyeCol[0] * race.palette.eyeGlow, eyeCol[1] * race.palette.eyeGlow, eyeCol[2] * race.palette.eyeGlow]
      : null;
    draw(node(headM, -0.050, 0.125, 0.095, 0, 0, 0), 'eye', eyeCol, eyeEm);
    draw(node(headM, 0.050, 0.125, 0.095, 0, 0, 0), 'eye', eyeCol, eyeEm);

    if (loadout.hood) draw(node(headM, 0, 0.10, -0.02, 0.10, 0, 0), 'hood', cloth);

    /* --- Piernas o túnica -------------------------------------------------- */
    if (loadout.outfit === 'robe') {
      // La túnica hace de silueta: no se dibujan piernas, sólo un vaivén suave.
      var swayR = Math.sin(st.phase) * 0.10 * st.speed;
      draw(node(pelvis, 0, 0.06, 0, swayR, 0, 0), 'robe', cloth);
      draw(node(pelvis, 0, 0.06, 0, swayR, 0, 0), 'robeTrim', trim);
    } else {
      var lb = build.limbs;
      var legL = node(pelvis, -0.105, -0.08, 0, walk * 0.80, 0, 0, 1, lb, 1);
      var legR = node(pelvis, 0.105, -0.08, 0, walkB * 0.80, 0, 0, 1, lb, 1);
      draw(pelvis, 'hips', cloth);
      draw(legL, 'leg', cloth);
      draw(legR, 'leg', cloth);
      draw(node(legL, 0, 0, 0, -walk * 0.35, 0, 0), 'boot', steel);
      draw(node(legR, 0, 0, 0, -walkB * 0.35, 0, 0), 'boot', steel);
    }

    if (loadout.cape) {
      draw(node(chest, 0, 0.46, -0.13, 0.12 + st.speed * 0.35, 0, 0), 'cape', trim);
    }

    /* =====================================================================
     * Brazos: aquí vive la identidad de arquetipo
     * ================================================================== */
    var A = CV._armPose(st, arche, loadout, walk, walkB);

    var shoulderY = 0.45;
    var armL = node(chest, -0.245, shoulderY, 0, A.leftPitch, A.leftYaw, A.leftRoll);
    var armR = node(chest, 0.245, shoulderY, 0, A.rightPitch, A.rightYaw, A.rightRoll);
    draw(armL, 'arm', skin);
    draw(armR, 'arm', skin);
    if (loadout.outfit !== 'robe') {
      draw(armL, 'forearmGuard', steel);
      draw(armR, 'forearmGuard', steel);
    }
    draw(node(armL, 0, -ARM_LEN, 0), 'hand', skin);
    draw(node(armR, 0, -ARM_LEN, 0), 'hand', skin);

    /* --- Armas en la mano -------------------------------------------------- */
    var s = loadout.scale;
    var handR = node(armR, 0, -ARM_LEN, 0.02, 0, 0, 0);
    var handL = node(armL, 0, -ARM_LEN, 0.02, 0, 0, 0);

    if (loadout.right === 'sword') {
      draw(node(handR, 0, 0, 0, A.weaponPitch, 0, A.weaponRoll, s, s, s), 'sword', steel);

    } else if (loadout.right === 'bow') {
      // El arco lo sostiene la mano IZQUIERDA y la derecha tensa la cuerda:
      // al revés no se lee como disparar.
      var bowM = node(handL, 0, 0, 0.05, A.bowPitch, A.bowYaw, 0, s, s, s);
      draw(bowM, 'bow', steel);
      // La cuerda se estira hacia atrás con el tensado.
      draw(node(bowM, 0, 0, -0.02 - A.draw * 0.26, 0, 0, 0, 1, 1, 1), 'bowString', [0.85, 0.85, 0.80]);
      if (A.draw > 0.05) {
        draw(node(bowM, 0, 0, -0.30 - A.draw * 0.20, Math.PI / 2, 0, 0, 1, 1, 1),
          'arrow', [0.62, 0.50, 0.34]);
      }

    } else if (loadout.right === 'staff') {
      var staffM = node(handR, 0, 0, 0.02, A.weaponPitch, 0, A.weaponRoll, s, s, s);
      draw(staffM, 'staff', [0.30, 0.24, 0.20]);
      // La gema es el indicador de estado del lanzador: apagada en reposo,
      // encendida al castear, destello al golpear.
      var glow = 0.5 + st.cast * 2.6 + A.gemFlash * 2.2;
      draw(node(staffM, 0, 0.98, 0, 0, 0, 0, 1, 1, 1), 'gem', accent,
        [accent[0] * glow, accent[1] * glow, accent[2] * glow]);
    }

    if (loadout.left === 'shield') {
      draw(node(handL, 0, 0.10, 0.10, -1.35, 0, -0.10), 'shield',
        [team[0] * 0.55, team[1] * 0.55, team[2] * 0.55]);
    } else if (loadout.left === 'orb') {
      var og = 0.6 + st.cast * 2.2;
      draw(node(handL, 0, 0, 0.06, 0, 0, 0, 0.9, 0.9, 0.9), 'orb', accent,
        [accent[0] * og, accent[1] * og, accent[2] * og]);
    }

    /* --- Luz de casteo entre las manos ------------------------------------ */
    if (st.cast > 0.04) {
      var g = 0.55 + st.cast * 0.85;
      draw(node(chest, 0, 0.28, 0.42, 0, 0, 0, g, g, g), 'orb', accent,
        [accent[0] * (1.6 + st.cast * 4), accent[1] * (1.6 + st.cast * 4), accent[2] * (1.6 + st.cast * 4)]);
    }

    return out;
  };

  /* =========================================================================
   * Pose de brazos por arquetipo
   *
   * Esta función es el corazón de la identidad de movimiento. Devuelve los
   * ángulos de ambos brazos, del arma, y dos señales extra: cuánto está tensado
   * el arco y cuánto destella la gema del báculo.
   * ====================================================================== */
  CV._armPose = function (st, arche, loadout, walk, walkB) {
    var A = {
      leftPitch: walk * 0.75, rightPitch: walkB * 0.75,
      leftYaw: 0, rightYaw: 0,
      leftRoll: 0.19, rightRoll: -0.19,
      weaponPitch: 0.42, weaponRoll: 0,
      draw: 0, gemFlash: 0
    };

    var attacking = st.attack > 0.001;
    var p = progress(st);
    var power = st.attackPower;

    if (arche === 'melee') {
      if (attacking) {
        // Anticipación: el arma sube y va atrás. Golpe: baja cruzando al frente.
        var antEnd = power ? 0.42 : 0.30;
        var ant = anticipation(p, antEnd);
        var hit = strike(p, antEnd, power ? 0.62 : 0.55);

        if (power) {
          // Golpe descendente amplio: brazo muy alto, caída vertical y pesada.
          A.rightPitch = 2.45 * ant - 3.10 * hit + 0.65;
          A.rightRoll = -0.10 - 0.25 * ant + 0.15 * hit;
          A.weaponPitch = 0.10 - 0.35 * hit;
          A.leftPitch = -0.55 * ant - 0.30 * hit;   // la izquierda acompaña
          A.leftRoll = 0.05;
        } else {
          // Tajo lateral rápido: sale de la cadera y cruza al frente.
          A.rightPitch = 1.15 * ant - 2.35 * hit + 0.20;
          A.rightYaw = 0.55 * ant - 1.05 * hit;
          A.rightRoll = -0.30 - 0.55 * hit;
          A.weaponPitch = 0.55;
          A.weaponRoll = -0.35 * hit;
          A.leftPitch = walkB * 0.4;
        }
      } else {
        // Reposo: espada apoyada, guardia baja pero atenta.
        A.weaponPitch = 0.42;
        A.rightRoll = -0.24;
      }

    } else if (arche === 'archer') {
      if (attacking) {
        // Alzar → tensar → soltar. El poder tensa más tiempo y gira el torso.
        var raiseEnd = 0.22;
        var drawEnd = power ? 0.68 : 0.55;
        var raise = anticipation(p, raiseEnd);
        var pull = strike(p, raiseEnd, drawEnd);
        var release = strike(p, drawEnd, Math.min(1, drawEnd + 0.14));

        A.leftPitch = -1.52 * raise;            // brazo del arco al frente
        A.leftYaw = -0.18 * raise;
        A.leftRoll = 0.0;
        // Brazo de la cuerda: se retrae hasta la mejilla y suelta de golpe.
        A.rightPitch = -1.30 * raise - 0.20 * pull;
        A.rightYaw = (0.55 + 0.35 * (power ? 1 : 0)) * pull;
        A.rightRoll = -0.10;
        A.draw = Math.max(0, pull - release);
        A.bowPitch = 1.42;
        A.bowYaw = 0;
        if (release > 0.4) A.rightPitch += 0.55 * release;   // retroceso
      } else {
        // Reposo: arco bajo, en diagonal sobre el cuerpo.
        A.leftPitch = -0.30;
        A.leftRoll = 0.12;
        A.rightPitch = walkB * 0.6;
        A.bowPitch = 0.95;
        A.bowYaw = 0.35;
        A.draw = 0;
      }

    } else { // caster
      if (st.casting || st.cast > 0.05) {
        // CASTEO: báculo en alto y la mano libre recogiendo energía al frente.
        // Postura estática y muy distinta de todo lo demás: telegrafía el cast.
        var c = st.cast;
        A.rightPitch = -0.35 - 1.85 * smooth(c);
        A.rightRoll = -0.12;
        A.weaponPitch = -0.30 - 0.55 * smooth(c);
        A.leftPitch = -1.25 - 0.35 * smooth(c);
        A.leftRoll = 0.22;
        A.gemFlash = 0;
      } else if (attacking) {
        // ATAQUE NORMAL: estocada corta de báculo al frente. Rápido y seco.
        var jab = strike(p, 0.18, 0.45);
        var back = strike(p, 0.45, 1.0);
        A.rightPitch = 0.35 - 1.75 * jab + 1.20 * back;
        A.rightRoll = -0.15;
        A.weaponPitch = 0.30 - 1.10 * jab + 0.80 * back;
        A.leftPitch = -0.45 * jab;
        A.gemFlash = Math.max(0, jab - back);
      } else {
        // Reposo: báculo vertical, apoyado.
        A.rightPitch = 0.12;
        A.rightRoll = -0.16;
        A.weaponPitch = 0.30;
        A.leftPitch = walk * 0.55;
      }
    }

    if (A.bowPitch === undefined) A.bowPitch = 1.0;
    if (A.bowYaw === undefined) A.bowYaw = 0;
    return A;
  };

  /* =========================================================================
   * Paleta: raza + arquetipo + bando
   * ====================================================================== */
  CV.paletteFor = function (entity, isFriendly) {
    var race = Arena.Data.getRace(entity.raceId);
    var loadout = LOADOUT[entity.classId] || LOADOUT.devastador;
    var outfit = OUTFIT[loadout.outfit] || OUTFIT.plate;
    var teamTint = isFriendly ? [0.18, 0.48, 1.00] : [1.00, 0.20, 0.14];

    function mix(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }

    return {
      skin: entity.skinTone || race.palette.skin,
      hair: entity.hairColor || race.palette.hair,
      eye: race.palette.eye,
      // El atuendo conserva su color de clase casi puro. Con un 30 % de tinte
      // de bando la túnica roja del mago salía rosa y la placa del guerrero
      // azul: el color de clase desaparecía. El bando se lee por el tabardo
      // del pecho, el anillo del suelo y la luz de contorno, que ya bastan.
      cloth: mix(outfit.cloth, teamTint, 0.10),
      metal: mix(outfit.metal, teamTint, 0.12),
      steel: outfit.metal,
      trim: outfit.trim,
      accent: mix(race.palette.eye, [1, 1, 1], 0.25),
      team: teamTint
    };
  };

  Arena.Render.CharacterVisual = CV;
});
