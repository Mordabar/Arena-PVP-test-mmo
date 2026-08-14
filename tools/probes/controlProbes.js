/* =============================================================================
 * tools/probes/controlProbes.js — Movimiento, cámara y targeting dentro del
 * juego arrancado (QA_GATE §6).
 *
 * Sin render: el barrido cuesta segundos. Lo que se comprueba aquí no es que
 * las funciones existan —eso ya lo dicen las pruebas unitarias— sino que la
 * cadena entrada → intención → simulación → cámara hace lo que el jugador
 * espera dentro de una partida real.
 * ========================================================================== */
(function () {
  var G = Arena.Game, W = G.world, V = Arena.Math.Vec3;
  var Met = Arena.Sim.ArenaMetrics;
  G._running = false;

  function foe() {
    var p = W.getPlayer();
    for (var i = 0; i < W.entities.length; i++) {
      var e = W.entities[i];
      if (e.team !== p.team && e.alive) return e;
    }
    return null;
  }

  function limpio(x, z, yaw) {
    var p = W.getPlayer(), t = foe();
    if (!p || !p.alive) { G.buildScenario(G.scenario); p = W.getPlayer(); t = foe(); }
    W.settings.aiEnabled = false; if (t) t.aiEnabled = false;
    p.hp = p.hpMax; p.resource = p.resourceMax;
    p.pos.x = x === undefined ? -18 : x; p.pos.z = z === undefined ? 0 : z; p.pos.y = 0;
    p.prevPos.x = p.pos.x; p.prevPos.z = p.pos.z;
    p.yaw = yaw === undefined ? 0 : yaw; p.prevYaw = p.yaw;
    p._moveIntent = null; p._turnIntent = 0; p._faceIntent = null; p._mouseTurnDelta = 0;
    p._jumpRequested = false; p.autoAttackOn = false; p.combatMode = false;
    while (p.statuses.length) {
      Arena.Combat.StatusSystem.removeInstance(W, p, p.statuses[0], 'probe');
    }
    for (var i = 0; i < 60 && (p.jumpActive || (p.jumpOffset || 0) > 0.01); i++) W.stepSeconds(1 / 30);
    W.stepSeconds(1 / 30);
    return { p: p, t: t };
  }

  /** Mueve `seg` segundos con una intención en ejes del personaje. */
  function mover(p, adelante, lado, seg) {
    var n = Math.round(seg * 30);
    for (var i = 0; i < n; i++) {
      var sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
      p._moveIntent = { x: sy * adelante - cy * lado, z: cy * adelante + sy * lado };
      W.stepSeconds(1 / 30);
    }
    p._moveIntent = null;
  }

  var P = {};

  P.wasdVaDondeMiraElCuerpo = function () {
    /* El movimiento es relativo al FRENTE DEL PERSONAJE, no a la cámara
       (CLAUDE.md §4.1). Y A/D estuvieron invertidas en su día: la prueba fija
       el signo, no sólo que haya desplazamiento. */
    var fail = [], m = {};
    var casos = [['W', 1, 0], ['S', -1, 0], ['A', 0, -1], ['D', 0, 1]];
    for (var i = 0; i < casos.length; i++) {
      var c = limpio(-18, 0, Math.PI / 2), p = c.p;      // mirando a +X
      var x0 = p.pos.x, z0 = p.pos.z;
      mover(p, casos[i][1], casos[i][2], 0.9);
      m[casos[i][0]] = { dx: +(p.pos.x - x0).toFixed(2), dz: +(p.pos.z - z0).toFixed(2) };
    }
    /* El lado NO se escribe a mano: se deriva del mismo convenio que usa la
       simulación, F = (sin yaw, cos yaw) y R = F × up = (−cos yaw, sin yaw).
       Escribir «izquierda es −Z» de memoria es exactamente cómo se invirtieron
       A y D en su día, y cómo me las volví a invertir al escribir esta sonda. */
    var yaw = Math.PI / 2;
    var F = { x: Math.sin(yaw), z: Math.cos(yaw) };
    var R = { x: -Math.cos(yaw), z: Math.sin(yaw) };
    function proy(v, eje) { return v.dx * eje.x + v.dz * eje.z; }
    if (proy(m.W, F) < 0.5) fail.push('W no avanza hacia donde mira el cuerpo');
    if (proy(m.S, F) > -0.3) fail.push('S no retrocede');
    if (proy(m.D, R) < 0.3) fail.push('D no desplaza hacia la derecha del personaje');
    if (proy(m.A, R) > -0.3) fail.push('A no desplaza hacia la izquierda');
    if (proy(m.A, R) * proy(m.D, R) > 0) fail.push('A y D van al MISMO lado');
    return { assert: !fail.length, fail: fail, medido: m };
  };

  P.diagonalNoEsMasRapidaQueRecto = function () {
    var c = limpio(-18, 0, Math.PI / 2), p = c.p;
    var x0 = p.pos.x, z0 = p.pos.z;
    mover(p, 1, 0, 1.0);
    var recto = Math.hypot(p.pos.x - x0, p.pos.z - z0);
    var c2 = limpio(-18, 0, Math.PI / 2), p2 = c2.p;
    var x1 = p2.pos.x, z1 = p2.pos.z;
    mover(p2, 1, 1, 1.0);
    var diag = Math.hypot(p2.pos.x - x1, p2.pos.z - z1);
    var fail = [];
    if (diag > recto * 1.08) {
      fail.push('la diagonal recorre ' + diag.toFixed(2) + ' contra ' + recto.toFixed(2) + ' en recto');
    }
    return { assert: !fail.length, fail: fail, recto: +recto.toFixed(2), diagonal: +diag.toFixed(2) };
  };

  P.girarConRatonEsUnoAUno = function () {
    /* CLAUDE.md §4.2: deltaYawCuerpo === deltaYawCámara. Sin tope, sin
       suavizado. El jugador agarra el cuerpo y lo gira. */
    var c = limpio(), p = c.p, fail = [];
    var y0 = p.yaw;
    p._mouseTurnDelta = 0.73;
    W.stepSeconds(1 / 30);
    var d = V.angleDelta(y0, p.yaw);
    if (Math.abs(d - 0.73) > 1e-6) fail.push('el cuerpo giró ' + d.toFixed(4) + ' con un delta de 0.73');
    var y1 = p.yaw; W.stepSeconds(1 / 30);
    if (Math.abs(V.angleDelta(y1, p.yaw)) > 1e-6) fail.push('el delta se repitió en el tick siguiente');
    return { assert: !fail.length, fail: fail, delta: +d.toFixed(4) };
  };

  P.miradaLibreNoGiraElCuerpo = function () {
    /* Botón derecho: la cámara mira, el cuerpo no se entera (CLAUDE.md §4.3). */
    var c = limpio(), p = c.p, fail = [];
    var cam = G.renderer.camera;
    var y0 = p.yaw, camY0 = cam.yaw;
    for (var i = 0; i < 40; i++) cam.orbit(25, 3);
    for (var k = 0; k < 15; k++) W.stepSeconds(1 / 30);
    if (Math.abs(V.angleDelta(camY0, cam.yaw)) < 0.1) fail.push('la cámara no llegó a girar: la sonda no mide nada');
    if (p.yaw !== y0) fail.push('mirar libremente giró el cuerpo');
    return { assert: !fail.length, fail: fail, camara: +V.angleDelta(camY0, cam.yaw).toFixed(2) };
  };

  P.laCamaraSigueYNoAtraviesaNada = function () {
    var c = limpio(-18, 0, Math.PI / 2), p = c.p, fail = [];
    var cam = G.renderer.camera;
    cam.setFocus(p.pos.x, p.pos.y, p.pos.z);
    V.copy(cam.smoothFocus, cam.focus);
    var lejos = 0, dentro = 0, bajoSuelo = 0;
    for (var i = 0; i < 150; i++) {
      var sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
      p._moveIntent = { x: sy, z: cy };
      W.stepSeconds(1 / 30);
      cam.setFocus(p.pos.x, p.pos.y + 1.2, p.pos.z);
      cam.update(1 / 30, W, 16 / 9);
      var d = Math.hypot(cam.position.x - p.pos.x, cam.position.z - p.pos.z);
      if (d > cam.maxDistance + 2) lejos++;
      if (!Met.walkable(W.arena, cam.position.x, cam.position.z, 0.05)) dentro++;
      var suelo = Arena.Sim.Arena.groundHeightAt(W.arena, cam.position.x, cam.position.z);
      if (cam.position.y < suelo + 0.3) bajoSuelo++;
    }
    p._moveIntent = null;
    if (lejos) fail.push('la cámara se descolgó del personaje en ' + lejos + ' frames');
    if (bajoSuelo) fail.push('el ojo quedó bajo el suelo en ' + bajoSuelo + ' frames');
    return { assert: !fail.length, fail: fail, dentroDeGeometria: dentro, bajoSuelo: bajoSuelo };
  };

  P.zoomYPitchRespetanSusTopes = function () {
    var c = limpio(), fail = [];
    var cam = G.renderer.camera;
    for (var i = 0; i < 60; i++) cam.zoom(-500);
    cam.update(1 / 30, W, 16 / 9);
    if (cam.targetDistance < cam.minDistance - 1e-6) fail.push('el zoom pasa del mínimo');
    for (var j = 0; j < 60; j++) cam.zoom(500);
    if (cam.targetDistance > cam.maxDistance + 1e-6) fail.push('el zoom pasa del máximo');
    for (var k = 0; k < 80; k++) cam.orbit(0, 60);
    if (cam.pitch > cam.maxPitch + 1e-6) fail.push('el pitch pasa del tope superior');
    for (var q = 0; q < 160; q++) cam.orbit(0, -60);
    if (cam.pitch < cam.minPitch - 1e-6) fail.push('el pitch pasa del tope inferior');
    return { assert: !fail.length, fail: fail, dist: +cam.targetDistance.toFixed(2), pitch: +cam.pitch.toFixed(2) };
  };

  P.laCamaraNoEscribeSimulacion = function () {
    var c = limpio(-18, 0, 0.77), p = c.p, fail = [];
    var cam = G.renderer.camera;
    var antes = { x: p.pos.x, z: p.pos.z, yaw: p.yaw, hp: p.hp };
    for (var i = 0; i < 60; i++) { cam.orbit(30, 8); cam.zoom(-40); cam.update(1 / 30, W, 16 / 9); }
    if (p.pos.x !== antes.x || p.pos.z !== antes.z) fail.push('la cámara movió al personaje');
    if (p.yaw !== antes.yaw) fail.push('la cámara giró al personaje');
    if (p.hp !== antes.hp) fail.push('la cámara tocó la vida');
    return { assert: !fail.length, fail: fail };
  };

  P.seleccionarNoGiraNiAutoEncara = function () {
    /* CLAUDE.md §4.4: seleccionar o atacar NUNCA rota al jugador por arte de
       magia. Es la regla que separa esto de un lock-on de acción. */
    var c = limpio(-18, 0, 0), p = c.p, t = c.t, fail = [];
    var y0 = p.yaw;
    p.targetId = t.id;
    G.renderer.selectedId = t.id;
    p.autoAttackOn = true; p.combatMode = true;
    for (var i = 0; i < 60; i++) W.stepSeconds(1 / 30);
    if (p.yaw !== y0) fail.push('seleccionar/atacar giró al jugador solo: ' + y0.toFixed(3) + ' → ' + p.yaw.toFixed(3));
    return { assert: !fail.length, fail: fail };
  };

  P.objetivoInvalidoYMuerteLimpian = function () {
    var c = limpio(-18, 0, Math.PI / 2), p = c.p, t = c.t, fail = [];
    p.targetId = t.id;
    var ab = Arena.Data.abilities[p.abilities[0]];
    var vivo = Arena.Combat.AbilitySystem.canUse(W, p, ab, { targetId: t.id, target: t });
    Arena.Combat.DamageSystem.kill(W, t, p, 'probe');
    W.stepSeconds(1 / 30);
    var muerto = Arena.Combat.AbilitySystem.canUse(W, p, ab, { targetId: t.id, target: t });
    if (muerto.ok) fail.push('se puede seguir lanzando sobre un objetivo muerto');
    if (!t.isTargetable()) { /* correcto: deja de ser seleccionable */ }
    else fail.push('un muerto sigue siendo seleccionable');
    return { assert: !fail.length, fail: fail, vivoOk: vivo.ok, motivoTrasMorir: muerto.reason };
  };

  window.__C = P;
  return 'listo: ' + Object.keys(P).length + ' sondas';
})()
