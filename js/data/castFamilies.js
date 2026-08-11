/* =============================================================================
 * data/castFamilies.js — De qué VA un hechizo, para que se vea distinto.
 *
 * POR QUÉ ESTE FICHERO ESTÁ EN data/ Y NO EN render/
 *
 * La capa de presentación no puede conocer habilidades. Si `actions.js` tuviera
 * dentro una lista de ids de hechizo, cada habilidad nueva obligaría a tocar el
 * renderer, y el renderer pasaría a saber de reglas de combate. Aquí se traduce
 * una habilidad a una FAMILIA VISUAL —un puñado de categorías estables— y la
 * presentación sólo conoce esas categorías.
 *
 * La familia se DEDUCE de los datos que ya existen (target, flags, efectos,
 * tiempo de casteo). No hay una tabla escrita a mano que haya que mantener en
 * paralelo: una habilidad nueva recibe familia automáticamente, y si la
 * heurística se equivoca se corrige con un override explícito.
 *
 * Estas familias NO afectan a ninguna regla. Son puramente cómo se ve.
 * ========================================================================== */
Arena.define('data/castFamilies', ['data/abilities'], function (Arena) {
  'use strict';

  /* Las siete familias visuales. El nombre describe la INTENCIÓN del gesto, no
     el efecto mecánico: dos hechizos que hacen cosas distintas pueden compartir
     lenguaje corporal si el gesto es el mismo. */
  var FAMILY = {
    PROJECTILE: 'projectile',  // energía concentrada y lanzada al frente
    CONTROL:    'control',     // la mano libre domina, gesto deliberado
    BUFF:       'buff',        // energía recogida hacia uno mismo o un aliado
    HEAL:       'heal',        // pose abierta, palma en alto
    AOE:        'aoe',         // base amplia, el báculo marca el suelo
    CHANNEL:    'channel',     // canalización larga y sostenida
    INSTANT:    'instant'      // gesto corto, sin telegrafía falsa
  };

  /* Por encima de este casteo, el gesto se lee como canalización sostenida
     antes que como cualquier otra cosa: el cuerpo lleva tanto tiempo en tensión
     que ESO es lo que el espectador ve. */
  var CHANNEL_SECONDS = 1.5;

  /* Overrides explícitos. Vacío a propósito: la heurística cubre el catálogo
     actual. Se rellena sólo cuando un hechizo concreto deba verse distinto de
     lo que sus datos sugieren, y con un comentario que diga por qué. */
  var OVERRIDES = {};

  function hasEffect(ability, types) {
    var fx = ability.effects || [];
    for (var i = 0; i < fx.length; i++) {
      if (types.indexOf(fx[i].type) >= 0) return true;
    }
    return false;
  }

  /** ¿Alguno de sus efectos es un estado de control sobre el objetivo? */
  function appliesControl(ability) {
    var fx = ability.effects || [];
    var EFF = Arena.Data.effects;
    for (var i = 0; i < fx.length; i++) {
      if (fx[i].type !== 'status') continue;
      var def = EFF[fx[i].effect];
      if (def && def.kind === 'cc') return true;
    }
    return false;
  }

  /**
   * Familia visual de una habilidad.
   *
   * ORDEN DE PRECEDENCIA — importa, y este es el razonamiento:
   *
   *   1. instantáneo   sin tiempo de casteo no hay nada que telegrafiar, y
   *                    fingir una animación larga es mentirle al que juega
   *                    enfrente sobre cuándo llega el golpe;
   *   2. canalización  un casteo muy largo se lee como canalización aunque
   *                    además sea un proyectil;
   *   3. área          una zona necesita telegrafía de suelo, sea lo que sea;
   *   4. curación      la pose abierta es inconfundible y debe ganar;
   *   5. control       el gesto de la mano libre distingue un CC de un daño;
   *   6. proyectil     energía concentrada y lanzada;
   *   7. buff          resto de lo que va a un aliado o a uno mismo.
   *
   * @param abilityOrId registro de habilidad o su id
   * @returns una de FAMILY. Nunca null: un hechizo sin clasificar es un hechizo
   *          que se vería como ninguno, y eso es peor que clasificarlo mal.
   */
  function castFamilyOf(abilityOrId) {
    var ab = (typeof abilityOrId === 'string')
      ? Arena.Data.abilities[abilityOrId] : abilityOrId;
    if (!ab) return FAMILY.INSTANT;
    if (OVERRIDES[ab.id]) return OVERRIDES[ab.id];

    var castTime = ab.castTime || 0;
    if (castTime <= 0) return FAMILY.INSTANT;
    if (castTime >= CHANNEL_SECONDS) return FAMILY.CHANNEL;

    if (ab.target === 'ground' || ab.target === 'aoeSelf' ||
        ab.radius > 0 || hasEffect(ab, ['zone'])) return FAMILY.AOE;

    if (hasEffect(ab, ['heal', 'hot'])) return FAMILY.HEAL;
    if (appliesControl(ab)) return FAMILY.CONTROL;
    if (ab.flags && ab.flags.projectile) return FAMILY.PROJECTILE;

    var friendly = ab.target === 'ally' || ab.target === 'allyOrSelf' ||
                   ab.target === 'self';
    if (friendly || hasEffect(ab, ['barrier', 'cleanse'])) return FAMILY.BUFF;

    // Ofensivo sin proyectil declarado: sigue siendo energía lanzada al frente.
    return FAMILY.PROJECTILE;
  }

  Arena.Data.CAST_FAMILY = FAMILY;
  Arena.Data.castFamilyOf = castFamilyOf;
  Arena.Data.castFamilies = { FAMILY: FAMILY, OVERRIDES: OVERRIDES, CHANNEL_SECONDS: CHANNEL_SECONDS };
});
