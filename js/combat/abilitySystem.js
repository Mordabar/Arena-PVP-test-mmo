/* =============================================================================
 * combat/abilitySystem.js — Timeline de combate: BEGIN → RELEASE → RESOLUTION.
 *
 * Regla central de Project Arena:
 *   - BEGIN prepara una acción; no paga todavía una habilidad casteada.
 *   - RELEASE es el commit transaccional: recurso, cooldown y GCD empiezan aquí.
 *   - Antes de RELEASE una acción puede cancelarse/reemplazarse sin daño fantasma.
 *   - Después de RELEASE el hecho ya ocurrió; un proyectil no se borra porque el
 *     lanzador se mueva, pierda LoS o muera.
 *
 * La lógica temporal es determinista y usa exclusivamente world.time/fixed tick.
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
    dead: 'Estás muerto', unknown: 'Habilidad desconocida', silenced: 'Estás mareado',
    stunned: 'Estás bajo control', disarmed: 'No puedes usar el arma',
    noOffense: 'No puedes usar poderes ofensivos', noDamage: 'No puedes usar habilidades dañinas',
    noAoE: 'No puedes usar poderes de área',
    utilityLocked: 'No puedes usar habilidades de utilidad', lockout: 'Escuela bloqueada',
    gcd: 'Aún no está listo', cooldown: 'En recuperación', weaponInterval: 'El arma aún no está preparada',
    resource: 'Recurso insuficiente', noTarget: 'Necesitas un objetivo', badTarget: 'Objetivo no válido',
    targetDead: 'El objetivo está muerto', untargetable: 'El objetivo no puede ser seleccionado',
    range: 'Fuera de rango', facing: 'Debes encarar al objetivo', los: 'Sin línea de visión',
    casting: 'Ya estás lanzando', noGround: 'Necesitas un punto de destino',
    moving: 'Debes detenerte', airborne: 'No puedes hacerlo en el aire', weaponWindup: 'Ataque normal en preparación',
    badClass: 'Este poder pertenece a otra subclase', passive: 'Los poderes pasivos no se activan desde la barra'
  };

  A.costOf = function (world, caster, ability) {
    if (world.settings.freeResources) return 0;
    return Math.max(0, (ability.cost || 0) * (1 + caster.mods().resourceCostPct));
  };

  A.castTimeOf = function (world, caster, ability) {
    var base = ability.castTime || 0;
    if (base <= 0) return 0;
    return Math.max(0, base * (1 + caster.mods().castSpeedPct));
  };

  A.gcdOf = function (world, caster, ability) {
    var g = ability.gcd === undefined ? 'standard' : ability.gcd;
    if (typeof g === 'number') return g;
    return B.GCD[g] === undefined ? B.GCD.standard : B.GCD[g];
  };

  A.timingOf = function (ability) {
    return ability.combatTiming || {
      actionType: 'utility', normalInteraction: 'independent', weaponIntervalPolicy: 'ignore',
      stationary: false, cooldownCommit: 'onRelease', resourceCommit: 'onRelease', gcdCommit: 'onRelease'
    };
  };

  A.requiresFacing = function (ability, caster) {
    var flags = ability.flags || {};
    if (flags.requiresFacing !== undefined) return !!flags.requiresFacing;
    // El nuevo contrato táctico se aplica por defecto al avatar del jugador.
    // Los dummies/fixtures históricos siguen pudiendo aislar otras reglas sin
    // necesitar orientar cada entidad manualmente; la IA real ya se encara.
    return !!(caster && caster.isPlayer) && ability.target === 'enemy' && !!flags.offensive;
  };

  A.hasMovementIntent = function (entity) {
    var v = entity && entity._moveIntent;
    if (!v) return false;
    return Math.sqrt(v.x * v.x + v.z * v.z) > B.MOVEMENT_INTENT_EPS;
  };

  A._bodyTurnMagnitude = function (entity, dt) {
    var d = Math.abs(entity._mouseTurnDelta || 0);
    if (entity._faceIntent !== null && entity._faceIntent !== undefined) {
      d = Math.max(d, Math.abs(V.angleDelta(entity.yaw, entity._faceIntent)));
    }
    if (entity._turnIntent) d = Math.max(d, Math.abs(B.TURN_SPEED * dt * entity._turnIntent));
    return d;
  };

  A._weapon = function (entity) {
    if (!entity.weaponState) {
      entity.weaponState = {
        phase: 'READY', readyAt: entity.autoAttackNextAt || 0, windupStartedAt: 0,
        releaseAt: 0, recoveryStartedAt: 0, recoveryUntil: 0, targetId: null,
        lastReleaseAt: -999, lastCancelAt: -999, cancelReason: null
      };
    }
    return entity.weaponState;
  };

  A._weaponCycle = function (entity) {
    return entity.autoAttackCycle / Math.max(0.15, 1 + entity.mods().attackSpeedPct);
  };

  A._weaponWindup = function (entity) {
    var archetype = Arena.Data.archetypeOf ? Arena.Data.archetypeOf(entity.classId) : 'melee';
    return (B.AUTO_ATTACK.windupByArchetype && B.AUTO_ATTACK.windupByArchetype[archetype]) || B.AUTO_ATTACK.windup || 0.20;
  };

  A._setQueue = function (world, caster, kind, abilityId, ctx, expiresAt) {
    var previous = caster.queuedAction;
    var q = {
      kind: kind || 'afterGcd', abilityId: abilityId,
      targetId: ctx.targetId || (ctx.target && ctx.target.id) || null,
      groundPoint: ctx.groundPoint ? { x: ctx.groundPoint.x, y: 0, z: ctx.groundPoint.z } : null,
      at: world.time, expiresAt: expiresAt === undefined ? world.time + B.INPUT_QUEUE_WINDOW + 0.35 : expiresAt
    };
    caster.queuedAction = q;
    caster.queued = q; // compatibilidad HUD/tests antiguos
    if (previous && previous.abilityId !== abilityId) {
      world.bus.emit('AbilityQueueReplaced', {
        casterId: caster.id, oldAbilityId: previous.abilityId, abilityId: abilityId, kind: q.kind
      });
    }
    world.bus.emit('AbilityQueued', { casterId: caster.id, abilityId: abilityId, kind: q.kind });
    if (q.kind === 'afterNormal') {
      world.bus.emit('AbilityQueuedAfterNormal', { casterId: caster.id, abilityId: abilityId });
    }
    return q;
  };

  A._clearQueue = function (caster) {
    caster.queuedAction = null;
    caster.queued = null;
  };

  /* =========================================================================
   * Validación
   * ====================================================================== */
  A.canUse = function (world, caster, ability, ctx) {
    ctx = ctx || {};
    var now = world.time;
    function no(reason) { return { ok: false, reason: reason, message: A.REASONS[reason] || reason }; }

    if (!caster.alive) return no('dead');
    if (!ability) return no('unknown');
    if (ability.allowedClasses && ability.allowedClasses.indexOf(caster.classId) < 0) return no('badClass');
    if (ability.flags && ability.flags.passive) return no('passive');
    if (ability.sourceIndex && caster.sourcePowerLockouts && caster.sourcePowerLockouts[ability.sourceIndex] > now) return no('lockout');
    if (ability.sourceConstraints) {
      var sc=ability.sourceConstraints, activeGroup=false, incompatible=false;
      for (var si=0; si<caster.statuses.length; si++) {
        var sab=Arena.Data.abilities[caster.statuses[si].abilityId];
        if (!sab) continue;
        if (sc.exclusiveGroup && sab.id!==ability.id && sab.sourceConstraints && sab.sourceConstraints.exclusiveGroup===sc.exclusiveGroup) activeGroup=true;
        if (sc.incompatibleSourceIndices && sc.incompatibleSourceIndices.indexOf(sab.sourceIndex)>=0) incompatible=true;
      }
      if (activeGroup || incompatible) return no('utilityLocked');
    }

    var m = caster.mods();
    if (m.isolated) return no('stunned');
    if (!m.canUseAbility) return no(m.canMove ? 'silenced' : 'stunned');

    var causesDamage = Resolver.abilityCausesDamage(ability);
    var flags = ability.flags || {};
    if (flags.weaponAttack && !m.canWeaponAttack) return no('disarmed');
    if (flags.offensive && !m.canUseOffensive) return no('noOffense');
    if (causesDamage && !m.canUseDamageAbilities) return no('noDamage');
    if (!causesDamage && !m.canUseNonDamaging) return no('utilityLocked');
    if (m.preventAoEAbilities && (ability.target === 'ground' || ability.target === 'cone' || ability.target === 'aoeSelf' || ability.target === 'targetArea' || (ability.radius || 0) > 0)) return no('noAoE');

    var school = ability.school || 'general';
    if (caster.schoolLockouts[school] > now) return no('lockout');

    if (!ctx.ignoreCasting && (caster.pendingCast || caster.cast)) return no('casting');
    if (!ctx.ignoreGcd && caster.gcdUntil > now) return no('gcd');
    if (!ctx.ignoreCooldown && !world.settings.freeCooldowns && caster.isOnCooldown(ability.id, now)) return no('cooldown');
    if (caster.resource < A.costOf(world, caster, ability) - 1e-6) return no('resource');

    var timing = A.timingOf(ability);
    if (!ctx.ignoreWeaponInterval && timing.weaponIntervalPolicy === 'respectReady') {
      if (A._weapon(caster).readyAt > now + 1e-6) return no('weaponInterval');
    }
    if (timing.stationary && caster.jumpActive) return no('airborne');
    if (timing.stationary && !ctx.ignoreMovement && A.hasMovementIntent(caster) && caster.mods().canMove) return no('moving');

    var target = null;
    var needsTarget = ability.target === 'enemy' || ability.target === 'ally' || ability.target === 'allyOrSelf' || ability.target === 'targetArea';
    if (needsTarget) {
      target = ctx.target || world.getEntity(ctx.targetId);
      if (!target) return no('noTarget');
      var corpseAction = !!(ability.flags && (ability.flags.revive || ability.flags.cremate));
      if (!target.alive && !corpseAction) return no('targetDead');
      if (target.alive && !target.isTargetable()) return no('untargetable');
      var hostile = world.areHostile(caster, target);
      if ((ability.target === 'enemy' || ability.target === 'targetArea') && !hostile) return no('badTarget');
      if (ability.target === 'ally' && (hostile || target.id === caster.id)) return no('badTarget');
      if (ability.target === 'allyOrSelf' && hostile) return no('badTarget');
      if (hostile && target.mods().stealthed && !target.hasStatus('revealed')) return no('untargetable');

      var range = (ability.range || 0) * Math.max(0.1, 1 + (caster.mods().attackRangePct || 0)) + target.radius + caster.radius;
      if (V.distXZ(caster.pos, target.pos) > range + (ctx.releaseValidation ? B.RANGE_TOLERANCE : 0)) return no('range');

      if (A.requiresFacing(ability, caster)) {
        var toTarget = V.yawTo(caster.pos, target.pos);
        if (Math.abs(V.angleDelta(caster.yaw, toTarget)) > B.FACING_HALF_ANGLE) return no('facing');
      }
      if (!ability.ignoresLoS && !world.hasLineOfSight(caster.eyePos(), target.centerPos(), caster, target)) return no('los');
    } else if (ability.target === 'ground') {
      if (!ctx.groundPoint) return no('noGround');
      if (V.distXZ(caster.pos, ctx.groundPoint) > (ability.range || 10) * Math.max(0.1, 1 + (caster.mods().attackRangePct || 0)) + 0.5) return no('range');
    }

    return { ok: true, reason: 'ok', message: '', target: target };
  };

  /* =========================================================================
   * Habilidades: request → begin → release
   * ====================================================================== */
  A.tryUse = function (world, caster, abilityId, ctx) {
    ctx = ctx || {};
    var ability = Arena.Data.abilities[abilityId];
    if (!ability) return { ok: false, reason: 'unknown', message: A.REASONS.unknown, queued: false };
    var now = world.time;
    if (ability.flags && ability.flags.toggle && caster.statuses) {
      var activeToggle = false;
      for (var ti = 0; ti < caster.statuses.length; ti++) if (caster.statuses[ti].abilityId === ability.id) { activeToggle = true; break; }
      if (activeToggle) {
        Status.removeByAbility(world, caster, ability.id, 'toggleOff');
        world.bus.emit('AbilityToggled', { casterId: caster.id, abilityId: ability.id, active: false });
        return { ok: true, reason: 'toggleOff', queued: false, toggledOff: true };
      }
    }
    var timing = A.timingOf(ability);
    var ws = A._weapon(caster);

    /* Relación explícita poder ↔ normal. Nunca se infiere por daño. */
    if (ws.phase === 'WINDUP') {
      var left = ws.releaseAt - now;
      if (timing.normalInteraction === 'weaveAfterNormal') {
        if (left <= B.INPUT_QUEUE_WINDOW + 1e-6) {
          A._setQueue(world, caster, 'afterNormal', abilityId, ctx, ws.releaseAt + B.INPUT_QUEUE_WINDOW + 0.30);
          return { ok: false, reason: 'weaponWindup', message: A.REASONS.weaponWindup, queued: true };
        }
        world.bus.emit('AbilityRejected', { casterId: caster.id, abilityId: abilityId, reason: 'weaponWindup', message: A.REASONS.weaponWindup });
        return { ok: false, reason: 'weaponWindup', message: A.REASONS.weaponWindup, queued: false };
      }
      if (timing.normalInteraction === 'replacesNormal') {
        A.cancelWeaponWindup(world, caster, 'replacedByAbility', abilityId);
      } else {
        // Un poder solicitado explícitamente tiene prioridad sobre el pulso
        // normal aún no liberado; esto evita que el autoattack robe el input.
        A.cancelWeaponWindup(world, caster, 'abilityPriority', abilityId);
      }
    }

    var check = A.canUse(world, caster, ability, ctx);
    if (!check.ok) {
      if (A._isQueueable(world, caster, ability, check.reason, now)) {
        var exp = now + B.INPUT_QUEUE_WINDOW + 0.35;
        if (check.reason === 'casting' && (caster.pendingCast || caster.cast)) {
          var pc = caster.pendingCast || caster.cast;
          exp = pc.endTime + A.gcdOf(world, caster, ability) + B.INPUT_QUEUE_WINDOW + 0.35;
        } else if (check.reason === 'gcd') {
          exp = caster.gcdUntil + B.INPUT_QUEUE_WINDOW + 0.30;
        }
        A._setQueue(world, caster, 'afterGcd', abilityId, ctx, exp);
        return { ok: false, reason: check.reason, message: check.message, queued: true };
      }
      world.bus.emit('AbilityRejected', { casterId: caster.id, abilityId: abilityId, reason: check.reason, message: check.message });
      return { ok: false, reason: check.reason, message: check.message, queued: false };
    }

    return A._begin(world, caster, ability, check.target, ctx);
  };

  A._isQueueable = function (world, caster, ability, reason, now) {
    if (reason === 'gcd') return (caster.gcdUntil - now) <= B.INPUT_QUEUE_WINDOW + 1e-6;
    if (reason === 'cooldown') return caster.cooldownRemaining(ability.id, now) <= B.INPUT_QUEUE_WINDOW + 1e-6;
    if (reason === 'weaponInterval') return (A._weapon(caster).readyAt - now) <= B.INPUT_QUEUE_WINDOW + 1e-6;
    if (reason === 'casting') {
      var c = caster.pendingCast || caster.cast;
      return !!c && (c.endTime - now) <= B.INPUT_QUEUE_WINDOW + 1e-6;
    }
    return false;
  };

  A._begin = function (world, caster, ability, target, ctx) {
    ctx = ctx || {};
    var now = world.time;
    var castTime = A.castTimeOf(world, caster, ability);
    var timing = A.timingOf(ability);

    if (castTime <= 0) {
      return A._release(world, caster, ability, target, ctx, null);
    }

    var pending = {
      abilityId: ability.id, targetId: target ? target.id : null,
      groundPoint: ctx.groundPoint ? { x: ctx.groundPoint.x, y: 0, z: ctx.groundPoint.z } : null,
      startTime: now, endTime: now + castTime, duration: castTime,
      startPos: V.clone(caster.pos), startYaw: caster.yaw,
      expectedResourceCost: A.costOf(world, caster, ability),
      movable: !timing.stationary || !!(ability.flags && ability.flags.movableCast),
      stationary: !!timing.stationary && !(ability.flags && ability.flags.movableCast),
      interruptible: !(ability.flags && ability.flags.uninterruptible),
      school: ability.school || 'general', cancelReason: null
    };
    caster.pendingCast = pending;
    caster.cast = pending; // compatibilidad con barra/AnimationIntent
    caster.actionState = { kind: 'ability', phase: 'CASTING', abilityId: ability.id, startedAt: now, releaseAt: pending.endTime };

    world.bus.emit('AbilityCastStarted', {
      casterId: caster.id, abilityId: ability.id, targetId: pending.targetId,
      groundPoint: pending.groundPoint ? { x: pending.groundPoint.x, y: 0, z: pending.groundPoint.z } : null,
      castTime: castTime, endTime: pending.endTime, movable: pending.movable,
      commit: 'onRelease'
    });
    return { ok: true, reason: 'ok', queued: false, instant: false, pending: true };
  };

  A._release = function (world, caster, ability, target, ctx, pending) {
    ctx = ctx || {};
    var now = world.time;

    /* Revalidación exactamente antes de RELEASE. No hay costes todavía. */
    var check = A.canUse(world, caster, ability, {
      target: target, targetId: target ? target.id : (ctx.targetId || null),
      groundPoint: ctx.groundPoint || (pending && pending.groundPoint) || null,
      ignoreCasting: true, releaseValidation: true,
      // Un cast que empezó legalmente puede llegar a release aunque el jugador
      // siga sujetando el input que lo habría cancelado: world cancela esa
      // intención ANTES de llegar aquí. Esta bandera evita duplicar política.
      ignoreMovement: true
    });

    if (!check.ok) {
      caster.pendingCast = null; caster.cast = null;
      caster.actionState = { kind: 'idle', phase: 'READY', startedAt: now, releaseAt: now };
      world.bus.emit('AbilityFailedBeforeRelease', {
        casterId: caster.id, abilityId: ability.id, reason: check.reason, message: check.message
      });
      // Evento legado para UI/logs existentes.
      world.bus.emit('AbilityFizzled', { casterId: caster.id, abilityId: ability.id, reason: check.reason });
      return { ok: false, reason: check.reason, message: check.message, queued: false, released: false };
    }

    target = check.target || target;
    var cost = A.costOf(world, caster, ability);
    caster.resource = Math.max(0, caster.resource - cost);

    var gcd = A.gcdOf(world, caster, ability);
    if (gcd > 0) {
      caster.gcdUntil = now + gcd;
      caster.gcdStartedAt = now;
      caster.gcdDuration = gcd;
    }
    if (!world.settings.freeCooldowns && ability.cooldown) caster.cooldowns[ability.id] = now + ability.cooldown;

    var timing = A.timingOf(ability);
    if (timing.weaponIntervalPolicy === 'consume' || timing.weaponIntervalPolicy === 'reset' ||
        timing.weaponIntervalPolicy === 'respectReady') {
      var ws = A._weapon(caster);
      ws.readyAt = now + A._weaponCycle(caster);
      ws.phase = 'RECOVERY'; ws.recoveryStartedAt = now; ws.recoveryUntil = ws.readyAt;
      caster.autoAttackNextAt = ws.readyAt;
    }

    caster.stats.abilitiesUsed++;
    caster.lastCombatAt = now;

    caster._castedFromStealth = caster.mods().stealthed;
    if (caster._castedFromStealth && !(ability.flags && ability.flags.keepsStealth)) Status.breakStealth(world, caster, 'cast');

    caster.pendingCast = null;
    caster.cast = null;
    caster.actionState = { kind: 'ability', phase: 'RELEASE', abilityId: ability.id, startedAt: now, releaseAt: now };

    world.bus.emit('AbilityReleased', {
      casterId: caster.id, abilityId: ability.id, targetId: target ? target.id : null,
      groundPoint: (ctx.groundPoint || (pending && pending.groundPoint)) ? { x:(ctx.groundPoint || pending.groundPoint).x, y:0, z:(ctx.groundPoint || pending.groundPoint).z } : null,
      resourceCost: cost, gcd: gcd, cooldown: ability.cooldown || 0, time: now
    });
    // Compatibilidad: ahora Completed significa "alcanzó release", nunca begin.
    world.bus.emit('AbilityCastCompleted', {
      casterId: caster.id, abilityId: ability.id, targetId: target ? target.id : null,
      groundPoint: (ctx.groundPoint || (pending && pending.groundPoint)) ? { x:(ctx.groundPoint || pending.groundPoint).x, y:0, z:(ctx.groundPoint || pending.groundPoint).z } : null,
      releaseTime: now
    });

    var report = Resolver.execute(world, caster, ability, {
      target: target, targetId: target ? target.id : null,
      groundPoint: ctx.groundPoint || (pending && pending.groundPoint) || null
    });

    Status.consumeOnCast(world, caster, ability);
    caster._castedFromStealth = false;
    if (Arena.Data.passives && Arena.Data.passives.onAbilityUsed) {
      Arena.Data.passives.onAbilityUsed(world, caster, ability, report);
    }
    return { ok: true, reason: 'ok', queued: false, instant: !pending, released: true, report: report };
  };

  /* =========================================================================
   * ATAQUE NORMAL — reloj separado del GCD
   * ====================================================================== */
  A.cancelWeaponWindup = function (world, entity, reason, replacementAbilityId) {
    var ws = A._weapon(entity);
    if (ws.phase !== 'WINDUP') return false;
    ws.phase = 'READY';
    ws.lastCancelAt = world.time;
    ws.cancelReason = reason || 'cancelled';
    ws.targetId = null;
    entity.autoAttackSwingEnd = 0;
    world.bus.emit('WeaponWindupCancelled', {
      casterId: entity.id, reason: ws.cancelReason, replacementAbilityId: replacementAbilityId || null
    });
    return true;
  };

  A._canBeginNormal = function (world, entity, target, now) {
    var m = entity.mods();
    if (!entity.alive || !m.canWeaponAttack || m.isolated) return { ok:false, reason:'control' };
    if (entity.pendingCast || entity.cast) return { ok:false, reason:'casting' };
    if (entity.jumpActive) return { ok:false, reason:'airborne' };
    if (A.hasMovementIntent(entity) && m.canMove) return { ok:false, reason:'moving' };
    if (!target || !target.alive || !target.isTargetable() || !world.areHostile(entity, target)) return { ok:false, reason:'target' };
    if (target.mods().stealthed && !target.hasStatus('revealed')) return { ok:false, reason:'target' };
    var reach = entity.autoAttackRange + target.radius + entity.radius;
    if (V.distXZ(entity.pos, target.pos) > reach) return { ok:false, reason:'range' };
    if (!world.hasLineOfSight(entity.eyePos(), target.centerPos(), entity, target)) return { ok:false, reason:'los' };
    var toTarget = V.yawTo(entity.pos, target.pos);
    if (Math.abs(V.angleDelta(entity.yaw, toTarget)) > B.AUTO_ATTACK_HALF_ANGLE) return { ok:false, reason:'facing' };
    return { ok:true };
  };

  A._beginNormal = function (world, entity, target, now) {
    var ws = A._weapon(entity);
    var windup = A._weaponWindup(entity);
    ws.phase = 'WINDUP'; ws.windupStartedAt = now; ws.releaseAt = now + windup;
    ws.targetId = target.id; ws.cancelReason = null;
    entity.autoAttackSwingEnd = ws.releaseAt;
    entity.actionState = { kind:'weapon', phase:'WINDUP', startedAt:now, releaseAt:ws.releaseAt, targetId:target.id };
    world.bus.emit('WeaponWindupStarted', {
      casterId: entity.id, targetId: target.id, windup: windup, releaseAt: ws.releaseAt,
      archetype: Arena.Data.archetypeOf ? Arena.Data.archetypeOf(entity.classId) : null
    });
  };

  A._releaseNormal = function (world, entity, target, now) {
    var ws = A._weapon(entity);
    if (!target || !target.alive || !target.isTargetable() || !world.areHostile(entity, target)) {
      A.cancelWeaponWindup(world, entity, 'targetInvalid'); return;
    }
    var valid = A._canBeginNormal(world, entity, target, now);
    if (!valid.ok) { A.cancelWeaponWindup(world, entity, valid.reason); return; }

    Status.breakStealth(world, entity, 'attack');
    var normalMods = entity.mods();
    var srcBonus=0, sb=normalMods.sourceBonusDamageFlat||{}; for(var bk in sb) if(Object.prototype.hasOwnProperty.call(sb,bk)) srcBonus+=Number(sb[bk]||0);
    var raw = entity.power * B.AUTO_ATTACK.coefficient * (1 + (normalMods.normalDamagePct || 0)) * Math.max(0,1+(normalMods.weaponDamagePct||0)) + (normalMods.normalDamageFlat || 0) + srcBonus;
    var ranged = entity.autoAttackRange > 5;
    var result = null;

    ws.phase = 'RELEASE'; ws.lastReleaseAt = now; ws.targetId = target.id;
    ws.readyAt = now + A._weaponCycle(entity);
    ws.recoveryStartedAt = now; ws.recoveryUntil = ws.readyAt;
    entity.autoAttackNextAt = ws.readyAt;
    entity.actionState = { kind:'weapon', phase:'RELEASE', startedAt:ws.windupStartedAt, releaseAt:now, targetId:target.id };

    world.bus.emit('AutoAttackReleased', {
      casterId: entity.id, targetId: target.id, ranged: ranged, releaseTime: now,
      weaponReadyAt: ws.readyAt
    });

    /* Toggles fuente como flechas potenciadas pueden cobrar vida/maná POR
       NORMAL. El coste ocurre en RELEASE —jamás en WINDUP— y por tanto una
       cancelación por movimiento sigue siendo transaccional. */
    var nm = entity.mods();
    if (nm.normalResourceCostFlat > 0) {
      var rc = Math.min(entity.resource, nm.normalResourceCostFlat);
      entity.resource -= rc;
      world.bus.emit('ResourceDrained', { targetId:entity.id, sourceId:entity.id, amount:rc, abilityId:'auto_attack_upkeep' });
    }
    if (nm.normalHealthCostFlat > 0 && entity.hp > 1) {
      var hc = Math.min(entity.hp - 1, nm.normalHealthCostFlat);
      entity.hp -= hc;
      world.bus.emit('DamageApplied', { targetId:entity.id, sourceId:entity.id, abilityId:'auto_attack_upkeep', school:'pure', raw:hc, mitigated:hc, absorbed:0, applied:hc, redirected:0, overkill:0, blocked:false, immune:false, crit:false, periodic:false, killed:false });
    }

    if (ranged) {
      world.spawnProjectile({
        casterId: entity.id, targetId: target.id, abilityId: 'auto_attack',
        from: entity.eyePos(), speed: entity.classId === 'arcanista' || entity.classId === 'vinculador' ? 38 : 48,
        kind: entity.autoAttackSchool === 'magical' ? 'bolt' : 'arrow',
        autoAttack: true, raw: raw, school: entity.autoAttackSchool
      });
    } else {
      result = Dmg.applyDamage(world, {
        source: entity, target: target, raw: raw,
        school: entity.autoAttackSchool === 'magical' ? 'magical' : 'physical',
        abilityId: 'auto_attack', canCrit: true
      });
      world.bus.emit('AutoAttackImpact', { casterId: entity.id, targetId: target.id, damage: result.applied, ranged:false });
      if (result.applied > 0) { A._advanceNormalStacks(entity); A._applySourceOnHitRecovery(world,entity,result.applied); }
      if (Arena.Data.passives && Arena.Data.passives.onAutoAttack) Arena.Data.passives.onAutoAttack(world, entity, target, result);
    }

    // Evento legado: representa RELEASE, no el momento de pulsar.
    world.bus.emit('AutoAttack', {
      casterId: entity.id, targetId: target.id, damage: result ? result.applied : 0,
      ranged: ranged, released: true
    });
  };

  A._applySourceOnHitRecovery = function (world, entity, applied) {
    if (!entity || applied <= 0) return;
    var m=entity.mods();
    if (m.onHitResourceFlat > 0) Arena.Combat.HealingSystem.restoreResource(world,entity,m.onHitResourceFlat,'sourceOnHit');
    if (m.onHitHealthFlat > 0) Arena.Combat.HealingSystem.applyHeal(world,{source:entity,target:entity,raw:m.onHitHealthFlat,abilityId:'source_on_hit'});
  };

  A._advanceNormalStacks = function (entity) {
    var changed=false;
    for (var i=0;i<entity.statuses.length;i++) {
      var data=entity.statuses[i].data||{};
      if (data.normalStackDamageFlat===undefined && data.normalStackDamagePct===undefined) continue;
      var max=Math.max(1,data.normalStackMax||5), cur=Math.max(0,data.normalStackCount||0);
      if (cur<max) { data.normalStackCount=cur+1; changed=true; }
    }
    if (changed) entity.invalidateMods();
    return changed;
  };

  A._tickAutoAttack = function (world, entity, now) {
    var ws = A._weapon(entity);
    // Compatibilidad: activar autoAttackOn implica entrar en combatMode.
    if (entity.autoAttackOn) entity.combatMode = true;
    if (!entity.autoAttackOn || !entity.combatMode || !entity.alive) {
      if (ws.phase === 'WINDUP') A.cancelWeaponWindup(world, entity, 'combatModeOff');
      return;
    }

    if (ws.phase === 'RELEASE') {
      ws.phase = 'RECOVERY';
      entity.actionState.phase = 'RECOVERY';
    }
    if (ws.phase === 'RECOVERY' && now >= ws.readyAt - 1e-6) {
      ws.phase = 'READY'; ws.targetId = null;
      entity.actionState = { kind:'idle', phase:'READY', startedAt:now, releaseAt:now };
      world.bus.emit('WeaponReady', { casterId: entity.id, time: now });
    }

    if (ws.phase === 'WINDUP') {
      var t = ws.targetId ? world.getEntity(ws.targetId) : null;
      if (now >= ws.releaseAt - 1e-6) A._releaseNormal(world, entity, t, now);
      return;
    }

    if (ws.phase !== 'READY' || now < ws.readyAt - 1e-6) return;
    var target = entity.targetId ? world.getEntity(entity.targetId) : null;
    var ok = A._canBeginNormal(world, entity, target, now);
    if (!ok.ok) {
      if (ok.reason === 'facing') world.bus.emit('AutoAttackBlocked', { casterId:entity.id, targetId:target && target.id, reason:'facing' });
      return;
    }
    A._beginNormal(world, entity, target, now);
  };

  /* =========================================================================
   * Tick, colas y cancelaciones
   * ====================================================================== */
  A.handlePreMovementIntents = function (world, entity, dt) {
    if (!entity || !entity.alive) return;
    var moving = A.hasMovementIntent(entity) && entity.mods().canMove;
    var c = entity.pendingCast || entity.cast;
    /* Girar el cuerpo/cámara NO cancela un casteo. El compromiso táctico es
       permanecer plantado; el jugador puede corregir facing durante PREPARE /
       CASTING y la validación final decide el RELEASE. */
    if (c && c.stationary && moving) {
      A.interruptCast(world, entity, { reason: 'movement', lockout: 0 });
    }
    if (A._weapon(entity).phase === 'WINDUP' && (moving || entity.jumpActive)) {
      A.cancelWeaponWindup(world, entity, moving ? 'movement' : 'jump');
    }
  };

  A._processQueue = function (world, entity, now) {
    var q = entity.queuedAction || entity.queued;
    if (!q) return;
    if (q.expiresAt !== undefined && now > q.expiresAt + 1e-6) { A._clearQueue(entity); return; }

    if (q.kind === 'afterNormal') {
      if (A._weapon(entity).lastReleaseAt < q.at - 1e-6) return;
    }
    if (entity.pendingCast || entity.cast || entity.gcdUntil > now + 1e-6) return;

    var ab = Arena.Data.abilities[q.abilityId];
    if (!ab) { A._clearQueue(entity); return; }
    var ctx = { targetId:q.targetId, target:world.getEntity(q.targetId), groundPoint:q.groundPoint };
    var check = A.canUse(world, entity, ab, ctx);
    if (check.ok) {
      A._clearQueue(entity);
      A._begin(world, entity, ab, check.target, ctx);
      return;
    }
    // Si ya no es una barrera temporal, no guardar un input fantasma.
    if (check.reason !== 'gcd' && check.reason !== 'cooldown' && check.reason !== 'weaponInterval' && check.reason !== 'casting') {
      A._clearQueue(entity);
    }
  };

  A.tick = function (world, entity, dt) {
    var now = world.time;
    var c = entity.pendingCast || entity.cast;
    if (c) {
      // Fallback contra jitter/teleports. La cancelación normal por input ocurre
      // ANTES de mover la entidad en World._tick.
      if (c.stationary && V.distXZ(entity.pos, c.startPos) > B.CAST_MOVE_TOLERANCE) {
        A.interruptCast(world, entity, { reason:'moved', lockout:0 });
      } else if (now >= c.endTime - 1e-6) {
        var ability = Arena.Data.abilities[c.abilityId];
        var target = c.targetId ? world.getEntity(c.targetId) : null;
        A._release(world, entity, ability, target, { groundPoint:c.groundPoint }, c);
      }
    }

    // El normal libera antes de procesar afterNormal: así una habilidad weave
    // puede empezar en el MISMO tick posterior al release sin robar el golpe.
    A._tickAutoAttack(world, entity, now);
    A._processQueue(world, entity, now);
  };

  A.interruptCast = function (world, entity, opts) {
    opts = opts || {};
    var c = entity.pendingCast || entity.cast;
    if (!c) return false;
    if (!c.interruptible && opts.reason === 'interrupt') return false;

    entity.pendingCast = null; entity.cast = null;
    entity.actionState = { kind:'idle', phase:'READY', startedAt:world.time, releaseAt:world.time };
    var lockout = opts.lockout === undefined ? 0 : opts.lockout;
    if (lockout > 0) {
      var school = c.school || 'general';
      entity.schoolLockouts[school] = Math.max(entity.schoolLockouts[school] || 0, world.time + lockout);
    }
    var reason = opts.reason || 'interrupt';
    world.bus.emit('AbilityCastCancelled', {
      casterId: entity.id, abilityId: c.abilityId, reason: reason, sourceId: opts.sourceId || null
    });
    world.bus.emit('AbilityCastInterrupted', {
      casterId: entity.id, abilityId: c.abilityId, reason: reason,
      sourceId: opts.sourceId || null, lockout: lockout, school: c.school
    });
    return true;
  };

  A.cancelCast = function (world, entity, reason) {
    if (!(entity.pendingCast || entity.cast)) return false;
    return A.interruptCast(world, entity, { reason: reason || 'manual', lockout: 0 });
  };

  Arena.Combat.AbilitySystem = A;
});
