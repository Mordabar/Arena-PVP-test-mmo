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
    this.auras = [];
    this.projectiles = [];
    this.time = 0;
    this.tickCount = 0;

    this.settings = {
      rngEnabled: false,          // §19: RNG desactivado en la fase de game feel
      freeCooldowns: false,
      freeResources: false,
      aiEnabled: true,
      godModePlayer: false,
      showTelegraphs: true,
      expandedPowerPassives: false
    };

    var self = this;
    this.clock = new Arena.Core.FixedTick({
      rate: B.TICK_RATE,
      onTick: function (dt) { self._tick(dt); }
    });

    this._nextZoneId = 1;
    this._nextAuraId = 1;
    this._nextProjId = 1;
    this._nextCompanionId = 1;
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
    if (this.settings.expandedPowerPassives && Arena.Data.powerLibrary && !entity.isCompanion) {
      var pids = Arena.Data.powerLibrary.passiveFor(entity.classId);
      for (var pi = 0; pi < pids.length; pi++) {
        var pab = Arena.Data.abilities[pids[pi]];
        if (pab && pab.selfEffects && pab.selfEffects.length) {
          Resolver._applyEffectList(this, entity, entity, pab, pab.selfEffects, { isSelf: true });
        }
      }
    }
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
   * Auras de la biblioteca de poderes
   * ====================================================================== */

  World.prototype.spawnAura = function (cfg) {
    var a = {
      id: 'a' + (this._nextAuraId++), ownerId: cfg.ownerId, abilityId: cfg.abilityId,
      radius: cfg.radius || 6, affects: cfg.affects || 'alliesAndSelf', effects: cfg.effects || [],
      createdAt: this.time, expiresAt: this.time + (cfg.duration || 30), nextPulseAt: this.time, effectNext: Object.create(null)
    };
    this.auras.push(a);
    this.bus.emit('AuraSpawned', { auraId:a.id, ownerId:a.ownerId, abilityId:a.abilityId, radius:a.radius, expiresAt:a.expiresAt });
    return a;
  };

  World.prototype._tickAuras = function () {
    for (var i=this.auras.length-1;i>=0;i--) {
      var a=this.auras[i], owner=this.getEntity(a.ownerId);
      if (!owner || !owner.alive || this.time >= a.expiresAt) {
        this.auras.splice(i,1); this.bus.emit('AuraRemoved',{auraId:a.id, reason:owner&&owner.alive?'expired':'ownerLost'}); continue;
      }
      if (this.time + 1e-6 < a.nextPulseAt) continue;
      a.nextPulseAt = this.time + 0.25;
      var ability=Arena.Data.abilities[a.abilityId] || {id:a.abilityId};
      for (var j=0;j<this.entities.length;j++) {
        var e=this.entities[j]; if(!e.alive) continue;
        var hostile=this.areHostile(owner,e);
        if(a.affects==='alliesAndSelf' && hostile) continue;
        if(a.affects==='allies' && (hostile || e.id===owner.id)) continue;
        if(a.affects==='enemies' && !hostile) continue;
        if(V.distXZ(owner.pos,e.pos)>a.radius+e.radius) continue;
        // Aura source semantics: status/barrier effects are refreshed while
        // inside and disappear shortly after leaving. Per-second source damage,
        // healing or mana pulses execute exactly once per source interval —
        // never every 0.25 s and never by stacking a full-duration DoT.
        for (var k=0;k<a.effects.length;k++) {
          var fx=a.effects[k], pulse=null, key=e.id+':'+k;
          if(fx.type==='status' || fx.type==='barrier') {
            pulse={}; for(var q in fx) if(Object.prototype.hasOwnProperty.call(fx,q)) pulse[q]=fx[q];
            pulse.duration=Math.min(0.45, fx.duration || 0.45);
          } else {
            var interval=Math.max(0.05, Number(fx.interval||1));
            var due=a.effectNext[key]; if(due===undefined) due=a.createdAt+interval;
            if(this.time+1e-6<due) continue;
            a.effectNext[key]=this.time+interval;
            if(fx.type==='sourceDot') pulse={type:'sourceDamage',min:fx.min,max:fx.max,school:fx.school,element:fx.element,sourceText:fx.sourceText};
            else if(fx.type==='sourceHot') pulse={type:'sourceHeal',min:fx.min,max:fx.max,percentOfMax:fx.percentOfMax,sourceText:fx.sourceText};
            else if(fx.type==='sourceManaDrainDot') pulse={type:'sourceManaDrain',min:fx.min,max:fx.max,percent:fx.percent,transfer:fx.transfer,sourceText:fx.sourceText};
            else if(fx.type==='sourceResourceRestore' || fx.type==='sourceHeal' || fx.type==='sourceDamage' || fx.type==='sourceManaDrain') pulse=fx;
          }
          if(pulse) Resolver._applyEffectList(this, owner, e, ability, [pulse], {isAoE:true});
        }
      }
    }
  };

  /* =========================================================================
   * Compañeros / invocaciones mínimos, autoritativos y reutilizables
   * ====================================================================== */

  World.prototype.spawnCompanion = function (owner, cfg) {
    cfg=cfg||{};
    var angle=owner.yaw + ((cfg.index||0)-0.5)*0.9;
    var x=owner.pos.x-Math.sin(angle)*1.7, z=owner.pos.z-Math.cos(angle)*1.7;
    var sourceKind=(cfg.kind&&cfg.kind!=='summon'&&cfg.kind!=='companion')?String(cfg.kind):'Invocación';
    var c=Arena.Data.makeEntity(owner.classId, {
      id:'comp_'+owner.id+'_'+(this._nextCompanionId++), name:sourceKind,
      team:owner.team, x:x, z:z, yaw:owner.yaw,
      hpMax:Math.max(420,Math.round(owner.hpMax*0.42)), power:Math.max(45,Math.round(owner.power*0.52)),
      armor:Math.round(owner.armorBase*0.65), resist:Math.round(owner.resistBase*0.65),
      aiProfile:'chaser', aiEnabled:true
    });
    c.isCompanion=true; c.ownerId=owner.id; c.summonedByAbility=cfg.abilityId||null;
    c.sourceSummonKind=sourceKind; c.controllable=!!cfg.controllable;
    c.summonExpiresAt=Number(cfg.duration||0)>0 ? this.time+Number(cfg.duration) : Infinity;
    c.abilities=[]; c.passiveId=null; c.autoAttackRange=Math.min(c.autoAttackRange,2.6);
    this.addEntity(c);
    // Source passives from pet/summon disciplines are tagged companionPassive
    // and are applied to the creature at creation, never to its owner.
    if (Arena.Data.powerLibrary) {
      var pp=Arena.Data.powerLibrary.passiveFor(owner.classId);
      for(var pj=0;pj<pp.length;pj++){
        var pa=Arena.Data.abilities[pp[pj]];
        if(pa&&pa.flags&&pa.flags.companionPassive&&pa.companionEffects&&pa.companionEffects.length){
          Resolver._applyEffectList(this,owner,c,pa,pa.companionEffects,{isSelf:true});
        }
      }
    }
    // A summoned creature starts at its EFFECTIVE source maximum after its
    // permanent pet passives have been installed (e.g. Adiestramiento +100%).
    c.hp = c.effectiveHpMax ? c.effectiveHpMax() : c.hp;
    this.bus.emit('CompanionSummoned',{ownerId:owner.id,entityId:c.id,abilityId:cfg.abilityId||null,kind:sourceKind,expiresAt:c.summonExpiresAt});
    return c;
  };

  World.prototype.companionsOf = function (owner, includeDead) {
    var out=[]; for(var i=0;i<this.entities.length;i++){var e=this.entities[i];if(e.isCompanion&&e.ownerId===owner.id&&(includeDead||e.alive))out.push(e);} return out;
  };

  World.prototype.reviveEntity = function (e, hpPct) {
    if(!e || e.alive || e.cremated) return false;
    e.alive=true; e.deadAt=-1; e.hp=Math.max(1,Math.round(e.hpMax*Math.max(.1,Math.min(1,hpPct||.5))));
    e.resource=Math.max(0,Math.round(e.resourceMax*.25)); e.statuses.length=0; e.invalidateMods();
    this.bus.emit('EntityRevived',{entityId:e.id,hp:e.hp}); return true;
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
      maxLife: cfg.maxLife || 3.0,
      autoAttack: !!cfg.autoAttack,
      raw: cfg.raw || 0,
      school: cfg.school || 'physical'
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
        if (p.autoAttack && caster) {
          var aa = Dmg.applyDamage(this, {
            source: caster, target: target, raw: p.raw,
            school: p.school === 'magical' ? 'magical' : 'physical',
            abilityId: 'auto_attack', canCrit: true
          });
          this.bus.emit('AutoAttackImpact', {
            casterId: caster.id, targetId: target.id, projectileId: p.id,
            damage: aa.applied, ranged: true
          });
          if (aa.applied > 0 && Ability._advanceNormalStacks) { Ability._advanceNormalStacks(caster); if(Ability._applySourceOnHitRecovery) Ability._applySourceOnHitRecovery(this,caster,aa.applied); }
          if (Arena.Data.passives && Arena.Data.passives.onAutoAttack) {
            Arena.Data.passives.onAutoAttack(this, caster, target, aa);
          }
        } else {
          var ability = Arena.Data.abilities[p.abilityId];
          if (ability && caster) {
            Resolver.execute(this, caster, ability, {
              targetId: target.id, target: target, fromProjectile: true
            });
          }
        }
      } else {
        V.addScaled(p.pos, p.pos, V.scale(d, d, 1 / dist), step);
      }
    }
  };


  /**
   * Salto visual autoritativo. No permite atravesar colliders: por ahora es
   * movilidad expresiva/game feel, no una mecánica de traversal. La parábola
   * vive aquí para que WebGL2, Three.js y un futuro cliente Unity reciban el
   * mismo estado en vez de inventar arcos distintos en presentación.
   */
  World.prototype._tickJump = function (entity, dt) {
    var req = !!entity._jumpRequested;
    entity._jumpRequested = false;

    if (req && entity.alive && !entity.jumpActive) {
      var m = entity.mods();
      var canStart = m.canMove && (this.time - entity.jumpStartedAt >= B.JUMP.minInterval);
      if (canStart) {
        // Saltar es movimiento aunque la altura no participe aún en LoS/rango.
        // Un casteo estacionario no puede seguir como si el cuerpo siguiera
        // plantado: se cancela sin lockout, igual que al empezar a caminar.
        if ((entity.pendingCast || entity.cast) && !(entity.pendingCast || entity.cast).movable) {
          Ability.cancelCast(this, entity, 'jump');
        }
        if (entity.weaponState && entity.weaponState.phase === 'WINDUP') {
          Ability.cancelWeaponWindup(this, entity, 'jump');
        }
        entity.jumpActive = true;
        entity.jumpElapsed = 0;
        entity.jumpStartedAt = this.time;
        this.bus.emit('EntityJumped', { entityId: entity.id, time: this.time });
      }
    }

    if (!entity.jumpActive) {
      entity.jumpOffset = 0;
      return;
    }

    entity.jumpElapsed += dt;
    var t = Math.max(0, Math.min(1, entity.jumpElapsed / B.JUMP.duration));
    // Parábola 0→1→0. El ápice queda exactamente en mitad del salto.
    entity.jumpOffset = 4 * B.JUMP.height * t * (1 - t);
    if (t >= 1) {
      entity.jumpActive = false;
      entity.jumpOffset = 0;
      this.bus.emit('EntityLanded', { entityId: entity.id, time: this.time });
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
      e.prevJumpOffset = e.jumpOffset || 0;
    }

    // 1. Estados: expiración y periódicos (pueden matar → antes que las acciones)
    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      if (e.alive) Status.tick(this, e, dt);
    }

    // 1.5 Salto: fase autoritativa, independiente de los fps.
    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      if (e.alive) this._tickJump(e, dt);
      else { e.jumpActive = false; e.jumpOffset = 0; e._jumpRequested = false; }
    }

    // 2. IA
    if (this.settings.aiEnabled && Arena.AI.update) {
      for (i = 0; i < this.entities.length; i++) {
        e = this.entities[i];
        if (e.alive && !e.isPlayer && e.aiEnabled) Arena.AI.update(this, e, dt);
      }
    }

    /* 2.5. Las acciones estacionarias reaccionan al INPUT antes de que el
       desplazamiento o el giro modifiquen la transformada. Así movimiento un
       tick antes de RELEASE gana de forma determinista y nunca existe un cast
       que se paga para después descubrir que el cuerpo ya se movió. */
    for (i = 0; i < this.entities.length; i++) {
      e = this.entities[i];
      if (e.alive) Ability.handlePreMovementIntents(this, e, dt);
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
      /* Orientación ABSOLUTA (arrastre de ratón). Es manipulación directa: el
         jugador está agarrando el cuerpo y girándolo, como un volante. Pasarla
         por el límite de TURN_SPEED es lo que hacía que arrastrar se sintiera
         raro —el cuerpo llegaba medio segundo tarde y a veces parecía no girar
         en absoluto—, porque el ratón se movía más rápido de lo que el límite
         permitía y la intención se saturaba durante todo el gesto.
         Sigue aplicándola la SIMULACIÓN, no el renderer, y sigue respetando el
         control: un aturdido no gira ni con ratón ni sin él. */
      /* Ratón en modo STEER: el delta angular de la cámara se aplica 1:1
         al cuerpo y se consume UNA sola vez. No pasa por TURN_SPEED: el mouse
         es un dispositivo posicional, no una tecla mantenida. Esto conserva
         exactamente la velocidad y amplitud de la mano, incluso con 30 Hz de
         simulación y 144 Hz de presentación. */
      if (e.alive && e._mouseTurnDelta) {
        var mm = e.mods();
        if (mm.canMove || mm.canUseAbility) e.yaw = V.wrapAngle(e.yaw + e._mouseTurnDelta);
        e._mouseTurnDelta = 0;
      }
      if (e.alive && e._faceIntent !== null && e._faceIntent !== undefined) {
        var mf = e.mods();
        if (mf.canMove || mf.canUseAbility) e.yaw = V.wrapAngle(e._faceIntent);
      } else if (e.alive && e._turnIntent) {
        // Giro por tecla: sí limitado. A/D son un acelerador, no un volante.
        this.turnEntityBy(e, e._turnIntent, dt);
      }
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
    this._tickAuras(dt);
    // Source summons expire at their literal source duration. Iterate backwards
    // because expiration removes entities from the authoritative array.
    for (i=this.entities.length-1;i>=0;i--) {
      e=this.entities[i];
      if(e&&e.isCompanion&&e.summonExpiresAt!==undefined&&this.time>=e.summonExpiresAt) {
        this.bus.emit('CompanionExpired',{entityId:e.id,ownerId:e.ownerId,abilityId:e.summonedByAbility});
        this.removeEntity(e.id);
      }
    }

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
    var regenPct=e.mods ? (e.mods().resourceRegenPct||0) : 0;
    var rate = res.regen * Math.max(0,1+regenPct) * (outOfCombat ? B.OUT_OF_COMBAT_RESOURCE_MULT : 1);
    if (e.resource < e.resourceMax) {
      e.resource = Math.min(e.resourceMax, e.resource + rate * dt);
    }
    var hpMax = e.effectiveHpMax ? e.effectiveHpMax() : e.hpMax;
    if (outOfCombat && e.hp < hpMax) {
      var regenMod = e.mods ? (1 + (e.mods().healthRegenPct || 0)) : 1;
      e.hp = Math.min(hpMax, e.hp + hpMax * B.OUT_OF_COMBAT_HP_REGEN * Math.max(0, regenMod) * dt);
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
    this.auras.length = 0;
    this.projectiles.length = 0;
    this.bus.emit('WorldReset', { time: this.time });
  };

  Arena.Sim.World = World;
});
