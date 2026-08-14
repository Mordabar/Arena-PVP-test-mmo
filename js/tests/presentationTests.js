/* =============================================================================
 * tests/presentationTests.js — El idioma que el jugador tiene que leer.
 *
 * Cubre dos capas que se construyeron para poder comprobarse SIN navegador:
 *
 *   data/castFamilies  → la firma visual de cada efecto (qué se ve en el mundo)
 *   ui/hudModel        → qué cuenta el HUD (qué se lee en la interfaz)
 *
 * Las dos son funciones puras sobre metadatos ya decididos por la simulación.
 * Que sean puras es justo lo que permite exigirles aquí lo que de otro modo
 * habría que juzgar mirando una captura: que dos escuelas no se confundan, que
 * un control duro tenga marca propia, que un motivo de fallo se explique con
 * palabras y no con un código.
 * ========================================================================== */
(function () {
  'use strict';
  var T = Arena.Tests;
  var VFX = Arena.Data.VFX;
  var M = Arena.UI.Model;
  var A = Arena.Data.abilities;

  function todasLasHabilidades() {
    var out = [];
    for (var id in A) if (A[id] && A[id].id) out.push(A[id]);
    return out;
  }

  /* =========================================================================
   * Gramática visual
   * ====================================================================== */
  T.suite('Presentación · gramática visual de efectos', function () {

    T.test('toda habilidad resuelve a una firma completa', function () {
      var abs = todasLasHabilidades();
      T.assert(abs.length >= 36, 'hay catálogo que comprobar: ' + abs.length);
      for (var i = 0; i < abs.length; i++) {
        var sig = VFX.familyOf(abs[i]);
        T.assert(sig, abs[i].id + ' no produce firma');
        T.assert(sig.core && sig.core.length === 3, abs[i].id + ' sin color base');
        T.assert(sig.accent && sig.accent.length === 3, abs[i].id + ' sin color de acento');
        T.assert(sig.style, abs[i].id + ' sin estilo de partícula');
        T.assert(isFinite(sig.count) && sig.count > 0, abs[i].id + ' no emite nada');
        T.assert(isFinite(sig.life) && sig.life > 0, abs[i].id + ' con vida de partícula inválida');
      }
    });

    T.test('ninguna habilidad del catálogo cae en el genérico por defecto', function () {
      /* El fallback existe para contenido futuro sin metadatos. Que una
         habilidad YA ESCRITA caiga ahí significa que le falta declaración, y se
         vería igual que otra que no tiene nada que ver. */
      var sinDeclarar = [];
      var abs = todasLasHabilidades();
      for (var i = 0; i < abs.length; i++) {
        var sig = VFX.familyOf(abs[i]);
        if (sig.source === 'fallback') sinDeclarar.push(abs[i].id);
      }
      T.assertEqual(sinDeclarar.length, 0,
        'habilidades sin escuela o sin papel declarado: ' + sinDeclarar.join(', '));
    });

    T.test('dos escuelas nunca se confunden de un vistazo', function () {
      /* A veinte unidades el color es lo único que llega. Si dos escuelas
         quedan cerca en color, el rival no puede leer qué le viene encima. */
      var nombres = Object.keys(VFX.SCHOOL);
      var pares = 0, peor = Infinity, culpables = '';
      for (var i = 0; i < nombres.length; i++) {
        for (var j = i + 1; j < nombres.length; j++) {
          var a = VFX.SCHOOL[nombres[i]].core, b = VFX.SCHOOL[nombres[j]].core;
          var d = VFX.colorDistance(a, b);
          pares++;
          if (d < peor) { peor = d; culpables = nombres[i] + ' vs ' + nombres[j]; }
        }
      }
      T.assert(pares > 0, 'hay escuelas que comparar');
      T.assert(peor >= 0.35,
        'las dos escuelas más parecidas están a ' + peor.toFixed(2) + ': ' + culpables);
    });

    T.test('cada control duro tiene marca propia e inconfundible', function () {
      var marcas = {}, repes = [];
      for (var k in VFX.CONTROL_MARK) {
        var m = VFX.CONTROL_MARK[k];
        T.assert(m && m.shape, k + ' no declara forma');
        var clave = m.shape + '|' + (m.color ? m.color.join(',') : '');
        if (marcas[clave]) repes.push(k + ' = ' + marcas[clave]);
        marcas[clave] = k;
      }
      T.assertEqual(repes.length, 0, 'controles que se ven igual: ' + repes.join(' · '));
    });

    T.test('la magnitud escala el efecto: un burst no se ve como un roce', function () {
      var abs = todasLasHabilidades();
      var pequeno = null, grande = null;
      for (var i = 0; i < abs.length; i++) {
        var m = VFX.magnitudeOf(abs[i]);
        if (pequeno === null || m < pequeno.m) pequeno = { m: m, ab: abs[i] };
        if (grande === null || m > grande.m) grande = { m: m, ab: abs[i] };
      }
      var sp = VFX.familyOf(pequeno.ab), sg = VFX.familyOf(grande.ab);
      T.assert(sg.count > sp.count || sg.size > sp.size,
        'el efecto más grande (' + grande.ab.id + ') no se ve mayor que el más pequeño (' +
        pequeno.ab.id + ')');
    });

    T.test('un crítico se nota sobre el mismo golpe sin crítico', function () {
      /* `CRIT` es el multiplicador declarado. Que exista no basta: tiene que
         empujar de verdad el efecto por encima del golpe corriente. */
      var c = VFX.CRIT;
      T.assert(c, 'no hay perfil de crítico declarado');
      T.assert((c.countMult || 1) > 1.1 || (c.sizeMult || 1) > 1.1,
        'el crítico no escala nada apreciable');
      var ab = A.devastador_golpe_quebrador || todasLasHabilidades()[0];
      var base = VFX.impactFamily(ab, VFX.magnitudeOf(ab));
      T.assert(base && base.count > 0, 'el impacto base emite');
      T.assert(base.count * (c.countMult || 1) > base.count,
        'aplicar el perfil de crítico no cambia nada');
    });

    T.test('sólo se telegrafía lo que da tiempo a reaccionar', function () {
      /* Anunciar un instantáneo es ruido: cuando el aviso aparece el daño ya
         está aplicado. El umbral existe para que la telegrafía signifique algo. */
      var abs = todasLasHabilidades(), fallos = [];
      for (var i = 0; i < abs.length; i++) {
        var sig = VFX.familyOf(abs[i]);
        var castTime = abs[i].castTime || 0;
        /* Un instantáneo puede telegrafiar si marca SUELO —el aviso sigue
           siendo accionable: te apartas—. Lo que no vale es anunciar un golpe
           directo que ya ha ocurrido cuando aparece el aviso. */
        var tg = sig.telegraph;
        if (tg && tg.enabled && !tg.ground && castTime < VFX.TELEGRAPH_MIN_CAST) {
          fallos.push(abs[i].id + ' (casteo ' + castTime + ')');
        }
      }
      T.assertEqual(fallos.length, 0, 'telegrafían sin tiempo de reacción: ' + fallos.join(', '));
    });

    T.test('la gramática visual no usa Math.random', function () {
      // Lo que el jugador interpreta no puede depender de un dado sin semilla.
      var src = Arena.Data.castFamilies && Arena.Data.castFamilies.__src;
      // Sin acceso al fuente en Node, se comprueba el determinismo por resultado.
      var a = VFX.familyOf('arcanista_descarga');
      var b = VFX.familyOf('arcanista_descarga');
      T.assertEqual(JSON.stringify(a), JSON.stringify(b),
        'dos consultas de la misma habilidad dan firmas distintas');
    });
  });

  /* =========================================================================
   * Modelo del HUD
   * ====================================================================== */
  T.suite('Presentación · lo que el HUD tiene que contar', function () {

    T.test('las barras nunca mienten ni se salen', function () {
      T.assertEqual(M.barPercent(50, 100), 50, 'mitad');
      T.assertEqual(M.barPercent(-10, 100), 0, 'no hay barras negativas');
      T.assertEqual(M.barPercent(200, 100), 100, 'no se desborda');
      T.assertEqual(M.barPercent(10, 0), 0, 'sin máximo no hay porcentaje inventado');
    });

    T.test('la barrera se lee ENCIMA de la vida, no en lugar de ella', function () {
      /* Si el escudo se pintara restando vida, el jugador creería que está
         peor de lo que está y usaría un defensivo que no necesita. */
      var r = M.splitBar(600, 300, 1000);
      T.assert(r.value > 0 && r.shield > 0, 'las dos partes existen');
      T.assertNear(r.value, 60, 1e-9, 'la vida ocupa lo suyo');
      T.assertNear(r.offset, 60, 1e-9, 'el escudo empieza donde acaba la vida');
      T.assert(r.value + r.shield <= 100.0001, 'juntas no desbordan la barra');
    });

    T.test('los tiempos se leen distinto según urjan', function () {
      T.assert(M.fmtDuration(0.4).indexOf('.') >= 0, 'por debajo de un segundo hace falta decimal');
      T.assertEqual(M.fmtDuration(0, true), '∞', 'lo permanente no cuenta atrás');
      T.assertEqual(M.fmtClock(65), '1:05', 'reloj de partida');
    });

    T.test('cada motivo de fallo se explica con palabras del jugador', function () {
      /* El jugador no puede leer un log para entender por qué no salió. Si un
         motivo cae en un texto genérico, ese motivo es invisible. */
      /* La lista NO se escribe a mano: se toma del sistema de habilidades. Así
         una razón nueva en la simulación aparece aquí sola y no puede quedarse
         sin explicación por olvido. */
      var motivos = Object.keys(Arena.Combat.AbilitySystem.REASONS);
      T.assert(motivos.length >= 20, 'la simulación declara sus motivos: ' + motivos.length);
      var genericos = [];
      for (var i = 0; i < motivos.length; i++) {
        var f = M.failure(motivos[i]);
        T.assert(f && f.title, motivos[i] + ' no produce titular');
        T.assert(f.hint, motivos[i] + ' no explica qué hacer');
        T.assert(f.mark, motivos[i] + ' no tiene marca visual');
        if (f.generic) genericos.push(motivos[i]);
      }
      T.assertEqual(genericos.length, 0,
        'motivos sin explicación propia en el HUD: ' + genericos.join(', '));
      // Y dos motivos distintos no pueden decir lo mismo.
      var vistos = {}, repes = [];
      for (var k = 0; k < motivos.length; k++) {
        var t = M.failure(motivos[k]).title;
        if (vistos[t]) repes.push(motivos[k] + ' = ' + vistos[t]);
        vistos[t] = motivos[k];
      }
      T.assertEqual(repes.length, 0, 'motivos con el mismo texto: ' + repes.join(' · '));
    });

    T.test('el kit explica su relación con el ataque normal', function () {
      /* Es la mecánica que define el ritmo del juego. Si el lobby no la
         explica, el jugador la descubre perdiendo. */
      var ids = ['devastador_golpe_quebrador', 'centinela_flecha_perforante',
                 'arcanista_descarga', 'guardian_postura'];
      var textos = {};
      for (var i = 0; i < ids.length; i++) {
        var ab = A[ids[i]];
        if (!ab) continue;
        var t = M.abilityTiming(ab);
        T.assert(t && t.tags && t.tags.length, ids[i] + ' no produce etiquetas de timing');
        var tieneNormal = false;
        for (var k = 0; k < t.tags.length; k++) {
          if (t.tags[k].code === 'normal' || t.tags[k].code === 'interval') tieneNormal = true;
        }
        T.assert(tieneNormal, ids[i] + ' no explica su relación con el ataque normal');
        for (var q = 0; q < t.lines.length; q++) {
          T.assert(t.lines[q] && t.lines[q].length > 12,
            ids[i] + ' tiene una línea vacía o telegráfica');
        }
        textos[ids[i]] = t.lines.join(' ');
      }
      T.assert(Object.keys(textos).length >= 3, 'hay kit que explicar');
    });

    T.test('los estados se ordenan por lo que urge, no por cómo llegaron', function () {
      var ahora = 100;
      var r = M.statusEntries([
        { defId: 'slow', endTime: ahora + 9, startTime: ahora - 1, duration: 10 },
        { defId: 'stun', endTime: ahora + 1, startTime: ahora, duration: 1 },
        { defId: 'damageAmp', endTime: ahora + 5, startTime: ahora, duration: 5 }
      ], ahora);
      var items = r.items || r;
      T.assertEqual(items.length, 3, 'salen los tres');
      T.assertEqual(items[0].defId, 'stun',
        'un control duro manda sobre un slow largo y un buff');
      T.assert(items[0].urgent, 'y se marca como urgente');
    });

    T.test('la pantalla de resultados cuenta la partida, no sólo quién ganó', function () {
      T.assert(typeof M.fmtCompact === 'function', 'hay formateo de cifras grandes');
      T.assertEqual(M.fmtSigned(12), '+12', 'un delta positivo se lee como ganancia');
      T.assertEqual(M.fmtSigned(-8), '-8', 'y uno negativo como pérdida');
    });

    T.test('el modelo del HUD es una función pura: no toca el mundo', function () {
      var falso = {
        statuses: [{ defId: 'stun', endTime: 5, startTime: 4, duration: 1 }],
        hp: 100, hpMax: 100
      };
      var antes = JSON.stringify(falso);
      M.statusEntries(falso.statuses, 4.5);
      M.splitBar(falso.hp, 0, falso.hpMax);
      T.assertEqual(JSON.stringify(falso), antes, 'el modelo mutó lo que sólo debía leer');
    });
  });
})();
