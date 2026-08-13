/* =============================================================================
 * ai/dummyAI.js — Dummies de laboratorio y bots de combate.
 *
 * Dos niveles:
 *   · Perfiles de dummy (documento §20): saco de daño, blindado, resistente,
 *     soporte, perseguidor melee y kiteador a distancia.
 *   · Bots de clase: rotación por prioridades + reacciones defensivas, para
 *     probar 1v1 / 2v2 sin otro jugador.
 *
 * La IA usa exactamente la misma API que el jugador (tryUse, moveEntityBy).
 * Si un bot puede hacer algo que el jugador no puede, es un bug de la IA.
 * ========================================================================== */
Arena.define('ai/dummyAI', ['sim/world', 'data/passives'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var B = Arena.Data.balance;
  var Ability = Arena.Combat.AbilitySystem;

  var AI = Arena.AI;

  /* =========================================================================
   * Perfiles de laboratorio
   * ====================================================================== */
  AI.profiles = {
    passive: {
      name: 'Saco de daño', desc: 'No se mueve ni responde. Para medir números en limpio.',
      combat: false, move: 'none'
    },
    armored: {
      name: 'Blindado', desc: 'Armadura muy alta. Prueba la mitigación física y el armorBreak.',
      combat: false, move: 'none', armor: 160, resist: 20
    },
    warded: {
      name: 'Resistente', desc: 'Resistencia mágica muy alta. Prueba el daño mágico.',
      combat: false, move: 'none', armor: 20, resist: 160
    },
    chaser: {
      name: 'Perseguidor melee', desc: 'Cierra distancia y pega sin descanso.',
      combat: true, move: 'chase', desiredRange: 2.0
    },
    kiter: {
      name: 'Kiteador a distancia', desc: 'Mantiene la distancia y castiga acercamientos.',
      combat: true, move: 'kite', desiredRange: 17
    },
    support: {
      name: 'Soporte sanador', desc: 'Cura, limpia y protege a sus aliados mientras conserva una línea segura.',
      combat: true, move: 'kite', desiredRange: 13
    },
    caster: {
      name: 'Caster de control', desc: 'Busca distancia de casteo y convierte ventanas con burst/control.',
      combat: true, move: 'kite', desiredRange: 15
    },
    peel: {
      name: 'Peel defensivo', desc: 'Se mantiene cerca del frente aliado y prioriza protección/interrupción.',
      combat: true, move: 'auto', desiredRange: 4.5
    },
    sparring: {
      name: 'Rival Ladder', desc: 'Perfil completo de duelo: rango por clase, rotación y defensivos reactivos.',
      combat: true, move: 'auto'
    },
    bot: {
      name: 'Bot completo', desc: 'Compatibilidad de laboratorio; usa rango por clase y rotación completa.',
      combat: true, move: 'auto'
    }
  };

  // Distancia de trabajo por clase, medida de borde a borde (los radios se
  // suman aparte). El melee busca contacto real, no "cerca".
  var DESIRED_RANGE = {
    devastador: 1.6, guardian: 1.6, centinela: 17, rastreador: 14,
    arcanista: 15, vinculador: 12
  };

  /* =========================================================================
   * Condiciones de rotación
   * ====================================================================== */
  var C = {
    always: function () { return true; },
    inMelee: function (w, s, t) { return t && V.distXZ(s.pos, t.pos) <= 3.2; },
    targetFar: function (w, s, t) { return t && V.distXZ(s.pos, t.pos) > 4.0; },
    targetCasting: function (w, s, t) { return !!(t && t.cast); },
    targetHasBuff: function (w, s, t) {
      if (!t) return false;
      for (var i = 0; i < t.statuses.length; i++) {
        var d = Arena.Data.effects[t.statuses[i].defId];
        if (d && d.dispel.purge) return true;
      }
      return false;
    },
    targetHealthy: function (w, s, t) { return t && t.hpPct() > 0.35; },
    selfHurt: function (w, s) { return s.hpPct() < 0.55; },
    selfCritical: function (w, s) { return s.hpPct() < 0.35; },
    /**
     * Amenaza real = alguien encima. Deliberadamente NO incluye "me están
     * casteando algo": un ranged que castea sin parar hacía que dos bots se
     * gastaran las estasis mutuamente en bucle y el duelo no terminaba nunca.
     * Interrumpir un casteo es trabajo de `targetCasting`, no de un escape.
     */
    threatened: function (w, s) {
      var en = w.enemiesOf(s);
      for (var i = 0; i < en.length; i++) {
        if (!en[i].isTargetable()) continue;
        if (V.distXZ(s.pos, en[i].pos) < 6.0) return true;
      }
      return false;
    },
    pressured: function (w, s) { return C.threatened(w, s) && s.hpPct() < 0.75; },
    allyNeedsHeal: function (w, s) { return !!pickHealTarget(w, s); },
    allyNeedsCleanse: function (w, s) { return !!pickCleanseTarget(w, s); },
    allyFocused: function (w, s) { return !!pickProtectTarget(w, s); },
    targetNotAntiHealed: function (w, s, t) { return t && !t.hasStatus('antiHeal'); },
    targetIsSupport: function (w, s, t) {
      return t && (t.classId === 'vinculador' || t.classId === 'guardian');
    },
    stealthed: function (w, s) { return s.mods().stealthed; },
    notStealthed: function (w, s) { return !s.mods().stealthed; },
    outOfCombatish: function (w, s) { return (w.time - s.lastCombatAt) > 4.0; }
  };

  /* =========================================================================
   * Rotaciones por clase — prioridad descendente
   * ====================================================================== */
  var ROTATIONS = {
    devastador: [
      { id: 'devastador_embestida', when: 'targetFar' },
      { id: 'devastador_bramido', when: 'targetCasting' },
      { id: 'devastador_golpe_quebrador', when: 'inMelee' },
      { id: 'devastador_furia', when: 'inMelee' },
      { id: 'devastador_impacto_sismico', when: 'inMelee' },
      { id: 'devastador_profanador', when: 'targetHasBuff' }
    ],
    guardian: [
      { id: 'guardian_guardia_absoluta', when: 'selfCritical' },
      { id: 'guardian_proteccion_aliada', when: 'allyNeedsCleanse', target: 'ally' },
      { id: 'guardian_interponer', when: 'allyFocused', target: 'ally' },
      { id: 'guardian_avasallamiento', when: 'targetCasting' },
      { id: 'guardian_egida', when: 'threatened' },
      { id: 'guardian_postura', when: 'selfHurt' },
      { id: 'guardian_avasallamiento', when: 'inMelee' }
    ],
    centinela: [
      { id: 'centinela_retroceso', when: 'threatened' },
      { id: 'centinela_rafaga_disruptiva', when: 'targetCasting' },
      { id: 'centinela_pulso_invernal', when: 'pressured' },
      { id: 'centinela_flecha_perforante', when: 'always' },
      { id: 'centinela_disparo_tensado', when: 'always' },
      { id: 'centinela_lluvia_astillas', when: 'always' }
    ],
    rastreador: [
      { id: 'rastreador_marca_corrosiva', when: 'targetNotAntiHealed' },
      { id: 'rastreador_confusion', when: 'targetIsSupport' },
      { id: 'rastreador_emboscada', when: 'always' },
      { id: 'rastreador_trampa', when: 'targetFar', target: 'ground' },
      { id: 'rastreador_revelar', when: 'always' },
      { id: 'rastreador_camuflaje', when: 'outOfCombatish' }
    ],
    arcanista: [
      { id: 'arcanista_estasis', when: 'pressured' },
      { id: 'arcanista_velo_nulo', when: 'targetIsSupport' },
      { id: 'arcanista_corrupcion', when: 'targetNotAntiHealed' },
      { id: 'arcanista_prision', when: 'threatened' },
      { id: 'arcanista_impacto_celeste', when: 'targetHealthy' },
      { id: 'arcanista_descarga', when: 'always' }
    ],
    vinculador: [
      { id: 'vinculador_purificacion', when: 'allyNeedsCleanse', target: 'ally' },
      { id: 'vinculador_enlace', when: 'allyFocused', target: 'ally' },
      { id: 'vinculador_barrera', when: 'allyNeedsHeal', target: 'ally' },
      { id: 'vinculador_regeneracion', when: 'allyNeedsHeal', target: 'ally' },
      { id: 'vinculador_intervencion', when: 'allyFocused', target: 'ally' },
      { id: 'vinculador_pulso_vital', when: 'allyNeedsHeal', target: 'ally' }
    ]
  };

  /* =========================================================================
   * Selección de objetivos de apoyo
   * ====================================================================== */

  function pickHealTarget(world, self) {
    var pool = world.alliesOf(self, true);
    var best = null, bestPct = 0.85;
    for (var i = 0; i < pool.length; i++) {
      var a = pool[i];
      if (!a.isTargetable()) continue;
      if (a.hpPct() < bestPct) { bestPct = a.hpPct(); best = a; }
    }
    return best;
  }

  function pickCleanseTarget(world, self) {
    var pool = world.alliesOf(self, true);
    for (var i = 0; i < pool.length; i++) {
      var a = pool[i];
      if (!a.isTargetable()) continue;
      for (var j = 0; j < a.statuses.length; j++) {
        var d = Arena.Data.effects[a.statuses[j].defId];
        if (d && d.dispel.cleanse === 'hard') return a;
      }
    }
    return null;
  }

  function pickProtectTarget(world, self) {
    var pool = world.alliesOf(self, false);
    var enemies = world.enemiesOf(self);
    var best = null, bestScore = 0;
    for (var i = 0; i < pool.length; i++) {
      var a = pool[i];
      if (!a.isTargetable()) continue;
      var score = 0;
      for (var j = 0; j < enemies.length; j++) {
        if (enemies[j].targetId === a.id) score += 1;
        if (enemies[j].cast && enemies[j].cast.targetId === a.id) score += 1.5;
      }
      score += (1 - a.hpPct()) * 2;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return bestScore >= 1.5 ? best : null;
  }

  function pickEnemyTarget(world, self) {
    var enemies = world.enemiesOf(self);
    var best = null, bestScore = -Infinity;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.isTargetable()) continue;
      if (e.mods().stealthed && !e.hasStatus('revealed')) continue;
      var dist = V.distXZ(self.pos, e.pos);
      var score = 100 - dist * 2;
      if (e.isPlayer) score += 25;                     // el laboratorio existe para el jugador
      score += (1 - e.hpPct()) * 30;
      if (e.id === self.targetId) score += 12;          // histéresis: no bailar de objetivo
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  /* =========================================================================
   * Actualización
   * ====================================================================== */

  AI.update = function (world, self, dt) {
    if (!self.aiState) {
      self.aiState = {
        nextDecisionAt: 0, strafeDir: (world.rng.next() < 0.5 ? -1 : 1),
        nextStrafeFlipAt: 0, lastAbilityAt: -99
      };
      if (Arena.Data.passives) Arena.Data.passives.initEntity(self);
    }
    var profileId = self.aiProfile || 'passive';
    var profile = AI.profiles[profileId] || AI.profiles.passive;
    var st = self.aiState;

    // Bajo control duro no hay nada que decidir.
    if (self.mods().isolated) return;

    var target = world.getEntity(self.targetId);
    if (!target || !target.alive || !target.isTargetable() ||
        !world.areHostile(self, target) || world.time >= (st.nextRetargetAt || 0)) {
      var picked = pickEnemyTarget(world, self);
      if (picked) self.targetId = picked.id;
      st.nextRetargetAt = world.time + 1.5;
      target = world.getEntity(self.targetId);
    }

    if (!profile.combat) {
      self.autoAttackOn = false;
      return;
    }

    AI._move(world, self, target, profile, dt);

    // Ritmo de decisión humano: un bot que decide cada tick es inhumano y hace
    // imposible leer sus intenciones. 0.18 s ≈ reacción rápida pero legible.
    if (world.time < st.nextDecisionAt) return;
    st.nextDecisionAt = world.time + 0.18;

    self.autoAttackOn = true;
    AI._rotate(world, self, target, profile);
  };

  AI._move = function (world, self, target, profile, dt) {
    if (profile.move === 'none') return;
    if (!self.mods().canMove) return;

    var st = self.aiState;
    var desired = profile.desiredRange !== undefined
      ? profile.desiredRange
      : (DESIRED_RANGE[self.classId] || 6);

    // Un soporte se coloca respecto al aliado en peligro, no respecto al enemigo.
    var anchor = target;
    if (self.classId === 'vinculador' && !target) {
      var ally = pickHealTarget(world, self);
      if (ally) anchor = ally;
    }
    if (!anchor) return;

    var dist = V.distXZ(self.pos, anchor.pos);
    var toX = anchor.pos.x - self.pos.x;
    var toZ = anchor.pos.z - self.pos.z;
    var len = Math.sqrt(toX * toX + toZ * toZ) || 1;
    toX /= len; toZ /= len;

    // El bot no recibe un auto-face privilegiado: gira con el mismo límite
    // temporal que Q/E del jugador. Si aún no terminó de orientar, Ability.canUse
    // fallará por facing y esperará otra ventana de decisión.
    world.turnEntityToward(self, V.yawTo(self.pos, anchor.pos), dt);

    var hasLoS = world.hasLineOfSight(self.eyePos(), anchor.centerPos(), self, anchor);

    // La banda de acercamiento debe medirse contra el alcance REAL, sumando los
    // radios de ambos cuerpos. Con un margen fijo de 1.5 u, un bot melee se
    // quedaba parado a 3.5 u con un alcance efectivo de 3.3 y no pegaba nunca.
    var reach = desired + self.radius + anchor.radius;
    var closeIn = reach + 0.4;
    var backOff = Math.max(1.0, desired - 3.0);

    if (world.time >= st.nextStrafeFlipAt) {
      st.strafeDir *= -1;
      st.nextStrafeFlipAt = world.time + 1.2 + world.rng.next() * 1.6;
    }
    var strafeX = -toZ * st.strafeDir, strafeZ = toX * st.strafeDir;

    var moveX = 0, moveZ = 0;
    if (!hasLoS) {
      // Ir de frente hacia un obstáculo es cómo un bot se queda clavado tras una
      // columna: hay que rodearla, no empujarla.
      moveX = toX * 0.55 + strafeX * 0.85;
      moveZ = toZ * 0.55 + strafeZ * 0.85;
    } else if (dist > closeIn) {
      moveX = toX; moveZ = toZ;
    } else if (dist < backOff && profile.move !== 'chase') {
      moveX = -toX; moveZ = -toZ;
    } else {
      moveX = strafeX; moveZ = strafeZ;
    }

    // No moverse durante un casteo estacionario: cancelarlo sería sabotearse.
    if (self.cast && !self.cast.movable) return;

    world.moveEntityBy(self, moveX, moveZ, dt);
  };

  AI._rotate = function (world, self, target, profile) {
    if (self.cast) return;

    var rotation = ROTATIONS[self.classId] || [];
    for (var i = 0; i < rotation.length; i++) {
      var entry = rotation[i];
      var cond = C[entry.when] || C.always;
      if (!cond(world, self, target)) continue;

      var ctx = AI._contextFor(world, self, target, entry);
      if (!ctx) continue;

      var ability = Arena.Data.abilities[entry.id];
      if (!ability) continue;
      var check = Ability.canUse(world, self, ability, ctx);
      if (!check.ok) continue;

      Ability.tryUse(world, self, entry.id, ctx);
      self.aiState.lastAbilityAt = world.time;
      return;
    }
  };

  AI._contextFor = function (world, self, target, entry) {
    if (entry.target === 'ally') {
      var ally = null;
      if (entry.when === 'allyNeedsCleanse') ally = pickCleanseTarget(world, self);
      else if (entry.when === 'allyFocused') ally = pickProtectTarget(world, self);
      else ally = pickHealTarget(world, self);
      if (!ally) return null;
      var ab = Arena.Data.abilities[entry.id];
      // Habilidades de "sólo aliado" no pueden apuntarse a uno mismo.
      if (ab && ab.target === 'ally' && ally.id === self.id) return null;
      return { targetId: ally.id, target: ally };
    }
    if (entry.target === 'ground') {
      if (!target) return null;
      return { groundPoint: { x: target.pos.x, y: 0, z: target.pos.z } };
    }
    if (!target) return null;
    return { targetId: target.id, target: target };
  };

  AI.applyProfile = function (entity, profileId) {
    var p = AI.profiles[profileId];
    entity.aiProfile = profileId;
    entity.aiState = null;
    if (!p) return;
    if (p.armor !== undefined) entity.armorBase = p.armor;
    if (p.resist !== undefined) entity.resistBase = p.resist;
    if (!p.combat) entity.autoAttackOn = false;
  };
});
