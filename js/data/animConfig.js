/* =============================================================================
 * data/animConfig.js — Parámetros de animación por arquetipo.
 *
 * Ni un solo número de locomoción, peso o timing de acción debe vivir dentro de
 * render/**. Aquí es donde un diseñador ajusta cómo se siente el personaje sin
 * abrir una línea de matemáticas.
 *
 * Herencia: BASE → arquetipo → override por clase.
 * ========================================================================== */
Arena.define('data/animConfig', ['data/balance'], function (Arena) {
  'use strict';

  /* --- Base común --------------------------------------------------------- */
  var BASE = {
    /* Respuesta del cuerpo. La entidad lógica se mueve YA; esto sólo controla
       cuánto tarda el cuerpo en acomodar su peso. Subirlo da responsividad,
       bajarlo da inercia. Nunca introduce input lag. */
    accelRate: 9.0,          // 1/s de acercamiento a la velocidad objetivo
    decelRate: 12.0,         // frenar es más rápido que arrancar
    dirBlendRate: 8.5,       // rapidez al cambiar de dirección de avance
    turnBlendRate: 7.0,

    /* Proporción de velocidad por dirección. La simulación no cambia: esto es
       sólo cuánto ciclo de paso se reproduce, para que la zancada case con el
       desplazamiento real y el pie no patine. */
    backwardRatio: 0.72,
    strafeRatio: 0.90,

    /* Ciclo de paso -------------------------------------------------------
     *
     * `strideLength` es el RECORRIDO DEL PIE DURANTE EL APOYO: cuánto retrocede
     * el pie respecto al cuerpo desde que planta hasta que despega. NO es el
     * avance por ciclo, que se deduce de él y del duty factor.
     *
     * Esa distinción es la que impide el patinaje. El pie apoyado está clavado
     * en el mundo, así que este número es exactamente cuánto tiene que estirarse
     * la pierna, y por tanto está acotado por la anatomía: con una pierna de
     * ~0.93 y la cadera a ~0.92 del suelo, el pie no puede separarse más de
     * ~0.44 de la vertical de la cadera. De ahí que el máximo razonable ronde
     * 0.88 y no se toque sin mirar antes solveTwoBoneIK.
     *
     * La CADENCIA no se configura: se deriva de la velocidad real. Si se fijara
     * a mano, cualquier cambio de velocidad rompería la correspondencia entre
     * zancada y desplazamiento, y el pie resbalaría por definición.
     */
    strideLength: 0.80,      // recorrido del pie durante el apoyo, en unidades
    strideSpeedGain: 0.45,   // cuánto crece la zancada con la velocidad
    stepHeight: 0.16,        // altura del pie en vuelo
    stepFrequency: 1.55,     // cadencia de referencia (sólo para los topes)
    dutyFactor: 0.60,        // fracción del ciclo con el pie apoyado, andando
    dutyFactorRun: 0.36,     // corriendo aparece fase de vuelo: así se cubre
                             // más terreno del que da la longitud de la pierna
    stanceWidth: 0.115,      // separación lateral de los pies
    footPlantBlend: 0.10,    // suavizado al enganchar y soltar el pie

    /* Centro de masa ------------------------------------------------------ */
    hipShiftAmount: 0.035,   // desplazamiento hacia la pierna que soporta
    hipDropAmount: 0.030,    // caída de cadera en el apoyo
    hipRollAmount: 0.055,
    accelLean: 0.16,         // inclinación al acelerar
    decelLean: 0.13,         // contrainclinación al frenar
    strafeLean: 0.11,
    turnLean: 0.14,

    /* Torso --------------------------------------------------------------- */
    torsoTwist: 0.14,        // contrarrotación respecto a la cadera
    torsoCounterRate: 0.55,  // cuánto contrarresta la cabeza la inclinación
    headTrackMaxYaw: 1.05,   // límite de giro de cabeza hacia el objetivo
    headTrackMaxPitch: 0.40,
    chestTrackRatio: 0.35,   // parte del seguimiento que asume el pecho

    /* Brazos -------------------------------------------------------------- */
    armSwing: 0.52,
    armSwingRun: 0.34,       // extra a velocidad máxima
    elbowBaseBend: 0.28,
    elbowSwingBend: 0.42,

    /* Arranque y frenado -------------------------------------------------- */
    startAnticipation: 0.09, // segundos de desplazamiento del peso antes del paso
    stopAbsorb: 0.14,        // segundos de absorción en rodillas al parar

    /* Giro en el sitio ---------------------------------------------------- */
    turnInPlaceThreshold: 0.55,  // rad de desfase que dispara un paso de pivote
    turnStepThreshold: 1.20,     // por encima de esto, paso real en vez de torsión

    /* Idle ---------------------------------------------------------------- */
    breathRate: 1.45,
    breathAmount: 0.011,
    weightShiftRate: 0.55,
    weightShiftAmount: 0.030,

    /* Reacción al daño ----------------------------------------------------- */
    hitReactAmount: 0.22,
    hitReactDecay: 3.5,

    /* Acciones: los tiempos son fracciones de la duración total de la acción,
       no segundos. La duración la fija actionTime. */
    actionTime: { light: 0.42, heavy: 0.68, thrust: 0.46, ranged: 0.58, cast: 0.34 },
    phases: {
      light:  { anticipation: 0.00, active: 0.30, impact: 0.42, recovery: 0.55, end: 1.0 },
      heavy:  { anticipation: 0.00, active: 0.44, impact: 0.58, recovery: 0.68, end: 1.0 },
      thrust: { anticipation: 0.00, active: 0.34, impact: 0.46, recovery: 0.58, end: 1.0 },
      ranged: { anticipation: 0.00, active: 0.22, impact: 0.58, recovery: 0.68, end: 1.0 },
      cast:   { anticipation: 0.00, active: 0.18, impact: 0.45, recovery: 0.60, end: 1.0 }
    }
  };

  /* --- Perfiles por arquetipo --------------------------------------------- */
  var ARCHETYPES = {
    melee: {
      // Pesado y plantado: pasos cortos, base ancha, centro de masa bajo.
      strideLength: 0.76, strideSpeedGain: 0.42, stepHeight: 0.15, stepFrequency: 1.50,
      dutyFactor: 0.62, dutyFactorRun: 0.40, stanceWidth: 0.135,
      hipShiftAmount: 0.042, accelLean: 0.18,
      armSwing: 0.48, elbowBaseBend: 0.38,
      idle: {
        stanceWidth: 0.16, kneeBend: 0.20, chestLean: 0.10,
        pelvisDrop: 0.030, guardHeight: 0.42
      }
    },
    archer: {
      // Ligero y ágil: zancada larga, pies más altos, base estrecha.
      strideLength: 0.86, strideSpeedGain: 0.50, stepHeight: 0.19, stepFrequency: 1.68,
      dutyFactor: 0.56, dutyFactorRun: 0.32, stanceWidth: 0.100,
      hipShiftAmount: 0.032, accelLean: 0.15,
      armSwing: 0.42, elbowBaseBend: 0.32,
      idle: {
        stanceWidth: 0.115, kneeBend: 0.14, chestLean: 0.05,
        pelvisDrop: 0.014, guardHeight: 0.30, weightOnLeg: 0.4
      }
    },
    caster: {
      // Erguido y contenido: pasos cortos, poco balanceo, torso vertical.
      strideLength: 0.70, strideSpeedGain: 0.38, stepHeight: 0.13, stepFrequency: 1.45,
      dutyFactor: 0.64, dutyFactorRun: 0.42, stanceWidth: 0.095,
      hipShiftAmount: 0.026, accelLean: 0.11,
      armSwing: 0.30, elbowBaseBend: 0.30,
      torsoTwist: 0.09,
      idle: {
        stanceWidth: 0.10, kneeBend: 0.09, chestLean: -0.02,
        pelvisDrop: 0.008, guardHeight: 0.24
      }
    }
  };

  /* --- Overrides por clase ------------------------------------------------- */
  var CLASSES = {
    guardian: { strideLength: 0.72, stepFrequency: 1.42, stanceWidth: 0.145 },
    devastador: { accelLean: 0.20, armSwing: 0.54 },
    centinela: { strideLength: 0.90 },
    vinculador: { stepFrequency: 1.40 }
  };

  function merge(a, b) {
    var o = {};
    var k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) {
      // Los sub-objetos (idle, phases) se funden en profundidad de un nivel.
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k]) o[k] = merge(o[k], b[k]);
      else o[k] = b[k];
    }
    return o;
  }

  var cache = Object.create(null);

  /** Config resuelta para una clase concreta: BASE → arquetipo → clase. */
  Arena.Data.animConfigFor = function (classId, archetype) {
    var key = classId + '|' + archetype;
    if (cache[key]) return cache[key];
    var cfg = merge(BASE, ARCHETYPES[archetype] || {});
    if (CLASSES[classId]) cfg = merge(cfg, CLASSES[classId]);
    cache[key] = cfg;
    return cfg;
  };

  Arena.Data.animConfig = { BASE: BASE, ARCHETYPES: ARCHETYPES, CLASSES: CLASSES };
});
