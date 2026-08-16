/* =============================================================================
 * tests/iconTests.js — La barra de habilidades tiene que INFORMAR.
 *
 * Un icono repetido no es un defecto cosmético: es la diferencia entre aprender
 * la barra por forma —que es como se juega un PvP— y memorizarla por posición.
 * El Guardián llegó a tener CUATRO habilidades con el mismo escudo, así que su
 * barra no decía nada de lo que hacía cada tecla.
 *
 * Este test recorre el catálogo real y falla si dos habilidades de una misma
 * clase acaban en el mismo glifo. Es barato y cierra la puerta para siempre.
 * ========================================================================== */
Arena.define('tests/iconTests', ['tests/testRunner', 'ui/abilityIcons'], function (Arena) {
  'use strict';

  var T = Arena.Tests;
  var Icons = Arena.UI.AbilityIcons;

  function abilitiesByClass() {
    var out = {};
    for (var id in Arena.Data.abilities) {
      if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
      var ab = Arena.Data.abilities[id];
      (out[ab.classId] = out[ab.classId] || []).push(ab);
    }
    return out;
  }

  T.suite('Iconografía · una habilidad, un icono', function () {

    T.test('ninguna clase repite glifo entre sus habilidades', function () {
      var byClass = abilitiesByClass();
      var offenders = [];
      for (var classId in byClass) {
        if (!Object.prototype.hasOwnProperty.call(byClass, classId)) continue;
        var seen = {};
        var list = byClass[classId];
        for (var i = 0; i < list.length; i++) {
          var g = Icons.glyphOf(list[i]);
          (seen[g] = seen[g] || []).push(list[i].id);
        }
        for (var g2 in seen) {
          if (!Object.prototype.hasOwnProperty.call(seen, g2)) continue;
          if (seen[g2].length > 1) {
            offenders.push(classId + ' → ' + g2 + ': ' + seen[g2].join(', '));
          }
        }
      }
      T.assertEqual(offenders.length, 0,
        'iconos repetidos dentro de una clase: ' + offenders.join(' | '));
    });

    T.test('los 410 poderes importados tienen firma de icono globalmente única', function () {
      var seen = {}, dup = [], total = 0;
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        var ab = Arena.Data.abilities[id];
        if (!ab.sourceDerived) continue;
        total++;
        var sig = ab.iconMeta && ab.iconMeta.signature;
        if (!sig) { dup.push(id + ' sin signature'); continue; }
        if (seen[sig]) dup.push(id + ' = ' + seen[sig]);
        seen[sig] = id;
      }
      T.assertEqual(total, 410, 'deben auditarse las 410 asignaciones');
      T.assertEqual(dup.length, 0, 'firmas de icono repetidas: ' + dup.join(' | '));
    });

    T.test('los 410 SVG visibles importados también son distintos entre sí', function () {
      var seen = {}, dup = [], total = 0;
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        var ab = Arena.Data.abilities[id];
        if (!ab.sourceDerived) continue;
        total++;
        var svg = Icons.svg(ab);
        if (seen[svg]) dup.push(id + ' = ' + seen[svg]);
        seen[svg] = id;
      }
      T.assertEqual(total, 410, 'deben renderizarse las 410 asignaciones');
      T.assertEqual(dup.length, 0, 'SVG visibles repetidos: ' + dup.join(' | '));
    });

    T.test('todas las habilidades producen un SVG con contenido', function () {
      var empty = [];
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        var svg = Icons.svg(Arena.Data.abilities[id]);
        // Un icono vacío o sin trazos es un placeholder disfrazado.
        if (!svg || svg.length < 120 || svg.indexOf('<path') < 0) empty.push(id);
      }
      T.assertEqual(empty.length, 0, 'iconos vacíos o sin trazo: ' + empty.join(', '));
    });

    T.test('cada glifo declarado existe como forma dibujable', function () {
      var missing = [];
      for (var id in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, id)) continue;
        var ab = Arena.Data.abilities[id];
        var g = Icons.glyphOf(ab);
        if (ab.sourceDerived) {
          var shape = Icons.sourceShape && Icons.sourceShape(ab);
          if (!shape || shape.indexOf('<path') < 0) missing.push(id + ' → sourceShape vacío');
        } else if (!Icons.SHAPES[g]) missing.push(id + ' → ' + g);
      }
      T.assertEqual(missing.length, 0,
        'glifos sin forma asociada (caerían al genérico): ' + missing.join(', '));
    });

    T.test('el color del icono distingue la clase', function () {
      // Dos clases con la misma paleta harían indistinguibles dos barras.
      var seen = {};
      var classes = ['devastador', 'guardian', 'centinela', 'rastreador', 'arcanista', 'vinculador'];
      for (var i = 0; i < classes.length; i++) {
        var pal = Icons.paletteOf(classes[i]);
        var key = String(pal.a) + '|' + String(pal.b);
        T.assertFalse(!!seen[key], classes[i] + ' comparte paleta con ' + seen[key]);
        seen[key] = classes[i];
      }
    });
  });
});
