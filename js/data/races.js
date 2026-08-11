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
        shoulders: 0.92,     // más estrechos
        limbs: 1.06,         // extremidades largas
        head: 0.96,          // cabeza pequeña
        neck: 1.15
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
        skin: [0.38, 0.36, 0.56],       // azul-lila frío, saturado
        skinShadow: [0.30, 0.31, 0.48],
        hair: [0.93, 0.94, 0.97],       // blanco
        eye: [1.00, 0.26, 0.22],        // rojo luminoso
        eyeGlow: 1.8
      },

      /* --- Variantes de aspecto para el creador de personaje --------------- */
      skinTones: [
        { name: 'Ceniza', color: [0.38, 0.36, 0.56] },
        { name: 'Índigo', color: [0.36, 0.37, 0.60] },
        { name: 'Lila pálido', color: [0.58, 0.55, 0.72] },
        { name: 'Basalto', color: [0.29, 0.30, 0.42] }
      ],
      hairColors: [
        { name: 'Blanco', color: [0.93, 0.94, 0.97] },
        { name: 'Plata', color: [0.78, 0.80, 0.86] },
        { name: 'Ceniza', color: [0.58, 0.58, 0.62] },
        { name: 'Negro', color: [0.14, 0.14, 0.18] }
      ]
    }
  };

  Arena.Data.races = races;
  Arena.Data.raceOrder = ['darkElf'];
  Arena.Data.defaultRace = 'darkElf';

  Arena.Data.getRace = function (id) {
    return races[id] || races[Arena.Data.defaultRace];
  };
});
