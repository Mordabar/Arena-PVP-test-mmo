/* =============================================================================
 * sim/arena.js — Geometría del escenario de pruebas (documento §20).
 *
 * Sala de ~46 × 34 unidades con suelo, muros perimetrales, columnas, un muro
 * central con hueco y dos plataformas con rampa suave. El objetivo no es que
 * sea bonito: es que cada pieza pruebe una regla concreta.
 *
 *   columnas ......... línea de visión y kiteo
 *   muro central ..... cortar casteos y forzar reposicionamiento
 *   plataformas ...... rango medido en XZ, no en 3D
 *   rampas ........... movimiento continuo sin saltos de altura
 * ========================================================================== */
Arena.define('sim/arena', ['math/ray'], function (Arena) {
  'use strict';

  var Ray = Arena.Math.Ray;

  var W = 46, D = 34, WALL_H = 4.0;

  function box(cx, cy, cz, sx, sy, sz, kind) {
    var b = Ray.makeBox(cx, cy, cz, sx, sy, sz);
    b.kind = kind || 'wall';
    b.center = { x: cx, y: cy, z: cz };
    b.size = { x: sx, y: sy, z: sz };
    return b;
  }

  function buildDefault() {
    var obstacles = [];
    var t = 1.0;   // grosor de muro

    /* Perímetro */
    obstacles.push(box(0, 0, -D / 2 - t / 2, W + t * 2, WALL_H, t, 'wall'));
    obstacles.push(box(0, 0, D / 2 + t / 2, W + t * 2, WALL_H, t, 'wall'));
    obstacles.push(box(-W / 2 - t / 2, 0, 0, t, WALL_H, D + t * 2, 'wall'));
    obstacles.push(box(W / 2 + t / 2, 0, 0, t, WALL_H, D + t * 2, 'wall'));

    /* Columnas: cortan LoS sin cerrar el espacio */
    var cols = [
      [-9, -6], [9, -6], [-9, 6], [9, 6],
      [-4.5, 0], [4.5, 0],
      /* Segundo anillo de cobertura. El mapa crece, pero no se convierte en
         una explanada vacía: estos árboles/columnas mantienen rutas de kiteo
         y cortes de LoS en los laterales nuevos. */
      [-16, -10], [16, -10], [-16, 10], [16, 10]
    ];
    for (var i = 0; i < cols.length; i++) {
      obstacles.push(box(cols[i][0], 0, cols[i][1], 1.5, 3.6, 1.5, 'pillar'));
    }

    /* Muro central partido: obliga a rodear o a jugar por el hueco */
    obstacles.push(box(0, 0, -8.2, 7.0, 2.8, 0.9, 'wall'));
    obstacles.push(box(0, 0, 8.2, 7.0, 2.8, 0.9, 'wall'));

    /* Muros bajos: bloquean LoS a ras de suelo pero no la vista de cámara */
    obstacles.push(box(-13.5, 0, 0, 0.8, 1.6, 5.0, 'lowWall'));
    obstacles.push(box(13.5, 0, 0, 0.8, 1.6, 5.0, 'lowWall'));

    /* Alas exteriores: ruinas cortas que crean una segunda ruta alrededor del
       centro. Se mantienen lejos de los spawns originales para no alterar los
       tests de duelo/balance. */
    obstacles.push(box(-18.5, 0, -4.8, 5.0, 2.1, 0.8, 'lowWall'));
    obstacles.push(box(-18.5, 0,  4.8, 5.0, 2.1, 0.8, 'lowWall'));
    obstacles.push(box( 18.5, 0, -4.8, 5.0, 2.1, 0.8, 'lowWall'));
    obstacles.push(box( 18.5, 0,  4.8, 5.0, 2.1, 0.8, 'lowWall'));

    /* Plataformas elevadas + rampas */
    var platforms = [
      { x: -12.5, z: -9.0, sx: 6.0, sz: 5.0, h: 1.5,
        ramp: { x: -12.5, z: -5.0, sx: 6.0, sz: 3.2, from: 0, to: 1.5, axis: 'z', dir: -1 } },
      { x: 12.5, z: 9.0, sx: 6.0, sz: 5.0, h: 1.5,
        ramp: { x: 12.5, z: 5.0, sx: 6.0, sz: 3.2, from: 0, to: 1.5, axis: 'z', dir: 1 } }
    ];

    /* Las plataformas NO son obstáculos: se camina sobre ellas y no cortan la
       línea de visión de quien está encima. Pero sí son geometría sólida para
       la cámara, que si no las mira desde dentro y enseña su parte de abajo.
       De ahí una lista aparte en vez de meterlas en `obstacles`, que rompería
       tanto el movimiento como el LoS. */
    var cameraBlockers = obstacles.slice();
    for (var p = 0; p < platforms.length; p++) {
      var pf = platforms[p];
      // `box` toma la base en Y, no el centro: la plataforma va de 0 a su altura.
      cameraBlockers.push(box(pf.x, 0, pf.z, pf.sx, pf.h, pf.sz, 'platform'));
    }

    return {
      width: W, depth: D, wallHeight: WALL_H,
      bounds: { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 },
      obstacles: obstacles,
      cameraBlockers: cameraBlockers,
      platforms: platforms,
      spawns: {
        player: { x: -10, z: 0, yaw: Math.PI / 2 },
        enemy: { x: 8, z: 0, yaw: -Math.PI / 2 },
        ally: { x: -10, z: 4, yaw: Math.PI / 2 },
        roamer: { x: 4, z: -7, yaw: 0 },
        team0: [{ x: -11, z: -2 }, { x: -11, z: 2 }, { x: -13, z: 0 }],
        team1: [{ x: 11, z: 2 }, { x: 11, z: -2 }, { x: 13, z: 0 }]
      }
    };
  }

  /** Altura del suelo en un punto: 0, una plataforma, o la pendiente de su rampa. */
  function groundHeightAt(arena, x, z) {
    var best = 0;
    for (var i = 0; i < arena.platforms.length; i++) {
      var p = arena.platforms[i];
      if (Math.abs(x - p.x) <= p.sx / 2 && Math.abs(z - p.z) <= p.sz / 2) {
        if (p.h > best) best = p.h;
      }
      var r = p.ramp;
      if (r && Math.abs(x - r.x) <= r.sx / 2 && Math.abs(z - r.z) <= r.sz / 2) {
        var t = (z - (r.z - r.sz / 2)) / r.sz;         // 0..1 a lo largo de la rampa
        if (r.dir < 0) t = 1 - t;
        var h = r.from + (r.to - r.from) * Math.max(0, Math.min(1, t));
        if (h > best) best = h;
      }
    }
    return best;
  }

  Arena.Sim.Arena = {
    build: buildDefault,
    groundHeightAt: groundHeightAt,
    box: box
  };
});
