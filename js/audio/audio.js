/* =============================================================================
 * audio/audio.js — Audio táctico sintetizado con Web Audio API.
 *
 * QUÉ ES ESTE SUBSISTEMA
 *
 * En un PvP target-based el audio NO es ambiente: es el segundo canal de
 * información del jugador, y a menudo el único que llega a tiempo. La cámara
 * mira a un sitio; el oído cubre los 360°. Si el rival empieza un casteo a mi
 * espalda, la única señal que puede salvarme es un sonido.
 *
 * De ahí las cuatro reglas que ordenan todo el fichero:
 *
 *   1. COBERTURA. Todo evento de combate que cambia una decisión tiene sonido
 *      propio. Nada cae en silencio "por defecto".
 *   2. JERARQUÍA. Un burst mete diez eventos en un segundo. Sin límite de
 *      voces, agrupamiento y prioridad, eso es ruido blanco y el jugador deja
 *      de oír lo único que importaba. Un sonido menos vale más que un sonido
 *      de más.
 *   3. PERSPECTIVA. Lo que me pasa a mí suena distinto, más fuerte y más grave
 *      que lo que le pasa a otro, y lo lejano suena más apagado.
 *   4. IDENTIDAD. Un martillo no suena como un arco ni como un báculo. El
 *      timbre sale de DATOS del arquetipo/arma (§10 de CLAUDE.md), nunca de un
 *      switch por id de habilidad.
 *
 * FRONTERA DE AUTORIDAD (CLAUDE.md §3)
 *
 * Este fichero SÓLO escucha el bus y lee estado. No muta ni una entidad, ni un
 * cooldown, ni un resultado. Si un sonido no suena, es que el evento no se
 * emitió: cada fallo de audio es una pista sobre la simulación, nunca al revés.
 *
 * SIN FICHEROS DE AUDIO
 *
 * No hay un solo binario en el repo: cada sonido se sintetiza con osciladores y
 * ruido filtrado. Coherente con abrir desde file:// y con cero dependencias.
 * La variación de tono usa un RNG determinista sembrado, NUNCA Math.random():
 * dos partidas con la misma semilla deben sonar igual, y una diferencia audible
 * tiene que significar algo.
 *
 * DEGRADACIÓN
 *
 * Sin `window.AudioContext` (Node, tests headless, navegador antiguo) todo el
 * pipeline de decisión sigue funcionando y la síntesis se convierte en no-op.
 * Instalar y emitir eventos nunca lanza.
 * ========================================================================== */
