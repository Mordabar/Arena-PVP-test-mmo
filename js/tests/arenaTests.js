/* =============================================================================
 * tests/arenaTests.js — La arena como diseño de nivel PvP, comprobado.
 *
 * Un mapa de duelo se puede defender con adjetivos o se puede defender con
 * números. Estas pruebas son el contrato de diseño de El Foso de Ceniza: si
 * alguien mueve una columna y rompe la vuelta al foso, la simetría del ladder o
 * la ruta de entrada del melee, se entera aquí y no tres semanas después.
 *
 * Los umbrales no salen de las medidas: salen de qué hace injugable a cada rol.
 * Demasiado abierto y el melee no llega. Demasiado cerrado y el rango no cierra
 * una rotación. Asimétrico y el ladder deja de ser un ladder.
 * ========================================================================== */
(function () {
  'use strict';
  var T = Arena.Tests;
  var M = Arena.Sim.ArenaMetrics;
  var Geo = Arena.Sim.Arena;

  function arena() { return Geo.build(); }

  T.suite('Arena · justicia del ladder', function () {

    T.test('la geometría es simétrica a 180°', function () {
      var r = M.symmetryReport(arena());
      T.assert(r.symmetric,
        'una ventaja geométrica en un duelo es una ventaja de verdad — sin pareja: ' +
        r.unmatched.slice(0, 4).join(' · '));
    });

    T.test('los dos spawns reciben exactamente lo mismo', function () {
      var A = arena();
      var a = M.spawnReport(A, A.spawns.player);
      var b = M.spawnReport(A, A.spawns.enemy);
      T.assertNear(a.toCenter, b.toCenter, 1e-6, 'misma distancia al centro');
      T.assertNear(a.nearestCover, b.nearestCover, 1e-6, 'misma cobertura a mano');
      T.assertNear(a.backClearance, b.backClearance, 1e-6, 'misma espalda');
      T.assertNear(Math.abs(A.spawns.player.x), Math.abs(A.spawns.enemy.x), 1e-6, 'espejo en X');
      T.assertNear(A.spawns.player.z, -A.spawns.enemy.z, 1e-6, 'espejo en Z');
    });

    T.test('los spawns de equipo también son espejo', function () {
      var A = arena();
      var t0 = A.spawns.team0, t1 = A.spawns.team1;
      T.assertEqual(t0.length, t1.length, 'mismo número de puestos');
      for (var i = 0; i < t0.length; i++) {
        var mirrored = false;
        for (var j = 0; j < t1.length; j++) {
          if (Math.abs(t1[j].x + t0[i].x) < 1e-6 && Math.abs(t1[j].z + t0[i].z) < 1e-6) mirrored = true;
        }
        T.assert(mirrored, 'el puesto (' + t0[i].x + ', ' + t0[i].z + ') tiene su espejo');
      }
    });

    T.test('nadie nace dentro de geometría', function () {
      var A = arena();
      var names = ['player', 'enemy', 'ally', 'roamer'];
      for (var i = 0; i < names.length; i++) {
        var s = A.spawns[names[i]];
        T.assert(M.walkable(A, s.x, s.z, 0.55), 'spawn ' + names[i] + ' libre');
      }
      var groups = [A.spawns.team0, A.spawns.team1];
      for (var g = 0; g < groups.length; g++) {
        for (var k = 0; k < groups[g].length; k++) {
          T.assert(M.walkable(A, groups[g][k].x, groups[g][k].z, 0.55),
            'puesto de equipo ' + g + '#' + k + ' libre');
        }
      }
    });
  });

  T.suite('Arena · apertura del duelo', function () {

    T.test('los dos duelistas se ven al empezar', function () {
      /* El primer beat de un duelo es leer al rival: quién es, qué clase, si
         cierra o abre. Una columna en la línea de spawn convierte esa lectura
         en una ruleta. */
      var A = arena();
      T.assert(M.losBetween(A, A.spawns.player, A.spawns.enemy),
        'el eje que une los spawns está despejado');
    });

    T.test('la separación de salida deja abrir al rango y llegar al melee', function () {
      var A = arena();
      var d = M.dist2(A.spawns.player, A.spawns.enemy);
      T.assertBetween(d, 18, 26,
        'menos y el rango no abre nunca; más y el melee cruza el mapa entero sin poder pegar');
    });

    T.test('el spawn tiene la espalda despejada', function () {
      /* La cámara arranca detrás del personaje a ~8 u. Con un muro a 3 u de la
         espalda, el primer encuadre del jugador es medio muro. */
      var A = arena();
      var r = M.spawnReport(A, A.spawns.player);
      T.assert(r.backClearance >= 9,
        'la cámara de salida cabe detrás del personaje (' + r.backClearance.toFixed(1) + ' u)');
    });
  });

  T.suite('Arena · las tres preguntas del mapa', function () {

    T.test('DÓNDE ROMPE LoS: siempre hay una esquina a un paso', function () {
      var A = arena();
      var c = M.coverageReport(A, 1.0);
      T.assert(c.coverWithin4 >= 0.60,
        'al menos 3 de cada 5 puntos con cobertura a 4 u — ' +
        (c.coverWithin4 * 100).toFixed(1) + ' %');
      T.assert(c.meanCoverDistance <= 4.5,
        'cobertura media a mano — ' + c.meanCoverDistance.toFixed(2) + ' u');
      T.assert(c.maxCoverDistance <= 10,
        'ningún rincón queda a media arena de la cobertura más cercana — ' +
        c.maxCoverDistance.toFixed(2) + ' u');
    });

    T.test('DÓNDE KITEA: se puede rodear el foso entero sin embudo', function () {
      var A = arena();
      for (var r = 5; r <= 9; r += 2) {
        var loop = M.loopAroundCenter(A, r, 1.0);
        T.assert(loop.closed,
          'con disco central r=' + r + ' la vuelta se cierra (hueco mayor ' +
          loop.worstGapDegrees.toFixed(0) + '°)');
      }
    });

    T.test('DÓNDE ENTRA EL MELEE: el foso central está limpio', function () {
      /* Columnas pegadas al foso invitan al «pillar humping»: el rango baila
         alrededor de una columna a distancia de melee y el melee no cobra
         nunca. El choque cuerpo a cuerpo necesita suelo abierto. */
      var A = arena();
      var ring = M.kiteRing(A, 5.0, 180);
      T.assertEqual(ring.walkable, 1,
        'el anillo de 5 u alrededor del centro está entero libre');
      var obs = A.obstacles;
      for (var i = 0; i < obs.length; i++) {
        if (obs[i].kind !== 'pillar') continue;
        var cx = (obs[i].min.x + obs[i].max.x) / 2;
        var cz = (obs[i].min.z + obs[i].max.z) / 2;
        T.assert(Math.sqrt(cx * cx + cz * cz) >= 6.5,
          'ninguna columna dentro del foso — hay una a ' +
          Math.sqrt(cx * cx + cz * cz).toFixed(1) + ' u del centro');
      }
    });

    T.test('el espacio jugable es una sola pieza', function () {
      var c = M.connectivityReport(arena(), 1.0);
      T.assertEqual(c.components, 1,
        'sin bolsas inalcanzables — ' + c.components + ' piezas');
    });

    T.test('ni explanada ni laberinto', function () {
      /* Demasiada visión y es una galería de tiro donde el melee muere andando.
         Demasiado poca y el rango nunca completa una rotación. */
      var l = M.losReport(arena(), 2.0);
      T.assertBetween(l.openRatio, 0.33, 0.60,
        'proporción de pares con visión: ' + (l.openRatio * 100).toFixed(1) + ' %');
      T.assert(l.longRangeOpen >= 0.20,
        'a rango de arquero sigue habiendo tiros que existen — ' +
        (l.longRangeOpen * 100).toFixed(1) + ' %');
    });
  });

  T.suite('Arena · zonas declaradas', function () {

    T.test('cada zona declarada existe de verdad y se puede pisar', function () {
      var A = arena();
      T.assert(A.zones && A.zones.length >= 5, 'el mapa declara sus zonas');
      for (var i = 0; i < A.zones.length; i++) {
        var z = A.zones[i];
        T.assert(z.id && z.role && z.note, 'la zona ' + i + ' se explica a sí misma');
        var free = 0, total = 0;
        for (var a = 0; a < 16; a++) {
          var ang = (a / 16) * Math.PI * 2;
          var x = z.x + Math.cos(ang) * z.radius * 0.6;
          var zz = z.z + Math.sin(ang) * z.radius * 0.6;
          total++;
          if (M.walkable(A, x, zz)) free++;
        }
        T.assert(free / total >= 0.5,
          'la zona ' + z.id + ' es espacio jugable, no un macizo (' + free + '/' + total + ')');
      }
    });

    T.test('las zonas cubren los tres roles', function () {
      var A = arena();
      var roles = A.zones.map(function (z) { return z.role.split(':')[0]; });
      T.assert(roles.indexOf('melee') >= 0, 'hay zona declarada de melee');
      T.assert(roles.indexOf('rango') >= 0, 'hay zona declarada de rango');
      T.assert(roles.indexOf('control') >= 0, 'hay zona declarada de control');
    });
  });

  T.suite('Arena · escenarios del laboratorio', function () {

    T.test('ningún escenario coloca a nadie dentro de una columna', function () {
      /* Esto ya pasó: rediseñar el mapa metió dos maniquíes de la sala de
         counters dentro de columnas nuevas. Como el layout vive en `main.js`
         —que necesita DOM— no había forma de comprobarlo. Ahora es data. */
      var A = arena();
      var ids = Arena.Data.scenarios.ids;
      for (var i = 0; i < ids.length; i++) {
        var scen = Arena.Data.scenarios.get(ids[i]);
        for (var u = 0; u < scen.units.length; u++) {
          var pos = Arena.Data.scenarios.positionOf(scen.units[u], A);
          T.assert(M.walkable(A, pos.x, pos.z, 0.55),
            ids[i] + ' · unidad ' + u + ' en (' + pos.x + ', ' + pos.z + ') está libre');
        }
      }
    });

    T.test('en cada escenario todos caben sin solaparse entre ellos', function () {
      var A = arena();
      var ids = Arena.Data.scenarios.ids;
      for (var i = 0; i < ids.length; i++) {
        var scen = Arena.Data.scenarios.get(ids[i]);
        var pts = [];
        for (var u = 0; u < scen.units.length; u++) {
          pts.push(Arena.Data.scenarios.positionOf(scen.units[u], A));
        }
        pts.push({ x: A.spawns.player.x, z: A.spawns.player.z });
        for (var a = 0; a < pts.length; a++) {
          for (var b = a + 1; b < pts.length; b++) {
            T.assert(M.dist2(pts[a], pts[b]) >= 1.0,
              ids[i] + ': dos unidades a menos de 1 u una de otra');
          }
        }
      }
    });

    T.test('todos los escenarios tienen nombre legible', function () {
      var ids = Arena.Data.scenarios.ids;
      for (var i = 0; i < ids.length; i++) {
        var n = Arena.Data.scenarios.nameOf(ids[i]);
        T.assert(n && n !== ids[i], 'el escenario ' + ids[i] + ' tiene nombre de producto');
      }
    });
  });

})();
