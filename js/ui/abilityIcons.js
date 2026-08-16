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


  /* v0.12: el elemento es información funcional, no decoración. Un jugador
     debe distinguir fuego/hielo/rayo/sombra sin leer el tooltip. */
  var ELEMENT_PAL = {
    fire:      ['#ff7a32','#5b1b12','#ffe0a8'],
    ice:       ['#79dcff','#173e5d','#e7fbff'],
    lightning: ['#ffe568','#4a3b10','#fff9c4'],
    wind:      ['#a7f0d8','#1f514d','#e7fff8'],
    earth:     ['#d7a66d','#4d3522','#ffe3b9'],
    shadow:    ['#b17bff','#28163f','#efdfff'],
    nature:    ['#76dc75','#214a2a','#e5ffe0'],
    life:      ['#78f0b1','#174d3d','#e5fff1'],
    arcane:    ['#c68cff','#35205d','#f2e3ff']
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


  /* -------------------------------------------------------------------------
   * v0.11 — gramática procedural REAL para la biblioteca masiva.
   *
   * Antes sourceDerived sólo alteraba una marca casi transparente y los tests
   * fabricaban una clave única aunque el dibujo visible fuera el mismo. Ahora
   * familia + motivo + rotación + número de segmentos cambian la silueta del
   * glifo. Dos poderes de la misma familia siguen pareciendo parientes, pero no
   * gemelos. `iconMeta` viene de datos y el renderer no conoce ids concretos.
   * ---------------------------------------------------------------------- */
  var FAMILY_SHAPES = {
    damage: '<path d="M15 47 42 15l7 7-25 29z"/><path d="M15 38 8 54l16-5"/>',
    control: '<circle cx="32" cy="32" r="18"/><path d="M17 17l30 30M47 17 17 47"/>',
    defense: '<path d="M32 9 51 17v15c0 12-8 20-19 24-11-4-19-12-19-24V17z"/><path d="M22 33h20"/>',
    heal: '<path d="M27 11h10v16h16v10H37v16H27V37H11V27h16z"/>',
    mobility: '<path d="M10 34h35M35 20l14 14-14 14"/><path d="M15 22h12M12 46h13"/>',
    stealth: '<path d="M8 32c10-14 38-14 48 0-10 14-38 14-48 0z"/><circle cx="32" cy="32" r="7"/>',
    counter: '<path d="M14 40c6 12 26 13 35 2"/><path d="m42 34 9 8-10 7"/><path d="M50 24C44 12 24 11 15 22"/><path d="m22 30-9-8 10-7"/>',
    summon: '<circle cx="32" cy="20" r="8"/><path d="M16 53c2-14 8-21 16-21s14 7 16 21"/><path d="M11 17h8M45 17h8"/>',
    aura: '<circle cx="32" cy="32" r="9"/><circle cx="32" cy="32" r="20"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8"/>',
    passive: '<path d="M32 8 50 18 47 44 32 56 17 44 14 18z"/><path d="M23 35c5-13 13-16 18-6-1 10-7 15-18 15z"/>',
    utility: '<path d="M32 9 48 19v26L32 55 16 45V19z"/><path d="M22 33h20M32 22v22"/>'
  };

  var MOTIFS = {
    blade: '<path d="M19 47 45 17M39 17h7v7"/>',
    burst: '<path d="M32 13v10M32 41v10M13 32h10M41 32h10M19 19l7 7M38 38l7 7M45 19l-7 7M26 38l-7 7"/>',
    rune: '<path d="m23 42 9-22 9 22M20 34h24"/>',
    chevron: '<path d="m18 24 14 12 14-12M18 34l14 12 14-12"/>',
    orb: '<circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="3"/>',
    ward: '<path d="M32 15 44 22v11c0 8-5 13-12 17-7-4-12-9-12-17V22z"/>',
    spiral: '<path d="M43 34c0 8-7 13-15 10-9-4-9-17-1-22 8-5 18 1 17 10-1 7-9 10-14 6-4-3-2-9 3-10"/>',
    fang: '<path d="m21 15 8 15-5 20M43 15 35 30l5 20"/>',
    star: '<path d="m32 14 5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z"/>',
    eye: '<path d="M16 32c7-10 25-10 32 0-7 10-25 10-32 0z"/><circle cx="32" cy="32" r="5"/>',
    wave: '<path d="M14 27c7-8 12 8 19 0s12 8 19 0M14 38c7-8 12 8 19 0s12 8 19 0"/>',
    crown: '<path d="m17 42 3-21 12 10 12-10 3 21zM18 48h28"/>'
  };

  /* Siluetas elementales deliberadamente diferentes. No son copias de
     iconos externos; son una gramática original que comunica la función. */
  var SPELL_SHAPES = {
    fireball: '<circle cx="35" cy="30" r="11"/><path d="M24 34c-8 2-12 8-13 17 8-6 14-5 20-9M22 27c-7-3-11-8-11-15 7 5 13 5 19 8"/>',
    fireBolt: '<path d="M15 46 44 17M37 15l11 2-2 11"/><path d="M18 38c-7 1-10 6-11 12 6-4 11-4 16-7"/>',
    fireField: '<path d="M11 46c8-9 5-15 13-21-1 8 4 10 7 14 1-12 10-15 10-25 13 12 12 29-4 39-9 5-20 1-26-7z"/><path d="M10 54h44"/>',
    iceBurst: '<path d="M32 10v44M10 32h44M17 17l30 30M47 17 17 47"/><path d="m32 20 7 12-7 12-7-12z"/>',
    iceBolt: '<path d="M12 43 43 14l9 9-31 29z"/><path d="M23 18v10M18 23h10"/>',
    freezePrison: '<path d="m17 48 3-29 12-9 12 9 3 29-15 8z"/><path d="M20 19l24 29M44 19 20 48"/>',
    iceStorm: '<path d="M32 8v20M16 17l14 13M48 17 34 30"/><path d="M11 42c7-7 12 7 19 0s12 7 23 0"/><path d="M18 52h28"/>',
    lightningBolt: '<path d="m37 7-19 28h13l-5 22 22-33H35z"/><path d="M12 17l8 5M46 46l7 4"/>',
    lightningStorm: '<path d="M10 20c7-9 14-9 21-2 8-8 18-3 21 5"/><path d="m22 29-8 13h8l-4 13M39 27l-9 15h9l-5 14M51 30l-7 11h7l-4 10"/>',
    meteor: '<circle cx="40" cy="35" r="11"/><path d="M32 27 12 10M35 22 25 8M27 31 10 24"/><path d="m35 32 8 6M38 27l6 4"/>',
    magmaOrb: '<circle cx="34" cy="31" r="15"/><path d="M24 24l8 5-5 8 9 5M40 20l-5 9 8 7"/><path d="M15 51c7-6 15-5 22 0s13 4 17 0"/>',
    tornado: '<path d="M12 15h40M17 23h30M21 31h22M24 39h16M28 47h8M30 55h4"/><path d="M14 15c7 4 29 4 36 0M19 31c5 3 21 3 26 0"/>',
    crystalBurst: '<path d="m32 8 8 17-8 31-8-31zM8 32l17-8 31 8-31 8z"/><path d="m17 17 12 9M47 17 35 26M17 47l12-9M47 47l-12-9"/>',
    earthSpike: '<path d="m14 51 9-21 6 7 8-28 13 42z"/><path d="M9 53h46"/>',
    stoneFist: '<path d="M18 45V25l7-7 5 7 5-10 6 10 7-4 1 24-12 10z"/>',
    dreadWave: '<path d="M11 26c7-11 14 10 21 0s14 11 21 0M11 39c7-11 14 10 21 0s14 11 21 0"/><path d="M25 17h4M39 17h4M29 48c3-3 7-3 10 0"/>',
    shadowBolt: '<circle cx="35" cy="30" r="12"/><path d="M25 38 11 50M24 30 8 33M28 20 16 10"/><path d="M31 27h2M39 27h2"/>',
    controlSeal: '<circle cx="32" cy="32" r="20"/><path d="M17 17l30 30M47 17 17 47"/><circle cx="32" cy="32" r="7"/>',
    ward: '<path d="M32 8 51 17v16c0 12-8 19-19 23-11-4-19-11-19-23V17z"/><path d="M20 32h24M32 20v24"/>',
    healPulse: '<path d="M27 10h10v17h17v10H37v17H27V37H10V27h17z"/><circle cx="32" cy="32" r="23"/>',
    summonSigil: '<circle cx="32" cy="34" r="18"/><path d="m32 11 6 14 15 1-12 9 4 15-13-8-13 8 4-15-12-9 15-1z"/>',
    aoeRune: '<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="9"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8"/>',
    lifeDrain: '<path d="M32 54c-13-8-20-16-20-27 0-8 10-13 20-3 10-10 20-5 20 3 0 11-7 19-20 27z"/><path d="M13 15h16M21 9l8 6-8 6"/>',
    soulDrain: '<path d="M18 46c1-18 8-29 14-29s13 11 14 29"/><circle cx="32" cy="18" r="7"/><path d="M10 50h44M13 13l8 5M51 13l-8 5"/>',
    darkSeal: '<circle cx="32" cy="32" r="21"/><path d="M20 20l24 24M44 20 20 44"/><circle cx="32" cy="32" r="5"/>',
    doomAura: '<circle cx="32" cy="32" r="23"/><path d="M18 38c4-16 24-16 28 0M22 25h4M38 25h4M25 45c5-5 9-5 14 0"/>',
    possession: '<path d="M9 32c9-13 37-13 46 0-9 13-37 13-46 0z"/><circle cx="32" cy="32" r="8"/><path d="M32 5v13M32 46v13"/>',
    spiritSwarm: '<circle cx="21" cy="27" r="7"/><circle cx="42" cy="22" r="6"/><circle cx="38" cy="43" r="8"/><path d="M13 48c10-6 24-8 38-4"/>',
    massRoots: '<path d="M31 54V22M31 35 17 24M31 40l15-13M17 24l-6-10M46 27l7-12"/><path d="M10 54h44"/>',
    elementExpose: '<circle cx="32" cy="32" r="20"/><path d="M32 12v40M12 32h40M18 18l28 28M46 18 18 46"/>',
    windWard: '<circle cx="32" cy="32" r="20"/><path d="M14 27c8-8 13 8 21 0s13 8 15 1M18 38c6-6 11 6 17 0s10 5 13 1"/>',
    elementWard: '<path d="M32 9 49 18v14c0 11-7 18-17 23-10-5-17-12-17-23V18z"/><path d="M24 35c0-10 16-10 16 0"/>',
    fracture: '<path d="M18 9 29 27l-8 8 13 20M47 10 36 28l8 8-12 19"/>',
    slowField: '<circle cx="32" cy="32" r="20"/><path d="M32 20v13l9 7M15 49 49 15"/>',
    stoneBind: '<path d="M17 18h30v28H17z"/><path d="M17 18l30 28M47 18 17 46"/>',
    debilitate: '<path d="M12 20h40M18 31h28M24 42h16M29 53h6"/>',
    enrage: '<path d="M32 8c10 11 15 20 10 31-4 9-16 13-24 5-8-8-4-19 5-27-1 8 3 12 8 15-1-8-5-13 1-24z"/>',
    cremation: '<path d="M20 48c-7-9-5-20 3-27-1 8 4 10 7 14 2-13 11-16 10-27 14 15 14 32-4 42"/><path d="M12 55h40"/>',
    groundFlame: '<path d="M12 51h40M18 47c-4-8 0-13 6-18-1 6 4 8 7 12 1-10 7-13 8-21 10 10 9 24-3 31"/>',
    shadow: '<circle cx="32" cy="32" r="20"/><path d="M20 21c5 6 7 13 2 22M44 21c-5 6-7 13-2 22"/>',
    mastery: '<path d="m32 9 6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z"/>',
    warCouncil: '<circle cx="20" cy="28" r="7"/><circle cx="44" cy="28" r="7"/><path d="M9 52c1-12 6-18 11-18s10 6 11 18M33 52c1-12 6-18 11-18s10 6 11 18"/>',
    bloodPact: '<path d="M32 8c8 12 14 20 14 28a14 14 0 0 1-28 0c0-8 6-16 14-28z"/><path d="M24 37h16"/>'
  };

  function sourceShape(ab) {
    var m = ab.iconMeta || {};
    var semantic = ab.presentation && SPELL_SHAPES[ab.presentation.iconShape || ab.presentation.shape];
    var fam = semantic || FAMILY_SHAPES[m.family] || FAMILY_SHAPES.utility;
    var motif = MOTIFS[m.motif] || MOTIFS.rune;
    var h = hashId((ab.id || '') + '|' + (m.signature || ''));
    var rot = Math.round(((m.rotation || 0) * 180 / Math.PI + ((h >>> 16) % 19)) % 360);
    var sx = m.mirror ? -1 : 1;
    var seg = Math.max(3, Math.min(8, m.segments || 4));
    var accent = Math.max(0, Math.min(5, m.accent || 0));
    var innerScale = 0.54 + accent * 0.035;
    var motifOffset = 32 - 32 * innerScale;
    var ringRadius = 15 + accent * 1.45 + ((h >>> 5) % 3) * 0.35;
    var ringDashA = 3 + accent;
    var ringDashB = 10 - Math.min(6, accent);
    var coreScaleX = 0.96 + accent * 0.02;
    var coreScaleY = 0.96 + ((h >>> 11) % 5) * 0.012;
    var ticks = '';
    for (var i=0;i<seg;i++) {
      var a=(i/seg)*Math.PI*2;
      var inner = 21.5 + accent * 0.35 + ((h >>> (i % 16)) & 1) * 0.4;
      var outer = 25.5 + accent * 0.30 + (((h >>> ((i+7) % 16)) & 1) ? 1.2 : 0.2);
      var x1=32+Math.cos(a)*inner, y1=32+Math.sin(a)*inner,
          x2=32+Math.cos(a)*outer, y2=32+Math.sin(a)*outer;
      ticks += '<path d="M'+x1.toFixed(1)+' '+y1.toFixed(1)+'L'+x2.toFixed(1)+' '+y2.toFixed(1)+'" opacity=".58"/>';
    }
    return '<g transform="translate(32 32) rotate('+rot+') scale('+sx+' 1) scale('+coreScaleX.toFixed(3)+' '+coreScaleY.toFixed(3)+') translate(-32 -32)">'+fam+'</g>'+
      '<circle cx="32" cy="32" r="'+ringRadius.toFixed(1)+'" opacity=".28" stroke-dasharray="'+ringDashA+' '+ringDashB+'"/>'+
      '<g opacity=".56" transform="rotate('+((rot*3+17+accent*11)%360)+' 32 32) scale('+innerScale.toFixed(3)+') translate('+motifOffset.toFixed(1)+' '+motifOffset.toFixed(1)+')">'+motif+'</g>'+ticks;
  }

  Arena.UI = Arena.UI || {};
  Arena.UI.AbilityIcons = {
    svg: function (ab) {
      if (!ab) return '';
      var ep = ab.presentation && ELEMENT_PAL[ab.presentation.element];
      var p = ep || PAL[ab.classId] || PAL.devastador;
      var kind = glyphFor(ab.id || '');
      var shape = ab.sourceDerived ? sourceShape(ab) : (SHAPES[kind] || SHAPES.rune);
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
    glyphOf: function (ab) {
      var base = glyphFor((ab && ab.id) || '');
      if (ab && ab.sourceDerived) {
        var m = ab.iconMeta || {};
        var semantic = ab.presentation ? (ab.presentation.iconShape || ab.presentation.shape || '') : '';
        return ['src',semantic,m.family||'utility',m.motif||'rune',m.accent||0,m.rotation||0,m.segments||0,m.mirror?1:0,m.signature||hashId(ab.id).toString(36)].join(':');
      }
      return base;
    },
    paletteOf: function (classId) {
      var p = PAL[classId] || PAL.devastador;
      return { a: p[0], b: p[1], c: p[2] };
    },
    sourceShape: sourceShape,
    SHAPES: SHAPES,
    SPELL_SHAPES: SPELL_SHAPES
  };
});
