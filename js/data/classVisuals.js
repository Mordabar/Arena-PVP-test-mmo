/* =============================================================================
 * data/classVisuals.js — Identidad visual de las seis clases, como DATOS.
 *
 * LA PREGUNTA QUE ESTE FICHERO TIENE QUE APROBAR
 *
 *   Si las seis clases fueran completamente grises y no mostraran el nombre,
 *   ¿se distinguirían por la silueta desde la cámara normal del MMO?
 *
 * Tres arquetipos (melee / arquero / caster) NO bastan. Antes de este pase los
 * seis personajes eran tres parejas de gemelos: `devastador ≈ guardian` con un
 * 1.2 % de diferencia de masa, `centinela ≈ rastreador` con un 0.3 %, y
 * `devastador ≈ rastreador` con un 4.5 % cruzando arquetipos. Estaba medido, no
 * intuido, y por eso no se dio por bueno.
 *
 * CÓMO SE ARREGLA SIN DEUDA
 *
 * No con seis condiciones en el renderer. Cada clase declara AQUÍ un perfil:
 * proporciones, peso de armadura, hombros, torso, cinturón, faldón, capa,
 * tocado, arma principal, arma secundaria, accesorios y paleta. La geometría la
 * fabrica `render/equipment.js` a partir de estos números, y
 * `render/characterVisual.js` sólo coloca lo que aquí se declara. Añadir una
 * séptima clase es añadir una entrada, no tocar el renderer.
 *
 * EL EJE DE LECTURA DE CADA CLASE — lo que la silueta tiene que decir
 *
 *   devastador   V ofensiva      hombros anchos y ANGULOSOS, espadón dominante,
 *                                faldón partido, asimetría en el hombro de arma
 *   guardián     bloque          escudo torre, hombreras REDONDAS enormes,
 *                                faldar completo, más bajo y más ancho
 *   centinela    línea vertical  arco largo, carcaj alto a la espalda, faldones
 *                                largos y estrechos, botas altas, poco volumen
 *   rastreador   contorno roto   arco compacto, capucha y capa corta, bolsas,
 *                                trampas, dagas, hombrera de UN solo lado
 *   arcanista    aguja           báculo altísimo con cristal, sombrero de pico,
 *                                mantel en punta, hombros estrechos
 *   vinculador   círculo         báculo con aro, capelina circular, túnica
 *                                abierta, talismanes, hombros suaves
 *
 * REGLA DE PROPORCIONES. `build` son multiplicadores de CLASE que se componen
 * con los de la RAZA mediante `Arena.Data.composeBuild`, y el resultado se acota
 * a `BUILD_LIMITS`. La altura de simulación (`entity.height`), la cápsula, el
 * alcance y el nameplate NO cambian: la variación es de lectura, nunca ventaja.
 * ========================================================================== */
