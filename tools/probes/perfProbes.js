/* =============================================================================
 * tools/probes/perfProbes.js — Puerta de rendimiento (QA_GATE §14).
 *
 * Dos advertencias honestas sobre lo que estos números significan:
 *
 * 1. Este contenedor NO TIENE GPU. Chromium rasteriza por software con
 *    SwiftShader, así que los FPS medidos aquí NO son los FPS del jugador y
 *    sería deshonesto publicarlos como tales. Lo que sí es válido y portable es
 *    todo lo demás: coste por frame de la SIMULACIÓN (que no toca GPU), número
 *    de draw calls, triángulos, partículas vivas, y fugas.
 *
 * 2. Por eso la puerta mide PRESUPUESTOS Y FUGAS, no fotogramas. Un
 *    presupuesto de dibujo que se dispara o una fuga tras diez partidas se
 *    detectan igual sin GPU; una cifra de FPS por software no dice nada.
 * ========================================================================== */
(function () {
  var G = Arena.Game, W = G.world;
  G._running = false;

  function contarVfx() {
    var v = Arena.Render.VFX;
    if (!v || !v.particles) return { vivas: 0, pool: 0 };
    var n = 0;
    for (var i = 0; i < v.particles.length; i++) if (v.particles[i].alive) n++;
    return { vivas: n, pool: v.particles.length };
  }

  function nodosUI() { return document.querySelectorAll('#hud *, .arena-shell *').length; }

  var P = {};

  P.costeDeSimulacionPorTick = function () {
    /* La simulación es el único reloj que el jugador nota en las manos. Corre a
       30 Hz: cada tick tiene 33.3 ms de presupuesto y debe sobrarle casi todo,
       porque el resto del frame es dibujar. */
    G.startMatch('2v2', 'devastador');
    for (var i = 0; i < 80 && G.flow.phase !== 'ACTIVE'; i++) G.flow.update(0.25);
    W.settings.aiEnabled = true;
    var t0 = performance.now();
    var N = 900;                       // 30 s de combate real con bots activos
    for (var k = 0; k < N; k++) W.stepSeconds(1 / 30);
    var ms = (performance.now() - t0) / N;
    var fail = [];
    if (ms > 33.3) fail.push('un tick cuesta ' + ms.toFixed(2) + ' ms: no cabe en 30 Hz');
    else if (ms > 8) fail.push('un tick cuesta ' + ms.toFixed(2) + ' ms: deja poco margen para dibujar');
    return { assert: !fail.length, fail: fail, msPorTick: +ms.toFixed(3),
             presupuesto: 33.3, entidades: W.entities.length };
  };

  P.presupuestoDeDibujoEnCombate = function () {
    var r = G.renderer;
    G.startMatch('2v2', 'arcanista');
    for (var i = 0; i < 80 && G.flow.phase !== 'ACTIVE'; i++) G.flow.update(0.25);
    W.settings.aiEnabled = true;
    var picoDraw = 0, picoTri = 0;
    for (var k = 0; k < 240; k++) {
      W.stepSeconds(1 / 60);
      r.syncVisuals(1 / 60);
      if (Arena.Render.VFX) Arena.Render.VFX.update(1 / 60);
      if (k % 4 === 0) {
        r.render(1, 1 / 60);
        if (r.stats.drawCalls > picoDraw) picoDraw = r.stats.drawCalls;
        if (r.stats.triangles > picoTri) picoTri = r.stats.triangles;
      }
    }
    var fail = [];
    if (picoDraw > 900) fail.push('pico de ' + picoDraw + ' draw calls en un 2v2');
    if (picoTri > 400000) fail.push('pico de ' + Math.round(picoTri) + ' triángulos');
    return { assert: !fail.length, fail: fail, drawCalls: picoDraw, triangulos: Math.round(picoTri) };
  };

  P.lasParticulasEstanAcotadas = function () {
    /* Un burst de 2v2 no puede reventar el pool. Si crece sin techo, el tirón
       llega justo en el momento de más información en pantalla. */
    G.startMatch('2v2', 'arcanista');
    for (var i = 0; i < 80 && G.flow.phase !== 'ACTIVE'; i++) G.flow.update(0.25);
    W.settings.aiEnabled = true;
    Arena.Render.VFX.clear();
    var poolInicial = contarVfx().pool, pico = 0;
    for (var k = 0; k < 600; k++) {
      W.stepSeconds(1 / 60);
      G.renderer.syncVisuals(1 / 60);
      Arena.Render.VFX.update(1 / 60);
      var c = contarVfx();
      if (c.vivas > pico) pico = c.vivas;
    }
    var poolFinal = contarVfx().pool;
    /* Y se apagan al dejar de pelear DE VERDAD. Apagar la IA no basta:
       `autoAttackOn` es una bandera por entidad, así que los bots siguen
       soltando mandobles y el «residuo» que se mide es combate en curso, no una
       fuga. Comprobado: sin combate real, la cuenta vuelve a 0. */
    W.settings.aiEnabled = false;
    for (var e = 0; e < W.entities.length; e++) {
      W.entities[e].autoAttackOn = false;
      W.entities[e].combatMode = false;
      Arena.Combat.AbilitySystem.cancelCast(W, W.entities[e], 'perf');
      while (W.entities[e].statuses.length) {
        Arena.Combat.StatusSystem.removeInstance(W, W.entities[e], W.entities[e].statuses[0], 'perf');
      }
    }
    W.projectiles.length = 0;
    for (var q = 0; q < 600; q++) { W.stepSeconds(1 / 60); Arena.Render.VFX.update(1 / 60); }
    var alFinal = contarVfx().vivas;
    var fail = [];
    if (poolFinal > 4000) fail.push('el pool creció hasta ' + poolFinal);
    if (alFinal > 0) fail.push('quedan ' + alFinal + ' partículas vivas 10 s después de dejar de pelear');
    return { assert: !fail.length, fail: fail, pico: pico, poolInicial: poolInicial,
             poolFinal: poolFinal, tras10s: alFinal };
  };

  P.diezPartidasNoDejanBasura = function () {
    /* La prueba de fuga que pide QA_GATE §14. Diez ciclos completos de
       partida y reinicio: si algo se acumula —entidades, proyectiles, nodos de
       DOM, oyentes del bus— aquí se ve como una pendiente. */
    var muestras = [];
    for (var ronda = 0; ronda < 10; ronda++) {
      G.startMatch(ronda % 2 ? '2v2' : '1v1', 'devastador');
      for (var i = 0; i < 80 && G.flow.phase !== 'ACTIVE'; i++) G.flow.update(0.25);
      W.settings.aiEnabled = true;
      for (var k = 0; k < 120; k++) { W.stepSeconds(1 / 30); G.renderer.syncVisuals(1 / 30); }
      G.enterLobby();
      for (var q = 0; q < 30; q++) { W.stepSeconds(1 / 30); G.renderer.syncVisuals(1 / 30); }
      var visuales = 0; for (var vk in G.renderer.visuals) visuales++;
      muestras.push({
        entidades: W.entities.length,
        proyectiles: W.projectiles.length,
        zonas: W.zones.length,
        visuales: visuales,
        dom: nodosUI(),
        oyentes: (W.bus && W.bus._handlers)
          ? Object.keys(W.bus._handlers).reduce(function (a, k2) { return a + W.bus._handlers[k2].length; }, 0)
          : -1
      });
    }
    var a = muestras[1], z = muestras[muestras.length - 1];   // la 0 monta cosas
    var fail = [];
    if (z.entidades > a.entidades) fail.push('entidades: ' + a.entidades + ' → ' + z.entidades);
    if (z.proyectiles > 0) fail.push('quedan ' + z.proyectiles + ' proyectiles tras volver al lobby');
    if (z.zonas > 0) fail.push('quedan ' + z.zonas + ' zonas');
    if (z.visuales > a.visuales) fail.push('visuales: ' + a.visuales + ' → ' + z.visuales);
    if (z.dom > a.dom * 1.15 + 20) fail.push('nodos de DOM: ' + a.dom + ' → ' + z.dom);
    if (z.oyentes >= 0 && z.oyentes > a.oyentes) fail.push('oyentes del bus: ' + a.oyentes + ' → ' + z.oyentes);
    return { assert: !fail.length, fail: fail, primera: a, ultima: z };
  };

  window.__PERF = P;
  return 'listo: ' + Object.keys(P).length + ' sondas';
})()
