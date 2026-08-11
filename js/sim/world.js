/* =============================================================================
 * sim/world.js — Estado del mundo y bucle de simulación.
 *
 * Autoridad única sobre entidades, colisión, línea de visión, zonas y
 * proyectiles. El renderer sólo lee. La única forma de cambiar algo aquí es
 * mediante un comando o el resultado de una habilidad.
 * ========================================================================== */
Arena.define('sim/world',
  ['core/entity', 'core/eventBus', 'core/rng', 'core/fixedTick',
   'combat/abilitySystem', 'sim/arena'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var Ray = Arena.Math.Ray;
  var B = Arena.Data.balance;
  var Status = Arena.Combat.StatusSystem;
  var Ability = Arena.Combat.AbilitySystem;
  var Resolver = Arena.Combat.Resolver;
  var Dmg = Arena.Combat.DamageSystem;
  var ArenaGeo = Arena.Sim.Arena;

  function World(opts) {
    opts = opts || {};
    this.bus = new Arena.Core.EventBus({ strict: opts.strictEvents !== false });
    this.rng = new Arena.Core.RNG(opts.seed === undefined ? 12345 : opts.seed);
    this.arena = opts.arena || ArenaGeo.build();

    this.entities = [];
    this._byId = Object.create(null);
    this.zones = [];
    this.projectiles = [];
    this.time = 0;
    this.tickCount = 0;

    this.settings = {
      rngEnabled: false,          // §19: RNG desactivado en la fase de game feel
      freeCooldowns: false,
      freeResources: false,
      aiEnabled: true,
      godModePlayer: false,
      showTelegraphs: true
    };

    var self = this;
    this.clock = new Arena.Core.FixedTick({
      rate: B.TICK_RATE,
      onTick: function (dt) { self._tick(dt); }
    });

    this._nextZoneId = 1;
    this._nextProjId = 1;
    this._scratch = { v: V.create(), v2: V.create() };
  }

  /* =========================================================================
   * Entidades
   * ====================================================================== */

  World.prototype.addEntity = function (entity) {
    this.entities.push(entity);
    this._byId[entity.id] = entity;
    entity.pos.y = this.groundHeightAt(entity.pos.x, entity.pos.z);
    V.copy(entity.prevPos, entity.pos);
    this.bus.emit('EntitySpawned', {
      entityId: entity.id, name: entity.name, classId: entity.classId, team: entity.team
    });
    return entity;
  };

  World.prototype.removeEntity = function (id) {
    var e = this._byId[id];
    if (!e) return false;
    var i = this.entities.indexOf(e);
    if (i >= 0) this.entities.splice(i, 1);
    delete this._byId[id];
    this.bus.emit('EntityRemoved', { entityId: id });
    return true;
  };

  World.prototype.getEntity = function (id) { return id ? (this._byId[id] || null) : null; };

  World.prototype.areHostile = function (a, b) {
    if (!a || !b) return false;
    return a.team !== b.team;
  };

  World.prototype.getPlayer = function () {
    for (var i = 0; i < this.entities.length; i++) if (this.entities[i].isPlayer) return this.entities[i];
    return null;
  };

  World.prototype.enemiesOf = function (e) {
    var out = [];
    for (var i = 0; i < this.entities.length; i++) {
      var o = this.entities[i];
      if (o.alive && this.areHostile(e, o)) out.push(o);
    }
    return out;
  };

  World.prototype.alliesOf = function (e, includeSelf) {
    var out = [];
    for (var i = 0; i < this.entities.length; i++) {
      var o = this.entities[i];
      if (!o.alive) continue;
      if (o.id === e.id) { if (includeSelf) out.push(o); continue; }
      if (!this.areHostile(e, o)) out.push(o);
    }
    return out;
  };

  /* =========================================================================
   * Geometría
   * ====================================================================== */

  World.prototype.groundHeightAt = function (x, z) {
    return ArenaGeo.groundHeightAt(this.arena, x, z);
  };

  /**
   * Línea de visión: raycast contra los obstáculos del escenario.
   * Las entidades NO bloquean LoS — es la convención de MMO con target combat,
   * y evita que un aliado mal colocado anule al equipo entero.
   */
  World.prototype.hasLineOfSight = function (from, to, casterEnt, targetEnt) {
    var dir = V.sub(this._scratch.v, to, from);
    var dist = V.length(dir);
    if (dist < 1e-4) return true;
    V.scale(dir, dir, 1 / dist);

    var obs = this.arena.obstacles;
    for (var i = 0; i < obs.length; i++) {
      var t = Ray.rayAABB(from, dir, obs[i], dist);
      if (t !== null && t < dist - 1e-4) return false;
    }
    return true;
  };

  /**
   * Movimiento con barrido: aplica el desplazamiento, resuelve contra muros y
   * contra otras entidades, y encaja la altura al suelo.
   */
  World.prototype.moveEntityTo = function (entity, dest, opts) {
    opts = opts || {};
    var bounds = this.arena.bounds;
    var r = entity.radius;

    var target = { x: dest.x, y: dest.y || 0, z: dest.z };

    // Un dash no debe atravesar muros (documento: "no atraviesa paredes").
    if (opts.sweep) {
      var from = entity.pos;
      var dir = V.sub(this._scratch.v2, target, from);
      var dist = V.length(dir);
      if (dist > 1e-4) {
        V.scale(dir, dir, 1 / dist);
        var origin = { x: from.x, y: from.y + entity.height * 0.5, z: from.z };
        var nearest = dist;
        var obs = this.arena.obstacles;
        for (var i = 0; i < obs.length; i++) {
          var t = Ray.rayAABB(origin, dir, obs[i], dist);
          if (t !== null && t < nearest) nearest = t;
        }
        if (nearest < dist) {
          var stop = Math.max(0, nearest - r - 0.05);
          target.x = from.x + dir.x * stop;
          target.z = from.z + dir.z * stop;
        }
      }
    }

    target.x = Math.max(bounds.minX + r, Math.min(bounds.maxX - r, target.x));
    target.z = Math.max(bounds.minZ + r, Math.min(bounds.maxZ - r, target.z));

    // Expulsión de obstáculos (dos pasadas: esquinas entre dos cajas)
    var obs2 = this.arena.obstacles;
    for (var pass = 0; pass < 2; pass++) {
      for (var j = 0; j < obs2.length; j++) Ray.resolveCircleAABB_XZ(target, r, obs2[j]);
    }

    // Separación entre personajes: nadie atraviesa a nadie (§5).
    if (!opts.ignoreEntities) {
      for (var k = 0; k < this.entities.length; k++) {
        var o = this.entities[k];
        if (o === entity || !o.alive) continue;
        var dx = target.x - o.pos.x, dz = target.z - o.pos.z;
        var d2 = dx * dx + dz * dz;
        var minD = r + o.radius;
        if (d2 < minD * minD) {
          var d = Math.sqrt(d2);
          if (d < 1e-4) { dx = Math.cos(k * 2.4); dz = Math.sin(k * 2.4); d = 1; }
          var push = (minD - d);
          target.x += (dx / d) * push;
          target.z += (dz / d) * push;
        }
      }
    }

    target.x = Math.max(bounds.minX + r, Math.min(bounds.maxX - r, target.x));
    target.z = Math.max(bounds.minZ + r, Math.min(bounds.maxZ - r, target.z));

    entity.pos.x = target.x;
    entity.pos.z = target.z;
    entity.pos.y = this.groundHeightAt(target.x, target.z);

    if (opts.reason === 'dash') {
      this.bus.emit('EntityDashed', {
        entityId: entity.id, abilityId: opts.abilityId || null,
        x: entity.pos.x, y: entity.pos.y, z: entity.pos.z
      });
    }
    return entity.pos;
  };

  /** Movimiento continuo por intención (WASD o IA). dirX/dirZ en espacio mundo. */
  /**
   * Gira a la entidad a velocidad limitada.
   *
   * @param rate −1..1 — signo y proporción de B.TURN_SPEED. Puede ser un valor
   *        continuo: el arrastre de cámara pide giros parciales, no sólo
   *        "izquierda" o "derecha".
   *
   * Un cuerpo aturdido o derribado no gira; uno enraizado SÍ. Enraizar clava
   * los pies, no el cuello, y poder reorientarse mientras estás anclado es
   * justo lo que hace que la raíz sea un contratiempo y no una muerte segura.
   */
  World.prototype.turnEntityBy = function (entity, rate, dt) {
    if (!rate) return false;
    var m = entity.mods();
    if (!m.canMove && !m.canUseAbility) return false;   // aturdido / derribado / estasis
    var step = B.TURN_SPEED * dt * Math.max(-1, Math.min(1, rate));
    entity.yaw = V.wrapAngle(entity.yaw + step);
    return true;
  };

  /**
   * Gira hacia un yaw objetivo sin pasarse, a velocidad limitada.
   * Devuelve el desfase que queda por cubrir.
   */
  World.prototype.turnEntityToward = function (entity, targetYaw, dt) {
    var delta = V.angleDelta(entity.yaw, targetYaw);
    var maxStep = B.TURN_SPEED * dt;
    if (Math.abs(delta) <= maxStep) {
      var m = entity.mods();
      if (m.canMove || m.canUseAbility) entity.yaw = V.wrapAngle(targetYaw);
      return 0;
    }
    this.turnEntityBy(entity, delta > 0 ? 1 : -1, dt);
    return V.angleDelta(entity.yaw, targetYaw);
  };

  World.prototype.moveEntityBy = function (entity, dirX, dirZ, dt) {
    var speed = entity.moveSpeed();
    if (speed <= 0) return false;
    var len = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (len < 1e-4) return false;
    dirX /= len; dirZ /= len;
    var dest = {
      x: entity.pos.x + dirX * speed * dt,
      z: entity.pos.z + dirZ * speed * dt
    };
    this.moveEntityTo(entity, dest, {});
    return true;
  };

  /* =========================================================================
   * Zonas persistentes (trampas)
   * ====================================================================== */

  World.prototype.spawnZone = function (cfg) {
    var z = {
      id: 'z' + (this._nextZoneId++),
      ownerId: cfg.ownerId,
      abilityId: cfg.abilityId,
      kind: cfg.kind || 'trap',
      x: cfg.x, z: cfg.z,
      radius: cfg.radius || 1.6,
      createdAt: this.time,
      armedAt: this.time + (cfg.armDelay || 0),
      expiresAt: this.time + (cfg.duration || 20),
      triggersLeft: cfg.triggers === undefined ? 1 : cfg.triggers,
      onTrigger: cfg.onTrigger || [],
      lastTriggerAt: -99
    };
    this.zones.push(z);
    this.bus.emit('ZoneSpawned', {
      zoneId: z.id, ownerId: z.ownerId, abilityId: z.abilityId, kind: z.kind,
      x: z.x, z: z.z, radius: z.radius, expiresAt: z.expiresAt, armedAt: z.armedAt
    });
    return z;
  };

  World.prototype._tickZones = function (dt) {
    for (var i = this.zones.length - 1; i >= 0; i--) {
      var z = this.zones[i];
      if (this.time >= z.expiresAt || z.triggersLeft <= 0) {
        this.zones.splice(i, 1);
        this.bus.emit('ZoneRemoved', { zoneId: z.id, reason: z.triggersLeft <= 0 ? 'used' : 'expired' });
        continue;
      }
      if (this.time < z.armedAt) continue;

      var owner = this.getEntity(z.ownerId);
      for (var j = 0; j < this.entities.length && z.triggersLeft > 0; j++) {
        var e = this.entities[j];
        if (!e.alive || !e.isTargetable()) continue;
        if (owner && !this.areHostile(owner, e)) continue;
        if (V.distXZ({ x: z.x, y: 0, z: z.z }, e.pos) > z.radius + e.radius) continue;

        z.triggersLeft--;
        z.lastTriggerAt = this.time;
        this.bus.emit('ZoneTriggered', {
          zoneId: z.id, targetId: e.id, ownerId: z.ownerId, x: z.x, z: z.z
        });
        var ability = Arena.Data.abilities[z.abilityId] || { id: z.abilityId, effects: [] };
        Resolver._applyEffectList(this, owner || e, e, ability, z.onTrigger, { isAoE: false });
      }
    }
  };

  /* =========================================================================
   * Proyectiles
   *
   * Las habilidades marcadas como proyectil resuelven al IMPACTO, no al lanzar.
   * Es lo que da ventana real a Reflejo, Bloqueo y Estasis, y lo que hace que
   * un arquero a 24 u sienta la distancia.
   * ====================================================================== */

  World.prototype.spawnProjectile = function (cfg) {
    var p = {
      id: 'p' + (this._nextProjId++),
      casterId: cfg.casterId,
      targetId: cfg.targetId,
      abilityId: cfg.abilityId,
      pos: V.clone(cfg.from),
      prevPos: V.clone(cfg.from),
      speed: cfg.speed || 34,
      kind: cfg.kind || 'arrow',
      bornAt: this.time,
      maxLife: cfg.maxLife || 3.0
    };
    this.projectiles.push(p);
    this.bus.emit('ProjectileSpawned', {
      projectileId: p.id, casterId: p.casterId, targetId: p.targetId,
      abilityId: p.abilityId, kind: p.kind,
      x: p.pos.x, y: p.pos.y, z: p.pos.z
    });
    return p;
  };

  World.prototype._tickProjectiles = function (dt) {
    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      var p = this.projectiles[i];
      var target = this.getEntity(p.targetId);
      var caster = this.getEntity(p.casterId);

      var dead = (this.time - p.bornAt > p.maxLife) ||
                 !target || !target.alive || !target.isTargetable();
      if (dead) {
        this.projectiles.splice(i, 1);
        this.bus.emit('ProjectileExpired', {
          projectileId: p.id, x: p.pos.x, y: p.pos.y, z: p.pos.z
        });
        continue;
      }

      V.copy(p.prevPos, p.pos);
      var dest = target.centerPos();
      var d = V.sub(V.create(), dest, p.pos);
      var dist = V.length(d);
      var step = p.speed * dt;

      if (dist <= step) {
        V.copy(p.pos, dest);
        this.projectiles.splice(i, 1);
        this.bus.emit('ProjectileHit', {
          projectileId: p.id, casterId: p.casterId, targetId: p.targetId,
          abilityId: p.abilityId, x: p.pos.x, y: p.pos.y, z: p.pos.z
        });
        var ability = Arena.Data.abilities[p.abilityId];
        if (ability && caster) {
          Resolver.resolveHit(this, caster, target, ability, { isAoE: false });
          if (ability.selfEffects && ability.selfEffects.length) {
            Resolver._applyEffectList(this, caster, caster, ability, ability.selfEffects, { isSelf: true });
          }
        }
      } else {
        V.addScaled(p.pos, p.pos, V.scale(d, d, 1 / dist), step);
      }
    }
  };

  /* =========================================================================
   * Bucle
   * ====================================================================== */

  World.prototype._tick = function (dt) {
    this.time = this.clock.time;
    this.tickCount = this.clock.tickCount;
    var i, e;

    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      V.copy(e.prevPos, e.pos);
      e.prevYaw = e.yaw;
    }

    // 1. Estados: expiración y periódicos (pueden matar → antes que las acciones)
    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      if (e.alive) Status.tick(this, e, dt);
    }

    // 2. IA
    if (this.settings.aiEnabled && Arena.AI.update) {
      for (i = 0; i < this.entities.length; i++) {
        e = this.entities[i];
        if (e.alive && !e.isPlayer && e.aiEnabled) Arena.AI.update(this, e, dt);
      }
    }

    /* 3. Intención de GIRO y de movimiento del jugador.
     *
     * Ambas dentro del paso fijo. Si se aplicaran por fotograma, un equipo a
     * 144 fps giraría el doble de rápido que uno a 72 y cancelaría casteos con
     * otra granularidad: las reglas dejarían de ser las mismas para los dos.
     *
     * El GIRO va ANTES que el movimiento y que las habilidades, en ese orden y
     * a propósito: una tecla de avance pulsada el mismo tick debe usar la
     * orientación ya girada, y una habilidad lanzada el mismo tick debe validar
     * su arco frontal contra esa misma orientación. Al revés, girar y atacar en
     * el mismo instante fallaría por un tick de desfase.
     */
    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      if (e.alive && e._turnIntent) this.turnEntityBy(e, e._turnIntent, dt);
    }
    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      if (e.alive && e._moveIntent) {
        this.moveEntityBy(e, e._moveIntent.x, e._moveIntent.z, dt);
      }
    }

    // 4. Casteos, cola de input y ataque normal
    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      if (e.alive) Ability.tick(this, e, dt);
    }

    // 4. Mundo
    this._tickProjectiles(dt);
    this._tickZones(dt);

    // 5. Regeneración y auras pasivas
    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      if (e.alive) this._tickRegen(e, dt);
    }
    if (Arena.Data.passives && Arena.Data.passives.tick) {
      for (i = 0; i < this.entities.length; i++) {
        e = this.entities[i];
        if (e.alive) Arena.Data.passives.tick(this, e, dt);
      }
    }

    this.bus.emit('Tick', { time: this.time, tick: this.tickCount, dt: dt });
  };

  World.prototype._tickRegen = function (e, dt) {
    var res = B.RESOURCE[e.resourceType];
    if (!res) return;
    var outOfCombat = (this.time - e.lastCombatAt) > B.OUT_OF_COMBAT_SECONDS;
    var rate = res.regen * (outOfCombat ? B.OUT_OF_COMBAT_RESOURCE_MULT : 1);
    if (e.resource < e.resourceMax) {
      e.resource = Math.min(e.resourceMax, e.resource + rate * dt);
    }
    if (outOfCombat && e.hp < e.hpMax) {
      e.hp = Math.min(e.hpMax, e.hp + e.hpMax * B.OUT_OF_COMBAT_HP_REGEN * dt);
    }
  };

  /* --- Control externo ---------------------------------------------------- */

  World.prototype.start = function () { this.clock.start(); };
  World.prototype.stop = function () { this.clock.stop(); };
  World.prototype.advance = function (realDelta) { return this.clock.advance(realDelta); };
  World.prototype.step = function (ticks) { this.clock.step(ticks); };
  World.prototype.stepSeconds = function (s) { this.clock.stepSeconds(s); };

  World.prototype.reset = function () {
    for (var i = 0; i < this.entities.length; i++) this.entities[i].reset();
    this.zones.length = 0;
    this.projectiles.length = 0;
    this.bus.emit('WorldReset', { time: this.time });
  };

  Arena.Sim.World = World;
});
