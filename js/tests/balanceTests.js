/* =============================================================================
 * tests/balanceTests.js — Objetivos de ritmo verificados por simulación (§19).
 *
 * Estos tests no comprueban reglas, comprueban SENSACIÓN medida: cuánto dura un
 * duelo, cuánto quita una ventana de burst, si un solo golpe se pasa de rosca.
 * Son la red de seguridad que impide que un ajuste de números "que parecía
 * inocente" rompa el ritmo del combate sin que nadie se entere.
 * ========================================================================== */
Arena.define('tests/balanceTests', ['tests/testRunner', 'ai/dummyAI'], function (Arena) {
  'use strict';

  var T = Arena.Tests;
  var B = Arena.Data.balance;
  var Status = Arena.Combat.StatusSystem;
  var Dmg = Arena.Combat.DamageSystem;

  /* =========================================================================
   * Harness de duelo
   * ====================================================================== */

  /** Simula un 1v1 entre dos bots y devuelve el resultado. */
  function duel(classA, classB, opts) {
    opts = opts || {};
    var w = new Arena.Sim.World({ seed: opts.seed === undefined ? 7 : opts.seed });
    w.settings.aiEnabled = true;
    w.settings.rngEnabled = false;
    w.start();

    T.requireFreeSpot(w, -10, 3, classA);
    T.requireFreeSpot(w, 10, 3, classB);
    var a = Arena.Data.makeEntity(classA, { team: 0, x: -10, z: 3, name: 'A' });
    var b = Arena.Data.makeEntity(classB, { team: 1, x: 10, z: 3, name: 'B' });
    a.aiProfile = 'bot'; b.aiProfile = 'bot';
    w.addEntity(a); w.addEntity(b);
    Arena.Data.passives.initEntity(a);
    Arena.Data.passives.initEntity(b);

    var maxSeconds = opts.maxSeconds || 90;
    var ticks = Math.round(maxSeconds * B.TICK_RATE);
    for (var i = 0; i < ticks; i++) {
      w.step(1);
      if (!a.alive || !b.alive) break;
    }
    return {
      world: w, a: a, b: b, seconds: w.time,
      decided: (!a.alive || !b.alive),
      winner: (!a.alive && b.alive) ? classB : ((!b.alive && a.alive) ? classA : null)
    };
  }

  /** Objetivo de referencia para medir golpes: el más frágil del juego. */
  function referenceTarget(w) {
    return T.spawn(w, 'arcanista', { team: 1, x: 3, z: 0 });
  }

  T.suite('§19 · Objetivos de ritmo y balance', function () {

    T.test('Ningún golpe individual supera el 30 % de la vida máxima', function () {
      var offenders = [];
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        var ability = Arena.Data.abilities[id];
        if (!Arena.Combat.Resolver.abilityCausesDamage(ability)) continue;

        var w = T.makeWorld();
        var caster = T.spawn(w, ability.classId, { team: 0, x: 0, z: 0 });
        var target = referenceTarget(w);

        // Peor caso realista: Furia/amplificación máxima y defensa al mínimo.
        Status.apply(w, caster, {
          effect: 'damageAmp', duration: 30, abilityId: 'test',
          data: { damageDealtPct: 0.25 }
        }, caster);
        Status.apply(w, target, {
          effect: 'armorBreak', duration: 30, abilityId: 'test',
          data: { armorReductionPct: B.CAP.defenseReduction }
        }, caster);
        Status.apply(w, target, {
          effect: 'resistBreak', duration: 30, abilityId: 'test',
          data: { resistReductionPct: B.CAP.defenseReduction }
        }, caster);

        var hpBefore = target.hp;
        T.resolveDirect(w, caster, id, target);
        var pct = (hpBefore - target.hp) / target.hpMax;
        if (pct > B.TARGETS.singleHitMaxPct) {
          offenders.push(id + ' → ' + (pct * 100).toFixed(1) + ' %');
        }
      }
      T.assertEqual(offenders.length, 0,
        'golpes por encima del 30 %: ' + offenders.join(', '));
    });

    T.test('Ninguna aplicación de control duro supera los 2.4 s', function () {
      var offenders = [];
      var hardCategories = { hardDisable: 1, stasis: 1, silence: 1, root: 1, disarm: 1 };

      function scan(list, abId) {
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (e.type === 'status') {
            var d = Arena.Data.effects[e.effect];
            if (d && d.drCategory && hardCategories[d.drCategory]) {
              var limit = (d.drCategory === 'root' || d.drCategory === 'stasis')
                ? B.TARGETS.hardCC.exceptionalMax : B.TARGETS.hardCC.typicalMax;
              if ((e.duration || 0) > limit + 1e-6) {
                offenders.push(abId + ' → ' + e.effect + ' ' + e.duration + ' s (máx ' + limit + ')');
              }
            }
          }
          if (e.then) scan(e.then, abId);
          if (e.otherwise) scan(e.otherwise, abId);
          if (e.onTrigger) scan(e.onTrigger, abId);
        }
      }
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        scan(Arena.Data.abilities[id].effects || [], id);
      }
      T.assertEqual(offenders.length, 0, 'CC demasiado largo: ' + offenders.join(', '));
    });

    /** Vuelca una rotación sobre un objetivo pasivo adyacente durante N segundos. */
    function burstWindow(rotation, seconds) {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 0, x: 0, z: 3 });
      var target = T.spawn(w, 'arcanista', { team: 1, x: 1.8, z: 3 });
      dev.targetId = target.id;
      dev.autoAttackOn = true;
      /* Encarar al objetivo. Ya no hay auto-encarado: el ataque normal exige
         tener al enemigo en el arco frontal, y un jugador que ejecuta una
         rotación de burst evidentemente está mirándolo. Sin esta línea el
         harness mediría a alguien pegando de espaldas, que no es el escenario
         que estos objetivos de ritmo describen. */
      dev.yaw = Math.atan2(target.pos.x - dev.pos.x, target.pos.z - dev.pos.z);
      dev.prevYaw = dev.yaw;
      Arena.Data.passives.initEntity(dev);

      var hpBefore = target.hp;
      var idx = 0;
      var endAt = w.time + seconds;
      while (w.time < endAt) {
        if (idx < rotation.length && !dev.cast && dev.gcdUntil <= w.time) {
          var r = Arena.Combat.AbilitySystem.tryUse(w, dev, rotation[idx],
            { targetId: target.id, target: target });
          if (r.ok) idx++;
        }
        w.step(1);
      }
      return { pct: (hpBefore - target.hp) / target.hpMax, target: target };
    }

    T.test('Presión normal en 5 s: entre el 30 % y el 52 % de la vida', function () {
      // Sin Furia desatada: es el ritmo que se siente el 90 % del combate.
      var r = burstWindow([
        'devastador_golpe_quebrador', 'devastador_impacto_sismico', 'devastador_profanador'
      ], B.TARGETS.burstWindow.seconds);
      T.assertBetween(r.pct, B.TARGETS.burstWindow.minPct, B.TARGETS.burstWindow.maxPct,
        'presión normal de 5 s = ' + (r.pct * 100).toFixed(1) + ' % de la vida');
    });

    T.test('Burst máximo con todos los cooldowns duele pero no mata desde el 100 %', function () {
      var r = burstWindow([
        'devastador_furia', 'devastador_golpe_quebrador',
        'devastador_impacto_sismico', 'devastador_profanador'
      ], B.TARGETS.burstMax.seconds);
      T.assert(r.target.alive,
        'volcar todos los cooldowns no debe matar a un objetivo con la vida llena');
      T.assertBetween(r.pct, B.TARGETS.burstMax.minPct, B.TARGETS.burstMax.maxPct,
        'burst máximo de 5 s = ' + (r.pct * 100).toFixed(1) + ' % de la vida');
    });

    T.test('Un duelo Devastador vs Centinela se decide entre 12 y 30 s', function () {
      var r = duel('devastador', 'centinela');
      T.assert(r.decided, 'el duelo debe resolverse (llegó a ' + r.seconds.toFixed(1) + ' s)');
      T.assertBetween(r.seconds, B.TARGETS.ttk1v1.min, B.TARGETS.ttk1v1.max,
        'TTK = ' + r.seconds.toFixed(1) + ' s, ganó ' + r.winner);
    });

    T.test('Un duelo Arcanista vs Centinela se decide entre 12 y 30 s', function () {
      var r = duel('arcanista', 'centinela');
      T.assert(r.decided, 'el duelo debe resolverse (llegó a ' + r.seconds.toFixed(1) + ' s)');
      T.assertBetween(r.seconds, B.TARGETS.ttk1v1.min, B.TARGETS.ttk1v1.max,
        'TTK = ' + r.seconds.toFixed(1) + ' s, ganó ' + r.winner);
    });

    T.test('Un duelo Devastador vs Arcanista se decide entre 12 y 30 s', function () {
      var r = duel('devastador', 'arcanista');
      T.assert(r.decided, 'el duelo debe resolverse (llegó a ' + r.seconds.toFixed(1) + ' s)');
      T.assertBetween(r.seconds, B.TARGETS.ttk1v1.min, B.TARGETS.ttk1v1.max,
        'TTK = ' + r.seconds.toFixed(1) + ' s, ganó ' + r.winner);
    });

    T.test('Ninguna clase de daño gana todos los duelos: no hay dominante absoluta', function () {
      var dps = ['devastador', 'centinela', 'rastreador', 'arcanista'];
      var wins = {};
      for (var i = 0; i < dps.length; i++) wins[dps[i]] = 0;

      for (i = 0; i < dps.length; i++) {
        for (var j = i + 1; j < dps.length; j++) {
          var r = duel(dps[i], dps[j], { maxSeconds: 60 });
          if (r.winner) wins[r.winner]++;
        }
      }
      var maxWins = 0, name = '';
      for (var k in wins) if (wins[k] > maxWins) { maxWins = wins[k]; name = k; }
      T.assert(maxWins <= 3,
        'ninguna clase debe ganarlo todo — ' + name + ' ganó ' + maxWins +
        ' de 3 · marcador: ' + JSON.stringify(wins));
    });

    /** 2v2 completo. `withSupport` sustituye al segundo del bando 1 por soporte. */
    function teamFight(withSupport, seed, maxSeconds) {
      var w = new Arena.Sim.World({ seed: seed === undefined ? 11 : seed });
      w.settings.aiEnabled = true;
      w.settings.rngEnabled = false;
      w.start();

      /* Todos en el carril central, que es espacio abierto comprobado. Un solo
         combatiente que nazca dentro de una ruina deja de pelear y convierte
         esta prueba de balance en una prueba de un bot atascado — con un número
         que parece un problema de balance y no lo es. */
      var roster = [
        ['devastador', 0, -8, 0], ['arcanista', 0, -11, 0],
        ['centinela', 1, 9, 0], [withSupport ? 'vinculador' : 'rastreador', 1, 12, 0]
      ];
      var ents = roster.map(function (r) {
        T.requireFreeSpot(w, r[2], r[3], r[0]);
        var e = Arena.Data.makeEntity(r[0], { team: r[1], x: r[2], z: r[3] });
        e.aiProfile = 'bot';
        w.addEntity(e);
        Arena.Data.passives.initEntity(e);
        return e;
      });

      var limit = (maxSeconds || 75) * B.TICK_RATE;
      for (var i = 0; i < limit; i++) {
        w.step(1);
        var anyDead = ents.some(function (e) { return !e.alive; });
        if (anyDead) break;
      }
      return {
        seconds: w.time,
        decided: ents.some(function (e) { return !e.alive; }),
        healing: ents[3].stats.healingDone
      };
    }

    T.test('Un 2v2 con soporte se decide dentro del límite', function () {
      var r = teamFight(true);
      T.assert(r.decided,
        'un 2v2 con soporte debe decidirse en 75 s (llegó a ' + r.seconds.toFixed(1) + ' s)');
    });

    T.test('El soporte alarga la pelea de forma medible', function () {
      var withSup = teamFight(true, 11);
      var without = teamFight(false, 11);
      T.assert(withSup.healing > 300,
        'el soporte debe estar curando de verdad, curó ' + withSup.healing.toFixed(0));
      T.assert(withSup.seconds > without.seconds,
        'con soporte la primera muerte debe tardar más: ' + withSup.seconds.toFixed(1) +
        ' s con soporte vs ' + without.seconds.toFixed(1) + ' s sin él');
    });

    T.test('El maná limita al soporte: no puede curar indefinidamente', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0, x: 0, z: 3 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 2, z: 3 });
      Arena.Data.passives.initEntity(binder);

      // Rotación completa de curación, no un solo botón: es lo que hace un
      // soporte real sosteniendo a un aliado bajo presión constante.
      var kit = ['vinculador_pulso_vital', 'vinculador_regeneracion', 'vinculador_barrera'];
      var casts = 0;
      for (var i = 0; i < 20 * B.TICK_RATE; i++) {
        ally.hp = ally.hpMax * 0.3;      // pozo sin fondo: mide sólo el maná
        if (!binder.cast && binder.gcdUntil <= w.time) {
          for (var k = 0; k < kit.length; k++) {
            var r = Arena.Combat.AbilitySystem.tryUse(w, binder, kit[k],
              { targetId: ally.id, target: ally });
            if (r.ok) { casts++; break; }
          }
        }
        w.step(1);
      }
      T.assert(casts >= 8, 'debía haber curado repetidamente, hizo ' + casts);
      T.assert(binder.resource < binder.resourceMax * 0.5,
        'tras 20 s de curación continua el maná debe estar bajo, está en ' +
        binder.resource.toFixed(0) + '/' + binder.resourceMax);
    });

    T.test('Las clases frágiles mueren más rápido que el Guardián', function () {
      var w = T.makeWorld();
      var attacker = T.spawn(w, 'devastador', { team: 0, x: 0, z: 3 });

      function ttk(classId) {
        var wl = T.makeWorld();
        var atk = T.spawn(wl, 'devastador', { team: 0, x: 0, z: 3 });
        var victim = T.spawn(wl, classId, { team: 1, x: 1.8, z: 3 });
        var total = 0, hits = 0;
        while (victim.alive && hits < 400) {
          Dmg.applyDamage(wl, {
            source: atk, target: victim, raw: atk.power * 1.3,
            school: 'physical', abilityId: 'bench'
          });
          hits++;
        }
        return hits;
      }
      var guardHits = ttk('guardian');
      var mageHits = ttk('arcanista');
      T.assert(guardHits > mageHits * 1.5,
        'el Guardián debe aguantar bastante más que el Arcanista (' +
        guardHits + ' vs ' + mageHits + ' golpes)');
    });

    T.test('La cadencia de decisión permite actuar al menos cada 0.9 s', function () {
      // El GCD estándar más largo del juego marca el suelo de la cadencia.
      var maxGcd = 0;
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        var g = Arena.Data.abilities[id].gcd;
        var v = typeof g === 'number' ? g : B.GCD[g];
        if (v > maxGcd) maxGcd = v;
      }
      T.assertBetween(maxGcd, 0.45, 0.90, 'el GCD más largo es ' + maxGcd + ' s');
    });

    T.test('Todo poder de alto impacto tiene coste, cooldown o casteo', function () {
      var offenders = [];
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        var a = Arena.Data.abilities[id];
        var hasBrake = (a.cooldown > 0) || (a.castTime > 0) || (a.cost > 0);
        if (!hasBrake) offenders.push(id);
      }
      T.assertEqual(offenders.length, 0,
        'poderes sin ningún freno (§2, "cada acción tiene respuesta"): ' + offenders.join(', '));
    });

    T.test('Cada clase tiene al menos una respuesta defensiva o de escape', function () {
      var missing = [];
      var order = Arena.Data.classOrder;
      for (var i = 0; i < order.length; i++) {
        var c = Arena.Data.classes[order[i]];
        var found = false;
        for (var j = 0; j < c.abilities.length; j++) {
          var a = Arena.Data.abilities[c.abilities[j]];
          if (a.flags.defensive || a.flags.mobility) { found = true; break; }
          for (var k = 0; k < a.effects.length; k++) {
            var t = a.effects[k].type;
            if (t === 'cleanse' || t === 'barrier' || t === 'heal') { found = true; break; }
          }
          if (found) break;
        }
        if (!found) missing.push(c.name);
      }
      T.assertEqual(missing.length, 0, 'clases sin herramienta de respuesta: ' + missing.join(', '));
    });
  });
});
