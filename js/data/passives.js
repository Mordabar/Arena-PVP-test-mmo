/* =============================================================================
 * data/passives.js — Las seis pasivas de clase.
 *
 * Una pasiva no debe ser "un +X% invisible": tiene que producir una decisión.
 * Todas las de aquí se materializan en un estado visible en el HUD (cargas o
 * icono de buff) para que el jugador vea cuándo su pasiva está activa.
 *
 * Se conectan mediante ganchos explícitos, no por el event bus: las pasivas son
 * simulación, y la simulación no se escucha a sí misma.
 * ========================================================================== */
Arena.define('data/passives', ['data/abilities', 'combat/statusSystem'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var Status = Arena.Combat.StatusSystem;
  var Heal = Arena.Combat.HealingSystem;

  var IMPETU_MAX = 5;
  var RESONANCIA_MAX = 3;
  var BASTION_RADIUS = 8.0;
  var SHARPSHOOTER_RANGE = 16.0;
  var INSTINCT_RADIUS = 12.0;
  var FLOW_ICD = 3.0;

  var P = {};

  P.info = {
    devastador_impetu: {
      name: 'Ímpetu de batalla',
      desc: 'Los golpes de arma generan Ímpetu. A 5 cargas, la siguiente habilidad ofensiva cuesta un 30 % menos e Impacto sísmico golpea un 15 % más fuerte.'
    },
    guardian_bastion: {
      name: 'Bastión',
      desc: 'Cerca de un aliado recibes un 6 % menos de daño. No se acumula por cantidad de aliados.'
    },
    centinela_distancia: {
      name: 'Distancia ideal',
      desc: '+8 % de daño contra objetivos a más de 16 unidades. Se pierde en cuanto te cierran distancia.'
    },
    rastreador_instinto: {
      name: 'Instinto de caza',
      desc: 'Detecta enemigos ocultos a 12 unidades y ganas un 5 % de velocidad contra objetivos aislados.'
    },
    arcanista_resonancia: {
      name: 'Resonancia arcana',
      desc: 'Cada habilidad ofensiva completada genera Resonancia. A 3 cargas, el siguiente casteo dura un 25 % menos.'
    },
    vinculador_flujo: {
      name: 'Flujo compartido',
      desc: 'Curar a un aliado por debajo del 60 % de vida devuelve maná. Tiene recuperación interna de 3 s.'
    }
  };

  /* =========================================================================
   * Ganchos
   * ====================================================================== */

  P.onAutoAttack = function (world, caster, target, result) {
    if (caster.passiveId === 'devastador_impetu') P._gainImpetu(world, caster);
  };

  P.onAbilityUsed = function (world, caster, ability, report) {
    if (caster.passiveId === 'devastador_impetu') {
      if (ability.flags && ability.flags.weaponAttack) P._gainImpetu(world, caster);
      // El buff ya lo consumió consumeOnCast; aquí se vacía el contador.
      if (ability.flags && ability.flags.offensive && (caster.charges.impetu || 0) >= IMPETU_MAX) {
        caster.charges.impetu = 0;
        world.bus.emit('ChargesChanged', { entityId: caster.id, key: 'impetu', value: 0, max: IMPETU_MAX });
      }
    }

    if (caster.passiveId === 'arcanista_resonancia') {
      if (ability.flags && ability.flags.offensive) {
        if ((caster.charges.resonancia || 0) >= RESONANCIA_MAX) {
          caster.charges.resonancia = 0;
          world.bus.emit('ChargesChanged', {
            entityId: caster.id, key: 'resonancia', value: 0, max: RESONANCIA_MAX
          });
        } else {
          var n = caster.addCharge('resonancia', 1, RESONANCIA_MAX);
          world.bus.emit('ChargesChanged', {
            entityId: caster.id, key: 'resonancia', value: n, max: RESONANCIA_MAX
          });
          if (n >= RESONANCIA_MAX) {
            Status.apply(world, caster, {
              effect: 'castHaste', duration: 12, abilityId: 'arcanista_resonancia',
              data: { castSpeedPct: -0.25, requiresOffensive: false }, ignoreAntiBuff: true
            }, caster);
          }
        }
      }
    }
  };

  P.onHealApplied = function (world, source, target, result) {
    if (!source || source.passiveId !== 'vinculador_flujo') return;
    if (result.applied <= 0 || target.id === source.id) return;
    // El umbral se mide ANTES de curar: si no, curar de 55 % a 80 % no contaría.
    var hpBefore = (target.hp - result.applied) / target.hpMax;
    if (hpBefore >= 0.60) return;
    if (world.time - (source._flowIcdUntil || -99) < 0) return;
    source._flowIcdUntil = world.time + FLOW_ICD;
    Heal.restoreResource(world, source, source.resourceMax * 0.08, 'passive:flujo');
  };

  /* =========================================================================
   * Auras por tick
   * ====================================================================== */

  P.tick = function (world, entity, dt) {
    switch (entity.passiveId) {
      case 'guardian_bastion': P._tickBastion(world, entity); break;
      case 'centinela_distancia': P._tickSharpshooter(world, entity); break;
      case 'rastreador_instinto': P._tickInstinct(world, entity); break;
    }
  };

  P._gainImpetu = function (world, caster) {
    if ((caster.charges.impetu || 0) >= IMPETU_MAX) return;
    var n = caster.addCharge('impetu', 1, IMPETU_MAX);
    world.bus.emit('ChargesChanged', { entityId: caster.id, key: 'impetu', value: n, max: IMPETU_MAX });
    if (n >= IMPETU_MAX) {
      Status.apply(world, caster, {
        effect: 'empowered', duration: 15, abilityId: 'devastador_impetu',
        data: { resourceCostPct: -0.30, requiresOffensive: true }, ignoreAntiBuff: true
      }, caster);
    }
  };

  P._tickBastion = function (world, entity) {
    var allies = world.alliesOf(entity, false);
    var near = false;
    for (var i = 0; i < allies.length; i++) {
      if (V.distXZ(entity.pos, allies[i].pos) <= BASTION_RADIUS) { near = true; break; }
    }
    P._toggleAura(world, entity, near, 'bastion', 'guardian_bastion', { damageTakenPct: -0.06 });
  };

  P._tickSharpshooter = function (world, entity) {
    var target = world.getEntity(entity.targetId);
    var far = !!(target && target.alive && world.areHostile(entity, target) &&
                 V.distXZ(entity.pos, target.pos) > SHARPSHOOTER_RANGE);
    P._toggleAura(world, entity, far, 'sharpshooter', 'centinela_distancia', { damageDealtPct: 0.08 });
  };

  P._tickInstinct = function (world, entity) {
    // Detección de sigilo: revelar a los ocultos cercanos es información, y la
    // información es el rol del Rastreador.
    var enemies = world.enemiesOf(entity);
    var isolated = false;
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.mods().stealthed && V.distXZ(entity.pos, e.pos) <= INSTINCT_RADIUS && !e.hasStatus('revealed')) {
        Status.apply(world, e, {
          effect: 'revealed', duration: 1.0, abilityId: 'rastreador_instinto', data: {}
        }, entity);
        Status.breakStealth(world, e, 'instinct');
      }
    }
    var target = world.getEntity(entity.targetId);
    if (target && target.alive && world.areHostile(entity, target)) {
      var allies = world.alliesOf(target, false);
      isolated = true;
      for (i = 0; i < allies.length; i++) {
        if (V.distXZ(target.pos, allies[i].pos) <= 8.0) { isolated = false; break; }
      }
    }
    P._toggleAura(world, entity, isolated, 'haste', 'rastreador_instinto', { moveSpeedPct: 0.05 });
  };

  /** Mantiene un estado-aura encendido o apagado sin generar ruido de eventos. */
  P._toggleAura = function (world, entity, shouldBeOn, effectId, abilityId, data) {
    var existing = null;
    for (var i = 0; i < entity.statuses.length; i++) {
      var st = entity.statuses[i];
      if (st.defId === effectId && st.abilityId === abilityId) { existing = st; break; }
    }
    if (shouldBeOn) {
      if (existing) {
        existing.endTime = world.time + 1.0;   // se renueva mientras la condición dure
      } else {
        Status.apply(world, entity, {
          effect: effectId, duration: 1.0, abilityId: abilityId, data: data, ignoreAntiBuff: true
        }, entity);
      }
    } else if (existing) {
      Status.removeInstance(world, entity, existing, 'aura-off');
    }
  };

  /** Inicializa contadores para que el HUD tenga algo que mostrar desde el tick 0. */
  P.initEntity = function (entity) {
    if (entity.passiveId === 'devastador_impetu') { entity.charges.impetu = 0; entity.chargeMax.impetu = IMPETU_MAX; }
    if (entity.passiveId === 'arcanista_resonancia') { entity.charges.resonancia = 0; entity.chargeMax.resonancia = RESONANCIA_MAX; }
  };

  P.chargeKeyFor = function (entity) {
    if (entity.passiveId === 'devastador_impetu') return { key: 'impetu', label: 'Ímpetu', max: IMPETU_MAX };
    if (entity.passiveId === 'arcanista_resonancia') return { key: 'resonancia', label: 'Resonancia', max: RESONANCIA_MAX };
    return null;
  };

  Arena.Data.passives = P;
});
