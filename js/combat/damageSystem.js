/* =============================================================================
 * combat/damageSystem.js — Mitigación, redirección, barreras y muerte.
 *
 * Cadena de resolución de un golpe (documento §7 y §10, paso 6):
 *   0. Estasis / invulnerabilidad ....... daño = 0, evento y salida
 *   1. Amplificación del lanzador ....... damageDealtPct
 *   2. Mitigación por defensa ........... raw × 100/(100+def)
 *   3. Modificadores del receptor ....... damageTakenPct (con cap)
 *   4. Redirección (Interponer) ......... fracción al protector
 *   5. Enlace protector ................. reducción compartida con el vinculador
 *   6. Barreras ......................... absorben daño YA mitigado
 *   7. HP y muerte
 * ========================================================================== */
Arena.define('combat/damageSystem',
  ['core/entity', 'data/balance', 'combat/statusSystem'], function (Arena) {
  'use strict';

  var B = Arena.Data.balance;
  var EFF = Arena.Data.effects;
  var Status = Arena.Combat.StatusSystem;

  var D = {};

  /**
   * @param p {source, target, raw, school:'physical'|'magical'|'pure',
   *           abilityId, periodic, ignoreDefensePct, canCrit, noRedirect}
   * @returns {object} desglose del golpe
   */
  D.applyDamage = function (world, p) {
    var target = p.target;
    var source = p.source || null;
    var result = {
      targetId: target ? target.id : null,
      sourceId: source ? source.id : null,
      abilityId: p.abilityId || null,
      school: p.school || 'physical',
      raw: p.raw || 0,
      mitigated: 0,
      absorbed: 0,
      applied: 0,
      redirected: 0,
      overkill: 0,
      blocked: false,
      immune: false,
      crit: false,
      periodic: !!p.periodic,
      killed: false
    };

    if (!target || !target.alive || result.raw <= 0) return result;

    /* 0 — Estasis: aislamiento total. Ni daño, ni DoT, ni salpicadura. */
    if (target.mods().isolated) {
      result.immune = true;
      world.bus.emit('DamageImmune', {
        targetId: target.id, sourceId: result.sourceId,
        abilityId: result.abilityId, reason: 'stasis'
      });
      return result;
    }

    if (target.godMode) {
      result.immune = true;
      world.bus.emit('DamageImmune', {
        targetId: target.id, sourceId: result.sourceId,
        abilityId: result.abilityId, reason: 'godMode'
      });
      return result;
    }

    var dmg = result.raw;

    /* 1 — Amplificación del lanzador */
    if (source) {
      var sm = source.mods();
      dmg *= (1 + sm.damageDealtPct);
      if (p.canCrit && world.settings.rngEnabled) {
        var critChance = p.critChance === undefined ? 0.15 : p.critChance;
        if (world.rng.chance(critChance)) { dmg *= 1.5; result.crit = true; }
      }
    }

    /* 2 — Mitigación por defensa */
    var defense = 0;
    if (result.school === 'physical') defense = target.armor();
    else if (result.school === 'magical') defense = target.resist();
    if (p.ignoreDefensePct) defense *= (1 - p.ignoreDefensePct);
    dmg = (result.school === 'pure') ? dmg : B.mitigate(dmg, defense);

    /* 3 — Modificadores del receptor */
    dmg *= (1 + target.mods().damageTakenPct);
    result.mitigated = dmg;

    /* 4 — Redirección: Interponer desvía una fracción al protector.
     *     La parte desviada se resuelve contra las defensas del protector,
     *     que es lo que hace del Guardián un escudo real y no un descuento. */
    if (!p.noRedirect) {
      var redirects = target.getStatuses('damageRedirect');
      for (var i = 0; i < redirects.length; i++) {
        var rd = redirects[i];
        var protector = world.getEntity(rd.data.protectorId);
        if (!protector || !protector.alive || protector.id === target.id) continue;
        if (protector.mods().isolated) continue;
        var share = dmg * (rd.data.redirectPct || 0);
        if (share <= 0) continue;
        dmg -= share;
        result.redirected += share;
        D.applyDamage(world, {
          source: source, target: protector, raw: share, school: 'pure',
          abilityId: p.abilityId, periodic: p.periodic, noRedirect: true,
          redirectedFrom: target.id
        });
      }

      /* 5 — Enlace protector: reduce el golpe y el vinculador paga la mitad
       *     de lo ahorrado. Nunca puede matarlo (queda a 1 HP como mínimo). */
      var links = target.getStatuses('protectiveLink');
      for (var j = 0; j < links.length; j++) {
        var lk = links[j];
        var binder = world.getEntity(lk.data.binderId);
        if (!binder || !binder.alive || binder.id === target.id) continue;
        var reduction = dmg * (lk.data.reductionPct || 0);
        if (reduction <= 0) continue;
        dmg -= reduction;
        var toBinder = reduction * (lk.data.sharePct || 0.5);
        if (binder.mods().isolated) continue;
        var safe = Math.max(0, Math.min(toBinder, binder.hp - 1));
        if (safe > 0) {
          D.applyDamage(world, {
            source: source, target: binder, raw: safe, school: 'pure',
            abilityId: p.abilityId, periodic: p.periodic, noRedirect: true,
            redirectedFrom: target.id
          });
        }
      }
    }

    result.mitigated = dmg;

    /* 6 — Barreras: absorben daño ya mitigado, antes de tocar la vida. */
    var remaining = dmg;
    for (var k = target.statuses.length - 1; k >= 0 && remaining > 0; k--) {
      var st = target.statuses[k];
      var def = EFF[st.defId];
      if (!def || !def.absorb) continue;
      var pool = st.data.amount || 0;
      if (pool <= 0) continue;
      var used = Math.min(pool, remaining);
      st.data.amount = pool - used;
      remaining -= used;
      result.absorbed += used;
      target.stats.absorbed += used;
      world.bus.emit('BarrierAbsorbed', {
        targetId: target.id, statusId: st.id, amount: used,
        remaining: st.data.amount, sourceId: result.sourceId
      });
      if (st.data.amount <= 1e-6) Status.removeInstance(world, target, st, 'consumed');
    }

    /* 7 — Vida */
    result.applied = remaining;
    if (remaining > 0) {
      var before = target.hp;
      target.hp = Math.max(0, target.hp - remaining);
      result.overkill = Math.max(0, remaining - before);
      target.stats.damageTaken += Math.min(remaining, before);
      if (source) source.stats.damageDealt += Math.min(remaining, before);
      target.lastCombatAt = world.time;
      if (source) source.lastCombatAt = world.time;
    }

    // Recibir daño directo revela; los tics periódicos no delatan al que huye.
    if (result.applied > 0 && !p.periodic) Status.breakStealth(world, target, 'damage');

    world.bus.emit('DamageApplied', result);

    if (target.hp <= 0 && target.alive) D.kill(world, target, source, p.abilityId);
    return result;
  };

  D.kill = function (world, target, source, abilityId) {
    target.alive = false;
    target.hp = 0;
    target.deadAt = world.time;
    target.cast = null;
    target.queued = null;
    target.autoAttackOn = false;
    target.statuses.length = 0;
    target.invalidateMods();
    target.stats.deaths++;
    if (source && source !== target) source.stats.kills++;
    world.bus.emit('EntityDied', {
      entityId: target.id, killerId: source ? source.id : null, abilityId: abilityId || null
    });
  };

  /** Daño directo sin lanzador: botón de laboratorio y zonas del escenario. */
  D.labDamage = function (world, target, amount, school) {
    return D.applyDamage(world, {
      source: null, target: target, raw: amount,
      school: school || 'pure', abilityId: 'lab_damage'
    });
  };

  Arena.Combat.DamageSystem = D;
});
