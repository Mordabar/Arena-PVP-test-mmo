/* =============================================================================
 * combat/abilitySystem.js — Validación, GCD, casteo, cola de input e interrupción.
 *
 * Implementa los pasos 1–4 del orden obligatorio (documento §10):
 *   1. ¿Lanzador vivo y habilitado?
 *   2. ¿Recurso, GCD y cooldown disponibles?
 *   3. ¿Target válido, en rango, orientación y línea de visión?
 *   4. Si hay cast: iniciar → permitir interrupción/cancelación
 *
 * El paso 5 en adelante lo ejecuta combat/resolver.js.
 *
 * Nota de game feel: cada rechazo emite un motivo legible. "No pasa nada al
 * pulsar" es el peor bug posible en un MMO; aquí siempre hay una razón visible
 * en el HUD y en el log.
 * ========================================================================== */
Arena.define('combat/abilitySystem',
  ['combat/resolver', 'data/balance'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var B = Arena.Data.balance;
  var Status = Arena.Combat.StatusSystem;
  var Resolver = Arena.Combat.Resolver;
  var Dmg = Arena.Combat.DamageSystem;

  var A = {};

  A.REASONS = {
    dead: 'Estás muerto',
    unknown: 'Habilidad desconocida',
    silenced: 'Estás mareado',
    stunned: 'Estás bajo control',
    disarmed: 'No puedes usar el arma',
    noOffense: 'No puedes usar poderes ofensivos',
    noDamage: 'No puedes usar habilidades dañinas',
    utilityLocked: 'No puedes usar habilidades de utilidad',
    lockout: 'Escuela bloqueada',
    gcd: 'Aún no está listo',
    cooldown: 'En recuperación',
    resource: 'Recurso insuficiente',
    noTarget: 'Necesitas un objetivo',
    badTarget: 'Objetivo no válido',
    targetDead: 'El objetivo está muerto',
    untargetable: 'El objetivo no puede ser seleccionado',
    range: 'Fuera de rango',
    facing: 'Debes encarar al objetivo',
    los: 'Sin línea de visión',
    casting: 'Ya estás lanzando',
    noGround: 'Necesitas un punto de destino'
  };

  /* =========================================================================
   * Coste efectivo
   * ====================================================================== */
  A.costOf = function (world, caster, ability) {
    if (world.settings.freeResources) return 0;
    var cost = ability.cost || 0;
    var pct = caster.mods().resourceCostPct;   // Ímpetu: negativo
    return Math.max(0, cost * (1 + pct));
  };

  A.castTimeOf = function (world, caster, ability) {
    var base = ability.castTime || 0;
    if (base <= 0) return 0;
    var pct = caster.mods().castSpeedPct;      // Resonancia: negativo
    return Math.max(0, base * (1 + pct));
  };

  A.gcdOf = function (world, caster, ability) {
    var g = ability.gcd === undefined ? 'standard' : ability.gcd;
    if (typeof g === 'number') return g;
    return B.GCD[g] === undefined ? B.GCD.standard : B.GCD[g];
  };

  /* =========================================================================
   * Validación completa (pasos 1–3)
   * ====================================================================== */

  /**
   * @returns {{ok:boolean, reason:string, message:string, target:Entity}}
   */
  A.canUse = function (world, caster, ability, ctx) {
    ctx = ctx || {};
    var now = world.time;

    function no(reason) { return { ok: false, reason: reason, message: A.REASONS[reason] || reason }; }

    /* --- 1. Lanzador vivo y habilitado ---------------------------------- */
    if (!caster.alive) return no('dead');
    if (!ability) return no('unknown');

    var m = caster.mods();
    if (m.isolated) return no('stunned');
    if (!m.canUseAbility) {
      return no(m.canMove ? 'silenced' : 'stunned');
    }
    var causesDamage = Resolver.abilityCausesDamage(ability);
    var flags = ability.flags || {};
    if (flags.weaponAttack && !m.canWeaponAttack) return no('disarmed');
    if (flags.offensive && !m.canUseOffensive) return no('noOffense');
    if (causesDamage && !m.canUseDamageAbilities) return no('noDamage');
    if (!causesDamage && !m.canUseNonDamaging) return no('utilityLocked');

    var school = ability.school || 'general';
    if (caster.schoolLockouts[school] > now) return no('lockout');

    /* --- 2. Recurso, GCD y cooldown ------------------------------------- */
    if (caster.gcdUntil > now) return no('gcd');
    if (!world.settings.freeCooldowns && caster.isOnCooldown(ability.id, now)) return no('cooldown');
    if (caster.resource < A.costOf(world, caster, ability) - 1e-6) return no('resource');

    /* --- 3. Objetivo, rango, orientación y línea de visión --------------- */
    var target = null;
    var needsTarget = (ability.target === 'enemy' || ability.target === 'ally' || ability.target === 'allyOrSelf');

    if (needsTarget) {
      target = ctx.target || world.getEntity(ctx.targetId);
      if (!target) return no('noTarget');
      if (!target.alive) return no('targetDead');
      if (!target.isTargetable()) return no('untargetable');

      var hostile = world.areHostile(caster, target);
      if (ability.target === 'enemy' && !hostile) return no('badTarget');
      if (ability.target === 'ally' && (hostile || target.id === caster.id)) return no('badTarget');
      if (ability.target === 'allyOrSelf' && hostile) return no('badTarget');
      if (hostile && target.mods().stealthed && !target.hasStatus('revealed')) return no('untargetable');

      var range = (ability.range || 0) + target.radius + caster.radius;
      if (V.distXZ(caster.pos, target.pos) > range) return no('range');

      if (flags.requiresFacing) {
        var toTarget = V.yawTo(caster.pos, target.pos);
        if (Math.abs(V.angleDelta(caster.yaw, toTarget)) > B.FACING_HALF_ANGLE) return no('facing');
      }
      if (!ability.ignoresLoS &&
          !world.hasLineOfSight(caster.eyePos(), target.centerPos(), caster, target)) {
        return no('los');
      }
    } else if (ability.target === 'ground') {
      if (!ctx.groundPoint) return no('noGround');
      if (V.distXZ(caster.pos, ctx.groundPoint) > (ability.range || 10) + 0.5) return no('range');
    }

    return { ok: true, reason: 'ok', message: '', target: target };
  };

  /* =========================================================================
   * Uso
   * ====================================================================== */

  /**
   * Intenta usar una habilidad. Si falta poco para que el GCD/cast termine,
   * la deja en cola (documento §6: ventana de 150–250 ms).
   * @returns {{ok:boolean, reason:string, queued:boolean}}
   */
  A.tryUse = function (world, caster, abilityId, ctx) {
    ctx = ctx || {};
    var ability = Arena.Data.abilities[abilityId];
    if (!ability) {
      return { ok: false, reason: 'unknown', message: A.REASONS.unknown, queued: false };
    }

    var now = world.time;
    var check = A.canUse(world, caster, ability, ctx);

    if (!check.ok) {
      // Cola de input: sólo por temporizadores (GCD, cast en curso, cooldown a
      // punto de acabar). Nunca por rango, LoS ni control: encolar esos casos
      // produciría acciones "fantasma" que el jugador ya no quiere.
      if (A._isQueueable(world, caster, ability, check.reason, now)) {
        caster.queued = {
          abilityId: abilityId, targetId: ctx.targetId || (ctx.target && ctx.target.id) || null,
          groundPoint: ctx.groundPoint ? { x: ctx.groundPoint.x, y: 0, z: ctx.groundPoint.z } : null,
          at: now
        };
        world.bus.emit('AbilityQueued', { casterId: caster.id, abilityId: abilityId });
        return { ok: false, reason: check.reason, message: check.message, queued: true };
      }
      world.bus.emit('AbilityRejected', {
        casterId: caster.id, abilityId: abilityId,
        reason: check.reason, message: check.message
      });
      return { ok: false, reason: check.reason, message: check.message, queued: false };
    }

    // Un cast nuevo sustituye al anterior sólo si el jugador lo pide de forma
    // explícita; si no, el cast en curso manda.
    if (caster.cast) {
      caster.queued = {
        abilityId: abilityId, targetId: ctx.targetId || (ctx.target && ctx.target.id) || null,
        groundPoint: ctx.groundPoint || null, at: now
      };
      return { ok: false, reason: 'casting', message: A.REASONS.casting, queued: true };
    }

    return A._commit(world, caster, ability, check.target, ctx);
  };

  A._isQueueable = function (world, caster, ability, reason, now) {
    if (reason === 'gcd') return (caster.gcdUntil - now) <= B.INPUT_QUEUE_WINDOW;
    if (reason === 'cooldown') {
      return caster.cooldownRemaining(ability.id, now) <= B.INPUT_QUEUE_WINDOW;
    }
    if (reason === 'casting') return (caster.cast.endTime - now) <= B.INPUT_QUEUE_WINDOW;
    return false;
  };

  /** Paga costes, arranca GCD y lanza el cast o ejecuta el instantáneo. */
  A._commit = function (world, caster, ability, target, ctx) {
    var now = world.time;

    // Auto-encarar al objetivo al comprometer la acción.
    //
    // El documento pide validar orientación en las habilidades frontales (§5),
    // pero rechazar una habilidad de objetivo único porque el personaje mira
    // 10° de más rompe el pilar de "respuesta inmediata": el jugador ya eligió
    // objetivo, girar es una consecuencia, no una decisión aparte. La
    // orientación sigue siendo decisiva donde realmente importa — los conos
    // (target: 'cone') usan el yaw actual y no se auto-encaran.
    if (target && target.id !== caster.id && !(ability.flags && ability.flags.noAutoFace)) {
      caster.yaw = V.yawTo(caster.pos, target.pos);
    }
    var cost = A.costOf(world, caster, ability);
    caster.resource = Math.max(0, caster.resource - cost);

    var gcd = A.gcdOf(world, caster, ability);
    if (gcd > 0) {
      caster.gcdUntil = now + gcd;
      caster.gcdStartedAt = now;
      caster.gcdDuration = gcd;
    }

    if (!world.settings.freeCooldowns && ability.cooldown) {
      caster.cooldowns[ability.id] = now + ability.cooldown;
    }
    caster.stats.abilitiesUsed++;
    caster.lastCombatAt = now;

    // Lanzar rompe el sigilo, pero el bonus "desde sigilo" debe seguir contando:
    // se marca antes de romperlo.
    caster._castedFromStealth = caster.mods().stealthed;
    if (caster._castedFromStealth && !(ability.flags && ability.flags.keepsStealth)) {
      Status.breakStealth(world, caster, 'cast');
    }

    var castTime = A.castTimeOf(world, caster, ability);

    if (castTime <= 0) {
      A._finish(world, caster, ability, target, ctx);
      return { ok: true, reason: 'ok', queued: false, instant: true };
    }

    caster.cast = {
      abilityId: ability.id,
      targetId: target ? target.id : null,
      groundPoint: ctx.groundPoint ? { x: ctx.groundPoint.x, y: 0, z: ctx.groundPoint.z } : null,
      startTime: now,
      endTime: now + castTime,
      duration: castTime,
      startPos: V.clone(caster.pos),
      movable: !!(ability.flags && ability.flags.movableCast),
      interruptible: !(ability.flags && ability.flags.uninterruptible),
      school: ability.school || 'general'
    };

    world.bus.emit('AbilityCastStarted', {
      casterId: caster.id, abilityId: ability.id, targetId: caster.cast.targetId,
      castTime: castTime, endTime: caster.cast.endTime, movable: caster.cast.movable
    });
    return { ok: true, reason: 'ok', queued: false, instant: false };
  };

  /** Completa la ejecución: revalida lo que puede haber cambiado durante el cast. */
  A._finish = function (world, caster, ability, target, ctx) {
    ctx = ctx || {};

    // Revalidación en el impacto: el objetivo pudo morir, entrar en estasis,
    // salir de rango o romper la línea de visión mientras se casteaba.
    if (target) {
      if (!target.alive || !target.isTargetable()) {
        world.bus.emit('AbilityFizzled', {
          casterId: caster.id, abilityId: ability.id, reason: 'untargetable'
        });
        Status.consumeOnCast(world, caster, ability);
        return null;
      }
      var maxRange = (ability.range || 0) + target.radius + caster.radius + B.RANGE_TOLERANCE;
      if (V.distXZ(caster.pos, target.pos) > maxRange) {
        world.bus.emit('AbilityFizzled', {
          casterId: caster.id, abilityId: ability.id, reason: 'range'
        });
        Status.consumeOnCast(world, caster, ability);
        return null;
      }
      if (!ability.ignoresLoS &&
          !world.hasLineOfSight(caster.eyePos(), target.centerPos(), caster, target)) {
        world.bus.emit('AbilityFizzled', {
          casterId: caster.id, abilityId: ability.id, reason: 'los'
        });
        Status.consumeOnCast(world, caster, ability);
        return null;
      }
      // Encarar al objetivo al ejecutar: es lo que el jugador espera ver.
      if (!(ability.flags && ability.flags.noAutoFace)) {
        caster.yaw = V.yawTo(caster.pos, target.pos);
      }
    }

    world.bus.emit('AbilityCastCompleted', {
      casterId: caster.id, abilityId: ability.id, targetId: target ? target.id : null
    });

    var report = Resolver.execute(world, caster, ability, {
      target: target,
      targetId: target ? target.id : null,
      groundPoint: ctx.groundPoint || (caster.cast && caster.cast.groundPoint) || null
    });

    // Consumir Ímpetu / Resonancia después de aplicar sus efectos.
    Status.consumeOnCast(world, caster, ability);
    caster._castedFromStealth = false;

    // Ganchos pasivos de clase (Ímpetu, Resonancia, Flujo compartido…).
    if (Arena.Data.passives && Arena.Data.passives.onAbilityUsed) {
      Arena.Data.passives.onAbilityUsed(world, caster, ability, report);
    }
    return report;
  };

  /* =========================================================================
   * Tick por entidad
   * ====================================================================== */

  A.tick = function (world, entity, dt) {
    var now = world.time;

    /* --- Cast en curso -------------------------------------------------- */
    if (entity.cast) {
      var c = entity.cast;
      // Moverse cancela los casteos estacionarios (§5).
      if (!c.movable && V.distXZ(entity.pos, c.startPos) > B.CAST_MOVE_TOLERANCE) {
        A.interruptCast(world, entity, { reason: 'moved', lockout: 0 });
      } else if (now >= c.endTime) {
        var ability = Arena.Data.abilities[c.abilityId];
        var target = c.targetId ? world.getEntity(c.targetId) : null;
        entity.cast = null;
        A._finish(world, entity, ability, target, { groundPoint: c.groundPoint });
      }
    }

    /* --- Cola de input -------------------------------------------------- */
    if (entity.queued) {
      var q = entity.queued;
      // Una entrada en cola caduca: no debe dispararse 3 s tarde.
      if (now - q.at > B.INPUT_QUEUE_WINDOW + 1.2) {
        entity.queued = null;
      } else if (!entity.cast && entity.gcdUntil <= now) {
        var ab = Arena.Data.abilities[q.abilityId];
        var qctx = { targetId: q.targetId, groundPoint: q.groundPoint };
        var check = ab ? A.canUse(world, entity, ab, qctx) : { ok: false };
        if (check.ok) {
          entity.queued = null;
          A._commit(world, entity, ab, check.target, qctx);
        } else if (check.reason !== 'cooldown' && check.reason !== 'gcd') {
          entity.queued = null;
        }
      }
    }

    /* --- Ataque normal --------------------------------------------------- */
    A._tickAutoAttack(world, entity, now);
  };

  A._tickAutoAttack = function (world, entity, now) {
    if (!entity.autoAttackOn || !entity.alive) return;
    var m = entity.mods();
    if (!m.canWeaponAttack || m.isolated) return;
    if (entity.cast) return;                       // no se solapa con casteos

    var target = entity.targetId ? world.getEntity(entity.targetId) : null;
    if (!target || !target.alive || !target.isTargetable() || !world.areHostile(entity, target)) return;
    if (target.mods().stealthed && !target.hasStatus('revealed')) return;

    var reach = entity.autoAttackRange + target.radius + entity.radius;
    if (V.distXZ(entity.pos, target.pos) > reach) return;
    if (!world.hasLineOfSight(entity.eyePos(), target.centerPos(), entity, target)) return;

    if (now < entity.autoAttackNextAt) return;

    var cycle = entity.autoAttackCycle / (1 + m.attackSpeedPct);
    entity.autoAttackNextAt = now + cycle;
    entity.yaw = V.yawTo(entity.pos, target.pos);

    Status.breakStealth(world, entity, 'attack');

    var raw = entity.power * B.AUTO_ATTACK.coefficient;
    var res = Dmg.applyDamage(world, {
      source: entity, target: target, raw: raw,
      school: entity.autoAttackSchool === 'magical' ? 'magical' : 'physical',
      abilityId: 'auto_attack', canCrit: true
    });

    world.bus.emit('AutoAttack', {
      casterId: entity.id, targetId: target.id, damage: res.applied,
      ranged: entity.autoAttackRange > 5
    });

    if (Arena.Data.passives && Arena.Data.passives.onAutoAttack) {
      Arena.Data.passives.onAutoAttack(world, entity, target, res);
    }
  };

  /* =========================================================================
   * Interrupción y cancelación
   * ====================================================================== */

  A.interruptCast = function (world, entity, opts) {
    opts = opts || {};
    var c = entity.cast;
    if (!c) return false;

    // Un cast marcado como no interrumpible sólo lo corta el hard CC.
    if (!c.interruptible && opts.reason === 'interrupt') return false;

    entity.cast = null;
    var lockout = opts.lockout === undefined ? 0 : opts.lockout;
    if (lockout > 0) {
      var school = c.school || 'general';
      entity.schoolLockouts[school] = Math.max(entity.schoolLockouts[school] || 0, world.time + lockout);
    }

    world.bus.emit('AbilityCastInterrupted', {
      casterId: entity.id, abilityId: c.abilityId, reason: opts.reason || 'interrupt',
      sourceId: opts.sourceId || null, lockout: lockout, school: c.school
    });
    return true;
  };

  A.cancelCast = function (world, entity) {
    if (!entity.cast) return false;
    return A.interruptCast(world, entity, { reason: 'cancelled', lockout: 0 });
  };

  Arena.Combat.AbilitySystem = A;
});
