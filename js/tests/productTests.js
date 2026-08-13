/* =============================================================================
 * productTests.js — Vertical Slice product loop: ladder + match-state.
 * ========================================================================== */
Arena.define('tests/productTests', ['tests/testRunner', 'product/matchFlow'], function (Arena) {
  'use strict';
  var T = Arena.Tests;
  var L = Arena.Product.Ladder;

  T.suite('Vertical Slice · ladder local reemplazable', function () {
    T.test('los tiers se resuelven por rating y exponen progreso', function () {
      var r = L.rankFor(1200);
      T.assertEqual(r.id, 'aether');
      T.assertBetween(r.progress, 0.49, 0.51);
      T.assert(r.next && r.next.id === 'vanguard');
    });

    T.test('ganar suma rating y perder resta con delta visible', function () {
      var p = L.defaultProfile();
      p.placementRemaining = 0;
      var w = L.applyResult(p, { won:true, opponentRating:1000, mode:'1v1', classId:'devastador' });
      T.assert(w.delta >= 6, 'victoria debe sumar');
      var l = L.applyResult(w.profile, { won:false, opponentRating:1000, mode:'1v1', classId:'devastador' });
      T.assert(l.delta <= -6, 'derrota debe restar');
      T.assertEqual(l.profile.matches, 2);
      T.assertEqual(l.profile.wins, 1);
      T.assertEqual(l.profile.losses, 1);
    });

    T.test('los posicionamientos consumen una partida y usan K más alto', function () {
      var p = L.defaultProfile();
      var deltaPlacement = L.previewDelta(p, true, 1000, '1v1');
      var normal = L.defaultProfile(); normal.placementRemaining = 0;
      var deltaNormal = L.previewDelta(normal, true, 1000, '1v1');
      T.assert(deltaPlacement > deltaNormal);
      var r = L.applyResult(p, { won:true, opponentRating:1000, mode:'1v1' });
      T.assertEqual(r.profile.placementRemaining, 2);
    });

    T.test('storage corrupto no rompe boot y vuelve al perfil seguro', function () {
      var fake = { getItem:function(){return '{mal json';}, setItem:function(){} };
      var store = L.makeStorage(fake);
      var p = store.load();
      T.assertEqual(p.rating, 1000);
      T.assertEqual(p.placementRemaining, 3);
    });
  });

  T.suite('Vertical Slice · match flow', function () {
    T.test('lobby → countdown → active es determinista', function () {
      var f = new Arena.Product.MatchFlow({ profile:L.defaultProfile() });
      f.begin('1v1', 'centinela', 3);
      T.assertEqual(f.phase, 'COUNTDOWN');
      f.update(2.9); // update limita a .25 por frame: simulamos pasos de frame reales
      for (var i=0;i<12;i++) f.update(.25);
      T.assertEqual(f.phase, 'ACTIVE');
      T.assertEqual(f.classId, 'centinela');
    });

    T.test('training entra activo y nunca genera resultado ladder', function () {
      var f = new Arena.Product.MatchFlow({ profile:L.defaultProfile() });
      f.begin('training', 'arcanista', 0);
      T.assertEqual(f.phase, 'ACTIVE');
      T.assertEqual(f.finish(0, {}), null);
      T.assertEqual(f.profile.matches, 0);
    });

    T.test('finish sólo se acepta durante match activo y guarda stats/result', function () {
      var f = new Arena.Product.MatchFlow({ profile:L.defaultProfile() });
      T.assertEqual(f.finish(0, {}), null);
      f.begin('2v2', 'vinculador', 0);
      f.update(.01);
      var result = f.finish(0, { opponentRating:1040, opponent:'Arcanista', stats:{damage:420,healing:900,interrupts:2} });
      T.assert(result && result.won);
      T.assertEqual(f.phase, 'RESULTS');
      T.assertEqual(f.profile.matches, 1);
      T.assertEqual(result.stats.healing, 900);
    });

    T.test('doble KO produce empate sin rating fantasma', function () {
      var f = new Arena.Product.MatchFlow({ profile:L.defaultProfile() });
      f.begin('1v1', 'devastador', 0); f.update(.01);
      var before = f.profile.rating;
      var result = f.finish(-1, { opponentRating:1000, opponent:'Centinela' });
      T.assert(result && result.draw, 'debe marcar empate');
      T.assertEqual(result.delta, 0);
      T.assertEqual(f.profile.rating, before);
      T.assertEqual(f.profile.matches, 1);
      T.assertEqual(f.profile.wins, 0);
      T.assertEqual(f.profile.losses, 0);
      T.assertEqual(f.profile.recent[0].result, 'draw');
    });

    T.test('volver al lobby limpia resultado sin borrar progresión', function () {
      var f = new Arena.Product.MatchFlow({ profile:L.defaultProfile() });
      f.begin('1v1', 'guardian', 0); f.update(.01); f.finish(1, { opponentRating:1000 });
      var rating = f.profile.rating;
      f.enterLobby();
      T.assertEqual(f.phase, 'LOBBY');
      T.assertEqual(f.result, null);
      T.assertEqual(f.profile.rating, rating);
    });
  });
});
