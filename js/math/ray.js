/* =============================================================================
 * math/ray.js — Tests de intersección para línea de visión, picking y colisión.
 * Todo el mundo de colisión son AABBs alineados a ejes: suficiente para columnas,
 * muros y rampas, y barato de razonar cuando un bug de LoS aparece en el log.
 * ========================================================================== */
Arena.define('math/ray', ['math/vec3'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var R = {};

  /**
   * Slab test rayo/AABB.
   * @returns {number|null} distancia t del primer impacto dentro de [0, maxT], o null.
   */
  R.rayAABB = function (origin, dir, box, maxT) {
    var tmin = 0;
    var tmax = (maxT === undefined) ? Infinity : maxT;
    var axes = ['x', 'y', 'z'];
    for (var i = 0; i < 3; i++) {
      var a = axes[i];
      var d = dir[a];
      var o = origin[a];
      var lo = box.min[a], hi = box.max[a];
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) return null;
      } else {
        var inv = 1 / d;
        var t1 = (lo - o) * inv;
        var t2 = (hi - o) * inv;
        if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }
    return tmin;
  };

  /**
   * Intersección rayo/cilindro vertical (los personajes son cápsulas verticales
   * simplificadas a cilindros: el picking no necesita más precisión).
   */
  R.rayCylinderY = function (origin, dir, center, radius, height, maxT) {
    var ox = origin.x - center.x;
    var oz = origin.z - center.z;
    var a = dir.x * dir.x + dir.z * dir.z;
    var b = 2 * (ox * dir.x + oz * dir.z);
    var c = ox * ox + oz * oz - radius * radius;

    var t;
    if (Math.abs(a) < 1e-9) {
      if (c > 0) return null;
      t = 0;
    } else {
      var disc = b * b - 4 * a * c;
      if (disc < 0) return null;
      var sq = Math.sqrt(disc);
      var t0 = (-b - sq) / (2 * a);
      var t1 = (-b + sq) / (2 * a);
      t = (t0 >= 0) ? t0 : t1;
      if (t < 0) return null;
    }
    if (maxT !== undefined && t > maxT) return null;

    var y = origin.y + dir.y * t;
    if (y < center.y || y > center.y + height) {
      // Impacto lateral fuera del alto: probar las tapas.
      var capY = (dir.y > 0) ? center.y : center.y + height;
      if (Math.abs(dir.y) < 1e-9) return null;
      var tc = (capY - origin.y) / dir.y;
      if (tc < 0 || (maxT !== undefined && tc > maxT)) return null;
      var px = origin.x + dir.x * tc - center.x;
      var pz = origin.z + dir.z * tc - center.z;
      if (px * px + pz * pz > radius * radius) return null;
      return tc;
    }
    return t;
  };

  /** ¿Está `point` dentro del cono con vértice en `apex`, eje `yaw`, medio-ángulo
   *  `halfAngle` (rad) y alcance `range`? Evaluado en el plano XZ. */
  R.pointInCone = function (apex, yaw, halfAngle, range, point) {
    var dx = point.x - apex.x;
    var dz = point.z - apex.z;
    var distSq = dx * dx + dz * dz;
    if (distSq > range * range) return false;
    if (distSq < 1e-6) return true;
    var toYaw = Math.atan2(dx, dz);
    return Math.abs(V.angleDelta(yaw, toYaw)) <= halfAngle;
  };

  /** Empuja un círculo fuera de un AABB en el plano XZ. Devuelve la posición
   *  corregida; usado por el movimiento para no atravesar muros. */
  R.resolveCircleAABB_XZ = function (pos, radius, box) {
    var cx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
    var cz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
    var dx = pos.x - cx;
    var dz = pos.z - cz;
    var dSq = dx * dx + dz * dz;
    if (dSq >= radius * radius) return false;

    if (dSq > 1e-9) {
      var d = Math.sqrt(dSq);
      var push = radius - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
    } else {
      // Centro dentro del box: expulsar por la cara más cercana.
      var left = pos.x - box.min.x, right = box.max.x - pos.x;
      var back = pos.z - box.min.z, front = box.max.z - pos.z;
      var m = Math.min(left, right, back, front);
      if (m === left) pos.x = box.min.x - radius;
      else if (m === right) pos.x = box.max.x + radius;
      else if (m === back) pos.z = box.min.z - radius;
      else pos.z = box.max.z + radius;
    }
    return true;
  };

  R.makeBox = function (cx, cy, cz, sx, sy, sz) {
    return {
      min: { x: cx - sx / 2, y: cy, z: cz - sz / 2 },
      max: { x: cx + sx / 2, y: cy + sy, z: cz + sz / 2 }
    };
  };

  Arena.Math.Ray = R;
});
