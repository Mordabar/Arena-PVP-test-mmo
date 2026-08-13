/* =============================================================================
 * sim/arena.js — El Foso de Ceniza. Arena de duelo, no decorado.
 *
 * Un mapa de PvP tiene que contestar tres preguntas, y contestarlas con
 * geometría, no con texto de ambientación:
 *
 *   ¿DÓNDE ENTRA EL MELEE?
 *     Por los carriles laterales. Desde cualquiera de los dos spawns hay dos
 *     rutas hacia el centro con cobertura escalonada —columna, ruina, columna—
 *     nunca separadas más de ~5 u. Un Devastador puede acortar 22 u sin comerse
 *     los 22 en campo abierto, que es lo que hace injugable al melee.
 *
 *   ¿DÓNDE KITEA EL RANGO?
 *     Por el anillo exterior. El espacio jugable rodea el foso central entero:
 *     se puede dar la vuelta de 360° sin fondo de saco, con cobertura a la que
 *     agarrarse cada pocos metros. Un Centinela retrocede rompiendo esquina, no
 *     corriendo en línea recta hasta el muro.
 *
 *   ¿DÓNDE ROMPE LoS EL MAGO?
 *     En todas partes. La cobertura media está a poco más de 3 u y el 99 % del
 *     mapa la tiene a menos de 8. Un Arcanista que necesita cortar un casteo
 *     entrante siempre tiene una esquina a un paso, no a media arena.
 *
 * Y una cuarta, propia del modo ladder:
 *
 *   ¿ES JUSTO?
 *     La geometría y los spawns son simétricos a 180°. No «parecidos»: iguales
 *     bajo rotación. Lo comprueban las pruebas de `arenaTests`, porque una
 *     ventaja de dos metros en un duelo es una ventaja de verdad.
 *
 * Zonas (declaradas en `zones`, para que la intención viva en el código):
 *
 *          ‑Z
 *     ┌───────────────────────────────────┐
 *     │  ala ‑           barrera         │
 *     │      □   ▣       ▬▬▬▬      ▣   □ │
 *     │  ◧          ·  FOSO  ·          ◨ │   ◧ spawn A   ◨ spawn B
 *     │      □   ▣       ▬▬▬▬      ▣   □ │   ▣ columna   □ ruina
 *     │  ala +                            │   ▬ barrera central
 *     └───────────────────────────────────┘
 *                     +Z
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

  /** Empuja una pieza y su gemela rotada 180°. Simetría por construcción. */
  function pair(out, cx, cz, sx, sy, sz, kind) {
    out.push(box(cx, 0, cz, sx, sy, sz, kind));
    out.push(box(-cx, 0, -cz, sx, sy, sz, kind));
  }

  function buildDefault() {
    var obstacles = [];
    var t = 1.0;   // grosor de muro

    /* --- Perímetro -------------------------------------------------------- */
    obstacles.push(box(0, 0, -D / 2 - t / 2, W + t * 2, WALL_H, t, 'wall'));
    obstacles.push(box(0, 0, D / 2 + t / 2, W + t * 2, WALL_H, t, 'wall'));
    obstacles.push(box(-W / 2 - t / 2, 0, 0, t, WALL_H, D + t * 2, 'wall'));
    obstacles.push(box(W / 2 + t / 2, 0, 0, t, WALL_H, D + t * 2, 'wall'));

    /* --- Columnas: cobertura alta, cortan LoS de pie ----------------------
       Ninguna se apoya en el eje z=0. El eje que une los dos spawns se deja
       limpio a propósito: el primer beat de un duelo es ver quién tienes
       delante y qué está haciendo. Una columna en medio de esa línea convierte
       la apertura en una ruleta. */
    pair(obstacles, -6.6, -6.4, 1.5, 3.6, 1.5, 'pillar');   // + su gemela (6.6, 6.4)
    pair(obstacles, 6.6, -6.4, 1.5, 3.6, 1.5, 'pillar');    // + su gemela (-6.6, 6.4)
    pair(obstacles, -10.5, -7.4, 1.5, 3.6, 1.5, 'pillar');
    pair(obstacles, 10.5, -7.4, 1.5, 3.6, 1.5, 'pillar');
    pair(obstacles, -16.5, -10.5, 1.5, 3.6, 1.5, 'pillar');
    pair(obstacles, 16.5, -10.5, 1.5, 3.6, 1.5, 'pillar');

    /* --- Barreras del foso ------------------------------------------------
       Cierran el centro por el norte y por el sur sin cerrarlo por los lados.
       Quien pelea en el foso tiene la espalda cubierta y dos salidas; quien
       kitea las rodea. Se quedan por dentro del anillo de 9 u para no partir
       la vuelta completa. */
    pair(obstacles, 0, -7.2, 8.0, 2.8, 0.9, 'wall');

    /* --- Ruinas laterales: la escalera de cobertura del melee -------------
       Escalonadas hacia el centro. Son bajas: cortan la línea de tiro de quien
       está de pie, pero no tapan la cámara ni esconden un personaje entero. */
    pair(obstacles, -14.0, -3.2, 4.6, 1.7, 0.8, 'lowWall');
    pair(obstacles, 14.0, -3.2, 4.6, 1.7, 0.8, 'lowWall');
    pair(obstacles, -19.0, -6.6, 0.8, 2.1, 4.4, 'lowWall');
    pair(obstacles, 19.0, -6.6, 0.8, 2.1, 4.4, 'lowWall');

    /* --- Plataformas elevadas + rampas ------------------------------------
       Rotacionalmente simétricas. Dan altura para leer el foso, y la rampa
       obliga a comprometerse: subir cuesta tiempo y se ve venir. */
    var platforms = [
      { x: -13.0, z: -11.5, sx: 6.0, sz: 5.0, h: 1.5,
        ramp: { x: -13.0, z: -7.5, sx: 6.0, sz: 3.2, from: 0, to: 1.5, axis: 'z', dir: -1 } },
      { x: 13.0, z: 11.5, sx: 6.0, sz: 5.0, h: 1.5,
        ramp: { x: 13.0, z: 7.5, sx: 6.0, sz: 3.2, from: 0, to: 1.5, axis: 'z', dir: 1 } }
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

    /* --- Spawns -----------------------------------------------------------
       Simétricos exactos. 22 u de separación: el rango abre con una ventana
       antes de que el melee llegue, y el melee llega. Ambos miran al rival y
       tienen la espalda despejada, que además es lo que hace legible el primer
       encuadre de cámara. */
    var spawns = {
      player: { x: -11, z: 0, yaw: Math.PI / 2 },
      enemy: { x: 11, z: 0, yaw: -Math.PI / 2 },
      ally: { x: -11, z: 2.2, yaw: Math.PI / 2 },
      roamer: { x: 3, z: -9.5, yaw: 0 },
      team0: [{ x: -11, z: -2.2 }, { x: -11, z: 2.2 }, { x: -13.5, z: 0 }],
      team1: [{ x: 11, z: 2.2 }, { x: 11, z: -2.2 }, { x: 13.5, z: 0 }]
    };

    /* --- Zonas: la intención de diseño, legible desde el código ----------- */
    var zones = [
      { id: 'foso', role: 'melee: choque', x: 0, z: 0, radius: 5.5,
        note: 'Abierto y con las barreras a la espalda. Aquí se decide el duelo cuerpo a cuerpo.' },
      { id: 'carril-norte', role: 'melee: ruta de entrada', x: 0, z: -11.0, radius: 7.0,
        note: 'Cobertura escalonada para acortar sin cruzar el foso en abierto.' },
      { id: 'carril-sur', role: 'melee: ruta de entrada', x: 0, z: 11.0, radius: 7.0,
        note: 'Espejo del carril norte.' },
      { id: 'anillo-oeste', role: 'rango: kiteo', x: -15.5, z: 0, radius: 7.0,
        note: 'Ruinas escalonadas: se retrocede rompiendo esquina, no en línea recta.' },
      { id: 'anillo-este', role: 'rango: kiteo', x: 15.5, z: 0, radius: 7.0,
        note: 'Espejo del anillo oeste.' },
      { id: 'alto-noroeste', role: 'control: altura', x: -13.0, z: -11.5, radius: 3.5,
        note: 'Lee el foso desde arriba. Subir cuesta rampa y se ve venir.' },
      { id: 'alto-sureste', role: 'control: altura', x: 13.0, z: 11.5, radius: 3.5,
        note: 'Espejo del alto noroeste.' }
    ];

    return {
      name: 'El Foso de Ceniza',
      width: W, depth: D, wallHeight: WALL_H,
      bounds: { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 },
      obstacles: obstacles,
      cameraBlockers: cameraBlockers,
      platforms: platforms,
      zones: zones,
      spawns: spawns
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
