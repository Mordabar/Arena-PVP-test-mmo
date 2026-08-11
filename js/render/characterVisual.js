/* =============================================================================
 * render/characterVisual.js — Humanoide procedural, raza, locomoción y combate.
 *
 * ESQUELETO REAL, no palos rígidos. Cada extremidad tiene dos segmentos y una
 * articulación intermedia:
 *
 *   hombro → [brazo] → codo → [antebrazo] → muñeca → mano
 *   cadera → [muslo] → rodilla → [espinilla] → tobillo → pie
 *
 * Sin codo ni rodilla, un personaje corriendo parece un compás abriéndose: el
 * doblez es lo que convierte un balanceo en una zancada.
 *
 * Convención: cada hueso cuelga desde su pivote (malla hacia −Y).
 *   pitch = 0 → colgando · pitch > 0 → atrás (−Z) · pitch < 0 → adelante (+Z)
 *
 * LOCOMOCIÓN DIRECCIONAL. La simulación sólo dice dónde está el personaje; aquí
 * se deduce hacia dónde se mueve RESPECTO A SU PROPIO FRENTE y se elige el
 * ciclo. Correr de espaldas con la animación de correr de frente es uno de los
 * fallos que más delata a un prototipo:
 *
 *   adelante   zancada amplia, torso inclinado, brazos contrarios
 *   atrás      pasos cortos y altos, torso erguido y echado atrás
 *   lateral    piernas que cruzan y se abren, cadera girada
 *   girar      pivote de pies sin desplazamiento
 *   parado     respiración, peso alternando y micro-balanceo
 *
 * COMBATE POR ARQUETIPO
 *   melee   normal = tajo lateral · poder = golpe descendente amplio
 *   archer  alza, tensa, suelta · el poder tensa más y gira el torso
 *   caster  normal = estocada de báculo · casteo = báculo en alto y luz
 * ========================================================================== */
