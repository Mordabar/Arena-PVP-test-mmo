/* =============================================================================
 * core/eventBus.js — Canal único simulación → presentación.
 *
 * REGLA DE ARQUITECTURA: la simulación *emite*; render, HUD y audio *escuchan*.
 * Ningún listener puede mutar entidades. En modo estricto (por defecto) el bus
 * congela el payload para que un intento de escritura falle de inmediato en vez
 * de corromper el estado en silencio.
 * ========================================================================== */
Arena.define('core/eventBus', [], function (Arena) {
  'use strict';

  function EventBus(opts) {
    opts = opts || {};
    this._handlers = Object.create(null);
    this._any = [];
    this.strict = opts.strict !== false;
    this.history = [];
    this.historyLimit = opts.historyLimit || 400;
    this._depth = 0;
  }

  EventBus.prototype.on = function (type, fn) {
    if (!this._handlers[type]) this._handlers[type] = [];
    this._handlers[type].push(fn);
    var self = this;
    return function off() { self.off(type, fn); };
  };

  EventBus.prototype.off = function (type, fn) {
    var list = this._handlers[type];
    if (!list) return;
    var i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  };

  EventBus.prototype.onAny = function (fn) {
    this._any.push(fn);
    var self = this;
    return function off() {
      var i = self._any.indexOf(fn);
      if (i >= 0) self._any.splice(i, 1);
    };
  };

  EventBus.prototype.emit = function (type, payload) {
    payload = payload || {};
    payload.type = type;
    if (this.strict && typeof Object.freeze === 'function') Object.freeze(payload);

    this.history.push(payload);
    if (this.history.length > this.historyLimit) this.history.shift();

    this._depth++;
    try {
      var list = this._handlers[type];
      if (list) {
        // Copia defensiva: un handler puede darse de baja durante el despacho.
        var snapshot = list.slice();
        for (var i = 0; i < snapshot.length; i++) this._safeCall(snapshot[i], payload);
      }
      var anySnap = this._any.slice();
      for (var j = 0; j < anySnap.length; j++) this._safeCall(anySnap[j], payload);
    } finally {
      this._depth--;
    }
    return payload;
  };

  /** Un listener roto (típicamente de UI) nunca debe tumbar el tick de combate. */
  EventBus.prototype._safeCall = function (fn, payload) {
    try {
      fn(payload);
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Arena.EventBus] listener falló en "' + payload.type + '":', err);
      }
    }
  };

  EventBus.prototype.clear = function () {
    this._handlers = Object.create(null);
    this._any.length = 0;
    this.history.length = 0;
  };

  Arena.Core.EventBus = EventBus;
});
