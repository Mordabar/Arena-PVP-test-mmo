/* =============================================================================
 * render/poseMetrics.js — Medir la SILUETA, no contar piezas.
 *
 * POR QUÉ ESTE FICHERO EXISTE
 *
 * La primera medición de identidad de clase sumaba volúmenes de caja y contaba
 * mallas. Con eso, dos personajes con el mismo número de piezas y la misma masa
 * total pasaban por distintos aunque uno fuera una columna y el otro un cubo, y
 * dos que se leen a la primera —un tipo con un escudo torre y un tipo con un
 * arco largo— podían salir «iguales» porque la suma de sus cajas coincidía.
 *
 * Lo que de verdad distingue a un personaje a veinte unidades es su CONTORNO:
 * cuánto ocupa a cada altura. Eso es lo que se mide aquí.
 *
 *   pose (lista de {mesh, matrix})
 *     → esquinas de la caja local de cada malla
 *     → al mundo por su matriz
 *     → proyección al plano de la cámara
 *     → anchura ocupada en N bandas horizontales
 *
 * El resultado es un perfil comparable entre clases y entre vistas (frontal,
 * tres cuartos, espalda). No sustituye al juicio visual —una diferencia
 * estadística no garantiza una diferencia perceptual— pero sí detecta lo
 * contrario, que es lo útil: si dos perfiles coinciden banda a banda, no hay
 * captura que salve esa pareja.
 *
 * NO decide nada de combate. Lee una pose ya construida y devuelve números.
 * ========================================================================== */