Arena.define('audio/audio', ['core/rng', 'math/vec3', 'data/effects'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;

  /* =========================================================================
   * 0. Constantes de mezcla
   * ====================================================================== */

  var MAX_VOICES     = 16;    // capas simultáneas antes de robar voz
  var AUDIO_SEED     = 0x51A7ED;
  var PITCH_JITTER   = 0.025; // ±2.5 %: humaniza sin cambiar la identidad
  var NEAR_DIST      = 6;     // hasta aquí, volumen pleno
  var FAR_DIST       = 34;    // a partir de aquí, inaudible
  var DUCK_PRIORITY  = 84;    // por encima de esto, un evento agacha a los menores
  var DUCK_SECONDS   = 0.30;
  var DUCK_DEPTH     = 45;    // cuánto sube el suelo de prioridad tras un evento grande

  /* =========================================================================
   * 1. Estado del subsistema
   * ====================================================================== */

  var A = {
    ctx: null,
    master: null,
    enabled: true,
    volume: 0.5,

    /** Voces vivas: {cueId, priority, endsAt, nodes[], gains[]}. */
    voices: [],
    maxVoices: MAX_VOICES,

    /** Última vez que sonó cada grupo, para el agrupamiento anti-saturación. */
    _lastAt: Object.create(null),

    /** Suelo de prioridad dinámico: sube tras un evento grande y decae. */
    _duck: { level: 0, from: 0, until: 0 },

    /** Contadores de diagnóstico. No influyen en nada. */
    stats: { played: 0, droppedByGroup: 0, droppedByVoices: 0, droppedByDuck: 0, stolen: 0 },

    _world: null,
    _getPlayerId: null,
    _offs: [],
    _cdReady: Object.create(null),
    _fallbackClock: 0
  };

  /* =========================================================================
   * 2. Aleatoriedad determinista
   *
   * Math.random() está PROHIBIDO aquí: la variación de un sonido es información
   * que el jugador interpreta, y una información irreproducible no se puede
   * depurar ni comparar entre dos ejecuciones de la misma semilla.
   * ====================================================================== */

  function makeRng(seed) {
    if (Arena.Core && Arena.Core.RNG) return new Arena.Core.RNG(seed);
    // Fallback embebido (mismo mulberry32) para que el módulo funcione suelto.
    var s = seed >>> 0 || 1;
    return {
      next: function () {
        s = (s + 0x6D2B79F5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      range: function (a, b) { return a + this.next() * (b - a); }
    };
  }

  A.rng = makeRng(AUDIO_SEED);
  A.noiseRng = makeRng(AUDIO_SEED ^ 0x5EED);

  /** Reinicia la aleatoriedad de la mezcla. Dos llamadas dan la misma serie. */
  A.resetRng = function (seed) {
    A.rng = makeRng(seed === undefined ? AUDIO_SEED : seed);
    return A;
  };

  function jitter() { return 1 + A.rng.range(-PITCH_JITTER, PITCH_JITTER); }

  /* =========================================================================
   * 3. Contexto y cadena de mezcla
   *
   * El contexto se crea en el PRIMER GESTO del usuario: los navegadores
   * bloquean el audio hasta entonces y crearlo antes deja un contexto muerto.
   * main.js ya lo arma así; no cambiar ese contrato.
   * ====================================================================== */

  A.init = function () {
    if (A.ctx) return A.ctx;
    var g = (typeof window !== 'undefined') ? window : null;
    var Ctx = g && (g.AudioContext || g.webkitAudioContext);
    if (!Ctx) { A.enabled = false; return null; }

    try {
      A.ctx = new Ctx();
    } catch (err) {
      A.ctx = null; A.enabled = false; return null;
    }

    A.master = A.ctx.createGain();
    A.master.gain.value = A.volume;

    // Compresor de seguridad: sin él un AoE sobre cinco objetivos satura y el
    // límite de voces llega tarde, porque el problema no es el número de voces
    // sino la suma de sus picos.
    var comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;

    A.master.connect(comp);
    comp.connect(A.ctx.destination);
    A.enabled = true;
    A._noiseBuffer = null;
    return A.ctx;
  };

  A.resume = function () {
    if (A.ctx && A.ctx.state === 'suspended' && A.ctx.resume) A.ctx.resume();
  };

  A.setVolume = function (v) {
    A.volume = v;
    if (A.master) A.master.gain.value = v;
  };

  /** Suelta el contexto. Sirve para tests y para reconfigurar la salida. */
  A.reset = function () {
    if (A.ctx && A.ctx.close) { try { A.ctx.close(); } catch (e) {} }
    A.ctx = null; A.master = null; A._noiseBuffer = null;
    A.voices.length = 0;
    A._lastAt = Object.create(null);
    A._duck = { level: 0, from: 0, until: 0 };
    A._cdReady = Object.create(null);
    A.stats = { played: 0, droppedByGroup: 0, droppedByVoices: 0, droppedByDuck: 0, stolen: 0 };
    A.enabled = true;
    return A;
  };

  /** Reloj de mezcla. Sin contexto avanza a mano para que la política de voces
   *  siga siendo comprobable fuera del navegador. */
  A.now = function () {
    return A.ctx ? A.ctx.currentTime : A._fallbackClock;
  };
  A.advanceClock = function (dt) { A._fallbackClock += dt; return A._fallbackClock; };

  /* =========================================================================
   * 4. Timbre — DATOS, no condicionales
   *
   * Un impacto no se describe por la habilidad que lo causó sino por el
   * material que lo produce y por quién lo sufre. Estas tres tablas son el
   * único sitio donde se decide "a qué suena algo".
   * ====================================================================== */

  /** Material del arma. `freqMul` mueve el cuerpo tonal; `noiseMul` el brillo
   *  del transitorio; `durMul` cuánto resuena. Añadir un arma nueva es añadir
   *  una fila, jamás tocar código. */
  var MATERIAL = {
    sword:    { freqMul: 1.00, noiseMul: 1.15, durMul: 0.92, qMul: 1.10, gainMul: 1.00 },
    axe:      { freqMul: 0.84, noiseMul: 1.00, durMul: 1.10, qMul: 0.85, gainMul: 1.08 },
    hammer:   { freqMul: 0.58, noiseMul: 0.72, durMul: 1.50, qMul: 0.60, gainMul: 1.18 },
    spear:    { freqMul: 1.12, noiseMul: 1.05, durMul: 0.86, qMul: 1.25, gainMul: 0.94 },
    bow:      { freqMul: 1.42, noiseMul: 0.68, durMul: 0.74, qMul: 1.60, gainMul: 0.88 },
    crossbow: { freqMul: 1.22, noiseMul: 0.90, durMul: 0.80, qMul: 1.35, gainMul: 0.96 },
    staff:    { freqMul: 0.88, noiseMul: 1.35, durMul: 1.28, qMul: 0.75, gainMul: 0.92 },
    none:     { freqMul: 1.00, noiseMul: 1.00, durMul: 1.00, qMul: 1.00, gainMul: 1.00 }
  };

  /** Arquetipo: corrige el "peso" general por encima del arma concreta. */
  var ARCHETYPE_TIMBRE = {
    melee:  { freqMul: 0.94, durMul: 1.06, gainMul: 1.06 },
    archer: { freqMul: 1.08, durMul: 0.92, gainMul: 0.96 },
    caster: { freqMul: 1.00, durMul: 1.12, gainMul: 0.98 }
  };

  /** Bando. Cambia volumen, color y —lo importante— PRIORIDAD: lo que me pasa
   *  a mí manda sobre lo que le pasa a otro cuando hay que elegir qué se oye. */
  var PERSPECTIVE = {
    self:    { gainMul: 1.00, freqMul: 0.94, priorityBonus: 15, ignoreDistance: true },
    ally:    { gainMul: 0.80, freqMul: 1.02, priorityBonus: 4,  ignoreDistance: false },
    enemy:   { gainMul: 0.86, freqMul: 1.06, priorityBonus: 6,  ignoreDistance: false },
    neutral: { gainMul: 0.60, freqMul: 1.00, priorityBonus: 0,  ignoreDistance: false }
  };

  A.MATERIAL = MATERIAL;
  A.ARCHETYPE_TIMBRE = ARCHETYPE_TIMBRE;
  A.PERSPECTIVE = PERSPECTIVE;

  /* =========================================================================
   * 5. Banco de señales
   *
   * Cada entrada es una FIRMA: capas, envolvente, prioridad táctica y ventana
   * de agrupamiento. Dos eventos que el jugador debe distinguir NO pueden
   * compartir firma; los tests lo verifican par a par.
   *
   * Campos de una capa:
   *   kind ...... 'tone' | 'noise'
   *   wave ...... forma de onda del oscilador
   *   filter .... tipo de filtro del ruido
   *   freq/freqEnd ... barrido de frecuencia (Hz)
   *   dur/attack ..... envolvente (s)
   *   gain ...... pico
   *   delay ..... retardo respecto al inicio del cue (encadenar capas)
   *   q ......... resonancia del filtro
   *   rate ...... velocidad de lectura del buffer de ruido
   *
   * Campos del cue:
   *   priority .. importancia TÁCTICA, no volumen (0-100)
   *   group ..... clave de agrupamiento anti-saturación
   *   minGap .... ventana mínima entre dos disparos del mismo grupo (s)
   *   timbre .... 'weapon' si el material del atacante debe teñirlo
   *   powerGain/powerFreq ... escalado por magnitud del golpe
   * ====================================================================== */

  var BANK = {};

  function cue(id, def) {
    def.id = id;
    def.priority = def.priority === undefined ? 40 : def.priority;
    def.group = def.group || id;
    def.minGap = def.minGap === undefined ? 0.04 : def.minGap;
    def.timbre = def.timbre || null;
    def.layers = def.layers || [];
    BANK[id] = def;
    return def;
  }

  /* --- Ataque normal ------------------------------------------------------ */

  cue('normal.swing', {
    priority: 34, group: 'swing', minGap: 0.06, timbre: 'weapon',
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 900, freqEnd: 300, q: 1.1, dur: 0.16, gain: 0.10, rate: 1.25 }
    ]
  });

  cue('normal.hit', {
    priority: 50, group: 'hit', minGap: 0.05, timbre: 'weapon',
    powerGain: 0.14, powerFreq: 180,
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 520, freqEnd: 120, q: 0.85, dur: 0.12, gain: 0.17, rate: 1.10 },
      { kind: 'tone', wave: 'triangle', freq: 168, freqEnd: 72, dur: 0.10, gain: 0.12 }
    ]
  });

  cue('normal.taken', {
    priority: 78, group: 'taken', minGap: 0.07, timbre: 'weapon',
    powerGain: 0.18, powerFreq: 60,
    layers: [
      { kind: 'noise', filter: 'lowpass', freq: 240, freqEnd: 64, q: 0.55, dur: 0.20, gain: 0.24, rate: 0.85 },
      { kind: 'tone', wave: 'sine', freq: 96, freqEnd: 50, dur: 0.24, gain: 0.22 }
    ]
  });

  /* --- Impacto de poder --------------------------------------------------- */

  cue('power.hit.physical', {
    priority: 60, group: 'powerHit', minGap: 0.05, timbre: 'weapon',
    powerGain: 0.16, powerFreq: 220,
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 700, freqEnd: 180, q: 1.4, dur: 0.16, gain: 0.19, rate: 1.0 },
      { kind: 'tone', wave: 'triangle', freq: 212, freqEnd: 84, dur: 0.13, gain: 0.13 }
    ]
  });

  cue('power.hit.magical', {
    priority: 60, group: 'powerHit', minGap: 0.05, timbre: 'weapon',
    powerGain: 0.13, powerFreq: 280,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 900, freqEnd: 262, dur: 0.22, gain: 0.11 },
      { kind: 'noise', filter: 'bandpass', freq: 2400, freqEnd: 620, q: 3.0, dur: 0.18, gain: 0.08, rate: 1.0 }
    ]
  });

  cue('power.hit.pure', {
    priority: 62, group: 'powerHit', minGap: 0.05,
    powerGain: 0.14, powerFreq: 150,
    layers: [
      { kind: 'tone', wave: 'square', freq: 640, freqEnd: 184, dur: 0.18, gain: 0.10 },
      { kind: 'noise', filter: 'bandpass', freq: 1500, freqEnd: 420, q: 2.2, dur: 0.15, gain: 0.09, rate: 1.0 }
    ]
  });

  cue('power.taken', {
    priority: 82, group: 'taken', minGap: 0.06,
    powerGain: 0.20, powerFreq: 70,
    layers: [
      { kind: 'noise', filter: 'lowpass', freq: 300, freqEnd: 70, q: 0.7, dur: 0.26, gain: 0.26, rate: 0.9 },
      { kind: 'tone', wave: 'sine', freq: 110, freqEnd: 46, dur: 0.30, gain: 0.24 }
    ]
  });

  /* Crítico: tiene que ser IRREPETIBLE. Tres capas con un chasquido metálico
     agudo en la cabeza; ningún otro cue empieza con un ataque tan corto. */
  cue('crit', {
    priority: 88, group: 'crit', minGap: 0.09, timbre: 'weapon',
    powerGain: 0.10, powerFreq: 240,
    layers: [
      { kind: 'tone', wave: 'square', freq: 1480, freqEnd: 424, dur: 0.13, gain: 0.13, attack: 0.0015 },
      { kind: 'noise', filter: 'highpass', freq: 3600, freqEnd: 700, q: 5.0, dur: 0.17, gain: 0.12, rate: 1.5 },
      { kind: 'tone', wave: 'sine', freq: 190, freqEnd: 70, dur: 0.22, gain: 0.16, delay: 0.012 }
    ]
  });

  /* --- Curación, barrera -------------------------------------------------- */

  cue('heal', {
    priority: 68, group: 'heal', minGap: 0.10,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 523, freqEnd: 784, dur: 0.30, gain: 0.11, attack: 0.020 },
      { kind: 'tone', wave: 'sine', freq: 659, dur: 0.34, gain: 0.07, attack: 0.030, delay: 0.05 }
    ]
  });

  cue('heal.taken', {
    priority: 74, group: 'heal', minGap: 0.10,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 587, freqEnd: 880, dur: 0.34, gain: 0.13, attack: 0.024 },
      { kind: 'tone', wave: 'sine', freq: 740, dur: 0.40, gain: 0.08, attack: 0.034, delay: 0.06 }
    ]
  });

  cue('barrier.up', {
    priority: 70, group: 'barrier', minGap: 0.10,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 392, freqEnd: 1046, dur: 0.34, gain: 0.10, attack: 0.030 },
      { kind: 'noise', filter: 'bandpass', freq: 3200, freqEnd: 1400, q: 4.0, dur: 0.28, gain: 0.05, rate: 1.0 }
    ]
  });

  /* Barrera comiéndose un golpe. Corto y vítreo: el jugador tiene que oír que
     el daño NO ha entrado en la vida, o gastará un cleanse que no necesita. */
  cue('barrier.absorb', {
    priority: 72, group: 'absorb', minGap: 0.06,
    layers: [
      { kind: 'tone', wave: 'square', freq: 1760, freqEnd: 988, dur: 0.09, gain: 0.09, attack: 0.002 },
      { kind: 'noise', filter: 'highpass', freq: 5200, freqEnd: 2600, q: 7.0, dur: 0.11, gain: 0.07, rate: 1.6 }
    ]
  });

  /* --- Casteo ------------------------------------------------------------- */

  cue('cast.start', {
    priority: 40, group: 'cast', minGap: 0.08, timbre: 'weapon',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 220, freqEnd: 560, dur: 0.42, gain: 0.06, attack: 0.10 }
    ]
  });

  /* EL sonido más importante del juego: el rival ha empezado algo y todavía
     estoy a tiempo de interrumpirlo, romper visión o salir de rango. Sube de
     tono (telegrafía) y lleva prioridad de evento mayor. */
  cue('cast.enemy', {
    priority: 90, group: 'castEnemy', minGap: 0.12, timbre: 'weapon',
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 165, freqEnd: 330, dur: 0.50, gain: 0.10, attack: 0.055 },
      { kind: 'tone', wave: 'sine', freq: 330, freqEnd: 660, dur: 0.45, gain: 0.07, attack: 0.070, delay: 0.04 }
    ]
  });

  cue('cast.release', {
    priority: 58, group: 'release', minGap: 0.05, timbre: 'weapon',
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 1600, freqEnd: 420, q: 2.4, dur: 0.13, gain: 0.11, rate: 1.2 },
      { kind: 'tone', wave: 'sawtooth', freq: 660, freqEnd: 1320, dur: 0.16, gain: 0.08 }
    ]
  });

  cue('cast.cancel', {
    priority: 30, group: 'cancel', minGap: 0.10,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 420, freqEnd: 262, dur: 0.10, gain: 0.05, attack: 0.006 }
    ]
  });

  /* Interrumpir un cast decide peleas: se oye por encima de casi todo. */
  cue('interrupt', {
    priority: 92, group: 'interrupt', minGap: 0.08,
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 1800, freqEnd: 180, q: 5.0, dur: 0.20, gain: 0.20, rate: 1.0 },
      { kind: 'tone', wave: 'square', freq: 190, freqEnd: 72, dur: 0.17, gain: 0.11 }
    ]
  });

  /* --- Control (uno por tipo) ---------------------------------------------
   *
   * La clave `cc.<effectId>` se construye con DATOS del evento. Añadir un
   * estado de control nuevo es añadir una fila aquí, nunca un condicional. */

  cue('cc.knockdown', {
    priority: 80, group: 'cc', minGap: 0.06,
    layers: [
      { kind: 'tone', wave: 'square', freq: 120, freqEnd: 42, dur: 0.34, gain: 0.19 },
      { kind: 'noise', filter: 'lowpass', freq: 190, freqEnd: 52, q: 0.5, dur: 0.38, gain: 0.20, rate: 0.8 }
    ]
  });

  cue('cc.stun', {
    priority: 80, group: 'cc', minGap: 0.06,
    layers: [
      { kind: 'tone', wave: 'square', freq: 300, freqEnd: 96, dur: 0.26, gain: 0.17 },
      { kind: 'noise', filter: 'bandpass', freq: 900, freqEnd: 160, q: 2.0, dur: 0.22, gain: 0.15, rate: 1.0 }
    ]
  });

  cue('cc.silence', {
    priority: 78, group: 'cc', minGap: 0.06,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 700, freqEnd: 150, dur: 0.30, gain: 0.12, attack: 0.020 },
      { kind: 'noise', filter: 'bandpass', freq: 2600, freqEnd: 300, q: 6.0, dur: 0.26, gain: 0.11, rate: 1.0 }
    ]
  });

  cue('cc.root', {
    priority: 74, group: 'cc', minGap: 0.06,
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 150, freqEnd: 96, dur: 0.40, gain: 0.14, attack: 0.030 },
      { kind: 'noise', filter: 'bandpass', freq: 380, freqEnd: 110, q: 1.2, dur: 0.34, gain: 0.13, rate: 0.7 }
    ]
  });

  cue('cc.disarm', {
    priority: 76, group: 'cc', minGap: 0.06,
    layers: [
      { kind: 'tone', wave: 'square', freq: 980, freqEnd: 220, dur: 0.18, gain: 0.12 },
      { kind: 'noise', filter: 'highpass', freq: 4400, freqEnd: 900, q: 6.0, dur: 0.22, gain: 0.11, rate: 1.3 }
    ]
  });

  /* Estasis aísla por completo: cristalino y ascendente, no se parece a nada
     más del catálogo porque tampoco se juega como nada más. */
  cue('cc.stasis', {
    priority: 84, group: 'cc', minGap: 0.06,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 1320, freqEnd: 1980, dur: 0.45, gain: 0.11, attack: 0.120 },
      { kind: 'tone', wave: 'sine', freq: 660, dur: 0.50, gain: 0.07, attack: 0.090, delay: 0.05 }
    ]
  });

  cue('cc.utilityLock', {
    priority: 70, group: 'cc', minGap: 0.06,
    layers: [
      { kind: 'tone', wave: 'square', freq: 520, freqEnd: 300, dur: 0.20, gain: 0.10 },
      { kind: 'noise', filter: 'bandpass', freq: 1200, freqEnd: 600, q: 3.5, dur: 0.16, gain: 0.08, rate: 1.0 }
    ]
  });

  cue('cc.slow', {
    priority: 56, group: 'ccSoft', minGap: 0.08,
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 300, freqEnd: 150, dur: 0.22, gain: 0.11 }
    ]
  });

  /** Red de seguridad: un control sin fila propia NO cae en silencio. */
  cue('cc.generic', {
    priority: 66, group: 'ccSoft', minGap: 0.08,
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 262, freqEnd: 131, dur: 0.19, gain: 0.10 },
      { kind: 'noise', filter: 'bandpass', freq: 800, freqEnd: 400, q: 2.0, dur: 0.15, gain: 0.07, rate: 1.0 }
    ]
  });

  /* DR agotada: el control NO ha entrado. Suena a golpe amortiguado. */
  cue('cc.fatigue', {
    priority: 66, group: 'ccDenied', minGap: 0.10,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 200, freqEnd: 152, dur: 0.16, gain: 0.09 },
      { kind: 'noise', filter: 'lowpass', freq: 700, freqEnd: 300, q: 2.0, dur: 0.12, gain: 0.06, rate: 0.9 }
    ]
  });

  /* --- Counters ----------------------------------------------------------- */

  cue('counter.block', {
    priority: 86, group: 'counter', minGap: 0.07,
    layers: [
      { kind: 'tone', wave: 'square', freq: 1320, freqEnd: 660, dur: 0.16, gain: 0.13 },
      { kind: 'noise', filter: 'bandpass', freq: 4200, freqEnd: 1800, q: 6.0, dur: 0.20, gain: 0.13, rate: 1.0 }
    ]
  });

  cue('counter.nullify', {
    priority: 86, group: 'counter', minGap: 0.07,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 880, freqEnd: 220, dur: 0.22, gain: 0.12, attack: 0.004 },
      { kind: 'noise', filter: 'bandpass', freq: 1900, freqEnd: 300, q: 4.0, dur: 0.18, gain: 0.10, rate: 0.95 }
    ]
  });

  cue('counter.reflect', {
    priority: 88, group: 'counter', minGap: 0.07,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 440, freqEnd: 1760, dur: 0.26, gain: 0.13 },
      { kind: 'noise', filter: 'bandpass', freq: 3000, freqEnd: 900, q: 5.0, dur: 0.24, gain: 0.10, rate: 1.1 }
    ]
  });

  cue('counter.immune', {
    priority: 80, group: 'counter', minGap: 0.10,
    layers: [
      { kind: 'tone', wave: 'square', freq: 1560, dur: 0.10, gain: 0.10, attack: 0.003 },
      { kind: 'noise', filter: 'highpass', freq: 6000, freqEnd: 3000, q: 8.0, dur: 0.12, gain: 0.08, rate: 1.7 }
    ]
  });

  /* --- Disipación --------------------------------------------------------- */

  cue('dispel.cleanse', {
    priority: 72, group: 'dispel', minGap: 0.09,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 660, freqEnd: 1320, dur: 0.28, gain: 0.10, attack: 0.018 },
      { kind: 'noise', filter: 'highpass', freq: 3800, freqEnd: 1900, q: 5.0, dur: 0.20, gain: 0.06, rate: 1.2 }
    ]
  });

  cue('dispel.purge', {
    priority: 74, group: 'dispel', minGap: 0.09,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 1320, freqEnd: 330, dur: 0.24, gain: 0.11 },
      { kind: 'noise', filter: 'bandpass', freq: 2800, freqEnd: 700, q: 4.0, dur: 0.22, gain: 0.09, rate: 1.0 }
    ]
  });

  /* --- Rechazo de input (sólo del jugador) --------------------------------
   *
   * Cuatro "noes" distintos, porque la corrección es distinta en cada caso:
   * acercarse, girarse, romper la columna o esperar maná. Un único beep genérico
   * obliga a mirar el HUD, que es justo lo que el audio debe evitar. */

  cue('deny.resource', {
    priority: 44, group: 'deny', minGap: 0.25,
    layers: [
      { kind: 'tone', wave: 'square', freq: 150, dur: 0.09, gain: 0.07 },
      { kind: 'tone', wave: 'sine', freq: 110, dur: 0.12, gain: 0.06, delay: 0.055 }
    ]
  });

  cue('deny.range', {
    priority: 44, group: 'deny', minGap: 0.25,
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 420, freqEnd: 300, dur: 0.11, gain: 0.06 },
      { kind: 'tone', wave: 'triangle', freq: 300, dur: 0.09, gain: 0.05, delay: 0.090 }
    ]
  });

  cue('deny.los', {
    priority: 44, group: 'deny', minGap: 0.25,
    layers: [
      { kind: 'noise', filter: 'lowpass', freq: 300, freqEnd: 180, q: 1.0, dur: 0.14, gain: 0.10, rate: 0.8 }
    ]
  });

  cue('deny.facing', {
    priority: 46, group: 'deny', minGap: 0.25,
    layers: [
      { kind: 'tone', wave: 'square', freq: 380, dur: 0.07, gain: 0.06 },
      { kind: 'tone', wave: 'square', freq: 304, dur: 0.07, gain: 0.06, delay: 0.080 }
    ]
  });

  cue('deny.notReady', {
    priority: 38, group: 'deny', minGap: 0.25,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 240, dur: 0.06, gain: 0.045 }
    ]
  });

  cue('deny.control', {
    priority: 48, group: 'deny', minGap: 0.25,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 196, freqEnd: 147, dur: 0.13, gain: 0.07 }
    ]
  });

  cue('deny.generic', {
    priority: 36, group: 'deny', minGap: 0.25,
    layers: [
      { kind: 'tone', wave: 'square', freq: 180, dur: 0.08, gain: 0.055 }
    ]
  });

  /* --- Disponibilidad ------------------------------------------------------ */

  cue('ready.cooldown', {
    priority: 32, group: 'ready', minGap: 0.12,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 1046, dur: 0.09, gain: 0.05 }
    ]
  });

  cue('ready.weapon', {
    priority: 24, group: 'ready', minGap: 0.12, timbre: 'weapon',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 1320, freqEnd: 1568, dur: 0.06, gain: 0.035 }
    ]
  });

  /* --- Muerte -------------------------------------------------------------- */

  cue('death.self', {
    priority: 100, group: 'death', minGap: 0.30,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 220, freqEnd: 38, dur: 0.95, gain: 0.20 },
      { kind: 'noise', filter: 'lowpass', freq: 500, freqEnd: 60, q: 0.7, dur: 0.85, gain: 0.16, rate: 0.7 }
    ]
  });

  cue('death.other', {
    priority: 78, group: 'death', minGap: 0.20,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 300, freqEnd: 60, dur: 0.60, gain: 0.14 },
      { kind: 'noise', filter: 'lowpass', freq: 700, freqEnd: 110, q: 1.0, dur: 0.55, gain: 0.12, rate: 0.9 }
    ]
  });

  /* --- Movimiento y mundo --------------------------------------------------- */

  cue('dash', {
    priority: 30, group: 'move', minGap: 0.10,
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 700, freqEnd: 2400, q: 1.5, dur: 0.22, gain: 0.13, rate: 1.4 }
    ]
  });

  cue('jump', {
    priority: 18, group: 'move', minGap: 0.10,
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 480, freqEnd: 900, q: 1.0, dur: 0.10, gain: 0.07, rate: 1.15 }
    ]
  });

  cue('land', {
    priority: 20, group: 'move', minGap: 0.10,
    layers: [
      { kind: 'noise', filter: 'lowpass', freq: 260, freqEnd: 90, q: 0.8, dur: 0.13, gain: 0.10, rate: 0.75 },
      { kind: 'tone', wave: 'sine', freq: 124, freqEnd: 70, dur: 0.10, gain: 0.08 }
    ]
  });

  cue('zone.trigger', {
    priority: 62, group: 'zone', minGap: 0.10,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 300, freqEnd: 180, dur: 0.30, gain: 0.10, attack: 0.020 },
      { kind: 'noise', filter: 'bandpass', freq: 900, freqEnd: 200, q: 2.0, dur: 0.26, gain: 0.09, rate: 0.9 }
    ]
  });

  cue('resource.drain', {
    priority: 52, group: 'resource', minGap: 0.10,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 500, freqEnd: 180, dur: 0.26, gain: 0.09, attack: 0.020 }
    ]
  });

  cue('stealth.break', {
    priority: 64, group: 'stealth', minGap: 0.15,
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 2000, freqEnd: 800, q: 3.0, dur: 0.18, gain: 0.10, rate: 1.25 },
      { kind: 'tone', wave: 'triangle', freq: 880, freqEnd: 440, dur: 0.14, gain: 0.08 }
    ]
  });

  /* --- Producto e interfaz ------------------------------------------------- */

  cue('roundStart', {
    priority: 96, group: 'product', minGap: 0.20,
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 330, freqEnd: 660, dur: 0.18, gain: 0.10 },
      { kind: 'tone', wave: 'sine', freq: 660, freqEnd: 990, dur: 0.24, gain: 0.12, delay: 0.16 }
    ]
  });

  cue('victory', {
    priority: 98, group: 'product', minGap: 0.20,
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 392, freqEnd: 784, dur: 0.34, gain: 0.11 },
      { kind: 'tone', wave: 'sine', freq: 523, freqEnd: 1046, dur: 0.42, gain: 0.10, delay: 0.18 },
      { kind: 'tone', wave: 'sine', freq: 659, dur: 0.52, gain: 0.07, delay: 0.34 }
    ]
  });

  cue('defeat', {
    priority: 98, group: 'product', minGap: 0.20,
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 220, freqEnd: 82, dur: 0.52, gain: 0.09 },
      { kind: 'tone', wave: 'sine', freq: 146, freqEnd: 73, dur: 0.70, gain: 0.10, delay: 0.14 }
    ]
  });

  cue('uiSelect', {
    priority: 12, group: 'ui', minGap: 0.03,
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 520, freqEnd: 620, dur: 0.045, gain: 0.035 }
    ]
  });

  cue('uiConfirm', {
    priority: 14, group: 'ui', minGap: 0.03,
    layers: [
      { kind: 'tone', wave: 'sine', freq: 440, freqEnd: 760, dur: 0.09, gain: 0.05 }
    ]
  });

  A.bank = BANK;
  A.hasCue = function (id) { return !!BANK[id]; };

  /* =========================================================================
   * 6. Resolución: cue + contexto → especificación audible
   *
   * Función PURA. No toca el contexto de audio, no reserva voces y no muta
   * nada. Se puede llamar en Node para comprobar que un martillo y un arco no
   * producen el mismo espectro.
   * ====================================================================== */

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /** Atenuación por distancia: cerca suena entero, lejos se apaga y se
   *  oscurece. No hay panorámica: el jugador gira la cámara constantemente y un
   *  paneo por posición mundial daría información falsa. */
  function distanceFalloff(dist) {
    if (dist === null || dist === undefined) return { gain: 1, tone: 1 };
    if (dist <= NEAR_DIST) return { gain: 1, tone: 1 };
    if (dist >= FAR_DIST) return { gain: 0, tone: 0.55 };
    var t = (FAR_DIST - dist) / (FAR_DIST - NEAR_DIST);
    var g = Math.pow(t, 1.7);
    return { gain: g, tone: 0.55 + 0.45 * g };
  }
  A.distanceFalloff = distanceFalloff;

  /**
   * @param {string} cueId
   * @param {object} opts  { weapon, archetype, perspective, distance, power, gain }
   * @returns {object|null} { cueId, priority, group, minGap, dur, layers[] }
   */
  A.resolve = function (cueId, opts) {
    var def = BANK[cueId];
    if (!def) return null;
    opts = opts || {};

    var mat  = MATERIAL[opts.weapon] || MATERIAL.none;
    var arch = ARCHETYPE_TIMBRE[opts.archetype] || null;
    var persp = PERSPECTIVE[opts.perspective] || PERSPECTIVE.neutral;

    var useTimbre = def.timbre === 'weapon';
    var matFreq = useTimbre ? mat.freqMul : 1;
    var matNoise = useTimbre ? mat.noiseMul : 1;
    var matDur = useTimbre ? mat.durMul : 1;
    var matQ = useTimbre ? mat.qMul : 1;
    var matGain = useTimbre ? mat.gainMul : 1;
    if (useTimbre && arch) {
      matFreq *= arch.freqMul; matDur *= arch.durMul; matGain *= arch.gainMul;
    }

    var dist = persp.ignoreDistance ? null : opts.distance;
    var fall = distanceFalloff(dist);
    if (fall.gain <= 0) return null;   // fuera del radio audible: no es un cue

    var power = opts.power === undefined ? 0 : clamp01(opts.power);
    var powerGain = (def.powerGain || 0) * power;
    var powerFreq = (def.powerFreq || 0) * power;

    var gainScale = fall.gain * persp.gainMul * matGain * (opts.gain === undefined ? 1 : opts.gain);
    var freqScale = fall.tone * persp.freqMul;
    var j = jitter();

    var out = [];
    var longest = 0;
    for (var i = 0; i < def.layers.length; i++) {
      var L = def.layers[i];
      var isNoise = L.kind === 'noise';
      var scale = (isNoise ? matNoise : matFreq) * freqScale * j;
      var dur = (L.dur || 0.15) * matDur;
      var delay = L.delay || 0;
      var spec = {
        kind: L.kind,
        wave: L.wave || 'sine',
        filter: L.filter || 'bandpass',
        freq: Math.max(20, (L.freq || 440) * scale + powerFreq),
        freqEnd: L.freqEnd === undefined ? null : Math.max(20, L.freqEnd * scale),
        q: (L.q === undefined ? 1 : L.q) * matQ,
        dur: dur,
        attack: L.attack === undefined ? (isNoise ? 0.004 : 0.008) : L.attack,
        gain: Math.max(0, (L.gain || 0.1) + powerGain) * gainScale,
        delay: delay,
        rate: L.rate || 1
      };
      if (spec.attack >= spec.dur) spec.attack = spec.dur * 0.4;
      out.push(spec);
      if (delay + dur > longest) longest = delay + dur;
    }

    return {
      cueId: cueId,
      priority: def.priority + persp.priorityBonus,
      group: def.group,
      minGap: def.minGap,
      dur: longest,
      layers: out
    };
  };

  /* =========================================================================
   * 7. Política de voces
   *
   * Tres filtros en cascada, del más barato al más caro:
   *
   *   a) AGRUPAMIENTO — un mismo grupo no se repite dentro de su ventana. Es
   *      lo que convierte ocho tics de daño en un golpe legible.
   *   b) SUELO DE PRIORIDAD — tras un evento grande (muerte, control duro,
   *      interrupción) los eventos menores se callan un instante. Sin esto el
   *      momento importante llega tapado por su propia consecuencia.
   *   c) LÍMITE DE VOCES — techo duro de capas simultáneas. Al llegar al techo
   *      un cue sólo entra si es MÁS importante que la voz más floja viva, y
   *      entonces se la roba.
   *
   * Todo funciona sobre A.now(), no sobre callbacks del navegador: la política
   * es comprobable sin WebAudio.
   * ====================================================================== */

  A._reap = function (now) {
    var kept = [];
    for (var i = 0; i < A.voices.length; i++) {
      if (A.voices[i].endsAt > now) kept.push(A.voices[i]);
    }
    A.voices = kept;
  };

  /** Suelo de prioridad vigente. Decae linealmente hasta desaparecer. */
  A.priorityFloor = function (now) {
    var d = A._duck;
    if (now >= d.until || d.level <= 0) return 0;
    var span = d.until - d.from;
    if (span <= 0) return 0;
    return d.level * ((d.until - now) / span);
  };

  A._duckFor = function (priority, now) {
    if (priority < DUCK_PRIORITY) return;
    var level = Math.max(0, priority - DUCK_DEPTH);
    if (level <= A.priorityFloor(now)) return;
    A._duck = { level: level, from: now, until: now + DUCK_SECONDS };
  };

  /** ¿Entra este cue? Reserva las voces si sí. Devuelve true/false. */
  A._admit = function (spec, now, layerCount) {
    A._reap(now);

    var last = A._lastAt[spec.group];
    if (last !== undefined && now - last < spec.minGap) {
      A.stats.droppedByGroup++;
      return false;
    }

    if (spec.priority < A.priorityFloor(now)) {
      A.stats.droppedByDuck++;
      return false;
    }

    var need = layerCount;
    while (A.voices.length + need > A.maxVoices) {
      var worst = -1, worstPri = spec.priority;
      for (var i = 0; i < A.voices.length; i++) {
        if (A.voices[i].priority < worstPri) { worstPri = A.voices[i].priority; worst = i; }
      }
      if (worst < 0) { A.stats.droppedByVoices++; return false; }
      A._stop(A.voices[worst], now);
      A.voices.splice(worst, 1);
      A.stats.stolen++;
    }

    A._lastAt[spec.group] = now;
    A._duckFor(spec.priority, now);
    return true;
  };

  A._stop = function (voice, now) {
    for (var i = 0; i < voice.nodes.length; i++) {
      var n = voice.nodes[i];
      try { if (n && n.stop) n.stop(now); } catch (e) { /* ya parado */ }
    }
  };

  /* =========================================================================
   * 8. Síntesis
   * ====================================================================== */

  A._noiseBuffer = null;

  /** Ruido blanco pregenerado y reutilizado. Sembrado: el mismo build produce
   *  siempre el mismo ruido, así una diferencia audible significa algo. */
  function noiseBuffer() {
    if (A._noiseBuffer) return A._noiseBuffer;
    var len = Math.floor((A.ctx.sampleRate || 44100) * 0.6);
    var buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate || 44100);
    var d = buf.getChannelData(0);
    var rng = makeRng(AUDIO_SEED ^ 0x5EED);
    for (var i = 0; i < len; i++) d[i] = rng.next() * 2 - 1;
    A._noiseBuffer = buf;
    return buf;
  }

  function envelope(ctx, t, spec, dest) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, spec.gain), t + spec.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
    g.connect(dest);
    return g;
  }

  /** Crea los nodos de una capa. Devuelve la fuente para poder robarla luego. */
  A._renderLayer = function (spec, startAt) {
    var ctx = A.ctx;
    var t = startAt + spec.delay;

    if (spec.kind === 'noise') {
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer();
      if (src.playbackRate) src.playbackRate.value = spec.rate;

      var filter = ctx.createBiquadFilter();
      filter.type = spec.filter;
      filter.frequency.setValueAtTime(spec.freq, t);
      if (spec.freqEnd !== null) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, spec.freqEnd), t + spec.dur);
      }
      filter.Q.value = spec.q;

      var ng = envelope(ctx, t, spec, A.master);
      src.connect(filter); filter.connect(ng);
      src.start(t);
      src.stop(t + spec.dur + 0.02);
      return src;
    }

    var osc = ctx.createOscillator();
    osc.type = spec.wave;
    osc.frequency.setValueAtTime(spec.freq, t);
    if (spec.freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.freqEnd), t + spec.dur);
    }
    var og = envelope(ctx, t, spec, A.master);
    osc.connect(og);
    osc.start(t);
    osc.stop(t + spec.dur + 0.02);
    return osc;
  };

  /* =========================================================================
   * 9. Reproducción
   * ====================================================================== */

  /**
   * Toca un cue. Devuelve true si fue admitido por la política de voces.
   * Nunca lanza: sin contexto de audio se limita a decidir y no sintetizar.
   */
  A.play = function (cueId, opts) {
    if (!A.enabled) return false;
    var spec = A.resolve(cueId, opts);
    if (!spec || !spec.layers.length) return false;

    var now = A.now();
    if (!A._admit(spec, now, spec.layers.length)) return false;
    A.stats.played++;

    if (!A.ctx || !A.master) {
      // Sin WebAudio la reserva de voces sigue siendo real: así el
      // comportamiento de la política es idéntico con y sin navegador.
      A.voices.push({ cueId: cueId, priority: spec.priority, endsAt: now + spec.dur, nodes: [] });
      return true;
    }

    var nodes = [];
    for (var i = 0; i < spec.layers.length; i++) {
      var node = null;
      try { node = A._renderLayer(spec.layers[i], now); } catch (e) { node = null; }
      var L = spec.layers[i];
      A.voices.push({
        cueId: cueId, priority: spec.priority,
        endsAt: now + L.delay + L.dur, nodes: node ? [node] : []
      });
      if (node) nodes.push(node);
    }
    return true;
  };

  /* =========================================================================
   * 10. Fachada `A.sounds`
   *
   * Compatibilidad con main.js y ui/gameShell.js, que llaman por nombre. Es una
   * capa fina sobre el banco: aquí no se decide timbre ninguno.
   * ====================================================================== */

  function facade(cueId, optsFn) {
    return function (arg) {
      return A.play(cueId, optsFn ? optsFn(arg) : undefined);
    };
  }
  function power(p) { return { power: p === undefined ? 0.5 : p, perspective: 'self' }; }

  A.sounds = {
    hitPhysical:  facade('power.hit.physical', power),
    hitMagical:   facade('power.hit.magical', power),
    hitTaken:     facade('power.taken', power),
    normalHit:    facade('normal.hit', power),
    crit:         facade('crit', power),
    heal:         facade('heal'),
    barrier:      facade('barrier.up'),
    barrierAbsorb: facade('barrier.absorb'),
    castStart:    function (magic) { return A.play('cast.start', { weapon: magic ? 'staff' : 'sword' }); },
    castComplete: function (magic) { return A.play('cast.release', { weapon: magic ? 'staff' : 'sword' }); },
    enemyCast:    facade('cast.enemy'),
    interrupt:    facade('interrupt'),
    hardCC:       facade('cc.stun'),
    softCC:       facade('cc.slow'),
    counter:      facade('counter.block'),
    reflect:      facade('counter.reflect'),
    death:        facade('death.other'),
    dash:         facade('dash'),
    reject:       facade('deny.generic'),
    ready:        facade('ready.cooldown'),
    roundStart:   facade('roundStart'),
    victory:      facade('victory'),
    defeat:       facade('defeat'),
    uiSelect:     facade('uiSelect'),
    uiConfirm:    facade('uiConfirm')
  };

  /* =========================================================================
   * 11. Lectura del mundo — SÓLO LECTURA
   * ====================================================================== */

  function playerId() {
    return A._getPlayerId ? A._getPlayerId() : null;
  }

  function entity(id) {
    return (A._world && id) ? A._world.getEntity(id) : null;
  }

  /** self / ally / enemy / neutral, desde el punto de vista del jugador. */
  A.perspectiveOf = function (entityId) {
    var pid = playerId();
    if (!pid || !entityId) return 'neutral';
    if (entityId === pid) return 'self';
    var me = entity(pid), other = entity(entityId);
    if (!me || !other) return 'neutral';
    if (me.team === other.team) return 'ally';
    return 'enemy';
  };

  /** Distancia XZ al jugador, o null si no se puede saber (no atenúa). */
  A.distanceTo = function (entityId) {
    var pid = playerId();
    if (!pid || !entityId || entityId === pid) return null;
    var me = entity(pid), other = entity(entityId);
    if (!me || !other) return null;
    return V.distXZ(me.pos, other.pos);
  };

  /** Timbre del actor: arma + arquetipo, ambos DATO de la clase. */
  function timbreOf(entityId) {
    var e = entity(entityId);
    if (!e) return {};
    return {
      weapon: Arena.Data.weaponOf ? Arena.Data.weaponOf(e.classId) : 'none',
      archetype: Arena.Data.archetypeOf ? Arena.Data.archetypeOf(e.classId) : null
    };
  }

  /** Contexto acústico completo de un evento: quién lo hace, a quién le pasa. */
  function ctxFor(actorId, subjectId) {
    var t = timbreOf(actorId || subjectId);
    return {
      weapon: t.weapon,
      archetype: t.archetype,
      perspective: A.perspectiveOf(subjectId),
      distance: A.distanceTo(subjectId)
    };
  }
  A._ctxFor = ctxFor;

  function abilityOf(id) {
    return (Arena.Data.abilities && id) ? Arena.Data.abilities[id] : null;
  }

  /** Magnitud normalizada del golpe: escala volumen y cuerpo del impacto. */
  function magnitude(amount, target) {
    var max = (target && target.hpMax) ? target.hpMax * 0.18 : 220;
    return clamp01((amount || 0) / max);
  }

  /* =========================================================================
   * 12. Enrutado de eventos
   *
   * Una tabla `tipo de evento → decisión`. Ninguna entrada pregunta por un id
   * de habilidad concreto: la clave del cue se CONSTRUYE con datos del evento
   * (escuela de daño, id de efecto, motivo de rechazo) y el banco resuelve.
   * Un contenido nuevo suena solo.
   *
   * Cada ruta devuelve el id de cue elegido (o null). Devolverlo es lo que
   * permite auditar la cobertura sin escuchar nada.
   * ====================================================================== */

  /** Elige el primer cue existente de una lista de candidatos. Así una clave
   *  específica cae con elegancia en su familia y nunca en el silencio. */
  function pick(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] && BANK[candidates[i]]) return candidates[i];
    }
    return null;
  }

  var ROUTES = {

    /* --- Daño ------------------------------------------------------------- */
    DamageApplied: function (p) {
      if ((p.applied || 0) <= 0 && (p.absorbed || 0) <= 0) return null;
      var target = entity(p.targetId);
      var persp = A.perspectiveOf(p.targetId);
      var mine = p.sourceId && p.sourceId === playerId();
      var normal = p.abilityId === 'auto_attack';

      // Un golpe que se come entera la barrera no es un golpe: es información
      // distinta y suena distinta.
      if ((p.applied || 0) <= 0.001 && (p.absorbed || 0) > 0) return null; // lo cuenta BarrierAbsorbed

      var id;
      if (p.crit && (persp === 'self' || mine)) id = 'crit';
      else if (persp === 'self') id = normal ? 'normal.taken' : 'power.taken';
      else if (normal) id = 'normal.hit';
      else id = pick(['power.hit.' + (p.school || 'physical'), 'power.hit.physical']);

      var c = ctxFor(p.sourceId, p.targetId);
      c.power = magnitude(p.applied, target);
      if (persp !== 'self' && !mine) c.gain = 0.62;   // el combate ajeno es fondo
      return A.play(id, c) ? id : id;
    },

    DamageImmune: function (p) {
      var c = ctxFor(p.sourceId, p.targetId);
      A.play('counter.immune', c);
      return 'counter.immune';
    },

    /* --- Ataque normal ----------------------------------------------------- */
    WeaponWindupStarted: function () { return null; },   // la anticipación es visual

    AutoAttackReleased: function (p) {
      var c = ctxFor(p.casterId, p.casterId);
      A.play('normal.swing', c);
      return 'normal.swing';
    },

    WeaponReady: function (p) {
      if (p.casterId !== playerId()) return null;
      A.play('ready.weapon', ctxFor(p.casterId, p.casterId));
      return 'ready.weapon';
    },

    /* --- Curación y barreras ----------------------------------------------- */
    HealApplied: function (p) {
      if ((p.applied || 0) < 1) return null;
      var persp = A.perspectiveOf(p.targetId);
      var id = persp === 'self' ? 'heal.taken' : 'heal';
      var c = ctxFor(p.sourceId, p.targetId);
      A.play(id, c);
      return id;
    },

    BarrierApplied: function (p) {
      var c = ctxFor(p.sourceId, p.targetId);
      A.play('barrier.up', c);
      return 'barrier.up';
    },

    BarrierAbsorbed: function (p) {
      var c = ctxFor(p.sourceId, p.targetId);
      A.play('barrier.absorb', c);
      return 'barrier.absorb';
    },

    /* --- Casteo ------------------------------------------------------------ */
    AbilityCastStarted: function (p) {
      var persp = A.perspectiveOf(p.casterId);
      // El casteo del RIVAL es la señal que abre la ventana de reacción.
      var id = persp === 'enemy' ? 'cast.enemy' : 'cast.start';
      A.play(id, ctxFor(p.casterId, p.casterId));
      return id;
    },

    AbilityReleased: function (p) {
      var ab = abilityOf(p.abilityId);
      var c = ctxFor(p.casterId, p.casterId);
      if (ab && ab.flags && ab.flags.magic) c.weapon = 'staff';
      A.play('cast.release', c);
      return 'cast.release';
    },

    AbilityCastInterrupted: function (p) {
      if (p.reason === 'cancelled') {
        A.play('cast.cancel', ctxFor(p.casterId, p.casterId));
        return 'cast.cancel';
      }
      A.play('interrupt', ctxFor(p.casterId, p.casterId));
      return 'interrupt';
    },

    AbilityCastCancelled: function (p) {
      A.play('cast.cancel', ctxFor(p.casterId, p.casterId));
      return 'cast.cancel';
    },

    /* --- Estados ----------------------------------------------------------- */
    StatusApplied: function (p) {
      var d = Arena.Data.effects ? Arena.Data.effects[p.effect] : null;
      if (!d || d.passiveAura) return null;
      if (d.kind !== 'cc') return null;               // buffs/debuffs no suenan solos
      var id = pick(['cc.' + p.effect, 'cc.' + (d.drCategory || ''), 'cc.generic']);
      A.play(id, ctxFor(p.sourceId, p.targetId));
      return id;
    },

    EffectImmune: function (p) {
      A.play('counter.immune', ctxFor(p.sourceId, p.targetId));
      return 'counter.immune';
    },

    EffectBlocked: function (p) {
      A.play('counter.nullify', ctxFor(p.sourceId, p.targetId));
      return 'counter.nullify';
    },

    CCFatigued: function (p) {
      A.play('cc.fatigue', ctxFor(null, p.targetId));
      return 'cc.fatigue';
    },

    Cleansed: function (p) {
      A.play('dispel.cleanse', ctxFor(p.sourceId, p.targetId));
      return 'dispel.cleanse';
    },

    Purged: function (p) {
      A.play('dispel.purge', ctxFor(p.sourceId, p.targetId));
      return 'dispel.purge';
    },

    StealthBroken: function (p) {
      A.play('stealth.break', ctxFor(p.entityId, p.entityId));
      return 'stealth.break';
    },

    /* --- Counters ---------------------------------------------------------- */
    AbilityBlocked: function (p) {
      A.play('counter.block', ctxFor(p.casterId, p.targetId));
      return 'counter.block';
    },

    AbilityNullified: function (p) {
      A.play('counter.nullify', ctxFor(p.casterId, p.targetId));
      return 'counter.nullify';
    },

    AbilityReflected: function (p) {
      A.play('counter.reflect', ctxFor(p.casterId, p.targetId));
      return 'counter.reflect';
    },

    HealBlocked: function (p) {
      A.play('counter.nullify', ctxFor(p.sourceId, p.targetId));
      return 'counter.nullify';
    },

    /* --- Rechazo de input --------------------------------------------------
     *
     * Sólo del jugador: oír por qué NO ha salido la habilidad de un bot no
     * aporta nada y sería puro ruido. */
    AbilityRejected: function (p) {
      if (p.casterId !== playerId()) return null;
      var id = pick(['deny.' + p.reason, DENY_FAMILY[p.reason], 'deny.generic']);
      A.play(id, { perspective: 'self' });
      return id;
    },

    /* --- Muerte ------------------------------------------------------------ */
    EntityDied: function (p) {
      var persp = A.perspectiveOf(p.entityId);
      var id = persp === 'self' ? 'death.self' : 'death.other';
      A.play(id, ctxFor(p.killerId, p.entityId));
      return id;
    },

    /* --- Movimiento y mundo ------------------------------------------------- */
    EntityDashed: function (p) {
      A.play('dash', ctxFor(p.entityId, p.entityId));
      return 'dash';
    },

    EntityJumped: function (p) {
      A.play('jump', ctxFor(p.entityId, p.entityId));
      return 'jump';
    },

    EntityLanded: function (p) {
      A.play('land', ctxFor(p.entityId, p.entityId));
      return 'land';
    },

    ZoneTriggered: function (p) {
      A.play('zone.trigger', ctxFor(p.casterId || p.sourceId, p.targetId || p.entityId));
      return 'zone.trigger';
    },

    ResourceDrained: function (p) {
      if (A.perspectiveOf(p.targetId) !== 'self') return null;
      A.play('resource.drain', { perspective: 'self' });
      return 'resource.drain';
    },

    /* --- Disponibilidad de poderes -----------------------------------------
     *
     * La simulación no emite "cooldown listo" porque no lo necesita para nada.
     * El audio lo DERIVA leyendo el estado en cada tick: leer nunca es decidir. */
    Tick: function (p) {
      var pid = playerId();
      var e = entity(pid);
      if (!e || !e.alive) return null;
      var now = p.time;
      var fired = null;
      for (var i = 0; i < e.abilities.length; i++) {
        var id = e.abilities[i];
        var remaining = e.cooldownRemaining ? e.cooldownRemaining(id, now) : 0;
        var wasOnCd = A._cdReady[id] === false;
        var ready = remaining <= 1e-6;
        if (ready && wasOnCd) fired = 'ready.cooldown';
        A._cdReady[id] = ready;
      }
      if (fired) A.play(fired, { perspective: 'self' });
      return fired;
    }
  };

  /** Motivos de rechazo sin sonido propio, agrupados por corrección del jugador. */
  var DENY_FAMILY = {
    gcd: 'deny.notReady',
    cooldown: 'deny.notReady',
    weaponInterval: 'deny.notReady',
    weaponWindup: 'deny.notReady',
    casting: 'deny.notReady',
    silenced: 'deny.control',
    stunned: 'deny.control',
    disarmed: 'deny.control',
    noOffense: 'deny.control',
    noDamage: 'deny.control',
    utilityLocked: 'deny.control',
    lockout: 'deny.control',
    moving: 'deny.control',
    airborne: 'deny.control'
  };
  A.DENY_FAMILY = DENY_FAMILY;

  A.routes = ROUTES;

  /**
   * Punto único de entrada del audio. Recibe un payload de evento tal cual lo
   * emite el bus y devuelve el id del cue elegido (o null si ese evento no
   * debe sonar en ese contexto).
   *
   * Es la costura de pruebas: permite auditar la cobertura y la ausencia de
   * escrituras sin montar un navegador.
   */
  A.handleEvent = function (payload) {
    if (!payload || !payload.type) return null;
    var route = ROUTES[payload.type];
    if (!route) return null;
    if (!A.enabled) return null;
    return route(payload) || null;
  };

  /* =========================================================================
   * 13. Instalación
   *
   * Los eventos del mundo son la única fuente. El audio no consulta reglas de
   * combate ni decide nada: si un sonido no suena, es que el evento no se
   * emitió, y eso convierte cada fallo acústico en una pista sobre la
   * simulación.
   * ====================================================================== */

  A.install = function (world, getPlayerId) {
    A.uninstall();
    if (!world || !world.bus) return A;

    A._world = world;
    A._getPlayerId = getPlayerId || function () {
      return world.getPlayer && world.getPlayer() ? world.getPlayer().id : null;
    };

    var bus = world.bus;
    for (var type in ROUTES) {
      if (!Object.prototype.hasOwnProperty.call(ROUTES, type)) continue;
      A._offs.push(bus.on(type, A.handleEvent));
    }

    // Cambiar de partida no debe arrastrar el estado de cooldowns anterior.
    A._offs.push(bus.on('WorldReset', function () { A._cdReady = Object.create(null); }));
    A._offs.push(bus.on('EntitySpawned', function () { A._cdReady = Object.create(null); }));
    return A;
  };

  A.uninstall = function () {
    for (var i = 0; i < A._offs.length; i++) {
      try { A._offs[i](); } catch (e) { /* ya desuscrito */ }
    }
    A._offs = [];
    A._world = null;
    A._getPlayerId = null;
    A._cdReady = Object.create(null);
    return A;
  };

  Arena.Audio = A;
});
