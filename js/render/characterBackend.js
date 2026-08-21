/* =============================================================================
 * render/characterBackend.js — Frontera entre "cómo se anima" y "cómo se dibuja".
 *
 * El cuerpo es el maniquí nativo de Quaternius; `render/three/threeDirectAnim.js`
 * aplica sus clips directamente sobre el esqueleto de 65 huesos. Este backend
 * no fabrica geometría: expone el estado de animación (locomoción, acción,
 * casteo, control de masas) que ese puente consume, y los dos datos de
 * presentación que hacen falta (paleta del brillo de casteo, arquetipo).
 *
 *   createCharacter(entity)                    → handle opaco
 *   updateCharacter(handle, entity, dt, world) → avanza el estado de animación
 *   destroyCharacter(handle)                   → libera recursos
 *   paletteFor(entity, isFriendly)             → color de brillo de casteo
 *   archetypeOf(classId)                       → arquetipo
 *   triggerAttack / triggerHurt                → eventos de presentación
 *
 * REGLA QUE NO SE ROMPE: un backend LEE la entidad y jamás la escribe. No hay
 * una sola asignación a hp, cooldowns, posición o estados aquí ni por debajo.
 * ========================================================================== */
Arena.define('render/characterBackend', ['render/characterVisual'], function (Arena) {
  'use strict';

  var CV = Arena.Render.CharacterVisual;

  var Backend = {
    createCharacter: function (entity) {
      // La semilla visual sale del id de la entidad: determinista, nunca
      // Math.random(). Dos ejecuciones con la misma semilla de mundo producen
      // exactamente el mismo fotograma.
      return CV.createState(entity.id);
    },

    updateCharacter: function (handle, entity, dt, world) {
      CV.update(handle, entity, dt, world);
    },

    destroyCharacter: function (handle) {
      if (handle) { handle.loco = null; handle.action = null; }
    },

    /** La intención de animación del personaje. Contrato neutral de motor. */
    intentOf: function (handle) { return handle ? handle.intent : null; },

    paletteFor: function (entity, isFriendly) { return CV.paletteFor(entity, isFriendly); },
    archetypeOf: function (classId) { return CV.archetypeOf(classId); },

    triggerAttack: function (handle, archetype, isPower, castFamily, visualAction, visualVariant, spellGesture, releaseDelay) {
      CV.triggerAttack(handle, archetype, isPower, castFamily, visualAction, visualVariant, spellGesture, releaseDelay);
    },
    confirmNormalRelease: function (handle) { CV.confirmNormalRelease(handle); },
    cancelNormalWindup: function (handle) { CV.cancelNormalWindup(handle); },
    beginCast: function (handle, castFamily, visualAction, spellGesture) { CV.beginCast(handle, castFamily, visualAction, spellGesture); },
    triggerHurt: function (handle, entity, fromPos, reactionKind) {
      CV.triggerHurt(handle, entity, fromPos, reactionKind);
    },

    /** Datos de depuración. */
    debugOf: function (handle) {
      if (!handle || !handle.loco) return null;
      return {
        loco: handle.loco, action: handle.action, cc: handle.cc, ccBlend: handle.ccBlend,
        cast: handle.cast, casting: handle.casting, castMovable: handle.castMovable,
        intent: handle.intent
      };
    }
  };
  Backend.current = Backend;

  Arena.Render.CharacterBackend = Backend;
});
