/* =============================================================================
 * render/characterBackend.js — Frontera entre "cómo se anima" y "cómo se dibuja".
 *
 * POR QUÉ EXISTE ESTE FICHERO
 *
 * El humanoide actual es procedural: cajas y cápsulas colocadas por matrices.
 * El día que entre una malla con skinning, NADA de la simulación, la locomoción,
 * las acciones de combate ni el control deberían enterarse. Lo único que cambia
 * es quién convierte una pose en geometría.
 *
 * Por eso el renderer ya no habla con `characterVisual` directamente: habla con
 * un BACKEND que cumple este contrato.
 *
 *   createCharacter(entity)                    → handle opaco
 *   updateCharacter(handle, entity, dt, world) → avanza el estado de animación
 *   buildPose(out, handle, entity, pos, yaw, palette) → geometría para el frame
 *   destroyCharacter(handle)                   → libera recursos
 *   paletteFor(entity, isFriendly)             → colores
 *   archetypeOf(classId)                       → arquetipo
 *   triggerAttack / triggerHurt                → eventos de presentación
 *
 * `ProceduralCharacterVisual` es la implementación de hoy. Un futuro
 * `SkinnedMeshCharacterVisual` implementaría lo mismo consumiendo el contrato de
 * huesos de render/anim/skeleton.js —los mismos nombres, los mismos sockets— y
 * el resto del motor no notaría la diferencia.
 *
 * REGLA QUE NO SE ROMPE: un backend LEE la entidad y jamás la escribe. No hay
 * una sola asignación a hp, cooldowns, posición o estados aquí ni por debajo.
 * ========================================================================== */
Arena.define('render/characterBackend', ['render/characterVisual'], function (Arena) {
  'use strict';

  var CV = Arena.Render.CharacterVisual;

  /* =========================================================================
   * Backend procedural
   * ====================================================================== */
  var Procedural = {
    id: 'procedural',
    /** Mallas que el renderer debe subir a GPU una sola vez. */
    buildMeshes: function () { return CV.buildMeshes(); },

    createCharacter: function (entity) {
      // La semilla visual sale del id de la entidad: determinista, nunca
      // Math.random(). Dos ejecuciones con la misma semilla de mundo producen
      // exactamente el mismo fotograma.
      return CV.createState(entity.id);
    },

    updateCharacter: function (handle, entity, dt, world) {
      CV.update(handle, entity, dt, world);
    },

    buildPose: function (out, handle, entity, pos, yaw, palette) {
      return CV.buildPose(out, handle, entity, pos, yaw, palette);
    },

    destroyCharacter: function (handle) {
      // El backend procedural no reserva recursos de GPU por personaje: su
      // "malla" es compartida y las matrices se recalculan cada frame. Un
      // backend con skinning liberaría aquí su buffer de huesos.
      if (handle) { handle.loco = null; handle.action = null; }
    },

    /** La intención de animación del personaje. Contrato neutral de motor. */
    intentOf: function (handle) { return handle ? handle.intent : null; },

    paletteFor: function (entity, isFriendly) { return CV.paletteFor(entity, isFriendly); },
    archetypeOf: function (classId) { return CV.archetypeOf(classId); },
    materialOf: function (mesh) { return CV.materialOf(mesh); },

    triggerAttack: function (handle, archetype, isPower, castFamily, visualAction) {
      CV.triggerAttack(handle, archetype, isPower, castFamily, visualAction);
    },
    beginCast: function (handle, castFamily, visualAction) { CV.beginCast(handle, castFamily, visualAction); },
    triggerHurt: function (handle, entity, fromPos) {
      CV.triggerHurt(handle, entity, fromPos);
    },

    /** Datos de depuración. Un backend sin locomoción propia devolvería null. */
    debugOf: function (handle) {
      if (!handle || !handle.loco) return null;
      return {
        loco: handle.loco, action: handle.action, cc: handle.cc, ccBlend: handle.ccBlend,
        cast: handle.cast, casting: handle.casting, castMovable: handle.castMovable,
        intent: handle.intent
      };
    }
  };

  var Backend = {
    procedural: Procedural,
    current: Procedural,
    /** Permite cambiar de backend sin tocar el renderer. */
    use: function (backend) {
      if (!backend) throw new Error('CharacterBackend.use requiere un backend.');
      var required = ['buildMeshes', 'createCharacter', 'updateCharacter', 'buildPose',
                      'destroyCharacter', 'paletteFor', 'archetypeOf'];
      for (var i = 0; i < required.length; i++) {
        if (typeof backend[required[i]] !== 'function') {
          throw new Error('Backend de personaje incompleto: falta ' + required[i] + '().');
        }
      }
      Backend.current = backend;
      return backend;
    }
  };

  Arena.Render.CharacterBackend = Backend;
});
