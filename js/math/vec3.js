/* =============================================================================
 * math/vec3.js — Vectores 3D mínimos. Convención: Y = arriba, XZ = plano de juego.
 * Los vectores son objetos {x,y,z} planos para que sean triviales de serializar
 * y de leer en el combat log.
 * ========================================================================== */
Arena.define('math/vec3', [], function (Arena) {
  'use strict';

  var V = {};

  V.create = function (x, y, z) { return { x: x || 0, y: y || 0, z: z || 0 }; };
  V.clone = function (a) { return { x: a.x, y: a.y, z: a.z }; };
  V.set = function (out, x, y, z) { out.x = x; out.y = y; out.z = z; return out; };
  V.copy = function (out, a) { out.x = a.x; out.y = a.y; out.z = a.z; return out; };

  V.add = function (out, a, b) { out.x = a.x + b.x; out.y = a.y + b.y; out.z = a.z + b.z; return out; };
  V.sub = function (out, a, b) { out.x = a.x - b.x; out.y = a.y - b.y; out.z = a.z - b.z; return out; };
  V.scale = function (out, a, s) { out.x = a.x * s; out.y = a.y * s; out.z = a.z * s; return out; };
  V.addScaled = function (out, a, b, s) {
    out.x = a.x + b.x * s; out.y = a.y + b.y * s; out.z = a.z + b.z * s; return out;
  };

  V.dot = function (a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; };
  V.cross = function (out, a, b) {
    var x = a.y * b.z - a.z * b.y;
    var y = a.z * b.x - a.x * b.z;
    var z = a.x * b.y - a.y * b.x;
    out.x = x; out.y = y; out.z = z; return out;
  };

  V.lengthSq = function (a) { return a.x * a.x + a.y * a.y + a.z * a.z; };
  V.length = function (a) { return Math.sqrt(V.lengthSq(a)); };

  V.normalize = function (out, a) {
    var l = V.length(a);
    if (l < 1e-9) { out.x = 0; out.y = 0; out.z = 0; return out; }
    out.x = a.x / l; out.y = a.y / l; out.z = a.z / l; return out;
  };

  V.dist = function (a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  /** Distancia proyectada al plano de juego. El rango de habilidades la usa:
   *  una rampa no debe robar alcance ni regalarlo. */
  V.distXZ = function (a, b) {
    var dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  };

  V.distSqXZ = function (a, b) {
    var dx = a.x - b.x, dz = a.z - b.z;
    return dx * dx + dz * dz;
  };

  V.lerp = function (out, a, b, t) {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  };

  /** Yaw en radianes desde a hacia b, en el plano XZ. 0 = +Z. */
  V.yawTo = function (a, b) {
    return Math.atan2(b.x - a.x, b.z - a.z);
  };

  /** Vector unitario a partir de un yaw. */
  V.fromYaw = function (out, yaw) {
    out.x = Math.sin(yaw); out.y = 0; out.z = Math.cos(yaw); return out;
  };

  /** Diferencia angular con signo en [-PI, PI]. */
  V.angleDelta = function (from, to) {
    var d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  /** Envuelve un ángulo a [-PI, PI]. Sin esto, girar sin parar hace crecer el
      yaw sin límite y la precisión de coma flotante se degrada con el tiempo. */
  V.wrapAngle = function (a) {
    a = a % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  Arena.Math.Vec3 = V;
});
