/* =============================================================================
 * sim/arenaMetrics.js — La arena medida como espacio de PvP.
 *
 * Un mapa de duelo se puede discutir con adjetivos («tiene cobertura», «se
 * siente abierto») o se puede medir. Esto mide, y lo hace con la MISMA
 * geometría y el MISMO raycast que usa el combate, para que no exista una
 * segunda verdad sobre dónde hay una pared.
 *
 * No decide nada del combate: sólo lee `arena` y devuelve números. Se usa desde
 * las pruebas de diseño de nivel y desde `tools/arena-analysis.js`.
 *
 * Las tres preguntas que un mapa de duelo tiene que responder:
 *   · dónde entra el melee ......... rutas con cobertura para acortar distancia
 *   · dónde kitea el rango ......... anillos transitables sin callejones
 *   · dónde rompe LoS el mago ...... cobertura alcanzable desde cualquier punto
 * ========================================================================== */
Arena.define('sim/arenaMetrics', ['sim/arena', 'math/ray'], function (Arena) {
  'use strict';

  var Ray = Arena.Math.Ray;
  var Geo = Arena.Sim.Arena;

  var EYE = 1.55;          // altura de ojo de un personaje de pie
  var CHEST = 1.05;        // altura de pecho, el punto al que se apunta

  function dist2(a, b) {
    var dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** LoS entre dos puntos del suelo, a la altura a la que se dispara. */
  function losBetween(arena, a, b) {
    var from = { x: a.x, y: (a.y || 0) + EYE, z: a.z };
    var to = { x: b.x, y: (b.y || 0) + CHEST, z: b.z };
    var dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-4) return true;
    var dir = { x: dx / d, y: dy / d, z: dz / d };
    var obs = arena.obstacles;
    for (var i = 0; i < obs.length; i++) {
      var t = Ray.rayAABB(from, dir, obs[i], d);
      if (t !== null && t < d - 1e-4) return false;
    }
    return true;
  }

  /** ¿Cabe un personaje de pie en este punto? Radio típico 0.45. */
  function walkable(arena, x, z, radius) {
    radius = radius === undefined ? 0.45 : radius;
    var b = arena.bounds;
    if (x < b.minX + radius || x > b.maxX - radius) return false;
    if (z < b.minZ + radius || z > b.maxZ - radius) return false;
    var obs = arena.obstacles;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (x > o.min.x - radius && x < o.max.x + radius &&
          z > o.min.z - radius && z < o.max.z + radius) return false;
    }
    return true;
  }

  /** Distancia horizontal a la pieza de cobertura más cercana que corta LoS. */
  function nearestCover(arena, x, z, minHeight) {
    minHeight = minHeight === undefined ? 1.4 : minHeight;
    var best = Infinity;
    var obs = arena.obstacles;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (o.max.y - o.min.y < minHeight) continue;
      if (o.kind === 'wall' && (o.max.x - o.min.x > arena.width ||
          o.max.z - o.min.z > arena.depth)) continue;   // muro perimetral, no cobertura útil
      var dx = Math.max(o.min.x - x, 0, x - o.max.x);
      var dz = Math.max(o.min.z - z, 0, z - o.max.z);
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < best) best = d;
    }
    return best;
  }

  /** Espacio libre detrás de un punto, mirando hacia `yaw`. Para el encuadre. */
  function backClearance(arena, spawn, maxCheck) {
    maxCheck = maxCheck === undefined ? 12 : maxCheck;
    var back = { x: -Math.sin(spawn.yaw || 0), z: -Math.cos(spawn.yaw || 0) };
    for (var d = 0.5; d <= maxCheck; d += 0.25) {
      var x = spawn.x + back.x * d, z = spawn.z + back.z * d;
      if (!walkable(arena, x, z, 0.1)) return d;
    }
    return maxCheck;
  }

  function playableGrid(arena, step) {
    var pts = [];
    var b = arena.bounds;
    for (var x = b.minX + step; x <= b.maxX - step; x += step) {
      for (var z = b.minZ + step; z <= b.maxZ - step; z += step) {
        if (walkable(arena, x, z)) pts.push({ x: x, z: z });
      }
    }
    return pts;
  }

  /* =========================================================================
   * Informes
   * ====================================================================== */

  function spawnReport(arena, spawn) {
    var other = spawn === arena.spawns.player ? arena.spawns.enemy : arena.spawns.player;
    return {
      toCenter: dist2(spawn, { x: 0, z: 0 }),
      nearestCover: nearestCover(arena, spawn.x, spawn.z),
      backClearance: backClearance(arena, spawn),
      losToOpponent: losBetween(arena, spawn, other),
      walkable: walkable(arena, spawn.x, spawn.z)
    };
  }

  function coverageReport(arena, step) {
    var pts = playableGrid(arena, step || 1.0);
    var within4 = 0, within8 = 0, sum = 0, max = 0, worst = null;
    for (var i = 0; i < pts.length; i++) {
      var d = nearestCover(arena, pts[i].x, pts[i].z);
      if (d <= 4) within4++;
      if (d <= 8) within8++;
      sum += d;
      if (d > max) { max = d; worst = pts[i]; }
    }
    return {
      samples: pts.length,
      coverWithin4: pts.length ? within4 / pts.length : 0,
      coverWithin8: pts.length ? within8 / pts.length : 0,
      meanCoverDistance: pts.length ? sum / pts.length : 0,
      maxCoverDistance: max,
      worstPoint: worst || { x: 0, z: 0 }
    };
  }

  function losReport(arena, step) {
    var pts = playableGrid(arena, step || 2.0);
    var open = 0, total = 0, longOpen = 0, longTotal = 0;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var d = dist2(pts[i], pts[j]);
        var vis = losBetween(arena, pts[i], pts[j]);
        total++; if (vis) open++;
        if (d >= 18 && d <= 26) { longTotal++; if (vis) longOpen++; }
      }
    }
    return {
      pairs: total,
      openRatio: total ? open / total : 0,
      longRangePairs: longTotal,
      longRangeOpen: longTotal ? longOpen / longTotal : 0
    };
  }

  /**
   * Anillo de kiteo: qué fracción de una circunferencia alrededor del centro se
   * puede recorrer, y cuál es el tramo bloqueado más largo. Un anillo con un
   * tramo bloqueado largo no es un carril de kiteo: es un callejón donde el
   * rango se queda encerrado y el melee cobra gratis.
   */
  function kiteRing(arena, radius, steps) {
    steps = steps || 180;
    var free = 0, run = 0, longest = 0;
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      var x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      if (walkable(arena, x, z)) { free++; run = 0; }
      else { run++; if (run > longest) longest = run; }
    }
    var arcPerStep = (Math.PI * 2 * radius) / steps;
    return {
      walkable: free / steps,
      longestBlockArc: longest * arcPerStep
    };
  }

  /* -------------------------------------------------------------------------
   * Conectividad y vuelta completa
   *
   * `kiteRing` mide una circunferencia perfecta, y nadie kitea en circunferencia
   * perfecta: se kitea rodeando cosas. Lo que de verdad importa es que el
   * espacio jugable sea UNA sola pieza —sin bolsas aisladas— y que se pueda dar
   * la vuelta completa al centro disputado sin quedar embudado. Eso es lo que
   * separa «cobertura» de «callejón sin salida».
   * ---------------------------------------------------------------------- */

  function floodComponents(pts, step) {
    var index = Object.create(null);
    var i;
    function key(p) { return Math.round(p.x / step) + ',' + Math.round(p.z / step); }
    for (i = 0; i < pts.length; i++) index[key(pts[i])] = { p: pts[i], comp: -1 };

    var keys = Object.keys(index);
    var comps = [];
    for (i = 0; i < keys.length; i++) {
      if (index[keys[i]].comp !== -1) continue;
      var id = comps.length;
      var stack = [keys[i]];
      var members = [];
      index[keys[i]].comp = id;
      while (stack.length) {
        var k = stack.pop();
        var node = index[k];
        members.push(node.p);
        var parts = k.split(','), gx = +parts[0], gz = +parts[1];
        var neigh = [(gx + 1) + ',' + gz, (gx - 1) + ',' + gz,
                     gx + ',' + (gz + 1), gx + ',' + (gz - 1)];
        for (var n = 0; n < neigh.length; n++) {
          var nb = index[neigh[n]];
          if (nb && nb.comp === -1) { nb.comp = id; stack.push(neigh[n]); }
        }
      }
      comps.push(members);
    }
    comps.sort(function (a, b) { return b.length - a.length; });
    return comps;
  }

  /** El espacio jugable en una sola pieza, sin bolsas inalcanzables. */
  function connectivityReport(arena, step) {
    step = step || 1.0;
    var pts = playableGrid(arena, step);
    var comps = floodComponents(pts, step);
    return {
      samples: pts.length,
      components: comps.length,
      largestRatio: pts.length ? comps[0].length / pts.length : 0,
      strays: comps.slice(1).map(function (c) {
        return { size: c.length, at: c[0] };
      })
    };
  }

  /**
   * ¿Se puede dar la vuelta entera al centro disputado? Se quita un disco
   * central, se busca la pieza conectada más grande de lo que queda y se mira
   * si cubre los 360°. Si no los cubre, el rango que intente rodear el centro
   * se topa con un fondo de saco y el melee cobra gratis.
   */
  function loopAroundCenter(arena, innerRadius, step) {
    step = step || 1.0;
    innerRadius = innerRadius === undefined ? 5 : innerRadius;
    var all = playableGrid(arena, step);
    var ring = [];
    for (var i = 0; i < all.length; i++) {
      var r = Math.sqrt(all[i].x * all[i].x + all[i].z * all[i].z);
      if (r >= innerRadius) ring.push(all[i]);
    }
    var comps = floodComponents(ring, step);
    var main = comps[0] || [];
    var BINS = 72;                                   // 5° por casilla
    var seen = new Array(BINS);
    for (var b = 0; b < BINS; b++) seen[b] = false;
    for (var j = 0; j < main.length; j++) {
      var a = Math.atan2(main[j].z, main[j].x);
      if (a < 0) a += Math.PI * 2;
      seen[Math.min(BINS - 1, Math.floor(a / (Math.PI * 2) * BINS))] = true;
    }
    var covered = 0, gap = 0, worstGap = 0;
    for (var k = 0; k < BINS * 2; k++) {
      if (seen[k % BINS]) { if (k < BINS) covered++; gap = 0; }
      else { gap++; if (gap > worstGap) worstGap = gap; }
    }
    return {
      closed: covered === BINS,
      angularCoverage: covered / BINS,
      worstGapDegrees: Math.min(360, worstGap * (360 / BINS)),
      components: comps.length
    };
  }

  /** Simetría 180° respecto al centro: los dos bandos reciben lo mismo. */
  function symmetryReport(arena) {
    var unmatched = [];
    var obs = arena.obstacles;

    function key(o) {
      return [o.min.x, o.min.y, o.min.z, o.max.x, o.max.y, o.max.z]
        .map(function (n) { return Math.round(n * 1000) / 1000; }).join('/');
    }
    function rotatedKey(o) {
      // Rotar 180° sobre Y: (x,z) → (−x,−z); min y max se intercambian en XZ.
      return [-o.max.x, o.min.y, -o.max.z, -o.min.x, o.max.y, -o.min.z]
        .map(function (n) { return Math.round(n * 1000) / 1000; }).join('/');
    }

    var present = Object.create(null);
    for (var i = 0; i < obs.length; i++) present[key(obs[i])] = true;
    for (var j = 0; j < obs.length; j++) {
      if (!present[rotatedKey(obs[j])]) {
        unmatched.push(obs[j].kind + ' @ (' +
          ((obs[j].min.x + obs[j].max.x) / 2).toFixed(1) + ', ' +
          ((obs[j].min.z + obs[j].max.z) / 2).toFixed(1) + ')');
      }
    }

    var plats = arena.platforms || [];
    for (var k = 0; k < plats.length; k++) {
      var found = false;
      for (var l = 0; l < plats.length; l++) {
        if (Math.abs(plats[l].x + plats[k].x) < 1e-6 &&
            Math.abs(plats[l].z + plats[k].z) < 1e-6 &&
            Math.abs(plats[l].h - plats[k].h) < 1e-6) { found = true; break; }
      }
      if (!found) unmatched.push('plataforma @ (' + plats[k].x + ', ' + plats[k].z + ')');
    }

    return { symmetric: unmatched.length === 0, unmatched: unmatched };
  }

  Arena.Sim.ArenaMetrics = {
    dist2: dist2,
    losBetween: losBetween,
    walkable: walkable,
    nearestCover: nearestCover,
    backClearance: backClearance,
    playableGrid: playableGrid,
    spawnReport: spawnReport,
    coverageReport: coverageReport,
    losReport: losReport,
    kiteRing: kiteRing,
    connectivityReport: connectivityReport,
    loopAroundCenter: loopAroundCenter,
    symmetryReport: symmetryReport,
    groundHeightAt: Geo.groundHeightAt
  };
});
