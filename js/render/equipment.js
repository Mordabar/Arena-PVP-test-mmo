/* =============================================================================
 * render/equipment.js — Fábricas de equipo. Geometría paramétrica, no piezas
 * sueltas escritas a mano.
 *
 * POR QUÉ EXISTE
 *
 * Seis clases necesitan seis siluetas distintas. La tentación es escribir seis
 * bloques de mallas y seis condiciones en el renderer; eso funciona hasta la
 * séptima clase y a partir de ahí es deuda. Aquí cada tipo de pieza —hombrera,
 * peto, faldón, capa, sombrero, espada, escudo, arco, báculo— es una FUNCIÓN de
 * sus parámetros, y cada clase se describe con números en `data/classVisuals.js`.
 *
 *   data/classVisuals.js   dice QUÉ lleva cada clase y con qué medidas
 *   render/equipment.js    sabe CÓMO se construye cada tipo de pieza
 *   render/characterVisual sólo coloca lo que la primera declara
 *
 * Consecuencia práctica: añadir una clase es añadir una entrada de datos, y
 * cambiar la lectura de una hombrera es cambiar un número, no una malla.
 *
 * CONVENIO DE ORIGEN. Cada pieza se genera alrededor de su PUNTO DE ANCLAJE,
 * que es donde la sujeta el cuerpo:
 *
 *   hombrera, peto, casco      centrados en el origen
 *   faldón, capa, túnica       cuelgan hacia −Y desde el origen
 *   arma de mano               empuñadura en el origen, hoja hacia +Y
 *
 * Sin este convenio cada pieza necesitaría un desplazamiento mágico en el
 * renderer y volveríamos a tener números sin dueño.
 *
 * Los parámetros son SIEMPRE radios y semiejes (no diámetros) salvo donde el
 * nombre diga `w`/`h`/`d`, que son medidas completas de caja. Mezclar los dos
 * convenios en silencio es la forma más rápida de que una hombrera salga del
 * doble de grande y nadie sepa por qué.
 * ========================================================================== */