Arena.define('data/classVisuals', ['data/races', 'data/animConfig'], function (Arena) {
  'use strict';

  /* =========================================================================
   * PALETAS
   *
   * El color ayuda pero NO puede ser el único separador: el gate se pasa en
   * gris. Aun así dos clases del mismo arquetipo llevan familias cromáticas
   * opuestas, porque a distancia de duelo el color es lo primero que llega.
   * ====================================================================== */
  var PALETTES = {
    /* Devastador: acero oscuro y carmesí. Agresivo, poco reflectante. */
    vanguard: {
      cloth: [0.115, 0.082, 0.092], metal: [0.360, 0.375, 0.405],
      trim: [0.735, 0.205, 0.155], leather: [0.140, 0.100, 0.082],
      wood: [0.260, 0.190, 0.140]
    },
    /* Guardián: acero claro, azul heráldico y latón. Institucional. */
    bulwark: {
      cloth: [0.082, 0.135, 0.220], metal: [0.560, 0.590, 0.630],
      trim: [0.870, 0.685, 0.300], leather: [0.170, 0.125, 0.085],
      wood: [0.300, 0.220, 0.150]
    },
    /* Centinela: verde pizarra y hueso. Frío, limpio, de francotirador. */
    marksman: {
      cloth: [0.130, 0.205, 0.168], metal: [0.470, 0.462, 0.420],
      trim: [0.865, 0.835, 0.720], leather: [0.220, 0.155, 0.100],
      wood: [0.405, 0.300, 0.170]
    },
    /* Rastreador: musgo oscuro, latón y sangre seca. Sucio, de emboscada. */
    stalker: {
      cloth: [0.100, 0.132, 0.092], metal: [0.385, 0.305, 0.190],
      trim: [0.575, 0.245, 0.190], leather: [0.190, 0.125, 0.075],
      wood: [0.255, 0.180, 0.110]
    },
    /* Arcanista: índigo profundo y oro. Contraste alto con sus propios VFX. */
    arcane: {
      cloth: [0.082, 0.092, 0.268], metal: [0.400, 0.312, 0.178],
      trim: [0.900, 0.700, 0.280], leather: [0.160, 0.115, 0.090],
      wood: [0.240, 0.175, 0.130]
    },
    /* Vinculador: marfil sabio, cobre y verdemar. Cálido y abierto. */
    warden: {
      cloth: [0.242, 0.252, 0.222], metal: [0.455, 0.330, 0.225],
      trim: [0.420, 0.780, 0.720], leather: [0.205, 0.160, 0.120],
      wood: [0.360, 0.300, 0.200]
    }
  };

  /* =========================================================================
   * BIBLIOTECA DE EQUIPO
   *
   * `nombreDeMalla → {factory, mat, ...parámetros}`. `render/equipment.js` la
   * convierte en geometría en el arranque; `mat` dice qué material lógico usa
   * la pieza para que el renderer no tenga que adivinarlo.
   *
   * Un nombre declarado aquí y no usado por ninguna clase es geometría muerta
   * subida a GPU: la prueba de contrato lo detecta.
   * ====================================================================== */
  var EQUIPMENT = {

    /* --- DEVASTADOR ------------------------------------------------------ */
    vanguardPauldron: {
      factory: 'pauldron', mat: 'METAL',
      rx: 0.128, ry: 0.084, rz: 0.114, crest: true,
      plates: 2, plateGap: 0.056, plateH: 0.038, plateShrink: 0.13,
      spikes: [{ x: 0.052, y: 0.040, z: -0.018, r: 0.042, len: 0.21, flat: 0.7 }]
    },
    vanguardSpaulderBlade: {
      factory: 'pauldron', mat: 'METAL',
      rx: 0.070, ry: 0.038, rz: 0.062,
      spikes: [{ x: 0, y: 0.02, z: -0.03, r: 0.036, len: 0.24, flat: 0.55 }]
    },
    vanguardCuirass: {
      factory: 'cuirass', mat: 'METAL',
      rx: 0.188, ry: 0.152, rz: 0.126, ridge: true, ridgeW: 0.060, ridgeH: 1.70,
      vTaper: 0.40, rivets: 4
    },
    vanguardCollar: { factory: 'gorget', mat: 'METAL', r: 0.148, h: 0.052, depth: 0.86 },
    vanguardBelt: {
      factory: 'belt', mat: 'LEATHER', r: 0.202, h: 0.086, depth: 0.82,
      buckle: true, buckleW: 0.092, buckleH: 0.086
    },
    vanguardTasset: {
      factory: 'tasset', mat: 'LEATHER', w: 0.152, len: 0.30, d: 0.056,
      plates: 2, plateH: 0.042, point: 0.09, z: 0.052
    },
    vanguardThighPlate: { factory: 'legPlate', mat: 'METAL', rx: 0.062, ry: 0.082, rz: 0.056, ridge: true },
    vanguardKneePlate: { factory: 'legPlate', mat: 'METAL', rx: 0.052, ry: 0.046, rz: 0.052, spike: 0.075, spikeR: 0.026 },
    vanguardHelm: {
      factory: 'helm', mat: 'METAL', r: 0.150, ry: 0.128, depth: 1.00,
      browH: 0.044, crest: 0.095, crestW: 0.034, horns: 0.17, hornR: 0.028
    },
    vanguardBoot: { factory: 'bootCuff', mat: 'METAL', r: 0.104, h: 0.090, taper: 1.16, fold: true },
    greatsword: {
      factory: 'sword', mat: 'METAL',
      blade: 0.86, bladeW: 0.104, bladeT: 0.030, tip: 0.17,
      guard: 0.285, guardH: 0.050, guardD: 0.066, grip: 0.240, gripW: 0.052,
      pommel: 0.046, fuller: true, ricasso: 0.14, quillonDrop: 0.10, quillonW: 0.034
    },

    /* --- GUARDIÁN -------------------------------------------------------- */
    bulwarkPauldron: {
      factory: 'pauldron', mat: 'METAL',
      rx: 0.150, ry: 0.115, rz: 0.136,
      plates: 2, plateStart: 0.80, plateGap: 0.062, plateH: 0.040, plateShrink: 0.16,
      studs: 5, studR: 0.017
    },
    bulwarkCuirass: {
      factory: 'cuirass', mat: 'METAL',
      rx: 0.208, ry: 0.168, rz: 0.142, ridge: true, ridgeW: 0.076, ridgeH: 1.72,
      rivets: 5, rivetR: 0.019
    },
    bulwarkGorget: {
      factory: 'gorget', mat: 'METAL', r: 0.178, h: 0.092, depth: 0.88,
      wings: true, wingH: 0.050, wingD: 0.135
    },
    bulwarkFauld: {
      factory: 'fauld', mat: 'METAL', r: 0.228, len: 0.26, plates: 10,
      plateW: 0.106, plateD: 0.048, depth: 0.86, beltH: 0.062, hem: 1.05
    },
    bulwarkThighPlate: { factory: 'legPlate', mat: 'METAL', rx: 0.072, ry: 0.092, rz: 0.066, ridge: true },
    bulwarkKneePlate: { factory: 'legPlate', mat: 'METAL', rx: 0.062, ry: 0.056, rz: 0.062, ridge: true },
    bulwarkHelm: {
      factory: 'helm', mat: 'METAL', r: 0.158, ry: 0.136, depth: 1.04,
      browH: 0.050, nasal: 0.135, nasalW: 0.038, cheeks: 0.135
    },
    bulwarkBoot: { factory: 'bootCuff', mat: 'METAL', r: 0.116, h: 0.102, taper: 1.20, fold: true, foldH: 0.050 },
    towerShield: {
      factory: 'shield', mat: 'METAL', shape: 'tower',
      w: 0.520, h: 0.980, d: 0.055, bands: 3, bandH: 0.056, rimH: 0.046,
      boss: 0.086, bossZ: 1.6, studs: 6, studR: 0.021
    },
    bulwarkSword: {
      factory: 'sword', mat: 'METAL',
      blade: 0.455, bladeW: 0.086, bladeT: 0.026, tip: 0.115,
      guard: 0.178, guardH: 0.042, grip: 0.140, gripW: 0.046, pommel: 0.040
    },

    /* --- CENTINELA ------------------------------------------------------- */
    marksmanCap: { factory: 'shoulderCap', mat: 'LEATHER', rx: 0.078, ry: 0.038, rz: 0.074, seam: true },
    marksmanQuiver: { factory: 'quiver', mat: 'LEATHER', r: 0.062, len: 0.46, taper: 0.90, bands: 2 },
    marksmanArrows: { factory: 'arrows', mat: 'WOOD', count: 5, len: 0.26, spread: 0.030, r: 0.010, fletch: true },
    marksmanCoat: { factory: 'coatPanel', mat: 'CLOTH', w: 0.108, len: 0.42, d: 0.030, taper: 0.58, trim: true, trimH: 0.028 },
    marksmanCoatBack: { factory: 'coatPanel', mat: 'CLOTH', w: 0.155, len: 0.54, d: 0.032, taper: 0.52, trim: true },
    marksmanBelt: { factory: 'belt', mat: 'LEATHER', r: 0.176, h: 0.050, depth: 0.78, rings: 3, ringR: 0.019 },
    marksmanBoot: { factory: 'bootCuff', mat: 'LEATHER', r: 0.092, h: 0.068, taper: 1.05, tall: 0.34 },
    marksmanCirclet: { factory: 'circlet', mat: 'METAL', r: 0.142, h: 0.028, depth: 0.94, points: 0 },
    marksmanBracer: { factory: 'strap', mat: 'LEATHER', w: 0.115, len: 0.20, t: 0.100, buckles: 2 },
    longbow: {
      factory: 'bow', mat: 'WOOD',
      limb: 0.680, r: 0.0165, taper: 0.40, gripHalf: 0.105, gripLen: 0.210,
      gripW: 0.030, gripD: 0.042, recurve: 0.100, recurveZ: 0.020, riser: 0.36, sight: 0.09, sightY: 0.20
    },
    longbowString: { factory: 'strap', mat: 'LEATHER', w: 0.008, len: 1.56, t: 0.008 },

    /* --- RASTREADOR ------------------------------------------------------ */
    stalkerCap: {
      factory: 'shoulderCap', mat: 'LEATHER',
      rx: 0.102, ry: 0.054, rz: 0.094, seam: true, fringe: 4, fringeLen: 0.088
    },
    stalkerMantle: {
      factory: 'cloak', mat: 'CLOTH', w: 0.400, len: 0.340, d: 0.034,
      flare: 1.30, shoulderRoll: 1.05, clasp: 0.034
    },
    stalkerBandolier: {
      factory: 'strap', mat: 'LEATHER', w: 0.056, len: 0.460, t: 0.030,
      buckles: 2, vials: 3, vialR: 0.020, vialH: 0.075
    },
    stalkerQuiver: { factory: 'quiver', mat: 'LEATHER', r: 0.052, len: 0.26, taper: 0.80, bands: 1 },
    stalkerArrows: { factory: 'arrows', mat: 'WOOD', count: 3, len: 0.155, spread: 0.024, fletch: true, fletchH: 0.045 },
    stalkerBelt: { factory: 'belt', mat: 'LEATHER', r: 0.186, h: 0.062, depth: 0.80, buckle: true, rings: 4 },
    stalkerPouch: { factory: 'pouch', mat: 'LEATHER', w: 0.104, h: 0.124, d: 0.056, flap: true },
    stalkerPouchSmall: { factory: 'pouch', mat: 'LEATHER', w: 0.072, h: 0.082, d: 0.048, round: true },
    stalkerTrap: { factory: 'disc', mat: 'METAL', r: 0.072, t: 0.022, seg: 12, teeth: 8, tooth: 0.040, toothR: 0.014, hub: 0.026 },
    stalkerHood: { factory: 'hood', mat: 'CLOTH', r: 0.172, peak: 0.250, brim: 0.110, brimH: 0.032, drape: 0.240 },
    stalkerDagger: { factory: 'dagger', mat: 'METAL', blade: 0.300, bladeW: 0.040, guard: 0.112, grip: 0.112 },
    stalkerSheath: { factory: 'pouch', mat: 'LEATHER', w: 0.062, h: 0.240, d: 0.048, flap: false },
    stalkerBoot: { factory: 'bootCuff', mat: 'LEATHER', r: 0.098, h: 0.082, taper: 1.14, fold: true },
    recurveBow: {
      factory: 'bow', mat: 'WOOD',
      limb: 0.340, r: 0.021, taper: 0.45, gripHalf: 0.056, gripLen: 0.140,
      gripW: 0.036, gripD: 0.050, recurve: 0.115, recurveZ: 0.048
    },
    recurveString: { factory: 'strap', mat: 'LEATHER', w: 0.008, len: 0.960, t: 0.008 },

    /* --- ARCANISTA ------------------------------------------------------- */
    arcaneMantle: {
      factory: 'mantle', mat: 'CLOTH',
      rx: 0.178, ry: 0.052, rz: 0.128, plateH: 0.034,
      points: 2, pointR: 0.046, pointLen: 0.260, pointSpread: 0.92, pointZ: -0.020
    },
    arcaneShard: { factory: 'gem', mat: 'MAGIC', r: 0.048, k: 1.9, facets: 5 },
    /* Falda estrecha y larga. La campana ancha la lleva el Vinculador: si los
       dos casters acampanan igual, sus contornos coinciden banda a banda y el
       gate de silueta se cae por ahí (medido: 7 % de diferencia). */
    arcaneRobe: { factory: 'robe', mat: 'CLOTH', rTop: 0.120, rBot: 0.188, len: 1.200, hem: true, hemH: 0.040, seg: 16 },
    arcaneSash: { factory: 'sash', mat: 'CLOTH', r: 0.168, h: 0.092, depth: 0.86, knot: 0.050, knotX: 0.125, tail: 0.440, tailW: 0.080 },
    arcaneHat: {
      factory: 'wideHat', mat: 'CLOTH',
      brimR: 0.345, brimH: 0.036, brimTaper: 0.94, brimDepth: 0.86,
      crownR: 0.190, crownH: 0.440, crownY: 0.030,
      tip: 0.220, tipR: 0.098, tipX: 0.058, tipYK: 0.90, tipZ: -0.028,
      band: true, bandH: 0.044, bandY: 0.058, bandK: 1.10
    },
    arcaneStaff: {
      factory: 'staff', mat: 'WOOD',
      shaft: 1.620, r: 0.028, taper: 0.86, top: 0.950, crown: 'crystal',
      crownR: 0.112, prongs: 2, prong: 0.220, prongR: 0.040, prongSpread: 0.102,
      wrap: 2, ferrule: 0.090
    },
    arcaneCuff: { factory: 'strap', mat: 'CLOTH', w: 0.128, len: 0.150, t: 0.120 },

    /* --- VINCULADOR ------------------------------------------------------ */
    wardenCapelet: {
      factory: 'capelet', mat: 'CLOTH',
      r: 0.132, len: 0.300, flare: 2.55, depth: 0.94, hem: 1.04, hemH: 0.034,
      collar: true, collarR: 0.142, collarH: 0.078, seg: 18
    },
    wardenPendant: { factory: 'pendant', mat: 'METAL', r: 0.086, thick: 0.024, inner: 0.55, seg: 14, chain: 0.160 },
    /* Túnica corta y muy abierta: el dobladillo queda por encima del tobillo y
       se ve el pie completo, al revés que la del Arcanista, que barre el suelo.
       Dos casters, dos faldas opuestas. */
    wardenRobe: {
      factory: 'robe', mat: 'CLOTH', rTop: 0.168, rBot: 0.288, len: 1.010,
      hem: true, hemH: 0.048, split: 0.760, splitW: 0.142, splitX: 0.148, seg: 18
    },
    wardenSash: { factory: 'sash', mat: 'CLOTH', r: 0.206, h: 0.076, depth: 0.88, knot: 0.050, knotX: 0.140, tail: 0.260, tailW: 0.078 },
    wardenTalisman: { factory: 'disc', mat: 'METAL', r: 0.055, t: 0.016, seg: 12, hub: 0.020 },
    /* Diadema, no cuernos. Con las puntas largas y separadas el Vinculador se
       leía agresivo desde la cámara de juego, justo lo contrario de lo que la
       clase tiene que comunicar. */
    wardenCirclet: { factory: 'circlet', mat: 'METAL', r: 0.150, h: 0.038, depth: 0.94, points: 5, pointR: 0.014, pointLen: 0.032 },
    wardenStaff: {
      factory: 'staff', mat: 'WOOD',
      shaft: 1.300, r: 0.024, taper: 0.90, top: 0.800, crown: 'ring',
      ringR: 0.155, ringSeg: 16, ringT: 0.026, ringY: 0.100,
      beads: 6, beadR: 0.026, ferrule: 0.080
    },
    wardenOrb: { factory: 'orb', mat: 'MAGIC', r: 0.112, cage: 3, cageT: 0.016 },
    wardenCuff: { factory: 'strap', mat: 'CLOTH', w: 0.150, len: 0.120, t: 0.140 },
    /* Manga acampanada: cuelga del codo y ensancha la silueta a media altura,
       justo donde el Arcanista es más estrecho. */
    wardenSleeve: {
      factory: 'capelet', mat: 'CLOTH',
      r: 0.072, len: 0.300, flare: 2.35, depth: 1.0, hem: 1.06, hemH: 0.028, seg: 12
    }
  };

  /* =========================================================================
   * PERFILES DE CLASE
   *
   * `attach` agrupa las piezas por SOCKET. Los sockets terminados en `Pair` se
   * emiten dos veces, una por lado, con `x`, `yaw` y `roll` invertidos: la
   * entrada se escribe siempre para el lado DERECHO. Una entrada con `side` se
   * emite sólo en ese lado, y ahí está la asimetría que da carácter.
   *
   * Campos de una pieza:
   *   mesh          nombre en EQUIPMENT (o una malla de cuerpo)
   *   pos [x,y,z]   desplazamiento local respecto al socket
   *   rot [p,y,r]   pitch, yaw, roll locales
   *   scale         número o [x,y,z]
   *   color         clave de paleta: cloth metal steel leather wood trim
   *                 team teamDark accent skin hair
   *   side          −1 izquierda · 1 derecha · ausente = ambos
   *   counterPitch  compensa el ángulo del hueso padre (faldones sobre muslos)
   *   glow          multiplicador de emisión sobre `accent`
   * ====================================================================== */
  var CLASS_VISUAL = {

    /* =====================================================================
     * DEVASTADOR — «voy a entrar y hacer daño»
     *
     * V ofensiva: hombros anchos y angulosos, cintura estrecha, espadón que
     * cruza la silueta en diagonal. Menos protección visible que el Guardián a
     * propósito: dos faldones sueltos en vez de faldar completo, gola abierta
     * en vez de cerrada, y una hoja larga en lugar de un escudo.
     * ================================================================== */
    devastador: {
      id: 'devastador',
      reads: 'V ofensiva · espadón dominante · hombros angulosos',
      armorWeight: 'heavy',
      palette: 'vanguard',
      build: { height: 1.00, shoulders: 1.17, girth: 0.98, limbs: 0.99, neck: 0.90 },
      legs: 'bare',
      hair: true,
      right: { kind: 'sword', mesh: 'greatsword', scale: 1.06, color: 'steel' },
      left: null,
      attach: {
        chest: [
          { mesh: 'vanguardCollar', pos: [0, 0.298, 0], color: 'metal' },
          { mesh: 'vanguardCuirass', pos: [0, 0.118, 0.012], color: 'metal' },
          { mesh: 'chestBadge', pos: [0, 0.188, 0.140], scale: 0.90, color: 'trim' },
          { mesh: 'tabard', pos: [0, 0.020, 0.014], color: 'teamDark' }
        ],
        chestPair: [
          { mesh: 'vanguardPauldron', pos: [0.238, 0.226, 0], rot: [0, 0, 0.28], color: 'metal' },
          // Asimetría: sólo el hombro del arma lleva la hoja saliente.
          { mesh: 'vanguardSpaulderBlade', pos: [0.252, 0.300, -0.020], rot: [0, 0, 0.55], side: 1, color: 'trim' }
        ],
        hips: [
          { mesh: 'vanguardBelt', pos: [0, -0.040, 0], color: 'leather' }
        ],
        thighPair: [
          { mesh: 'vanguardTasset', pos: [0, 0.018, 0], rot: [0, 0, 0.06], counterPitch: 0.45, color: 'leather' },
          { mesh: 'vanguardThighPlate', pos: [0, -0.100, 0.016], color: 'metal' }
        ],
        kneePair: [
          { mesh: 'vanguardKneePlate', pos: [0, -0.020, 0.030], color: 'metal' }
        ],
        anklePair: [
          { mesh: 'vanguardBoot', pos: [0, 0.014, -0.030], color: 'steel' }
        ],
        elbowPair: [
          { mesh: 'bracer', color: 'metal' }
        ],
        head: [
          { mesh: 'vanguardHelm', pos: [0, 0.055, -0.010], color: 'metal' }
        ]
      }
    },

    /* =====================================================================
     * GUARDIÁN — «soy una muralla»
     *
     * Bloque. Más bajo y más ancho que el Devastador, con las hombreras
     * REDONDAS (no angulosas) y simétricas, gola cerrada, faldar completo
     * alrededor de toda la cadera y un escudo torre que por sí solo ocupa media
     * silueta. El arma se ve deliberadamente pequeña al lado del escudo.
     * ================================================================== */
    guardian: {
      id: 'guardian',
      reads: 'bloque · escudo torre · hombreras redondas · centro de masa bajo',
      armorWeight: 'plate',
      palette: 'bulwark',
      build: { height: 0.95, shoulders: 1.31, girth: 1.20, limbs: 0.95, neck: 0.80 },
      legs: 'bare',
      hair: false,
      right: { kind: 'sword', mesh: 'bulwarkSword', scale: 0.94, color: 'steel' },
      /* El escudo se sujeta con la cara PERPENDICULAR al frente del personaje.
         Con la inclinación heredada del escudo redondo (−1.45) la plancha
         quedaba casi horizontal: de frente se veía el canto, y un escudo torre
         visto de canto es un palo. Medido, no supuesto: la anchura de las
         bandas centrales pasa de 0.92 a 1.4. */
      left: { kind: 'shield', mesh: 'towerShield', pos: [0.02, 0.16, 0.19], rot: [-0.38, 0, -0.07], color: 'teamDark' },
      attach: {
        chest: [
          { mesh: 'bulwarkGorget', pos: [0, 0.292, 0], color: 'metal' },
          { mesh: 'bulwarkCuirass', pos: [0, 0.108, 0.012], color: 'metal' },
          { mesh: 'chestBadge', pos: [0, 0.182, 0.152], scale: 1.05, color: 'trim' },
          { mesh: 'tabard', pos: [0, 0.020, 0.014], scale: [1.20, 1.0, 1.0], color: 'teamDark' }
        ],
        chestPair: [
          { mesh: 'bulwarkPauldron', pos: [0.238, 0.262, 0], rot: [0, 0, 0.38], color: 'metal' }
        ],
        hips: [
          { mesh: 'bulwarkFauld', pos: [0, -0.028, 0], color: 'metal' }
        ],
        thighPair: [
          { mesh: 'bulwarkThighPlate', pos: [0, -0.110, 0.018], color: 'metal' }
        ],
        kneePair: [
          { mesh: 'bulwarkKneePlate', pos: [0, -0.020, 0.032], color: 'metal' }
        ],
        anklePair: [
          { mesh: 'bulwarkBoot', pos: [0, 0.014, -0.030], color: 'steel' }
        ],
        elbowPair: [
          { mesh: 'bracer', scale: 1.15, color: 'metal' }
        ],
        head: [
          { mesh: 'bulwarkHelm', pos: [0, 0.048, -0.012], color: 'metal' }
        ]
      }
    },

    /* =====================================================================
     * CENTINELA — «precisión y distancia»
     *
     * Todo son líneas verticales: arco largo casi de su altura, carcaj alto y
     * recto a la espalda, faldones de gabán estrechos y largos, botas altas.
     * Volumen lateral mínimo —una cazoleta de cuero por hombro y nada más—
     * para que la silueta sea una columna, no una cruz.
     * ================================================================== */
    centinela: {
      id: 'centinela',
      reads: 'columna vertical · arco largo · carcaj alto · poco volumen lateral',
      armorWeight: 'light',
      palette: 'marksman',
      build: { height: 1.06, shoulders: 0.95, girth: 0.86, limbs: 1.05, neck: 1.06 },
      legs: 'bare',
      hair: true,
      right: { kind: 'bow', mesh: 'longbow', string: 'longbowString', scale: 1.06, color: 'wood', rot: [0.05, -0.42, 0] },
      left: null,
      attach: {
        chest: [
          { mesh: 'marksmanQuiver', pos: [-0.145, 0.215, -0.150], rot: [0.16, 0, -0.44], color: 'leather' },
          { mesh: 'marksmanArrows', pos: [-0.255, 0.410, -0.178], rot: [0.16, 0, -0.44], color: 'wood' },
          { mesh: 'strap', pos: [0.050, 0.200, 0.078], rot: [0, 0, 0.40], color: 'leather' },
          { mesh: 'marksmanCoatBack', pos: [0, -0.030, -0.115], color: 'cloth' },
          { mesh: 'tabard', pos: [0.028, 0.100, 0.022], color: 'teamDark' }
        ],
        chestPair: [
          { mesh: 'marksmanCap', pos: [0.212, 0.228, 0], rot: [0, 0, 0.18], color: 'leather' }
        ],
        hips: [
          { mesh: 'marksmanBelt', pos: [0, -0.048, 0], color: 'leather' },
          { mesh: 'marksmanCoat', pos: [-0.132, -0.020, 0.098], color: 'cloth' },
          { mesh: 'marksmanCoat', pos: [0.132, -0.020, 0.098], color: 'cloth' }
        ],
        anklePair: [
          { mesh: 'marksmanBoot', pos: [0, 0.020, -0.026], color: 'leather' }
        ],
        elbowPair: [
          { mesh: 'marksmanBracer', pos: [0, -0.230, 0], color: 'leather' }
        ],
        head: [
          { mesh: 'marksmanCirclet', pos: [0, 0.070, -0.008], color: 'metal' }
        ]
      }
    },

    /* =====================================================================
     * RASTREADOR — «cazador · táctico · emboscada»
     *
     * Lo contrario del Centinela: contorno ROTO. Capucha calada, capa corta
     * sobre un solo hombro, bolsas de distintos tamaños, dos trampas colgando,
     * dagas a la cintura, carcaj pequeño a la cadera en vez de a la espalda y
     * un arco compacto. Nada está centrado y nada se repite simétricamente.
     * ================================================================== */
    rastreador: {
      id: 'rastreador',
      reads: 'contorno roto · capucha y capa corta · bolsas, trampas y dagas',
      armorWeight: 'light',
      palette: 'stalker',
      build: { height: 0.96, shoulders: 1.02, girth: 1.02, limbs: 0.97, neck: 0.95 },
      legs: 'bare',
      hair: false,
      right: { kind: 'bow', mesh: 'recurveBow', string: 'recurveString', scale: 0.95, color: 'wood', rot: [0.10, -0.30, 0.16] },
      left: null,
      attach: {
        chest: [
          { mesh: 'stalkerMantle', pos: [0, 0.245, -0.100], rot: [0.16, 0, 0], color: 'trim' },
          { mesh: 'stalkerBandolier', pos: [0.048, 0.190, 0.082], rot: [0, 0, 0.44], color: 'leather' },
          { mesh: 'tabard', pos: [-0.040, 0.090, 0.020], scale: [0.8, 0.85, 1], color: 'teamDark' }
        ],
        chestPair: [
          // Una sola hombrera: la asimetría es el rasgo, no un descuido.
          { mesh: 'stalkerCap', pos: [0.222, 0.226, 0], rot: [0, 0, 0.22], side: -1, color: 'leather' },
          { mesh: 'stalkerPouchSmall', pos: [0.206, 0.196, -0.052], rot: [0, 0, 0.30], side: 1, color: 'leather' }
        ],
        hips: [
          { mesh: 'stalkerBelt', pos: [0, -0.046, 0], color: 'leather' },
          { mesh: 'stalkerPouch', pos: [0.236, -0.012, 0.104], rot: [0, 0.16, 0], color: 'leather' },
          { mesh: 'stalkerPouchSmall', pos: [-0.198, -0.030, 0.128], rot: [0, -0.30, 0], color: 'leather' },
          { mesh: 'stalkerQuiver', pos: [0.196, -0.020, -0.118], rot: [0.42, 0, -0.62], color: 'leather' },
          { mesh: 'stalkerArrows', pos: [0.238, 0.062, -0.170], rot: [0.42, 0, -0.62], color: 'wood' },
          { mesh: 'stalkerTrap', pos: [-0.196, -0.096, 0.010], rot: [1.5708, 0, 0.20], color: 'metal' },
          { mesh: 'stalkerTrap', pos: [0.152, -0.116, -0.132], rot: [1.5708, 0, -0.16], scale: 0.86, color: 'metal' },
          { mesh: 'stalkerDagger', pos: [-0.208, 0.010, 0.118], rot: [3.1416, 0.10, -0.18], scale: 0.84, color: 'steel' },
          { mesh: 'stalkerDagger', pos: [0.208, 0.010, 0.118], rot: [3.1416, -0.10, 0.18], scale: 0.84, color: 'steel' }
        ],
        thighPair: [
          { mesh: 'stalkerSheath', pos: [0.052, -0.150, -0.020], rot: [0, 0, 0.10], side: 1, color: 'leather' }
        ],
        anklePair: [
          { mesh: 'stalkerBoot', pos: [0, 0.014, -0.028], color: 'leather' }
        ],
        elbowPair: [
          { mesh: 'bracer', color: 'leather' }
        ],
        head: [
          { mesh: 'stalkerHood', pos: [0, -0.010, -0.020], rot: [0.10, 0, 0], color: 'cloth' }
        ]
      }
    },

    /* =====================================================================
     * ARCANISTA — «poder arcano»
     *
     * Aguja. Hombros estrechos, mantel terminado en dos puntas hacia abajo,
     * sombrero de ala ancha y copa en pico, y un báculo que sobresale por
     * encima de la cabeza rematado en cristal. Dos verticales —pico y báculo—
     * y una campana de tela: la silueta más alta y estrecha del elenco.
     * ================================================================== */
    arcanista: {
      id: 'arcanista',
      reads: 'aguja · báculo altísimo con cristal · sombrero de pico',
      armorWeight: 'none',
      palette: 'arcane',
      build: { height: 1.05, shoulders: 0.90, girth: 0.90, limbs: 1.02, neck: 1.05 },
      legs: 'hidden',
      hair: true,
      right: { kind: 'staff', mesh: 'arcaneStaff', scale: 1.00, color: 'wood', gemY: 0.950,
               offset: [0.135, 0.02, 0.06], rot: [0, 0, -0.10] },
      left: null,
      robe: { mesh: 'arcaneRobe', color: 'cloth', trim: null },
      attach: {
        chest: [
          { mesh: 'robeBodice', pos: [0, -0.160, 0], color: 'cloth' },
          { mesh: 'arcaneMantle', pos: [0, 0.228, -0.014], rot: [0.02, 0, 0], color: 'trim' },
          { mesh: 'stole', pos: [0, 0.240, 0.102], color: 'teamDark' }
        ],
        chestPair: [
          { mesh: 'arcaneShard', pos: [0.216, 0.286, -0.010], rot: [0, 0, 0.22], color: 'accent', glow: 1.6 }
        ],
        hips: [
          { mesh: 'arcaneSash', pos: [0, -0.026, 0], color: 'trim' }
        ],
        elbowPair: [
          { mesh: 'arcaneCuff', pos: [0, -0.250, 0], color: 'trim' }
        ],
        head: [
          { mesh: 'arcaneHat', pos: [0, 0.108, -0.012], rot: [0.04, -0.08, 0.03], color: 'cloth' }
        ]
      }
    },

    /* =====================================================================
     * VINCULADOR — «protección y apoyo»
     *
     * Círculo. Todo lo del Arcanista invertido: en vez de puntas, una capelina
     * circular que redondea los hombros; en vez de cristal, un aro cerrado;
     * en vez de sombrero de pico, una diadema baja con el pelo a la vista; en
     * vez de campana cerrada, una túnica abierta por delante. Más bajo, más
     * ancho de hombros y con el remate del báculo por debajo del arcanista.
     * ================================================================== */
    vinculador: {
      id: 'vinculador',
      reads: 'círculo · báculo con aro · capelina circular · túnica abierta',
      armorWeight: 'none',
      palette: 'warden',
      build: { height: 0.99, shoulders: 1.00, girth: 1.05, limbs: 0.98, head: 1.02, neck: 0.95 },
      legs: 'hidden',
      hair: true,
      right: { kind: 'staff', mesh: 'wardenStaff', scale: 1.00, color: 'wood', gemY: 0.900,
               offset: [0.055, 0.00, 0.02] },
      left: { kind: 'orb', mesh: 'wardenOrb', pos: [0, -0.090, 0.030], color: 'accent' },
      robe: { mesh: 'wardenRobe', color: 'cloth', trim: null },
      attach: {
        chest: [
          { mesh: 'robeBodice', pos: [0, -0.160, 0], scale: [1.05, 1, 1.05], color: 'cloth' },
          { mesh: 'wardenCapelet', pos: [0, 0.302, -0.008], color: 'trim' },
          { mesh: 'wardenPendant', pos: [0, 0.196, 0.118], rot: [-1.5708, 0, 0], color: 'metal' },
          { mesh: 'stole', pos: [0, 0.230, 0.108], scale: [0.85, 0.7, 1], color: 'teamDark' }
        ],
        hips: [
          { mesh: 'wardenSash', pos: [0, -0.024, 0], color: 'trim' },
          { mesh: 'wardenTalisman', pos: [-0.168, -0.112, 0.108], rot: [1.5708, 0, 0.18], color: 'metal' },
          { mesh: 'wardenTalisman', pos: [0.182, -0.096, 0.086], rot: [1.5708, 0, -0.22], scale: 0.86, color: 'metal' },
          { mesh: 'wardenTalisman', pos: [0.020, -0.130, -0.150], rot: [1.5708, 0, 0.06], scale: 0.94, color: 'trim' }
        ],
        elbowPair: [
          { mesh: 'wardenCuff', pos: [0, -0.262, 0], color: 'trim' },
          { mesh: 'wardenSleeve', pos: [0, -0.035, 0], color: 'cloth' }
        ],
        head: [
          { mesh: 'wardenCirclet', pos: [0, 0.088, -0.006], color: 'trim' }
        ]
      }
    }
  };

  /* Derivados que no se escriben a mano: el arquetipo y el tipo de arma son
     hechos de la clase que ya viven en data/animConfig.js. Duplicarlos aquí
     sería la primera oportunidad de que se contradigan. */
  var ids = Object.keys(CLASS_VISUAL);
  for (var i = 0; i < ids.length; i++) {
    var p = CLASS_VISUAL[ids[i]];
    p.archetype = Arena.Data.archetypeOf(p.id);
    if (p.right && p.right.kind !== Arena.Data.weaponOf(p.id)) {
      throw new Error('classVisuals: ' + p.id + ' declara arma «' + p.right.kind +
        '» y animConfig dice «' + Arena.Data.weaponOf(p.id) + '»');
    }
  }

  /* Material lógico por malla de equipo, extraído de la propia declaración.
     Así una pieza nueva no puede olvidarse de decir de qué está hecha. */
  var MATERIAL_OF = {};
  for (var name in EQUIPMENT) {
    if (Object.prototype.hasOwnProperty.call(EQUIPMENT, name)) {
      MATERIAL_OF[name] = EQUIPMENT[name].mat || 'CLOTH';
    }
  }

  Arena.Data.CLASS_VISUAL = CLASS_VISUAL;
  Arena.Data.CLASS_VISUAL_ORDER = ids;
  Arena.Data.EQUIPMENT = EQUIPMENT;
  Arena.Data.EQUIPMENT_MATERIAL = MATERIAL_OF;
  Arena.Data.VISUAL_PALETTES = PALETTES;

  Arena.Data.classVisualOf = function (classId) {
    return CLASS_VISUAL[classId] || CLASS_VISUAL.devastador;
  };
});
