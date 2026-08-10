/* =============================================================================
 * render/characterVisual.js — Humanoide procedural y su animación.
 *
 * No hay modelos ni rigs: el personaje es una jerarquía de primitivas cuya pose
 * se calcula cada fotograma. Suficiente para validar game feel, y sustituible
 * por mallas reales sin tocar una sola regla de combate (documento §29, fase 7).
 *
 * Convención de esqueleto: cada extremidad se genera COLGANDO desde su
 * articulación (el pivote está en y = 0 y la malla crece hacia −Y). Así un
 * ángulo de 0 es "brazo caído" y rotar en pitch hace girar el miembro desde el
 * hombro o la cadera, no desde el pie.
 *
 *   pitch = 0     → colgando
 *   pitch > 0     → hacia atrás (−Z)
 *   pitch < 0     → hacia delante (+Z)
 *
 * Lo que la animación tiene que comunicar, en orden de importancia:
 *   1. Estoy bajo control (derribado / aturdido)  → postura inequívoca
 *   2. Estoy lanzando algo                        → brazos y luz de casteo
 *   3. Estoy golpeando                            → arco de arma nítido
 *   4. Me estoy moviendo                          → zancada y balanceo
 * ========================================================================== */
Arena.define('render/characterVisual',
  ['render/primitives', 'math/mat4'], function (Arena) {
  'use strict';

  var P = Arena.Render.primitives;
  var M = Arena.Math.Mat4;
  var V = Arena.Math.Vec3;

  var CV = {};

  // Proporciones humanas de referencia sobre 1.85 de altura total. Con el
  // torso más ancho que los hombros el personaje parecía un armario y los
  // brazos desaparecían dentro del pecho.
  var ARM_LEN = 0.66;
  var LEG_LEN = 0.88;

  /** Cápsula que cuelga: pivote arriba, cuerpo hacia −Y. */
  function hanging(radius, length, segs) {
    var m = P.capsule(radius, length, segs || 10);
    return P.translate(m, 0, -length, 0);
  }

  /* --- Mallas compartidas por todos los personajes ------------------------ */
  CV.buildMeshes = function () {
    return {
      torso: P.translate(P.box(0.36, 0.50, 0.21), 0, 0.25, 0),
      chestPlate: P.translate(P.box(0.42, 0.15, 0.23), 0, 0.44, 0),
      hips: P.translate(P.box(0.31, 0.21, 0.20), 0, -0.10, 0),
      pauldron: P.sphere(0.102, 8, 12),
      neck: P.translate(P.cylinder(0.058, 0.09, 8, 1), 0, 0, 0),
      head: P.merge([
        P.translate(P.sphere(0.118, 10, 14), 0, 0.12, 0),
        P.translate(P.box(0.13, 0.085, 0.14), 0, 0.09, 0.075)   // visera
      ]),
      arm: hanging(0.062, ARM_LEN, 10),
      forearmGuard: P.translate(P.cylinder(0.076, 0.22, 8, 0.92), 0, -ARM_LEN * 0.90, 0),
      leg: hanging(0.092, LEG_LEN, 10),
      boot: P.translate(P.box(0.145, 0.12, 0.26), 0, -LEG_LEN + 0.02, 0.045),

      /* Armas: pivote en la empuñadura, hoja hacia +Y */
      // La hoja es deliberadamente ancha (0.11): una espada realista de 3 cm
      // es invisible a 10 unidades de cámara, y el arco del golpe es la lectura
      // principal de que alguien está atacando.
      sword: P.merge([
        P.translate(P.box(0.110, 0.82, 0.042), 0, 0.52, 0),
        P.translate(P.box(0.075, 0.14, 0.050), 0, 0.94, 0),      // punta
        P.translate(P.box(0.28, 0.065, 0.085), 0, 0.10, 0),      // guarda
        P.translate(P.box(0.072, 0.20, 0.072), 0, 0.00, 0)       // empuñadura
      ]),
      shield: P.merge([
        P.box(0.46, 0.60, 0.060),
        P.translate(P.sphere(0.085, 8, 10), 0, 0, 0.048)
      ]),
      bow: P.merge([
        P.translate(P.cylinder(0.026, 0.60, 8, 0.45), 0, 0, 0),
        P.rotateY(P.translate(P.cylinder(0.026, 0.60, 8, 0.45), 0, 0, 0), Math.PI),
        P.translate(P.box(0.045, 0.16, 0.045), 0, -0.08, 0)
      ]),
      staff: P.merge([
        P.translate(P.cylinder(0.032, 1.45, 8, 0.88), 0, -0.55, 0),
        P.translate(P.sphere(0.098, 8, 12), 0, 0.98, 0)
      ]),
      orb: P.sphere(0.12, 8, 12),
      cape: P.translate(P.box(0.40, 0.70, 0.04), 0, -0.35, 0)
    };
  };

  /* --- Equipo por clase ---------------------------------------------------- */
  var LOADOUT = {
    devastador: { right: 'sword', left: null, cape: false, scale: 1.10 },
    guardian:   { right: 'sword', left: 'shield', cape: false, scale: 0.92 },
    centinela:  { right: 'bow', left: null, cape: false, scale: 1.20 },
    rastreador: { right: 'bow', left: null, cape: true, scale: 1.00 },
    arcanista:  { right: 'staff', left: null, cape: true, scale: 1.00 },
    vinculador: { right: 'staff', left: 'orb', cape: true, scale: 0.95 }
  };

  /* =========================================================================
   * Estado de animación por entidad
   * ====================================================================== */
  CV.createState = function () {
    return {
      phase: 0, speed: 0,
      swing: 0, swingKind: 'melee',
      cast: 0, casting: false,
      hurt: 0, downed: 0, deadTime: 0,
      breathe: Math.random() * 6.28,
      lean: 0,
      lastPos: null
    };
  };

  CV.update = function (st, entity, dt, world) {
    if (!st.lastPos) st.lastPos = V.clone(entity.pos);

    var moved = V.distXZ(entity.pos, st.lastPos) / Math.max(dt, 1e-4);
    V.copy(st.lastPos, entity.pos);

    var targetSpeed = Math.min(1, moved / Math.max(entity.moveSpeedBase, 0.001));
    st.speed += (targetSpeed - st.speed) * Math.min(1, dt * 12);

    st.phase += dt * (1.7 + st.speed * 8.5);
    st.breathe += dt * 1.5;
    st.lean += (st.speed * 0.20 - st.lean) * Math.min(1, dt * 8);

    if (st.swing > 0) st.swing = Math.max(0, st.swing - dt * 3.4);
    if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt * 3.5);

    var m = entity.mods();
    var isDown = !m.canMove && !m.canUseAbility;    // noqueo, aturdimiento, estasis
    var target = (!entity.alive) ? 1 : (isDown ? 1 : 0);
    var rate = target > st.downed ? 11.0 : 5.5;     // caer rápido, levantarse con peso
    st.downed += (target - st.downed) * Math.min(1, dt * rate);

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

  CV.triggerSwing = function (st, kind) { st.swing = 1; st.swingKind = kind || 'melee'; };
  CV.triggerHurt = function (st) { st.hurt = 1; };

  /* =========================================================================
   * Pose
   * ====================================================================== */
  CV.buildPose = function (out, st, entity, pos, yaw, palette) {
    out.length = 0;

    var loadout = LOADOUT[entity.classId] || LOADOUT.devastador;
    var walk = Math.sin(st.phase) * st.speed;
    var walkB = -walk;
    var bob = Math.abs(Math.sin(st.phase * 2)) * 0.035 * st.speed;
    var breath = Math.sin(st.breathe) * 0.014 * (1 - st.speed);

    // Derribo: el cuerpo bascula hacia atrás PIVOTANDO SOBRE LOS PIES.
    // Bajar además el root hundía al personaje bajo el suelo y desaparecía
    // justo en el momento en que más importa verlo: mientras está controlado.
    var downPitch = st.downed * 1.42;
    var downLift = st.downed * 0.22;      // el cuerpo tumbado se apoya, no se clava

    var root = M.create();
    M.composeFull(root, { x: pos.x, y: pos.y + downLift, z: pos.z }, yaw, -downPitch, 0,
      { x: 1, y: 1, z: 1 });

    var skin = palette.skin, cloth = palette.cloth, metal = palette.metal;
    var accent = palette.accent, steel = palette.steel;

    /* Emisor de partes: `parent` permite encadenar (brazo → mano → arma). */
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
    draw(pelvis, 'hips', cloth);

    var chest = node(root, 0, hipY, 0, chestPitch, 0, 0);
    draw(chest, 'torso', cloth);
    draw(chest, 'chestPlate', metal);

    var headM = node(chest, 0, 0.58, 0.01, -chestPitch * 0.4, Math.sin(st.breathe * 0.6) * 0.06, 0);
    draw(node(chest, 0, 0.50, 0, 0, 0, 0), 'neck', skin);
    draw(headM, 'head', skin);

    draw(node(chest, -0.235, 0.47, 0, 0, 0, -0.22), 'pauldron', metal);
    draw(node(chest, 0.235, 0.47, 0, 0, 0, 0.22), 'pauldron', metal);

    if (loadout.cape) {
      draw(node(chest, 0, 0.46, -0.13, 0.12 + st.speed * 0.35, 0, 0), 'cape', accent);
    }

    /* --- Piernas: pivotan desde la cadera --------------------------------- */
    var legL = node(pelvis, -0.105, -0.08, 0, walk * 0.80, 0, 0);
    var legR = node(pelvis, 0.105, -0.08, 0, walkB * 0.80, 0, 0);
    draw(legL, 'leg', cloth);
    draw(legR, 'leg', cloth);
    draw(node(legL, 0, 0, 0, -walk * 0.35, 0, 0), 'boot', steel);
    draw(node(legR, 0, 0, 0, -walkB * 0.35, 0, 0), 'boot', steel);

    /* --- Brazos: pivotan desde el hombro ----------------------------------
     * Prioridad de la pose del brazo de arma: golpe > casteo > carrera.      */
    var swingEase = st.swing * st.swing * (3 - 2 * st.swing);
    var rightPitch, leftPitch, rightRoll = -0.19, leftRoll = 0.19;

    if (st.swing > 0.001 && st.swingKind !== 'ranged') {
      // Arco de tajo: arranca alzado hacia atrás y baja al frente.
      rightPitch = 2.05 * swingEase - 1.15 * (1 - swingEase);
      rightRoll = -0.19 - 0.48 * swingEase;
      leftPitch = walkB * 0.5;
    } else if (st.swing > 0.001) {
      // Tensar y soltar: el codo atrás, el arco al frente.
      rightPitch = -1.30 - swingEase * 0.30;
      leftPitch = -1.45;
      leftRoll = 0.05;
    } else if (st.cast > 0.02) {
      // Casteo: ambos brazos al frente, casi horizontales.
      rightPitch = -1.15 - st.cast * 0.35;
      leftPitch = -1.05 - st.cast * 0.30;
    } else {
      rightPitch = walkB * 0.75;
      leftPitch = walk * 0.75;
    }

    // Los brazos cuelgan justo fuera del torso (0.36 de ancho): si se colocan
    // más adentro, desaparecen dentro del pecho en cuanto la pose los baja.
    var shoulderY = 0.45;
    var armL = node(chest, -0.245, shoulderY, 0, leftPitch, 0, leftRoll);
    var armR = node(chest, 0.245, shoulderY, 0, rightPitch, 0, rightRoll);
    draw(armL, 'arm', skin);
    draw(armR, 'arm', skin);
    draw(armL, 'forearmGuard', steel);
    draw(armR, 'forearmGuard', steel);

    /* --- Armas: ancladas al extremo del brazo ------------------------------ */
    var s = loadout.scale;
    var handR = node(armR, 0, -ARM_LEN, 0.02, 0, 0, 0);
    var handL = node(armL, 0, -ARM_LEN, 0.02, 0, 0, 0);

    if (loadout.right === 'sword') {
      draw(node(handR, 0, 0, 0, 0.42, 0, 0, s, s, s), 'sword', steel);
    } else if (loadout.right === 'bow') {
      // El arco se sostiene vertical, perpendicular al brazo.
      draw(node(handR, 0, 0, 0.06, 1.35, 0, 0, s, s, s), 'bow', steel);
    } else if (loadout.right === 'staff') {
      draw(node(handR, 0, 0, 0.02, 0.30, 0, 0.18, s, s, s), 'staff', steel);
      var orbM = node(handR, 0, 0, 0.02, 0.30, 0, 0.18, s, s, s);
      var tip = node(orbM, 0, 0.98, 0, 0, 0, 0, 0.9, 0.9, 0.9);
      draw(tip, 'orb', accent, scaleColor(accent, 0.7 + st.cast * 2.4));
    }

    if (loadout.left === 'shield') {
      draw(node(handL, 0, 0.10, 0.10, -1.35, 0, -0.10), 'shield', accent);
    } else if (loadout.left === 'orb') {
      draw(node(handL, 0, 0, 0.06, 0, 0, 0, 0.9, 0.9, 0.9),
        'orb', accent, scaleColor(accent, 0.6 + st.cast * 2.0));
    }

    /* --- Luz de casteo entre las manos ------------------------------------ */
    if (st.cast > 0.04) {
      var glow = 0.55 + st.cast * 0.75;
      draw(node(chest, 0, 0.20, 0.52, 0, 0, 0, glow, glow, glow),
        'orb', accent, scaleColor(accent, 1.4 + st.cast * 3.8));
    }

    return out;
  };

  function scaleColor(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  /** Paleta por clase y bando. El color de equipo tiene que ganar siempre a la
   *  estética: en un tiroteo hay que distinguir amigo de enemigo en un vistazo. */
  CV.paletteFor = function (entity, isFriendly) {
    var cls = Arena.Data.classes[entity.classId];
    var base = cls ? cls.color : [0.7, 0.7, 0.7];
    var teamTint = isFriendly ? [0.20, 0.52, 1.00] : [1.00, 0.22, 0.16];

    function mix(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    return {
      skin: [0.62, 0.50, 0.43],
      // El acero se mantiene neutro: si también se tiñera de bando, las armas
      // dejarían de leerse como armas y todo el personaje sería una mancha.
      steel: [0.60, 0.63, 0.70],
      // 62 % de tinte de bando: la clase se reconoce por silueta y arma, el
      // bando por color. Confundir bando cuesta la partida; confundir clase, no.
      cloth: mix(base, teamTint, 0.62),
      metal: mix([0.36, 0.39, 0.45], teamTint, 0.28),
      accent: mix(base, [1, 1, 1], 0.35),
      team: teamTint
    };
  };

  Arena.Render.CharacterVisual = CV;
});
