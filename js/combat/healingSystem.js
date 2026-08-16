/* =============================================================================
 * combat/healingSystem.js — Curación y barreras.
 *
 * Fórmula (documento §7):
 *   curación final = base × modificador de curación × (1 − AntiHeal)
 *
 * AntiHeal afecta a heal directo y HoT. NO afecta a las barreras: absorber no
 * es curar, y esa separación es lo que mantiene vivo al soporte bajo AntiHeal.
 * AntiBuff sí bloquea ambas cosas (ver data/effects.js).
 * ========================================================================== */
Arena.define('combat/healingSystem',
  ['core/entity', 'data/balance', 'combat/statusSystem'], function (Arena) {
  'use strict';

  var B = Arena.Data.balance;
  var Status = Arena.Combat.StatusSystem;

  var H = {};

  /**
   * @param p {source, target, raw, abilityId, periodic}
   */
  H.applyHeal = function (world, p) {
    var target = p.target;
    var source = p.source || null;
    var result = {
      targetId: target ? target.id : null,
      sourceId: source ? source.id : null,
      abilityId: p.abilityId || null,
      raw: p.raw || 0,
      applied: 0,
      overheal: 0,
      antiHealPct: 0,
      blocked: false,
      periodic: !!p.periodic
    };

    if (!target || !target.alive || result.raw <= 0) return result;

    // Estasis aísla: tampoco se puede curar a alguien en estasis.
    if (target.mods().isolated) {
      result.blocked = true;
      world.bus.emit('HealBlocked', {
        targetId: target.id, sourceId: result.sourceId, reason: 'stasis',
        abilityId: result.abilityId
      });
      return result;
    }

    // AntiBuff bloquea la curación entrante por completo (§9).
    if (target.mods().blocksIncomingPositive) {
      result.blocked = true;
      world.bus.emit('HealBlocked', {
        targetId: target.id, sourceId: result.sourceId, reason: 'antiBuff',
        abilityId: result.abilityId
      });
      return result;
    }

    var amount = result.raw;
    if (source) amount *= (1 + (p.healPowerPct || 0) + (source.mods().healingBonusPct || 0));

    var antiHeal = target.mods().antiHealPct;
    result.antiHealPct = antiHeal;
    amount *= (1 - antiHeal);

    var hpMax = target.effectiveHpMax ? target.effectiveHpMax() : target.hpMax;
    var missing = hpMax - target.hp;
    result.applied = Math.min(amount, missing);
    result.overheal = amount - result.applied;

    target.hp += result.applied;
    target.stats.healingReceived += result.applied;
    if (source) {
      source.stats.healingDone += result.applied;
      source.stats.overheal += result.overheal;
      source.lastCombatAt = world.time;
    }

    world.bus.emit('HealApplied', result);

    if (Arena.Data.passives && Arena.Data.passives.onHealApplied) {
      Arena.Data.passives.onHealApplied(world, source, target, result);
    }
    return result;
  };

  /**
   * Barrera absorbente. Se implementa como estado 'barrier' con stackRule
   * 'strongest': dos aplicaciones del mismo poder no se suman, se queda la mayor.
   */
  H.applyBarrier = function (world, p) {
    var target = p.target;
    if (!target || !target.alive) return null;

    if (target.mods().blocksIncomingPositive) {
      world.bus.emit('HealBlocked', {
        targetId: target.id, sourceId: p.source ? p.source.id : null,
        reason: 'antiBuff', abilityId: p.abilityId, barrier: true
      });
      return null;
    }

    var inst = Status.apply(world, target, {
      effect: 'barrier',
      duration: p.duration || 8,
      abilityId: p.abilityId,
      data: { amount: p.amount, initial: p.amount }
    }, p.source);

    if (inst) {
      world.bus.emit('BarrierApplied', {
        targetId: target.id, sourceId: p.source ? p.source.id : null,
        amount: p.amount, abilityId: p.abilityId, statusId: inst.id
      });
    }
    return inst;
  };

  H.restoreResource = function (world, target, amount, reason) {
    if (!target || !target.alive || amount <= 0) return 0;
    var before = target.resource;
    target.resource = Math.min(target.resourceMax, target.resource + amount);
    var gained = target.resource - before;
    if (gained > 0) {
      world.bus.emit('ResourceRestored', {
        entityId: target.id, amount: gained, reason: reason || 'ability'
      });
    }
    return gained;
  };

  Arena.Combat.HealingSystem = H;
});
