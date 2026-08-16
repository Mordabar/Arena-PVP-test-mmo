/* =============================================================================
 * combat/statusSystem.js — Aplicación, apilado, expiración y disipación de estados.
 *
 * Aquí vive TODA la lógica de:
 *   · Diminishing Returns (documento §11)
 *   · Reglas de apilado (§7: slow más fuerte, barreras no aditivas por poder)
 *   · Cleanse / Purga / AntiBuff (§9)
 *   · Efectos periódicos (DoT / HoT)
 *
 * Identidad de una instancia de estado:
 *   · CC  → una sola instancia por tipo, gana la de mayor duración restante.
 *           Dos Noqueos simultáneos de dos jugadores no se apilan jamás.
 *   · resto → clave (efecto, habilidad, lanzador): dos Vinculadores pueden
 *           mantener su propio HoT, pero uno solo no duplica el suyo.
 * ========================================================================== */
Arena.define('combat/statusSystem',
  ['core/entity', 'data/effects', 'data/balance'], function (Arena) {
  'use strict';

  var EFF = Arena.Data.effects;
  var B = Arena.Data.balance;

  var S = {};
  var nextStatusId = 1;

  function keyOf(defId, abilityId, sourceId) {
    var d = EFF[defId];
    if (d && d.kind === 'cc') return 'cc:' + defId;
    return defId + '|' + (abilityId || '-') + '|' + (sourceId || '-');
  }

  /* =========================================================================
   * Diminishing Returns
   * ====================================================================== */

  /**
   * Consulta el estado de DR sin modificarlo.
   * @returns {{mult:number, immune:boolean, stacks:number}}
   */
  S.queryDR = function (world, target, category) {
    if (!category) return { mult: 1, immune: false, stacks: 0 };
    var cfg = B.DR.categories[category];
    if (!cfg) return { mult: 1, immune: false, stacks: 0 };

    var tr = target.drTracker[category];
    var now = world.time;

    // Inmunidad activa: se respeta SIEMPRE, incluso con DR desactivado, porque
    // la de Estasis es una regla de diseño del poder, no del interruptor de lab.
    if (tr && tr.immuneUntil > now) return { mult: 0, immune: true, stacks: tr.stacks };

    if (!B.DR.enabled) return { mult: 1, immune: false, stacks: 0 };
    if (!tr || now > tr.resetAt) return { mult: cfg.steps[0], immune: false, stacks: 0 };
    if (tr.stacks >= cfg.steps.length) return { mult: 0, immune: true, stacks: tr.stacks };
    return { mult: cfg.steps[tr.stacks], immune: false, stacks: tr.stacks };
  };

  /** Registra una aplicación consumida de la categoría y arma la inmunidad. */
  S.consumeDR = function (world, target, category, endTime) {
    var cfg = B.DR.categories[category];
    if (!cfg) return;
    var now = world.time;
    var tr = target.drTracker[category];
    if (!tr || now > tr.resetAt) tr = { stacks: 0, resetAt: 0, immuneUntil: 0 };

    tr.stacks++;
    tr.resetAt = endTime + cfg.window;

    // La inmunidad de Estasis existe con DR apagado: el propio poder la concede.
    var alwaysImmune = (category === 'stasis');
    if ((B.DR.enabled || alwaysImmune) && tr.stacks >= cfg.steps.length) {
      tr.immuneUntil = endTime + cfg.immunity;
    }
    target.drTracker[category] = tr;
  };

  /* =========================================================================
   * Fatiga de control global
   * ====================================================================== */

  S.queryFatigue = function (world, target) {
    var f = target.ccFatigue;
    var now = world.time;
    if (!f) return { immune: false, seconds: 0 };
    if (f.immuneUntil > now) return { immune: true, seconds: f.seconds };
    if (now > f.resetAt) return { immune: false, seconds: 0 };
    return { immune: false, seconds: f.seconds };
  };

  S.addFatigue = function (world, target, seconds) {
    var cfg = B.CC_FATIGUE;
    var now = world.time;
    var f = target.ccFatigue;
    if (!f || now > f.resetAt) f = { seconds: 0, resetAt: 0, immuneUntil: 0 };

    f.seconds += seconds;
    f.resetAt = now + cfg.window;
    if (f.seconds >= cfg.threshold) {
      f.immuneUntil = now + seconds + cfg.immunity;
      f.seconds = 0;
      world.bus.emit('CCFatigued', {
        targetId: target.id, until: f.immuneUntil
      });
    }
    target.ccFatigue = f;
  };

  /* =========================================================================
   * Aplicación
   * ====================================================================== */

  /**
   * @param spec {effect, duration, data, abilityId, ignoreDR, ignoreAntiBuff}
   * @returns {object|null} la instancia aplicada, o null si fue rechazada.
   */
  S.apply = function (world, target, spec, source) {
    if (!target || !target.alive) return null;

    var defId = spec.effect;
    var d = EFF[defId];
    if (!d) throw new Error('Efecto desconocido en apply(): ' + defId);

    var now = world.time;
    var sourceId = source ? source.id : null;
    var abilityId = spec.abilityId || null;

    // -- Inmunidad explícita concedida por un buff (p. ej. Paso libre vs Slow)
    var tmods = target.mods();
    if (tmods.immunities[defId]) {
      world.bus.emit('EffectImmune', {
        targetId: target.id, effect: defId, reason: 'immunity', sourceId: sourceId
      });
      return null;
    }

    // -- AntiBuff: bloquea todo lo positivo entrante (§9). Los estados propios
    //    (autobuffs) también se bloquean: el velo aísla al objetivo por completo.
    if (d.kind === 'buff' && tmods.blocksIncomingPositive && !spec.ignoreAntiBuff) {
      world.bus.emit('EffectBlocked', {
        targetId: target.id, effect: defId, reason: 'antiBuff', sourceId: sourceId
      });
      return null;
    }

    // -- Resistencias de control declaradas por poderes fuente. Con RNG
    // desactivado sólo una resistencia absoluta (100 %) niega el control; con
    // RNG activado se usa el generador determinista del mundo.
    if (d.kind === 'cc' && !spec.ignoreDR) {
      var resist = (tmods.ccResist && (tmods.ccResist[defId] || tmods.ccResist.all)) || 0;
      if (resist >= 0.999 || (resist > 0 && world.settings.rngEnabled && world.rng.chance(resist))) {
        world.bus.emit('EffectImmune', { targetId: target.id, effect: defId, reason: 'sourceResistance', sourceId: sourceId });
        return null;
      }
    }

    // -- Fatiga de control global
    //
    // El DR es POR CATEGORÍA, y eso deja una puerta abierta: alternando noqueo,
    // mareo, raíz, desarme y estasis se encadenaban más de 20 s de control sin
    // que ninguna categoría llegara nunca a su inmunidad. El objetivo del
    // documento (§19) es que una cadena efectiva no pase de ~4 s.
    //
    // La fatiga cuenta los segundos de control sufridos en una ventana; al
    // superar el umbral, el objetivo queda inmune a TODO control durante un
    // respiro. Es lo que impide que dos jugadores coordinados encadenen a un
    // tercero hasta matarlo sin que pueda pulsar un botón.
    if (d.kind === 'cc' && !spec.ignoreDR && B.CC_FATIGUE.enabled) {
      var fat = S.queryFatigue(world, target);
      if (fat.immune) {
        world.bus.emit('EffectImmune', {
          targetId: target.id, effect: defId, reason: 'fatigue', sourceId: sourceId
        });
        return null;
      }
    }

    // -- Diminishing Returns / inmunidad de categoría
    var duration = spec.duration === undefined ? 0 : spec.duration;
    /* Bonos source-derived a duración de poder modifican el estado que CREA
       el lanzador, no el reloj base declarado por la habilidad. Así el dato
       del libro conserva exactamente su duración fuente y el buff actúa como
       modificador en resolución, que es la semántica esperada. */
    if (duration > 0 && source && source.mods && !spec.permanent) {
      duration *= Math.max(0.1, 1 + (source.mods().statusDurationPct || 0));
    }
    var drMult = 1;
    if (d.drCategory && !spec.ignoreDR) {
      var dr = S.queryDR(world, target, d.drCategory);
      if (dr.immune) {
        world.bus.emit('EffectImmune', {
          targetId: target.id, effect: defId, reason: 'dr',
          category: d.drCategory, sourceId: sourceId
        });
        return null;
      }
      drMult = dr.mult;
      duration = duration * drMult;
    }
    if (d.kind === 'cc' && !spec.ignoreDR && B.CC_FATIGUE.enabled) {
      S.addFatigue(world, target, duration);
    }

    var endTime = now + duration;
    if (d.drCategory && !spec.ignoreDR) S.consumeDR(world, target, d.drCategory, endTime);

    var key = keyOf(defId, abilityId, sourceId);
    var existing = null;
    for (var i = 0; i < target.statuses.length; i++) {
      if (target.statuses[i].key === key) { existing = target.statuses[i]; break; }
    }

    var data = {};
    if (spec.data) for (var k in spec.data) if (Object.prototype.hasOwnProperty.call(spec.data, k)) data[k] = spec.data[k];

    if (existing) {
      var replaced = S._merge(existing, d, endTime, data, duration, sourceId, abilityId);
      target.invalidateMods();
      world.bus.emit('StatusRefreshed', {
        targetId: target.id, statusId: existing.id, effect: defId,
        endTime: existing.endTime, duration: duration, drMult: drMult,
        sourceId: sourceId, replaced: replaced
      });
      return existing;
    }

    var inst = {
      id: 's' + (nextStatusId++),
      key: key,
      defId: defId,
      abilityId: abilityId,
      sourceId: sourceId,
      targetId: target.id,
      startTime: now,
      endTime: endTime,
      duration: duration,
      permanent: !!spec.permanent,
      data: data,
      charges: d.charges || 0,
      nextTickAt: d.periodic ? now + (data.interval || 1.0) : 0
    };

    target.statuses.push(inst);
    target.invalidateMods();

    if (d.kind === 'cc') {
      target.stats.ccReceived++;
      target.stats.ccSecondsReceived += duration;
      if (source) source.stats.ccApplied++;
    }

    // Recibir algo hostil pone en combate: si no, la regeneración fuera de
    // combate curaría por encima de un DoT recién aplicado.
    if (d.kind !== 'buff') {
      target.lastCombatAt = now;
      if (source && source.id !== target.id) source.lastCombatAt = now;
    }

    // Interrumpir es parte del estado, no de la habilidad que lo trae: así un
    // Noqueo corta el cast venga de donde venga.
    if (d.interruptsCast && target.cast) {
      Arena.Combat.AbilitySystem.interruptCast(world, target, {
        reason: 'cc', effect: defId, sourceId: sourceId
      });
    }
    // El sigilo se rompe con cualquier hostilidad recibida.
    if (d.kind !== 'buff') S.breakStealth(world, target, 'damage-or-cc');

    world.bus.emit('StatusApplied', {
      targetId: target.id, statusId: inst.id, effect: defId, kind: d.kind,
      duration: duration, endTime: endTime, drMult: drMult,
      sourceId: sourceId, abilityId: abilityId, data: data
    });

    return inst;
  };

  /** Fusiona una reaplicación sobre una instancia viva según su stackRule. */
  S._merge = function (existing, d, endTime, data, duration, sourceId, abilityId) {
    var replaced = false;
    switch (d.stackRule) {
      case 'strongest': {
        var oldMag = S.magnitude(existing.data);
        var newMag = S.magnitude(data);
        if (newMag >= oldMag) {
          existing.data = data;
          existing.endTime = endTime;
          existing.duration = duration;
          replaced = true;
        } else if (endTime > existing.endTime && newMag === oldMag) {
          existing.endTime = endTime;
        }
        break;
      }
      case 'stack': {
        existing.data.stacks = (existing.data.stacks || 1) + 1;
        existing.endTime = endTime;
        existing.duration = duration;
        break;
      }
      default: { // 'refresh' e 'independent' con misma clave
        if (d.kind === 'cc') {
          // Nunca acortar un CC activo con uno más débil.
          if (endTime > existing.endTime) { existing.endTime = endTime; existing.duration = duration; replaced = true; }
        } else {
          existing.data = data;
          existing.endTime = endTime;
          existing.duration = duration;
          replaced = true;
        }
      }
    }
    existing.sourceId = sourceId || existing.sourceId;
    existing.abilityId = abilityId || existing.abilityId;
    if (d.charges) existing.charges = d.charges;
    if (d.periodic && existing.nextTickAt === 0) existing.nextTickAt = existing.startTime + (data.interval || 1.0);
    return replaced;
  };

  /** Magnitud comparable de un estado, para la regla "se queda el más fuerte". */
  S.magnitude = function (data) {
    if (!data) return 0;
    if (data.amount !== undefined) return data.amount;          // barrera
    if (data.slowPct !== undefined) return data.slowPct;
    if (data.antiHealPct !== undefined) return data.antiHealPct;
    if (data.damageTakenPct !== undefined) return -data.damageTakenPct;
    if (data.magnitude !== undefined) return data.magnitude;
    return 0;
  };

  /* =========================================================================
   * Eliminación
   * ====================================================================== */

  S.removeInstance = function (world, target, inst, reason) {
    var i = target.statuses.indexOf(inst);
    if (i < 0) return false;
    target.statuses.splice(i, 1);
    var sourceAbility = inst.abilityId && Arena.Data.abilities ? Arena.Data.abilities[inst.abilityId] : null;
    var locks = sourceAbility && sourceAbility.sourceConstraints && sourceAbility.sourceConstraints.onExpireLockSourceIndices;
    if (locks && target.sourcePowerLockouts) {
      for (var li=0; li<locks.length; li++) {
        var lk=locks[li];
        target.sourcePowerLockouts[lk.sourceIndex]=Math.max(target.sourcePowerLockouts[lk.sourceIndex]||0, world.time+(lk.seconds||0));
      }
    }
    target.invalidateMods();
    world.bus.emit('StatusRemoved', {
      targetId: target.id, statusId: inst.id, effect: inst.defId,
      reason: reason || 'expired', sourceId: inst.sourceId
    });
    return true;
  };

  S.remove = function (world, target, defId, reason) {
    var removed = 0;
    for (var i = target.statuses.length - 1; i >= 0; i--) {
      if (target.statuses[i].defId === defId) {
        S.removeInstance(world, target, target.statuses[i], reason || 'removed');
        removed++;
      }
    }
    return removed;
  };

  /** Elimina todas las instancias originadas por una habilidad concreta. */
  S.removeByAbility = function (world, target, abilityId, reason) {
    var removed = 0;
    for (var i = target.statuses.length - 1; i >= 0; i--) {
      if (target.statuses[i].abilityId === abilityId) {
        S.removeInstance(world, target, target.statuses[i], reason || 'toggleOff');
        removed++;
      }
    }
    return removed;
  };

  /**
   * Cleanse (§9). Quita primero CC duro y después debuffs menores, en el orden
   * en que el jugador los sufrió — el más antiguo primero es lo que un soporte
   * espera al pulsar el botón bajo presión.
   * @param opts {hard:number, minor:number}
   */
  S.cleanse = function (world, target, opts, source) {
    opts = opts || {};
    var hardBudget = opts.hard || 0;
    var minorBudget = opts.minor || 0;
    var removed = [];

    // AntiBuff bloquea el cleanse: decisión documentada en data/effects.js.
    if (target.mods().blocksIncomingPositive) {
      world.bus.emit('EffectBlocked', {
        targetId: target.id, effect: 'cleanse', reason: 'antiBuff',
        sourceId: source ? source.id : null
      });
      return removed;
    }

    var i, st, d;
    for (i = 0; i < target.statuses.length && hardBudget > 0; i++) {
      st = target.statuses[i];
      d = EFF[st.defId];
      if (d && d.dispel.cleanse === 'hard') {
        S.removeInstance(world, target, st, 'cleanse');
        removed.push(st.defId);
        hardBudget--;
        i--;
      }
    }
    for (i = 0; i < target.statuses.length && minorBudget > 0; i++) {
      st = target.statuses[i];
      d = EFF[st.defId];
      if (d && (d.dispel.cleanse === 'minor' || d.dispel.cleanse === 'hard')) {
        S.removeInstance(world, target, st, 'cleanse');
        removed.push(st.defId);
        minorBudget--;
        i--;
      }
    }

    if (removed.length) {
      world.bus.emit('Cleansed', {
        targetId: target.id, sourceId: source ? source.id : null, effects: removed
      });
    }
    return removed;
  };

  /**
   * Purga (§9). Retira buffs enemigos por prioridad: los counters activos
   * (bloqueo, reflejo, intervención) tienen prioridad 0 y NUNCA se purgan —
   * de lo contrario una purga barata anularía cooldowns de 40 s.
   */
  S.purge = function (world, target, count, source) {
    count = count || 1;
    var candidates = [];
    for (var i = 0; i < target.statuses.length; i++) {
      var st = target.statuses[i];
      var d = EFF[st.defId];
      if (d && d.dispel.purge) {
        candidates.push({ st: st, prio: d.purgePriority === undefined ? 40 : d.purgePriority });
      }
    }
    candidates.sort(function (a, b) { return b.prio - a.prio; });

    var removed = [];
    for (var j = 0; j < candidates.length && removed.length < count; j++) {
      S.removeInstance(world, target, candidates[j].st, 'purge');
      removed.push(candidates[j].st.defId);
    }
    if (removed.length) {
      world.bus.emit('Purged', {
        targetId: target.id, sourceId: source ? source.id : null, effects: removed
      });
    }
    return removed;
  };

  S.breakStealth = function (world, entity, reason) {
    if (!entity.mods().stealthed) return false;
    var n = S.remove(world, entity, 'stealth', 'broken:' + reason);
    if (n) world.bus.emit('StealthBroken', { entityId: entity.id, reason: reason });
    return n > 0;
  };

  /* =========================================================================
   * Tick
   * ====================================================================== */

  S.tick = function (world, entity, dt) {
    var now = world.time;
    var list = entity.statuses;

    for (var i = list.length - 1; i >= 0; i--) {
      // Un tic periódico puede matar, y morir vacía la lista de estados de golpe.
      // Sin esta guarda el bucle seguiría indexando un array ya truncado.
      if (i >= list.length) continue;
      var st = list[i];
      if (!st) continue;
      var d = EFF[st.defId];

      if (d && d.periodic && st.nextTickAt > 0 && now >= st.nextTickAt) {
        var interval = st.data.interval || 1.0;
        // Recuperar todos los tics vencidos: un frame largo no debe regalar daño.
        var guard = 0;
        while (now >= st.nextTickAt && guard++ < 8) {
          S._periodicTick(world, entity, st, d);
          if (!entity.alive) return;
          st.nextTickAt += interval;
          if (st.nextTickAt > st.endTime + 1e-6) { st.nextTickAt = 0; break; }
        }
      }

      if (!st.permanent && now >= st.endTime) {
        S.removeInstance(world, entity, st, 'expired');
      }
    }
  };

  S._periodicTick = function (world, entity, st, d) {
    var source = st.sourceId ? world.getEntity(st.sourceId) : null;
    if (st.data.tickDamage) {
      var dr = Arena.Combat.DamageSystem.applyDamage(world, {
        source: source, target: entity, raw: st.data.tickDamage,
        school: st.data.school || 'magical', element: st.data.element || 'generic', abilityId: st.abilityId,
        periodic: true, canCrit: false
      });
      if (st.data.healSourceId && source && source.alive && dr && dr.applied > 0) {
        Arena.Combat.HealingSystem.applyHeal(world, {
          source: source, target: source, raw: dr.applied, abilityId: st.abilityId, periodic: true
        });
      }
    }
    if (st.data.tickHeal) {
      Arena.Combat.HealingSystem.applyHeal(world, {
        source: source, target: entity, raw: st.data.tickHeal,
        abilityId: st.abilityId, periodic: true
      });
    }
    if (st.data.tickResourceDrain) {
      var request = st.data.resourceDrainPercent ? entity.resourceMax * (st.data.tickResourceDrain / 100) : st.data.tickResourceDrain;
      var drained = Math.min(entity.resource, Math.max(0, request));
      entity.resource -= drained;
      if (st.data.resourceHealSource && source && source.alive && drained > 0) {
        Arena.Combat.HealingSystem.restoreResource(world, source, drained, 'sourceManaDrainDot');
      }
      world.bus.emit('ResourceDrained', {
        targetId: entity.id, sourceId: source ? source.id : null, amount: drained, abilityId: st.abilityId, periodic: true
      });
    }
  };

  /** Consume los buffs de un solo uso (Ímpetu, Resonancia) al lanzar. */
  S.consumeOnCast = function (world, entity, ability) {
    for (var i = entity.statuses.length - 1; i >= 0; i--) {
      var st = entity.statuses[i];
      var d = EFF[st.defId];
      if (d && d.consumedOnCast) {
        if (st.data.requiresOffensive && !(ability && ability.offensive)) continue;
        S.removeInstance(world, entity, st, 'consumed');
      }
    }
  };

  Arena.Combat.StatusSystem = S;
});
