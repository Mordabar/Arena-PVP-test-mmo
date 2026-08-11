/* =============================================================================
 * data/balance.js — Todas las constantes de ritmo, caps y fórmulas.
 *
 * Cualquier número que un diseñador quiera tocar vive aquí o en abilities.js.
 * Ningún sistema debe llevar constantes mágicas propias.
 *
 * Objetivos que estos valores persiguen (documento §19):
 *   · TTK 1v1 sin soporte ......... 15–25 s
 *   · Ventana de burst 3–5 s ...... 40–60 % HP
 *   · Golpe individual ............ < 30 % HP máx.
 *   · Hard CC individual .......... 0.7–1.6 s (1.8–2.4 s excepcional)
 *   · Decisión relevante .......... cada 0.5–1.5 s
 * ========================================================================== */
Arena.define('data/balance', [], function (Arena) {
  'use strict';

  var B = {};

  /* --- Reloj ------------------------------------------------------------- */
  B.TICK_RATE = 30;
  B.TICK_DT = 1 / 30;

  /* --- Ritmo de acción (documento §6) ------------------------------------ */
  B.GCD = {
    reactive: 0.25,   // defensivos, interrupciones: se sienten instantáneos
    short: 0.55,      // utility, buffs, movilidad
    standard: 0.80,   // ataques principales
    none: 0           // fuera de GCD por completo
  };

  // Ventana de cola de input: una pulsación hecha hasta 0.20 s antes de que
  // termine el GCD/cast se guarda y se ejecuta sola. Es lo que separa un
  // combate "responsivo" de uno que "come" pulsaciones.
  B.INPUT_QUEUE_WINDOW = 0.20;

  // Tras una interrupción, la categoría interrumpida queda bloqueada.
  B.INTERRUPT_LOCKOUT = 1.0;

  // Margen que se perdona al validar rango en el instante del impacto: sin él,
  // un objetivo que camina 1 cm de más anula un cast completado. Es tolerancia
  // de percepción, no un aumento de alcance efectivo.
  B.RANGE_TOLERANCE = 0.35;

  // Cono frontal por defecto para habilidades que exigen encarar (medio ángulo).
  B.FACING_HALF_ANGLE = Math.PI / 3; // 60° a cada lado → cono de 120°

  /* --- Movimiento (documento §5) ----------------------------------------- */
  B.MOVE_SPEED_BASE = 6.0;
  B.TURN_SPEED = 12.0;            // rad/s: girar debe sentirse inmediato
  B.ENTITY_RADIUS = 0.45;
  B.ENTITY_HEIGHT = 1.85;
  B.CAST_MOVE_TOLERANCE = 0.12;   // desplazamiento que no cancela un cast estacionario

  B.RANGE = {
    melee: 2.6,
    mid: 15,
    long: 24
  };

  /* --- Mitigación y caps (documento §7) ---------------------------------- */
  B.ARMOR_TIERS = { veryHigh: 120, high: 90, mid: 60, midLow: 45, low: 30 };

  B.CAP = {
    defenseReduction: 0.40,   // acumulable hasta -40 %
    antiHeal: 0.60,           // reduce curación hasta -60 %
    slow: 0.60,               // ninguna combinación baja de 40 % de velocidad
    damageReduction: 0.75,    // suelo duro: nada llega a inmunidad por apilar
    damageAmp: 1.60
  };

  /* --- Diminishing Returns (documento §11) ------------------------------- */
  // Interruptor de laboratorio: ON reproduce el estándar competitivo moderno,
  // OFF reproduce la cadena de control larga del MMO clásico de referencia.
  B.DR = {
    enabled: true,
    categories: {
      hardDisable: { steps: [1.0, 0.6, 0.3], immunity: 6.0, window: 8.0 },
      root:        { steps: [1.0, 0.6, 0.3], immunity: 5.0, window: 8.0 },
      silence:     { steps: [1.0, 0.65, 0.35], immunity: 5.0, window: 8.0 },
      // Estasis no encadena nunca: una sola aplicación y 8 s de inmunidad.
      stasis:      { steps: [1.0], immunity: 8.0, window: 8.0 },
      disarm:      { steps: [1.0, 0.6, 0.3], immunity: 5.0, window: 8.0 },
      utilityLock: { steps: [1.0, 0.5], immunity: 8.0, window: 10.0 }
    }
  };

  /* --- Fatiga de control global ------------------------------------------
   * El DR por categoría no basta: alternando categorías distintas se podían
   * encadenar más de 20 s de control. Esto cuenta el control TOTAL sufrido en
   * una ventana y concede un respiro inmune al superar el umbral.            */
  B.CC_FATIGUE = {
    enabled: true,
    threshold: 4.0,   // segundos de control acumulados que agotan al objetivo
    window: 12.0,     // ventana en la que se acumulan
    immunity: 5.0     // respiro inmune a todo control
  };

  /* --- Ataque normal ----------------------------------------------------- */
  B.AUTO_ATTACK = {
    meleeCycle: 1.6,
    rangedCycle: 2.0,
    // El ataque normal "forma parte del ritmo" (§6): con 0.50 aportaba tan poco
    // que los huecos entre cooldowns se sentían muertos y los duelos se
    // alargaban por encima del objetivo. A 0.62 el relleno pesa sin volverse spam.
    coefficient: 0.78,
    // El auto-attack no consume GCD pero sí espera a que termine el swing.
    windup: 0.20
  };

  /* --- Recursos ---------------------------------------------------------- */
  B.RESOURCE = {
    vigor:  { name: 'Vigor',  color: '#f0a23c', regen: 8.0 },
    focus:  { name: 'Enfoque', color: '#4fd6a0', regen: 7.0 },
    mana:   { name: 'Maná',   color: '#5aa8ff', regen: 6.5 }
  };

  /* --- Regeneración de vida fuera de combate ----------------------------- */
  B.OUT_OF_COMBAT_SECONDS = 5.0;
  B.OUT_OF_COMBAT_HP_REGEN = 0.08;      // fracción de HP máx. por segundo
  B.OUT_OF_COMBAT_RESOURCE_MULT = 2.5;

  /* --- Curva de fuerzas: potencia base por clase ------------------------- */
  // El daño bruto de una habilidad = power × coefficient. Cambiar `power`
  // reescala una clase entera sin tocar sus 7 habilidades una a una.
  B.POWER = {
    devastador: 100,
    guardian: 70,
    centinela: 95,
    rastreador: 85,
    arcanista: 100,
    vinculador: 55
  };

  /* --- Fórmulas (documento §7) ------------------------------------------- */

  /** Daño final = bruto × 100 / (100 + defensa efectiva). */
  B.mitigate = function (raw, defense) {
    var d = Math.max(0, defense);
    return raw * 100 / (100 + d);
  };

  /** Reducción porcentual que representa una defensa dada — sólo para la UI. */
  B.defenseToPercent = function (defense) {
    return 1 - 100 / (100 + Math.max(0, defense));
  };

  B.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };

  /* --- Objetivos de diseño verificados por el árbitro -------------------- */
  // No son decorativos: js/tests/balanceTests.js los comprueba simulando
  // combates completos y falla si el ritmo se sale de estos márgenes.
  B.TARGETS = {
    ttk1v1: { min: 12, max: 30 },
    // Dos medidas distintas, porque son dos preguntas distintas:
    //  · burstWindow — presión normal, sin cooldowns mayores. Es el ritmo que
    //    el jugador siente el 90 % del tiempo.
    //  · burstMax — todo volcado a la vez (amplificación + cooldowns). Puede
    //    doler mucho, pero NO debe matar desde el 100 % sin setup previo (§19).
    burstWindow: { seconds: 5, minPct: 0.30, maxPct: 0.52 },
    burstMax: { seconds: 5, minPct: 0.45, maxPct: 0.75 },
    singleHitMaxPct: 0.30,
    hardCC: { typicalMax: 1.6, exceptionalMax: 2.4 },
    ccChainMax: 4.0
  };

  Arena.Data.balance = B;
});
