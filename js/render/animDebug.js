/* =============================================================================
 * render/animDebug.js — Modo de depuración de animación.
 *
 * Una animación mal montada es indistinguible de una bien montada hasta que
 * puedes VER lo que el controlador cree que está pasando. Este overlay muestra
 * justamente eso y nada más:
 *
 *   · articulaciones del esqueleto        esferas
 *   · objetivo de cada pie                cruz baja en el suelo
 *   · pie ANCLADO (foot lock)             marca en verde intenso
 *   · centro de masa                      esfera ámbar sobre la pelvis
 *   · vector de movimiento                línea cian
 *   · vector de frente                    línea blanca
 *   · dirección al objetivo               línea magenta
 *   · estado de locomoción / acción / CC  texto
 *
 * Todo lo que dibuja sale de LEER el estado de animación. No escribe ni una
 * variable, ni de simulación ni de presentación: si apagas el overlay, el juego
 * se comporta exactamente igual.
 *
 * Se activa con la tecla F3.
 * ========================================================================== */
Arena.define('render/animDebug',
  ['math/mat4', 'render/characterBackend'], function (Arena) {
  'use strict';

  var M = Arena.Math.Mat4;
  var V = Arena.Math.Vec3;

  var D = { enabled: false };

  var COLOR = {
    joint:    [0.30, 0.75, 1.00],
    footFree: [1.00, 0.62, 0.18],
    footLock: [0.25, 1.00, 0.40],
    com:      [1.00, 0.85, 0.25],
    move:     [0.20, 0.95, 1.00],
    forward:  [1.00, 1.00, 1.00],
    target:   [1.00, 0.35, 0.95],
    stride:   [0.55, 0.55, 0.65]
  };

  function push(out, mesh, matrix, color, glow) {
    out.push({
      mesh: mesh, matrix: matrix, castShadow: false,
      mat: {
        color: color,
        emissive: [color[0] * (glow || 2.2), color[1] * (glow || 2.2), color[2] * (glow || 2.2)],
        roughness: 0.4, metallic: 0, alpha: 1, rimPower: 1.0, rimColor: color
      }
    });
  }

  /** Esfera de radio r en un punto del mundo. */
  function marker(out, x, y, z, r, color, glow) {
    var m = M.create();
    M.compose(m, { x: x, y: y, z: z }, 0, { x: r * 2, y: r * 2, z: r * 2 });
    push(out, 'sphere', m, color, glow);
  }

  /**
   * Segmento p0 → p1. `unitBoxY` va de y=0 a y=1, así que basta con orientar su
   * eje +Y hacia la dirección y escalarlo a la longitud.
   */
  function segment(out, p0, p1, w, color) {
    var dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-4) return;
    var horiz = Math.sqrt(dx * dx + dz * dz);
    var yaw = Math.atan2(dx, dz);
    var pitch = Math.atan2(horiz, dy);
    var m = M.create();
    M.composeFull(m, p0, yaw, pitch, 0, { x: w, y: len, z: w });
    push(out, 'unitBoxY', m, color, 2.6);
  }

  /* =========================================================================
   * Geometría de depuración de una entidad
   * ====================================================================== */

  /**
   * @param out    lista de sólidos a la que añadir (la misma del frame)
   * @param handle estado de animación devuelto por el backend
   * @param entity entidad — SÓLO LECTURA
   * @param pos    posición interpolada del frame
   * @param yaw    orientación interpolada del frame
   */
  D.build = function (out, handle, entity, pos, yaw) {
    var dbg = Arena.Render.CharacterBackend.current.debugOf
      ? Arena.Render.CharacterBackend.current.debugOf(handle) : null;
    if (!dbg || !dbg.loco) return out;
    var lc = dbg.loco;
    var cfg = lc.cfg;

    var sy = Math.sin(yaw), cy = Math.cos(yaw);
    var baseY = pos.y;

    /* --- Pies: objetivo y anclaje ---------------------------------------- */
    for (var i = 0; i < lc.legs.length; i++) {
      var leg = lc.legs[i];
      var locked = leg.hasLock && leg.plantWeight > 0.5;
      var col = locked ? COLOR.footLock : COLOR.footFree;
      marker(out, leg.footPos.x, baseY + leg.footPos.y + 0.02, leg.footPos.z, 0.055, col, 3.0);

      // Cruz en el suelo bajo el objetivo: deja ver el deslizamiento de un
      // vistazo. Si un pie anclado se desplaza, la cruz se arrastra.
      segment(out, { x: leg.footPos.x - 0.11, y: baseY + 0.012, z: leg.footPos.z },
                   { x: leg.footPos.x + 0.11, y: baseY + 0.012, z: leg.footPos.z }, 0.014, col);
      segment(out, { x: leg.footPos.x, y: baseY + 0.012, z: leg.footPos.z - 0.11 },
                   { x: leg.footPos.x, y: baseY + 0.012, z: leg.footPos.z + 0.11 }, 0.014, col);

      // Punto de anclaje real, si lo hay: debe coincidir con el objetivo.
      if (leg.hasLock) {
        marker(out, leg.lock.x, baseY + 0.030, leg.lock.z, 0.032, COLOR.footLock, 4.0);
      }
    }

    // Línea entre ambos pies: la zancada, medible a ojo.
    segment(out,
      { x: lc.legs[0].footPos.x, y: baseY + 0.02, z: lc.legs[0].footPos.z },
      { x: lc.legs[1].footPos.x, y: baseY + 0.02, z: lc.legs[1].footPos.z },
      0.010, COLOR.stride);

    /* --- Centro de masa --------------------------------------------------- */
    var comX = pos.x + cy * lc.hipShiftX;
    var comZ = pos.z - sy * lc.hipShiftX;
    var comY = baseY + (0.96 + lc.hipHeight) * 1.0;
    marker(out, comX, comY, comZ, 0.055, COLOR.com, 3.2);
    // Plomada: dónde cae el peso respecto a la base de apoyo.
    segment(out, { x: comX, y: baseY + 0.01, z: comZ }, { x: comX, y: comY, z: comZ },
      0.008, COLOR.com);

    /* --- Vectores --------------------------------------------------------- */
    var hy = baseY + 1.30;
    // Frente del personaje: hacia dónde MIRA.
    segment(out, { x: pos.x, y: hy, z: pos.z },
      { x: pos.x + sy * 1.0, y: hy, z: pos.z + cy * 1.0 }, 0.016, COLOR.forward);

    // Movimiento: hacia dónde SE DESPLAZA. Que ambos difieran es exactamente el
    // caso que la locomoción direccional tiene que resolver bien.
    if (lc.moveSpeed > 0.03) {
      var mvX = lc.moveForward * sy + lc.moveRight * cy;
      var mvZ = lc.moveForward * cy - lc.moveRight * sy;
      var s = 0.4 + lc.moveSpeed * 0.9;
      segment(out, { x: pos.x, y: hy + 0.05, z: pos.z },
        { x: pos.x + mvX * s, y: hy + 0.05, z: pos.z + mvZ * s }, 0.020, COLOR.move);
    }

    // Dirección al objetivo, tal y como la ve el seguimiento de cabeza.
    if (Math.abs(lc.headYaw) > 0.001) {
      var ty = yaw + lc.headYaw;
      segment(out, { x: pos.x, y: hy + 0.42, z: pos.z },
        { x: pos.x + Math.sin(ty) * 0.85, y: hy + 0.42, z: pos.z + Math.cos(ty) * 0.85 },
        0.013, COLOR.target);
    }

    /* --- Articulaciones --------------------------------------------------- */
    // Cadera, pecho y cabeza: suficiente para ver la contrarrotación del torso
    // sin llenar la pantalla de esferas.
    marker(out, comX, baseY + 1.02, comZ, 0.040, COLOR.joint, 2.0);
    var chestYaw = yaw + lc.torsoYaw;
    marker(out, comX + Math.sin(chestYaw) * 0.06, baseY + 1.32,
                comZ + Math.cos(chestYaw) * 0.06, 0.040, COLOR.joint, 2.0);
    marker(out, pos.x, baseY + 1.72, pos.z, 0.034, COLOR.joint, 2.0);

    if (cfg) {
      // Círculo de zancada teórica: si el pie sale de aquí, la config miente.
      var strideR = cfg.strideLength * 0.5;
      segment(out, { x: pos.x - strideR, y: baseY + 0.006, z: pos.z },
                   { x: pos.x + strideR, y: baseY + 0.006, z: pos.z }, 0.006, COLOR.stride);
    }
    return out;
  };

  /* =========================================================================
   * Texto de estado
   * ====================================================================== */
  D.lines = function (handle, entity) {
    var Act = Arena.Render.Actions;
    var dbg = Arena.Render.CharacterBackend.current.debugOf
      ? Arena.Render.CharacterBackend.current.debugOf(handle) : null;
    if (!dbg || !dbg.loco) return [];
    var lc = dbg.loco;

    function n(v) { return (v < 0 ? '' : ' ') + v.toFixed(2); }

    var ccName = 'NONE';
    if (!entity.alive) ccName = 'DEATH';
    else if (dbg.ccBlend > 0.02 && dbg.cc) {
      ccName = entity.hasStatus('stasis') ? 'STASIS'
        : entity.hasStatus('knockdown') ? 'KNOCKDOWN'
        : entity.hasStatus('stun') ? 'STUN'
        : entity.hasStatus('root') ? 'ROOT'
        : entity.hasStatus('silence') ? 'SILENCE'
        : entity.hasStatus('disarm') ? 'DISARM' : 'BLENDING_OUT';
    }

    return [
      'ENTIDAD    ' + entity.id + '  ' + entity.classId,
      'LOCOMOCIÓN ' + lc.state + '  mezcla ' + lc.stateBlend.toFixed(2),
      'VELOCIDAD  ' + n(lc.moveSpeed) + '   fwd' + n(lc.moveForward) + '  right' + n(lc.moveRight),
      'GIRO       ' + n(lc.turnRate) + '   acel' + n(lc.acceleration) + '  frenado' + n(lc.deceleration),
      'CICLO      ' + lc.cycle.toFixed(3) +
        '  L:' + lc.legs[0].phase + (lc.legs[0].hasLock ? '*' : ' ') +
        '  R:' + lc.legs[1].phase + (lc.legs[1].hasLock ? '*' : ' '),
      'CENTRO     shiftX' + n(lc.hipShiftX) + '  altura' + n(lc.hipHeight) +
        '  leanF' + n(lc.leanF) + '  leanR' + n(lc.leanR),
      'ACCIÓN     ' + (Act ? Act.stateName(dbg.action) : '—') +
        '  peso ' + (dbg.action ? dbg.action.weight.toFixed(2) : '0'),
      'REACCIÓN   ' + (dbg.action ? dbg.action.react.amount.toFixed(2) : '0'),
      'CONTROL    ' + ccName + '  mezcla ' + (dbg.ccBlend || 0).toFixed(2)
    ];
  };

  Arena.Render.AnimDebug = D;
});
