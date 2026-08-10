/* =============================================================================
 * render/picking.js — Selección de objetivo con el ratón.
 *
 * Raycast matemático contra los cilindros de las entidades. No usa buffers de
 * ID ni lecturas de GPU: seleccionar objetivo es una decisión de juego y debe
 * resolverse en la misma simulación que valida el rango, no en el renderer.
 * ========================================================================== */
Arena.define('render/picking', ['math/ray', 'render/camera3d'], function (Arena) {
  'use strict';

  var Ray = Arena.Math.Ray;
  var V = Arena.Math.Vec3;

  var Picking = {};

  /**
   * @returns {Entity|null} la entidad seleccionable más cercana bajo el cursor.
   */
  Picking.entityAt = function (world, camera, ndcX, ndcY, viewer) {
    var r = camera.screenRay(ndcX, ndcY);
    var best = null, bestT = Infinity;

    for (var i = 0; i < world.entities.length; i++) {
      var e = world.entities[i];
      if (!e.alive) continue;
      if (!e.isTargetable()) continue;
      // Un enemigo en sigilo no se puede clicar; un aliado sí.
      if (viewer && world.areHostile(viewer, e) && e.mods().stealthed && !e.hasStatus('revealed')) continue;

      // Cilindro algo más generoso que la cápsula física: seleccionar en
      // movimiento no debe exigir precisión de francotirador.
      var t = Ray.rayCylinderY(r.origin, r.dir,
        { x: e.pos.x, y: e.pos.y, z: e.pos.z },
        e.radius * 1.35, e.height * 1.05, 400);
      if (t !== null && t < bestT) { bestT = t; best = e; }
    }
    return best;
  };

  /** Punto del suelo bajo el cursor, para habilidades de zona. */
  Picking.groundAt = function (world, camera, ndcX, ndcY) {
    var r = camera.screenRay(ndcX, ndcY);
    if (Math.abs(r.dir.y) < 1e-5) return null;

    // Plano y=0 primero; después se corrige con la altura real del terreno.
    var t = -r.origin.y / r.dir.y;
    if (t < 0) return null;
    var pt = {
      x: r.origin.x + r.dir.x * t,
      y: 0,
      z: r.origin.z + r.dir.z * t
    };

    var b = world.arena.bounds;
    if (pt.x < b.minX || pt.x > b.maxX || pt.z < b.minZ || pt.z > b.maxZ) {
      pt.x = Math.max(b.minX, Math.min(b.maxX, pt.x));
      pt.z = Math.max(b.minZ, Math.min(b.maxZ, pt.z));
    }
    pt.y = world.groundHeightAt(pt.x, pt.z);
    return pt;
  };

  /** Coordenadas normalizadas de dispositivo a partir de un evento de ratón. */
  Picking.ndcFromEvent = function (canvas, ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    };
  };

  /**
   * Ciclo de objetivos con Tab: enemigos vivos ordenados por distancia,
   * empezando por el siguiente al actual. Es el comportamiento que un jugador
   * de MMO espera sin tener que pensarlo.
   */
  Picking.cycleTarget = function (world, viewer, currentId, opts) {
    opts = opts || {};
    var pool = [];
    for (var i = 0; i < world.entities.length; i++) {
      var e = world.entities[i];
      if (!e.alive || !e.isTargetable() || e.id === viewer.id) continue;
      var hostile = world.areHostile(viewer, e);
      if (opts.allies ? hostile : !hostile) continue;
      if (hostile && e.mods().stealthed && !e.hasStatus('revealed')) continue;
      if (opts.maxRange && V.distXZ(viewer.pos, e.pos) > opts.maxRange) continue;
      pool.push(e);
    }
    if (!pool.length) return null;

    pool.sort(function (a, b) {
      return V.distSqXZ(viewer.pos, a.pos) - V.distSqXZ(viewer.pos, b.pos);
    });

    var idx = -1;
    for (var j = 0; j < pool.length; j++) if (pool[j].id === currentId) { idx = j; break; }
    return pool[(idx + 1) % pool.length];
  };

  /** Proyecta un punto del mundo a píxeles de pantalla. Lo usa el HUD para
   *  colocar nameplates y texto flotante sobre el canvas. */
  Picking.worldToScreen = function (camera, canvas, point) {
    var out = { x: 0, y: 0, z: 0, w: 1 };
    Arena.Math.Mat4.projectPoint(out, camera.viewProj, point);
    if (out.w <= 0.001) return null;           // detrás de la cámara
    var rect = canvas.getBoundingClientRect();
    return {
      x: (out.x / out.w * 0.5 + 0.5) * rect.width,
      y: (-out.y / out.w * 0.5 + 0.5) * rect.height,
      depth: out.z / out.w
    };
  };

  Arena.Render.Picking = Picking;
});
