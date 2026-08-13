/* =============================================================================
 * product/ladder.js — Perfil competitivo local reemplazable.
 *
 * No decide combate y no toca la simulación. Recibe el RESULTADO de una partida
 * ya resuelta por World/Combat y lo convierte en feedback competitivo local.
 * La interfaz de storage está aislada para reemplazarla por backend autoritativo.
 * ========================================================================== */
Arena.define('product/ladder', [], function (Arena) {
  'use strict';

  var Ladder = {};
  var STORAGE_KEY = 'arena.ladder.profile.v1';

  Ladder.TIERS = [
    { id: 'ember',      name: 'Brasa',      min: 0,    sigil: '◇' },
    { id: 'ironwood',   name: 'Férreo',     min: 900,  sigil: '◆' },
    { id: 'aether',     name: 'Éter',       min: 1100, sigil: '✦' },
    { id: 'vanguard',   name: 'Vanguardia', min: 1300, sigil: '⬢' },
    { id: 'ascendant',  name: 'Ascendente', min: 1500, sigil: '✧' },
    { id: 'mythic',     name: 'Mítico',      min: 1750, sigil: '✹' }
  ];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function safeInt(v, fallback) {
    v = Number(v);
    return isFinite(v) ? Math.round(v) : fallback;
  }
  function defaultProfile() {
    return {
      version: 1,
      name: 'Aspirante',
      rating: 1000,
      placementRemaining: 3,
      wins: 0,
      losses: 0,
      streak: 0,
      bestStreak: 0,
      matches: 0,
      recent: []
    };
  }

  Ladder.defaultProfile = defaultProfile;

  Ladder.sanitize = function (raw) {
    var p = defaultProfile();
    raw = raw || {};
    p.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 24) : p.name;
    p.rating = Math.max(0, Math.min(3000, safeInt(raw.rating, p.rating)));
    p.placementRemaining = Math.max(0, Math.min(10, safeInt(raw.placementRemaining, p.placementRemaining)));
    p.wins = Math.max(0, safeInt(raw.wins, 0));
    p.losses = Math.max(0, safeInt(raw.losses, 0));
    p.streak = safeInt(raw.streak, 0);
    p.bestStreak = Math.max(0, safeInt(raw.bestStreak, 0));
    p.matches = Math.max(p.wins + p.losses, safeInt(raw.matches, p.wins + p.losses));
    if (Array.isArray(raw.recent)) p.recent = raw.recent.slice(0, 8).map(function (m) {
      return {
        result: m && m.result === 'win' ? 'win' : (m && m.result === 'draw' ? 'draw' : 'loss'),
        delta: safeInt(m && m.delta, 0),
        rating: Math.max(0, safeInt(m && m.rating, p.rating)),
        mode: m && m.mode === '2v2' ? '2v2' : '1v1',
        classId: m && m.classId ? String(m.classId) : '',
        opponent: m && m.opponent ? String(m.opponent).slice(0, 32) : ''
      };
    });
    return p;
  };

  Ladder.rankFor = function (rating) {
    rating = safeInt(rating, 0);
    var tier = Ladder.TIERS[0];
    for (var i = 0; i < Ladder.TIERS.length; i++) {
      if (rating >= Ladder.TIERS[i].min) tier = Ladder.TIERS[i];
    }
    var index = Ladder.TIERS.indexOf(tier);
    var next = Ladder.TIERS[index + 1] || null;
    var progress = next ? Math.max(0, Math.min(1, (rating - tier.min) / Math.max(1, next.min - tier.min))) : 1;
    return { id: tier.id, name: tier.name, sigil: tier.sigil, min: tier.min, next: next, progress: progress };
  };

  Ladder.expectedScore = function (rating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
  };

  Ladder.previewDelta = function (profile, won, opponentRating, mode) {
    profile = Ladder.sanitize(profile);
    opponentRating = safeInt(opponentRating, 1000);
    var expected = Ladder.expectedScore(profile.rating, opponentRating);
    var k = profile.placementRemaining > 0 ? 48 : (mode === '2v2' ? 28 : 32);
    var raw = k * ((won ? 1 : 0) - expected);
    // Incluso un favorito obtiene/cede feedback visible; evita resultados ±0.
    return won ? Math.max(6, Math.round(raw)) : Math.min(-6, Math.round(raw));
  };

  Ladder.applyResult = function (profile, result) {
    profile = Ladder.sanitize(profile);
    result = result || {};
    var draw = !!result.draw;
    var won = !draw && !!result.won;
    var before = profile.rating;
    var delta = draw ? 0 : Ladder.previewDelta(profile, won, result.opponentRating, result.mode);
    profile.rating = Math.max(0, Math.min(3000, before + delta));
    profile.matches++;
    if (draw) {
      profile.streak = 0;
    } else if (won) {
      profile.wins++;
      profile.streak = Math.max(1, profile.streak + 1);
      profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
    } else {
      profile.losses++;
      profile.streak = Math.min(-1, profile.streak - 1);
    }
    if (profile.placementRemaining > 0) profile.placementRemaining--;
    profile.recent.unshift({
      result: draw ? 'draw' : (won ? 'win' : 'loss'), delta: delta, rating: profile.rating,
      mode: result.mode === '2v2' ? '2v2' : '1v1',
      classId: result.classId || '', opponent: result.opponent || ''
    });
    profile.recent = profile.recent.slice(0, 8);
    return { profile: profile, before: before, after: profile.rating, delta: delta, rank: Ladder.rankFor(profile.rating) };
  };

  Ladder.makeStorage = function (storage) {
    return {
      load: function () {
        try {
          if (!storage || !storage.getItem) return defaultProfile();
          var raw = storage.getItem(STORAGE_KEY);
          return raw ? Ladder.sanitize(JSON.parse(raw)) : defaultProfile();
        } catch (e) { return defaultProfile(); }
      },
      save: function (profile) {
        var clean = Ladder.sanitize(profile);
        try { if (storage && storage.setItem) storage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch (e) {}
        return clone(clean);
      },
      clear: function () {
        try { if (storage && storage.removeItem) storage.removeItem(STORAGE_KEY); } catch (e) {}
      }
    };
  };

  Arena.Product.Ladder = Ladder;
});