Arena.define('render/poseMetrics', [], function (Arena) {
  'use strict';

  var PM = {};

  /** Número de bandas horizontales del perfil. */
  PM.BANDS = 16;

  /* =========================================================================
   * Nube de puntos por malla
   *
   * NO se usa la caja envolvente. Una caja convierte un cono en un cilindro:
   * una túnica acampanada medida por su caja es una columna del ancho del
   * dobladillo de arriba abajo, y con eso un mago con falda y un tanque con
   * escudo daban exactamente el mismo perfil de anchuras. Era el propio
   * medidor el que borraba la diferencia que se quería medir.
   *
   * Se guardan los vértices únicos de cada malla —low-poly: unos pocos cientos
   * por pieza— y se transforman de verdad. Cuesta más y dice la verdad.
   * ====================================================================== */
  /** Resolución de muestreo en unidades locales. Muy por debajo de la altura
   *  de una banda (≈ 0.15) para que ninguna quede sin muestras. */
  PM.SAMPLE = 0.045;

  PM.boundsOf = function (meshLib, cache) {
    cache = cache || {};
    for (var name in meshLib) {
      if (!Object.prototype.hasOwnProperty.call(meshLib, name)) continue;
      if (cache[name]) continue;
      cache[name] = samplePoints(meshLib[name]);
    }
    return cache;
  };

  /**
   * Nube de puntos de una malla, densificada a lo largo de las ARISTAS.
   *
   * Los vértices sueltos no bastan: un cilindro de este proyecto tiene dos
   * anillos —arriba y abajo— y nada en medio, así que muestrear sólo vértices
   * deja las bandas centrales vacías y el personaje aparece con agujeros en el
   * contorno. Subdividiendo las aristas, la silueta queda cubierta.
   *
   * Con el interior de los triángulos no hace falta: los extremos de un
   * polígono plano en cualquier banda horizontal caen siempre en su borde.
   */
  function samplePoints(mesh) {
    var p = mesh.positions, idx = mesh.indices;
    var seen = Object.create(null), pts = [];
    var maxLen = PM.SAMPLE;

    function push(x, y, z) {
      // Rejilla de 5 mm: las primitivas duplican vértices por cara para tener
      // normales duras y la subdivisión repite los extremos de cada arista.
      var key = Math.round(x * 200) + ',' + Math.round(y * 200) + ',' + Math.round(z * 200);
      if (seen[key]) return;
      seen[key] = 1;
      pts.push(x, y, z);
    }
    function edge(a, b) {
      var ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
      var bx = p[b * 3], by = p[b * 3 + 1], bz = p[b * 3 + 2];
      push(ax, ay, az);
      var dx = bx - ax, dy = by - ay, dz = bz - az;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var steps = Math.ceil(len / maxLen);
      if (steps > 48) steps = 48;
      for (var s = 1; s < steps; s++) {
        var t = s / steps;
        push(ax + dx * t, ay + dy * t, az + dz * t);
      }
    }

    if (idx && idx.length) {
      for (var i = 0; i < idx.length; i += 3) {
        edge(idx[i], idx[i + 1]);
        edge(idx[i + 1], idx[i + 2]);
        edge(idx[i + 2], idx[i]);
      }
    } else {
      for (var v = 0; v < p.length; v += 3) push(p[v], p[v + 1], p[v + 2]);
    }
    return new Float64Array(pts);
  }

  /**
   * Perfil de silueta de una pose.
   *
   * @param pose     lista de {mesh, matrix} tal y como la devuelve buildPose
   * @param bounds   cajas locales por malla (PM.boundsOf)
   * @param opts     {azimuth} dirección de cámara en radianes: 0 = de frente,
   *                 π/2 = de perfil, π = de espaldas
   * @return {height, top, bottom, width, bands[], asym, pieces, valid}
   */
  PM.profile = function (pose, bounds, opts) {
    opts = opts || {};
    var az = opts.azimuth || 0;
    var N = opts.bands || PM.BANDS;
    // Eje horizontal de pantalla, perpendicular a la dirección de vista.
    var ux = Math.cos(az), uz = -Math.sin(az);

    var i, k, m, pts, n;
    var minY = Infinity, maxY = -Infinity;
    var valid = true;

    /* Primera pasada: proyectar cada vértice a (u, y) y quedarse con los
       extremos verticales. Se guarda la proyección para no repetirla. */
    var proj = [];
    for (i = 0; i < pose.length; i++) {
      var part = pose[i];
      pts = bounds[part.mesh];
      if (!pts || !pts.length) continue;
      m = part.matrix;
      var buf = new Float64Array(pts.length / 3 * 2);
      var c = 0;
      for (n = 0; n < pts.length; n += 3) {
        var lx = pts[n], ly = pts[n + 1], lz = pts[n + 2];
        var wx = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
        var wy = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
        var wz = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
        var u = wx * ux + wz * uz;
        // Una matriz con NaN envenena todo el perfil en silencio; se marca.
        if (!(u === u) || !(wy === wy)) { valid = false; continue; }
        buf[c++] = u; buf[c++] = wy;
        if (wy < minY) minY = wy;
        if (wy > maxY) maxY = wy;
      }
      if (c) proj.push(buf.subarray(0, c));
    }

    var bands = new Array(N), solid = new Array(N), lo = new Array(N), hi = new Array(N);
    for (k = 0; k < N; k++) { bands[k] = 0; solid[k] = 0; lo[k] = Infinity; hi[k] = -Infinity; }
    if (!proj.length || !(maxY > minY)) {
      return { height: 0, top: 0, bottom: 0, width: 0, bands: bands, solid: solid,
               asym: 0, fill: 0, pieces: pose.length, valid: false };
    }

    var h = maxY - minY, step = h / N;

    /* Envolvente y MASA OCUPADA, que no son lo mismo.
     *
     * Medir sólo la envolvente hace que una túnica cónica y un par de piernas
     * separadas den la misma anchura: por fuera ocupan lo mismo. El ojo ve una
     * diferencia enorme —una masa contra dos patas— y por eso hace falta saber
     * cuánto de esa anchura está de verdad relleno.
     *
     * Cada pieza aporta su tramo [min, max] en cada banda que toca, y los
     * tramos se pintan sobre una rejilla fina. Lo que queda pintado es la masa;
     * lo que hay entre el tobillo izquierdo y el derecho, no. */
    var CELL = 0.02;
    var uLo = Infinity, uHi = -Infinity;
    for (i = 0; i < proj.length; i++) {
      var Q = proj[i];
      for (n = 0; n < Q.length; n += 2) {
        if (Q[n] < uLo) uLo = Q[n];
        if (Q[n] > uHi) uHi = Q[n];
      }
    }
    var cells = Math.max(1, Math.ceil((uHi - uLo) / CELL) + 1);
    var mask = new Uint8Array(N * cells);
    var pLo = new Float64Array(N), pHi = new Float64Array(N);

    for (i = 0; i < proj.length; i++) {
      var P = proj[i];
      for (k = 0; k < N; k++) { pLo[k] = Infinity; pHi[k] = -Infinity; }
      for (n = 0; n < P.length; n += 2) {
        k = Math.floor((P[n + 1] - minY) / step);
        if (k < 0) k = 0; else if (k > N - 1) k = N - 1;
        if (P[n] < lo[k]) lo[k] = P[n];
        if (P[n] > hi[k]) hi[k] = P[n];
        if (P[n] < pLo[k]) pLo[k] = P[n];
        if (P[n] > pHi[k]) pHi[k] = P[n];
      }
      // El tramo de ESTA pieza en cada banda se pinta entero: una pieza es
      // sólida entre sus dos bordes, aunque sólo se muestreen sus aristas.
      for (k = 0; k < N; k++) {
        if (pLo[k] === Infinity) continue;
        var c0 = Math.floor((pLo[k] - uLo) / CELL);
        var c1 = Math.floor((pHi[k] - uLo) / CELL);
        if (c0 < 0) c0 = 0;
        if (c1 > cells - 1) c1 = cells - 1;
        var base = k * cells;
        for (var c = c0; c <= c1; c++) mask[base + c] = 1;
      }
    }
    for (k = 0; k < N; k++) {
      var occ = 0, b0 = k * cells;
      for (var cc = 0; cc < cells; cc++) if (mask[b0 + cc]) occ++;
      solid[k] = occ * CELL;
    }

    var widest = 0, asymSum = 0, asymN = 0, fillSum = 0, fillN = 0;
    for (k = 0; k < N; k++) {
      if (lo[k] === Infinity) { bands[k] = 0; continue; }
      bands[k] = hi[k] - lo[k];
      if (bands[k] > widest) widest = bands[k];
      // Descentramiento: un contorno simétrico da 0, uno con un escudo o un
      // carcaj a un lado da un valor claramente positivo.
      asymSum += Math.abs((hi[k] + lo[k]) * 0.5);
      asymN++;
      if (bands[k] > 1e-6) { fillSum += solid[k] / bands[k]; fillN++; }
    }

    return {
      height: h, top: maxY, bottom: minY, width: widest,
      bands: bands, solid: solid,
      asym: asymN ? asymSum / asymN : 0,
      fill: fillN ? fillSum / fillN : 0,
      pieces: pose.length, valid: valid
    };
  };

  /**
   * Distancia entre dos perfiles. 0 = idénticos; 0.30 = muy distintos.
   *
   * Combina dos lecturas que no son la misma:
   *   ENVOLVENTE  cuánto ocupa el contorno a cada altura
   *   MASA        cuánto de eso está de verdad relleno
   *
   * Con sólo la primera, una túnica cónica y dos piernas separadas empataban
   * porque por fuera miden lo mismo. Es la diferencia entre «igual de ancho» e
   * «igual de macizo», y el ojo la ve inmediatamente.
   *
   * Siempre RELATIVA: comparar anchuras absolutas premiaría a los personajes
   * grandes por serlo, y lo que se quiere saber es si el contorno es otro.
   */
  PM.distance = function (a, b) {
    var n = Math.min(a.bands.length, b.bands.length);
    var sumW = 0, refW = 0, sumS = 0, refS = 0;
    for (var i = 0; i < n; i++) {
      sumW += Math.abs(a.bands[i] - b.bands[i]);
      refW += Math.max(a.bands[i], b.bands[i]);
      var as = (a.solid && a.solid[i]) || 0, bs = (b.solid && b.solid[i]) || 0;
      sumS += Math.abs(as - bs);
      refS += Math.max(as, bs);
    }
    var dW = refW > 1e-6 ? sumW / refW : 0;
    var dS = refS > 1e-6 ? sumS / refS : 0;
    return (dW + dS) * 0.5;
  };

  /**
   * Descriptores gruesos: los rasgos que alguien nombraría al describir la
   * silueta de lejos. Se usan como segunda condición independiente, porque un
   * único número puede pasar por casualidad y cuatro a la vez no.
   */
  PM.descriptors = function (p) {
    var n = p.bands.length;
    function avg(from, to) {
      var s = 0, c = 0;
      for (var i = from; i < to; i++) { s += p.bands[i]; c++; }
      return c ? s / c : 0;
    }
    var shoulders = avg(Math.floor(n * 0.66), Math.floor(n * 0.84));
    var waist = avg(Math.floor(n * 0.42), Math.floor(n * 0.58));
    var hem = avg(Math.floor(n * 0.06), Math.floor(n * 0.26));
    return {
      height: p.height,
      width: p.width,
      // Cuánto del contorno está relleno: una túnica es casi maciza, un cuerpo
      // con las piernas a la vista deja hueco entre ellas.
      fill: p.fill,
      // Cuánto se estrecha la cintura respecto a los hombros: la V del atacante.
      taper: shoulders > 1e-6 ? waist / shoulders : 1,
      // Cuánto se abre por abajo: la campana del caster contra la pierna desnuda.
      flare: shoulders > 1e-6 ? hem / shoulders : 1,
      // Cuánto se sale del eje: escudos, carcajes, capas de un solo lado.
      asym: p.asym,
      // Esbeltez: alto partido por ancho. Una columna contra un bloque.
      slender: p.width > 1e-6 ? p.height / p.width : 0
    };
  };

  Arena.Render.PoseMetrics = PM;
});
