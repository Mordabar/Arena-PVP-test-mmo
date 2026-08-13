/* =============================================================================
 * render/vfx.js — Efectos visuales dirigidos por eventos de simulación.
 *
 * El VFX se suscribe al bus y no consulta el estado del mundo salvo para leer
 * posiciones. Si un efecto no aparece, es que el evento no se emitió: eso
 * convierte cada fallo visual en una pista sobre la simulación.
 *
 * Pool fijo de partículas: el combate genera cientos por segundo y crear
 * objetos por impacto provocaría microtirones de recolección de basura justo
 * en el peor momento posible, el burst.
 * ========================================================================== */
Arena.define('render/vfx', ['render/webglRenderer', 'data/castFamilies'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var M = Arena.Math.Mat4;

  var MAX_PARTICLES = 600;

  var VFX = {
    particles: [],
    _cursor: 0,
    _mat: M.create(),
    enabled: true
  };

  for (var i = 0; i < MAX_PARTICLES; i++) {
    VFX.particles.push({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 1, size: 0.1, endSize: 0.1,
      r: 1, g: 1, b: 1, gravity: -9, drag: 0.9, mesh: 'sphere', style: 'orb', spin: 0
    });
  }

  VFX._spawn = function (cfg) {
    if (!VFX.enabled) return null;
    // Reutilización circular: la partícula más antigua cede su sitio.
    for (var tries = 0; tries < MAX_PARTICLES; tries++) {
      var p = VFX.particles[VFX._cursor];
      VFX._cursor = (VFX._cursor + 1) % MAX_PARTICLES;
      if (p.alive && tries < MAX_PARTICLES - 1) continue;
      p.alive = true;
      p.x = cfg.x; p.y = cfg.y; p.z = cfg.z;
      p.vx = cfg.vx || 0; p.vy = cfg.vy || 0; p.vz = cfg.vz || 0;
      p.life = 0; p.maxLife = cfg.life || 0.5;
      p.size = cfg.size || 0.12;
      p.endSize = cfg.endSize === undefined ? p.size * 0.2 : cfg.endSize;
      p.r = cfg.r; p.g = cfg.g; p.b = cfg.b;
      p.gravity = cfg.gravity === undefined ? -9 : cfg.gravity;
      p.drag = cfg.drag === undefined ? 2.2 : cfg.drag;
      p.mesh = cfg.mesh || 'sphere';
      p.style = cfg.style || 'orb';
      return p;
    }
    return null;
  };

  VFX.burst = function (pos, count, cfg) {
    cfg = cfg || {};
    var speed = cfg.speed || 4.0;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var e = Math.random() * Math.PI * 0.5;
      var s = speed * (0.45 + Math.random() * 0.75);
      VFX._spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * Math.cos(e) * s,
        vy: Math.sin(e) * s * (cfg.up === undefined ? 1 : cfg.up),
        vz: Math.sin(a) * Math.cos(e) * s,
        life: (cfg.life || 0.5) * (0.7 + Math.random() * 0.6),
        size: (cfg.size || 0.12) * (0.7 + Math.random() * 0.7),
        endSize: cfg.endSize,
        r: cfg.r, g: cfg.g, b: cfg.b,
        gravity: cfg.gravity, drag: cfg.drag, mesh: cfg.mesh, style: cfg.style
      });
    }
  };

  /* =========================================================================
   * Suscripción a la simulación
   * ====================================================================== */
  VFX.install = function (world, renderer) {
    VFX.world = world;
    VFX.renderer = renderer;
    var bus = world.bus;

    function posOf(id, high) {
      var e = world.getEntity(id);
      if (!e) return null;
      return { x: e.pos.x, y: e.pos.y + (e.jumpOffset || 0) + (high === undefined ? e.height * 0.55 : high), z: e.pos.z };
    }

    bus.on('DamageApplied', function (p) {
      if (p.applied <= 0 && p.absorbed <= 0) return;
      var pos = posOf(p.targetId);
      if (!pos) return;
      var absorbedOnly = p.applied <= 0.001 && p.absorbed > 0;
      if (absorbedOnly) {
        VFX.burst(pos, 5, { r: 0.55, g: 0.85, b: 1.0, speed: 2.4, life: 0.32, size: 0.09, gravity: -2 });
      } else {
        var big = p.applied > 120;
        VFX.burst(pos, big ? 14 : 7, {
          r: 1.0, g: p.school === 'magical' ? 0.45 : 0.72, b: p.school === 'magical' ? 0.95 : 0.28,
          speed: big ? 5.5 : 3.4, life: 0.42, size: big ? 0.14 : 0.10, style: big ? 'shard' : 'spark'
        });
        /* SACUDIDA POR NIVELES. Que todo tiemble igual es lo mismo que nada
           tiemble: el ataque normal no mueve la cámara, un poder la mueve un
           poco, un golpe grande más, y un crítico es el único que se nota de
           verdad. Un tic periódico nunca sacude: sería un temblor constante. */
        if (renderer && p.targetId === renderer.playerId) {
          renderer.hurtFlash = Math.min(1, renderer.hurtFlash + p.applied / 260);
          if (!p.periodic) {
            renderer.camera.shakeTier(
              p.crit ? 'critical' : (big ? 'heavy' : (p.abilityId ? 'moderate' : 'light')));
          }
        } else if (renderer && p.sourceId === renderer.playerId && !p.periodic) {
          // Golpear se siente menos que recibir: sólo el impacto propio grande
          // o crítico llega a la cámara.
          renderer.camera.shakeTier(p.crit ? 'moderate' : (big ? 'light' : 'none'));
        }
        // La reacción es DIRECCIONAL: se pasa la posición del atacante para
        // que el torso se sacuda hacia donde toca. Un impacto que siempre
        // empuja igual delata que nadie mira de dónde vino el golpe.
        var vis = renderer && renderer.visuals[p.targetId];
        var victim = world.getEntity(p.targetId);
        var attacker = p.sourceId ? world.getEntity(p.sourceId) : null;
        if (vis && victim) {
          Arena.Render.CharacterBackend.current.triggerHurt(
            vis, victim, attacker ? attacker.pos : null);
        }
      }
    });

    bus.on('HealApplied', function (p) {
      if (p.applied <= 0) return;
      var pos = posOf(p.targetId, 0.2);
      if (!pos) return;
      VFX.burst(pos, 8, {
        r: 0.35, g: 1.0, b: 0.55, speed: 1.6, life: 0.85,
        size: 0.09, gravity: 2.2, up: 1.6, drag: 1.2, style: 'wisp'
      });
    });

    bus.on('BarrierApplied', function (p) {
      var pos = posOf(p.targetId, 0.9);
      if (!pos) return;
      VFX.burst(pos, 16, {
        r: 0.5, g: 0.85, b: 1.0, speed: 2.6, life: 0.6, size: 0.08, gravity: 0, drag: 3, style: 'rune'
      });
    });

    /* El comienzo del casteo es un evento de presentación de primer orden: es
       cuando PREPARE tiene que responder. Antes nadie lo escuchaba y el cuerpo
       se enteraba del hechizo sólo al terminarlo, así que los siete tipos de
       conjuro se veían exactamente igual mientras se canalizaban. */
    bus.on('AbilityCastStarted', function (p) {
      var vis = renderer && renderer.visuals[p.casterId];
      var castAb = Arena.Data.abilities[p.abilityId];
      var castVisual = castAb && castAb.combatTiming ? castAb.combatTiming.visualAction : null;
      if (vis) Arena.Render.CharacterBackend.current.beginCast(vis, Arena.Data.castFamilyOf(p.abilityId), castVisual);
      var startPos = posOf(p.casterId, 1.05);
      if (startPos) VFX.burst(startPos, 10, {
        r: 0.55, g: 0.72, b: 1.0, speed: 1.25, life: 0.72,
        size: 0.065, gravity: 0.15, drag: 2.8, style: 'wisp'
      });
    });

    bus.on('AbilityCastInterrupted', function (p) {
      var vis = renderer && renderer.visuals[p.casterId];
      if (vis) Arena.Render.CharacterBackend.current.beginCast(vis, null, null);
    });

    bus.on('AbilityCastCompleted', function (p) {
      var pos = posOf(p.casterId, 1.15);
      if (!pos) return;
      var ab = Arena.Data.abilities[p.abilityId];
      var magic = ab && ab.flags && ab.flags.magic;
      VFX.burst(pos, 9, {
        r: magic ? 0.72 : 1.0, g: magic ? 0.45 : 0.82, b: magic ? 1.0 : 0.42,
        speed: 3.8, life: 0.48, size: 0.11, gravity: -0.4, style: magic ? 'spark' : 'shard'
      });
      var caster = world.getEntity(p.casterId);
      var vis = renderer && renderer.visuals[p.casterId];
      if (vis && caster) {
        // Poder, no ataque normal. La FAMILIA VISUAL del hechizo se deduce en
        // data/castFamilies.js: aquí sólo se transporta la etiqueta, para que la
        // presentación nunca tenga que conocer el catálogo de habilidades.
        var CB = Arena.Render.CharacterBackend.current;
        var ab = Arena.Data.abilities[p.abilityId];
        var visualAction = ab && ab.combatTiming ? ab.combatTiming.visualAction : null;
        /* Utility visualmente pasiva (camuflaje, guardia, interponer...) no
           debe fingir un heavy swing. La habilidad ya conserva sus VFX propios. */
        if (visualAction !== 'none') {
          CB.triggerAttack(vis, CB.archetypeOf(caster.classId), true,
            Arena.Data.castFamilyOf(p.abilityId), visualAction);
        }
      }
    });

    /* El cuerpo empieza el gesto en WINDUP; el proyectil/daño aparece sólo en
       AutoAttackReleased. Así presentación y simulación comparten el mismo
       marker semántico sin que la animación decida el impacto. */
    bus.on('WeaponWindupStarted', function (p) {
      var caster = world.getEntity(p.casterId);
      var vis = renderer && renderer.visuals[p.casterId];
      if (vis && caster) {
        var CBa = Arena.Render.CharacterBackend.current;
        CBa.triggerAttack(vis, CBa.archetypeOf(caster.classId), false);
      }
    });

    bus.on('AutoAttackReleased', function (p) {
      var pos = posOf(p.casterId, 1.05);
      if (!pos) return;
      var caster = world.getEntity(p.casterId);
      var magic = caster && caster.autoAttackSchool === 'magical';
      VFX.burst(pos, magic ? 10 : 5, {
        r: magic ? 0.66 : 1.0, g: magic ? 0.48 : 0.86, b: magic ? 1.0 : 0.52,
        speed: magic ? 2.8 : 1.5, life: 0.34, size: magic ? 0.08 : 0.045,
        gravity: 0, drag: 3.2, style: magic ? 'spark' : 'shard'
      });
    });

    bus.on('AbilityBlocked', function (p) {
      var pos = posOf(p.targetId, 1.0);
      if (!pos) return;
      VFX.burst(pos, 14, { r: 1.0, g: 0.85, b: 0.4, speed: 4.5, life: 0.45, size: 0.11 });
      if (renderer) renderer.camera.shakeTier('moderate');
    });

    bus.on('AbilityReflected', function (p) {
      var pos = posOf(p.targetId, 1.0);
      if (!pos) return;
      VFX.burst(pos, 20, { r: 0.78, g: 0.60, b: 1.0, speed: 5.5, life: 0.55, size: 0.12, gravity: -2, style: 'rune' });
      if (renderer) renderer.camera.shakeTier('heavy');
    });

    bus.on('AbilityNullified', function (p) {
      var pos = posOf(p.targetId, 1.0);
      if (!pos) return;
      var stasis = p.reason === 'stasis';
      VFX.burst(pos, 12, {
        r: stasis ? 0.55 : 1.0, g: stasis ? 0.9 : 0.9, b: stasis ? 1.0 : 0.45,
        speed: 2.4, life: 0.5, size: 0.1, gravity: 0, drag: 3
      });
    });

    bus.on('StatusApplied', function (p) {
      var def = Arena.Data.effects[p.effect];
      if (!def) return;
      var pos = posOf(p.targetId, 1.2);
      if (!pos) return;
      if (def.kind === 'cc') {
        VFX.burst(pos, 12, { r: 1.0, g: 0.4, b: 0.35, speed: 3.2, life: 0.5, size: 0.1, gravity: -3 });
      } else if (def.kind === 'buff') {
        VFX.burst(pos, 8, { r: 0.9, g: 0.95, b: 0.5, speed: 1.8, life: 0.6, size: 0.08, gravity: 1.5, up: 1.4 });
      }
    });

    bus.on('EntityDied', function (p) {
      var pos = posOf(p.entityId, 0.9);
      if (!pos) return;
      VFX.burst(pos, 34, { r: 0.9, g: 0.35, b: 0.25, speed: 6.5, life: 1.0, size: 0.15 });
      if (renderer) renderer.camera.shakeTier('critical');
    });

    bus.on('ProjectileHit', function (p) {
      VFX.burst({ x: p.x, y: p.y, z: p.z }, 8, {
        r: 1.0, g: 0.8, b: 0.5, speed: 3.5, life: 0.35, size: 0.09, style: 'spark'
      });
    });

    bus.on('EntityDashed', function (p) {
      VFX.burst({ x: p.x, y: p.y + 0.2, z: p.z }, 10, {
        r: 0.8, g: 0.85, b: 1.0, speed: 2.2, life: 0.45, size: 0.1, gravity: -1, drag: 3
      });
    });

    bus.on('ZoneTriggered', function (p) {
      VFX.burst({ x: p.x, y: 0.15, z: p.z }, 18, {
        r: 1.0, g: 0.6, b: 0.25, speed: 4.0, life: 0.6, size: 0.11, up: 1.8
      });
    });

    bus.on('Cleansed', function (p) {
      var pos = posOf(p.targetId, 1.0);
      if (!pos) return;
      VFX.burst(pos, 14, {
        r: 1.0, g: 0.95, b: 0.6, speed: 2.6, life: 0.7, size: 0.09, gravity: 2.5, up: 1.5
      });
    });

    bus.on('Purged', function (p) {
      var pos = posOf(p.targetId, 1.0);
      if (!pos) return;
      VFX.burst(pos, 12, { r: 0.85, g: 0.35, b: 0.9, speed: 3.0, life: 0.5, size: 0.1 });
    });
  };

  /* =========================================================================
   * Simulación y dibujo de partículas
   * ====================================================================== */

  VFX.update = function (dt) {
    for (var i = 0; i < MAX_PARTICLES; i++) {
      var p = VFX.particles[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.alive = false; continue; }
      var damp = Math.exp(-p.drag * dt);
      p.vx *= damp; p.vz *= damp;
      p.vy = p.vy * damp + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.25; }
    }
  };

  VFX.render = function (renderer, prog, alpha) {
    var m = VFX._mat;
    for (var i = 0; i < MAX_PARTICLES; i++) {
      var p = VFX.particles[i];
      if (!p.alive) continue;
      var t = p.life / p.maxLife;
      var size = p.size + (p.endSize - p.size) * t;
      var a = (1 - t) * (1 - t);
      M.compose(m, { x: p.x, y: p.y, z: p.z }, 0, { x: size, y: size, z: size });
      renderer._drawMesh(prog, p.mesh, m, {
        color: [p.r, p.g, p.b], alpha: a, mode: 0
      });
    }
  };

  VFX.clear = function () {
    for (var i = 0; i < MAX_PARTICLES; i++) VFX.particles[i].alive = false;
  };

  Arena.Render.VFX = VFX;
});
