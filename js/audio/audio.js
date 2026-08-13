/* =============================================================================
 * audio/audio.js — Feedback sonoro sintetizado con Web Audio API.
 *
 * No hay un solo fichero de audio en el proyecto: cada sonido se genera en el
 * momento con osciladores y ruido filtrado. Coherente con la premisa de cero
 * dependencias y de abrir desde file:// (documento §21).
 *
 * Criterio de diseño sonoro, en orden de importancia:
 *   1. Cada impacto que recibo debe sonar distinto de cada impacto que doy.
 *   2. El control (noqueo, mareo) necesita un sonido inconfundible: es la
 *      información que decide si sigo peleando o me retiro.
 *   3. Los counters (bloqueo, reflejo, inmunidad) suenan metálicos y secos:
 *      son los momentos que el jugador debe recordar.
 *   4. Nada debe saturar. Un burst dispara ocho eventos en dos segundos.
 * ========================================================================== */
Arena.define('audio/audio', ['sim/world'], function (Arena) {
  'use strict';

  var A = {
    ctx: null,
    master: null,
    enabled: true,
    volume: 0.5,
    _lastAt: Object.create(null),
    _voices: 0
  };

  var MAX_VOICES = 24;

  /** El contexto se crea en el primer gesto del usuario: los navegadores
   *  bloquean el audio hasta entonces y crearlo antes deja un contexto muerto. */
  A.init = function () {
    if (A.ctx) return A.ctx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { A.enabled = false; return null; }
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = A.volume;

    // Compresor de seguridad: sin él, un AoE sobre cinco objetivos satura.
    var comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;

    A.master.connect(comp);
    comp.connect(A.ctx.destination);
    return A.ctx;
  };

  A.resume = function () {
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  A.setVolume = function (v) {
    A.volume = v;
    if (A.master) A.master.gain.value = v;
  };

  /** Anti-saturación: un mismo sonido no se repite más rápido que su ventana. */
  function gate(key, minGap) {
    var now = A.ctx ? A.ctx.currentTime : 0;
    if (A._lastAt[key] !== undefined && now - A._lastAt[key] < minGap) return false;
    A._lastAt[key] = now;
    return true;
  }

  function voice() {
    if (A._voices >= MAX_VOICES) return false;
    A._voices++;
    return true;
  }
  function releaseVoice(node, at) {
    node.onended = function () { A._voices = Math.max(0, A._voices - 1); };
  }

  /* --- Bloques de síntesis ------------------------------------------------ */

  var _noiseBuffer = null;
  function noiseBuffer() {
    if (_noiseBuffer) return _noiseBuffer;
    var len = Math.floor(A.ctx.sampleRate * 0.6);
    var buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    _noiseBuffer = buf;
    return buf;
  }

  /** Ráfaga de ruido filtrado: impactos, roces, viento. */
  function noise(opts) {
    if (!A.ctx || !voice()) return;
    var t = A.ctx.currentTime;
    var src = A.ctx.createBufferSource();
    src.buffer = noiseBuffer();
    src.playbackRate.value = opts.rate || 1;

    var filter = A.ctx.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 900, t);
    if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, opts.freqEnd), t + (opts.dur || 0.15));
    filter.Q.value = opts.q === undefined ? 1.0 : opts.q;

    var g = A.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain || 0.3, t + (opts.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opts.dur || 0.15));

    src.connect(filter); filter.connect(g); g.connect(A.master);
    releaseVoice(src);
    src.start(t);
    src.stop(t + (opts.dur || 0.15) + 0.02);
  }

  /** Tono con envolvente: magia, interfaz, avisos. */
  function tone(opts) {
    if (!A.ctx || !voice()) return;
    var t = A.ctx.currentTime + (opts.delay || 0);
    var osc = A.ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq || 440, t);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t + (opts.dur || 0.2));
    }

    var g = A.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain || 0.2, t + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opts.dur || 0.2));

    osc.connect(g); g.connect(A.master);
    releaseVoice(osc);
    osc.start(t);
    osc.stop(t + (opts.dur || 0.2) + 0.02);
  }

  /* --- Paleta de sonidos --------------------------------------------------- */

  A.sounds = {
    hitPhysical: function (power) {
      noise({ freq: 320 + power * 200, freqEnd: 90, q: 0.8, dur: 0.13,
              gain: 0.16 + power * 0.16, rate: 1.1 });
      tone({ type: 'triangle', freq: 150 - power * 30, freqEnd: 60,
             dur: 0.10, gain: 0.10 + power * 0.10 });
    },
    hitMagical: function (power) {
      tone({ type: 'sawtooth', freq: 880 + power * 260, freqEnd: 220,
             dur: 0.20, gain: 0.09 + power * 0.08 });
      noise({ freq: 2200, freqEnd: 500, filterType: 'bandpass', q: 3,
              dur: 0.18, gain: 0.07 });
    },
    hitTaken: function (power) {
      // Más grave y con más cuerpo: recibir tiene que sentirse distinto de dar.
      noise({ freq: 220, freqEnd: 60, q: 0.6, dur: 0.22, gain: 0.24 + power * 0.2 });
      tone({ type: 'sine', freq: 92, freqEnd: 48, dur: 0.26, gain: 0.24 });
    },
    heal: function () {
      tone({ type: 'sine', freq: 523, freqEnd: 784, dur: 0.30, gain: 0.11, attack: 0.02 });
      tone({ type: 'sine', freq: 659, dur: 0.34, gain: 0.07, delay: 0.05, attack: 0.03 });
    },
    barrier: function () {
      tone({ type: 'sine', freq: 392, freqEnd: 1046, dur: 0.34, gain: 0.10, attack: 0.03 });
      noise({ freq: 3200, freqEnd: 1400, q: 4, dur: 0.28, gain: 0.05 });
    },
    castStart: function (magic) {
      tone({ type: magic ? 'sine' : 'triangle', freq: magic ? 220 : 160,
             freqEnd: magic ? 560 : 300, dur: 0.42, gain: 0.06, attack: 0.10 });
    },
    castComplete: function (magic) {
      if (magic) tone({ type: 'sawtooth', freq: 660, freqEnd: 1320, dur: 0.16, gain: 0.09 });
      else noise({ freq: 1400, freqEnd: 400, q: 2, dur: 0.14, gain: 0.11 });
    },
    interrupt: function () {
      noise({ freq: 1800, freqEnd: 180, q: 5, dur: 0.20, gain: 0.20 });
      tone({ type: 'square', freq: 180, freqEnd: 70, dur: 0.16, gain: 0.10 });
    },
    hardCC: function () {
      // Golpe grave y contundente: la señal de "no puedes actuar".
      tone({ type: 'square', freq: 120, freqEnd: 42, dur: 0.34, gain: 0.20 });
      noise({ freq: 180, freqEnd: 50, q: 0.5, dur: 0.36, gain: 0.20 });
    },
    softCC: function () {
      tone({ type: 'triangle', freq: 300, freqEnd: 150, dur: 0.22, gain: 0.11 });
    },
    counter: function () {
      // Metálico y seco: bloqueo, reflejo, inmunidad.
      tone({ type: 'square', freq: 1320, freqEnd: 660, dur: 0.16, gain: 0.13 });
      noise({ freq: 4200, freqEnd: 1800, q: 6, dur: 0.20, gain: 0.13 });
    },
    reflect: function () {
      tone({ type: 'sawtooth', freq: 440, freqEnd: 1760, dur: 0.26, gain: 0.13 });
      noise({ freq: 3000, freqEnd: 900, q: 5, dur: 0.24, gain: 0.10 });
    },
    death: function () {
      tone({ type: 'sawtooth', freq: 220, freqEnd: 38, dur: 0.95, gain: 0.20 });
      noise({ freq: 500, freqEnd: 60, q: 0.7, dur: 0.85, gain: 0.16 });
    },
    dash: function () {
      noise({ freq: 700, freqEnd: 2400, filterType: 'bandpass', q: 1.5,
              dur: 0.22, gain: 0.13, rate: 1.4 });
    },
    reject: function () {
      tone({ type: 'square', freq: 150, dur: 0.09, gain: 0.07 });
    },
    ready: function () {
      tone({ type: 'sine', freq: 1046, dur: 0.09, gain: 0.05 });
    },
    roundStart: function () {
      tone({ type: 'triangle', freq: 330, freqEnd: 660, dur: 0.18, gain: 0.10 });
      tone({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.24, gain: 0.12, delay: 0.16 });
    },
    victory: function () {
      tone({ type: 'triangle', freq: 392, freqEnd: 784, dur: 0.34, gain: 0.11 });
      tone({ type: 'sine', freq: 523, freqEnd: 1046, dur: 0.42, gain: 0.10, delay: 0.18 });
      tone({ type: 'sine', freq: 659, dur: 0.52, gain: 0.07, delay: 0.34 });
    },
    defeat: function () {
      tone({ type: 'sawtooth', freq: 220, freqEnd: 82, dur: 0.52, gain: 0.09 });
      tone({ type: 'sine', freq: 146, freqEnd: 73, dur: 0.70, gain: 0.10, delay: 0.14 });
    },
    uiSelect: function () {
      tone({ type: 'triangle', freq: 520, freqEnd: 620, dur: 0.045, gain: 0.035 });
    },
    uiConfirm: function () {
      tone({ type: 'sine', freq: 440, freqEnd: 760, dur: 0.09, gain: 0.05 });
    }
  };

  /* =========================================================================
   * Suscripción a la simulación
   *
   * Los eventos del mundo son la única fuente: si un sonido no suena, es que el
   * evento no se emitió. El audio hereda gratis toda la corrección del combate.
   * ====================================================================== */
  A.install = function (world, getPlayerId) {
    var bus = world.bus;

    function isPlayer(id) { return id === getPlayerId(); }

    // Sólo suena lo que ocurre cerca: a 30 unidades el combate ajeno es ruido.
    function audible(entityId) {
      if (!A.enabled || !A.ctx) return false;
      var p = world.getEntity(getPlayerId());
      var e = world.getEntity(entityId);
      if (!p || !e) return true;
      return Arena.Math.Vec3.distXZ(p.pos, e.pos) < 28;
    }

    bus.on('DamageApplied', function (p) {
      if (!audible(p.targetId)) return;
      var power = Math.min(1, p.applied / 220);
      if (isPlayer(p.targetId)) {
        if (gate('taken', 0.07)) A.sounds.hitTaken(power);
      } else if (isPlayer(p.sourceId)) {
        if (!gate('dealt', 0.05)) return;
        if (p.school === 'magical') A.sounds.hitMagical(power);
        else A.sounds.hitPhysical(power);
      } else if (gate('other', 0.12)) {
        A.sounds.hitPhysical(power * 0.5);
      }
    });

    bus.on('HealApplied', function (p) {
      if (p.applied < 1 || !audible(p.targetId)) return;
      if (gate('heal', 0.10)) A.sounds.heal();
    });

    bus.on('BarrierApplied', function (p) {
      if (audible(p.targetId) && gate('barrier', 0.10)) A.sounds.barrier();
    });

    bus.on('AbilityCastStarted', function (p) {
      if (!audible(p.casterId)) return;
      var ab = Arena.Data.abilities[p.abilityId];
      if (gate('cast', 0.08)) A.sounds.castStart(!!(ab && ab.flags && ab.flags.magic));
    });

    bus.on('AbilityCastCompleted', function (p) {
      if (!audible(p.casterId)) return;
      var ab = Arena.Data.abilities[p.abilityId];
      if (gate('castdone', 0.05)) A.sounds.castComplete(!!(ab && ab.flags && ab.flags.magic));
    });

    bus.on('AbilityCastInterrupted', function (p) {
      if (audible(p.casterId) && p.reason !== 'cancelled') A.sounds.interrupt();
    });

    bus.on('StatusApplied', function (p) {
      if (!audible(p.targetId)) return;
      var d = Arena.Data.effects[p.effect];
      if (!d || d.passiveAura) return;
      if (d.kind === 'cc') {
        if (d.drCategory === 'hardDisable' || d.drCategory === 'stasis') A.sounds.hardCC();
        else if (gate('softcc', 0.08)) A.sounds.softCC();
      }
    });

    bus.on('AbilityBlocked', function (p) { if (audible(p.targetId)) A.sounds.counter(); });
    bus.on('AbilityNullified', function (p) { if (audible(p.targetId)) A.sounds.counter(); });
    bus.on('AbilityReflected', function (p) { if (audible(p.targetId)) A.sounds.reflect(); });
    bus.on('EffectImmune', function (p) {
      if (audible(p.targetId) && gate('immune', 0.12)) A.sounds.counter();
    });
    bus.on('EntityDied', function (p) { if (audible(p.entityId)) A.sounds.death(); });
    bus.on('EntityDashed', function (p) { if (audible(p.entityId)) A.sounds.dash(); });

    bus.on('AbilityRejected', function (p) {
      if (isPlayer(p.casterId) && gate('reject', 0.25)) A.sounds.reject();
    });
  };

  Arena.Audio = A;
});
