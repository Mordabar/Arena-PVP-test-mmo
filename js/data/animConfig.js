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

    /* Lenguaje corporal por dirección. No cambia la velocidad lógica: sólo
       modifica longitud de paso, elevación, torsión y balanceo para que
       backpedal/strafe/diagonal no sean el mismo ciclo reproducido de lado. */
    directional: {
      forward:  { stride: 1.00, lift: 1.00, duty: 1.00, arm: 1.00, twist: 1.00, hip: 1.00 },
      backward: { stride: 0.78, lift: 0.72, duty: 1.08, arm: 0.58, twist: 0.48, hip: 0.82 },
      strafe:   { stride: 0.82, lift: 0.82, duty: 1.05, arm: 0.46, twist: 0.38, hip: 1.10 },
      diagonal: { stride: 0.92, lift: 0.92, duty: 1.02, arm: 0.76, twist: 0.72, hip: 1.04 }
    },

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

    /* Idle -----------------------------------------------------------------
     *
     * TRES OSCILADORES, NO UNO. Una única sinusoide se reconoce a simple vista:
     * el personaje sube y baja con un periodo perfecto y el ojo lo lee como
     * maquinaria, no como respiración. Combinando frecuencias inconmensurables
     * (1.00 / 0.41 / 0.23 no comparten periodo común corto) el ciclo aparente
     * dura decenas de segundos y deja de reconocerse.
     */
    breathRate: 1.45,
    breathAmount: 0.011,
    breathHarmonic2: 0.41,   // múltiplo de la frecuencia base, no entero
    breathHarmonic3: 0.23,
    breathMix2: 0.42,        // peso relativo de cada armónico
    breathMix3: 0.24,
    weightShiftRate: 0.55,
    weightShiftAmount: 0.030,
    idleSwayRate: 0.37,      // deriva lentísima del torso, sin periodo audible
    idleSwayAmount: 0.016,
    idleHeadRate: 0.29,
    idleHeadAmount: 0.030,

    /* Inercia del arma -----------------------------------------------------
     *
     * Un arma clavada al antebrazo no pesa nada. Estos valores son la tasa de
     * seguimiento (1/s) del arma respecto al ángulo que le pide la pose: más
     * bajo = más masa aparente. No es física, es un retardo — pero es lo que
     * separa "sostiene un bastón" de "tiene un bastón pegado a la mano".
     */
    weaponLagRate: 16.0,
    weaponLagAmount: 1.0,    // 0 = rígido, 1 = todo el retardo configurado

    /* Reacción al daño ----------------------------------------------------- */
    hitReactAmount: 0.22,
    hitReactDecay: 3.5,

    /* Acciones: los tiempos son fracciones de la duración total de la acción,
       no segundos. La duración la fija actionTime. */
    actionTime: {
      light: 0.44, heavy: 0.70, thrust: 0.48, ranged: 0.60,
      kick: 0.48, shield: 0.46, charge: 0.52, cry: 0.54,
      pulse: 0.42,   // ataque normal del mago
      cast: 0.46     // liberación del hechizo: recuperación corta, esto es PvP
    },
    phases: {
      light:  { anticipation: 0.00, active: 0.30, impact: 0.42, recovery: 0.55, end: 1.0 },
      heavy:  { anticipation: 0.00, active: 0.44, impact: 0.58, recovery: 0.68, end: 1.0 },
      thrust: { anticipation: 0.00, active: 0.34, impact: 0.46, recovery: 0.60, end: 1.0 },
      ranged: { anticipation: 0.00, active: 0.20, impact: 0.58, recovery: 0.72, end: 1.0 },
      kick:   { anticipation: 0.00, active: 0.24, impact: 0.46, recovery: 0.62, end: 1.0 },
      shield: { anticipation: 0.00, active: 0.22, impact: 0.44, recovery: 0.60, end: 1.0 },
      charge: { anticipation: 0.00, active: 0.18, impact: 0.52, recovery: 0.68, end: 1.0 },
      cry:    { anticipation: 0.00, active: 0.30, impact: 0.52, recovery: 0.68, end: 1.0 },
      pulse:  { anticipation: 0.00, active: 0.28, impact: 0.48, recovery: 0.66, end: 1.0 },
      // `active` bajo a propósito: la cadena cinética arranca casi al instante
      // y se escalona sola con los retardos por eslabón.
      cast:   { anticipation: 0.00, active: 0.14, impact: 0.52, recovery: 0.66, end: 1.0 }
    }
  };

  /* =========================================================================
   * Arquetipo y arma por clase
   *
   * Vive en data/ y no en render/ porque no es una decisión de dibujo: es un
   * hecho de la clase. La capa neutral de animación (anim/animationIntent.js)
   * lo necesita, y esa capa no puede depender de nada de presentación si algún
   * día tiene que alimentar a Three.js o a Unity.
   * ====================================================================== */
  var ARCHETYPE = {
    devastador: 'melee', guardian: 'melee',
    centinela: 'archer', rastreador: 'archer',
    arcanista: 'caster', vinculador: 'caster'
  };
  var WEAPON = {
    devastador: 'sword', guardian: 'sword',
    centinela: 'bow', rastreador: 'bow',
    arcanista: 'staff', vinculador: 'staff'
  };
  Arena.Data.archetypeOf = function (classId) { return ARCHETYPE[classId] || 'melee'; };
  Arena.Data.weaponOf = function (classId) { return WEAPON[classId] || 'sword'; };

  /* --- Perfiles por arquetipo --------------------------------------------- */
  var ARCHETYPES = {
    melee: {
      // Pesado y plantado: pasos cortos, base ancha, centro de masa bajo.
      strideLength: 0.76, strideSpeedGain: 0.42, stepHeight: 0.15, stepFrequency: 1.50,
      dutyFactor: 0.62, dutyFactorRun: 0.40, stanceWidth: 0.135,
      hipShiftAmount: 0.042, accelLean: 0.18,
      armSwing: 0.48, elbowBaseBend: 0.38,
      weaponLagRate: 18.0,
      directional: {
        backward: { stride: 0.74, lift: 0.68, arm: 0.52, twist: 0.42, hip: 0.90 },
        strafe:   { stride: 0.78, lift: 0.78, arm: 0.40, twist: 0.30, hip: 1.16 }
      },
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
      weaponLagRate: 21.0,
      directional: {
        backward: { stride: 0.82, lift: 0.82, arm: 0.62, twist: 0.58, hip: 0.88 },
        strafe:   { stride: 0.88, lift: 0.92, arm: 0.54, twist: 0.48, hip: 1.08 },
        diagonal: { stride: 0.96, lift: 0.97, arm: 0.76, twist: 0.78, hip: 1.02 }
      },
      idle: {
        stanceWidth: 0.115, kneeBend: 0.14, chestLean: 0.05,
        pelvisDrop: 0.014, guardHeight: 0.30, weightOnLeg: 0.4
      }
    },
    caster: {
      /* El mago NO es "un humanoide con los brazos más quietos". Es alguien que
         protege el equilibrio de su báculo y conserva una postura lista para
         reaccionar: base algo más ancha de lo que pide su peso, pasos cortos,
         torso vertical, y un arma larga que pesa y se retrasa. */
      // Zancada ligeramente más amplia y pie un poco más alto: quita el “shuffle”
      // sin convertir al caster en arquero. La cadencia baja un toque para que
      // el báculo y el torso tengan tiempo de vender el peso del paso.
      /* PASS v0.5: paso más humano. Antes el caster tenía una zancada muy
         corta y una cadencia baja: a velocidad de juego los pies parecían
         barajar bajo la túnica. Ahora cubre más terreno por apoyo, levanta algo
         más el pie y deja que pelvis/pecho contrapesen el báculo. */
      strideLength: 0.79, strideSpeedGain: 0.44, stepHeight: 0.175, stepFrequency: 1.54,
      dutyFactor: 0.60, dutyFactorRun: 0.37, stanceWidth: 0.120,
      hipShiftAmount: 0.041, hipRollAmount: 0.052, accelLean: 0.16, decelLean: 0.18,
      armSwing: 0.34,
      armSwingRun: 0.24,
      elbowBaseBend: 0.34,
      torsoTwist: 0.125,
      torsoCounterRate: 0.61,
      chestTrackRatio: 0.40,
      // Menos goma: el báculo conserva masa, pero obedece a la mano antes.
      weaponLagRate: 11.5,
      weaponLagAmount: 0.52,
      staffWalkCounter: 0.46,
      staffStrideInertia: 0.22,
      staffGripLift: 0.028,
      directional: {
        backward: { stride: 0.72, lift: 0.66, arm: 0.42, twist: 0.34, hip: 0.78 },
        strafe:   { stride: 0.78, lift: 0.78, arm: 0.36, twist: 0.28, hip: 1.02 },
        diagonal: { stride: 0.88, lift: 0.88, arm: 0.58, twist: 0.50, hip: 0.96 }
      },
      // Respiración algo más marcada: el mago está quieto casi todo el tiempo y
      // sin ella se lee como una estatua.
      breathAmount: 0.014, idleSwayAmount: 0.020, idleHeadAmount: 0.038,
      idle: {
        stanceWidth: 0.112, kneeBend: 0.09, chestLean: -0.02,
        pelvisDrop: 0.008, guardHeight: 0.24
      }
    }
  };

  /* --- Overrides por clase ------------------------------------------------- */
  var CLASSES = {
    guardian: { strideLength: 0.72, stepFrequency: 1.42, stanceWidth: 0.145 },
    devastador: { accelLean: 0.20, armSwing: 0.54 },
    /* Postura de tirador: base ancha y zancada larga. Además de ser el gesto
       correcto para un arquero de largo alcance, separa su contorno frontal del
       de un caster con túnica, que era la última pareja que se confundía. */
    centinela: { strideLength: 0.90, stanceWidth: 0.170 },
    vinculador: { stepFrequency: 1.50, strideLength: 0.76 }
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

  Arena.Data.animConfig = {
    BASE: BASE, ARCHETYPES: ARCHETYPES, CLASSES: CLASSES,
    ARCHETYPE: ARCHETYPE, WEAPON: WEAPON
  };
});