Arena.define('render/equipment', ['render/primitives'], function (Arena) {
  'use strict';

  var P = Arena.Render.primitives;
  var Eq = {};

  /* =========================================================================
   * Ayudas de forma
   * ====================================================================== */
  /** Elipsoide por semiejes, centrado. */
  function ball(rx, ry, rz, rings, segs) {
    return P.scale(P.sphere(0.5, rings || 8, segs || 11), rx * 2, ry * 2, rz * 2);
  }
  /** Disco/cilindro con la BASE en y=0. `depth` aplasta el eje Z. */
  function disc(r, h, seg, taper, depth) {
    return P.scale(P.cylinder(r, h, seg || 14, taper === undefined ? 1 : taper),
      1, 1, depth === undefined ? 1 : depth);
  }
  /** Punta cónica con la base en y=0. */
  function spike(r, len, seg) { return P.cone(r, len, seg || 6); }
  function at(m, x, y, z) { return P.translate(m, x || 0, y || 0, z || 0); }
  function num(v, d) { return (typeof v === 'number') ? v : d; }

  /* =========================================================================
   * FÁBRICAS
   *
   * Cada una recibe un objeto plano de números y devuelve datos de malla. No
   * leen estado global, no dependen de la clase y son deterministas: la misma
   * entrada da exactamente la misma geometría.
   * ====================================================================== */
  var F = {};

  /* --- Hombro -------------------------------------------------------------
   * La hombrera es la pieza que más decide la silueta de un personaje de
   * armadura: está en el punto más ancho y más alto del torso. `plates` son
   * las lamas que cuelgan; `spikes`, las puntas. Una hombrera redonda y grande
   * dice "muralla"; una angulosa con punta dice "voy a entrar".               */
  F.pauldron = function (s) {
    var rx = num(s.rx, 0.11), ry = num(s.ry, 0.07), rz = num(s.rz, 0.10);
    var parts = [ball(rx, ry, rz, 9, 12)];
    // Bisel superior: rompe el brillo de la cúpula y da lectura de placa.
    if (s.crest) {
      parts.push(at(P.scale(P.box(rx * 0.34, ry * 0.55, rz * 1.85), 1, 1, 1),
        0, ry * 0.72, 0));
    }
    var n = (s.plates | 0), i;
    for (i = 0; i < n; i++) {
      var y = -ry * num(s.plateStart, 0.62) - i * num(s.plateGap, 0.052);
      var k = 1 - num(s.plateShrink, 0.11) * (i + 1);
      parts.push(at(disc(rx * k, num(s.plateH, 0.036), 12, 1.0, rz / rx), 0, y, 0));
    }
    var sp = s.spikes || [];
    for (i = 0; i < sp.length; i++) {
      var q = sp[i];
      // Las puntas se generan hacia +Y y se tumban con una rotación en Z
      // aplicada por escala negativa cuando `down` lo pide: aquí no hay
      // rotación arbitraria de malla, así que se colocan por posición.
      var cone = spike(num(q.r, 0.035), num(q.len, 0.14), 6);
      if (q.down) cone = P.scale(cone, 1, -1, 1);
      if (q.flat) cone = P.scale(cone, 1, 1, num(q.flat, 0.7));
      parts.push(at(cone, num(q.x, 0), num(q.y, 0), num(q.z, 0)));
    }
    if (s.studs) {
      var ns = s.studs | 0;
      for (i = 0; i < ns; i++) {
        var a = (i / ns) * Math.PI * 2;
        parts.push(at(P.sphere(num(s.studR, 0.016), 5, 7),
          Math.cos(a) * rx * 0.66, ry * 0.30, Math.sin(a) * rz * 0.66));
      }
    }
    return P.merge(parts);
  };

  /** Cazoleta blanda de cuero: explorador, no caballero. */
  F.shoulderCap = function (s) {
    var rx = num(s.rx, 0.085), ry = num(s.ry, 0.045), rz = num(s.rz, 0.080);
    var parts = [ball(rx, ry, rz, 7, 10)];
    if (s.seam) parts.push(at(P.box(rx * 2.05, num(s.seamH, 0.014), rz * 0.35), 0, 0, 0));
    if (s.fringe) {
      var n = num(s.fringe, 3) | 0;
      for (var i = 0; i < n; i++) {
        var t = (n === 1) ? 0 : (i / (n - 1) - 0.5);
        parts.push(at(P.box(rx * 0.34, num(s.fringeLen, 0.10), rz * 0.30),
          t * rx * 1.30, -ry - num(s.fringeLen, 0.10) * 0.5, 0));
      }
    }
    return P.merge(parts);
  };

  /**
   * Capelina circular: tela que cae desde el cuello y se ABRE hacia abajo.
   *
   * `r` es el radio en el ANCLAJE (cuello, codo) y `flare` cuánto abre en el
   * dobladillo, siempre > 1. La primera versión tomaba `r` como el radio del
   * dobladillo y estrechaba hacia abajo: el resultado era un embudo abierto
   * hacia el cielo alrededor de la cabeza del Vinculador. Se vio en la primera
   * captura y por eso el bucle de calidad incluye mirar el fotograma.
   */
  F.capelet = function (s) {
    var r = num(s.r, 0.13), len = num(s.len, 0.24), flare = num(s.flare, 2.4);
    var seg = num(s.seg, 18), depth = num(s.depth, 0.94);
    var parts = [
      at(P.scale(P.cylinder(r, len, seg, flare), 1, -1, depth), 0, 0, num(s.z, 0)),
      // Dobladillo: un anillo grueso que remata el borde y le da peso.
      at(disc(r * flare * num(s.hem, 1.03), num(s.hemH, 0.032), seg, 1, depth),
        0, -len, num(s.z, 0))
    ];
    if (s.collar) {
      parts.push(at(disc(num(s.collarR, 0.135), num(s.collarH, 0.070), 14, 1.10, 0.92), 0, -0.01, 0));
    }
    return P.merge(parts);
  };

  /** Mantel angular con puntas: silueta de caster ofensivo. */
  F.mantle = function (s) {
    var rx = num(s.rx, 0.20), ry = num(s.ry, 0.055), rz = num(s.rz, 0.14);
    var parts = [
      ball(rx, ry, rz, 9, 12),
      at(P.box(rx * 1.60, num(s.plateH, 0.038), rz * 1.55), 0, -ry * 0.45, num(s.z, 0.01))
    ];
    var n = num(s.points, 2) | 0;
    for (var i = 0; i < n; i++) {
      var side = (n === 1) ? 1 : (i / (n - 1) * 2 - 1);
      parts.push(at(P.scale(spike(num(s.pointR, 0.045), num(s.pointLen, 0.20), 5), 1, -1, 0.72),
        side * rx * num(s.pointSpread, 0.92), -ry * 0.35, num(s.pointZ, -0.02)));
    }
    return P.merge(parts);
  };

  /* --- Torso -------------------------------------------------------------- */
  /** Peto. `vTaper` estrecha la cintura: es lo que da la V del atacante. */
  F.cuirass = function (s) {
    var rx = num(s.rx, 0.17), ry = num(s.ry, 0.145), rz = num(s.rz, 0.115);
    var parts = [P.scale(P.sphere(0.5, 9, 12), rx * 2, ry * 2, rz * 2)];
    if (s.vTaper) {
      // Faldilla inferior estrechada: el peto termina en punta hacia el ombligo.
      parts.push(at(P.scale(P.cylinder(rx * 0.92, ry * 0.85, 12, num(s.vTaper, 0.45)), 1, -1, rz / rx),
        0, -ry * 0.25, 0));
    }
    if (s.ridge) {
      parts.push(at(P.box(num(s.ridgeW, 0.055), ry * num(s.ridgeH, 1.65), num(s.ridgeD, 0.045)),
        0, 0, rz * 0.92));
    }
    if (s.rivets) {
      var n = s.rivets | 0;
      for (var i = 0; i < n; i++) {
        var t = (n === 1) ? 0 : (i / (n - 1) - 0.5);
        parts.push(at(P.sphere(num(s.rivetR, 0.017), 5, 7), t * rx * 1.35, ry * 0.55, rz * 0.80));
      }
    }
    return P.merge(parts);
  };

  /** Gola: anillo grueso alrededor del cuello. Sube la lectura de "blindado". */
  F.gorget = function (s) {
    var r = num(s.r, 0.155), h = num(s.h, 0.075);
    var parts = [
      at(disc(r, h, 14, num(s.taper, 1.06), num(s.depth, 0.86)), 0, -h * 0.5, 0),
      at(disc(r * 1.08, num(s.lipH, 0.026), 14, 1.0, num(s.depth, 0.86)), 0, h * 0.42, 0)
    ];
    if (s.wings) {
      parts.push(at(P.box(r * 2.30, num(s.wingH, 0.045), num(s.wingD, 0.11)), 0, h * 0.10, -r * 0.20));
    }
    return P.merge(parts);
  };

  /** Colgante circular: talismán del soporte. */
  F.pendant = function (s) {
    var r = num(s.r, 0.075);
    var parts = [
      P.scale(P.cylinder(r, num(s.thick, 0.022), num(s.seg, 14), 1), 1, 1, 1),
      at(P.scale(P.cylinder(r * num(s.inner, 0.58), num(s.thick, 0.022) * 1.4, num(s.seg, 14), 1), 1, 1, 1), 0, -0.004, 0)
    ];
    // El disco se genera con el eje en Y; el renderer lo tumba al colocarlo.
    if (s.chain) {
      parts.push(at(P.box(num(s.chainW, 0.016), num(s.chain, 0.16), 0.016), 0, num(s.chain, 0.16) * 0.5 + r, 0));
    }
    return P.merge(parts);
  };

  /* --- Cintura y piernas -------------------------------------------------- */
  F.belt = function (s) {
    var r = num(s.r, 0.19), h = num(s.h, 0.070);
    var parts = [
      at(disc(r, h, 14, 1.0, num(s.depth, 0.80)), 0, -h * 0.5, 0),
      at(disc(r * 1.05, num(s.lipH, 0.020), 14, 1.0, num(s.depth, 0.80)), 0, -h * 0.18, 0)
    ];
    if (s.buckle) {
      parts.push(at(P.box(num(s.buckleW, 0.075), num(s.buckleH, 0.070), 0.026), 0, -h * 0.42, r * num(s.depth, 0.80)));
      parts.push(at(P.sphere(0.022, 6, 8), 0, -h * 0.42, r * num(s.depth, 0.80) + 0.016));
    }
    if (s.rings) {
      var n = s.rings | 0;
      for (var i = 0; i < n; i++) {
        var a = -0.9 + (n === 1 ? 0 : i / (n - 1)) * 1.8;
        parts.push(at(P.sphere(num(s.ringR, 0.020), 5, 7),
          Math.sin(a) * r * 0.96, -h * 0.85, Math.cos(a) * r * num(s.depth, 0.80) * 0.96));
      }
    }
    return P.merge(parts);
  };

  /** Panel de faldón que cuelga desde el origen hacia −Y. */
  F.tasset = function (s) {
    var w = num(s.w, 0.135), len = num(s.len, 0.26), d = num(s.d, 0.050);
    var parts = [at(P.box(w, len, d), 0, -len * 0.5, num(s.z, 0.05))];
    var n = (s.plates | 0);
    for (var i = 0; i < n; i++) {
      parts.push(at(P.box(w * (1 + 0.06 * i), num(s.plateH, 0.040), d * 1.25),
        0, -len * (0.30 + 0.30 * i), num(s.z, 0.05)));
    }
    if (s.point) {
      parts.push(at(P.scale(spike(w * 0.48, num(s.point, 0.10), 4), 1, -1, d / w * 1.2),
        0, -len, num(s.z, 0.05)));
    }
    return P.merge(parts);
  };

  /** Faldar completo: un anillo de placas alrededor de la cadera. */
  F.fauld = function (s) {
    var r = num(s.r, 0.215), len = num(s.len, 0.24), n = num(s.plates, 8) | 0;
    var parts = [at(disc(r, num(s.beltH, 0.055), 16, 1.0, num(s.depth, 0.86)), 0, -0.02, 0)];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var x = Math.cos(a) * r * 0.98, z = Math.sin(a) * r * num(s.depth, 0.86) * 0.98;
      parts.push(at(P.scale(P.box(num(s.plateW, 0.11), len, num(s.plateD, 0.045)), 1, 1, 1),
        x, -len * 0.5 - 0.03, z));
    }
    parts.push(at(disc(r * num(s.hem, 1.04), num(s.hemH, 0.028), 16, 1.0, num(s.depth, 0.86)),
      0, -len - 0.02, 0));
    return P.merge(parts);
  };

  /** Placa de muslo/rodilla. */
  F.legPlate = function (s) {
    var rx = num(s.rx, 0.058), ry = num(s.ry, 0.075), rz = num(s.rz, 0.052);
    var parts = [ball(rx, ry, rz, 7, 9)];
    if (s.ridge) parts.push(at(P.box(rx * 0.5, ry * 1.5, rz * 0.55), 0, 0, rz * 0.75));
    if (s.spike) parts.push(at(spike(num(s.spikeR, 0.030), num(s.spike, 0.09), 5), 0, 0, rz * 0.95));
    return P.merge(parts);
  };

  F.bootCuff = function (s) {
    var r = num(s.r, 0.098), h = num(s.h, 0.085);
    var parts = [at(disc(r, h, 10, num(s.taper, 1.15), 1), 0, -h * 0.5, 0)];
    if (s.fold) parts.push(at(disc(r * 1.14, num(s.foldH, 0.045), 10, 0.92, 1), 0, h * 0.30, 0));
    if (s.tall) parts.push(at(disc(r * 0.94, num(s.tall, 0.22), 10, 0.90, 1), 0, -h * 0.5 - num(s.tall, 0.22), 0));
    return P.merge(parts);
  };

  /* --- Tela --------------------------------------------------------------- */
  /** Túnica: campana desde el origen hacia abajo. `split` la abre por delante. */
  F.robe = function (s) {
    var rTop = num(s.rTop, 0.145), rBot = num(s.rBot, 0.29), len = num(s.len, 1.10);
    var seg = num(s.seg, 18);
    // Se genera de y=0 hacia arriba y luego se baja: así el radio base es el
    // del dobladillo y `taper` es cuánto cierra en la cintura.
    var parts = [at(P.cylinder(rBot, len, seg, rTop / rBot), 0, -len, 0)];
    if (s.hem) parts.push(at(P.cylinder(rBot * 1.02, num(s.hemH, 0.05), seg, 1), 0, -len, 0));
    if (s.split) {
      // Dos solapas frontales que abren la túnica: lectura de bata, no de campana.
      var sw = num(s.splitW, 0.12), sl = num(s.split, 0.85);
      parts.push(at(P.box(sw, sl, 0.035), -num(s.splitX, 0.135), -sl * 0.5 - 0.02, rBot * 0.62));
      parts.push(at(P.box(sw, sl, 0.035), num(s.splitX, 0.135), -sl * 0.5 - 0.02, rBot * 0.62));
    }
    if (s.panels) {
      var n = s.panels | 0;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        parts.push(at(P.box(num(s.panelW, 0.075), len * num(s.panelLen, 0.55), 0.026),
          Math.cos(a) * rBot * 0.80, -len * num(s.panelLen, 0.55) * 0.5 - len * 0.25,
          Math.sin(a) * rBot * 0.80));
      }
    }
    return P.merge(parts);
  };

  /** Panel largo de tela vertical: sobreveste, faldones de gabán. */
  F.coatPanel = function (s) {
    var w = num(s.w, 0.14), len = num(s.len, 0.55), d = num(s.d, 0.035);
    var parts = [at(P.box(w, len, d), 0, -len * 0.5, 0)];
    if (s.taper) parts.push(at(P.box(w * num(s.taper, 0.7), len * 0.30, d * 1.05), 0, -len * 1.05, 0));
    if (s.trim) parts.push(at(P.box(w * 1.04, num(s.trimH, 0.030), d * 1.3), 0, -len, 0));
    return P.merge(parts);
  };

  /** Capa: cuelga desde los hombros hacia atrás. */
  F.cloak = function (s) {
    var w = num(s.w, 0.42), len = num(s.len, 0.76), d = num(s.d, 0.035);
    var parts = [at(P.box(w, len, d), 0, -len * 0.5, 0)];
    if (s.flare) parts.push(at(P.box(w * num(s.flare, 1.25), len * 0.34, d * 1.1), 0, -len * 0.86, 0));
    if (s.clasp) parts.push(at(P.sphere(num(s.clasp, 0.032), 6, 8), 0, 0.02, d * 1.2));
    if (s.shoulderRoll) {
      parts.push(at(P.scale(P.sphere(0.5, 7, 10), w * num(s.shoulderRoll, 1.0), 0.10, 0.22), 0, 0.02, -0.02));
    }
    return P.merge(parts);
  };

  /** Fajín/banda de tela. */
  F.sash = function (s) {
    var r = num(s.r, 0.22), h = num(s.h, 0.085);
    var parts = [at(disc(r, h, 14, 1.0, num(s.depth, 0.86)), 0, -h * 0.5, 0)];
    if (s.knot) parts.push(at(ball(num(s.knot, 0.055), num(s.knot, 0.055) * 0.8, 0.05, 6, 8), num(s.knotX, 0.16), -h * 0.6, r * 0.55));
    if (s.tail) parts.push(at(P.box(num(s.tailW, 0.085), num(s.tail, 0.34), 0.028), num(s.knotX, 0.16), -num(s.tail, 0.34) * 0.5 - h, r * 0.55));
    return P.merge(parts);
  };

  /* --- Cabeza ------------------------------------------------------------- */
  F.hood = function (s) {
    var r = num(s.r, 0.165);
    var parts = [
      ball(r, r, r * 1.05, 10, 13),
      at(ball(r * 0.72, r * 0.58, r * 0.97, 8, 10), 0, 0.010, -r * 0.42),
      at(ball(r * 0.44, r * 0.35, r * 0.58, 7, 9), 0, -0.045, -num(s.peak, 0.235))
    ];
    if (s.brim) {
      parts.push(at(P.box(r * 1.85, num(s.brimH, 0.030), num(s.brim, 0.10)), 0, r * 0.30, r * 0.72));
    }
    if (s.drape) {
      parts.push(at(P.box(r * 1.5, num(s.drape, 0.22), 0.030), 0, -num(s.drape, 0.22) * 0.5 - r * 0.5, -r * 0.55));
    }
    return P.merge(parts);
  };

  /** Sombrero de ala ancha con copa en punta. */
  F.wideHat = function (s) {
    var brimR = num(s.brimR, 0.33), crownR = num(s.crownR, 0.185), crownH = num(s.crownH, 0.40);
    var parts = [
      P.scale(P.cylinder(brimR, num(s.brimH, 0.035), 18, num(s.brimTaper, 0.94)), 1, 1, num(s.brimDepth, 0.86)),
      at(P.scale(P.cylinder(crownR, crownH, 12, num(s.crownTaper, 0.001)), 0.92, 1, 0.88), 0, num(s.crownY, 0.03), 0)
    ];
    if (s.tip) {
      parts.push(at(P.scale(spike(num(s.tipR, 0.095), num(s.tip, 0.20), 10), 0.92, 1, 0.90),
        num(s.tipX, 0.055), crownH * num(s.tipYK, 0.90), num(s.tipZ, -0.025)));
    }
    if (s.band) {
      parts.push(at(P.scale(P.cylinder(crownR * num(s.bandK, 1.08), num(s.bandH, 0.042), 16, 1.0), 1, 1, num(s.brimDepth, 0.86)), 0, num(s.bandY, 0.055), 0));
    }
    return P.merge(parts);
  };

  /**
   * Yelmo abierto. NO cubre la cara: las orejas y los ojos luminosos son el
   * rasgo racial más legible y taparlos convertiría a las dos clases de
   * armadura en dos cubos. Lo que aporta es masa sobre el cráneo y una línea
   * horizontal a la altura de las cejas.
   */
  F.helm = function (s) {
    var r = num(s.r, 0.150);
    var parts = [
      at(ball(r, num(s.ry, r * 0.92), r * num(s.depth, 1.02), 9, 12), 0, num(s.y, 0.02), 0),
      at(P.scale(P.cylinder(r * 1.04, num(s.browH, 0.042), 16, 1.0), 1, 1, num(s.depth, 1.02)), 0, -r * 0.34, 0)
    ];
    if (s.nasal) {
      parts.push(at(P.box(num(s.nasalW, 0.036), num(s.nasal, 0.13), 0.030), 0, -r * 0.62, r * num(s.depth, 1.02) * 0.92));
    }
    if (s.cheeks) {
      parts.push(at(P.scale(P.box(0.030, num(s.cheeks, 0.13), 0.10), 1, 1, 1), -r * 0.94, -r * 0.62, r * 0.16));
      parts.push(at(P.scale(P.box(0.030, num(s.cheeks, 0.13), 0.10), 1, 1, 1), r * 0.94, -r * 0.62, r * 0.16));
    }
    if (s.crest) {
      parts.push(at(P.box(num(s.crestW, 0.036), num(s.crest, 0.10), r * 1.85), 0, r * num(s.crestY, 0.95), -r * 0.10));
    }
    if (s.horns) {
      parts.push(at(P.scale(spike(num(s.hornR, 0.032), num(s.horns, 0.20), 5), 1, 1, 0.8),
        -r * 0.86, r * 0.30, -r * 0.30));
      parts.push(at(P.scale(spike(num(s.hornR, 0.032), num(s.horns, 0.20), 5), 1, 1, 0.8),
        r * 0.86, r * 0.30, -r * 0.30));
    }
    return P.merge(parts);
  };

  /** Diadema/circlet: alternativa ligera al sombrero. */
  F.circlet = function (s) {
    var r = num(s.r, 0.135);
    var parts = [P.scale(P.cylinder(r, num(s.h, 0.030), 16, 1.0), 1, 1, num(s.depth, 0.92))];
    var n = num(s.points, 3) | 0;
    for (var i = 0; i < n; i++) {
      var t = (n === 1) ? 0 : (i / (n - 1) - 0.5);
      parts.push(at(spike(num(s.pointR, 0.020), num(s.pointLen, 0.07) * (1 - Math.abs(t) * 0.5), 5),
        t * r * 1.5, num(s.h, 0.030), r * num(s.depth, 0.92) * 0.72));
    }
    return P.merge(parts);
  };

  /* --- Utillaje ----------------------------------------------------------- */
  F.quiver = function (s) {
    var r = num(s.r, 0.058), len = num(s.len, 0.34);
    var parts = [
      at(P.cylinder(r, len, 9, num(s.taper, 0.86)), 0, -len * 0.5, 0),
      at(P.cylinder(r * 1.07, num(s.lipH, 0.030), 9, 1.0), 0, len * 0.5 - 0.03, 0)
    ];
    if (s.bands) {
      var nb = s.bands | 0;
      for (var b = 0; b < nb; b++) {
        parts.push(at(P.cylinder(r * 1.03, 0.020, 9, 1.0), 0, -len * (0.15 + 0.30 * b), 0));
      }
    }
    return P.merge(parts);
  };

  F.arrows = function (s) {
    var n = num(s.count, 3) | 0, parts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var x = Math.cos(a) * num(s.spread, 0.022), z = Math.sin(a) * num(s.spread, 0.022);
      var len = num(s.len, 0.20) * (1 + 0.06 * (i % 3));
      parts.push(at(P.cylinder(num(s.r, 0.010), len, 4, 1), x, 0, z));
      if (s.fletch) {
        parts.push(at(P.box(num(s.fletchW, 0.036), num(s.fletchH, 0.055), 0.006), x, len * 0.86, z));
        parts.push(at(P.box(0.006, num(s.fletchH, 0.055), num(s.fletchW, 0.036)), x, len * 0.86, z));
      }
    }
    return P.merge(parts);
  };

  F.pouch = function (s) {
    var w = num(s.w, 0.105), h = num(s.h, 0.125), d = num(s.d, 0.055);
    var parts = [P.box(w, h, d)];
    if (s.flap !== false) parts.push(at(P.box(w * 0.92, num(s.flapH, 0.024), d * 1.06), 0, h * 0.52, 0));
    if (s.round) parts.push(at(ball(w * 0.5, h * 0.30, d * 0.55, 6, 8), 0, -h * 0.45, 0));
    return P.merge(parts);
  };

  F.strap = function (s) {
    var w = num(s.w, 0.062), len = num(s.len, 0.44), t = num(s.t, 0.030);
    var parts = [at(P.box(w, len, t), 0, 0, 0)];
    if (s.buckles) {
      var n = s.buckles | 0;
      for (var i = 0; i < n; i++) {
        var y = (n === 1) ? 0 : (i / (n - 1) - 0.5) * len * 0.7;
        parts.push(at(P.box(w * 1.35, 0.026, t * 1.7), 0, y, 0));
      }
    }
    if (s.vials) {
      var nv = s.vials | 0;
      for (var v = 0; v < nv; v++) {
        var yv = (nv === 1) ? 0 : (v / (nv - 1) - 0.5) * len * 0.55;
        parts.push(at(P.cylinder(num(s.vialR, 0.020), num(s.vialH, 0.070), 6, 0.85), 0, yv, t * 1.2));
      }
    }
    return P.merge(parts);
  };

  /** Disco de herramienta: trampas, sellos, talismanes. */
  F.disc = function (s) {
    var r = num(s.r, 0.070), t = num(s.t, 0.020);
    var parts = [P.scale(P.cylinder(r, t, num(s.seg, 12), 1), 1, 1, 1)];
    var n = (s.teeth | 0);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      parts.push(at(spike(num(s.toothR, 0.016), num(s.tooth, 0.045), 4),
        Math.cos(a) * r * 0.86, t, Math.sin(a) * r * 0.86));
    }
    if (s.hub) parts.push(at(P.sphere(num(s.hub, 0.024), 6, 8), 0, t * 0.5, 0));
    return P.merge(parts);
  };

  /* --- Armas -------------------------------------------------------------- */
  /** Espada. Empuñadura en el origen, hoja hacia +Y. */
  F.sword = function (s) {
    var bl = num(s.blade, 0.62), bw = num(s.bladeW, 0.072), bt = num(s.bladeT, 0.024);
    var grip = num(s.grip, 0.165), gw = num(s.guard, 0.190);
    var parts = [
      at(P.box(bw, bl, bt), 0, grip * 0.55 + bl * 0.5, 0),
      at(P.scale(spike(bw * 0.5, num(s.tip, 0.130), 4), 1, 1, bt / bw), 0, grip * 0.55 + bl, 0),
      at(P.box(gw, num(s.guardH, 0.044), num(s.guardD, 0.058)), 0, grip * 0.55, 0),
      at(P.box(num(s.gripW, 0.048), grip, num(s.gripW, 0.048)), 0, grip * 0.03, 0),
      at(P.sphere(num(s.pommel, 0.036), 6, 8), 0, -grip * 0.52, 0)
    ];
    if (s.fuller) {
      parts.push(at(P.box(bw * 0.30, bl * 0.88, bt * 1.35), 0, grip * 0.55 + bl * 0.5, 0));
    }
    if (s.quillonDrop) {
      parts.push(at(P.box(num(s.quillonW, 0.036), num(s.quillonDrop, 0.10), num(s.guardD, 0.058) * 0.8),
        gw * 0.44, grip * 0.55 - num(s.quillonDrop, 0.10) * 0.4, 0));
      parts.push(at(P.box(num(s.quillonW, 0.036), num(s.quillonDrop, 0.10), num(s.guardD, 0.058) * 0.8),
        -gw * 0.44, grip * 0.55 - num(s.quillonDrop, 0.10) * 0.4, 0));
    }
    if (s.ricasso) {
      parts.push(at(P.box(bw * 1.02, num(s.ricasso, 0.12), bt * 1.5), 0, grip * 0.55 + num(s.ricasso, 0.12) * 0.6, 0));
    }
    return P.merge(parts);
  };

  /** Maza/martillo corto: arma secundaria visualmente menor. */
  F.mace = function (s) {
    var haft = num(s.haft, 0.34), r = num(s.headR, 0.070);
    var parts = [
      at(P.cylinder(num(s.haftR, 0.024), haft, 8, 0.94), 0, -haft * 0.30, 0),
      at(ball(r, r * num(s.headK, 1.05), r, 7, 9), 0, haft * 0.72, 0),
      at(P.sphere(num(s.pommel, 0.030), 6, 8), 0, -haft * 0.34, 0)
    ];
    var n = num(s.flanges, 4) | 0;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      parts.push(at(P.box(num(s.flangeW, 0.030), r * 1.45, num(s.flangeD, 0.055)),
        Math.cos(a) * r * 0.80, haft * 0.72, Math.sin(a) * r * 0.80));
    }
    return P.merge(parts);
  };

  F.dagger = function (s) {
    var bl = num(s.blade, 0.31), bw = num(s.bladeW, 0.040);
    return P.merge([
      at(P.box(bw, bl, num(s.bladeT, 0.018)), 0, bl * 0.62, 0),
      at(P.scale(spike(bw * 0.5, num(s.tip, 0.085), 4), 1, 1, 0.4), 0, bl * 1.22, 0),
      at(P.box(num(s.guard, 0.115), 0.028, 0.040), 0, bl * 0.11, 0),
      at(P.cylinder(num(s.gripR, 0.027), num(s.grip, 0.115), 7, 0.92), 0, -num(s.grip, 0.115) * 0.70, 0)
    ]);
  };

  /**
   * Escudo. `shape` decide la lectura:
   *   round  círculo abombado          — ligero
   *   kite   lágrima alargada          — caballería
   *   tower  rectángulo alto y plano   — MURALLA
   */
  F.shield = function (s) {
    var w = num(s.w, 0.46), h = num(s.h, 0.60), d = num(s.d, 0.07);
    var shape = s.shape || 'round';
    var parts = [];
    if (shape === 'tower') {
      parts.push(P.scale(P.sphere(0.5, 6, 8), w, h, d * 2));
      parts.push(at(P.box(w * 1.00, h * 0.86, d * 1.15), 0, 0, 0));
      // Refuerzos horizontales: dan escala y dicen "esto pesa".
      var nb = num(s.bands, 2) | 0;
      for (var i = 0; i < nb; i++) {
        var y = (nb === 1) ? 0 : (i / (nb - 1) - 0.5) * h * 0.66;
        parts.push(at(P.box(w * 1.06, num(s.bandH, 0.055), d * 1.55), 0, y, 0));
      }
      parts.push(at(P.box(w * 1.05, num(s.rimH, 0.045), d * 1.5), 0, h * 0.5, 0));
      parts.push(at(P.box(w * 1.05, num(s.rimH, 0.045), d * 1.5), 0, -h * 0.5, 0));
    } else if (shape === 'kite') {
      parts.push(P.scale(P.sphere(0.5, 8, 11), w, h * 1.15, d * 2));
      parts.push(at(P.scale(spike(w * 0.5, h * 0.55, 5), 1, -1, d * 2 / w), 0, -h * 0.42, 0));
    } else {
      parts.push(P.scale(P.sphere(0.5, 8, 11), w, h, d * 2));
      parts.push(at(P.scale(P.cylinder(w * 0.5, num(s.rimH, 0.035), 16, 1.0), 1, 1, h / w), 0, 0, 0));
    }
    if (s.boss !== false) parts.push(at(P.sphere(num(s.boss, 0.072), 7, 9), 0, 0, d * num(s.bossZ, 0.9)));
    if (s.studs) {
      var ns = s.studs | 0;
      for (var k = 0; k < ns; k++) {
        var a = (k / ns) * Math.PI * 2;
        parts.push(at(P.sphere(num(s.studR, 0.020), 5, 7),
          Math.cos(a) * w * 0.34, Math.sin(a) * h * 0.34, d * 0.85));
      }
    }
    return P.merge(parts);
  };

  /**
   * Arco. Se genera VERTICAL, con la empuñadura en el origen: dos palas que se
   * abren hacia −Z y puntas recurvadas hacia el tirador.
   */
  F.bow = function (s) {
    var limb = num(s.limb, 0.30), r = num(s.r, 0.019), taper = num(s.taper, 0.42);
    var parts = [
      at(P.cylinder(r, limb, 6, taper), 0, num(s.gripHalf, 0.075), num(s.bend, -0.010)),
      at(P.scale(P.cylinder(r, limb, 6, taper), 1, -1, 1), 0, -num(s.gripHalf, 0.075), num(s.bend, -0.010)),
      at(P.box(num(s.gripW, 0.034), num(s.gripLen, 0.17), num(s.gripD, 0.046)), 0, 0, 0.008)
    ];
    if (s.recurve) {
      var ty = num(s.gripHalf, 0.075) + limb * taper * 0 + limb;
      parts.push(at(P.cylinder(r * 0.58, num(s.recurve, 0.10), 5, 0.75), 0, ty, num(s.recurveZ, 0.030)));
      parts.push(at(P.scale(P.cylinder(r * 0.58, num(s.recurve, 0.10), 5, 0.75), 1, -1, 1), 0, -ty, num(s.recurveZ, 0.030)));
    }
    if (s.riser) {
      parts.push(at(P.box(num(s.gripW, 0.034) * 1.5, num(s.riser, 0.30), num(s.gripD, 0.046) * 1.3), 0, 0, -0.010));
    }
    if (s.sight) {
      parts.push(at(P.box(0.016, 0.016, num(s.sight, 0.10)), 0, num(s.sightY, 0.16), 0.055));
    }
    return P.merge(parts);
  };

  /**
   * Báculo. Vertical, con la mano en el origen y el remate arriba.
   *   crystal  cristal facetado y puntas — ofensivo
   *   ring     aro cerrado               — protector
   *   antler   ramas abiertas            — natural
   */
  F.staff = function (s) {
    var shaft = num(s.shaft, 1.46), r = num(s.r, 0.026);
    var top = num(s.top, shaft * 0.60);
    var parts = [at(P.cylinder(r, shaft, 8, num(s.taper, 0.88)), 0, -(shaft - top), 0)];
    if (s.wrap) {
      var nw = s.wrap | 0;
      for (var w = 0; w < nw; w++) {
        parts.push(at(P.cylinder(r * 1.35, 0.032, 8, 1.0), 0, -(shaft - top) + shaft * (0.28 + 0.10 * w), 0));
      }
    }
    if (s.ferrule) parts.push(at(P.cylinder(r * 1.25, num(s.ferrule, 0.09), 8, 0.92), 0, -(shaft - top), 0));

    var crown = s.crown || 'none';
    if (crown === 'crystal') {
      parts.push(at(P.scale(P.sphere(0.5, 7, 9), num(s.crownR, 0.105) * 2, num(s.crownR, 0.105) * 3.1, num(s.crownR, 0.105) * 2), 0, top, 0));
      var np = num(s.prongs, 2) | 0;
      for (var p = 0; p < np; p++) {
        var t = (np === 1) ? 0 : (p / (np - 1) * 2 - 1);
        parts.push(at(P.scale(spike(num(s.prongR, 0.040), num(s.prong, 0.18), 6), 0.75, 1, 0.75),
          t * num(s.prongSpread, 0.095), top - 0.01, 0));
      }
      parts.push(at(P.box(num(s.crownR, 0.105) * 2.05, 0.026, 0.035), 0, top - 0.06, 0));
    } else if (crown === 'ring') {
      // Aro cerrado: la forma protectora por excelencia. Se compone de
      // segmentos para que sea un anillo real y no un disco.
      var R = num(s.ringR, 0.145), nr = num(s.ringSeg, 14) | 0, th = num(s.ringT, 0.028);
      for (var i = 0; i < nr; i++) {
        var a = (i / nr) * Math.PI * 2;
        parts.push(at(P.box(th, R * 2 * Math.PI / nr * 1.25, th),
          Math.cos(a) * R, top + num(s.ringY, 0.10) + Math.sin(a) * R, 0));
      }
      parts.push(at(P.box(th * 1.6, num(s.ringY, 0.10), th * 1.6), 0, top + num(s.ringY, 0.10) * 0.5, 0));
      if (s.beads) {
        var nbd = s.beads | 0;
        for (var bd = 0; bd < nbd; bd++) {
          var ab = (bd / nbd) * Math.PI * 2;
          parts.push(at(P.sphere(num(s.beadR, 0.026), 5, 7),
            Math.cos(ab) * R, top + num(s.ringY, 0.10) + Math.sin(ab) * R, 0));
        }
      }
    } else if (crown === 'antler') {
      var nb = num(s.branches, 3) | 0;
      for (var bi = 0; bi < nb; bi++) {
        var ta = (bi / (nb - 1 || 1) - 0.5);
        parts.push(at(P.scale(P.cylinder(r * 0.7, num(s.branch, 0.22), 5, 0.4), 1, 1, 1),
          ta * num(s.branchSpread, 0.11), top, ta * 0.03));
      }
    }
    return P.merge(parts);
  };

  F.orb = function (s) {
    var r = num(s.r, 0.112);
    var parts = [P.sphere(r, 8, 12)];
    if (s.cage) {
      var n = num(s.cage, 3) | 0;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI;
        parts.push(at(P.box(num(s.cageT, 0.016), r * 2.2, num(s.cageT, 0.016)),
          Math.cos(a) * r * 0.95, 0, Math.sin(a) * r * 0.95));
      }
    }
    return P.merge(parts);
  };

  F.gem = function (s) {
    var r = num(s.r, 0.078);
    return P.merge([
      P.scale(spike(r, r * num(s.k, 1.5), num(s.facets, 6)), 1, 1, 1),
      P.scale(spike(r, r * num(s.k, 1.5), num(s.facets, 6)), 1, -1, 1)
    ]);
  };

  Eq.FACTORIES = F;

  /* =========================================================================
   * Construcción de la biblioteca
   *
   * `specs` es un diccionario `nombreDeMalla → {factory, ...parámetros}`. Se
   * recorre una vez en el arranque y produce el diccionario de mallas que sube
   * el renderer. Un `factory` desconocido es un error ruidoso a propósito: un
   * personaje al que le falta media armadura y nadie se entera es peor que un
   * arranque que se para.
   * ====================================================================== */
  Eq.build = function (specs, out) {
    out = out || {};
    for (var name in specs) {
      if (!Object.prototype.hasOwnProperty.call(specs, name)) continue;
      var spec = specs[name];
      var fn = F[spec.factory];
      if (!fn) throw new Error('Equipment: fábrica desconocida «' + spec.factory + '» para ' + name);
      out[name] = fn(spec);
    }
    return out;
  };

  /** Nombres de fábrica disponibles. Lo usan las pruebas de contrato. */
  Eq.factoryNames = function () { return Object.keys(F).sort(); };

  Arena.Render.Equipment = Eq;
});
