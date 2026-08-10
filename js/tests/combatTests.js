/* =============================================================================
 * tests/combatTests.js — Batería obligatoria antes de añadir arte (documento §26)
 * más las reglas derivadas de §7, §9, §10 y §11.
 *
 * Si algo de aquí falla, el combate está roto aunque el juego "se vea bien".
 * ========================================================================== */
Arena.define('tests/combatTests', ['tests/testRunner', 'data/passives'], function (Arena) {
  'use strict';

  var T = Arena.Tests;
  var B = Arena.Data.balance;
  var Status = Arena.Combat.StatusSystem;
  var Dmg = Arena.Combat.DamageSystem;
  var Heal = Arena.Combat.HealingSystem;
  var Ability = Arena.Combat.AbilitySystem;

  /* =========================================================================
   * §26 — Tests mínimos obligatorios
   * ====================================================================== */
  T.suite('§26 · Counters obligatorios', function () {

    T.test('Intervención + Root sin daño → la habilidad es rechazada y no aplica Root', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 1, x: 0, z: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 3, z: 0 });

      Status.apply(w, ally, { effect: 'intervention', duration: 5, abilityId: 'test' }, ally);
      var hit = T.resolveDirect(w, mage, 'arcanista_prision', ally);

      T.assertEqual(hit.outcome, 'intervention', 'la habilidad debía ser anulada');
      T.assertFalse(ally.hasStatus('root'), 'Prisión etérea no debe aplicar Root bajo Intervención');
    });

    T.test('Intervención + habilidad con daño + CC → impacta y resuelve todo', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 1, x: 0, z: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 3, z: 0 });

      Status.apply(w, ally, { effect: 'intervention', duration: 5, abilityId: 'test' }, ally);
      var hpBefore = ally.hp;
      var hit = T.resolveDirect(w, mage, 'arcanista_impacto_celeste', ally);

      T.assertEqual(hit.outcome, 'hit', 'una habilidad dañina debe atravesar la Intervención');
      T.assert(ally.hp < hpBefore, 'debía recibir daño');
      T.assert(ally.hasStatus('silence'), 'el CC asociado a una habilidad dañina sí se aplica');
    });

    T.test('Reflejo + proyectil mágico de objetivo único → se resuelve contra el lanzador', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 1, x: 0, z: 0 });
      var guard = T.spawn(w, 'guardian', { team: 0, x: 5, z: 0 });

      Status.apply(w, guard, { effect: 'reflect', duration: 5, abilityId: 'test' }, guard);
      var guardHp = guard.hp, mageHp = mage.hp;
      var hit = T.resolveDirect(w, mage, 'arcanista_descarga', guard);

      T.assertEqual(hit.outcome, 'reflected', 'el hechizo debía reflejarse');
      T.assertEqual(guard.hp, guardHp, 'el Guardián no debe recibir daño');
      T.assert(mage.hp < mageHp, 'el daño debe recaer sobre el lanzador');
      T.assertFalse(guard.hasStatus('reflect'), 'el reflejo tiene una sola carga y se consume');
    });

    T.test('Reflejo + AoE → no se refleja', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 1, x: 0, z: 0 });
      var guard = T.spawn(w, 'guardian', { team: 0, x: 2, z: 0 });

      Status.apply(w, guard, { effect: 'reflect', duration: 5, abilityId: 'test' }, guard);
      var hit = Arena.Combat.Resolver.resolveHit(
        w, dev, guard, Arena.Data.abilities.devastador_bramido, { isAoE: true });

      T.assert(hit.outcome !== 'reflected', 'un área nunca se refleja');
      T.assert(guard.hasStatus('reflect'), 'la carga de reflejo no debe consumirse con un AoE');
    });

    T.test('AntiBuff + curación → la curación no surte efecto', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0, x: 0, z: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 3, z: 0 });
      ally.hp = 500;

      Status.apply(w, ally, { effect: 'antiBuff', duration: 4, abilityId: 'test' }, ally);
      var res = Heal.applyHeal(w, { source: binder, target: ally, raw: 300, abilityId: 'test' });

      T.assert(res.blocked, 'la curación debía estar bloqueada');
      T.assertEqual(ally.hp, 500, 'la vida no debe cambiar bajo AntiBuff');
    });

    T.test('AntiBuff + barrera y buffs → todo lo positivo se bloquea', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0, x: 0, z: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 3, z: 0 });

      Status.apply(w, ally, { effect: 'antiBuff', duration: 4, abilityId: 'test' }, ally);
      Heal.applyBarrier(w, { source: binder, target: ally, amount: 200, duration: 8, abilityId: 'test' });
      T.assertEqual(ally.totalBarrier(), 0, 'la barrera no debe aplicarse bajo AntiBuff');

      Status.apply(w, ally, { effect: 'damageAmp', duration: 5, abilityId: 'test', data: { damageDealtPct: 0.25 } }, ally);
      T.assertFalse(ally.hasStatus('damageAmp'), 'ningún buff nuevo entra bajo AntiBuff');
    });

    T.test('AntiBuff no elimina los buffs ya activos', function () {
      var w = T.makeWorld();
      var ally = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });

      Status.apply(w, ally, { effect: 'damageAmp', duration: 5, abilityId: 'test', data: { damageDealtPct: 0.25 } }, ally);
      Status.apply(w, ally, { effect: 'antiBuff', duration: 4, abilityId: 'test' }, ally);

      T.assert(ally.hasStatus('damageAmp'), 'AntiBuff bloquea, no purga (§9)');
    });

    T.test('AntiHeal 40 % + heal 300 → se reciben 180 HP', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0, x: 0, z: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 3, z: 0 });
      ally.hp = 500;

      Status.apply(w, ally, {
        effect: 'antiHeal', duration: 7, abilityId: 'test', data: { antiHealPct: 0.40 }
      }, ally);
      var res = Heal.applyHeal(w, { source: binder, target: ally, raw: 300, abilityId: 'test' });

      T.assertNear(res.applied, 180, 0.01, 'AntiHeal 40 % sobre 300 debe dar 180');
      T.assertNear(ally.hp, 680, 0.01);
    });

    T.test('AntiHeal no afecta a las barreras', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0, x: 0, z: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 3, z: 0 });

      Status.apply(w, ally, {
        effect: 'antiHeal', duration: 7, abilityId: 'test', data: { antiHealPct: 0.60 }
      }, ally);
      Heal.applyBarrier(w, { source: binder, target: ally, amount: 200, duration: 8, abilityId: 'test' });

      T.assertNear(ally.totalBarrier(), 200, 0.01, 'la barrera se aplica íntegra');
    });

    T.test('Freeze/Estasis → ni actúa ni recibe impactos mientras está aislado', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 1, x: 0, z: 0 });
      var victim = T.spawn(w, 'devastador', { team: 0, x: 3, z: 0 });

      Status.apply(w, victim, { effect: 'stasis', duration: 1.8, abilityId: 'test' }, mage);

      T.assertFalse(victim.isTargetable(), 'no puede ser seleccionado');
      var hpBefore = victim.hp;
      Dmg.applyDamage(w, { source: mage, target: victim, raw: 500, school: 'pure', abilityId: 'test' });
      T.assertEqual(victim.hp, hpBefore, 'no recibe daño en estasis');

      var check = Ability.canUse(w, victim, Arena.Data.abilities.devastador_furia, {});
      T.assertFalse(check.ok, 'no puede actuar en estasis');
    });

    T.test('Root → no se mueve pero sí puede castear y atacar', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 1, x: 0, z: 3 });
      var victim = T.spawn(w, 'centinela', { team: 0, x: 8, z: 3 });
      victim.targetId = mage.id;

      Status.apply(w, victim, { effect: 'root', duration: 2.2, abilityId: 'test' }, mage);

      T.assertEqual(victim.moveSpeed(), 0, 'la velocidad debe ser 0 bajo Root');
      var moved = w.moveEntityBy(victim, 1, 0, 0.1);
      T.assertFalse(moved, 'no debe desplazarse');

      var check = Ability.canUse(w, victim, Arena.Data.abilities.centinela_disparo_tensado,
        { targetId: mage.id, target: mage });
      T.assert(check.ok, 'debe poder castear estando enraizado: ' + check.reason);
    });

    T.test('Silence/Mareo → no usa habilidades, sí se mueve y ataca', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 1, x: 0, z: 0 });
      var victim = T.spawn(w, 'arcanista', { team: 0, x: 3, z: 0 });

      Status.apply(w, victim, { effect: 'silence', duration: 1.5, abilityId: 'test' }, dev);

      var check = Ability.canUse(w, victim, Arena.Data.abilities.arcanista_descarga,
        { targetId: dev.id, target: dev });
      T.assertFalse(check.ok, 'no debe poder lanzar habilidades');
      T.assertEqual(check.reason, 'silenced');
      T.assert(victim.moveSpeed() > 0, 'debe poder moverse');
      T.assert(victim.mods().canWeaponAttack, 'debe poder usar ataque normal');
    });

    T.test('Knockdown → cancela el cast y bloquea acciones hasta expirar', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 1, x: 2, z: 0 });
      var victim = T.spawn(w, 'arcanista', { team: 0, x: 0, z: 0 });

      T.forceCast(w, victim, 'arcanista_descarga', dev);
      T.assert(victim.isCasting(), 'debía estar casteando');

      Status.apply(w, victim, { effect: 'knockdown', duration: 1.3, abilityId: 'test' }, dev);
      T.assertFalse(victim.isCasting(), 'el noqueo debe cortar el casteo');
      T.assertEqual(victim.moveSpeed(), 0);
      T.assertFalse(victim.mods().canUseAbility);

      T.advance(w, 1.5);
      T.assert(victim.mods().canUseAbility, 'al expirar debe recuperar el control');
    });

    T.test('DR → aplicaciones repetidas reducen la duración y acaban en inmunidad', function () {
      var w = T.makeWorld();
      B.DR.enabled = true;
      var dev = T.spawn(w, 'devastador', { team: 1, x: 2, z: 0 });
      var victim = T.spawn(w, 'guardian', { team: 0, x: 0, z: 0 });

      var a = Status.apply(w, victim, { effect: 'stun', duration: 2.0, abilityId: 'test' }, dev);
      T.assertNear(a.duration, 2.0, 0.001, 'primera aplicación al 100 %');
      Status.removeInstance(w, victim, a, 'test');

      var b = Status.apply(w, victim, { effect: 'stun', duration: 2.0, abilityId: 'test' }, dev);
      T.assertNear(b.duration, 1.2, 0.001, 'segunda aplicación al 60 %');
      Status.removeInstance(w, victim, b, 'test');

      var c = Status.apply(w, victim, { effect: 'stun', duration: 2.0, abilityId: 'test' }, dev);
      T.assertNear(c.duration, 0.6, 0.001, 'tercera aplicación al 30 %');
      Status.removeInstance(w, victim, c, 'test');

      var d = Status.apply(w, victim, { effect: 'stun', duration: 2.0, abilityId: 'test' }, dev);
      T.assertEqual(d, null, 'la cuarta debe rebotar contra la inmunidad');
    });
  });

  /* =========================================================================
   * §7 — Fórmulas y caps
   * ====================================================================== */
  T.suite('§7 · Fórmulas, caps y apilado', function () {

    T.test('Mitigación física: 100 bruto contra armadura 100 → 50', function () {
      T.assertNear(B.mitigate(100, 100), 50, 0.001);
      T.assertNear(B.mitigate(100, 0), 100, 0.001);
      T.assertNear(B.mitigate(200, 50), 133.33, 0.01);
    });

    T.test('Los slows no se suman: se aplica el más fuerte', function () {
      var w = T.makeWorld();
      var e = T.spawn(w, 'devastador', { team: 0 });

      Status.apply(w, e, { effect: 'slow', duration: 5, abilityId: 'a', data: { slowPct: 0.25 } }, e);
      Status.apply(w, e, { effect: 'slow', duration: 5, abilityId: 'b', data: { slowPct: 0.40 } }, e);
      Status.apply(w, e, { effect: 'slow', duration: 5, abilityId: 'c', data: { slowPct: 0.15 } }, e);

      T.assertNear(e.mods().slowPct, 0.40, 0.001, 'debe quedarse con el 40 %, no con la suma');
      T.assertNear(e.moveSpeed(), B.MOVE_SPEED_BASE * 0.6, 0.01);
    });

    T.test('El slow tiene un tope global del 60 %', function () {
      var w = T.makeWorld();
      var e = T.spawn(w, 'devastador', { team: 0 });
      Status.apply(w, e, { effect: 'slow', duration: 5, abilityId: 'a', data: { slowPct: 0.95 } }, e);
      T.assertNear(e.mods().slowPct, B.CAP.slow, 0.001);
    });

    T.test('La reducción de defensa se acumula con tope del 40 %', function () {
      var w = T.makeWorld();
      var e = T.spawn(w, 'devastador', { team: 0 });   // armadura base 90

      Status.apply(w, e, { effect: 'armorBreak', duration: 6, abilityId: 'a', data: { armorReductionPct: 0.25 } }, e);
      T.assertNear(e.armor(), 90 * 0.75, 0.01);

      Status.apply(w, e, { effect: 'armorBreak', duration: 6, abilityId: 'b', data: { armorReductionPct: 0.25 } }, e);
      T.assertNear(e.mods().armorReductionPct, 0.40, 0.001, 'debe quedar topado al 40 %');
      T.assertNear(e.armor(), 90 * 0.60, 0.01);
    });

    T.test('AntiHeal tiene un tope del 60 %', function () {
      var w = T.makeWorld();
      var e = T.spawn(w, 'devastador', { team: 0 });
      Status.apply(w, e, { effect: 'antiHeal', duration: 6, abilityId: 'a', data: { antiHealPct: 0.90 } }, e);
      T.assertNear(e.mods().antiHealPct, B.CAP.antiHeal, 0.001);
    });

    T.test('Las barreras absorben daño ya mitigado antes de tocar la vida', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0, x: 0, z: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 2, z: 0 });   // armadura 90
      var attacker = T.spawn(w, 'centinela', { team: 1, x: 5, z: 0 });

      Heal.applyBarrier(w, { source: binder, target: ally, amount: 100, duration: 8, abilityId: 'test' });
      var hpBefore = ally.hp;

      // 190 bruto contra armadura 90 → 100 mitigado → lo absorbe entero.
      var res = Dmg.applyDamage(w, { source: attacker, target: ally, raw: 190, school: 'physical', abilityId: 'test' });

      T.assertNear(res.mitigated, 100, 0.01);
      T.assertNear(res.absorbed, 100, 0.01);
      T.assertEqual(ally.hp, hpBefore, 'la vida no debe bajar');
      T.assertEqual(ally.totalBarrier(), 0, 'la barrera debe quedar consumida');
    });

    T.test('Barreras del mismo poder no se suman: se queda la mayor', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 2 });

      Heal.applyBarrier(w, { source: binder, target: ally, amount: 100, duration: 8, abilityId: 'vinculador_barrera' });
      Heal.applyBarrier(w, { source: binder, target: ally, amount: 180, duration: 8, abilityId: 'vinculador_barrera' });
      T.assertNear(ally.totalBarrier(), 180, 0.01);

      Heal.applyBarrier(w, { source: binder, target: ally, amount: 50, duration: 8, abilityId: 'vinculador_barrera' });
      T.assertNear(ally.totalBarrier(), 180, 0.01, 'una barrera menor no debe reemplazar a la mayor');
    });

    T.test('La curación nunca sobrecura por encima del máximo', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 2 });
      ally.hp = ally.hpMax - 50;

      var res = Heal.applyHeal(w, { source: binder, target: ally, raw: 300, abilityId: 'test' });
      T.assertEqual(ally.hp, ally.hpMax);
      T.assertNear(res.applied, 50, 0.01);
      T.assertNear(res.overheal, 250, 0.01);
    });
  });

  /* =========================================================================
   * §9 y §10 — Counters y orden de resolución
   * ====================================================================== */
  T.suite('§9-10 · Orden de resolución y counters', function () {

    T.test('Estasis tiene prioridad sobre Intervención y Reflejo', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 1 });
      var victim = T.spawn(w, 'guardian', { team: 0, x: 4 });

      Status.apply(w, victim, { effect: 'stasis', duration: 2, abilityId: 'test' }, mage);
      Status.apply(w, victim, { effect: 'reflect', duration: 5, abilityId: 'test' }, victim);

      var hit = T.resolveDirect(w, mage, 'arcanista_descarga', victim);
      T.assertEqual(hit.outcome, 'stasis', 'Estasis se evalúa primero (§10, paso 5)');
      T.assert(victim.hasStatus('reflect'), 'la carga de reflejo no se consume');
    });

    T.test('Bloqueo anula impactos directos de un solo objetivo', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 1 });
      var guard = T.spawn(w, 'guardian', { team: 0, x: 2 });

      Status.apply(w, guard, { effect: 'block', duration: 2.5, abilityId: 'test', data: { slowPct: 0.35 } }, guard);
      var hpBefore = guard.hp;
      var hit = T.resolveDirect(w, dev, 'devastador_impacto_sismico', guard);

      T.assertEqual(hit.outcome, 'blocked');
      T.assertEqual(guard.hp, hpBefore);
      T.assertFalse(guard.hasStatus('knockdown'), 'el CC asociado también queda bloqueado');
    });

    T.test('Bloqueo impide al Guardián usar poderes ofensivos', function () {
      var w = T.makeWorld();
      var guard = T.spawn(w, 'guardian', { team: 0 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 2 });

      Status.apply(w, guard, { effect: 'block', duration: 2.5, abilityId: 'test', data: { slowPct: 0.35 } }, guard);
      var check = Ability.canUse(w, guard, Arena.Data.abilities.guardian_avasallamiento,
        { targetId: enemy.id, target: enemy });
      T.assertFalse(check.ok);
      T.assertEqual(check.reason, 'noOffense');
    });

    T.test('Postura inexpugnable bloquea las habilidades dañinas, no las de apoyo', function () {
      var w = T.makeWorld();
      var guard = T.spawn(w, 'guardian', { team: 0 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 2 });
      var ally = T.spawn(w, 'vinculador', { team: 0, x: -2 });

      Status.apply(w, guard, { effect: 'noOffense', duration: 5, abilityId: 'test', data: { damageTakenPct: -0.35 } }, guard);

      var dmgCheck = Ability.canUse(w, guard, Arena.Data.abilities.guardian_avasallamiento,
        { targetId: enemy.id, target: enemy });
      T.assertFalse(dmgCheck.ok, 'no debe poder usar la habilidad dañina');
      T.assertEqual(dmgCheck.reason, 'noDamage');

      var supCheck = Ability.canUse(w, guard, Arena.Data.abilities.guardian_proteccion_aliada,
        { targetId: ally.id, target: ally });
      T.assert(supCheck.ok, 'sí debe poder proteger: ' + supCheck.reason);
    });

    T.test('Confusión táctica bloquea utility y defensivos, no el daño', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 2 });
      var enemy = T.spawn(w, 'rastreador', { team: 1, x: 8 });

      Status.apply(w, binder, { effect: 'utilityLock', duration: 4, abilityId: 'test' }, enemy);

      var healCheck = Ability.canUse(w, binder, Arena.Data.abilities.vinculador_pulso_vital,
        { targetId: ally.id, target: ally });
      T.assertFalse(healCheck.ok, 'la curación no debe poder lanzarse');
      T.assertEqual(healCheck.reason, 'utilityLocked');

      var dev = T.spawn(w, 'devastador', { team: 0, x: 4, id: 'dev2' });
      Status.apply(w, dev, { effect: 'utilityLock', duration: 4, abilityId: 'test' }, enemy);
      dev.pos.x = enemy.pos.x - 2;
      var dmgCheck = Ability.canUse(w, dev, Arena.Data.abilities.devastador_golpe_quebrador,
        { targetId: enemy.id, target: enemy });
      T.assert(dmgCheck.ok, 'las habilidades dañinas sí deben funcionar: ' + dmgCheck.reason);
    });

    T.test('Purga elimina buffs pero nunca los counters activos', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 1 });
      var guard = T.spawn(w, 'guardian', { team: 0, x: 2 });

      Status.apply(w, guard, { effect: 'reflect', duration: 5, abilityId: 'test' }, guard);
      Status.apply(w, guard, { effect: 'damageReduction', duration: 5, abilityId: 'test', data: { damageTakenPct: -0.2 } }, guard);

      Status.purge(w, guard, 3, dev);

      T.assert(guard.hasStatus('reflect'), 'el reflejo no es purgable');
      T.assertFalse(guard.hasStatus('damageReduction'), 'el buff normal sí se purga');
    });

    T.test('Cleanse quita 1 control duro antes que los debuffs menores', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 2 });

      Status.apply(w, ally, { effect: 'slow', duration: 5, abilityId: 'a', data: { slowPct: 0.3 } }, ally);
      Status.apply(w, ally, { effect: 'root', duration: 3, abilityId: 'b' }, ally);
      Status.apply(w, ally, { effect: 'antiHeal', duration: 5, abilityId: 'c', data: { antiHealPct: 0.4 } }, ally);

      Status.cleanse(w, ally, { hard: 1, minor: 0 }, binder);
      T.assertFalse(ally.hasStatus('root'), 'debía quitar el control duro');
      T.assert(ally.hasStatus('slow'), 'el slow sigue: sólo se pidió 1 duro');
    });

    T.test('AntiBuff también bloquea el Cleanse (decisión documentada de §30)', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 2 });

      Status.apply(w, ally, { effect: 'root', duration: 3, abilityId: 'b' }, ally);
      Status.apply(w, ally, { effect: 'antiBuff', duration: 4, abilityId: 'c' }, ally);

      var removed = Status.cleanse(w, ally, { hard: 1, minor: 3 }, binder);
      T.assertEqual(removed.length, 0, 'no debe limpiar nada bajo AntiBuff');
      T.assert(ally.hasStatus('root'));
    });

    T.test('Estasis no es disipable: quitarla sería un regalo, no un rescate', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 2 });

      Status.apply(w, ally, { effect: 'stasis', duration: 1.8, abilityId: 'b' }, ally);
      Status.cleanse(w, ally, { hard: 1, minor: 3 }, binder);
      T.assert(ally.hasStatus('stasis'), 'la estasis debe sobrevivir al cleanse');
    });

    T.test('Interponer desvía daño al Guardián resolviéndolo contra SU armadura', function () {
      var w = T.makeWorld();
      var guard = T.spawn(w, 'guardian', { team: 0, x: 0 });
      var ally = T.spawn(w, 'arcanista', { team: 0, x: 2 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 6 });

      Status.apply(w, ally, {
        effect: 'damageRedirect', duration: 4, abilityId: 'test',
        data: { redirectPct: 0.35, protectorId: guard.id }
      }, guard);

      var guardHp = guard.hp, allyHp = ally.hp;
      Dmg.applyDamage(w, { source: enemy, target: ally, raw: 400, school: 'physical', abilityId: 'test' });

      T.assert(guard.hp < guardHp, 'el Guardián debe recibir su parte');
      T.assert(ally.hp < allyHp, 'el aliado sigue recibiendo el resto');
      var toAlly = allyHp - ally.hp;
      var toGuard = guardHp - guard.hp;
      T.assert(toGuard > 0 && toGuard < toAlly, 'debe redirigirse una fracción, no el total');
    });

    T.test('Enlace protector nunca puede matar al Vinculador', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0, x: 0 });
      var ally = T.spawn(w, 'guardian', { team: 0, x: 2 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 6 });
      binder.hp = 20;

      Status.apply(w, ally, {
        effect: 'protectiveLink', duration: 5, abilityId: 'test',
        data: { reductionPct: 0.25, sharePct: 0.5, binderId: binder.id }
      }, binder);

      Dmg.applyDamage(w, { source: enemy, target: ally, raw: 3000, school: 'physical', abilityId: 'test' });

      T.assert(binder.alive, 'el Vinculador debe seguir vivo');
      T.assert(binder.hp >= 1, 'debe quedarse en 1 HP como mínimo, tiene ' + binder.hp);
    });
  });

  /* =========================================================================
   * §6 — Ritmo de acción: GCD, cola de input, interrupción
   * ====================================================================== */
  T.suite('§6 · Ritmo, GCD, cola e interrupción', function () {

    T.test('El GCD bloquea la siguiente acción durante su duración', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 0 });
      var enemy = T.spawn(w, 'guardian', { team: 1, x: 2 });
      dev.targetId = enemy.id;

      var r = Ability.tryUse(w, dev, 'devastador_golpe_quebrador', { targetId: enemy.id, target: enemy });
      T.assert(r.ok, 'la primera debe salir: ' + r.reason);
      T.assertNear(dev.gcdRemaining(w.time), B.GCD.standard, 0.001);

      var r2 = Ability.tryUse(w, dev, 'devastador_impacto_sismico', { targetId: enemy.id, target: enemy });
      T.assertFalse(r2.ok, 'la segunda debe rebotar contra el GCD');
      T.assertEqual(r2.reason, 'gcd');
    });

    T.test('Una pulsación dentro de la ventana de cola se ejecuta sola al liberarse', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 0 });
      var enemy = T.spawn(w, 'guardian', { team: 1, x: 2 });
      dev.targetId = enemy.id;

      Ability.tryUse(w, dev, 'devastador_golpe_quebrador', { targetId: enemy.id, target: enemy });
      T.advance(w, B.GCD.standard - 0.10);   // dentro de la ventana de 0.20 s

      var r = Ability.tryUse(w, dev, 'devastador_impacto_sismico', { targetId: enemy.id, target: enemy });
      T.assert(r.queued, 'debía quedar en cola');

      var used = false;
      var off = w.bus.on('AbilityExecuted', function (p) {
        if (p.abilityId === 'devastador_impacto_sismico') used = true;
      });
      T.advance(w, 0.30);
      off();
      T.assert(used, 'la habilidad en cola debe dispararse al terminar el GCD');
      T.assertEqual(dev.queued, null, 'la cola debe vaciarse');
    });

    T.test('Fuera de la ventana de cola la pulsación se rechaza, no se guarda', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 0 });
      var enemy = T.spawn(w, 'guardian', { team: 1, x: 2 });
      dev.targetId = enemy.id;

      Ability.tryUse(w, dev, 'devastador_golpe_quebrador', { targetId: enemy.id, target: enemy });
      var r = Ability.tryUse(w, dev, 'devastador_impacto_sismico', { targetId: enemy.id, target: enemy });
      T.assertFalse(r.queued, 'con 0.80 s restantes no debe encolarse');
    });

    T.test('El rango y la línea de visión nunca se encolan', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 0, x: 0 });
      var enemy = T.spawn(w, 'guardian', { team: 1, x: 25 });
      dev.targetId = enemy.id;

      var r = Ability.tryUse(w, dev, 'devastador_impacto_sismico', { targetId: enemy.id, target: enemy });
      T.assertFalse(r.ok);
      T.assertEqual(r.reason, 'range');
      T.assertFalse(r.queued, 'una acción fuera de rango no debe quedarse esperando');
    });

    T.test('Moverse cancela un casteo estacionario', function () {
      var w = T.makeWorld();
      var sent = T.spawn(w, 'centinela', { team: 0, x: 0, z: 3 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 10, z: 3 });

      T.forceCast(w, sent, 'centinela_disparo_tensado', enemy);
      T.assert(sent.isCasting());

      var interrupted = false;
      var off = w.bus.on('AbilityCastInterrupted', function (p) {
        if (p.reason === 'moved') interrupted = true;
      });
      w.moveEntityBy(sent, -1, 0, 0.2);
      T.advance(w, 0.1);
      off();

      T.assert(interrupted, 'moverse debe cancelar Disparo tensado');
      T.assertFalse(sent.isCasting());
    });

    T.test('Interrumpir bloquea la escuela de la habilidad cortada', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 0, x: 0, z: 3 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 5, z: 3 });

      T.forceCast(w, mage, 'arcanista_impacto_celeste', enemy);
      Ability.interruptCast(w, mage, { reason: 'interrupt', sourceId: enemy.id, lockout: B.INTERRUPT_LOCKOUT });

      var check = Ability.canUse(w, mage, Arena.Data.abilities.arcanista_descarga,
        { targetId: enemy.id, target: enemy });
      T.assertFalse(check.ok, 'la escuela arcana debe quedar bloqueada');
      T.assertEqual(check.reason, 'lockout');

      T.advance(w, B.INTERRUPT_LOCKOUT + 0.1);
      var check2 = Ability.canUse(w, mage, Arena.Data.abilities.arcanista_descarga,
        { targetId: enemy.id, target: enemy });
      T.assert(check2.ok, 'al expirar el bloqueo debe volver a lanzar: ' + check2.reason);
    });

    T.test('Un cast que pierde la línea de visión se disipa sin gastar el efecto', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 0, x: 0, z: -6 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 0, z: -3 });

      T.forceCast(w, mage, 'arcanista_prision', enemy);
      // Interponer el muro central bajo, que está en z = -8.2.
      enemy.pos.z = -10.5;

      var fizzled = false;
      var off = w.bus.on('AbilityFizzled', function (p) { if (p.reason === 'los') fizzled = true; });
      T.advance(w, 1.2);
      off();

      T.assert(fizzled, 'debía disiparse por falta de línea de visión');
      T.assertFalse(enemy.hasStatus('root'));
    });
  });

  /* =========================================================================
   * §5 — Targeting, rango, LoS y movimiento
   * ====================================================================== */
  T.suite('§5 · Targeting, rango y movimiento', function () {

    T.test('Una columna corta la línea de visión', function () {
      var w = T.makeWorld();
      // Columna en (4.5, 0) de 1.5 × 1.5
      var a = { x: 0, y: 1.2, z: 0 };
      var b = { x: 10, y: 1.2, z: 0 };
      T.assertFalse(w.hasLineOfSight(a, b), 'la columna central debe bloquear');
      T.assert(w.hasLineOfSight({ x: 0, y: 1.2, z: 5 }, { x: 10, y: 1.2, z: 5 }),
        'desplazado 5 unidades debe haber visión');
    });

    T.test('El rango se mide en el plano XZ: una rampa no regala alcance', function () {
      var w = T.makeWorld();
      var a = T.spawn(w, 'centinela', { team: 0, x: -12.5, z: -9 });   // plataforma alta
      var b = T.spawn(w, 'devastador', { team: 1, x: -12.5, z: 4 });
      a.pos.y = 1.5;

      var dist3d = Arena.Math.Vec3.dist(a.pos, b.pos);
      var distXZ = Arena.Math.Vec3.distXZ(a.pos, b.pos);
      T.assert(dist3d > distXZ, 'la distancia 3D debe ser mayor por la altura');

      var check = Ability.canUse(w, a, Arena.Data.abilities.centinela_disparo_tensado,
        { targetId: b.id, target: b });
      T.assert(check.ok, 'debe seguir en rango usando XZ: ' + check.reason);
    });

    T.test('Nadie atraviesa un muro al moverse', function () {
      var w = T.makeWorld();
      var e = T.spawn(w, 'devastador', { team: 0, x: 0, z: -6 });
      for (var i = 0; i < 60; i++) w.moveEntityBy(e, 0, -1, 1 / 30);
      T.assert(e.pos.z > -8.0, 'el muro central en z=-8.2 debe frenarlo, está en ' + e.pos.z.toFixed(2));
    });

    T.test('Una carga no atraviesa paredes', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 0, x: 0, z: -6.5 });
      var enemy = T.spawn(w, 'guardian', { team: 1, x: 0, z: -11 });

      T.resolveDirect(w, dev, 'devastador_embestida', enemy);
      T.assert(dev.pos.z > -8.0, 'la carga debe detenerse contra el muro, acabó en ' + dev.pos.z.toFixed(2));
    });

    T.test('Los personajes no se atraviesan entre sí', function () {
      var w = T.makeWorld();
      var a = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      var b = T.spawn(w, 'guardian', { team: 1, x: 2, z: 0 });

      for (var i = 0; i < 60; i++) w.moveEntityBy(a, 1, 0, 1 / 30);
      var d = Arena.Math.Vec3.distXZ(a.pos, b.pos);
      T.assert(d >= a.radius + b.radius - 0.05, 'deben mantener separación, distancia = ' + d.toFixed(2));
    });

    T.test('Un objetivo en sigilo no puede seleccionarse', function () {
      var w = T.makeWorld();
      var hunter = T.spawn(w, 'rastreador', { team: 1, x: 0 });
      var dev = T.spawn(w, 'devastador', { team: 0, x: 2 });

      Status.apply(w, hunter, { effect: 'stealth', duration: 12, abilityId: 'test', data: { slowPct: 0.15 } }, hunter);
      var check = Ability.canUse(w, dev, Arena.Data.abilities.devastador_impacto_sismico,
        { targetId: hunter.id, target: hunter });
      T.assertFalse(check.ok);
      T.assertEqual(check.reason, 'untargetable');
    });

    T.test('Recibir daño rompe el sigilo; un daño periódico no', function () {
      var w = T.makeWorld();
      var hunter = T.spawn(w, 'rastreador', { team: 1, x: 0 });
      var dev = T.spawn(w, 'devastador', { team: 0, x: 2 });

      Status.apply(w, hunter, { effect: 'stealth', duration: 12, abilityId: 'test', data: { slowPct: 0.15 } }, hunter);
      Dmg.applyDamage(w, { source: dev, target: hunter, raw: 50, school: 'pure', abilityId: 'x', periodic: true });
      T.assert(hunter.mods().stealthed, 'un DoT no debe delatar al que huye');

      Dmg.applyDamage(w, { source: dev, target: hunter, raw: 50, school: 'pure', abilityId: 'x' });
      T.assertFalse(hunter.mods().stealthed, 'un golpe directo sí lo revela');
    });

    T.test('Un desplazamiento no rompe Enraizar', function () {
      var w = T.makeWorld();
      var sent = T.spawn(w, 'centinela', { team: 0, x: 0, z: 0 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 4, z: 0 });

      Status.apply(w, sent, { effect: 'root', duration: 3, abilityId: 'test' }, enemy);
      var before = { x: sent.pos.x, z: sent.pos.z };
      T.resolveDirect(w, sent, 'centinela_retroceso', sent);

      T.assertNear(sent.pos.x, before.x, 0.01, 'no debe desplazarse estando enraizado');
      T.assert(sent.hasStatus('slowImmunity'), 'el resto del payload sí se aplica');
    });
  });

  /* =========================================================================
   * §11 — Diminishing Returns
   * ====================================================================== */
  T.suite('§11 · Diminishing Returns', function () {

    T.test('Con DR desactivado no hay reducción de duración', function () {
      var w = T.makeWorld();
      B.DR.enabled = false;
      var dev = T.spawn(w, 'devastador', { team: 1 });
      var victim = T.spawn(w, 'guardian', { team: 0, x: 2 });

      var a = Status.apply(w, victim, { effect: 'stun', duration: 2.0, abilityId: 't' }, dev);
      Status.removeInstance(w, victim, a, 'test');
      var b = Status.apply(w, victim, { effect: 'stun', duration: 2.0, abilityId: 't' }, dev);
      T.assertNear(b.duration, 2.0, 0.001, 'sin DR la duración es íntegra');
      B.DR.enabled = true;
    });

    T.test('La inmunidad a Estasis existe incluso con DR desactivado', function () {
      var w = T.makeWorld();
      B.DR.enabled = false;
      var mage = T.spawn(w, 'arcanista', { team: 1 });
      var victim = T.spawn(w, 'devastador', { team: 0, x: 2 });

      var a = Status.apply(w, victim, { effect: 'stasis', duration: 1.8, abilityId: 't' }, mage);
      T.assert(a, 'la primera estasis debe entrar');
      T.advance(w, 2.0);
      var b = Status.apply(w, victim, { effect: 'stasis', duration: 1.8, abilityId: 't' }, mage);
      T.assertEqual(b, null, 'la segunda debe rebotar: el poder concede 8 s de inmunidad');
      B.DR.enabled = true;
    });

    T.test('El DR se reinicia pasada la ventana', function () {
      var w = T.makeWorld();
      B.DR.enabled = true;
      var dev = T.spawn(w, 'devastador', { team: 1 });
      var victim = T.spawn(w, 'guardian', { team: 0, x: 2 });

      var a = Status.apply(w, victim, { effect: 'stun', duration: 1.0, abilityId: 't' }, dev);
      T.assertNear(a.duration, 1.0, 0.001);
      T.advance(w, 1.0 + B.DR.categories.hardDisable.window + 0.5);

      var b = Status.apply(w, victim, { effect: 'stun', duration: 1.0, abilityId: 't' }, dev);
      T.assertNear(b.duration, 1.0, 0.001, 'pasada la ventana vuelve al 100 %');
    });

    T.test('Una cadena completa de control duro no supera el objetivo de 4 s', function () {
      var w = T.makeWorld();
      B.DR.enabled = true;
      var dev = T.spawn(w, 'devastador', { team: 1 });
      var victim = T.spawn(w, 'guardian', { team: 0, x: 2 });

      var total = 0;
      for (var i = 0; i < 6; i++) {
        var inst = Status.apply(w, victim, { effect: 'stun', duration: 1.6, abilityId: 't' }, dev);
        if (!inst) break;
        total += inst.duration;
        Status.removeInstance(w, victim, inst, 'test');
      }
      T.assert(total <= B.TARGETS.ccChainMax,
        'la cadena de control debe quedar por debajo de ' + B.TARGETS.ccChainMax + ' s, fue ' + total.toFixed(2));
    });

    T.test('Categorías distintas de CC no comparten DR', function () {
      var w = T.makeWorld();
      B.DR.enabled = true;
      var dev = T.spawn(w, 'devastador', { team: 1 });
      var victim = T.spawn(w, 'guardian', { team: 0, x: 2 });

      var s = Status.apply(w, victim, { effect: 'stun', duration: 1.6, abilityId: 't' }, dev);
      Status.removeInstance(w, victim, s, 'test');
      var r = Status.apply(w, victim, { effect: 'root', duration: 2.0, abilityId: 't' }, dev);
      T.assertNear(r.duration, 2.0, 0.001, 'Root tiene su propia cadena de DR');
    });
  });

  /* =========================================================================
   * Pasivas de clase
   * ====================================================================== */
  T.suite('Pasivas de clase', function () {

    T.test('Ímpetu: 5 cargas abaratan la siguiente ofensiva un 30 %', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 0 });
      var enemy = T.spawn(w, 'guardian', { team: 1, x: 2 });

      for (var i = 0; i < 5; i++) Arena.Data.passives._gainImpetu(w, dev);
      T.assertEqual(dev.charges.impetu, 5);
      T.assert(dev.hasStatus('empowered'), 'a 5 cargas debe aparecer el buff');

      var full = Arena.Data.abilities.devastador_impacto_sismico.cost;
      T.assertNear(Ability.costOf(w, dev, Arena.Data.abilities.devastador_impacto_sismico),
        full * 0.7, 0.01, 'debe costar un 30 % menos');
    });

    T.test('Resonancia: 3 habilidades ofensivas reducen el siguiente casteo un 25 %', function () {
      var w = T.makeWorld();
      var mage = T.spawn(w, 'arcanista', { team: 0 });
      var enemy = T.spawn(w, 'guardian', { team: 1, x: 8 });

      for (var i = 0; i < 3; i++) {
        Arena.Data.passives.onAbilityUsed(w, mage, Arena.Data.abilities.arcanista_descarga, {});
      }
      T.assert(mage.hasStatus('castHaste'), 'debía activarse Resonancia');
      T.assertNear(Ability.castTimeOf(w, mage, Arena.Data.abilities.arcanista_impacto_celeste),
        1.7 * 0.75, 0.01);
    });

    T.test('Bastión: reducción de daño sólo con un aliado cerca', function () {
      var w = T.makeWorld();
      var guard = T.spawn(w, 'guardian', { team: 0, x: 0 });
      var ally = T.spawn(w, 'vinculador', { team: 0, x: 3 });

      Arena.Data.passives.tick(w, guard, 1 / 30);
      T.assert(guard.hasStatus('bastion'), 'con aliado cerca debe estar activa');
      T.assertNear(guard.mods().damageTakenPct, -0.06, 0.001);

      ally.pos.x = 20;
      Arena.Data.passives.tick(w, guard, 1 / 30);
      T.assertFalse(guard.hasStatus('bastion'), 'lejos del aliado debe apagarse');
    });

    T.test('Distancia ideal: +8 % de daño sólo más allá de 16 unidades', function () {
      var w = T.makeWorld();
      var sent = T.spawn(w, 'centinela', { team: 0, x: 0 });
      var enemy = T.spawn(w, 'devastador', { team: 1, x: 20 });
      sent.targetId = enemy.id;

      Arena.Data.passives.tick(w, sent, 1 / 30);
      T.assert(sent.hasStatus('sharpshooter'));
      T.assertNear(sent.mods().damageDealtPct, 0.08, 0.001);

      enemy.pos.x = 5;
      Arena.Data.passives.tick(w, sent, 1 / 30);
      T.assertFalse(sent.hasStatus('sharpshooter'), 'a corta distancia se pierde');
    });

    T.test('Flujo compartido: curar por debajo del 60 % devuelve maná una vez cada 3 s', function () {
      var w = T.makeWorld();
      var binder = T.spawn(w, 'vinculador', { team: 0 });
      var ally = T.spawn(w, 'devastador', { team: 0, x: 3 });
      ally.hp = ally.hpMax * 0.4;
      binder.resource = 50;

      Heal.applyHeal(w, { source: binder, target: ally, raw: 100, abilityId: 'test' });
      T.assert(binder.resource > 50, 'debía devolver maná');

      var after = binder.resource;
      ally.hp = ally.hpMax * 0.4;
      Heal.applyHeal(w, { source: binder, target: ally, raw: 100, abilityId: 'test' });
      T.assertNear(binder.resource, after, 0.001, 'la recuperación interna debe frenar el segundo disparo');
    });
  });

  /* =========================================================================
   * Robustez: casos que rompen simulaciones reales
   * ====================================================================== */
  T.suite('Robustez', function () {

    T.test('Morir limpia estados, casteo y cola', function () {
      var w = T.makeWorld();
      var dev = T.spawn(w, 'devastador', { team: 1, x: 2 });
      var victim = T.spawn(w, 'arcanista', { team: 0, x: 0 });

      T.forceCast(w, victim, 'arcanista_descarga', dev);
      Status.apply(w, victim, { effect: 'slow', duration: 5, abilityId: 't', data: { slowPct: 0.3 } }, dev);
      Dmg.applyDamage(w, { source: dev, target: victim, raw: 99999, school: 'pure', abilityId: 't' });

      T.assertFalse(victim.alive);
      T.assertEqual(victim.statuses.length, 0);
      T.assertEqual(victim.cast, null);
      T.assertEqual(victim.hp, 0);
    });

    T.test('Un DoT puede matar y no deja tics colgando', function () {
      var w = T.makeWorld();
      var hunter = T.spawn(w, 'rastreador', { team: 1, x: 5 });
      var victim = T.spawn(w, 'arcanista', { team: 0, x: 0 });
      victim.hp = 30;

      Status.apply(w, victim, {
        effect: 'dot', duration: 6, abilityId: 't',
        data: { tickDamage: 40, interval: 1.0, school: 'pure' }
      }, hunter);

      T.advance(w, 3.0);
      T.assertFalse(victim.alive, 'el DoT debe poder rematar');
      T.assertEqual(victim.statuses.length, 0);
    });

    T.test('Un listener que lanza excepción no tumba el tick', function () {
      var w = T.makeWorld();
      var e = T.spawn(w, 'devastador', { team: 0 });
      w.bus.on('Tick', function () { throw new Error('listener roto a propósito'); });
      T.advance(w, 0.5);
      T.assert(w.time > 0, 'la simulación debe seguir avanzando');
    });

    T.test('Los eventos emitidos son inmutables', function () {
      var w = T.makeWorld();
      var captured = null;
      w.bus.on('Tick', function (p) { captured = p; });
      T.advance(w, 1 / 30);
      T.assert(captured, 'debía capturarse un evento');
      var before = captured.time;
      try { captured.time = 999; } catch (err) { /* modo estricto */ }
      T.assertEqual(captured.time, before, 'el renderer no puede alterar el evento');
    });

    T.test('El paso fijo es independiente de los fotogramas', function () {
      var wa = T.makeWorld(); var wb = T.makeWorld();
      var a = T.spawn(wa, 'devastador', { team: 0 });
      var b = T.spawn(wb, 'devastador', { team: 0 });

      Status.apply(wa, a, { effect: 'root', duration: 2.0, abilityId: 't' }, a);
      Status.apply(wb, b, { effect: 'root', duration: 2.0, abilityId: 't' }, b);

      wa.advance(1 / 15); wa.advance(1 / 15); wa.advance(1 / 15);   // 15 fps
      for (var i = 0; i < 12; i++) wb.advance(1 / 60);               // 60 fps

      T.assertNear(wa.time, wb.time, 0.04, 'ambos relojes deben coincidir');
    });

    T.test('Todas las habilidades declaradas usan tipos de efecto implementados', function () {
      var handlers = Arena.Combat.Resolver.effectHandlers;
      var problems = [];
      function checkList(list, abId) {
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (!handlers[e.type]) problems.push(abId + ' → ' + e.type);
          if (e.type === 'status' && !Arena.Data.effects[e.effect]) problems.push(abId + ' → efecto ' + e.effect);
          if (e.then) checkList(e.then, abId);
          if (e.otherwise) checkList(e.otherwise, abId);
          if (e.onTrigger) checkList(e.onTrigger, abId);
        }
      }
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        var ab = Arena.Data.abilities[id];
        checkList(ab.effects || [], id);
        checkList(ab.selfEffects || [], id);
      }
      T.assertEqual(problems.length, 0, 'efectos sin implementar: ' + problems.join(', '));
    });

    T.test('Cada clase tiene exactamente 6 activas y 1 pasiva', function () {
      var order = Arena.Data.classOrder;
      for (var i = 0; i < order.length; i++) {
        var c = Arena.Data.classes[order[i]];
        T.assertEqual(c.abilities.length, 6, c.name + ' debe tener 6 activas');
        T.assert(!!c.passiveId, c.name + ' debe tener pasiva');
        T.assert(!!Arena.Data.passives.info[c.passiveId], c.name + ' debe documentar su pasiva');
        for (var j = 0; j < c.abilities.length; j++) {
          var ab = Arena.Data.abilities[c.abilities[j]];
          T.assert(!!ab, c.name + ': habilidad inexistente ' + c.abilities[j]);
          T.assertEqual(ab.classId, c.id, ab.id + ' debe pertenecer a ' + c.id);
        }
      }
    });
  });
});