Arena.define('render/characterVisual',
  ['render/primitives', 'math/mat4', 'data/races',
   'render/anim/skeleton', 'render/anim/locomotion'], function (Arena) {
  'use strict';

  var P = Arena.Render.primitives;
  var M = Arena.Math.Mat4;
  var V = Arena.Math.Vec3;
  var SK = Arena.Render.Skeleton;
  var Loco = Arena.Render.Locomotion;

  var CV = {};

  /* Longitudes de hueso, sobre una altura total de ~1.85 */
  var UPPER_ARM = 0.30, LOWER_ARM = 0.29;
  var THIGH = 0.45, SHIN = 0.43;

  /** Hueso que cuelga: pivote arriba, malla hacia −Y, ligeramente cónico. */
  function bone(rTop, rBot, len, segs) {
    return P.scale(P.cylinder(rTop, len, segs || 9, rBot / rTop), 1, -1, 1);
  }
  function joint(r) { return P.sphere(r, 7, 9); }

  /* =========================================================================
   * Mallas
   * ====================================================================== */
  CV.buildMeshes = function () {
    return {
      /* --- Tronco en tres piezas: da cintura y permite torsión ----------- */
      ribcage: P.merge([
        P.translate(P.scale(P.sphere(0.5, 8, 12), 0.40, 0.32, 0.25), 0, 0.16, 0),
        P.translate(P.box(0.34, 0.24, 0.21), 0, 0.14, 0)
      ]),
      abdomen: P.translate(P.scale(P.sphere(0.5, 7, 10), 0.29, 0.24, 0.21), 0, 0.02, 0),
      pelvis: P.translate(P.scale(P.sphere(0.5, 7, 10), 0.35, 0.22, 0.25), 0, -0.02, 0),

      /* --- Cabeza con volumen: cráneo, mandíbula, ceja, nariz ------------ */
      skull: P.scale(P.sphere(0.5, 10, 14), 0.225, 0.255, 0.245),
      jaw: P.translate(P.scale(P.box(0.175, 0.105, 0.185), 1, 1, 1), 0, -0.075, 0.022),
      brow: P.translate(P.box(0.195, 0.042, 0.048), 0, 0.048, 0.100),
      nose: P.translate(P.scale(P.cone(0.028, 0.070, 5), 1, 1, 1.5), 0, -0.050, 0.100),
      neck: bone(0.056, 0.064, 0.11, 8),
      ear: P.scale(P.cone(0.042, 1.0, 7), 0.42, 1, 1),
      eye: P.scale(P.sphere(0.5, 6, 8), 0.050, 0.032, 0.028),

      hairCap: P.merge([
        P.scale(P.sphere(0.5, 9, 13), 0.240, 0.230, 0.260),
        P.translate(P.scale(P.box(0.19, 0.10, 0.19), 1, 1, 1), 0, 0.015, -0.072)
      ]),
      hairTail: P.translate(P.scale(P.cone(0.070, 0.32, 7), 1, -1, 1), 0, 0.05, -0.155),

      /* --- Extremidades: dos segmentos + articulación -------------------- */
      upperArm: bone(0.064, 0.050, UPPER_ARM, 9),
      lowerArm: bone(0.050, 0.042, LOWER_ARM, 8),
      elbow: joint(0.053),
      shoulderBall: joint(0.075),
      hand: P.merge([
        P.translate(P.scale(P.sphere(0.5, 6, 8), 0.068, 0.088, 0.046), 0, -0.044, 0),
        P.translate(P.box(0.028, 0.066, 0.040), 0.046, -0.052, 0)     // pulgar
      ]),

      thigh: bone(0.096, 0.074, THIGH, 9),
      shin: bone(0.074, 0.054, SHIN, 9),
      knee: joint(0.076),
      foot: P.merge([
        P.translate(P.box(0.122, 0.072, 0.19), 0, -0.034, 0.042),
        P.translate(P.scale(P.sphere(0.5, 6, 8), 0.122, 0.072, 0.10), 0, -0.034, 0.137)
      ]),

      /* --- Atuendo -------------------------------------------------------- */
      pauldron: P.scale(P.sphere(0.5, 8, 11), 0.225, 0.165, 0.215),
      tabard: P.translate(P.box(0.150, 0.42, 0.225), 0, 0.02, 0),
      collar: P.translate(P.box(0.33, 0.072, 0.225), 0, 0.30, 0),
      bracer: P.translate(P.cylinder(0.060, 0.15, 8, 1), 0, -LOWER_ARM * 0.85, 0),
      robe: P.translate(P.cylinder(0.36, 0.92, 16, 0.38), 0, -0.92, 0),
      robeTrim: P.translate(P.cylinder(0.365, 0.062, 16, 1), 0, -0.92, 0),
      hood: P.merge([
        P.scale(P.sphere(0.5, 10, 13), 0.335, 0.355, 0.335),
        P.translate(P.scale(P.cone(0.150, 0.32, 9), 1, 1, 1), 0, 0.03, -0.055)
      ]),
      cape: P.translate(P.scale(P.box(0.42, 0.76, 0.035), 1, 1, 1), 0, -0.38, 0),

      /* --- Armas ---------------------------------------------------------- */
      sword: P.merge([
        P.translate(P.box(0.102, 0.76, 0.038), 0, 0.49, 0),
        P.translate(P.scale(P.cone(0.052, 0.155, 5), 1, 1, 0.5), 0, 0.87, 0),
        P.translate(P.box(0.25, 0.058, 0.078), 0, 0.10, 0),
        P.translate(P.box(0.066, 0.185, 0.066), 0, 0.00, 0),
        P.translate(P.sphere(0.046, 6, 8), 0, -0.088, 0)
      ]),
      shield: P.merge([
        P.scale(P.sphere(0.5, 8, 11), 0.45, 0.58, 0.13),
        P.translate(P.sphere(0.072, 7, 9), 0, 0, 0.060)
      ]),
      bow: P.merge([
        P.translate(P.cylinder(0.022, 0.50, 7, 0.30), 0, 0.07, 0),
        P.translate(P.scale(P.cylinder(0.022, 0.50, 7, 0.30), 1, -1, 1), 0, -0.07, 0),
        P.translate(P.box(0.038, 0.20, 0.052), 0, -0.10, 0.010)
      ]),
      bowString: P.box(0.009, 1.02, 0.009),
      arrow: P.merge([
        P.cylinder(0.013, 0.60, 5, 1),
        P.translate(P.cone(0.027, 0.082, 5), 0, 0.60, 0)
      ]),
      staff: P.merge([
        P.translate(P.cylinder(0.029, 1.40, 8, 0.85), 0, -0.53, 0),
        P.translate(P.scale(P.sphere(0.5, 7, 9), 0.105, 0.165, 0.105), 0, 0.88, 0)
      ]),
      gem: P.sphere(0.078, 8, 10),
      orb: P.sphere(0.112, 8, 12)
    };
  };

  /* =========================================================================
   * Arquetipo y atuendo
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
    centinela:  { right: 'bow', left: null, outfit: 'leather', scale: 1.18 },
    rastreador: { right: 'bow', left: null, outfit: 'leather', scale: 1.00, cape: true },
    arcanista:  { right: 'staff', left: null, outfit: 'robe', scale: 1.00, hood: true },
    vinculador: { right: 'staff', left: 'orb', outfit: 'robe', scale: 0.95, hood: true }
  };

  var OUTFIT = {
    plate:   { cloth: [0.155, 0.155, 0.19], metal: [0.50, 0.51, 0.56], trim: [0.86, 0.70, 0.30] },
    leather: { cloth: [0.235, 0.265, 0.165], metal: [0.36, 0.29, 0.20], trim: [0.66, 0.53, 0.28] },
    robe:    { cloth: [0.40, 0.050, 0.070], metal: [0.32, 0.26, 0.20], trim: [0.90, 0.74, 0.34] }
  };

  /* =========================================================================
   * Estado de animación
   * ====================================================================== */
  CV.createState = function () {
    return {
      // El controlador de locomoción se crea perezosamente en el primer update,
      // cuando ya se conoce la clase y por tanto su configuración.
      loco: null, cfg: null,
      attack: 0, attackPower: false, attackKind: 'melee',
      cast: 0, casting: false,
      hurt: 0, downed: 0, deadTime: 0,
      // Compatibilidad de lectura para VFX, HUD y depuración.
      speed: 0, phase: 0
    };
  };

  var ATTACK_TIME = { melee: 0.42, archer: 0.55, caster: 0.34 };

  CV.update = function (st, entity, dt, world) {
    // El controlador de locomoción se crea al conocer la clase, no antes.
    if (!st.loco) {
      st.cfg = Arena.Data.animConfigFor(entity.classId, CV.archetypeOf(entity.classId));
      st.loco = Loco.createState(st.cfg);
    }

    // Toda la locomoción vive en render/anim/locomotion.js: estados, ciclo de
    // paso por fases de contacto, foot locking y centro de masa.
    Loco.update(st.loco, entity, dt);

    // Seguimiento visual del objetivo. NO gira al personaje ni le pega al
    // enemigo: sólo mueve cabeza y parte del pecho, que es lo que separa un
    // MMO táctico de un lock-on de acción.
    var tgt = entity.targetId && world.getEntity ? world.getEntity(entity.targetId) : null;
    Loco.trackTarget(st.loco, entity, (tgt && tgt.alive) ? tgt.pos : null, dt);

    // Espejos de lectura para VFX, HUD y depuración.
    st.speed = st.loco.moveSpeed;
    st.phase = st.loco.cycle * Math.PI * 2;

    if (st.attack > 0) st.attack = Math.max(0, st.attack - dt / (ATTACK_TIME[st.attackKind] || 0.42));
    if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt * 3.5);

    var m = entity.mods();
    var isDown = !m.canMove && !m.canUseAbility;
    var target = (!entity.alive) ? 1 : (isDown ? 1 : 0);
    st.downed += (target - st.downed) * Math.min(1, dt * (target > st.downed ? 11 : 5.5));

    if (entity.cast) {
      st.casting = true;
      var cc = entity.cast;
      st.cast = Math.min(1, (world.time - cc.startTime) / Math.max(cc.duration, 1e-3));
    } else {
      st.casting = false;
      st.cast += (0 - st.cast) * Math.min(1, dt * 9);
    }
    if (!entity.alive) st.deadTime += dt; else st.deadTime = 0;
  };

  CV.triggerAttack = function (st, kind, isPower) {
    st.attack = 1; st.attackKind = kind || 'melee'; st.attackPower = !!isPower;
  };
  CV.triggerHurt = function (st) { st.hurt = 1; };

  /* --- Curvas ------------------------------------------------------------- */
  function smooth(x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }
  function strike(p, a, b) { return smooth((p - a) / (b - a)); }

  /* =========================================================================
   * Pose
   * ====================================================================== */
  CV.buildPose = function (out, st, entity, pos, yaw, palette) {
    out.length = 0;

    var loadout = LOADOUT[entity.classId] || LOADOUT.devastador;
    var arche = CV.archetypeOf(entity.classId);
    var race = Arena.Data.getRace(entity.raceId);
    var build = race.build, feat = race.features;

    var lc = st.loco;
    var cfg = st.cfg;
    // Adaptador: el resto de buildPose sigue leyendo un objeto `L`, así que la
    // salida del controlador se traduce una sola vez aquí.
    var L = {
      lean: lc.leanF, sideLean: lc.leanR,
      torsoTwist: lc.torsoYaw, hipRoll: lc.hipRoll,
      bob: lc.hipHeight,
      armSwing: Math.sin(lc.cycle * Math.PI * 2) * (cfg.armSwing + cfg.armSwingRun * lc.moveSpeed)
                * lc.moveSpeed * Math.max(0.25, lc.moveForward)
    };
    var breath = Math.sin(lc.breathe) * cfg.breathAmount * (1 - lc.moveSpeed);

    var root = M.create();
    M.composeFull(root,
      { x: pos.x, y: pos.y + st.downed * 0.22, z: pos.z },
      yaw, -st.downed * 1.42, 0,
      { x: build.shoulders, y: build.height, z: build.shoulders });

    var skin = palette.skin, cloth = palette.cloth, metal = palette.metal;
    var accent = palette.accent, steel = palette.steel, hair = palette.hair;
    var trim = palette.trim, team = palette.team, eyeCol = palette.eye;

    function node(parent, x, y, z, pitch, yawL, roll, sx, sy, sz) {
      var local = M.create();
      M.composeFull(local, { x: x, y: y, z: z }, yawL || 0, pitch || 0, roll || 0,
        { x: sx === undefined ? 1 : sx, y: sy === undefined ? 1 : sy, z: sz === undefined ? 1 : sz });
      var w = M.create();
      M.multiply(w, parent, local);
      return w;
    }
    function draw(m, mesh, color, emissive) {
      out.push({ mesh: mesh, matrix: m, color: color || cloth, emissive: emissive || null });
    }

    // Centro de masa: la pelvis se desplaza hacia la pierna que soporta el peso
    // y cae en el apoyo. Sin esto el personaje flota sobre sus piernas.
    var hipY = 0.96 + L.bob + breath;
    var hipX = lc.hipShiftX;

    /* --- Cadera y tronco articulado -------------------------------------- */
    var hips = node(root, hipX, hipY, 0, 0, lc.hipYaw, L.hipRoll);
    draw(hips, 'pelvis', cloth);

    var abdomen = node(hips, 0, 0.06, 0, -lc.torsoPitch * 0.45, lc.torsoYaw * 0.3, lc.torsoRoll * 0.4);
    draw(abdomen, 'abdomen', cloth);

    // El pecho asume parte del seguimiento del objetivo; la cabeza completa el resto.
    var chest = node(abdomen, 0, 0.14, 0, -lc.torsoPitch * 0.55,
      lc.torsoYaw * 0.5 + lc.headYaw * cfg.chestTrackRatio, lc.torsoRoll * 0.6);
    draw(chest, 'ribcage', cloth);
    if (loadout.outfit !== 'robe') draw(chest, 'collar', metal);
    draw(chest, 'tabard', [team[0] * 0.70, team[1] * 0.70, team[2] * 0.70]);

    /* --- Cabeza ----------------------------------------------------------- */
    var hs = build.head;
    draw(node(chest, 0, 0.30, 0, L.lean * 0.3, 0, 0, 1, build.neck, 1), 'neck', skin);
    // La cabeza contrarresta la inclinación del torso: la mirada se mantiene al
    // frente aunque el cuerpo se incline, como en cualquier ser vivo.
    var head = node(chest, 0, 0.40, 0.005,
      lc.torsoPitch * cfg.torsoCounterRate + lc.headPitch,
      lc.headYaw * (1 - cfg.chestTrackRatio) - lc.torsoYaw * 0.4,
      -lc.torsoRoll * 0.3, hs, hs, hs);
    draw(head, 'skull', skin);
    draw(head, 'jaw', skin);
    draw(head, 'brow', skin);
    draw(head, 'nose', skin);

    if (!loadout.hood) {
      draw(node(head, 0, 0.012, -0.005), 'hairCap', hair);
      draw(node(head, 0, 0.02, 0, 0.20, 0, 0), 'hairTail', hair);
    }

    var el = feat.earLength;
    draw(node(head, -0.100, 0.005, -0.02, feat.earPitch, -0.60, -feat.earFlare, el, el, el), 'ear', skin);
    draw(node(head, 0.100, 0.005, -0.02, feat.earPitch, 0.60, feat.earFlare, el, el, el), 'ear', skin);

    var eg = race.palette.eyeGlow;
    var eyeEm = feat.glowingEyes ? [eyeCol[0] * eg, eyeCol[1] * eg, eyeCol[2] * eg] : null;
    draw(node(head, -0.050, 0.012, 0.110), 'eye', eyeCol, eyeEm);
    draw(node(head, 0.050, 0.012, 0.110), 'eye', eyeCol, eyeEm);

    if (loadout.hood) draw(node(head, 0, -0.01, -0.02, 0.10, 0, 0), 'hood', cloth);

    /* --- Piernas con rodilla y tobillo ------------------------------------ */
    if (loadout.outfit === 'robe') {
      var swayR = lc.leanF * 0.3 + Math.sin(lc.cycle * Math.PI * 2) * 0.09 * lc.moveSpeed;
      var robeM = node(hips, 0, 0.06, 0, swayR, 0, lc.torsoRoll * 0.5);
      draw(robeM, 'robe', cloth);
      draw(robeM, 'robeTrim', trim);
    } else {
      /* PIERNAS POR CINEMÁTICA INVERSA.
       *
       * El controlador ya decidió DÓNDE está cada pie en el mundo, y mientras
       * está apoyado ese punto no se mueve (foot locking). Aquí sólo se resuelve
       * qué ángulos de cadera y rodilla hacen falta para alcanzarlo. Es
       * exactamente el orden inverso al de antes —donde se elegían ángulos y el
       * pie caía donde cayera— y es la razón por la que ya no patina.
       */
      var lb = build.limbs;
      var thighLen = THIGH * lb, shinLen = SHIN * lb;
      var cosY = Math.cos(-yaw), sinY = Math.sin(-yaw);

      for (var i = 0; i < 2; i++) {
        var leg = lc.legs[i];
        var side = (i === 0) ? -1 : 1;
        var hipLocalX = side * cfg.stanceWidth + hipX * 0.5;

        // Pie de espacio mundo a espacio local del personaje.
        var wx = leg.footPos.x - pos.x;
        var wz = leg.footPos.z - pos.z;
        var lx = wx * cosY + wz * sinY;
        var lz = -wx * sinY + wz * cosY;

        var hipOrigin = { x: hipLocalX, y: hipY - 0.04, z: 0 };
        var footTarget = { x: lx, y: leg.footPos.y + 0.10, z: lz };

        var ik = SK.solveTwoBoneIK(hipOrigin, footTarget, thighLen, shinLen, st._ik);

        var thighM = node(hips, hipLocalX - hipX, -0.04, 0, ik.pitch, 0, ik.roll, 1, lb, 1);
        draw(thighM, 'thigh', cloth);
        var kneeM = node(thighM, 0, -THIGH, 0, ik.bend, 0, 0);
        draw(kneeM, 'knee', cloth);
        draw(kneeM, 'shin', cloth);
        // El tobillo cancela cadera y rodilla: el pie queda plano en el suelo
        // durante el apoyo y sólo se inclina en el vuelo.
        var toe = (1 - leg.plantWeight) * 0.35;
        var ankleM = node(kneeM, 0, -SHIN, 0, -ik.pitch - ik.bend + toe, 0, -ik.roll);
        draw(ankleM, 'foot', steel);
      }
    }

    if (loadout.cape) draw(node(chest, 0, 0.22, -0.13, 0.14 + lc.moveSpeed * 0.40, 0, 0), 'cape', trim);

    /* --- Brazos con codo -------------------------------------------------- */
    var A = CV._armPose(st, arche, loadout, L);
    var arms = [{ x: -0.205, s: A.left, side: -1 }, { x: 0.205, s: A.right, side: 1 }];
    var hands = [null, null];
    for (var a = 0; a < 2; a++) {
      var q = arms[a];
      draw(node(chest, q.x * 1.10, 0.22, 0, 0, 0, q.side * 0.22), 'pauldron', metal);
      var upper = node(chest, q.x, 0.20, 0, q.s.pitch, q.s.yaw, q.s.roll);
      draw(upper, 'shoulderBall', skin);
      draw(upper, 'upperArm', skin);
      var elbowM = node(upper, 0, -UPPER_ARM, 0, q.s.elbow, 0, 0);
      draw(elbowM, 'elbow', skin);
      draw(elbowM, 'lowerArm', skin);
      if (loadout.outfit !== 'robe') draw(elbowM, 'bracer', steel);
      hands[a] = node(elbowM, 0, -LOWER_ARM, 0, q.s.wrist || 0, 0, 0);
      draw(hands[a], 'hand', skin);
    }
    var handL = hands[0], handR = hands[1];

    /* --- Armas ------------------------------------------------------------ */
    var sc = loadout.scale;
    if (loadout.right === 'sword') {
      draw(node(handR, 0, -0.045, 0.015, A.weaponPitch, 0, A.weaponRoll, sc, sc, sc), 'sword', steel);

    } else if (loadout.right === 'bow') {
      var bowM = node(handL, 0, -0.05, 0.03, A.bowPitch, A.bowYaw, 0, sc, sc, sc);
      draw(bowM, 'bow', steel);
      draw(node(bowM, 0, 0, -0.015 - A.draw * 0.24), 'bowString', [0.86, 0.86, 0.80]);
      if (A.draw > 0.05) {
        draw(node(bowM, 0, 0, -0.28 - A.draw * 0.18, Math.PI / 2, 0, 0), 'arrow', [0.60, 0.48, 0.32]);
      }

    } else if (loadout.right === 'staff') {
      var staffM = node(handR, 0, -0.045, 0.01, A.weaponPitch, 0, A.weaponRoll, sc, sc, sc);
      draw(staffM, 'staff', [0.28, 0.22, 0.18]);
      var glow = 0.5 + st.cast * 2.6 + A.gemFlash * 2.2;
      draw(node(staffM, 0, 0.90, 0), 'gem', accent,
        [accent[0] * glow, accent[1] * glow, accent[2] * glow]);
    }

    if (loadout.left === 'shield') {
      draw(node(handL, 0, -0.02, 0.09, -1.45, 0, -0.12), 'shield',
        [team[0] * 0.55, team[1] * 0.55, team[2] * 0.55]);
    } else if (loadout.left === 'orb') {
      var og = 0.6 + st.cast * 2.2;
      draw(node(handL, 0, -0.09, 0.03), 'orb', accent, [accent[0] * og, accent[1] * og, accent[2] * og]);
    }

    if (st.cast > 0.04) {
      var g2 = 0.5 + st.cast * 0.8, e2 = 1.6 + st.cast * 4;
      draw(node(chest, 0, 0.10, 0.38, 0, 0, 0, g2, g2, g2), 'orb', accent,
        [accent[0] * e2, accent[1] * e2, accent[2] * e2]);
    }
    return out;
  };

  /* =========================================================================
   * Brazos: identidad de arquetipo
   * ====================================================================== */
  CV._armPose = function (st, arche, loadout, L) {
    var sw = L.armSwing;
    var A = {
      left:  { pitch: sw, yaw: 0, roll: 0.16, elbow: 0.28, wrist: 0 },
      right: { pitch: -sw, yaw: 0, roll: -0.16, elbow: 0.28, wrist: 0 },
      weaponPitch: 0.40, weaponRoll: 0, draw: 0, gemFlash: 0, bowPitch: 1.0, bowYaw: 0
    };
    // Correr flexiona más el codo: un brazo estirado corriendo se ve rígido.
    A.left.elbow += 0.42 * Math.abs(sw);
    A.right.elbow += 0.42 * Math.abs(sw);

    var attacking = st.attack > 0.001;
    var p = 1 - st.attack;
    var power = st.attackPower;

    if (arche === 'melee') {
      if (attacking) {
        var antEnd = power ? 0.42 : 0.30;
        var ant = smooth(p / antEnd);
        var hit = strike(p, antEnd, power ? 0.62 : 0.55);
        if (power) {
          A.right.pitch = 2.45 * ant - 3.15 * hit + 0.55;
          A.right.roll = -0.08 - 0.22 * ant + 0.12 * hit;
          A.right.elbow = 1.25 * ant - 1.15 * hit + 0.20;
          A.weaponPitch = 0.10 - 0.30 * hit;
          A.left.pitch = -0.60 * ant - 0.35 * hit;
          A.left.elbow = 0.85 + 0.35 * ant;
        } else {
          A.right.pitch = 1.05 * ant - 2.25 * hit + 0.15;
          A.right.yaw = 0.60 * ant - 1.10 * hit;
          A.right.roll = -0.28 - 0.50 * hit;
          A.right.elbow = 1.45 * ant - 1.25 * hit + 0.25;
          A.weaponPitch = 0.50;
          A.weaponRoll = -0.32 * hit;
          A.left.elbow = 0.55;
        }
      } else {
        A.weaponPitch = 0.40;
        A.right.roll = -0.22;
        A.right.elbow += 0.30;   // guardia: el codo nunca del todo estirado
      }

    } else if (arche === 'archer') {
      if (attacking) {
        var raise = smooth(p / 0.22);
        var drawEnd = power ? 0.68 : 0.55;
        var pull = strike(p, 0.22, drawEnd);
        var rel = strike(p, drawEnd, Math.min(1, drawEnd + 0.14));
        // Brazo del arco casi recto al frente; el de la cuerda muy flexionado.
        A.left.pitch = -1.50 * raise;
        A.left.yaw = -0.16 * raise;
        A.left.elbow = 0.12 + 0.10 * raise;
        A.right.pitch = -1.22 * raise;
        A.right.yaw = (0.50 + 0.30 * (power ? 1 : 0)) * pull;
        A.right.elbow = 0.55 + (1.55 + 0.35 * (power ? 1 : 0)) * pull - 1.30 * rel;
        A.draw = Math.max(0, pull - rel);
        A.bowPitch = 1.42;
        if (rel > 0.4) A.right.pitch += 0.45 * rel;
      } else {
        A.left.pitch = -0.28 + sw * 0.3;
        A.left.elbow = 0.55;
        A.left.roll = 0.10;
        A.right.pitch = -sw * 0.5;
        A.right.elbow = 0.45;
        A.bowPitch = 0.95;
        A.bowYaw = 0.35;
      }

    } else { // caster
      if (st.casting || st.cast > 0.05) {
        var c = smooth(st.cast);
        A.right.pitch = -0.30 - 1.90 * c;
        A.right.elbow = 0.30 + 0.55 * c;
        A.right.roll = -0.10;
        A.weaponPitch = -0.28 - 0.50 * c;
        A.left.pitch = -1.20 - 0.30 * c;
        A.left.elbow = 0.95 + 0.30 * c;
        A.left.roll = 0.20;
      } else if (attacking) {
        var jab = strike(p, 0.18, 0.45);
        var back = strike(p, 0.45, 1.0);
        A.right.pitch = 0.30 - 1.70 * jab + 1.15 * back;
        A.right.elbow = 0.95 - 0.80 * jab + 0.60 * back;
        A.weaponPitch = 0.28 - 1.05 * jab + 0.78 * back;
        A.left.pitch = -0.42 * jab;
        A.left.elbow = 0.60 + 0.35 * jab;
        A.gemFlash = Math.max(0, jab - back);
      } else {
        A.right.pitch = 0.10 - sw * 0.3;
        A.right.elbow = 0.32;
        A.right.roll = -0.14;
        A.weaponPitch = 0.28;
        A.left.pitch = sw * 0.6;
        A.left.elbow = 0.35;
      }
    }
    return A;
  };

  /* =========================================================================
   * Paleta
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
