/* =============================================================================
 * data/races.js — Razas jugables: identidad visual.
 *
 * Una raza aquí NO toca reglas de combate. Define exclusivamente cómo se ve y
 * cómo se percibe: proporciones, piel, pelo, ojos, rasgos característicos.
 * Separarla de la clase es lo que permite que un Elfo Oscuro mago y un Elfo
 * Oscuro guerrero se reconozcan como del mismo pueblo a primera vista.
 *
 * Se empieza por una sola raza —el Elfo Oscuro— para fijar el lenguaje visual
 * antes de multiplicarlo. Añadir la siguiente será rellenar otra entrada.
 * ========================================================================== */
Arena.define('data/races', ['data/balance'], function (Arena) {
  'use strict';

  var races = {

    /* =======================================================================
     * ELFO OSCURO
     *
     * "La pasión por la magia oscura hizo que algunos elfos cambiaran su
     *  aspecto y sus creencias para siempre."
     *
     * Claves visuales, en orden de importancia para reconocerlo de lejos:
     *   1. Silueta esbelta y alta, hombros estrechos
     *   2. Orejas largas y muy inclinadas hacia atrás
     *   3. Piel azul-lila fría
     *   4. Pelo blanco
     *   5. Ojos rojos luminosos
     * ==================================================================== */
    darkElf: {
      id: 'darkElf',
      name: 'Elfo Oscuro',
      desc: 'La pasión por la magia oscura cambió su aspecto y sus creencias ' +
            'para siempre. Además de su transformación evidente, que les ayudaría ' +
            'a vivir en el desierto, abandonaron la arquería en favor del combate ' +
            'cuerpo a cuerpo.',

      /* --- Proporciones: multiplicadores sobre el humanoide base ---------- */
      build: {
        height: 1.04,        // algo más altos
        shoulders: 0.95,     // esbelto, pero con lectura heroica a cámara MMO
        limbs: 1.06,         // extremidades largas
        head: 1.02,          // ligeramente mayor: rostro/manos deben leer a distancia
        neck: 1.15,
        // Grosor del tronco. Un elfo oscuro es enjuto: quitarle masa al torso
        // es lo que impide que un Guardián elfo se lea como un humano gordo con
        // orejas. Se compone con la masa de la clase, no la sustituye.
        girth: 0.99
      },

      /* --- Rasgos ---------------------------------------------------------- */
      features: {
        earLength: 0.34,     // orejas muy largas
        // Casi horizontales, apuntando atrás. Con -0.30 quedaban verticales
        // y el elfo parecía llevar antenas en lugar de orejas.
        earPitch: -1.12,
        earFlare: 0.42,
        hairStyle: 'swept',  // peinado hacia atrás
        glowingEyes: true
      },

      /* --- Paleta ---------------------------------------------------------- */
      palette: {
        skin: [0.295, 0.270, 0.415],       // azul-lila frío, saturado
        skinShadow: [0.30, 0.31, 0.48],
        hair: [0.93, 0.94, 0.97],       // blanco
        eye: [1.00, 0.26, 0.22],        // rojo luminoso
        eyeGlow: 1.8
      },

      /* --- Variantes de aspecto para el creador de personaje --------------- */
      skinTones: [
        { name: 'Ceniza', color: [0.295, 0.270, 0.415] },
        { name: 'Índigo', color: [0.265, 0.275, 0.455] },
        { name: 'Lila pálido', color: [0.420, 0.395, 0.545] },
        { name: 'Basalto', color: [0.215, 0.225, 0.310] }
      ],
      hairColors: [
        { name: 'Blanco', color: [0.93, 0.94, 0.97] },
        { name: 'Plata', color: [0.78, 0.80, 0.86] },
        { name: 'Ceniza', color: [0.58, 0.58, 0.62] },
        { name: 'Negro', color: [0.14, 0.14, 0.18] }
      ]
    }
  };

  /* =========================================================================
   * CONSTITUCIÓN COMPUESTA: raza × clase
   *
   * La raza dice de qué pueblo es el personaje; la clase, a qué se dedica su
   * cuerpo. Un Guardián es ancho ANTES de ser elfo, y un Centinela es enjuto
   * ANTES de ser elfo. Por eso las dos tablas se multiplican en vez de que una
   * gane: así añadir la segunda raza no obliga a reescribir las seis clases, ni
   * añadir una clase a reescribir las razas.
   *
   * Multiplicar dos tablas independientes es cómodo hasta que alguien sube un
   * poco cada una y el producto se sale de lo que el rig aguanta. Los topes
   * viven AQUÍ, junto a la tabla que los origina, y no en el renderer: quien
   * escriba la próxima raza los tiene delante antes del primer número.
   *
   * El más delicado es `limbs`: hipRestFor() deduce la altura de la cadera de
   * la longitud de la pierna, así que un valor extremo mueve literalmente el
   * suelo bajo los pies del personaje. Y `height` está acotado corto a
   * propósito: la cápsula de simulación, el nameplate y la cámara se anclan a
   * `entity.height`, que es idéntica para las seis clases porque el alcance en
   * combate no puede depender de la silueta. La variación visual es un rasgo
   * de lectura, nunca una ventaja.
   * ====================================================================== */
  var BUILD_LIMITS = {
    height:    [0.90, 1.12],
    shoulders: [0.78, 1.32],
    limbs:     [0.90, 1.12],
    head:      [0.82, 1.16],
    neck:      [0.70, 1.35],
    girth:     [0.78, 1.32]
  };
  var BUILD_KEYS = ['height', 'shoulders', 'limbs', 'head', 'neck', 'girth'];

  Arena.Data.BUILD_LIMITS = BUILD_LIMITS;
  Arena.Data.BUILD_KEYS = BUILD_KEYS;

  /**
   * Compone dos constituciones multiplicando clave a clave y acota el resultado.
   * `out` es opcional y se reutiliza: esto se llama por personaje, no por
   * fotograma, pero el renderer cachea el resultado y no puede permitirse
   * reservar un objeto nuevo cada vez que pregunta.
   */
  Arena.Data.composeBuild = function (base, over, out) {
    out = out || {};
    for (var i = 0; i < BUILD_KEYS.length; i++) {
      var k = BUILD_KEYS[i];
      var a = (base && base[k] !== undefined) ? base[k] : 1;
      var b = (over && over[k] !== undefined) ? over[k] : 1;
      var lim = BUILD_LIMITS[k];
      var v = a * b;
      out[k] = v < lim[0] ? lim[0] : (v > lim[1] ? lim[1] : v);
    }
    return out;
  };

  /** ¿Está esta constitución dentro de lo que el rig sabe resolver? */
  Arena.Data.buildWithinLimits = function (build) {
    for (var i = 0; i < BUILD_KEYS.length; i++) {
      var k = BUILD_KEYS[i], lim = BUILD_LIMITS[k];
      var v = (build && build[k] !== undefined) ? build[k] : 1;
      if (!(v >= lim[0] && v <= lim[1])) return false;
    }
    return true;
  };

  Arena.Data.races = races;
  Arena.Data.raceOrder = ['darkElf'];
  Arena.Data.defaultRace = 'darkElf';

  Arena.Data.getRace = function (id) {
    return races[id] || races[Arena.Data.defaultRace];
  };
});
