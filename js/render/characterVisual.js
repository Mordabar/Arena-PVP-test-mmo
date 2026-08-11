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
   'render/anim/skeleton', 'render/anim/locomotion', 'render/anim/actions',
   'anim/animationIntent'],
  function (Arena) {
  'use strict';

  var P = Arena.Render.primitives;
  var M = Arena.Math.Mat4;
  var V = Arena.Math.Vec3;
  var SK = Arena.Render.Skeleton;
  var Loco = Arena.Render.Locomotion;
  var Act = Arena.Render.Actions;
  var AI = Arena.Anim.AnimationIntent;

  var CV = {};

  /* Longitudes de hueso, sobre una altura total de ~1.85 */
  var UPPER_ARM = 0.30, LOWER_ARM = 0.29;
  var THIGH = 0.45, SHIN = 0.43;

  /* =========================================================================
   * Proporciones derivadas — NO son números sueltos
   *
   * La altura de la cadera NO se elige: se deduce de la longitud de la pierna.
   * Si se fija a mano y no cuadra con los huesos, la IK resuelve la única pose
   * posible —rodillas dobladas— y el personaje se pasa la partida en cuclillas.
   * Es exactamente lo que pasaba antes: 0.96 de cadera contra una pierna de
   * 0.93 daba 123° de rodilla, es decir, media sentadilla permanente.
   *
   * De pie, una pierna humana está casi recta. `STAND_EXTENSION` dice cuánto,
   * y el resto sale solo. Cambiar THIGH o SHIN ya no puede volver a romperlo.
   * ====================================================================== */
  var ANKLE_HEIGHT = 0.075;     // del suelo al centro del tobillo
  var HIP_SOCKET = 0.04;        // de la cadera al pivote real del muslo
  var STAND_EXTENSION = 0.985;  // fracción de pierna usada de pie
  var TORSO_ABOVE_HIP = 0.845;  // de la cadera a la coronilla, medido del rig

  /** Altura de la cadera en reposo para una escala de miembros dada. */
  function hipRestFor(limbScale) {
    return ANKLE_HEIGHT + (THIGH + SHIN) * limbScale * STAND_EXTENSION + HIP_SOCKET;
  }

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

      /* --- Cabeza -----------------------------------------------------------
       * Los rasgos tienen que SALIR del cráneo. Enterrados dentro de la esfera
       * no se ven —era el caso: la nariz asomaba dos centímetros y la ceja ni
       * eso—, y una cabeza sin rasgos es una bola con pelo por muchos polígonos
       * que tenga. Aquí todo se mide contra el semieje del cráneo (0.1225 de
       * profundidad) para que cada pieza rompa la superficie.                */
      skull: P.merge([
        P.scale(P.sphere(0.5, 11, 15), 0.225, 0.255, 0.248),
        // Pómulos altos y mentón afilado: el rasgo racial élfico más legible a
        // distancia no son las orejas, es el triángulo de la cara.
        P.translate(P.scale(P.box(0.165, 0.085, 0.150), 1, 1, 1), 0, -0.055, 0.048)
      ]),
      jaw: P.merge([
        P.translate(P.scale(P.box(0.140, 0.085, 0.145), 1, 1, 1), 0, -0.098, 0.040),
        P.translate(P.scale(P.sphere(0.5, 6, 8), 0.105, 0.070, 0.090), 0, -0.120, 0.075)
      ]),
      brow: P.merge([
        P.translate(P.box(0.200, 0.036, 0.060), 0, 0.040, 0.098),
        P.translate(P.scale(P.box(0.078, 0.030, 0.055), 1, 1, 1), -0.058, 0.052, 0.100),
        P.translate(P.scale(P.box(0.078, 0.030, 0.055), 1, 1, 1), 0.058, 0.052, 0.100)
      ]),
      nose: P.merge([
        P.translate(P.scale(P.box(0.034, 0.090, 0.050), 1, 1, 1), 0, -0.010, 0.112),
        P.translate(P.scale(P.cone(0.030, 0.055, 5), 1, -1, 1.4), 0, -0.020, 0.126)
      ]),
      neck: bone(0.056, 0.064, 0.11, 8),
      ear: P.scale(P.cone(0.042, 1.0, 7), 0.42, 1, 1),
      eye: P.scale(P.sphere(0.5, 6, 8), 0.048, 0.030, 0.026),

      /* Pelo: CASCO, no esfera. La versión anterior era una esfera más ancha y
         más profunda que el cráneo, así que se tragaba literalmente la cara. */
      hairCap: P.merge([
        P.translate(P.scale(P.sphere(0.5, 10, 14), 0.244, 0.220, 0.252), 0, 0.030, -0.022),
        // Melena hacia atrás.
        P.translate(P.scale(P.box(0.200, 0.150, 0.170), 1, 1, 1), 0, -0.010, -0.088),
        // Mechones laterales: enmarcan la cara sin taparla.
        P.translate(P.scale(P.box(0.045, 0.170, 0.080), 1, 1, 1), -0.108, -0.030, 0.028),
        P.translate(P.scale(P.box(0.045, 0.170, 0.080), 1, 1, 1), 0.108, -0.030, 0.028)
      ]),
      // Coleta con volumen: un cono de 7 caras a esta escala se lee como una
      // cartulina blanca pegada a la nuca.
      hairTail: P.merge([
        P.translate(P.scale(P.sphere(0.5, 7, 10), 0.135, 0.115, 0.135), 0, -0.020, -0.155),
        P.translate(P.scale(P.cone(0.070, 0.30, 10), 1, -1, 0.92), 0, -0.060, -0.170)
      ]),

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

      /* --- Atuendo ---------------------------------------------------------
       * Un personaje no es un maniquí pintado: lo que le da lectura de silueta
       * son las piezas con VOLUMEN propio —cinturón, hebilla, peto, faldón,
       * quijotes, rodilleras, caña de bota— porque cada una rompe el contorno
       * en un sitio distinto y da escala al resto del cuerpo.               */
      pauldron: P.merge([
        P.scale(P.sphere(0.5, 8, 11), 0.205, 0.135, 0.190),
        P.translate(P.scale(P.cylinder(0.098, 0.030, 10, 1.0), 1, 1, 0.92), 0, -0.055, 0)
      ]),
      // Hombrera de cuero: una cazoleta, no una bola de acero. Es la primera
      // pieza que distingue a un explorador de un caballero a veinte unidades.
      shoulderCap: P.scale(P.sphere(0.5, 7, 10), 0.170, 0.090, 0.160),
      tabard: P.translate(P.scale(P.box(0.115, 0.40, 0.235), 1, 1, 1), 0, 0.00, 0),
      collar: P.translate(P.scale(P.box(0.31, 0.062, 0.215), 1, 1, 1), 0, 0.30, 0),
      chestPlate: P.merge([
        P.scale(P.sphere(0.5, 9, 12), 0.335, 0.285, 0.230),
        P.translate(P.scale(P.box(0.055, 0.24, 0.045), 1, 1, 1), 0, 0.01, 0.105)
      ]),
      /* Carcaj a la espalda con flechas asomando: un arquero sin munición
         visible parece un tipo con un palo curvo. */
      quiver: P.merge([
        P.translate(P.cylinder(0.058, 0.34, 9, 0.86), 0, -0.17, 0),
        P.translate(P.scale(P.cylinder(0.062, 0.030, 9, 1.0), 1, 1, 1), 0, 0.00, 0)
      ]),
      quiverArrows: P.merge([
        P.translate(P.cylinder(0.010, 0.20, 4, 1), -0.020, 0.02, 0.014),
        P.translate(P.cylinder(0.010, 0.22, 4, 1), 0.016, 0.02, -0.010),
        P.translate(P.cylinder(0.010, 0.19, 4, 1), 0.000, 0.02, 0.030)
      ]),
      strap: P.translate(P.scale(P.box(0.062, 0.44, 0.030), 1, 1, 1), 0, -0.02, 0),
      sash: P.translate(P.scale(P.cylinder(0.255, 0.085, 14, 1.0), 1, 1, 0.86), 0, -0.04, 0),
      stole: P.translate(P.scale(P.box(0.062, 0.46, 0.034), 1, 1, 1), 0, -0.21, 0),
      // Cuerpo de la túnica: cubre el tronco y enlaza con la falda. Sin él, la
      // caja torácica quedaba a la vista como un panel plano encima de la
      // campana de tela, y el mago parecía dos objetos apilados.
      // Se ensancha HACIA ARRIBA, de la cintura a los hombros, y termina ahí:
      // la malla se construye de y=0 a y=h, así que el radio base es el de la
      // cintura y `taper` es cuánto abre en el pecho.
      robeBodice: P.merge([
        P.scale(P.cylinder(0.150, 0.40, 14, 1.42), 1, 1, 0.86),
        P.translate(P.scale(P.sphere(0.5, 8, 11), 0.40, 0.20, 0.30), 0, 0.375, 0)
      ]),
      // El cinturón ciñe la cadera: su radio sale del ancho de la pelvis (0.35
      // de diámetro), no de un número al azar. Con 0.285 era un disco más ancho
      // que el propio cuerpo y se leía como un tutú.
      belt: P.merge([
        P.translate(P.scale(P.cylinder(0.190, 0.070, 14, 1.0), 1, 1, 0.80), 0, -0.035, 0),
        P.translate(P.scale(P.cylinder(0.200, 0.020, 14, 1.0), 1, 1, 0.80), 0, -0.012, 0)
      ]),
      buckle: P.merge([
        P.scale(P.box(0.075, 0.070, 0.026), 1, 1, 1),
        P.translate(P.sphere(0.022, 6, 8), 0, 0, 0.016)
      ]),
      // Panel del faldón: cuelga desde la cadera y sigue al muslo al que se ata.
      skirtPanel: P.translate(P.scale(P.box(0.132, 0.26, 0.050), 1, 1, 1), 0, -0.13, 0.050),
      thighGuard: P.scale(P.sphere(0.5, 7, 9), 0.115, 0.150, 0.105),
      kneeGuard: P.scale(P.sphere(0.5, 7, 9), 0.092, 0.082, 0.092),
      bootCuff: P.translate(P.cylinder(0.098, 0.085, 9, 1.15), 0, -0.042, 0),
      bracer: P.translate(P.cylinder(0.060, 0.15, 8, 1), 0, -LOWER_ARM * 0.85, 0),
      /* La túnica llega al SUELO. Flotando a 17 cm, el mago se leía como una
         pieza de ajedrez sobre un pedestal invisible. */
      robe: P.translate(P.cylinder(0.290, 1.10, 18, 0.50), 0, -1.10, 0),
      robeTrim: P.translate(P.cylinder(0.297, 0.050, 18, 1), 0, -1.10, 0),
      /* Capucha: pico caído hacia ATRÁS, no un cucurucho vertical. El cono
         apuntando al cielo convertía al arcanista en un sombrero de bruja. */
      hood: P.merge([
        P.scale(P.sphere(0.5, 10, 13), 0.330, 0.330, 0.345),
        P.translate(P.scale(P.sphere(0.5, 8, 10), 0.240, 0.190, 0.320), 0, 0.010, -0.140),
        P.translate(P.scale(P.sphere(0.5, 7, 9), 0.145, 0.115, 0.190), 0, -0.045, -0.235)
      ]),
      cape: P.translate(P.scale(P.box(0.42, 0.76, 0.035), 1, 1, 1), 0, -0.38, 0),

      /* --- Armas ---------------------------------------------------------- */
      /* Espada: hoja estrecha y con filo, no un tablón. Una hoja tan ancha como
         un antebrazo convierte cualquier animación de esgrima en un mamporro. */
      sword: P.merge([
        P.translate(P.scale(P.box(0.072, 0.62, 0.024), 1, 1, 1), 0, 0.415, 0),
        P.translate(P.scale(P.cone(0.036, 0.130, 4), 1, 1, 0.42), 0, 0.725, 0),
        P.translate(P.scale(P.box(0.190, 0.044, 0.058), 1, 1, 1), 0, 0.095, 0),
        P.translate(P.scale(P.box(0.048, 0.165, 0.048), 1, 1, 1), 0, 0.005, 0),
        P.translate(P.sphere(0.036, 6, 8), 0, -0.082, 0)
      ]),
      shield: P.merge([
        P.scale(P.sphere(0.5, 8, 11), 0.45, 0.58, 0.13),
        P.translate(P.sphere(0.072, 7, 9), 0, 0, 0.060)
      ]),
      /* Arco recurvo: dos palas que se abren hacia atrás desde una empuñadura
         central, con las puntas adelantadas. Dos cilindros rectos en línea no
         son un arco, son un palo partido por la mitad. */
      bow: P.merge([
        P.translate(P.cylinder(0.019, 0.30, 6, 0.42), 0, 0.075, -0.010),
        P.translate(P.scale(P.cylinder(0.019, 0.30, 6, 0.42), 1, -1, 1), 0, -0.075, -0.010),
        // Puntas curvadas hacia el tirador.
        P.translate(P.scale(P.cylinder(0.011, 0.10, 5, 0.75), 1, 1, 1), 0, 0.360, 0.030),
        P.translate(P.scale(P.cylinder(0.011, 0.10, 5, 0.75), 1, -1, 1), 0, -0.360, 0.030),
        P.translate(P.scale(P.box(0.034, 0.17, 0.046), 1, 1, 1), 0, 0, 0.008)
      ]),
      bowString: P.box(0.008, 0.86, 0.008),
      arrow: P.merge([
        P.cylinder(0.013, 0.60, 5, 1),
        P.translate(P.cone(0.027, 0.082, 5), 0, 0.60, 0)
      ]),
      staff: P.merge([
        P.translate(P.cylinder(0.026, 1.46, 8, 0.88), 0, -0.60, 0),
        P.translate(P.scale(P.sphere(0.5, 7, 9), 0.105, 0.165, 0.105), 0, 0.88, 0)
      ]),
      gem: P.sphere(0.078, 8, 10),
      orb: P.sphere(0.112, 8, 12)
    };
  };

  /* =========================================================================
   * Arquetipo y atuendo
   * ====================================================================== */
  // Arquetipo y arma son hechos de la clase, no decisiones de dibujo: viven en
  // data/animConfig.js para que la capa neutral de animación pueda leerlos sin
  // arrastrar consigo nada de presentación.
  CV.archetypeOf = function (classId) { return Arena.Data.archetypeOf(classId); };

  /* El arma la fija data/; aquí sólo se decide cómo se VISTE cada clase. */
  var LOADOUT = {
    devastador: { left: null, outfit: 'plate', scale: 1.05 },
    guardian:   { left: 'shield', outfit: 'plate', scale: 0.92 },
    centinela:  { left: null, outfit: 'leather', scale: 1.08 },
    rastreador: { left: null, outfit: 'leather', scale: 0.94, cape: true },
    arcanista:  { left: null, outfit: 'robe', scale: 1.00, hood: true },
    vinculador: { left: 'orb', outfit: 'robe', scale: 0.95, hood: true }
  };
  for (var _cid in LOADOUT) {
    if (Object.prototype.hasOwnProperty.call(LOADOUT, _cid)) {
      LOADOUT[_cid].classId = _cid;
      LOADOUT[_cid].right = Arena.Data.weaponOf(_cid);
    }
  }

  /* =========================================================================
   * Materiales
   *
   * Que todo el personaje comparta una misma rugosidad es lo que hace que un
   * modelo se lea como plástico. La piel dispersa, el metal refleja duro, el
   * cuero apaga, la tela no brilla nada y lo mágico casi no tiene rugosidad.
   * Es la diferencia más barata entre "figura de acción" y "personaje".
   * ====================================================================== */
  /* OJO CON rimPower: el contorno es pow(1 − N·V, rimPower), así que un valor
     ALTO da un borde estrecho y uno BAJO baña la silueta entera. Con valores
     bajos en metal, el tinte de bando se comía el color de todas las piezas y
     el personaje entero se leía azul. El metal quiere el borde MÁS estrecho de
     todos, no el más ancho. */
  CV.MATERIALS = {
    SKIN:    { roughness: 0.64, metallic: 0.02, rimPower: 3.2, rim: 0.55 },
    CLOTH:   { roughness: 0.92, metallic: 0.00, rimPower: 2.6, rim: 0.75 },
    LEATHER: { roughness: 0.72, metallic: 0.05, rimPower: 3.0, rim: 0.60 },
    METAL:   { roughness: 0.38, metallic: 0.62, rimPower: 4.5, rim: 0.85 },
    WOOD:    { roughness: 0.78, metallic: 0.02, rimPower: 3.2, rim: 0.45 },
    MAGIC:   { roughness: 0.16, metallic: 0.10, rimPower: 2.0, rim: 1.00 }
  };

  /* Material por malla. Una tabla, no una condición esparcida por el código. */
  var MESH_MATERIAL = {
    skull: 'SKIN', jaw: 'SKIN', brow: 'SKIN', nose: 'SKIN', neck: 'SKIN', ear: 'SKIN',
    upperArm: 'SKIN', lowerArm: 'SKIN', elbow: 'SKIN', shoulderBall: 'SKIN', hand: 'SKIN',

    ribcage: 'CLOTH', abdomen: 'CLOTH', pelvis: 'CLOTH', thigh: 'CLOTH', shin: 'CLOTH',
    knee: 'CLOTH', tabard: 'CLOTH', robe: 'CLOTH', hood: 'CLOTH', cape: 'CLOTH',
    hairCap: 'CLOTH', hairTail: 'CLOTH',

    belt: 'LEATHER', skirtPanel: 'LEATHER', bracer: 'LEATHER', foot: 'LEATHER',
    bowString: 'LEATHER', strap: 'LEATHER', quiver: 'LEATHER', shoulderCap: 'LEATHER',
    sash: 'CLOTH', stole: 'CLOTH', robeBodice: 'CLOTH', quiverArrows: 'WOOD',

    pauldron: 'METAL', collar: 'METAL', chestPlate: 'METAL', buckle: 'METAL',
    thighGuard: 'METAL', kneeGuard: 'METAL', bootCuff: 'METAL', robeTrim: 'METAL',
    sword: 'METAL', shield: 'METAL',

    bow: 'WOOD', staff: 'WOOD', arrow: 'WOOD',

    eye: 'MAGIC', gem: 'MAGIC', orb: 'MAGIC'
  };
  CV.materialOf = function (mesh) {
    return CV.MATERIALS[MESH_MATERIAL[mesh] || 'CLOTH'];
  };

  var OUTFIT = {
    plate: {
      cloth: [0.150, 0.152, 0.190], metal: [0.335, 0.345, 0.395],
      trim: [0.86, 0.70, 0.30], leather: [0.135, 0.105, 0.085], wood: [0.26, 0.20, 0.16]
    },
    leather: {
      cloth: [0.215, 0.245, 0.150], metal: [0.290, 0.240, 0.165],
      trim: [0.66, 0.53, 0.28], leather: [0.185, 0.135, 0.090], wood: [0.30, 0.22, 0.14]
    },
    robe: {
      cloth: [0.205, 0.034, 0.052], metal: [0.275, 0.225, 0.170],
      trim: [0.90, 0.74, 0.34], leather: [0.155, 0.115, 0.095], wood: [0.28, 0.22, 0.18]
    }
  };

  /* =========================================================================
   * Estado de animación
   * ====================================================================== */
  /**
   * @param seed semilla visual estable por entidad. Determinista a propósito:
   *        el brief prohíbe Math.random() en cualquier cosa que altere lo que
   *        el jugador interpreta, y una pose desincronizada entre dos partidas
   *        con la misma semilla de mundo sería exactamente eso.
   */
  CV.createState = function (seed) {
    var n = 0;
    if (typeof seed === 'number') n = seed | 0;
    else if (seed) {   // los ids de entidad son cadenas: se resumen a entero
      var s = String(seed);
      for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) | 0;
    }
    return {
      // El controlador de locomoción se crea perezosamente en el primer update,
      // cuando ya se conoce la clase y por tanto su configuración.
      loco: null, cfg: null, seed: n,
      /* Intención de animación: la descripción NEUTRAL de qué está haciendo el
         personaje. Es lo que consumiría un backend con malla real. */
      intent: AI.create(),
      // Capa UPPER BODY: acciones de combate, reacción aditiva y CC.
      action: Act.createState(n),
      cast: 0, casting: false, castMovable: false,
      hurt: 0, downed: 0, deadTime: 0,
      // Mezcla de la pose de control: 0 = normal, 1 = pose de CC completa.
      ccBlend: 0, cc: null,
      // Compatibilidad de lectura para VFX, HUD y depuración.
      speed: 0, phase: 0
    };
  };

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

    // Capa UPPER BODY. Independiente de las piernas: por eso un arquero puede
    // disparar mientras strafea sin que ninguna de las dos capas se entere.
    Act.update(st.action, st.cfg, dt);

    // Espejos de lectura para VFX, HUD y depuración.
    st.speed = st.loco.moveSpeed;
    st.phase = st.loco.cycle * Math.PI * 2;

    if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt * 3.5);

    /* --- Control: la simulación decide QUÉ, esto sólo decide CÓMO se ve ---- */
    var cc = Act.ccPose(entity, 1);
    // Un control duro entra deprisa (el impacto se lee al instante) y sale más
    // despacio: levantarse tiene que costar algo. Mientras dura la salida se
    // conserva la última pose, o el personaje se enderezaría de golpe.
    if (cc) st.cc = cc;
    var target = cc ? 1 : 0;
    st.ccBlend += (target - st.ccBlend) * Math.min(1, dt * (target > st.ccBlend ? 11 : 5.5));
    if (st.ccBlend < 0.002) { st.ccBlend = 0; st.cc = null; }
    st.downed = st.ccBlend;
    st.ccTime = (st.ccTime || 0) + dt;

    if (entity.cast) {
      st.casting = true;
      var c = entity.cast;
      // El progreso lo dicta la simulación: si el cuerpo usara su propio reloj,
      // la barra de casteo y el personaje contarían cosas distintas.
      st.cast = Math.min(1, (world.time - c.startTime) / Math.max(c.duration, 1e-3));
      st.castMovable = !!c.movable;
    } else {
      st.casting = false;
      st.castMovable = false;
      st.cast += (0 - st.cast) * Math.min(1, dt * 9);
    }
    if (!entity.alive) st.deadTime += dt; else st.deadTime = 0;

    /* La INTENCIÓN se construye al final, cuando locomoción y acción ya han
       avanzado: describe el fotograma que se va a pintar, no el anterior. Un
       backend con malla con skinning leería sólo esto. */
    AI.build(st.intent, entity, world, st.loco, st.action);
    st.intent.crowdControlBlend = st.ccBlend;
  };

  /**
   * Dispara la acción de combate. `kind` es el ARQUETIPO, no el arma: la
   * elección de familia vive en render/anim/actions.js, que es quien conoce
   * las fases.
   */
  CV.triggerAttack = function (st, kind, isPower, castFamily) {
    if (!st.cfg) return;   // aún no ha corrido el primer update
    Act.trigger(st.action, Act.familyFor(kind || 'melee', isPower), st.cfg, isPower, castFamily);
  };

  /**
   * La simulación ha empezado un casteo. `castFamily` viene de
   * data/castFamilies.js: la presentación conoce siete categorías visuales, no
   * el catálogo de habilidades.
   */
  CV.beginCast = function (st, castFamily) {
    if (st.action) Act.beginCast(st.action, castFamily);
  };

  /**
   * Reacción al daño. ADITIVA: sacude el torso sin congelar las piernas.
   * `fromPos` es opcional; con él la sacudida es direccional.
   */
  CV.triggerHurt = function (st, entity, fromPos) {
    st.hurt = 1;
    if (!st.loco || !entity) return;
    Loco.applyHit(st.loco, entity, fromPos);
    Act.react(st.action, -st.loco.hitDir.z, -st.loco.hitDir.x);
  };

  /* --- Curvas ------------------------------------------------------------- */
  function smooth(x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }

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

    /* --- Capa de control -------------------------------------------------
     * Cada estado se lee distinto a veinte unidades: derribo en el suelo,
     * aturdimiento DE PIE y tambaleante, raíz clavada y tensa, silencio sólo en
     * cabeza y manos. Las reglas ya han decidido qué impide cada uno; aquí sólo
     * se decide cómo se ve. La mezcla evita que enderezarse sea un corte. */
    var ccW = st.ccBlend;
    var cc = st.cc;
    var ccPitch = 0, ccRoll = 0, ccLift = 0, ccKnee = 0, ccArm = 0, ccHead = 0;
    // Un cuerpo TENDIDO estira las piernas a lo largo del suelo. Si siguen
    // persiguiendo el punto donde estaban los pies de pie, el personaje se
    // pliega sobre sí mismo y el derribo parece un ovillo, no una caída.
    var ccProne = (cc && cc.rootPitch > 0.8) ? ccW : 0;
    if (cc && ccW > 0.001) {
      // El tambaleo del aturdimiento es un ciclo lento propio, no ruido.
      var sway = cc.sway ? Math.sin(st.ccTime * 4.3) * 0.09 * cc.sway : 0;
      ccPitch = cc.rootPitch * ccW;
      ccRoll = (sway + (cc.headTilt ? 0 : 0)) * ccW;
      ccLift = cc.rootLift * ccW;
      ccKnee = cc.kneeBend * ccW;
      ccArm = cc.armDrop * ccW;
      ccHead = cc.headTilt * ccW;
    }

    // La altura visible se ancla a la del cuerpo simulado: el modelo mide lo que
    // dice la simulación, y el rasgo racial sólo lo modula. Así el nameplate, la
    // cámara y las cápsulas de colisión no se despegan nunca del modelo.
    var lbScale = build.limbs;
    var hipRest = hipRestFor(lbScale);
    var modelHeight = hipRest + TORSO_ABOVE_HIP;
    var vScale = (entity.height / modelHeight) * build.height;
    var hScale = vScale * build.shoulders;

    var root = M.create();
    M.composeFull(root,
      { x: pos.x, y: pos.y + ccLift, z: pos.z },
      yaw, -ccPitch, ccRoll,
      { x: hScale, y: vScale, z: hScale });

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
      out.push({
        mesh: mesh, matrix: m, color: color || cloth, emissive: emissive || null,
        material: CV.materialOf(mesh)
      });
    }

    /* --- CAPA SUPERIOR ----------------------------------------------------
     * Se resuelve ANTES que el tronco porque la acción de combate contribuye
     * rotación de pecho —la cadena pecho → hombro → codo → arma es lo que hace
     * que un golpe parezca un acto físico— y flexión de rodillas al aterrizar
     * un golpe pesado. Las piernas siguen siendo asunto exclusivo de la
     * locomoción: por eso un arquero dispara mientras strafea. */
    var A = Act.upperBodyPose(st.action, cfg, arche, loadout, st.cast, st.casting, L.armSwing);
    // Un control duro deja caer los brazos y hunde las rodillas.
    if (ccArm > 0) {
      A.left.pitch += (0.15 - A.left.pitch) * ccArm;
      A.right.pitch += (0.15 - A.right.pitch) * ccArm;
      A.left.elbow += (0.25 - A.left.elbow) * ccArm;
      A.right.elbow += (0.25 - A.right.elbow) * ccArm;
      A.chestPitch *= (1 - ccArm);
      A.chestYaw *= (1 - ccArm);
      A.draw *= (1 - ccArm);
    }

    // Centro de masa: la pelvis se desplaza hacia la pierna que soporta el peso
    // y cae en el apoyo. Sin esto el personaje flota sobre sus piernas.
    var kneeSink = (A.kneeAbsorb || 0) + ccKnee * 0.18;
    var hipY = hipRest + L.bob + breath - kneeSink;
    var hipX = lc.hipShiftX;

    /* --- Cadera y tronco articulado -------------------------------------- */
    var hips = node(root, hipX, hipY, 0, 0, lc.hipYaw, L.hipRoll);
    draw(hips, 'pelvis', cloth);
    /* --- Cintura, según atuendo ------------------------------------------- */
    if (loadout.outfit === 'robe') {
      draw(node(hips, 0, -0.03, 0), 'sash', trim);
    } else {
      draw(node(hips, 0, -0.055, 0), 'belt', palette.leather);
      draw(node(hips, 0, -0.055, 0.150), 'buckle', trim);
    }

    var abdomen = node(hips, 0, 0.06, 0, -lc.torsoPitch * 0.45, lc.torsoYaw * 0.3, lc.torsoRoll * 0.4);
    draw(abdomen, 'abdomen', cloth);

    // El pecho asume parte del seguimiento del objetivo, la cabeza completa el
    // resto, y la acción de combate suma su propia torsión encima.
    var chest = node(abdomen, 0, 0.14, 0,
      -lc.torsoPitch * 0.55 + A.chestPitch,
      lc.torsoYaw * 0.5 + lc.headYaw * cfg.chestTrackRatio + A.chestYaw,
      lc.torsoRoll * 0.6 + (A.chestRoll || 0));
    draw(chest, 'ribcage', cloth);
    /* --- ATUENDO POR ARQUETIPO -------------------------------------------
     *
     * Aquí es donde un guerrero deja de ser un arquero pintado de otro color.
     * Antes los tres llevaban exactamente las mismas piezas —hombreras de
     * acero, peto, tabardo— y a veinte unidades eran el mismo muñeco. Cada
     * atuendo rompe la silueta en un sitio distinto:
     *
     *   plate     hombros anchos y macizos, peto, tabardo largo
     *   leather   hombros estrechos, correa cruzada, carcaj a la espalda
     *   robe      silueta acampanada, estola vertical, nada de metal
     *
     * El color de bando va en una pieza ESTRECHA, no en toda la ropa: si el
     * tinte lo baña todo, el atuendo deja de contar quién es el personaje.  */
    var teamCol = [team[0] * 0.62, team[1] * 0.62, team[2] * 0.62];
    if (loadout.outfit === 'plate') {
      draw(chest, 'collar', metal);
      draw(node(chest, 0, 0.12, 0.010), 'chestPlate', metal);
      draw(node(chest, 0, 0.02, 0.012), 'tabard', teamCol);
    } else if (loadout.outfit === 'leather') {
      // Correa del carcaj cruzada sobre el pecho: da lectura de asimetría, que
      // es justo lo que separa una silueta de explorador de una de soldado.
      draw(node(chest, 0.055, 0.20, 0.075, 0, 0, 0.42), 'strap', palette.leather);
      draw(node(chest, 0.030, 0.10, 0.020), 'tabard', teamCol);
      var quiverM = node(chest, -0.115, 0.24, -0.145, 0.30, 0, -0.34);
      draw(quiverM, 'quiver', palette.leather);
      draw(node(quiverM, 0, 0.02, 0), 'quiverArrows', [0.58, 0.47, 0.32]);
    } else {
      draw(node(chest, 0, -0.16, 0), 'robeBodice', cloth);
      draw(node(chest, 0, 0.24, 0.098), 'stole', teamCol);
    }

    /* --- Cabeza ----------------------------------------------------------- */
    var hs = build.head;
    draw(node(chest, 0, 0.30, 0, L.lean * 0.3, 0, 0, 1, build.neck, 1), 'neck', skin);
    // La cabeza contrarresta la inclinación del torso: la mirada se mantiene al
    // frente aunque el cuerpo se incline, como en cualquier ser vivo.
    var head = node(chest, 0, 0.40, 0.005,
      lc.torsoPitch * cfg.torsoCounterRate + lc.headPitch + ccHead * 0.5,
      lc.headYaw * (1 - cfg.chestTrackRatio) - lc.torsoYaw * 0.4,
      -lc.torsoRoll * 0.3 + ccHead, hs, hs, hs);
    draw(head, 'skull', skin);
    draw(head, 'jaw', skin);
    draw(head, 'brow', skin);
    draw(head, 'nose', skin);

    if (!loadout.hood) {
      draw(node(head, 0, 0.012, -0.005), 'hairCap', hair);
      draw(node(head, 0, 0.010, 0, 0.42, 0, 0), 'hairTail', hair);
    }

    var el = feat.earLength;
    draw(node(head, -0.100, 0.005, -0.02, feat.earPitch, -0.60, -feat.earFlare, el, el, el), 'ear', skin);
    draw(node(head, 0.100, 0.005, -0.02, feat.earPitch, 0.60, feat.earFlare, el, el, el), 'ear', skin);

    var eg = race.palette.eyeGlow;
    var eyeEm = feat.glowingEyes ? [eyeCol[0] * eg, eyeCol[1] * eg, eyeCol[2] * eg] : null;
    // Los ojos van justo bajo la ceja y por delante del plano de los pómulos:
    // es lo que hace que a distancia se sepa hacia dónde mira el personaje.
    draw(node(head, -0.052, 0.008, 0.104, 0, -0.18, 0), 'eye', eyeCol, eyeEm);
    draw(node(head, 0.052, 0.008, 0.104, 0, 0.18, 0), 'eye', eyeCol, eyeEm);

    if (loadout.hood) draw(node(head, 0, -0.01, -0.02, 0.10, 0, 0), 'hood', cloth);

    /* --- Piernas con rodilla y tobillo ------------------------------------ */
    var robed = loadout.outfit === 'robe';
    if (robed) {
      var swayR = lc.leanF * 0.3 + Math.sin(lc.cycle * Math.PI * 2) * 0.09 * lc.moveSpeed;
      var robeM = node(hips, 0, 0.06, 0, swayR, 0, lc.torsoRoll * 0.5);
      draw(robeM, 'robe', cloth);
      draw(robeM, 'robeTrim', trim);
    }
    {
      /* PIERNAS POR CINEMÁTICA INVERSA.
       *
       * El controlador ya decidió DÓNDE está cada pie en el mundo, y mientras
       * está apoyado ese punto no se mueve (foot locking). Aquí sólo se resuelve
       * qué ángulos de cadera y rodilla hacen falta para alcanzarlo. Es
       * exactamente el orden inverso al de antes —donde se elegían ángulos y el
       * pie caía donde cayera— y es la razón por la que ya no patina.
       */
      var lb = lbScale;
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

        var hipOrigin = { x: hipLocalX, y: hipY - HIP_SOCKET, z: 0 };
        var footTarget = { x: lx, y: leg.footPos.y + ANKLE_HEIGHT, z: lz };

        if (ccProne > 0) {
          // Objetivo "tendido": pierna extendida en la prolongación del cuerpo.
          // Como la raíz ya está girada hacia el suelo, extender hacia abajo en
          // espacio local ES tumbarse cuan largo es.
          var flatY = hipOrigin.y - (thighLen + shinLen) * 0.97;
          footTarget.x += (hipLocalX * 1.35 - footTarget.x) * ccProne;
          footTarget.y += (flatY - footTarget.y) * ccProne;
          footTarget.z += (0 - footTarget.z) * ccProne;
        }

        var ik = SK.solveTwoBoneIK(hipOrigin, footTarget, thighLen, shinLen, st._ik);

        var thighM = node(hips, hipLocalX - hipX, -HIP_SOCKET, 0, ik.pitch, 0, ik.roll, 1, lb, 1);
        var kneeM, ankleM, toe;
        if (robed) {
          /* Bajo la túnica no se ve la pierna, pero los PIES SÍ asoman, y por
             eso siguen resolviéndose por IK. Sin ellos el mago se desplaza como
             un cono deslizándose: no hay ni un fotograma que diga que camina. */
          kneeM = node(thighM, 0, -THIGH, 0, ik.bend, 0, 0);
          toe = (1 - leg.plantWeight) * 0.35;
          ankleM = node(kneeM, 0, -SHIN, 0, -ik.pitch - ik.bend + toe, 0, -ik.roll);
          draw(ankleM, 'foot', palette.leather);
          continue;
        }
        draw(thighM, 'thigh', cloth);
        // Faldón partido: cada mitad sigue a su muslo, así el paso lo abre en
        // vez de atravesarlo. Un faldón rígido delata la pieza como decorado.
        if (loadout.outfit === 'plate') {
          draw(node(thighM, 0, 0.015, 0, -ik.pitch * 0.45, 0, side * 0.06),
            'skirtPanel', palette.leather);
          draw(node(thighM, 0, -0.10, 0.012, 0, 0, 0), 'thighGuard', metal);
        }
        kneeM = node(thighM, 0, -THIGH, 0, ik.bend, 0, 0);
        draw(kneeM, 'knee', cloth);
        draw(kneeM, 'shin', cloth);
        if (loadout.outfit === 'plate') draw(node(kneeM, 0, -0.02, 0.028), 'kneeGuard', metal);
        // El tobillo cancela cadera y rodilla: el pie queda plano en el suelo
        // durante el apoyo y sólo se inclina en el vuelo.
        toe = (1 - leg.plantWeight) * 0.35;
        ankleM = node(kneeM, 0, -SHIN, 0, -ik.pitch - ik.bend + toe, 0, -ik.roll);
        draw(ankleM, 'foot', palette.leather);
        draw(node(ankleM, 0, 0.012, -0.03), 'bootCuff',
          loadout.outfit === 'plate' ? steel : palette.leather);
      }
    }

    if (loadout.cape) draw(node(chest, 0, 0.22, -0.13, 0.14 + lc.moveSpeed * 0.40, 0, 0), 'cape', trim);

    /* --- Brazos con codo -------------------------------------------------- */
    var arms = [{ x: -0.205, s: A.left, side: -1 }, { x: 0.205, s: A.right, side: 1 }];
    var hands = [null, null];
    for (var a = 0; a < 2; a++) {
      var q = arms[a];
      if (loadout.outfit === 'plate') {
        draw(node(chest, q.x * 1.10, 0.22, 0, 0, 0, q.side * 0.26), 'pauldron', metal);
      } else if (loadout.outfit === 'leather') {
        draw(node(chest, q.x * 1.04, 0.225, 0, 0, 0, q.side * 0.20), 'shoulderCap', palette.leather);
      }
      var upper = node(chest, q.x, 0.20, 0, q.s.pitch, q.s.yaw, q.s.roll);
      draw(upper, 'shoulderBall', skin);
      draw(upper, 'upperArm', skin);
      var elbowM = node(upper, 0, -UPPER_ARM, 0, q.s.elbow, 0, 0);
      draw(elbowM, 'elbow', skin);
      draw(elbowM, 'lowerArm', skin);
      if (loadout.outfit === 'plate') draw(elbowM, 'bracer', metal);
      else if (loadout.outfit === 'leather') draw(elbowM, 'bracer', palette.leather);
      hands[a] = node(elbowM, 0, -LOWER_ARM, 0, q.s.wrist || 0, 0, 0);
      draw(hands[a], 'hand', skin);
    }
    var handL = hands[0], handR = hands[1];

    /* --- Armas ------------------------------------------------------------ */
    var sc = loadout.scale;
    if (loadout.right === 'sword') {
      draw(node(handR, 0, -0.045, 0.015, A.weaponPitch, A.weaponYaw || 0, A.weaponRoll, sc, sc, sc), 'sword', steel);

    } else if (loadout.right === 'bow') {
      // Al soltar, el arco vibra un instante: sin ese retroceso el disparo no
      // tiene consecuencia física, sólo desaparece una flecha.
      var shake = A.bowShake || 0;
      var bowM = node(handL, 0, -0.05, 0.03,
        A.bowPitch + Math.sin(st.action.idleNoise * 47) * shake,
        A.bowYaw + Math.cos(st.action.idleNoise * 61) * shake, 0, sc, sc, sc);
      draw(bowM, 'bow', palette.wood);
      draw(node(bowM, 0, 0, -0.015 - A.draw * 0.24), 'bowString', [0.62, 0.60, 0.54]);
      if (A.draw > 0.05) {
        draw(node(bowM, 0, 0, -0.28 - A.draw * 0.18, Math.PI / 2, 0, 0), 'arrow', [0.60, 0.48, 0.32]);
      }

    } else if (loadout.right === 'staff') {
      var staffM = node(handR, 0, -0.045, 0.01, A.weaponPitch, A.weaponYaw || 0, A.weaponRoll, sc, sc, sc);
      draw(staffM, 'staff', palette.wood);
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
      leather: outfit.leather,
      wood: outfit.wood,
      trim: outfit.trim,
      accent: mix(race.palette.eye, [1, 1, 1], 0.25),
      team: teamTint
    };
  };

  Arena.Render.CharacterVisual = CV;
});
