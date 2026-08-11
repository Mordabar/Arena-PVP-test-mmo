/* =============================================================================
 * render/anim/skeleton.js — Contrato de esqueleto y cinemática.
 *
 * ESTE FICHERO ES EL PUENTE HACIA EL FUTURO MODELO REAL.
 *
 * El humanoide procedural no usa una malla skinned, pero SUS TRANSFORMACIONES
 * respetan exactamente los mismos nombres de hueso y sockets que tendrá un rig
 * humanoide exportado de Blender o Tripo. El día que se importe una malla, el
 * animador consumirá esta misma semántica y no habrá que reescribir ni la
 * locomoción ni las acciones de combate.
 *
 * Contiene además la única matemática de cinemática del proyecto:
 * `solveTwoBoneIK`, que sirve igual para una pierna procedural que para una
 * cadena THIGH → CALF → FOOT de un esqueleto importado.
 * ========================================================================== */
Arena.define('render/anim/skeleton', ['math/mat4'], function (Arena) {
  'use strict';

  var M = Arena.Math.Mat4;
  var S = {};

  /* =========================================================================
   * Nombres de hueso. Convención estándar de rig humanoide.
   * ====================================================================== */
  S.BONES = {
    ROOT: 'ROOT',
    PELVIS: 'PELVIS',
    SPINE_01: 'SPINE_01',
    SPINE_02: 'SPINE_02',
    CHEST: 'CHEST',
    NECK: 'NECK',
    HEAD: 'HEAD',

    CLAVICLE_L: 'CLAVICLE_L', UPPER_ARM_L: 'UPPER_ARM_L',
    LOWER_ARM_L: 'LOWER_ARM_L', HAND_L: 'HAND_L',

    CLAVICLE_R: 'CLAVICLE_R', UPPER_ARM_R: 'UPPER_ARM_R',
    LOWER_ARM_R: 'LOWER_ARM_R', HAND_R: 'HAND_R',

    THIGH_L: 'THIGH_L', CALF_L: 'CALF_L', FOOT_L: 'FOOT_L',
    THIGH_R: 'THIGH_R', CALF_R: 'CALF_R', FOOT_R: 'FOOT_R'
  };

  /** Puntos de anclaje. Un arma se engancha a un socket, nunca a un hueso. */
  S.SOCKETS = {
    WEAPON_R: 'SOCKET_WEAPON_R',
    WEAPON_L: 'SOCKET_WEAPON_L',
    SHIELD: 'SOCKET_SHIELD',
    BACK: 'SOCKET_BACK',
    HEAD: 'SOCKET_HEAD',
    PROJECTILE: 'SOCKET_PROJECTILE'
  };

  /** Jerarquía padre→hijo. La misma que tendrá el rig importado. */
  S.HIERARCHY = {
    PELVIS: 'ROOT',
    SPINE_01: 'PELVIS', SPINE_02: 'SPINE_01', CHEST: 'SPINE_02',
    NECK: 'CHEST', HEAD: 'NECK',
    CLAVICLE_L: 'CHEST', UPPER_ARM_L: 'CLAVICLE_L',
    LOWER_ARM_L: 'UPPER_ARM_L', HAND_L: 'LOWER_ARM_L',
    CLAVICLE_R: 'CHEST', UPPER_ARM_R: 'CLAVICLE_R',
    LOWER_ARM_R: 'UPPER_ARM_R', HAND_R: 'LOWER_ARM_R',
    THIGH_L: 'PELVIS', CALF_L: 'THIGH_L', FOOT_L: 'CALF_L',
    THIGH_R: 'PELVIS', CALF_R: 'THIGH_R', FOOT_R: 'CALF_R',
    SOCKET_WEAPON_R: 'HAND_R', SOCKET_WEAPON_L: 'HAND_L',
    SOCKET_SHIELD: 'HAND_L', SOCKET_BACK: 'CHEST',
    SOCKET_HEAD: 'HEAD', SOCKET_PROJECTILE: 'HAND_R'
  };

  /**
   * Pose de esqueleto: nombre de hueso → transformada local.
   * Un backend de malla skinned consume exactamente esta estructura.
   */
  S.createPose = function () {
    var pose = Object.create(null);
    for (var k in S.BONES) {
      if (!Object.prototype.hasOwnProperty.call(S.BONES, k)) continue;
      pose[S.BONES[k]] = { pitch: 0, yaw: 0, roll: 0, x: 0, y: 0, z: 0, scale: 1 };
    }
    return pose;
  };

  S.resetPose = function (pose) {
    for (var k in pose) {
      if (!Object.prototype.hasOwnProperty.call(pose, k)) continue;
      var b = pose[k];
      b.pitch = 0; b.yaw = 0; b.roll = 0; b.x = 0; b.y = 0; b.z = 0; b.scale = 1;
    }
    return pose;
  };

  /* =========================================================================
   * Cinemática inversa de dos huesos
   *
   * Dado el origen de la cadena y un punto objetivo, calcula el ángulo del
   * hueso superior y la flexión de la articulación intermedia para que el
   * extremo alcance el objetivo. Es lo que permite plantar un pie en un punto
   * del suelo y que la pierna se acomode, en vez de calcular ángulos a ciegas
   * y ver el pie patinar.
   *
   * Convención del proyecto: los huesos cuelgan hacia −Y desde su pivote.
   *   pitch = 0 → colgando · pitch > 0 → hacia atrás (−Z)
   * La articulación dobla siempre hacia atrás (rodilla) o hacia delante si se
   * pasa `bendForward` (codo).
   *
   * @param origin  {x,y,z} posición del pivote superior, en espacio local
   * @param target  {x,y,z} punto que debe alcanzar el extremo
   * @param lenA    longitud del hueso superior
   * @param lenB    longitud del hueso inferior
   * @param out     objeto reutilizable {pitch, roll, bend, reach}
   * @returns out — `reach` es 0..1: 1 significa cadena estirada al límite.
   * ====================================================================== */
  S.solveTwoBoneIK = function (origin, target, lenA, lenB, out, bendForward) {
    out = out || {};
    var dx = target.x - origin.x;
    var dy = target.y - origin.y;
    var dz = target.z - origin.z;

    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var maxLen = (lenA + lenB) * 0.999;   // nunca del todo estirada: se ve robótico
    var minLen = Math.abs(lenA - lenB) + 1e-3;
    var clamped = d;
    if (clamped > maxLen) clamped = maxLen;
    if (clamped < minLen) clamped = minLen;

    // Dirección de la cadena expresada como pitch (sagital) y roll (frontal).
    // Ambos se miden desde "colgando hacia abajo".
    var horiz = Math.sqrt(dx * dx + dz * dz);
    var basePitch = Math.atan2(-dz, Math.max(1e-5, -dy));
    var baseRoll = Math.atan2(dx, Math.max(1e-5, -dy));
    if (dy > 0) {
      // Objetivo por encima del pivote: la rama de atan2 se invierte.
      basePitch = Math.atan2(-dz, -dy);
      baseRoll = Math.atan2(dx, -dy);
    }

    // Ley de cosenos.
    var cosKnee = (lenA * lenA + lenB * lenB - clamped * clamped) / (2 * lenA * lenB);
    cosKnee = cosKnee < -1 ? -1 : (cosKnee > 1 ? 1 : cosKnee);
    var interior = Math.acos(cosKnee);            // PI cuando está estirada
    var bend = Math.PI - interior;                // 0 cuando está estirada

    var cosHip = (lenA * lenA + clamped * clamped - lenB * lenB) / (2 * lenA * clamped);
    cosHip = cosHip < -1 ? -1 : (cosHip > 1 ? 1 : cosHip);
    var hipOffset = Math.acos(cosHip);            // 0 cuando está estirada

    // La articulación dobla hacia atrás, así que el hueso superior se adelanta
    // respecto a la línea recta origen→objetivo.
    var sign = bendForward ? -1 : 1;
    out.pitch = basePitch - hipOffset * sign;
    out.roll = baseRoll;
    out.bend = bend * sign;
    out.reach = d / (lenA + lenB);
    out.horiz = horiz;
    return out;
  };

  /* =========================================================================
   * Utilidades de mezcla de poses
   * ====================================================================== */

  /** Interpolación lineal de ángulos con envoltura correcta. */
  S.lerpAngle = function (a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };

  /** Suavizado exponencial independiente del framerate. */
  S.damp = function (current, target, rate, dt) {
    return current + (target - current) * (1 - Math.exp(-rate * dt));
  };

  S.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  S.smooth = function (x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); };

  /** Curva de aceleración/frenado con arranque suave y final firme. */
  S.easeOutCubic = function (x) { x = S.clamp(x, 0, 1); var i = 1 - x; return 1 - i * i * i; };
  S.easeInCubic = function (x) { x = S.clamp(x, 0, 1); return x * x * x; };

  Arena.Render.Skeleton = S;
});
