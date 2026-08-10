/* =============================================================================
 * core/rng.js — Generador determinista (mulberry32).
 *
 * El documento pide RNG desactivado o mínimo durante la fase de game feel.
 * Aun así la simulación necesita *algo* de aleatoriedad (IA, dispersión de VFX,
 * desempates). Toda ella pasa por aquí para que una partida sea reproducible a
 * partir de su semilla: sin esto, un bug de combate no se puede volver a montar.
 * ========================================================================== */
Arena.define('core/rng', [], function (Arena) {
  'use strict';

  function RNG(seed) {
    this.seed(seed === undefined ? 0x9E3779B9 : seed);
  }

  RNG.prototype.seed = function (s) {
    this._s = (s >>> 0) || 1;
    this._calls = 0;
    return this;
  };

  /** Flotante uniforme en [0,1). */
  RNG.prototype.next = function () {
    this._calls++;
    this._s = (this._s + 0x6D2B79F5) >>> 0;
    var t = this._s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  RNG.prototype.range = function (min, max) { return min + this.next() * (max - min); };
  RNG.prototype.int = function (min, max) { return Math.floor(this.range(min, max + 1)); };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };

  RNG.prototype.snapshot = function () { return { s: this._s, calls: this._calls }; };
  RNG.prototype.restore = function (snap) { this._s = snap.s; this._calls = snap.calls; return this; };

  Arena.Core.RNG = RNG;
});
