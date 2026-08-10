/* =============================================================================
 * Arena — Combat Lab
 * namespace.js — raíz global única. Sin módulos ES, sin import/export, sin fetch.
 * Todo el proyecto cuelga de window.Arena para poder abrirse desde file://
 * ========================================================================== */
(function (global) {
  'use strict';

  var Arena = global.Arena || {};

  Arena.VERSION = '0.2.0';
  Arena.BUILD = 'combat-lab';

  // Sub-namespaces. Se rellenan por los ficheros posteriores.
  Arena.Math = Arena.Math || {};
  Arena.Core = Arena.Core || {};
  Arena.Data = Arena.Data || {};
  Arena.Combat = Arena.Combat || {};
  Arena.Sim = Arena.Sim || {};
  Arena.AI = Arena.AI || {};
  Arena.Render = Arena.Render || {};
  Arena.UI = Arena.UI || {};
  Arena.Audio = Arena.Audio || {};
  Arena.Tests = Arena.Tests || {};

  /**
   * Registro de módulos con comprobación de dependencias.
   * Sirve para detectar en el arranque un <script> ausente o mal ordenado
   * en vez de fallar con un "undefined is not a function" a mitad de partida.
   */
  Arena._modules = Arena._modules || {};
  Arena.define = function (name, deps, factory) {
    var missing = [];
    for (var i = 0; i < deps.length; i++) {
      if (!Arena._modules[deps[i]]) missing.push(deps[i]);
    }
    if (missing.length) {
      throw new Error(
        'Arena.define("' + name + '"): faltan dependencias [' + missing.join(', ') + ']. ' +
        'Revisa el orden de las etiquetas <script> en index.html.'
      );
    }
    factory(Arena);
    Arena._modules[name] = true;
  };

  Arena.assert = function (cond, msg) {
    if (!cond) throw new Error('Arena assertion failed: ' + (msg || ''));
  };

  global.Arena = Arena;
})(typeof window !== 'undefined' ? window : globalThis);
