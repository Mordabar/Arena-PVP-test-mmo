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
  ['render/primitives', 'math/mat4', 'data/races'], function (Arena) {
  'use strict';

  var P = Arena.Render.primitives;
  var M = Arena.Math.Mat4;
  var V = Arena.Math.Vec3;

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
      phase: 0,
      speed: 0,            // 0..1 respecto a la velocidad base
      moveF: 0, moveR: 0,  // avance y costado en espacio local, suavizados
      turn: 0,             // velocidad angular suavizada
      attack: 0, attackPower: false, attackKind: 'melee',
      cast: 0, casting: false,
      hurt: 0, downed: 0, deadTime: 0,
      breathe: Math.random() * 6.28,
      idleShift: Math.random() * 6.28,
      lastPos: null, lastYaw: 0
    };
  };

  var ATTACK_TIME = { melee: 0.42, archer: 0.55, caster: 0.34 };

  CV.update = function (st, entity, dt, world) {
    if (!st.lastPos) { st.lastPos = V.clone(entity.pos); st.lastYaw = entity.yaw; }

    /* --- Velocidad y DIRECCIÓN de movimiento en espacio local ------------ */
    var dx = entity.pos.x - st.lastPos.x;
    var dz = entity.pos.z - st.lastPos.z;
    V.copy(st.lastPos, entity.pos);

    var dist = Math.sqrt(dx * dx + dz * dz);
    var rate = dist / Math.max(dt, 1e-4);
    var targetSpeed = Math.min(1.15, rate / Math.max(entity.moveSpeedBase, 0.001));
    st.speed += (targetSpeed - st.speed) * Math.min(1, dt * 11);

    // Proyectar el desplazamiento sobre el frente y el costado del personaje.
    var f = 0, r = 0;
    if (dist > 1e-5) {
      var sy = Math.sin(entity.yaw), cy = Math.cos(entity.yaw);
      f = (dx * sy + dz * cy) / dist;     // +1 avanza, −1 retrocede
      r = (dx * cy - dz * sy) / dist;     // +1 hacia su derecha
    }
    st.moveF += (f * st.speed - st.moveF) * Math.min(1, dt * 9);
    st.moveR += (r * st.speed - st.moveR) * Math.min(1, dt * 9);

    var dyaw = V.angleDelta(st.lastYaw, entity.yaw) / Math.max(dt, 1e-4);
    st.lastYaw = entity.yaw;
    st.turn += (Math.max(-1, Math.min(1, dyaw / 4.0)) - st.turn) * Math.min(1, dt * 8);

    // La cadencia del paso escala con la velocidad: correr no es caminar rápido.
    st.phase += dt * (1.9 + st.speed * 8.2);
    st.breathe += dt * 1.45;
    st.idleShift += dt * 0.55;

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
   * LOCOMOCIÓN
   *
   * Mezcla los ciclos según hacia dónde se mueve el personaje respecto a su
   * propio frente. Los cuatro coexisten: correr en diagonal mezcla el ciclo
   * de avance con el lateral en la proporción que toque.
   * ====================================================================== */
  CV._locomotion = function (st) {
    var L = {
      thighL: 0, thighR: 0, kneeL: 0.06, kneeR: 0.06,
      hipYawL: 0, hipYawR: 0, hipSplay: 0,
      footL: 0, footR: 0,
      armSwing: 0, bob: 0, lean: 0, sideLean: 0, hipRoll: 0, torsoTwist: 0
    };

    var sp = Math.min(1, st.speed);
    var ph = st.phase;
    var sinA = Math.sin(ph), sinB = Math.sin(ph + Math.PI);

    var fwd = Math.max(0, st.moveF);
    var back = Math.max(0, -st.moveF);
    var side = st.moveR;
    var sideAbs = Math.abs(side);

    if (sp <= 0.04) {
      /* --- PARADO: respiración, peso que alterna, micro-balanceo --------- */
      var idle = Math.sin(st.idleShift);
      L.thighL = 0.03 + idle * 0.02;
      L.thighR = 0.03 - idle * 0.02;
      L.kneeL = 0.11 + Math.max(0, idle) * 0.07;
      L.kneeR = 0.11 + Math.max(0, -idle) * 0.07;
      L.hipRoll = idle * 0.035;
      L.hipSplay = 0.05;
      L.bob = Math.sin(st.breathe) * 0.008;
      L.armSwing = idle * 0.05;

      /* --- GIRO EN EL SITIO: los pies pivotan, el torso se adelanta ------ */
      if (Math.abs(st.turn) > 0.05) {
        var t = st.turn;
        L.hipYawL = -t * 0.30;
        L.hipYawR = t * 0.30;
        L.thighL += Math.abs(t) * 0.14;
        L.kneeL += Math.abs(t) * 0.20;
        L.torsoTwist = t * 0.20;
        L.sideLean = -t * 0.06;
      }
      return L;
    }

    /* --- AVANCE ---------------------------------------------------------- */
    // La rodilla se flexiona en el recobro, no durante el apoyo: eso es lo que
    // convierte el balanceo en zancada.
    if (fwd > 0.02) {
      var amp = 0.55 + sp * 0.42;
      L.thighL += sinA * amp * fwd;
      L.thighR += sinB * amp * fwd;
      L.kneeL += (0.10 + Math.max(0, -sinA) * (0.85 + sp * 0.75)) * fwd;
      L.kneeR += (0.10 + Math.max(0, -sinB) * (0.85 + sp * 0.75)) * fwd;
      L.footL += (-sinA * 0.30 + 0.12) * fwd;
      L.footR += (-sinB * 0.30 + 0.12) * fwd;
      L.armSwing += -sinA * (0.55 + sp * 0.35) * fwd;
      L.bob += Math.abs(Math.sin(ph * 2)) * 0.045 * sp * fwd;
      L.lean += (0.13 + sp * 0.16) * fwd;
      L.torsoTwist += sinA * 0.12 * fwd;
    }

    /* --- RETROCESO -------------------------------------------------------- */
    // Pasos cortos y altos, torso echado atrás. Nadie retrocede con la misma
    // zancada con la que avanza.
    if (back > 0.02) {
      L.thighL += -sinA * 0.34 * back;
      L.thighR += -sinB * 0.34 * back;
      L.kneeL += (0.28 + Math.max(0, sinA) * 0.85) * back;
      L.kneeR += (0.28 + Math.max(0, sinB) * 0.85) * back;
      L.footL += 0.30 * back;
      L.footR += 0.30 * back;
      L.armSwing += sinA * 0.28 * back;
      L.bob += Math.abs(Math.sin(ph * 2)) * 0.030 * back;
      L.lean += -0.16 * back;
    }

    /* --- DESPLAZAMIENTO LATERAL ------------------------------------------ */
    // Piernas que cruzan y se abren, cadera girada y cuerpo inclinado contra
    // la dirección: reposicionarse sin dejar de mirar al rival.
    if (sideAbs > 0.02) {
      var dir = side > 0 ? 1 : -1;
      var cross = Math.sin(ph) * sideAbs;
      L.hipSplay += 0.16 * sideAbs;
      L.hipYawL += (dir > 0 ? -0.34 : 0.16) * sideAbs;
      L.hipYawR += (dir > 0 ? 0.16 : -0.34) * sideAbs;
      L.thighL += cross * 0.30 * dir;
      L.thighR += -cross * 0.30 * dir;
      L.kneeL += (0.20 + Math.abs(cross) * 0.45) * sideAbs;
      L.kneeR += (0.20 + Math.abs(cross) * 0.45) * sideAbs;
      L.sideLean += -dir * (0.10 + sp * 0.10) * sideAbs;
      L.hipRoll += dir * 0.06 * sideAbs;
      L.bob += Math.abs(Math.sin(ph * 2)) * 0.026 * sideAbs;
      L.armSwing *= (1 - sideAbs * 0.45);
    }

    L.sideLean += -st.turn * 0.14 * sp;
    L.torsoTwist += st.turn * 0.10;
    return L;
  };

  /* =========================================================================
   * Pose
   * ====================================================================== */
  CV.buildPose = function (out, st, entity, pos, yaw, palette) {
    out.length = 0;

    var loadout = LOADOUT[entity.classId] || LOADOUT.devastador;
    var arche = CV.archetypeOf(entity.classId);
    var race = Arena.Data.getRace(entity.raceId);
    var build = race.build, feat = race.features;

    var L = CV._locomotion(st);
    var breath = Math.sin(st.breathe) * 0.012 * (1 - st.speed);

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

    var hipY = 0.96 + L.bob + breath;

    /* --- Cadera y tronco articulado -------------------------------------- */
    var hips = node(root, 0, hipY, 0, 0, L.torsoTwist * 0.4, L.hipRoll);
    draw(hips, 'pelvis', cloth);

    var abdomen = node(hips, 0, 0.06, 0, -L.lean * 0.45, L.torsoTwist * 0.3, L.sideLean * 0.4);
    draw(abdomen, 'abdomen', cloth);

    var chest = node(abdomen, 0, 0.14, 0, -L.lean * 0.55, L.torsoTwist * 0.5, L.sideLean * 0.6);
    draw(chest, 'ribcage', cloth);
    if (loadout.outfit !== 'robe') draw(chest, 'collar', metal);
    draw(chest, 'tabard', [team[0] * 0.70, team[1] * 0.70, team[2] * 0.70]);

    /* --- Cabeza ----------------------------------------------------------- */
    var hs = build.head;
    draw(node(chest, 0, 0.30, 0, L.lean * 0.3, 0, 0, 1, build.neck, 1), 'neck', skin);
    // La cabeza contrarresta la inclinación del torso: la mirada se mantiene al
    // frente aunque el cuerpo se incline, como en cualquier ser vivo.
    var head = node(chest, 0, 0.40, 0.005, L.lean * 0.75 - st.turn * 0.10,
      -L.torsoTwist * 0.6 + st.turn * 0.22, -L.sideLean * 0.3, hs, hs, hs);
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
      var swayR = L.lean * 0.3 + Math.sin(st.phase) * 0.09 * st.speed;
      var robeM = node(hips, 0, 0.06, 0, swayR, 0, L.sideLean * 0.5);
      draw(robeM, 'robe', cloth);
      draw(robeM, 'robeTrim', trim);
    } else {
      var lb = build.limbs;
      var legs = [
        { x: -0.112, thigh: L.thighL, knee: L.kneeL, yawH: L.hipYawL, foot: L.footL, roll: -L.hipSplay },
        { x: 0.112, thigh: L.thighR, knee: L.kneeR, yawH: L.hipYawR, foot: L.footR, roll: L.hipSplay }
      ];
      for (var i = 0; i < 2; i++) {
        var g = legs[i];
        var thighM = node(hips, g.x, -0.04, 0, g.thigh, g.yawH, g.roll, 1, lb, 1);
        draw(thighM, 'thigh', cloth);
        var kneeM = node(thighM, 0, -THIGH, 0, g.knee, 0, 0);
        draw(kneeM, 'knee', cloth);
        draw(kneeM, 'shin', cloth);
        // El tobillo cancela muslo y rodilla para que el pie quede plano.
        var ankleM = node(kneeM, 0, -SHIN, 0, -g.thigh - g.knee + g.foot, 0, 0);
        draw(ankleM, 'foot', steel);
      }
    }

    if (loadout.cape) draw(node(chest, 0, 0.22, -0.13, 0.14 + st.speed * 0.40, 0, 0), 'cape', trim);

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
