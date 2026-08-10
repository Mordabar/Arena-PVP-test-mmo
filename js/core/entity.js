/* =============================================================================
 * core/entity.js — Estado completo de un combatiente.
 *
 * La entidad es un contenedor de datos con consultas derivadas. NO resuelve
 * combate: eso pertenece a combat/*. Sólo aquí se escriben hp, recurso,
 * cooldowns y estados — el renderer los lee y nunca los toca.
 * ========================================================================== */
Arena.define('core/entity', ['math/vec3', 'data/balance', 'data/effects'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var B = Arena.Data.balance;
  var EFF = Arena.Data.effects;

  var nextId = 1;

  function Entity(cfg) {
    cfg = cfg || {};

    this.id = cfg.id || ('e' + (nextId++));
    this.name = cfg.name || 'Combatiente';
    this.classId = cfg.classId || 'devastador';
    this.team = cfg.team === undefined ? 0 : cfg.team;
    this.isPlayer = !!cfg.isPlayer;
    this.profile = cfg.profile || null;    // perfil de dummy de laboratorio

    /* --- Transformada --------------------------------------------------- */
    this.pos = V.create(cfg.x || 0, cfg.y || 0, cfg.z || 0);
    this.prevPos = V.clone(this.pos);      // para interpolar en el render
    this.yaw = cfg.yaw || 0;
    this.prevYaw = this.yaw;
    this.velocity = V.create(0, 0, 0);
    this.radius = cfg.radius || B.ENTITY_RADIUS;
    this.height = cfg.height || B.ENTITY_HEIGHT;
    this.groundY = 0;

    /* --- Vitales -------------------------------------------------------- */
    this.hpMax = cfg.hpMax || 1000;
    this.hp = cfg.hp === undefined ? this.hpMax : cfg.hp;
    this.resourceType = cfg.resourceType || 'vigor';
    this.resourceMax = cfg.resourceMax || 100;
    this.resource = cfg.resource === undefined ? this.resourceMax : cfg.resource;
    this.alive = true;
    this.deadAt = -1;

    /* --- Defensas base -------------------------------------------------- */
    this.armorBase = cfg.armor === undefined ? B.ARMOR_TIERS.mid : cfg.armor;
    this.resistBase = cfg.resist === undefined ? B.ARMOR_TIERS.mid : cfg.resist;
    this.power = cfg.power === undefined ? 100 : cfg.power;
    this.healPower = cfg.healPower === undefined ? this.power : cfg.healPower;
    this.moveSpeedBase = cfg.moveSpeed || B.MOVE_SPEED_BASE;
    this.autoAttackRange = cfg.autoAttackRange || B.RANGE.melee;
    this.autoAttackCycle = cfg.autoAttackCycle ||
      (cfg.autoAttackRange > 5 ? B.AUTO_ATTACK.rangedCycle : B.AUTO_ATTACK.meleeCycle);
    this.autoAttackSchool = cfg.autoAttackSchool || 'physical';

    /* --- Acción --------------------------------------------------------- */
    this.abilities = (cfg.abilities || []).slice();
    this.passiveId = cfg.passiveId || null;
    this.cooldowns = Object.create(null);   // abilityId -> tiempo en que vuelve
    this.gcdUntil = 0;
    this.gcdStartedAt = 0;
    this.gcdDuration = 0;
    this.cast = null;                       // {abilityId, targetId, start, end, ...}
    this.channel = null;
    this.schoolLockouts = Object.create(null);
    this.queued = null;                     // input en cola: {abilityId, targetId, at}

    /* --- Ataque normal --------------------------------------------------- */
    this.autoAttackOn = false;
    this.autoAttackNextAt = 0;
    this.autoAttackSwingEnd = 0;

    /* --- Estados -------------------------------------------------------- */
    this.statuses = [];
    this._modsDirty = true;
    this._mods = null;
    this.drTracker = Object.create(null);   // categoría -> {stacks, resetAt, immuneUntil}

    /* --- Recursos de clase (Ímpetu, Resonancia…) ------------------------- */
    this.charges = Object.create(null);
    this.chargeMax = Object.create(null);

    /* --- Combate / IA --------------------------------------------------- */
    this.targetId = cfg.targetId || null;
    this.lastCombatAt = -999;
    this.threat = Object.create(null);
    this.godMode = false;
    this.aiEnabled = cfg.aiEnabled !== false;
    this.aiProfile = cfg.aiProfile || null;
    this.aiState = null;

    /* --- Métricas para el árbitro ---------------------------------------- */
    this.stats = {
      damageDealt: 0, damageTaken: 0, healingDone: 0, healingReceived: 0,
      absorbed: 0, ccApplied: 0, ccReceived: 0, ccSecondsReceived: 0,
      abilitiesUsed: 0, kills: 0, deaths: 0, interrupts: 0, overheal: 0
    };
  }

  /* =========================================================================
   * Agregación de modificadores
   *
   * Reglas de acumulación por canal (documento §7):
   *   slowPct .............. el MÁS FUERTE, nunca la suma
   *   armor/resistReduction  suma, tope Arena.Data.balance.CAP.defenseReduction
   *   antiHealPct .......... el MÁS FUERTE, tope CAP.antiHeal
   *   damageDealtPct ....... suma aditiva
   *   damageTakenPct ....... suma aditiva, con suelo y techo
   *   moveSpeedPct ......... suma aditiva
   *   attackSpeedPct ....... suma aditiva
   *   castSpeedPct ......... suma aditiva
   *   resourceCostPct ...... suma aditiva
   * ====================================================================== */
  Entity.prototype.mods = function () {
    if (!this._modsDirty && this._mods) return this._mods;

    var m = {
      slowPct: 0,
      armorReductionPct: 0,
      resistReductionPct: 0,
      antiHealPct: 0,
      damageDealtPct: 0,
      damageTakenPct: 0,
      moveSpeedPct: 0,
      attackSpeedPct: 0,
      castSpeedPct: 0,
      resourceCostPct: 0,
      canMove: true,
      canUseAbility: true,
      canWeaponAttack: true,
      canUseOffensive: true,
      canUseNonDamaging: true,
      canUseDamageAbilities: true,
      isolated: false,
      stealthed: false,
      blocksDirectHits: false,
      reflectsMagic: false,
      ignoresNonDamaging: false,
      blocksIncomingPositive: false,
      immunities: Object.create(null)
    };

    for (var i = 0; i < this.statuses.length; i++) {
      var st = this.statuses[i];
      var d = EFF[st.defId];
      if (!d) continue;
      var data = st.data || {};

      if (d.prevents.move) m.canMove = false;
      if (d.prevents.ability) m.canUseAbility = false;
      if (d.prevents.weaponAttack) m.canWeaponAttack = false;
      if (d.prevents.offensive) m.canUseOffensive = false;
      if (d.prevents.nonDamaging) m.canUseNonDamaging = false;
      if (d.prevents.damageAbilities) m.canUseDamageAbilities = false;
      if (d.isolate) m.isolated = true;
      if (d.stealth) m.stealthed = true;
      if (d.blocksDirectHits) m.blocksDirectHits = true;
      if (d.reflectsMagic) m.reflectsMagic = true;
      if (d.ignoresNonDamaging) m.ignoresNonDamaging = true;
      if (d.blocksIncomingPositive) m.blocksIncomingPositive = true;
      if (d.immuneTo) {
        for (var k = 0; k < d.immuneTo.length; k++) m.immunities[d.immuneTo[k]] = true;
      }

      if (data.slowPct !== undefined) m.slowPct = Math.max(m.slowPct, data.slowPct);
      if (data.antiHealPct !== undefined) m.antiHealPct = Math.max(m.antiHealPct, data.antiHealPct);
      if (data.armorReductionPct !== undefined) m.armorReductionPct += data.armorReductionPct;
      if (data.resistReductionPct !== undefined) m.resistReductionPct += data.resistReductionPct;
      if (data.damageDealtPct !== undefined) m.damageDealtPct += data.damageDealtPct;
      if (data.damageTakenPct !== undefined) m.damageTakenPct += data.damageTakenPct;
      if (data.moveSpeedPct !== undefined) m.moveSpeedPct += data.moveSpeedPct;
      if (data.attackSpeedPct !== undefined) m.attackSpeedPct += data.attackSpeedPct;
      if (data.castSpeedPct !== undefined) m.castSpeedPct += data.castSpeedPct;
      if (data.resourceCostPct !== undefined) m.resourceCostPct += data.resourceCostPct;
    }

    if (m.immunities.slow) m.slowPct = 0;

    m.slowPct = B.clamp(m.slowPct, 0, B.CAP.slow);
    m.armorReductionPct = B.clamp(m.armorReductionPct, 0, B.CAP.defenseReduction);
    m.resistReductionPct = B.clamp(m.resistReductionPct, 0, B.CAP.defenseReduction);
    m.antiHealPct = B.clamp(m.antiHealPct, 0, B.CAP.antiHeal);
    m.damageTakenPct = B.clamp(m.damageTakenPct, -B.CAP.damageReduction, B.CAP.damageAmp - 1);

    this._mods = m;
    this._modsDirty = false;
    return m;
  };

  Entity.prototype.invalidateMods = function () { this._modsDirty = true; };

  /* --- Consultas derivadas ------------------------------------------------ */

  Entity.prototype.armor = function () {
    return Math.max(0, this.armorBase * (1 - this.mods().armorReductionPct));
  };

  Entity.prototype.resist = function () {
    return Math.max(0, this.resistBase * (1 - this.mods().resistReductionPct));
  };

  Entity.prototype.moveSpeed = function () {
    var m = this.mods();
    if (!m.canMove) return 0;
    var s = this.moveSpeedBase * (1 - m.slowPct) * (1 + m.moveSpeedPct);
    return Math.max(0, s);
  };

  Entity.prototype.hpPct = function () { return this.hpMax > 0 ? this.hp / this.hpMax : 0; };
  Entity.prototype.resourcePct = function () {
    return this.resourceMax > 0 ? this.resource / this.resourceMax : 0;
  };

  /** ¿Puede ser objetivo de habilidades? Estasis y muerte lo impiden. */
  Entity.prototype.isTargetable = function () {
    return this.alive && !this.mods().isolated;
  };

  Entity.prototype.isCasting = function () { return this.cast !== null; };

  Entity.prototype.hasStatus = function (defId) {
    for (var i = 0; i < this.statuses.length; i++) {
      if (this.statuses[i].defId === defId) return true;
    }
    return false;
  };

  Entity.prototype.getStatus = function (defId) {
    for (var i = 0; i < this.statuses.length; i++) {
      if (this.statuses[i].defId === defId) return this.statuses[i];
    }
    return null;
  };

  Entity.prototype.getStatuses = function (defId) {
    var out = [];
    for (var i = 0; i < this.statuses.length; i++) {
      if (this.statuses[i].defId === defId) out.push(this.statuses[i]);
    }
    return out;
  };

  /** ¿Está bajo algún control que impida actuar? Lo usan la IA y el HUD. */
  Entity.prototype.isControlled = function () {
    var m = this.mods();
    return !m.canMove || !m.canUseAbility || !m.canWeaponAttack;
  };

  Entity.prototype.totalBarrier = function () {
    var total = 0;
    for (var i = 0; i < this.statuses.length; i++) {
      var st = this.statuses[i];
      if (EFF[st.defId] && EFF[st.defId].absorb) total += st.data.amount || 0;
    }
    return total;
  };

  Entity.prototype.isOnCooldown = function (abilityId, now) {
    var until = this.cooldowns[abilityId];
    return until !== undefined && until > now;
  };

  Entity.prototype.cooldownRemaining = function (abilityId, now) {
    var until = this.cooldowns[abilityId];
    return until === undefined ? 0 : Math.max(0, until - now);
  };

  Entity.prototype.gcdRemaining = function (now) { return Math.max(0, this.gcdUntil - now); };

  Entity.prototype.addCharge = function (key, amount, max) {
    if (this.charges[key] === undefined) this.charges[key] = 0;
    if (max !== undefined) this.chargeMax[key] = max;
    var cap = this.chargeMax[key] === undefined ? 999 : this.chargeMax[key];
    this.charges[key] = Math.min(cap, this.charges[key] + (amount === undefined ? 1 : amount));
    return this.charges[key];
  };

  Entity.prototype.spendCharges = function (key, amount) {
    var have = this.charges[key] || 0;
    if (have < amount) return false;
    this.charges[key] = have - amount;
    return true;
  };

  Entity.prototype.eyePos = function () {
    return { x: this.pos.x, y: this.pos.y + this.height * 0.75, z: this.pos.z };
  };

  Entity.prototype.centerPos = function () {
    return { x: this.pos.x, y: this.pos.y + this.height * 0.55, z: this.pos.z };
  };

  Entity.prototype.reset = function () {
    this.hp = this.hpMax;
    this.resource = this.resourceMax;
    this.alive = true;
    this.deadAt = -1;
    this.statuses.length = 0;
    this.cooldowns = Object.create(null);
    this.schoolLockouts = Object.create(null);
    this.drTracker = Object.create(null);
    this.charges = Object.create(null);
    this.gcdUntil = 0;
    this.gcdDuration = 0;
    this.cast = null;
    this.queued = null;
    this.autoAttackOn = false;
    this.autoAttackNextAt = 0;
    this.autoAttackSwingEnd = 0;
    this.lastCombatAt = -999;
    this.aiState = null;
    this.invalidateMods();
    for (var k in this.stats) if (Object.prototype.hasOwnProperty.call(this.stats, k)) this.stats[k] = 0;
  };

  Arena.Core.Entity = Entity;
});
