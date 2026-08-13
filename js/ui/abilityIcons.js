/* =============================================================================
 * ui/abilityIcons.js — Iconos vectoriales procedurales para la barra de acción.
 *
 * No son arte final, pero sí un lenguaje visual coherente: cada clase tiene una
 * paleta y cada poder una silueta distinta. Se generan como SVG inline, sin
 * assets externos, para poder desplegar el laboratorio completo en Hostinger.
 * ========================================================================== */
Arena.define('ui/abilityIcons', [], function (Arena) {
  'use strict';

  var PAL = {
    devastador: ['#ffb14a','#6d2b20','#ffd9a1'],
    guardian:   ['#6fc6ff','#213f64','#d8f1ff'],
    centinela:  ['#b9e66e','#36582b','#efffc9'],
    rastreador: ['#63d6a0','#244b3b','#d0ffe8'],
    arcanista:  ['#b978ff','#39245d','#eddcff'],
    vinculador: ['#61e4d1','#20575b','#d7fff9']
  };

  function esc(s) { return String(s || '').replace(/[&<>\"]/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'})[c]; }); }


  function hashId(id) {
    var h = 2166136261 >>> 0, str = String(id || '');
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  function sigilFor(id) {
    var h = hashId(id), a = h % 180, dash = 5 + ((h >>> 8) % 7), r = 18 + ((h >>> 13) % 5);
    return '<g opacity=".24" transform="rotate('+a+' 32 32)">' +
      '<circle cx="32" cy="32" r="'+r+'" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="'+dash+' '+(dash+4)+'"/>' +
      '<path d="M32 7v8M32 49v8M7 32h8M49 32h8" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
      '</g>';
  }

  /**
   * Glifo de una habilidad.
   *
   * NINGUNA HABILIDAD PUEDE COMPARTIR GLIFO CON OTRA DE SU MISMA CLASE. Es la
   * regla que hace útil la barra: el jugador aprende a pulsar por forma, no
   * leyendo el tooltip. Antes había seis grupos en colisión —el Guardián tenía
   * CUATRO habilidades con el mismo escudo—, así que la barra no informaba de
   * nada y las teclas se memorizaban por posición.
   *
   * El orden importa: las reglas ESPECÍFICAS van antes que las genéricas, o la
   * genérica se traga a la específica y vuelve la colisión. `iconTests` falla si
   * dos habilidades de una misma clase acaban en el mismo glifo.
   */
  function glyphFor(id) {
    /* --- Reglas específicas (deben ir primero) --------------------------- */
    if (/profanador/.test(id)) return 'rend';
    if (/egida/.test(id)) return 'aegis';
    if (/proteccion/.test(id)) return 'bond';
    if (/postura/.test(id)) return 'stance';
    if (/lluvia/.test(id)) return 'rain';
    if (/revelar/.test(id)) return 'reveal';
    if (/regeneracion/.test(id)) return 'bloom';
    if (/purificacion/.test(id)) return 'purify';
    if (/intervencion/.test(id)) return 'bond';
    if (/enlace/.test(id)) return 'link';

    /* --- Reglas generales ------------------------------------------------ */
    if (/embestida|interponer|retroceso/.test(id)) return 'dash';
    if (/impacto|sismico|avasallamiento/.test(id)) return 'impact';
    if (/quebrador|perforante/.test(id)) return 'blade';
    if (/bramido|confusion/.test(id)) return 'wave';
    if (/furia/.test(id)) return 'flame';
    if (/guardia|barrera/.test(id)) return 'shield';
    if (/pulso_vital/.test(id)) return 'cross';
    if (/disparo|flecha|emboscada/.test(id)) return 'arrow';
    if (/invernal|estasis/.test(id)) return 'snow';
    if (/camuflaje/.test(id)) return 'eye';
    if (/trampa|prision/.test(id)) return 'snare';
    if (/marca|corrupcion/.test(id)) return 'curse';
    if (/descarga|celeste/.test(id)) return 'bolt';
    if (/velo/.test(id)) return 'void';
    return 'rune';
  }

  var SHAPES = {
    dash: '<path d="M13 32h28M31 20l12 12-12 12M17 24l8 8-8 8"/>',
    impact: '<path d="M18 16h16l5 8-9 8 4 16H20l4-16-9-8z"/><path d="M14 49h36"/>',
    blade: '<path d="M17 47 43 17l4 4-24 30z"/><path d="m31 18 6-6 8 8-6 6M15 43l8 8"/>',
    wave: '<path d="M10 23c9-9 15 9 24 0s15 9 24 0M10 34c9-9 15 9 24 0s15 9 24 0M14 45c7-7 12 7 19 0s12 7 19 0"/>',
    flame: '<path d="M34 10c7 12-2 16 5 23 4-4 6-8 5-13 10 9 10 29-10 34-17-4-20-19-9-29 0 7 4 9 7 12 2-10-8-13 2-27z"/>',
    shield: '<path d="M32 10 50 17v14c0 12-7 20-18 25-11-5-18-13-18-25V17z"/><path d="M32 18v29M22 30h20"/>',
    cross: '<path d="M26 11h12v15h15v12H38v15H26V38H11V26h15z"/>',
    arrow: '<path d="M11 47 48 10M35 11h14v14M16 39l9 9M13 34l-3 16 16-3"/>',
    snow: '<path d="M32 9v46M12 20l40 24M52 20 12 44M25 14l7 7 7-7M25 50l7-7 7 7M12 28l10 3-2-10M52 36l-10-3 2 10"/>',
    eye: '<path d="M8 32c9-14 39-14 48 0-9 14-39 14-48 0z"/><circle cx="32" cy="32" r="8"/><circle cx="32" cy="32" r="2"/>',
    snare: '<circle cx="32" cy="32" r="19"/><path d="M18 18 46 46M46 18 18 46M32 12v40M12 32h40"/>',
    curse: '<path d="M20 14c-8 8-4 17 4 19-7 4-7 15 2 19 7 3 17-1 18-9 9-2 11-15 2-19 2-10-17-17-26-10z"/><path d="M24 26h4M38 26h4M27 40c3-4 7-4 10 0"/>',
    bolt: '<path d="m36 8-18 27h12l-4 21 20-31H34z"/><path d="M13 17l7 5M47 45l6 4"/>',
    void: '<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="10"/><path d="M18 18l28 28"/>',
    rune: '<path d="M32 10 48 20v24L32 54 16 44V20z"/><path d="m24 39 8-20 8 20M21 32h22"/>',

    /* --- Glifos añadidos para romper las colisiones por clase ------------- */
    // Desgarro: tres tajos divergentes. Se distingue de `blade` a un vistazo
    // porque son varias líneas, no una hoja.
    rend: '<path d="M14 12c6 12 12 24 12 40M28 10c6 13 11 26 11 42M42 14c5 12 9 23 9 38"/><path d="M10 46c14 6 30 6 44 0"/>',
    // Égida: escudo con reflejo saliente — devuelve, no sólo aguanta.
    aegis: '<path d="M32 10 50 17v14c0 12-7 20-18 25-11-5-18-13-18-25V17z"/><path d="m24 32 6 6 12-14"/><path d="M32 4v4M44 8l2 3M20 8l-2 3"/>',
    // Vínculo: dos nodos unidos. Protección a un tercero, no a uno mismo.
    bond: '<circle cx="18" cy="22" r="7"/><circle cx="46" cy="42" r="7"/><path d="m23 27 18 10"/><path d="M40 14h12v12"/>',
    // Postura: base ancha y plantada.
    stance: '<path d="M32 8v26"/><path d="m32 34-14 20M32 34l14 20"/><path d="M12 54h40"/><path d="M22 24h20"/>',
    // Lluvia de proyectiles: varios impactos, no uno.
    rain: '<path d="M16 8v22M32 4v26M48 8v22"/><path d="m12 26 4 6 4-6M28 30l4 6 4-6M44 26l4 6 4-6"/><path d="M10 48c8 6 36 6 44 0"/>',
    // Revelar: ojo con destellos — lo contrario de camuflarse.
    reveal: '<path d="M10 32c8-12 36-12 44 0-8 12-36 12-44 0z"/><circle cx="32" cy="32" r="7"/><path d="M32 10v6M14 16l4 4M50 16l-4 4M32 48v6"/>',
    // Floración: curación sostenida en el tiempo.
    bloom: '<path d="M32 54V28"/><path d="M32 28c-10 0-14-8-10-14 7-3 12 4 10 14z"/><path d="M32 28c10 0 14-8 10-14-7-3-12 4-10 14z"/><path d="M32 40c-8 0-11-6-8-10 5-2 9 3 8 10z"/>',
    // Purificar: gota atravesada por una limpieza.
    purify: '<path d="M32 8c8 11 13 18 13 25a13 13 0 0 1-26 0c0-7 5-14 13-25z"/><path d="m24 34 6 6 12-13"/>',
    // Cadena: enlace entre dos, distinto del vínculo protector.
    link: '<rect x="8" y="24" width="22" height="16" rx="8"/><rect x="34" y="24" width="22" height="16" rx="8"/><path d="M26 32h12"/>'
  };

  Arena.UI = Arena.UI || {};
  Arena.UI.AbilityIcons = {
    svg: function (ab) {
      if (!ab) return '';
      var p = PAL[ab.classId] || PAL.devastador;
      var kind = glyphFor(ab.id || '');
      var shape = SHAPES[kind] || SHAPES.rune;
      var uid = (ab.id || 'skill').replace(/[^a-z0-9_]/gi,'');
      return '<svg class="ability-svg" viewBox="0 0 64 64" role="img" aria-label="' + esc(ab.name) + '">' +
        '<defs><radialGradient id="bg'+uid+'" cx="35%" cy="28%" r="78%"><stop offset="0" stop-color="'+p[0]+'" stop-opacity=".48"/><stop offset=".48" stop-color="'+p[1]+'"/><stop offset="1" stop-color="#071013"/></radialGradient>' +
        '<linearGradient id="fg'+uid+'" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+p[2]+'"/><stop offset="1" stop-color="'+p[0]+'"/></linearGradient></defs>' +
        '<rect x="2" y="2" width="60" height="60" rx="13" fill="url(#bg'+uid+')"/>' +
        '<circle cx="32" cy="32" r="24" fill="none" stroke="'+p[0]+'" stroke-opacity=".16" stroke-width="1"/>' +
        '<g style="color:'+p[0]+'">'+sigilFor(ab.id || '')+'</g>' +
        '<g fill="none" stroke="url(#fg'+uid+')" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+shape+'</g>' +
        '<circle cx="51" cy="13" r="2" fill="'+p[2]+'" opacity=".75"/><circle cx="13" cy="50" r="1.5" fill="'+p[0]+'" opacity=".55"/>' +
        '</svg>';
    },

    /* Superficie de inspección para las pruebas. Sin ella, la regla de "una
       habilidad, un icono" sólo podría comprobarse comparando cadenas de SVG,
       que cambian por mil motivos que no son el glifo. */
    glyphOf: function (ab) { return glyphFor((ab && ab.id) || ''); },
    paletteOf: function (classId) {
      var p = PAL[classId] || PAL.devastador;
      return { a: p[0], b: p[1], c: p[2] };
    },
    SHAPES: SHAPES
  };
});
