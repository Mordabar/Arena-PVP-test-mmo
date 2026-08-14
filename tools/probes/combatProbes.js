/* =============================================================================
 * tools/probes/combatProbes.js — Las familias de QA_GATE §4 y §5, ejecutadas
 * dentro del juego real.
 *
 * Estas reglas ya tienen pruebas unitarias verdes. Lo que falta es verlas por
 * la RUTA REAL DEL JUGADOR en una instancia arrancada: el mismo `_useSlot` que
 * usan las teclas 1..6, el mismo bucle, el mismo mundo. Es la diferencia entre
 * TESTED y VERIFIED que ya costó un P0 esta sesión.
 *
 * No pinta nada a propósito: sin render, el barrido entero cuesta segundos.
 * ========================================================================== */
(function () {
  var G = Arena.Game, W = G.world;
  var Ab = Arena.Combat.AbilitySystem, St = Arena.Combat.StatusSystem;
  var Met = Arena.Sim.ArenaMetrics;

  G._running = false;                 // el bucle rAF contaminaría cada sonda

  function foe() {
    var p = W.getPlayer();
    for (var i = 0; i < W.entities.length; i++) {
      var e = W.entities[i];
      if (e.team !== p.team && e.alive) return e;
    }
    return null;
  }

  /** Coloca al jugador a `d` del enemigo, con visión comprobada y encarado. */
  function place(p, t, d) {
    for (var a = 0; a < 360; a += 7) {
      var r = a * Math.PI / 180;
      var x = t.pos.x + Math.cos(r) * d, z = t.pos.z + Math.sin(r) * d;
      if (!Met.walkable(W.arena, x, z, 0.6)) continue;
      p.pos.x = x; p.pos.z = z; p.prevPos.x = x; p.prevPos.z = z;
      p.yaw = Math.atan2(t.pos.x - x, t.pos.z - z); p.prevYaw = p.yaw;
      if (W.hasLineOfSight(p.eyePos(), t.centerPos(), p, t)) return true;
    }
    return false;
  }

  /** Estado limpio y repetible. `d` = distancia al enemigo. */
  function setup(clase, d) {
    W.settings.aiEnabled = false;
    /* Reconstruir si hace falta. Una sonda anterior mata al jugador a propósito
       —para comprobar que un proyectil ya liberado le sobrevive— y devolverle
       la vida no lo resucita: `alive` sigue en false y todo lo siguiente
       recibiría `dead`. Reconstruir el escenario es lo que hace el juego cuando
       cambias de clase, así que es la misma puerta que usa el jugador. */
    var vivo = W.getPlayer();
    if ((clase && G.playerClass !== clase) || !vivo || !vivo.alive) {
      G.setPlayerClass(clase || G.playerClass);
      G.buildScenario(G.scenario);
    }
    var p = W.getPlayer(), t = foe();
    t.aiEnabled = false; t.hpMax = 500000; t.hp = 500000;
    p.hp = p.hpMax; p.resource = p.resourceMax;
    p.gcdUntil = 0; p.cooldowns = Object.create(null); p.schoolLockouts = Object.create(null);
    Ab.cancelCast(W, p, 'probe');
    p.pendingCast = null; p.queuedAction = null; p.queued = null;
    p._moveIntent = null; p._jumpRequested = false;
    /* Aterrizar antes de medir. La sonda del salto deja al jugador en el aire y
       el juego —con razón— rechaza castear en vuelo; sin esto, la sonda
       siguiente recibe `airborne` y parece un defecto de casteo. */
    for (var s0 = 0; s0 < 90 && (p.jumpActive || (p.jumpOffset || 0) > 0.01); s0++) W.stepSeconds(1 / 30);
    while (p.statuses.length) St.removeInstance(W, p, p.statuses[0], 'probe');
    while (t.statuses.length) St.removeInstance(W, t, t.statuses[0], 'probe');
    var colocado = place(p, t, d === undefined ? 2.2 : d);
    p.targetId = t.id;
    p.autoAttackOn = false; p.combatMode = false;
    W.stepSeconds(1 / 30);
    return { p: p, t: t, colocado: colocado };
  }

  function step(s) { W.stepSeconds(s); }
  function weapon(p) { return Ab._weapon(p); }
  /** Avanza hasta que el arma alcance una fase, o se agote el margen. */
  function untilPhase(p, phase, max) {
    var n = Math.ceil((max || 4) * 30);
    for (var i = 0; i < n; i++) { step(1 / 30); if (weapon(p).phase === phase) return true; }
    return false;
  }
  function slotDe(p, id) { return p.abilities.indexOf(id); }

  var P = {};

  /* --- QA_GATE §4 · ataque normal ---------------------------------------- */

  P.normalNoLiberaEnMovimiento = function () {
    var c = setup('devastador', 2.2), p = c.p, t = c.t, fail = [];
    p.autoAttackOn = true; p.combatMode = true;
    var hp0 = t.hp;
    for (var i = 0; i < 90; i++) { p._moveIntent = { x: 1, z: 0 }; step(1 / 30); }
    p._moveIntent = null;
    if (t.hp < hp0) fail.push('el normal aplicó daño mientras el jugador corría: ' + (hp0 - t.hp).toFixed(1));
    return { assert: !fail.length, fail: fail, dano: +(hp0 - t.hp).toFixed(1) };
  };

  P.pararNoObligaAEsperarIntervaloEntero = function () {
    /* El ritmo táctico del juego es mover → parar → normal → poder → mover.
       Si parar obligara a esperar un intervalo de arma completo, ese ritmo
       moriría y el jugador aprendería a no moverse. */
    var c = setup('devastador', 2.2), p = c.p, fail = [];
    p.autoAttackOn = true; p.combatMode = true;
    for (var i = 0; i < 120; i++) { p._moveIntent = { x: 1, z: 0 }; step(1 / 30); }
    p._moveIntent = null;
    place(p, c.t, 2.2);
    var t0 = W.time;
    var arrancó = untilPhase(p, 'WINDUP', 1.2);
    var espera = W.time - t0;
    var intervalo = weapon(p).interval || 2.0;
    if (!arrancó) fail.push('tras parar, el normal no arrancó en 1.2 s');
    else if (espera > intervalo * 0.6) {
      fail.push('esperó ' + espera.toFixed(2) + ' s de un intervalo de ' + intervalo.toFixed(2));
    }
    return { assert: !fail.length, fail: fail, espera: +espera.toFixed(2), intervalo: +intervalo.toFixed(2) };
  };

  P.moverseDuranteWindupCancelaSinDano = function () {
    var c = setup('devastador', 2.2), p = c.p, t = c.t, fail = [];
    p.autoAttackOn = true; p.combatMode = true;
    if (!untilPhase(p, 'WINDUP', 3)) fail.push('no se llegó a WINDUP');
    var hp0 = t.hp;
    p._moveIntent = { x: 1, z: 0 }; step(1 / 30); step(1 / 30);
    var fase = weapon(p).phase;
    p._moveIntent = null;
    if (fase === 'WINDUP') fail.push('moverse no cortó el windup');
    if (t.hp < hp0) fail.push('un windup cancelado aplicó daño: ' + (hp0 - t.hp).toFixed(1));
    return { assert: !fail.length, fail: fail, faseTrasMover: fase };
  };

  P.danoEmpiezaEnRelease = function () {
    var c = setup('devastador', 2.2), p = c.p, t = c.t, fail = [];
    p.autoAttackOn = true; p.combatMode = true;
    if (!untilPhase(p, 'WINDUP', 3)) fail.push('no se llegó a WINDUP');
    /* El muestreo tiene que quedar DENTRO del windup. Comprobar después del
       paso que ya liberó mide el otro lado de la frontera y acusa al juego de
       algo que hizo bien. */
    var hpEnWindup = t.hp, dañoAntes = 0;
    for (var i = 0; i < 60; i++) {
      if (weapon(p).phase !== 'WINDUP') break;
      if (t.hp !== hpEnWindup) { dañoAntes = hpEnWindup - t.hp; break; }
      step(1 / 30);
    }
    if (dañoAntes > 0) fail.push('hubo daño ANTES de RELEASE: ' + dañoAntes.toFixed(1));
    for (var k = 0; k < 20; k++) step(1 / 30);
    if (t.hp >= hpEnWindup) fail.push('no hubo daño DESPUÉS de RELEASE');
    return { assert: !fail.length, fail: fail, dano: +(hpEnWindup - t.hp).toFixed(1) };
  };

  P.normalValidaFacingRangoYLoS = function () {
    var fail = [];
    var c = setup('devastador', 2.2), p = c.p, t = c.t;
    p.autoAttackOn = true; p.combatMode = true;
    var hp0 = t.hp; for (var i = 0; i < 150; i++) step(1 / 30);
    if (t.hp >= hp0) fail.push('en rango, encarado y con visión NO pegó');

    // De espaldas: mismo sitio, yaw invertido.
    var c2 = setup('devastador', 2.2), p2 = c2.p, t2 = c2.t;
    p2.yaw += Math.PI; p2.prevYaw = p2.yaw;
    p2.autoAttackOn = true; p2.combatMode = true;
    var hpB = t2.hp; for (var j = 0; j < 150; j++) step(1 / 30);
    if (t2.hp < hpB) fail.push('de espaldas SÍ pegó: el arco frontal no se valida');

    // Fuera de rango.
    var c3 = setup('devastador', 14), p3 = c3.p, t3 = c3.t;
    p3.autoAttackOn = true; p3.combatMode = true;
    var hpC = t3.hp; for (var k = 0; k < 150; k++) step(1 / 30);
    if (t3.hp < hpC) fail.push('a 14 u SÍ pegó: el rango no se valida');
    return { assert: !fail.length, fail: fail };
  };

  /* --- QA_GATE §4 · casteo ------------------------------------------------ */

  P.beginNoComprometeNada = function () {
    var c = setup('arcanista', 12), p = c.p, fail = [];
    var id = p.abilities[2], ab = Arena.Data.abilities[id];
    var res0 = p.resource;
    G._useSlot(2);
    if (!p.pendingCast) fail.push('no abrió casteo');
    if (p.resource !== res0) fail.push('BEGIN consumió recurso: ' + res0 + ' → ' + p.resource);
    if ((p.cooldowns[id] || 0) > 0) fail.push('BEGIN arrancó cooldown');
    if (p.gcdUntil > W.time) fail.push('BEGIN arrancó GCD');
    return { assert: !fail.length, fail: fail, habilidad: ab.name };
  };

  P.releaseComprometeUnaSolaVez = function () {
    var c = setup('arcanista', 12), p = c.p, t = c.t, fail = [];
    var id = p.abilities[2], ab = Arena.Data.abilities[id];
    var res0 = p.resource;
    G._useSlot(2);
    step(ab.castTime + 0.1);
    var gasto = res0 - p.resource;
    var cd = p.cooldowns[id] || 0;
    step(1.0);
    if (Math.abs(gasto - ab.cost) > 1.5) fail.push('cobró ' + gasto.toFixed(1) + ' de un coste de ' + ab.cost);
    if (!(cd > 0)) fail.push('no arrancó cooldown en RELEASE');
    /* El recurso regenera, así que `res0 - p.resource` baja con el tiempo. Lo
       que hay que vigilar es un SEGUNDO cobro, no la deriva de la regeneración. */
    if ((res0 - p.resource) > gasto + 1.5) fail.push('el recurso se cobró otra vez tras RELEASE');
    if (!(p.gcdUntil > 0)) fail.push('no arrancó GCD');
    return { assert: !fail.length, fail: fail, gasto: +gasto.toFixed(1), coste: ab.cost };
  };

  P.saltoCancelaCasteoEstacionario = function () {
    var c = setup('arcanista', 12), p = c.p, fail = [];
    var id = p.abilities[2];
    var res0 = p.resource;
    G._useSlot(2);
    if (!p.pendingCast) fail.push('no abrió casteo');
    step(0.2);
    p._jumpRequested = true; step(1 / 30); step(1 / 30);
    if (p.pendingCast) fail.push('saltar no canceló el casteo estacionario');
    if (p.resource !== res0) fail.push('cancelar por salto cobró recurso');
    if ((p.cooldowns[id] || 0) > 0) fail.push('cancelar por salto arrancó cooldown');
    if (p.schoolLockouts && p.schoolLockouts.arcane > 0) fail.push('cancelar voluntario bloqueó la escuela');
    return { assert: !fail.length, fail: fail };
  };

  P.interrupcionEsDistintaDeCancelar = function () {
    /* Cancelar es una decisión mía y no debe castigarme. Que me interrumpan es
       una decisión del rival y sí bloquea la escuela: es su recompensa. */
    var c = setup('arcanista', 12), p = c.p, t = c.t, fail = [];
    G._useSlot(2); step(0.2);
    Ab.cancelCast(W, p, 'player');
    var bloqueoVoluntario = (p.schoolLockouts && p.schoolLockouts.arcane) || 0;

    var c2 = setup('arcanista', 12), p2 = c2.p, t2 = c2.t;
    G._useSlot(2); step(0.2);
    St.apply(W, p2, { effect: 'silence', duration: 1.5, abilityId: 'probe' }, t2);
    step(1 / 30);
    var bloqueoInterrumpido = (p2.schoolLockouts && p2.schoolLockouts.arcane) || 0;
    if (p2.pendingCast) fail.push('el silencio no cortó el casteo');
    if (bloqueoVoluntario > 0) fail.push('cancelar voluntariamente bloqueó la escuela');
    if (!(bloqueoInterrumpido > 0 || p2.hasStatus('silence'))) {
      fail.push('ser interrumpido no dejó ninguna consecuencia distinta');
    }
    return { assert: !fail.length, fail: fail, voluntario: bloqueoVoluntario, interrumpido: bloqueoInterrumpido };
  };

  P.proyectilSobreviveAlLanzador = function () {
    /* RELEASE es irreversible (CLAUDE.md §3): lo que ya salió, ya salió, y que
       maten al lanzador no lo borra del aire. */
    var c = setup('arcanista', 14), p = c.p, t = c.t, fail = [];
    if (!c.colocado) fail.push('el arnés no encontró sitio con visión: la sonda no mide nada');
    var id = p.abilities[2], ab = Arena.Data.abilities[id];
    var chk = Ab.canUse(W, p, ab, { targetId: t.id, target: t });
    G._useSlot(2);
    if (!p.pendingCast) fail.push('el casteo no arrancó — motivo=' + chk.reason);
    step(ab.castTime + 0.05);
    var enVuelo = W.projectiles.length;
    var hp0 = t.hp;
    Arena.Combat.DamageSystem.kill(W, p, t, 'probe');
    step(1.2);
    if (enVuelo < 1) fail.push('RELEASE no creó proyectil');
    if (t.hp >= hp0) fail.push('matar al lanzador borró un proyectil ya liberado');
    return { assert: !fail.length, fail: fail, enVuelo: enVuelo, impacto: +(hp0 - t.hp).toFixed(1) };
  };

  P.enElAireNoSeCasteaNiSeLibera = function () {
    /* QA_GATE §4 lo pide por su nombre: en el aire no se libera nada. Salió de
       un accidente del arnés —una sonda dejó al jugador en vuelo y la siguiente
       recibió `airborne`— y el juego tenía razón. Ahora es cobertura. */
    var c = setup('arcanista', 12), p = c.p, t = c.t, fail = [];
    p._jumpRequested = true; step(1 / 30);
    if (!p.jumpActive) fail.push('el salto no arrancó: la sonda no mide nada');
    var ab = Arena.Data.abilities[p.abilities[2]];
    var chk = Ab.canUse(W, p, ab, { targetId: t.id, target: t });
    G._useSlot(2);
    var casteoEnVuelo = !!p.pendingCast;
    // Y el normal tampoco libera en el aire.
    p.autoAttackOn = true; p.combatMode = true;
    var hp0 = t.hp;
    for (var i = 0; i < 12 && p.jumpActive; i++) step(1 / 30);
    var danoEnVuelo = hp0 - t.hp;
    for (var k = 0; k < 90 && (p.jumpActive || (p.jumpOffset || 0) > 0.01); k++) step(1 / 30);
    if (casteoEnVuelo) fail.push('se pudo abrir un casteo estacionario en el aire');
    if (danoEnVuelo > 0) fail.push('el normal liberó en el aire: ' + danoEnVuelo.toFixed(1));
    return { assert: !fail.length, fail: fail, motivo: chk.reason };
  };

  /* --- QA_GATE §5 · weaving ---------------------------------------------- */

  P.arqueroTejeNormalYPoder = function () {
    var c = setup('centinela', 12), p = c.p, t = c.t, fail = [];
    p.autoAttackOn = true; p.combatMode = true;
    var hp0 = t.hp;
    untilPhase(p, 'RELEASE', 4);
    /* El normal del arquero es un PROYECTIL: al liberar no ha pegado todavía.
       Muestrear en RELEASE mide la flecha en el aire y concluye que no hizo
       daño. Se le da el tiempo de vuelo. */
    step(0.9);
    var trasNormal = t.hp;
    var slot = slotDe(p, 'centinela_flecha_perforante');   // weaveAfterNormal
    if (slot < 0) fail.push('no se encontró la habilidad de weave');
    else {
      G._useSlot(slot);
      step(Arena.Data.abilities['centinela_flecha_perforante'].castTime + 0.9);
    }
    var total = hp0 - t.hp;
    if (!(hp0 - trasNormal > 0)) fail.push('el normal no llegó a pegar');
    if (!(trasNormal - t.hp > 0)) fail.push('el poder tejido tras el normal no pegó');
    return { assert: !fail.length, fail: fail, normal: +(hp0 - trasNormal).toFixed(1), total: +total.toFixed(1) };
  };

  P.replaceNormalNoDejaNormalFantasma = function () {
    var c = setup('devastador', 2.2), p = c.p, t = c.t, fail = [];
    p.autoAttackOn = true; p.combatMode = true;
    untilPhase(p, 'WINDUP', 3);
    var hp0 = t.hp;
    var slot = slotDe(p, 'devastador_golpe_quebrador');    // replacesNormal
    G._useSlot(slot);
    step(Arena.Data.abilities['devastador_golpe_quebrador'].castTime + 0.6);
    var golpes = W.__probeHits || 0;
    if (t.hp >= hp0) fail.push('el reemplazo del normal no pegó nada');
    return { assert: !fail.length, fail: fail, dano: +(hp0 - t.hp).toFixed(1), golpes: golpes };
  };

  P.colaSustituyeLaIntencionAnterior = function () {
    var c = setup('arcanista', 12), p = c.p, t = c.t, fail = [];
    G._useSlot(0);
    step(Arena.Data.abilities[p.abilities[0]].castTime + 0.02);
    var espera = Math.max(0, (p.gcdUntil - W.time) - 0.12);
    if (espera > 0) step(espera);
    G._useSlot(1);
    G._useSlot(3);                                   // la última manda
    var q = p.queuedAction || p.queued;
    var encolada = q ? q.abilityId : null;
    if (encolada !== p.abilities[3]) {
      fail.push('la cola guarda ' + encolada + ' en vez de la última pulsada');
    }
    step(0.8);
    return { assert: !fail.length, fail: fail, encolada: encolada };
  };

  P.hechizoPedidoGanaAlNormalAutomatico = function () {
    /* CLAUDE.md §4.8: GCD y intervalo de arma son relojes distintos, y un
       hechizo pedido tiene prioridad determinista sobre un normal que acaba de
       quedar listo. Si no, el mago dispara báculo cuando quería castear. */
    var c = setup('arcanista', 12), p = c.p, fail = [];
    p.autoAttackOn = true; p.combatMode = true;
    untilPhase(p, 'READY', 4);
    G._useSlot(0);
    step(1 / 30);
    if (!p.pendingCast) fail.push('el hechizo pedido no arrancó: ganó el normal automático');
    return { assert: !fail.length, fail: fail, fase: weapon(p).phase };
  };

  /* --- CC y counters ------------------------------------------------------ */

  P.cadaControlAplicaYExpira = function () {
    var c = setup('devastador', 3), p = c.p, t = c.t, fail = [];
    var ccs = ['knockdown', 'stun', 'root', 'silence', 'disarm', 'slow'];
    var vistos = {};
    for (var i = 0; i < ccs.length; i++) {
      var w2 = setup('devastador', 3);            // mundo limpio: la fatiga de control es real
      St.apply(W, w2.t, { effect: ccs[i], duration: 1.0, abilityId: 'probe', ignoreAntiBuff: true }, w2.p);
      var aplicado = w2.t.hasStatus(ccs[i]);
      step(1.4);
      var expirado = !w2.t.hasStatus(ccs[i]);
      vistos[ccs[i]] = aplicado ? (expirado ? 'aplica y expira' : 'NO EXPIRA') : 'NO APLICA';
      if (!aplicado) fail.push(ccs[i] + ' no se aplicó');
      else if (!expirado) fail.push(ccs[i] + ' no expiró en 1.4 s con duración 1.0');
    }
    return { assert: !fail.length, fail: fail, vistos: vistos };
  };

  P.drReduceYAcabaEnInmunidad = function () {
    var c = setup('devastador', 3), p = c.p, t = c.t, fail = [];
    var B = Arena.Data.balance;
    var antes = B.DR.enabled; B.DR.enabled = true;
    var duraciones = [];
    for (var i = 0; i < 4; i++) {
      while (t.statuses.length) St.removeInstance(W, t, t.statuses[0], 'probe');
      St.apply(W, t, { effect: 'stun', duration: 2.0, abilityId: 'probe', ignoreAntiBuff: true }, p);
      var s = t.getStatus('stun');
      duraciones.push(s ? +(s.endTime - W.time).toFixed(2) : 0);
      step(0.1);
    }
    B.DR.enabled = antes;
    for (var k = 1; k < duraciones.length; k++) {
      if (duraciones[k] > duraciones[k - 1] + 1e-6) {
        fail.push('la aplicación ' + (k + 1) + ' duró MÁS que la anterior: ' + duraciones.join(' → '));
      }
    }
    if (duraciones[duraciones.length - 1] !== 0) {
      fail.push('tras cuatro aplicaciones seguidas no hay inmunidad: ' + duraciones.join(' → '));
    }
    return { assert: !fail.length, fail: fail, duraciones: duraciones };
  };

  P.countersHacenLoQuePrometen = function () {
    var fail = [], visto = {};
    // Barrera absorbe antes que la vida.
    var a = setup('devastador', 3);
    Arena.Combat.HealingSystem.applyBarrier(W, { source: a.p, target: a.p, amount: 300, duration: 10, abilityId: 'probe' });
    var hpAntes = a.p.hp;
    Arena.Combat.DamageSystem.labDamage(W, a.p, 200, 'physical');
    visto.barrera = (a.p.hp === hpAntes) ? 'absorbe' : 'NO absorbe';
    if (a.p.hp !== hpAntes) fail.push('la barrera no absorbió: la vida bajó igual');

    // AntiHeal recorta la curación.
    var b = setup('devastador', 3);
    b.p.hp = b.p.hpMax * 0.5;
    St.apply(W, b.p, { effect: 'antiHeal', duration: 6, abilityId: 'probe', data: { antiHealPct: 0.40 }, ignoreAntiBuff: true }, b.t);
    var h0 = b.p.hp;
    Arena.Combat.HealingSystem.applyHeal(W, { source: null, target: b.p, raw: 300, abilityId: 'probe' });
    var curado = b.p.hp - h0;
    visto.antiHeal = curado.toFixed(0) + ' de 300';
    if (curado > 260) fail.push('antiHeal no recortó la curación: ' + curado.toFixed(0));

    // AntiBuff impide lo positivo.
    var d = setup('devastador', 3);
    St.apply(W, d.p, { effect: 'antiBuff', duration: 6, abilityId: 'probe', ignoreAntiBuff: true }, d.t);
    var okBuff = St.apply(W, d.p, { effect: 'damageAmp', duration: 5, abilityId: 'probe' }, d.p);
    visto.antiBuff = d.p.hasStatus('damageAmp') ? 'NO bloquea' : 'bloquea';
    if (d.p.hasStatus('damageAmp')) fail.push('antiBuff dejó entrar un buff');
    return { assert: !fail.length, fail: fail, visto: visto };
  };

  window.__P = P;
  return 'listo: ' + Object.keys(P).length + ' sondas';
})()
