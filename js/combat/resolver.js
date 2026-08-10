/* =============================================================================
 * combat/resolver.js — Ejecución de una habilidad sobre sus objetivos.
 *
 * Implementa literalmente los pasos 5–8 del orden obligatorio (documento §10):
 *
 *   5. En impacto: Stasis/Invulnerable → Intervención → Reflejo → Bloqueo
 *   6. Resolver mitigación y aplicar Damage/Heal/Barrier
 *   7. Aplicar Status Effects permitidos
 *   8. Ejecutar Cleanse/Purge/Triggers/Reactions
 *
 * Los pasos 1–4 (validación, recurso, GCD, rango, LoS, cast) son de
 * combat/abilitySystem.js. Este fichero asume que ya se aprobaron.
 * ========================================================================== */
Arena.define('combat/resolver',
  ['combat/damageSystem', 'combat/healingSystem', 'combat/statusSystem', 'math/ray'],
  function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var Ray = Arena.Math.Ray;
  var B = Arena.Data.balance;
  var Dmg = Arena.Combat.DamageSystem;
  var Heal = Arena.Combat.HealingSystem;
  var Status = Arena.Combat.StatusSystem;

  var R = {};

  var DAMAGE_TYPES = { physicalDamage: 1, magicalDamage: 1, pureDamage: 1, dot: 1, drainResource: 1 };

  /** ¿El payload de esta habilidad causa daño de HP o maná? Determina si la
   *  Intervención la deja pasar (§9). Se calcula una vez y se cachea. */
  R.abilityCausesDamage = function (ability) {
    if (ability._causesDamage === undefined) {
      var found = false;
      var list = ability.effects || [];
      for (var i = 0; i < list.length; i++) {
        if (DAMAGE_TYPES[list[i].type]) { found = true; break; }
      }
      ability._causesDamage = found;
    }
    return ability._causesDamage;
  };

  /** Un "impacto directo" a efectos de Bloqueo y Reflejo: dirigido, a un solo
   *  objetivo, no una zona ni un aura. */
  R.isSingleTargetDirect = function (ability, ctx) {
    if (ctx && ctx.isAoE) return false;
    return ability.target === 'enemy' || ability.target === 'ally' || ability.target === 'allyOrSelf';
  };

  /* =========================================================================
   * Selección de objetivos
   * ====================================================================== */

  R.collectTargets = function (world, caster, ability, ctx) {
    var out = [];
    var i, e;

    switch (ability.target) {
      case 'self':
        out.push(caster);
        break;

      case 'enemy':
      case 'ally':
      case 'allyOrSelf': {
        var t = ctx.target || world.getEntity(ctx.targetId);
        if (t) out.push(t);
        break;
      }

      case 'cone': {
        var list = world.entities;
        for (i = 0; i < list.length; i++) {
          e = list[i];
          if (!R._validAoEVictim(world, caster, e, ability)) continue;
          if (!Ray.pointInCone(caster.pos, caster.yaw, (ability.coneAngle || Math.PI / 4),
                               ability.range + e.radius, e.pos)) continue;
          out.push(e);
        }
        break;
      }

      case 'aoeSelf': {
        var list2 = world.entities;
        for (i = 0; i < list2.length; i++) {
          e = list2[i];
          if (!R._validAoEVictim(world, caster, e, ability)) continue;
          if (V.distXZ(caster.pos, e.pos) > (ability.radius || 5) + e.radius) continue;
          out.push(e);
        }
        break;
      }

      case 'ground': {
        var pt = ctx.groundPoint;
        if (!pt) break;
        var list3 = world.entities;
        for (i = 0; i < list3.length; i++) {
          e = list3[i];
          if (!R._validAoEVictim(world, caster, e, ability)) continue;
          if (V.distXZ(pt, e.pos) > (ability.radius || 3) + e.radius) continue;
          out.push(e);
        }
        break;
      }
    }
    return out;
  };

  R._validAoEVictim = function (world, caster, e, ability) {
    if (!e.alive || !e.isTargetable()) return false;
    var hostile = world.areHostile(caster, e);
    if (ability.affects === 'allies') { if (hostile || e.id === caster.id) return false; }
    else if (ability.affects === 'alliesAndSelf') { if (hostile) return false; }
    else { if (!hostile) return false; }        // por defecto: sólo enemigos
    if (e.mods().stealthed && world.areHostile(caster, e) && !e.hasStatus('revealed')) return false;
    if (!ability.ignoresLoS && !world.hasLineOfSight(caster.eyePos(), e.centerPos(), caster, e)) return false;
    return true;
  };

  /* =========================================================================
   * Ejecución
   * ====================================================================== */

  /**
   * Punto de entrada. Devuelve el informe de la ejecución para el log y la IA.
   */
  R.execute = function (world, caster, ability, ctx) {
    ctx = ctx || {};

    // Las habilidades con proyectil no resuelven al lanzar: vuelan y resuelven
    // al impactar. Es lo que da ventana real a Reflejo, Bloqueo y Estasis, y lo
    // que hace que la distancia se sienta en un combate a 24 unidades.
    if (ability.flags && ability.flags.projectile && !ctx.fromProjectile) {
      var pTarget = ctx.target || world.getEntity(ctx.targetId);
      if (pTarget) {
        world.spawnProjectile({
          casterId: caster.id, targetId: pTarget.id, abilityId: ability.id,
          from: caster.eyePos(), speed: ability.projectileSpeed || 34,
          kind: (ability.flags.magic ? 'bolt' : 'arrow')
        });
        world.bus.emit('AbilityExecuted', {
          casterId: caster.id, abilityId: ability.id,
          targetCount: 1, hits: 0, projectile: true, groundPoint: null
        });
        return { abilityId: ability.id, casterId: caster.id, hits: [], targetCount: 1, inFlight: true };
      }
    }

    var targets = R.collectTargets(world, caster, ability, ctx);
    var isAoE = (ability.target === 'cone' || ability.target === 'aoeSelf' || ability.target === 'ground');
    var report = {
      abilityId: ability.id, casterId: caster.id, hits: [], targetCount: targets.length,
      groundPoint: ctx.groundPoint || null
    };

    // Daño repartido en área: evita que un cono contra 5 objetivos sea un burst
    // masivo gratis (documento, Lluvia de astillas).
    var splitFactor = 1;
    if (isAoE && ability.splitDamage && targets.length > 1) splitFactor = 1 / targets.length;

    for (var i = 0; i < targets.length; i++) {
      var hitCtx = {
        isAoE: isAoE, splitFactor: splitFactor,
        groundPoint: ctx.groundPoint, noReflect: ctx.noReflect, fromReflect: ctx.fromReflect
      };
      report.hits.push(R.resolveHit(world, caster, targets[i], ability, hitCtx));
    }

    // Efectos sobre uno mismo: buffs, cargas, coste de posicionamiento. Nunca
    // pasan por los counters del enemigo.
    if (ability.selfEffects && ability.selfEffects.length) {
      R._applyEffectList(world, caster, caster, ability, ability.selfEffects, { isSelf: true });
    }

    world.bus.emit('AbilityExecuted', {
      casterId: caster.id, abilityId: ability.id,
      targetCount: targets.length, hits: report.hits.length,
      groundPoint: ctx.groundPoint || null
    });
    return report;
  };

  /**
   * Resolución de un impacto individual. Éste es el punto donde el documento
   * exige un orden fijo; cualquier alteración cambia el metajuego entero.
   */
  R.resolveHit = function (world, caster, target, ability, ctx) {
    ctx = ctx || {};
    var hit = {
      targetId: target.id, casterId: caster.id, abilityId: ability.id,
      outcome: 'hit', damage: 0, healing: 0, effects: []
    };
    var hostile = world.areHostile(caster, target);

    /* --- Paso 5.a — Estasis / invulnerabilidad -------------------------- */
    if (!target.alive) { hit.outcome = 'dead'; return hit; }
    if (target.mods().isolated) {
      hit.outcome = 'stasis';
      world.bus.emit('AbilityNullified', {
        casterId: caster.id, targetId: target.id, abilityId: ability.id, reason: 'stasis'
      });
      return hit;
    }

    if (hostile) {
      /* --- Paso 5.b — Intervención -------------------------------------
       * El aliado protegido ignora las habilidades hostiles cuyo payload NO
       * cause daño de HP/maná. Una habilidad dañina sí impacta, y aplica sus
       * efectos asociados con normalidad (§9 y decisión de §30).            */
      if (target.mods().ignoresNonDamaging && !R.abilityCausesDamage(ability)) {
        hit.outcome = 'intervention';
        world.bus.emit('AbilityNullified', {
          casterId: caster.id, targetId: target.id, abilityId: ability.id, reason: 'intervention'
        });
        return hit;
      }

      /* --- Paso 5.c — Reflejo -------------------------------------------
       * Una carga. Sólo magia dirigida de objetivo único. Nunca AoE, suelo,
       * auras, curas ni un reflejo de otro reflejo.                         */
      if (target.mods().reflectsMagic && ability.flags && ability.flags.magic &&
          R.isSingleTargetDirect(ability, ctx) && !ctx.noReflect && !ctx.fromReflect) {
        var refl = target.getStatus('reflect');
        if (refl) {
          Status.removeInstance(world, target, refl, 'consumed');
          hit.outcome = 'reflected';
          world.bus.emit('AbilityReflected', {
            casterId: caster.id, targetId: target.id, abilityId: ability.id
          });
          // Se resuelve contra el lanzador original, que ahora es la víctima.
          R.resolveHit(world, target, caster, ability, {
            isAoE: false, splitFactor: ctx.splitFactor, noReflect: true, fromReflect: true
          });
          return hit;
        }
      }

      /* --- Paso 5.d — Bloqueo ------------------------------------------- */
      if (target.mods().blocksDirectHits && R.isSingleTargetDirect(ability, ctx)) {
        hit.outcome = 'blocked';
        world.bus.emit('AbilityBlocked', {
          casterId: caster.id, targetId: target.id, abilityId: ability.id
        });
        return hit;
      }
    }

    /* --- Pasos 6, 7 y 8 -------------------------------------------------- */
    R._applyEffectList(world, caster, target, ability, ability.effects || [], ctx, hit);

    world.bus.emit('AbilityHit', {
      casterId: caster.id, targetId: target.id, abilityId: ability.id,
      outcome: hit.outcome, damage: hit.damage, healing: hit.healing
    });
    return hit;
  };

  /* =========================================================================
   * Catálogo de efectos genéricos
   *
   * Añadir un poder nuevo debería ser escribir datos, no código (documento §25).
   * Cada `type` aquí es una pieza reutilizable.
   * ====================================================================== */

  R._applyEffectList = function (world, caster, target, ability, effects, ctx, hit) {
    ctx = ctx || {};
    hit = hit || { effects: [], damage: 0, healing: 0 };
    var split = ctx.splitFactor || 1;

    for (var i = 0; i < effects.length; i++) {
      var e = effects[i];
      var handler = R.effectHandlers[e.type];
      if (!handler) throw new Error('Tipo de efecto no implementado: "' + e.type + '"');
      // `chance` permite efectos condicionales sin código especial; con RNG
      // desactivado se toman como deterministas (siempre ocurren).
      if (e.chance !== undefined && world.settings.rngEnabled && !world.rng.chance(e.chance)) continue;
      if (e.condition && !R.conditions[e.condition](world, caster, target, ability, e)) continue;
      handler(world, caster, target, ability, e, split, hit, ctx);
    }
    return hit;
  };

  function power(caster, e) {
    return (e.flat !== undefined ? e.flat : caster.power * (e.coefficient || 1));
  }

  R.effectHandlers = {

    physicalDamage: function (world, caster, target, ability, e, split, hit) {
      var res = Dmg.applyDamage(world, {
        source: caster, target: target, raw: power(caster, e) * split,
        school: 'physical', abilityId: ability.id,
        ignoreDefensePct: e.ignoreDefensePct || 0,
        canCrit: e.canCrit !== false
      });
      hit.damage += res.applied;
    },

    magicalDamage: function (world, caster, target, ability, e, split, hit) {
      var res = Dmg.applyDamage(world, {
        source: caster, target: target, raw: power(caster, e) * split,
        school: 'magical', abilityId: ability.id,
        ignoreDefensePct: e.ignoreDefensePct || 0,
        canCrit: e.canCrit !== false
      });
      hit.damage += res.applied;
    },

    pureDamage: function (world, caster, target, ability, e, split, hit) {
      var res = Dmg.applyDamage(world, {
        source: caster, target: target, raw: power(caster, e) * split,
        school: 'pure', abilityId: ability.id, canCrit: false
      });
      hit.damage += res.applied;
    },

    heal: function (world, caster, target, ability, e, split, hit) {
      var res = Heal.applyHeal(world, {
        source: caster, target: target,
        raw: (e.flat !== undefined ? e.flat : caster.healPower * (e.coefficient || 1)) * split,
        abilityId: ability.id
      });
      hit.healing += res.applied;
    },

    barrier: function (world, caster, target, ability, e, split, hit) {
      Heal.applyBarrier(world, {
        source: caster, target: target,
        amount: (e.flat !== undefined ? e.flat : caster.healPower * (e.coefficient || 1)) * split,
        duration: e.duration || 8, abilityId: ability.id
      });
      hit.effects.push('barrier');
    },

    hot: function (world, caster, target, ability, e, split, hit) {
      var interval = e.interval || 1.0;
      var total = (e.flat !== undefined ? e.flat : caster.healPower * (e.coefficient || 1)) * split;
      var ticks = Math.max(1, Math.round((e.duration || 8) / interval));
      Status.apply(world, target, {
        effect: 'hot', duration: e.duration || 8, abilityId: ability.id,
        data: { tickHeal: total / ticks, interval: interval, total: total }
      }, caster);
      hit.effects.push('hot');
    },

    dot: function (world, caster, target, ability, e, split, hit) {
      var interval = e.interval || 1.0;
      var total = power(caster, e) * split;
      var ticks = Math.max(1, Math.round((e.duration || 6) / interval));
      Status.apply(world, target, {
        effect: 'dot', duration: e.duration || 6, abilityId: ability.id,
        data: {
          tickDamage: total / ticks, interval: interval, total: total,
          school: e.school || 'magical', label: e.label || 'Daño periódico'
        }
      }, caster);
      hit.effects.push('dot');
    },

    /** Efecto genérico: la mayoría de poderes se escriben con esto. */
    status: function (world, caster, target, ability, e, split, hit) {
      var data = {};
      if (e.data) for (var k in e.data) if (Object.prototype.hasOwnProperty.call(e.data, k)) data[k] = e.data[k];
      if (e.effect === 'damageRedirect') data.protectorId = caster.id;
      if (e.effect === 'protectiveLink') data.binderId = caster.id;
      var inst = Status.apply(world, target, {
        effect: e.effect, duration: e.duration || 0, abilityId: ability.id,
        data: data, ignoreDR: e.ignoreDR, ignoreAntiBuff: e.ignoreAntiBuff,
        permanent: e.permanent
      }, caster);
      if (inst) hit.effects.push(e.effect);
    },

    cleanse: function (world, caster, target, ability, e, split, hit) {
      var removed = Status.cleanse(world, target, { hard: e.hard || 0, minor: e.minor || 0 }, caster);
      if (removed.length) hit.effects.push('cleanse');
    },

    purge: function (world, caster, target, ability, e, split, hit) {
      var removed = Status.purge(world, target, e.count || 1, caster);
      if (removed.length) hit.effects.push('purge');
    },

    interrupt: function (world, caster, target, ability, e, split, hit) {
      if (target.cast) {
        Arena.Combat.AbilitySystem.interruptCast(world, target, {
          reason: 'interrupt', sourceId: caster.id,
          lockout: e.lockout === undefined ? B.INTERRUPT_LOCKOUT : e.lockout
        });
        caster.stats.interrupts++;
        hit.effects.push('interrupt');
      }
    },

    restoreResource: function (world, caster, target, ability, e, split, hit) {
      Heal.restoreResource(world, target,
        e.flat !== undefined ? e.flat : target.resourceMax * (e.pct || 0.1), 'ability');
    },

    drainResource: function (world, caster, target, ability, e, split, hit) {
      var amount = Math.min(target.resource, e.flat || 0);
      target.resource -= amount;
      world.bus.emit('ResourceDrained', {
        targetId: target.id, sourceId: caster.id, amount: amount, abilityId: ability.id
      });
    },

    /** Desplazamiento del lanzador hacia el objetivo (cargas) o hacia atrás. */
    dash: function (world, caster, target, ability, e, split, hit, ctx) {
      // Un desplazamiento no rompe Enraizar (documento, Retroceso táctico).
      // Si no puedes moverte, la habilidad se lanza pero no te lleva a ningún
      // sitio: el resto de su payload sí se aplica.
      if (!caster.mods().canMove) {
        world.bus.emit('DashBlocked', { entityId: caster.id, abilityId: ability.id, reason: 'rooted' });
        return;
      }
      var dest;
      if (e.mode === 'toTarget' && target && target !== caster) {
        var dir = V.normalize(V.create(), V.sub(V.create(), caster.pos, target.pos));
        var stop = (target.radius + caster.radius + (e.gap === undefined ? 0.35 : e.gap));
        dest = V.addScaled(V.create(), target.pos, dir, stop);
      } else if (e.mode === 'toAlly' && target && target !== caster) {
        var dir2 = V.normalize(V.create(), V.sub(V.create(), caster.pos, target.pos));
        dest = V.addScaled(V.create(), target.pos, dir2, target.radius + caster.radius + 0.5);
      } else {
        var back = V.fromYaw(V.create(), caster.yaw);
        dest = V.addScaled(V.create(), caster.pos, back, -(e.distance || 6));
      }
      world.moveEntityTo(caster, dest, { sweep: true, reason: 'dash', abilityId: ability.id });
      hit.effects.push('dash');
    },

    /** Coloca una zona persistente en el suelo (trampas). */
    zone: function (world, caster, target, ability, e, split, hit, ctx) {
      var pt = (ctx && ctx.groundPoint) || (target ? target.pos : caster.pos);
      world.spawnZone({
        ownerId: caster.id, abilityId: ability.id, kind: e.kind || 'trap',
        x: pt.x, z: pt.z, radius: e.radius || 1.6, duration: e.duration || 20,
        armDelay: e.armDelay || 0.4, triggers: e.triggers || 1,
        onTrigger: e.onTrigger || []
      });
      hit.effects.push('zone');
    },

    reveal: function (world, caster, target, ability, e, split, hit) {
      Status.breakStealth(world, target, 'reveal');
      Status.apply(world, target, {
        effect: 'revealed', duration: e.duration || 5, abilityId: ability.id, data: {}
      }, caster);
      hit.effects.push('reveal');
    },

    /** Ejecuta otro bloque de efectos si se cumple una condición nombrada. */
    conditional: function (world, caster, target, ability, e, split, hit, ctx) {
      var ok = R.conditions[e.check](world, caster, target, ability, e);
      var list = ok ? (e.then || []) : (e.otherwise || []);
      R._applyEffectList(world, caster, target, ability, list, ctx, hit);
    }
  };

  /* --- Condiciones reutilizables ----------------------------------------- */
  R.conditions = {
    casterHasStatus: function (world, caster, target, ability, e) {
      return caster.hasStatus(e.status);
    },
    targetHasStatus: function (world, caster, target, ability, e) {
      return target.hasStatus(e.status);
    },
    casterFromStealth: function (world, caster) {
      return caster.aiState ? false : !!caster._castedFromStealth;
    },
    targetBelowHpPct: function (world, caster, target, ability, e) {
      return target.hpPct() < (e.value || 0.5);
    },
    targetFartherThan: function (world, caster, target, ability, e) {
      return V.distXZ(caster.pos, target.pos) > (e.value || 16);
    },
    hasCharges: function (world, caster, target, ability, e) {
      return (caster.charges[e.key] || 0) >= (e.value || 1);
    }
  };

  Arena.Combat.Resolver = R;
});
