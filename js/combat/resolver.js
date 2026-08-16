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

  var DAMAGE_TYPES = { physicalDamage: 1, magicalDamage: 1, pureDamage: 1, dot: 1, drainResource: 1, sourceDamage: 1, sourceWeaponDamage: 1, sourceDot: 1, sourceDrain: 1, sourceDrainDot: 1, manaBurn: 1 };

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

      case 'targetArea': {
        /* AoE TARGET-CENTERED: Regnum-style ranged areas are not free ground
         * reticles. The selected target anchors the blast and normal target
         * range/facing/LoS validation remains authoritative. */
        var anchor = ctx.target || world.getEntity(ctx.targetId);
        if (!anchor) break;
        var listA = world.entities;
        for (i = 0; i < listA.length; i++) {
          e = listA[i];
          if (!R._validAoEVictim(world, caster, e, ability)) continue;
          if (V.distXZ(anchor.pos, e.pos) > (ability.radius || 3) + e.radius) continue;
          out.push(e);
        }
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
    var reviveAction=!!(ability.flags&&ability.flags.revive);
    if (reviveAction) { if (e.alive || e.cremated) return false; }
    else if (!e.alive || !e.isTargetable()) return false;
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
    var isAoE = (ability.target === 'cone' || ability.target === 'aoeSelf' || ability.target === 'ground' || ability.target === 'targetArea');
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
    if (!target.alive && !(ability.flags && ability.flags.revive)) { hit.outcome = 'dead'; return hit; }
    if (target.mods().isolated) {
      hit.outcome = 'stasis';
      world.bus.emit('AbilityNullified', {
        casterId: caster.id, targetId: target.id, abilityId: ability.id, reason: 'stasis'
      });
      return hit;
    }

    if (hostile) {
      /* Resistencia absoluta/probabilística a poderes de la biblioteca fuente.
         Con RNG apagado sólo 100 % niega el impacto; con RNG encendido se usa
         el RNG determinista del mundo. El ataque normal no pasa por aquí. */
      var powerImmune = target.mods().powerImmunityPct || 0;
      if (powerImmune >= 0.999 || (powerImmune > 0 && world.settings.rngEnabled && world.rng.chance(powerImmune))) {
        hit.outcome = 'resisted';
        world.bus.emit('AbilityNullified', { casterId:caster.id, targetId:target.id, abilityId:ability.id, reason:'sourcePowerResistance' });
        return hit;
      }

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

      /* Evasión y bloqueo porcentuales source-derived. El modo competitivo de
         game-feel mantiene RNG apagado: sólo un 100 % es determinista. Al
         activar RNG en el laboratorio, porcentajes intermedios se vuelven
         plenamente funcionales usando la semilla del mundo. */
      var tm = target.mods();
      var ev = Math.max(0, tm.evasionPct || 0);
      var physicalLike = ability.flags && ability.flags.weaponAttack;
      if (physicalLike && (ev >= 0.999 || (ev > 0 && world.settings.rngEnabled && world.rng.chance(ev)))) {
        hit.outcome = 'evaded';
        world.bus.emit('AbilityNullified', { casterId:caster.id, targetId:target.id, abilityId:ability.id, reason:'evasion' });
        return hit;
      }
      var bp = Math.max(0, tm.blockPct || 0);
      var canSourceBlock = !(ability.sourceDerived && ability.flags && ability.flags.blockable === false);
      if (canSourceBlock && R.isSingleTargetDirect(ability, ctx) &&
          (bp >= 0.999 || (bp > 0 && world.settings.rngEnabled && world.rng.chance(bp)))) {
        hit.outcome = 'blocked';
        world.bus.emit('AbilityBlocked', { casterId:caster.id, targetId:target.id, abilityId:ability.id, reason:'sourceBlockChance' });
        return hit;
      }

      /* --- Paso 5.d — Bloqueo ------------------------------------------- */
      if (target.mods().blocksDirectHits && R.isSingleTargetDirect(ability, ctx) &&
          !(ability.sourceDerived && ability.flags && ability.flags.blockable === false)) {
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

  function sourceRoll(world, min, max) {
    min=Number(min||0); max=Number(max===undefined?min:max);
    if(max<min){var t=min;min=max;max=t;}
    if(Math.abs(max-min)<1e-9) return min;
    return world.settings.rngEnabled ? world.rng.range(min,max) : (min+max)*0.5;
  }

  function sourceRangeKind(ability) {
    if (ability.flags && ability.flags.projectile) return 'ranged';
    return (ability.range||0)>4 ? 'ranged' : 'melee';
  }

  function sourceBonusFlat(mods, element) {
    var b=mods.sourceBonusDamageFlat||{}, total=Number(b.generic||0);
    if(element) total+=Number(b[element]||0);
    if(element==='slashing'||element==='piercing'||element==='blunt') total+=Number(b.physical||0);
    return total;
  }

  R.effectHandlers = {

    sourceDamage: function (world, caster, target, ability, e, split, hit) {
      var cm=caster.mods();
      var raw=sourceRoll(world,e.min,e.max);
      if(ability.flags&&ability.flags.magic) raw*=Math.max(0,1+(cm.spellDamagePct||0));
      raw+=sourceBonusFlat(cm,e.element);
      raw*=split;
      var res=Dmg.applyDamage(world,{source:caster,target:target,raw:raw,school:e.school||'pure',element:e.element||'generic',abilityId:ability.id,canCrit:false,rangeKind:sourceRangeKind(ability)});
      hit.damage+=res.applied;
    },

    sourceWeaponDamage: function (world, caster, target, ability, e, split, hit) {
      if(e.chance!==undefined && world.settings.rngEnabled && !world.rng.chance(e.chance)) return;
      var pct=sourceRoll(world,e.pctMin,e.pctMax);
      var mult=e.bonus ? (1+pct) : pct;
      var cm=caster.mods();
      var base=caster.power * B.AUTO_ATTACK.coefficient * Math.max(0,1+(cm.weaponDamagePct||0));
      var raw=(base*mult + sourceBonusFlat(cm,'physical'))*split;
      var res=Dmg.applyDamage(world,{source:caster,target:target,raw:raw,school:'physical',element:'physical',abilityId:ability.id,canCrit:true,rangeKind:sourceRangeKind(ability)});
      hit.damage+=res.applied;
    },

    sourceDot: function (world, caster, target, ability, e, split, hit) {
      var cm=caster.mods();
      var tick=sourceRoll(world,e.min,e.max);
      if(ability.flags&&ability.flags.magic) tick*=Math.max(0,1+(cm.spellDamagePct||0));
      tick+=sourceBonusFlat(cm,e.element);
      tick*=split;
      var interval=e.interval||1.0, duration=e.duration||interval;
      Status.apply(world,target,{effect:'dot',duration:duration,abilityId:ability.id,data:{tickDamage:tick,interval:interval,total:tick*Math.max(1,Math.round(duration/interval)),school:e.school||'magical',element:e.element||'generic',label:'Daño fuente'}},caster);
      hit.effects.push('sourceDot');
    },

    sourceDrain: function (world, caster, target, ability, e, split, hit) {
      var raw=sourceRoll(world,e.min,e.max)*split;
      var res=Dmg.applyDamage(world,{source:caster,target:target,raw:raw,school:'pure',abilityId:ability.id,canCrit:false});
      hit.damage+=res.applied;
      if(res.applied>0) Heal.applyHeal(world,{source:caster,target:caster,raw:res.applied,abilityId:ability.id});
      hit.effects.push('sourceDrain');
    },

    sourceDrainDot: function (world, caster, target, ability, e, split, hit) {
      var tick=sourceRoll(world,e.min,e.max)*split;
      var interval=e.interval||1.0, duration=e.duration||interval;
      Status.apply(world,target,{effect:'dot',duration:duration,abilityId:ability.id,data:{tickDamage:tick,interval:interval,total:tick*Math.max(1,Math.round(duration/interval)),school:'pure',label:'Drenaje vital',healSourceId:caster.id}},caster);
      hit.effects.push('sourceDrainDot');
    },

    sourceHeal: function (world, caster, target, ability, e, split, hit) {
      if(e.chance!==undefined && world.settings.rngEnabled && !world.rng.chance(e.chance)) return;
      var rolled=sourceRoll(world,e.min,e.max);
      var raw=(e.percentOfMax ? target.effectiveHpMax()*(rolled/100) : rolled)*split;
      var res=Heal.applyHeal(world,{source:caster,target:target,raw:raw,abilityId:ability.id});
      hit.healing+=res.applied;
      hit.effects.push('sourceHeal');
    },

    sourceHot: function (world, caster, target, ability, e, split, hit) {
      var tick=sourceRoll(world,e.min,e.max)*split;
      var interval=e.interval||1.0, duration=e.duration||interval;
      Status.apply(world,target,{effect:'hot',duration:duration,abilityId:ability.id,data:{tickHeal:tick,interval:interval,label:'Curación fuente'}},caster);
      hit.effects.push('sourceHot');
    },

    sourceResourceRestore: function (world, caster, target, ability, e, split, hit) {
      var value=sourceRoll(world,e.min,e.max);
      var amount=e.percent ? target.resourceMax*(value/100) : value;
      Heal.restoreResource(world,target,amount*split,'sourceAbility');
      hit.effects.push('sourceResourceRestore');
    },

    sourceManaDrain: function (world, caster, target, ability, e, split, hit) {
      var value=sourceRoll(world,e.min,e.max);
      var requested=e.percent ? target.resourceMax*(value/100) : value;
      requested*=split;
      var amount=Math.min(target.resource,Math.max(0,requested));
      target.resource-=amount;
      if(e.transfer&&amount>0) Heal.restoreResource(world,caster,amount,'sourceManaDrain');
      world.bus.emit('ResourceDrained',{targetId:target.id,sourceId:caster.id,amount:amount,abilityId:ability.id});
      hit.effects.push('sourceManaDrain');
    },

    sourceManaDrainDot: function (world, caster, target, ability, e, split, hit) {
      var value=sourceRoll(world,e.min,e.max)*split;
      Status.apply(world,target,{effect:'dot',duration:e.duration||1,abilityId:ability.id,data:{
        tickResourceDrain:value, resourceDrainPercent:!!e.percent, resourceHealSource:!!e.transfer,
        interval:e.interval||1.0, label:'Drenaje de maná fuente'
      }},caster);
      hit.effects.push('sourceManaDrainDot');
    },

    manaBurn: function (world, caster, target, ability, e, split, hit) {
      var requested=Math.max(0,Number(e.flat||0))*split;
      var amount=Math.min(target.resource,requested);
      target.resource-=amount;
      if(amount>0){
        var res=Dmg.applyDamage(world,{source:caster,target:target,raw:amount,school:'pure',abilityId:ability.id,canCrit:false});
        hit.damage+=res.applied;
      }
      world.bus.emit('ResourceDrained',{targetId:target.id,sourceId:caster.id,amount:amount,abilityId:ability.id});
      hit.effects.push('manaBurn');
    },

    physicalDamage: function (world, caster, target, ability, e, split, hit) {
      var res = Dmg.applyDamage(world, {
        source: caster, target: target, raw: power(caster, e) * split,
        school: 'physical', abilityId: ability.id,
        ignoreDefensePct: e.ignoreDefensePct || 0,
        canCrit: e.canCrit !== false,
        rangeKind: (ability.flags && ability.flags.projectile) ? 'ranged' : 'melee'
      });
      hit.damage += res.applied;
    },

    magicalDamage: function (world, caster, target, ability, e, split, hit) {
      var res = Dmg.applyDamage(world, {
        source: caster, target: target, raw: power(caster, e) * split,
        school: 'magical', abilityId: ability.id,
        ignoreDefensePct: e.ignoreDefensePct || 0,
        canCrit: e.canCrit !== false,
        rangeKind: (ability.flags && ability.flags.projectile) ? 'ranged' : ((ability.range || 0) > 4 ? 'ranged' : 'melee')
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
        data: data, ignoreDR: (e.ignoreDR || !!ability.sourceDerived), ignoreAntiBuff: e.ignoreAntiBuff,
        permanent: e.permanent
      }, caster);
      if (inst) hit.effects.push(e.effect);
    },

    cleanse: function (world, caster, target, ability, e, split, hit) {
      var removed = Status.cleanse(world, target, { hard: e.hard || 0, minor: e.minor || 0 }, caster);
      if (removed.length) hit.effects.push('cleanse');
    },

    purge: function (world, caster, target, ability, e, split, hit) {
      if(e.chance!==undefined && world.settings.rngEnabled && !world.rng.chance(e.chance)) return;
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
      var requested = e.flat !== undefined ? e.flat : target.resourceMax * (e.pct || 0);
      var amount = Math.min(target.resource, Math.max(0, requested));
      target.resource -= amount;
      world.bus.emit('ResourceDrained', {
        targetId: target.id, sourceId: caster.id, amount: amount, abilityId: ability.id
      });
    },

    /** Aura persistente centrada en el lanzador. World vuelve a aplicar sus
     *  estados en pulsos cortos, de modo que salir del radio los deja expirar. */
    aura: function (world, caster, target, ability, e, split, hit) {
      world.spawnAura({
        ownerId: caster.id, abilityId: ability.id,
        radius: e.radius || 6, duration: e.duration || 30,
        affects: e.affects || 'alliesAndSelf', effects: e.effects || []
      });
      hit.effects.push('aura');
    },

    summon: function (world, caster, target, ability, e, split, hit) {
      var n = Math.max(1, Math.min(12, e.count || 1));
      for (var i = 0; i < n; i++) world.spawnCompanion(caster, {
        kind: e.kind || 'companion', abilityId: ability.id, index: i, controllable:!!e.controllable, duration:e.duration||0
      });
      hit.effects.push('summon');
    },

    companionEffect: function (world, caster, target, ability, e, split, hit) {
      var pets = world.companionsOf(caster, true);
      for (var i = 0; i < pets.length; i++) {
        if (!pets[i].alive) continue;
        R._applyEffectList(world, caster, pets[i], ability, e.effects || [], { isSelf: true }, hit);
      }
      hit.effects.push('companionEffect');
    },

    companionProtectOwner: function (world, caster, target, ability, e, split, hit) {
      var pets=world.companionsOf(caster,false);
      if(!pets.length){ hit.outcome='noCompanion'; return; }
      var pet=pets[0];
      var inst=Status.apply(world,caster,{effect:'damageRedirect',duration:e.duration||1,abilityId:ability.id,data:{
        redirectPct:Math.max(0,Math.min(1,Number(e.redirectPct||0))), protectorId:pet.id
      },ignoreDR:true},caster);
      if(inst) hit.effects.push('companionProtectOwner');
    },

    companionAoE: function (world, caster, target, ability, e, split, hit) {
      var pets=world.companionsOf(caster,false), radius=Number(e.radius||6);
      for(var pi=0;pi<pets.length;pi++){
        var pet=pets[pi];
        for(var ti=0;ti<world.entities.length;ti++){
          var victim=world.entities[ti];
          if(!victim.alive || !world.areHostile(caster,victim)) continue;
          if(Arena.Math.Vec3.distXZ(pet.pos,victim.pos)>radius+victim.radius) continue;
          R._applyEffectList(world,pet,victim,ability,e.effects||[],{isAoE:true},hit);
        }
      }
      hit.effects.push('companionAoE');
    },

    companionRevive: function (world, caster, target, ability, e, split, hit) {
      var pets = world.companionsOf(caster, true);
      for (var i = 0; i < pets.length; i++) if (!pets[i].alive) world.reviveEntity(pets[i], e.hpPct || 0.6);
      hit.effects.push('companionRevive');
    },

    tameCreature: function (world, caster, target, ability, e, split, hit) {
      if (!target || !target.alive || !world.areHostile(caster,target)) return;
      /* Arena has no wild-creature level system yet. The closest authoritative
         target is a hostile companion/summon; maxLevel remains part of the
         source contract for the later creature system. */
      if (!target.isCompanion) { hit.outcome='invalidCreature'; return; }
      var previous=target.ownerId;
      target.ownerId=caster.id; target.team=caster.team; target.targetId=null; target.aiEnabled=true;
      target.tamedMaxLevel=Number(e.maxLevel||60);
      world.bus.emit('CompanionTamed',{entityId:target.id,oldOwnerId:previous,ownerId:caster.id,abilityId:ability.id,maxLevel:target.tamedMaxLevel});
      hit.effects.push('tameCreature');
    },

    possessCompanion: function (world, caster, target, ability, e, split, hit) {
      if (!target || !target.alive || !target.isCompanion || !world.areHostile(caster,target)) return;
      var previous=target.ownerId;
      target.ownerId=caster.id; target.team=caster.team; target.targetId=null; target.aiEnabled=true;
      world.bus.emit('CompanionPossessed',{entityId:target.id,oldOwnerId:previous,ownerId:caster.id,abilityId:ability.id});
      hit.effects.push('possessCompanion');
    },

    revive: function (world, caster, target, ability, e, split, hit) {
      if (target && !target.alive && !target.cremated) {
        var pct=Number(e.hpPct||0);
        if(pct>0) world.reviveEntity(target,pct);
        else {
          world.reviveEntity(target,0.01);
          if(e.hpFlat!==undefined) target.hp=Math.min(target.effectiveHpMax?target.effectiveHpMax():target.hpMax,Math.max(1,Number(e.hpFlat||1)));
        }
        if(e.resurrectionDaze) Status.apply(world,target,{effect:'silence',duration:5,abilityId:ability.id,data:{resurrectionDaze:true}},caster);
        if(Number(e.sanctuarySeconds||0)>0) Status.apply(world,target,{effect:'sanctuary',duration:Number(e.sanctuarySeconds),abilityId:ability.id,data:{}},caster);
        hit.effects.push('revive');
      }
    },

    cremate: function (world, caster, target, ability, e, split, hit) {
      if (target && !target.alive) {
        target.cremated = true;
        world.bus.emit('CorpseCremated', { entityId: target.id, sourceId: caster.id, abilityId: ability.id });
        hit.effects.push('cremate');
      }
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

    /** Ejecución por umbral absoluto de vida, usada por una referencia sourceDerived. */
    execute: function (world, caster, target, ability, e, split, hit) {
      if (!target || !target.alive) return;
      var threshold = Number(e.hpThreshold || 0);
      if (threshold > 0 && target.hp <= threshold) {
        Dmg.kill(world, target, caster, ability.id);
        hit.effects.push('execute');
        hit.outcome = 'execute';
      }
    },

    /** Portal táctico: la simulación reubica aliados cercanos hacia el punto de suelo. */
    teleportAllies: function (world, caster, target, ability, e, split, hit, ctx) {
      var gp = ctx && ctx.groundPoint;
      if (!gp) return;
      var radius = Number(e.radius || 10), limit = Number(e.limit || 25), moved = 0;
      for (var i=0;i<world.entities.length && moved<limit;i++) {
        var ally=world.entities[i];
        if (!ally.alive || world.areHostile(caster,ally)) continue;
        var dx=ally.pos.x-caster.pos.x, dz=ally.pos.z-caster.pos.z;
        if (dx*dx+dz*dz > radius*radius) continue;
        ally.prevPos.x=ally.pos.x; ally.prevPos.y=ally.pos.y; ally.prevPos.z=ally.pos.z;
        ally.pos.x=gp.x + (moved%5)*0.45; ally.pos.z=gp.z + Math.floor(moved/5)*0.45;
        moved++;
      }
      hit.effects.push('portal:'+moved);
      world.bus.emit('PortalUsed',{casterId:caster.id,abilityId:ability.id,count:moved,groundPoint:{x:gp.x,y:gp.y||0,z:gp.z}});
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
