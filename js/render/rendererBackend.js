/* =============================================================================
 * render/rendererBackend.js — Qué necesita el juego de un renderer.
 *
 * POR QUÉ ESTE FICHERO ES TAN CORTO
 *
 * No es una capa de abstracción con adaptadores y fábricas. Es un CONTRATO
 * escrito y comprobado: la lista exacta de lo que `main.js`, el HUD y el
 * laboratorio le piden a quien dibuja. Nada más.
 *
 * Escribirlo tiene un motivo concreto. Hoy existen dos presentaciones —el
 * renderer WebGL2 nativo y el de Three.js— y la única garantía de que la
 * segunda no rompa el juego es que ambas expongan lo mismo. Un contrato
 * verificado en el arranque convierte "falta un método" en un error inmediato y
 * legible, en vez de en un `undefined is not a function` treinta segundos
 * después, en mitad de un combate y a saber en qué línea.
 *
 * REGLA QUE NO SE ROMPE: un renderer LEE el mundo y jamás lo escribe. Ninguna
 * de las dos implementaciones asigna hp, recursos, cooldowns, estados, posición
 * ni orientación. El giro que nace del ratón se emite como INTENCIÓN y lo
 * aplica la simulación dentro del paso fijo.
 * ========================================================================== */
Arena.define('render/rendererBackend', [], function (Arena) {
  'use strict';

  /* Métodos que el juego llama por su nombre.
   *
   * `characterHandleOf` existe por un fallo real y caro. `visuals[id]` estaba en
   * el contrato, pero NO qué contiene: el renderer nativo guardaba ahí el handle
   * del backend de personaje y el de Three.js guardaba un objeto envoltorio con
   * el handle dentro. `vfx.js` pasaba `visuals[id]` a `triggerAttack`, que
   * empieza con `if (!st.cfg) return;` — así que en la presentación de Three.js
   * TODA acción de combate, todo casteo y toda reacción al daño se descartaban
   * en silencio. La locomoción seguía funcionando porque va por otro camino, y
   * por eso nadie lo vio: los personajes se movían, sólo que nunca atacaban.
   *
   * La lección no es «poner `vis.handle || vis`»: es que un contrato que declara
   * un contenedor sin declarar su contenido no es un contrato. */
  var METHODS = ['init', 'syncVisuals', 'render', 'resize', 'characterHandleOf'];

  /* Propiedades que el juego y el HUD leen o escriben directamente.
     `camera` y `canvas` los usa el HUD para proyectar nameplates; los tres ids
     son selección y hover, que main.js mantiene al día. */
  var PROPS = ['camera', 'canvas', 'visuals', 'playerId', 'selectedId', 'hoverId'];

  var RB = {
    METHODS: METHODS,
    PROPS: PROPS,

    /**
     * Comprueba que una implementación cumple el contrato.
     * @returns lista de incumplimientos; vacía si todo está.
     */
    check: function (renderer) {
      var missing = [];
      if (!renderer) return ['el renderer es nulo'];
      var i;
      for (i = 0; i < METHODS.length; i++) {
        if (typeof renderer[METHODS[i]] !== 'function') {
          missing.push('falta el método ' + METHODS[i] + '()');
        }
      }
      for (i = 0; i < PROPS.length; i++) {
        if (!(PROPS[i] in renderer)) missing.push('falta la propiedad ' + PROPS[i]);
      }
      return missing;
    },

    /** Igual que `check`, pero falla en el arranque en vez de más tarde. */
    assert: function (renderer, label) {
      var missing = RB.check(renderer);
      if (missing.length) {
        throw new Error('El renderer "' + (label || '?') +
          '" no cumple el contrato: ' + missing.join('; '));
      }
      return renderer;
    },

    /* Implementaciones registradas. `main.js` elige una por nombre, así que
       añadir una tercera no le obliga a cambiar. */
    registry: Object.create(null),

    register: function (name, factory) {
      if (typeof factory !== 'function') {
        throw new Error('register(' + name + ') necesita una factoría.');
      }
      RB.registry[name] = factory;
      return factory;
    },

    /**
     * Crea el renderer pedido. Si no existe, cae al primero registrado en vez
     * de dejar la pantalla en negro: perder el renderer preferido es un
     * problema, quedarse sin juego es otro mayor.
     */
    create: function (name, canvas, world) {
      var factory = RB.registry[name];
      var used = name;
      if (!factory) {
        for (var k in RB.registry) {
          if (Object.prototype.hasOwnProperty.call(RB.registry, k)) {
            factory = RB.registry[k]; used = k; break;
          }
        }
      }
      if (!factory) throw new Error('No hay ningún renderer registrado.');
      var r = factory(canvas, world);
      RB.assert(r, used);
      r.backendName = used;
      return r;
    }
  };

  Arena.Render.RendererBackend = RB;
});
