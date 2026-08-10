/* =============================================================================
 * core/fixedTick.js — Reloj de simulación de paso fijo.
 *
 * La simulación corre a 30 Hz exactos; el render corre libre e interpola. Así
 * los timings de combate (GCD, cast, CC, DR) son idénticos a 30 fps y a 240 fps,
 * que es la única forma de que el balance signifique algo.
 *
 * Protección anti espiral de la muerte: si el navegador se congela (pestaña en
 * segundo plano, breakpoint), se descartan los ticks atrasados por encima del
 * máximo en vez de intentar recuperarlos todos de golpe.
 * ========================================================================== */
Arena.define('core/fixedTick', [], function (Arena) {
  'use strict';

  function FixedTick(opts) {
    opts = opts || {};
    this.rate = opts.rate || 30;
    this.dt = 1 / this.rate;
    this.maxCatchUp = opts.maxCatchUp || 5;
    this._accumulator = 0;
    this.tickCount = 0;
    this.time = 0;
    this.running = false;
    this.timeScale = 1;
    this.onTick = opts.onTick || function () {};
    this.droppedTicks = 0;
  }

  /**
   * Avanza el reloj con el tiempo real transcurrido.
   * @returns {number} alpha de interpolación en [0,1) para el render.
   */
  FixedTick.prototype.advance = function (realDelta) {
    if (!this.running) return this._accumulator / this.dt;
    if (realDelta > 0.25) realDelta = 0.25; // el primer frame tras un stall

    this._accumulator += realDelta * this.timeScale;
    var steps = 0;
    while (this._accumulator >= this.dt) {
      this._accumulator -= this.dt;
      this.time += this.dt;
      this.tickCount++;
      this.onTick(this.dt, this.time, this.tickCount);
      steps++;
      if (steps >= this.maxCatchUp) {
        var dropped = Math.floor(this._accumulator / this.dt);
        if (dropped > 0) {
          this.droppedTicks += dropped;
          this._accumulator -= dropped * this.dt;
        }
        break;
      }
    }
    return this._accumulator / this.dt;
  };

  /** Avance manual de N ticks — lo usan los tests y las simulaciones headless. */
  FixedTick.prototype.step = function (ticks) {
    ticks = ticks || 1;
    for (var i = 0; i < ticks; i++) {
      this.time += this.dt;
      this.tickCount++;
      this.onTick(this.dt, this.time, this.tickCount);
    }
  };

  /** Avanza el tiempo simulado en segundos (redondeando hacia arriba a ticks). */
  FixedTick.prototype.stepSeconds = function (seconds) {
    this.step(Math.max(1, Math.round(seconds / this.dt)));
  };

  FixedTick.prototype.start = function () { this.running = true; this._accumulator = 0; };
  FixedTick.prototype.stop = function () { this.running = false; };
  FixedTick.prototype.reset = function () {
    this._accumulator = 0; this.tickCount = 0; this.time = 0; this.droppedTicks = 0;
  };

  Arena.Core.FixedTick = FixedTick;
});
