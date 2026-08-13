/* =============================================================================
 * tests/testRunner.js — Mini runner sin framework (documento §21, capa Tests).
 *
 * Corre igual en el navegador (panel del laboratorio) y en Node
 * (tools/run-tests.js), sobre exactamente el mismo código de simulación.
 * ========================================================================== */
Arena.define('tests/testRunner', [], function (Arena) {
  'use strict';

  var T = Arena.Tests;
  T.suites = [];
  var current = null;

  T.suite = function (name, fn) {
    current = { name: name, tests: [], before: null };
    T.suites.push(current);
    fn();
    current = null;
  };

  T.beforeEach = function (fn) { if (current) current.before = fn; };

  T.test = function (name, fn) {
    if (!current) throw new Error('test() fuera de suite()');
    current.tests.push({ name: name, fn: fn });
  };

  /* --- Aserciones --------------------------------------------------------- */
  function fail(msg) { var e = new Error(msg); e.isAssertion = true; throw e; }

  T.assert = function (cond, msg) {
    if (!cond) fail(msg || 'se esperaba un valor verdadero');
  };
  T.assertFalse = function (cond, msg) {
    if (cond) fail(msg || 'se esperaba un valor falso');
  };
  T.assertEqual = function (actual, expected, msg) {
    if (actual !== expected) {
      fail((msg || 'valores distintos') + ' — esperado: ' + expected + ', obtenido: ' + actual);
    }
  };
  T.assertNear = function (actual, expected, tolerance, msg) {
    tolerance = tolerance === undefined ? 0.5 : tolerance;
    if (Math.abs(actual - expected) > tolerance) {
      fail((msg || 'fuera de tolerancia') + ' — esperado: ' + expected.toFixed(2) +
           ' ±' + tolerance + ', obtenido: ' + actual.toFixed(2));
    }
  };
  T.assertBetween = function (actual, lo, hi, msg) {
    if (actual < lo || actual > hi) {
      fail((msg || 'fuera de rango') + ' — esperado entre ' + lo + ' y ' + hi +
           ', obtenido: ' + (typeof actual === 'number' ? actual.toFixed(2) : actual));
    }
  };
  T.assertThrows = function (fn, msg) {
    var threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) fail(msg || 'se esperaba una excepción');
  };

  /* --- Ejecución ---------------------------------------------------------- */
  T.run = function (filter) {
    var results = { suites: [], passed: 0, failed: 0, total: 0, startedAt: Date.now() };

    for (var i = 0; i < T.suites.length; i++) {
      var suite = T.suites[i];
      var sres = { name: suite.name, tests: [], passed: 0, failed: 0 };

      for (var j = 0; j < suite.tests.length; j++) {
        var t = suite.tests[j];
        if (filter && (suite.name + ' ' + t.name).toLowerCase().indexOf(filter.toLowerCase()) < 0) continue;

        var res = { name: t.name, ok: true, error: null, ms: 0 };
        var t0 = Date.now();
        try {
          if (suite.before) suite.before();
          t.fn();
        } catch (err) {
          res.ok = false;
          res.error = (err && err.message) ? err.message : String(err);
          if (err && err.stack && !err.isAssertion) res.stack = err.stack;
        }
        res.ms = Date.now() - t0;
        sres.tests.push(res);
        if (res.ok) { sres.passed++; results.passed++; } else { sres.failed++; results.failed++; }
        results.total++;
      }
      if (sres.tests.length) results.suites.push(sres);
    }
    results.ms = Date.now() - results.startedAt;
    results.ok = results.failed === 0;
    return results;
  };

  T.format = function (results) {
    var lines = [];
    for (var i = 0; i < results.suites.length; i++) {
      var s = results.suites[i];
      lines.push((s.failed ? '✗' : '✓') + ' ' + s.name + '  (' + s.passed + '/' + s.tests.length + ')');
      for (var j = 0; j < s.tests.length; j++) {
        var t = s.tests[j];
        if (t.ok) lines.push('    ✓ ' + t.name);
        else lines.push('    ✗ ' + t.name + '\n        → ' + t.error);
      }
    }
    lines.push('');
    lines.push(results.ok
      ? 'TODO OK — ' + results.passed + ' pruebas en ' + results.ms + ' ms'
      : 'FALLOS: ' + results.failed + ' de ' + results.total + ' pruebas');
    return lines.join('\n');
  };

  /* =========================================================================
   * Utilidades de escenario
   * ====================================================================== */

  /** Mundo mínimo y determinista: sin IA, sin RNG, entidades cara a cara. */
  T.makeWorld = function (opts) {
    opts = opts || {};
    var world = new Arena.Sim.World({ seed: opts.seed === undefined ? 1 : opts.seed });
    world.settings.aiEnabled = false;
    world.settings.rngEnabled = false;
    world.start();
    return world;
  };

  /** Coloca una entidad de la clase indicada. Por defecto sin IA y sin cooldowns
   *  compartidos con otros tests. */
  T.spawn = function (world, classId, cfg) {
    cfg = cfg || {};
    var e = Arena.Data.makeEntity(classId, {
      id: cfg.id, team: cfg.team === undefined ? 0 : cfg.team,
      x: cfg.x === undefined ? 0 : cfg.x,
      z: cfg.z === undefined ? 0 : cfg.z,
      name: cfg.name, aiEnabled: false
    });
    if (cfg.hpMax) { e.hpMax = cfg.hpMax; e.hp = cfg.hpMax; }
    if (cfg.armor !== undefined) e.armorBase = cfg.armor;
    if (cfg.resist !== undefined) e.resistBase = cfg.resist;
    e.aiProfile = cfg.aiProfile || 'passive';
    world.addEntity(e);
    if (Arena.Data.passives) Arena.Data.passives.initEntity(e);
    return e;
  };

  /* -------------------------------------------------------------------------
   * Fixtures atados a la geometría REAL, no a coordenadas mágicas
   *
   * Un test que dice `x: 4.5` porque ahí había una columna deja de probar lo que
   * dice en cuanto alguien rediseña el nivel: sigue verde y ya no comprueba
   * nada. Peor: una posición que cae dentro de un muro convierte una prueba de
   * balance en una prueba de un bot atascado, y el número que devuelve parece
   * un problema de balance.
   *
   * Estos ayudantes leen la arena que hay y fallan en voz alta si lo que el
   * test necesita ya no existe.
   * ---------------------------------------------------------------------- */

  /** ¿Cabe una entidad de pie en este punto de la arena? */
  T.isFreeSpot = function (world, x, z, radius) {
    return Arena.Sim.ArenaMetrics.walkable(world.arena, x, z,
      radius === undefined ? 0.5 : radius);
  };

  /** Exige que un punto esté libre. Mensaje explícito cuando el mapa cambia. */
  T.requireFreeSpot = function (world, x, z, what) {
    T.assert(T.isFreeSpot(world, x, z),
      (what || 'el fixture') + ' nace dentro de geometría en (' + x + ', ' + z + '): ' +
      'el mapa cambió y esta prueba ya no mide lo que dice');
  };

  /** Una columna real de la arena y dos puntos enfrentados a través de ella. */
  T.pillarFixture = function (world, gap) {
    gap = gap === undefined ? 3.0 : gap;
    var obs = world.arena.obstacles;
    for (var i = 0; i < obs.length; i++) {
      if (obs[i].kind !== 'pillar') continue;
      var cx = (obs[i].min.x + obs[i].max.x) / 2;
      var cz = (obs[i].min.z + obs[i].max.z) / 2;
      var a = { x: cx - gap, z: cz }, b = { x: cx + gap, z: cz };
      if (!T.isFreeSpot(world, a.x, a.z) || !T.isFreeSpot(world, b.x, b.z)) continue;
      var eyeA = { x: a.x, y: 1.2, z: a.z }, eyeB = { x: b.x, y: 1.2, z: b.z };
      if (world.hasLineOfSight(eyeA, eyeB)) continue;      // no llega a taparlos
      return { pillar: obs[i], center: { x: cx, z: cz }, a: a, b: b };
    }
    T.assert(false, 'la arena no tiene ninguna columna que corte la visión entre dos puntos libres');
    return null;
  };

  /** Lanza una habilidad saltándose GCD y cooldown: los tests miden reglas de
   *  resolución, no la disponibilidad del botón. */
  T.forceCast = function (world, caster, abilityId, target) {
    caster.gcdUntil = 0;
    caster.cooldowns[abilityId] = 0;
    caster.schoolLockouts = Object.create(null);
    var ctx = target ? { targetId: target.id, target: target } : {};
    if (target) caster.targetId = target.id;
    var r = Arena.Combat.AbilitySystem.tryUse(world, caster, abilityId, ctx);
    return r;
  };

  /** Ejecuta el payload de una habilidad directamente sobre el objetivo,
   *  sin cast, rango ni proyectil. Aísla la cadena de resolución (§10, pasos 5-8). */
  T.resolveDirect = function (world, caster, abilityId, target) {
    var ability = Arena.Data.abilities[abilityId];
    if (!ability) throw new Error('Habilidad desconocida: ' + abilityId);
    return Arena.Combat.Resolver.resolveHit(world, caster, target, ability, { isAoE: false });
  };

  T.advance = function (world, seconds) { world.stepSeconds(seconds); };

  /** Cuenta eventos de un tipo emitidos durante una acción. */
  T.countEvents = function (world, type, fn) {
    var n = 0;
    var off = world.bus.on(type, function () { n++; });
    try { fn(); } finally { off(); }
    return n;
  };

  T.captureEvents = function (world, type, fn) {
    var out = [];
    var off = world.bus.on(type, function (p) { out.push(p); });
    try { fn(); } finally { off(); }
    return out;
  };
});
