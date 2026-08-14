/* =============================================================================
 * tests/audioTests.js — El audio existe; esto comprueba que además suena.
 *
 * POR QUÉ ESTA SUITE
 *
 * `js/audio/audio.js` son mil seiscientas líneas que aterrizaron sin que nadie
 * las ejecutara: el agente que las escribió murió por límite externo a mitad de
 * la wave. Que un fichero exista y la página arranque no dice nada sobre si
 * suena algo. Un solo `payload.type` mal leído en `handleEvent` deja el juego
 * mudo con la suite en verde y el arranque sin errores.
 *
 * Aquí se juega una partida de verdad —sin navegador, la simulación no lo
 * necesita— se recogen los eventos que emite el bus y se comprueba que el
 * enrutado los convierte en cues que existen y se pueden sintetizar.
 *
 * NO se comprueba que se oiga bien. Eso es juicio humano y está en el checklist
 * de playtest.
 * ========================================================================== */
Arena.define('tests/audioTests', ['tests/testRunner', 'audio/audio'], function (Arena) {
  'use strict';

  var T = Arena.Tests;
  var A = Arena.Audio;

  /** Partida real de la que se recogen los eventos que emite la simulación. */
  function partidaReal() {
    var world = T.makeWorld({ seed: 7 });
    // Vidas cortas a propósito: una partida de 260 pasos con las vidas de
    // producción no mata a nadie, y sin muerte no se comprueba el sonido de
    // muerte. Es el fixture el que se adapta, no la comprobación la que se
    // relaja.
    var a = T.spawn(world, 'devastador', { id: 'A', team: 0, x: 0, z: 0, hpMax: 260 });
    var b = T.spawn(world, 'arcanista', { id: 'B', team: 1, x: 0, z: 2.0, hpMax: 220 });
    var c = T.spawn(world, 'vinculador', { id: 'C', team: 0, x: -1.2, z: 0, hpMax: 300 });
    a.targetId = b.id; b.targetId = a.id; c.targetId = a.id;

    var vistos = Object.create(null);
    var eventos = [];
    world.bus.onAny(function (p) {
      vistos[p.type] = (vistos[p.type] || 0) + 1;
      eventos.push(p);
    });

    /* El audio es RELATIVO AL JUGADOR: casi todas las rutas preguntan quién es
       para decidir perspectiva, distancia y si el evento le concierne. Sin
       `install()` no hay jugador, todas devuelven null y la partida entera
       parece muda. No lo estaba: era el arnés el que no lo había montado. */
    A.install(world, function () { return 'A'; });

    var AS = Arena.Combat.AbilitySystem;
    a.autoAttackOn = true;
    b.autoAttackOn = true;
    // Se recorre el kit de las tres clases: normales, casteos, control y curas.
    var kits = [[a, Arena.Data.classes[a.classId]], [b, Arena.Data.classes[b.classId]],
                [c, Arena.Data.classes[c.classId]]];
    for (var paso = 0; paso < 260; paso++) {
      if (paso % 9 === 0) {
        for (var k = 0; k < kits.length; k++) {
          var e = kits[k][0], cls = kits[k][1];
          if (!e.alive || !cls) continue;
          var ab = cls.abilities[(paso / 9 | 0) % cls.abilities.length];
          if (ab) AS.tryUse(world, e, ab);
        }
      }
      world.step();
    }
    return { world: world, vistos: vistos, eventos: eventos };
  }

  var CACHE = null;
  function datos() { return CACHE || (CACHE = partidaReal()); }

  T.suite('Audio · el enrutado llega a cues que existen', function () {

    T.test('la mesa de rutas y el banco están completos', function () {
      var rutas = Object.keys(A.routes);
      T.assert(rutas.length >= 20, 'sólo ' + rutas.length + ' rutas de evento');
      var cues = Object.keys(A.bank);
      T.assert(cues.length >= 30, 'sólo ' + cues.length + ' cues en el banco');
      // Cada atajo publicado en `A.sounds` tiene que ser invocable: un nombre
      // que no existe es una llamada que revienta en producción.
      for (var s in A.sounds) {
        if (!Object.prototype.hasOwnProperty.call(A.sounds, s)) continue;
        T.assertEqual(typeof A.sounds[s], 'function', 'atajo ' + s);
      }
    });

    T.test('cada cue del banco se sintetiza en capas audibles', function () {
      var vacios = [];
      for (var id in A.bank) {
        if (!Object.prototype.hasOwnProperty.call(A.bank, id)) continue;
        var spec = A.resolve(id, { distance: 4 });
        if (!spec || !spec.layers || !spec.layers.length) { vacios.push(id); continue; }
        var dur = 0;
        for (var i = 0; i < spec.layers.length; i++) {
          var L = spec.layers[i];
          // El campo es `dur`, no `duration`. La primera versión de esta prueba
          // lo adivinó y declaró mudos cuarenta y cuatro cues que sonaban: un
          // informe falso del arnés, no un defecto del audio.
          dur = Math.max(dur, (L.delay || 0) + (L.dur || 0));
        }
        if (!(dur > 0.005)) vacios.push(id + ' (dura ' + dur.toFixed(3) + ' s)');
      }
      T.assert(!vacios.length, 'cues sin sonido que sintetizar: ' + vacios.join(', '));
    });

    T.test('la síntesis es determinista con la misma semilla', function () {
      // Con un id inexistente `resolve` devuelve null y la comparación pasa
      // sin medir nada. Se exige que el cue exista antes de compararlo.
      T.assert(A.hasCue('normal.swing'), 'el cue de referencia ya no existe');
      A.resetRng(1234);
      var a = JSON.stringify(A.resolve('normal.swing', { distance: 3 }));
      A.resetRng(1234);
      var b = JSON.stringify(A.resolve('normal.swing', { distance: 3 }));
      T.assert(a && a !== 'null', 'resolve devolvió null para un cue real');
      T.assertEqual(a, b, 'dos resoluciones con la misma semilla difieren');
    });

    T.test('la distancia atenúa y nunca amplifica', function () {
      // Devuelve {gain, tone}: la distancia baja el volumen Y apaga el timbre,
      // que es lo que hace que un golpe lejano suene lejano y no sólo bajo.
      var cerca = A.distanceFalloff(1), lejos = A.distanceFalloff(40);
      T.assert(cerca.gain > lejos.gain, 'el sonido lejano no se atenúa');
      T.assert(cerca.gain <= 1.0001, 'el sonido cercano amplifica: ' + cerca.gain);
      T.assert(lejos.gain >= 0, 'ganancia negativa a distancia');
      T.assert(cerca.tone > lejos.tone, 'la distancia no apaga el timbre');
    });
  });

  T.suite('Audio · una partida real produce sonido', function () {

    T.test('los eventos de una partida real encuentran su ruta', function () {
      var d = datos();
      var tipos = Object.keys(d.vistos);
      T.assert(tipos.length >= 10, 'la partida sólo emitió ' + tipos.length + ' tipos de evento');
      /* Estos son los que el jugador TIENE que oír. Si la simulación deja de
         emitir alguno, o alguien le quita la ruta, el juego se queda mudo en esa
         acción y esto lo dice por su nombre. */
      var obligatorios = ['DamageApplied', 'AbilityReleased', 'EntityDied'];
      var sinRuta = [];
      for (var i = 0; i < obligatorios.length; i++) {
        var t = obligatorios[i];
        T.assert(d.vistos[t] > 0, 'la partida no emitió ' + t);
        if (!A.routes[t]) sinRuta.push(t);
      }
      T.assert(!sinRuta.length, 'eventos audibles sin ruta: ' + sinRuta.join(', '));
    });

    T.test('el enrutado devuelve cues existentes para los eventos reales', function () {
      var d = datos();
      var malos = [], sonaron = 0;
      // El historial del bus está topado a 400 entradas; se usa la lista
      // completa capturada durante la partida.
      var hist = d.eventos;
      T.assert(hist.length > 300, 'la partida sólo emitió ' + hist.length + ' eventos');
      for (var i = 0; i < hist.length; i++) {
        var cue = A.handleEvent(hist[i]);
        if (cue === null) continue;
        sonaron++;
        if (!A.hasCue(cue)) malos.push(hist[i].type + ' → «' + cue + '»');
      }
      T.assert(!malos.length, 'cues inexistentes: ' + malos.slice(0, 6).join(', '));
      T.assert(sonaron > 20, 'sólo ' + sonaron + ' eventos de la partida producen sonido');
    });

    T.test('cada motivo de rechazo tiene su familia de sonido', function () {
      /* La misma lección que en el HUD: la lista autoritativa es la de la
         simulación, no una copia. Un motivo nuevo sin sonido deja al jugador sin
         saber por qué no pasó nada. */
      /* `REASONS` mapea CÓDIGO → texto para el jugador. Lo que hay que recorrer
         son las claves; la primera versión recorría los textos y declaró mudos
         los veinticinco motivos porque ninguna frase en español es una clave de
         `DENY_FAMILY`. Y no basta con mirar esa tabla: lo que decide el sonido
         es la ruta completa, incluido su recurso por defecto. */
      datos();   // deja el audio instalado con 'A' como jugador
      var codigos = Object.keys(Arena.Combat.AbilitySystem.REASONS);
      T.assert(codigos.length >= 20, 'sólo ' + codigos.length + ' motivos de rechazo');
      var mudos = [];
      for (var i = 0; i < codigos.length; i++) {
        // `casterId` tiene que ser el jugador: un rechazo ajeno no suena, y con
        // razón — oír el «no puedes» de un bot sería ruido puro.
        var cue = A.handleEvent({ type: 'AbilityRejected', reason: codigos[i], casterId: 'A' });
        if (!cue || !A.hasCue(cue)) mudos.push(codigos[i] + ' → ' + cue);
      }
      T.assert(!mudos.length, 'motivos de rechazo sin sonido: ' + mudos.join(', '));
    });

    T.test('el audio no escribe una sola vez en el mundo', function () {
      /* El bus congela sus payloads en modo estricto, así que una escritura
         lanzaría. Aquí se comprueba lo otro: que atravesar todo el historial por
         `handleEvent` no cambia ni una vida ni una posición. */
      var d = datos();
      var antes = d.world.entities.map(function (e) {
        return e.id + ':' + e.hp.toFixed(3) + ':' + e.pos.x.toFixed(3) + ':' + e.pos.z.toFixed(3);
      }).join('|');
      var hist = d.world.bus.history;
      for (var i = 0; i < hist.length; i++) A.handleEvent(hist[i]);
      var despues = d.world.entities.map(function (e) {
        return e.id + ':' + e.hp.toFixed(3) + ':' + e.pos.x.toFixed(3) + ':' + e.pos.z.toFixed(3);
      }).join('|');
      T.assertEqual(despues, antes, 'el audio mutó el mundo');
    });

    T.test('instalar y desinstalar no deja oyentes colgando', function () {
      var world = T.makeWorld({ seed: 3 });
      var antes = 0, tipo;
      for (tipo in world.bus._handlers) {
        if (Object.prototype.hasOwnProperty.call(world.bus._handlers, tipo)) {
          antes += world.bus._handlers[tipo].length;
        }
      }
      A.install(world, function () { return null; });
      var durante = 0;
      for (tipo in world.bus._handlers) {
        if (Object.prototype.hasOwnProperty.call(world.bus._handlers, tipo)) {
          durante += world.bus._handlers[tipo].length;
        }
      }
      T.assert(durante > antes, 'install no suscribió nada');
      A.uninstall();
      var despues = 0;
      for (tipo in world.bus._handlers) {
        if (Object.prototype.hasOwnProperty.call(world.bus._handlers, tipo)) {
          despues += world.bus._handlers[tipo].length;
        }
      }
      T.assertEqual(despues, antes, 'uninstall dejó oyentes vivos: fuga entre partidas');
    });
  });
});
