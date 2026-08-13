/* =============================================================================
 * data/scenarios.js — Dónde se coloca cada quién en cada escenario.
 *
 * Estaba dentro de un `switch` en `main.js`, que es donde el layout de un nivel
 * no se puede comprobar: `main.js` necesita DOM y no entra en la batería de
 * pruebas. Rediseñar la arena movió columnas encima de dos posiciones de la
 * sala de counters y nadie se habría enterado hasta abrirla a mano.
 *
 * Como datos, cada punto se puede verificar contra la geometría real: que sea
 * transitable, que esté dentro del recinto y que no nazca nadie dentro de una
 * columna. `arenaTests` lo hace.
 *
 * Los roles (`opponent`, `ally`, …) los resuelve el integrador: aquí no se
 * decide nada de combate, sólo posiciones y perfiles de IA.
 * ========================================================================== */
Arena.define('data/scenarios', [], function (Arena) {
  'use strict';

  /* `class` puede ser un id concreto o un rol que el integrador resuelve:
       'opponent'  → contraclase del jugador
       'ally'      → compañero recomendado
       'enemyMate' → compañero del rival           */
  var SCENARIOS = {
    dummies: {
      name: 'sacos de daño',
      units: [
        { cls: 'guardian',   name: 'Blindado',      team: 1, x: 4,  z: -3, profile: 'armored' },
        { cls: 'arcanista',  name: 'Resistente',    team: 1, x: 4,  z: 0,  profile: 'warded' },
        { cls: 'centinela',  name: 'Saco de daño',  team: 1, x: 4,  z: 3,  profile: 'passive' },
        { cls: 'vinculador', name: 'Aliado',        team: 0, x: -8, z: 3,  profile: 'support' }
      ]
    },

    duel: {
      name: 'duelo 1v1',
      units: [
        { cls: 'opponent', nameSuffix: ' rival', team: 1, spawn: 'enemy', profile: 'sparring' }
      ]
    },

    team: {
      name: 'combate 2v2',
      units: [
        { cls: 'ally',      nameSuffix: ' aliado', team: 0, x: -11,   z: 2.2,  profile: 'byClass' },
        { cls: 'opponent',  nameSuffix: ' rival',  team: 1, x: 11,    z: -2.2, profile: 'byClass' },
        { cls: 'enemyMate', nameSuffix: ' rival',  team: 1, x: 13.5,  z: 0,    profile: 'byClass' }
      ]
    },

    counters: {
      name: 'sala de counters',
      units: [
        { cls: 'guardian',   name: 'Guardián (reflejo)',       team: 1, x: 6.5, z: -2.4, profile: 'passive' },
        { cls: 'vinculador', name: 'Vinculador (intervención)', team: 1, x: 6.5, z: 0,    profile: 'passive' },
        { cls: 'arcanista',  name: 'Arcanista (velo nulo)',    team: 1, x: 6.5, z: 2.4,  profile: 'passive' },
        { cls: 'vinculador', name: 'Aliado de pruebas',        team: 0, x: -7,  z: 2.4,  profile: 'passive' }
      ]
    },

    /* TIMING LAB: blancos pasivos en una zona compacta para practicar las
       ventanas que definen el ritmo táctico sin interferencia de IA. */
    timing: {
      name: 'Timing Lab',
      units: [
        { cls: 'guardian',   name: '1 · STOP-SHOT',    team: 1, x: -3.5, z: -5.0, profile: 'passive' },
        { cls: 'centinela',  name: '2 · WEAVE',        team: 1, x: -1.5, z: -2.0, profile: 'passive' },
        { cls: 'devastador', name: '3 · REPLACE',      team: 1, x: -1.5, z:  2.0, profile: 'passive' },
        { cls: 'arcanista',  name: '4 · CAST CANCEL',  team: 1, x: -3.5, z:  5.0, profile: 'passive' },
        { cls: 'vinculador', name: '5 · GCD CHAIN',    team: 1, x:  1.0, z: -4.0, profile: 'passive' },
        { cls: 'guardian',   name: '6 · RELEASE EDGE', team: 1, x:  1.0, z:  4.0, profile: 'passive' }
      ]
    }
  };

  /** Punto final de una unidad: explícito, o el spawn con nombre de la arena. */
  function positionOf(unit, arena) {
    if (unit.spawn && arena.spawns[unit.spawn]) {
      var s = arena.spawns[unit.spawn];
      return { x: s.x, z: s.z, yaw: s.yaw };
    }
    return { x: unit.x, z: unit.z, yaw: unit.yaw };
  }

  Arena.Data.scenarios = {
    all: SCENARIOS,
    ids: Object.keys(SCENARIOS),
    get: function (id) { return SCENARIOS[id] || null; },
    nameOf: function (id) { return SCENARIOS[id] ? SCENARIOS[id].name : id; },
    positionOf: positionOf
  };
});
