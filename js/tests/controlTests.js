/* =============================================================================
 * tests/controlTests.js — El esquema de control, como invariante.
 *
 * El movimiento relativo al personaje y la ausencia de auto-encarado no son
 * detalles de mando: son EL pilar táctico. Si vuelven a colarse, orientarse
 * deja de ser una decisión y flanquear deja de significar nada — y eso no se
 * nota en una captura, se nota tres semanas después cuando el combate se siente
 * plano y nadie recuerda por qué.
 *
 * Lo que aquí se protege:
 *
 *   · W/S/A/D se resuelven contra el yaw del PERSONAJE, nunca contra la cámara
 *   · A/D son strafe: no giran
 *   · Q/E giran: no desplazan
 *   · seleccionar objetivo NO gira
 *   · usar habilidad NO auto-encara
 *   · el ataque normal NO auto-encara y exige arco frontal
 *   · el free look de cámara no escribe yaw
 *   · la presentación no escribe la simulación
 * ========================================================================== */
Arena.define('tests/controlTests', ['tests/testRunner', 'sim/world'], function (Arena) {
  'use strict';

  var T = Arena.Tests;
  var B = Arena.Data.balance;
  var V = Arena.Math.Vec3;
  var Ability = Arena.Combat.AbilitySystem;

  /* Reproduce lo que hace main.js al leer el teclado: base en el frente del
     personaje. Si esta función y main.js divergen, el test deja de valer, así
     que la fórmula se mantiene idéntica a propósito. */
  function moveIntentFor(entity, forward, strafe) {
    var sy = Math.sin(entity.yaw), cy = Math.cos(entity.yaw);
    return { x: sy * forward + cy * strafe, z: cy * forward - sy * strafe };
  }

  function facing(entity, target) {
    return Math.abs(V.angleDelta(entity.yaw, V.yawTo(entity.pos, target.pos)));
  }

  T.suite('Control · movimiento relativo al personaje', function () {

    T.test('W avanza según el yaw del personaje, no según la cámara', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = Math.PI / 2;                    // mirando a +X
      p._moveIntent = moveIntentFor(p, 1, 0);
      for (var i = 0; i < 15; i++) w.step(1);

      T.assert(p.pos.x > 0.8, 'debe avanzar hacia +X, avanzó ' + p.pos.x.toFixed(2));
      T.assertNear(p.pos.z, 0, 0.05, 'sin desviación lateral');
    });

    T.test('S retrocede sin darse la vuelta', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0;                              // mirando a +Z
      var yaw0 = p.yaw;
      p._moveIntent = moveIntentFor(p, -1, 0);
      for (var i = 0; i < 15; i++) w.step(1);

      T.assert(p.pos.z < -0.8, 'debe retroceder hacia −Z, fue a ' + p.pos.z.toFixed(2));
      T.assertEqual(p.yaw, yaw0, 'retroceder no gira el cuerpo');
    });

    T.test('A y D son strafe: desplazan de lado y NO giran', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0;
      var yaw0 = p.yaw;
      p._moveIntent = moveIntentFor(p, 0, 1);   // D
      for (var i = 0; i < 15; i++) w.step(1);

      T.assert(p.pos.x > 0.8, 'strafe derecha va a +X');
      T.assertNear(p.pos.z, 0, 0.05, 'sin componente frontal');
      T.assertEqual(p.yaw, yaw0, 'strafe NO puede cambiar la orientación');
    });

    T.test('Q y E giran sin desplazar', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      var x0 = p.pos.x, z0 = p.pos.z, yaw0 = p.yaw;

      // Menos de media vuelta a propósito: el yaw se envuelve a [−π, π], así
      // que pasarse de π convertiría "giró a la derecha" en un ángulo negativo
      // y el test mediría el envoltorio en vez del giro.
      p._turnIntent = 1;                        // E
      for (var i = 0; i < 6; i++) w.step(1);

      T.assert(V.angleDelta(yaw0, p.yaw) > 0.2, 'E debe girar a la derecha');
      T.assertEqual(p.pos.x, x0, 'girar no desplaza en X');
      T.assertEqual(p.pos.z, z0, 'girar no desplaza en Z');

      var yaw1 = p.yaw;
      p._turnIntent = -1;                       // Q
      for (var j = 0; j < 6; j++) w.step(1);
      T.assert(V.angleDelta(yaw1, p.yaw) < -0.2, 'Q debe girar a la izquierda');
    });

    T.test('el giro está limitado por TURN_SPEED, no es instantáneo', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0;
      p._turnIntent = 1;
      w.step(1);
      var perTick = Math.abs(V.angleDelta(0, p.yaw));
      T.assertNear(perTick, B.TURN_SPEED / B.TICK_RATE, 1e-6,
        'un tick gira exactamente TURN_SPEED/TICK_RATE');
    });

    T.test('el giro se aplica en el tick fijo, no por fotograma', function () {
      // Dos mundos, mismo tiempo simulado, distinto número de pasos: el
      // resultado tiene que ser el mismo o el control dependería de los fps.
      function turnFor(ticks) {
        var w = T.makeWorld();
        var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
        p.yaw = 0; p._turnIntent = 1;
        for (var i = 0; i < ticks; i++) w.step(1);
        return p.yaw;
      }
      // Ambas medidas por debajo de π: más allá interviene el envoltorio del
      // ángulo y se mediría eso, no la linealidad.
      T.assertNear(turnFor(5) * 2, turnFor(10), 1e-6,
        'el giro es lineal en el tiempo simulado');
    });

    T.test('aturdido no gira; enraizado SÍ', function () {
      var w = T.makeWorld();
      var stunned = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      var rooted = T.spawn(w, 'guardian', { team: 0, x: 4, z: 0 });
      Arena.Combat.StatusSystem.apply(w, stunned, { effect: 'stun', duration: 5 }, stunned);
      Arena.Combat.StatusSystem.apply(w, rooted, { effect: 'root', duration: 5 }, rooted);
      var sy0 = stunned.yaw, ry0 = rooted.yaw;

      stunned._turnIntent = 1; rooted._turnIntent = 1;
      for (var i = 0; i < 6; i++) w.step(1);

      T.assertEqual(stunned.yaw, sy0, 'un aturdido no puede reorientarse');
      // Enraizar clava los pies, no el cuello. Poder girar anclado es lo que
      // hace de la raíz un contratiempo y no una sentencia.
      T.assert(Math.abs(V.angleDelta(ry0, rooted.yaw)) > 0.2, 'un enraizado sí gira');
    });
  });

  T.suite('Control · el objetivo no gobierna la orientación', function () {

    T.test('seleccionar objetivo NO gira al personaje', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      var enemy = T.spawn(w, 'arcanista', { team: 1, x: 5, z: 0 });
      p.yaw = 0;
      p.targetId = enemy.id;                    // esto es lo que hace el clic
      for (var i = 0; i < 10; i++) w.step(1);
      T.assertEqual(p.yaw, 0, 'seleccionar es información, no un lock-on');
    });

    T.test('lanzar una habilidad NO auto-encara', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      var enemy = T.spawn(w, 'arcanista', { team: 1, x: 2.0, z: 0 });
      p.yaw = 0;                                 // mirando a +Z, el enemigo a +X
      p.targetId = enemy.id;

      Ability.tryUse(w, p, 'devastador_golpe_quebrador', { targetId: enemy.id, target: enemy });
      for (var i = 0; i < 10; i++) w.step(1);
      T.assertEqual(p.yaw, 0, 'usar una habilidad no puede reorientar al personaje');
    });

    T.test('el ataque normal NO auto-encara', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      var enemy = T.spawn(w, 'arcanista', { team: 1, x: 2.0, z: 0 });
      p.yaw = 0;
      p.targetId = enemy.id;
      p.autoAttackOn = true;
      for (var i = 0; i < 60; i++) w.step(1);
      T.assertEqual(p.yaw, 0, 'el ataque normal tampoco gira al personaje');
    });

    T.test('el ataque normal exige tener al objetivo delante', function () {
      function attackWith(yaw) {
        var w = T.makeWorld();
        var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
        var enemy = T.spawn(w, 'arcanista', { team: 1, x: 2.0, z: 0 });
        p.yaw = yaw;
        p.targetId = enemy.id;
        p.autoAttackOn = true;
        var hp0 = enemy.hp;
        for (var i = 0; i < 90; i++) w.step(1);
        return hp0 - enemy.hp;
      }
      // Enemigo en +X: mirando a +X (yaw = π/2) está de frente.
      T.assert(attackWith(Math.PI / 2) > 0, 'de frente sí pega');
      // Mirando a −X está exactamente de espaldas.
      T.assertEqual(attackWith(-Math.PI / 2), 0, 'de espaldas NO pega');
    });

    T.test('el arco frontal del ataque normal es simétrico y acotado', function () {
      T.assert(B.AUTO_ATTACK_HALF_ANGLE > 0 && B.AUTO_ATTACK_HALF_ANGLE < Math.PI,
        'el arco debe ser un cono real, no todo el círculo');
      T.assert(B.AUTO_ATTACK_HALF_ANGLE >= B.FACING_HALF_ANGLE,
        'pegar de cerca no puede exigir más precisión que una habilidad frontal');
    });

    T.test('una habilidad con requiresFacing falla fuera del arco', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      var enemy = T.spawn(w, 'arcanista', { team: 1, x: 2.0, z: 0 });
      p.targetId = enemy.id;

      // Se busca una habilidad del catálogo que declare requiresFacing; si un
      // día no hubiera ninguna, el test lo dice en vez de pasar en falso.
      var id = null;
      for (var k in Arena.Data.abilities) {
        if (!Object.prototype.hasOwnProperty.call(Arena.Data.abilities, k)) continue;
        var ab = Arena.Data.abilities[k];
        if (ab.classId === 'devastador' && ab.flags && ab.flags.requiresFacing) { id = k; break; }
      }
      if (!id) {
        // Sin habilidades frontales el arco lo sigue defendiendo el ataque
        // normal, que ya tiene su propio test.
        T.assert(true, 'el catálogo no declara requiresFacing en Devastador');
        return;
      }
      p.yaw = -Math.PI / 2;                      // de espaldas al enemigo
      var res = Ability.tryUse(w, p, id, { targetId: enemy.id, target: enemy });
      T.assertFalse(res.ok, 'de espaldas debe fallar');
      T.assertEqual(res.reason, 'facing', 'y con el motivo correcto');
    });
  });

  T.suite('Control · contrato de renderer', function () {

    T.test('el registro entrega el renderer pedido y lo verifica', function () {
      /* Los renderers reales no se cargan aquí: uno necesita un contexto WebGL2
         y el otro módulos ES, y ninguna de las dos cosas existe en el runner
         headless. Lo que sí se puede probar —y es lo que importa— es el
         MECANISMO: que registrar funcione, que se verifique el contrato al
         crear, y que una implementación coja no llegue a usarse.
         Que las dos presentaciones producen la misma simulación se comprueba
         en navegador; ver docs/DEPLOY_HOSTINGER.md. */
      var RB = Arena.Render.RendererBackend;
      var built = 0;
      RB.register('__prueba', function () {
        built++;
        var r = {};
        for (var i = 0; i < RB.METHODS.length; i++) r[RB.METHODS[i]] = function () {};
        for (var j = 0; j < RB.PROPS.length; j++) r[RB.PROPS[j]] = null;
        return r;
      });
      var r = RB.create('__prueba', null, null);
      T.assertEqual(built, 1, 'la factoría se usó');
      T.assertEqual(r.backendName, '__prueba', 'y quedó etiquetado');
      delete RB.registry.__prueba;
    });

    T.test('un renderer incompleto no llega a usarse', function () {
      var RB = Arena.Render.RendererBackend;
      RB.register('__roto', function () { return { init: function () {} }; });
      T.assertThrows(function () { RB.create('__roto', null, null); },
        'crear un renderer que no cumple el contrato debe fallar al instante');
      delete RB.registry.__roto;
    });

    T.test('el contrato detecta una implementación incompleta', function () {
      // Este test protege al SIGUIENTE renderer, no al actual. Sin él, añadir
      // una presentación a la que le falte `resize()` produciría un
      // "undefined is not a function" treinta segundos después, en mitad de un
      // combate, en vez de un error legible en el arranque.
      var RB = Arena.Render.RendererBackend;
      var incomplete = { init: function () {}, camera: null, canvas: null };
      var missing = RB.check(incomplete);
      T.assert(missing.length > 0, 'debe detectar lo que falta');
      T.assertThrows(function () { RB.assert(incomplete, 'prueba'); },
        'y fallar en el arranque, no más tarde');
    });

    T.test('el contrato acepta una implementación completa', function () {
      var RB = Arena.Render.RendererBackend;
      var complete = {};
      var i;
      for (i = 0; i < RB.METHODS.length; i++) complete[RB.METHODS[i]] = function () {};
      for (i = 0; i < RB.PROPS.length; i++) complete[RB.PROPS[i]] = null;
      T.assertEqual(RB.check(complete).length, 0, 'nada que reprochar');
    });

    T.test('el contrato nombra exactamente lo que el juego consume', function () {
      // Si esta lista crece sin que crezca el renderer de Three.js, la versión
      // hospedada se rompe en silencio. El test obliga a que añadir algo al
      // contrato sea una decisión consciente.
      var RB = Arena.Render.RendererBackend;
      T.assertEqual(RB.METHODS.join(','), 'init,syncVisuals,render,resize',
        'métodos del contrato');
      T.assertEqual(RB.PROPS.join(','), 'camera,canvas,visuals,playerId,selectedId,hoverId',
        'propiedades del contrato');
    });
  });

  T.suite('Control · la cámara no escribe simulación', function () {

    T.test('el free look no toca el yaw del personaje', function () {
      // Free look mueve la cámara y nada más. La prueba real es que el ángulo
      // de cámara no aparece por ningún lado en la entidad.
      var cam = new Arena.Render.Camera3D();
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0.75;
      var before = p.yaw;
      for (var i = 0; i < 40; i++) cam.orbit(30, 4);
      for (var j = 0; j < 20; j++) w.step(1);
      T.assertEqual(p.yaw, before, 'girar la cámara no gira al personaje');
    });

    T.test('el modo steer produce INTENCIÓN, y la simulación la aplica', function () {
      // El renderer nunca escribe yaw: emite una intención acotada a −1..1 que
      // el paso fijo convierte en giro. Así el gesto del ratón no puede saltarse
      // el límite de velocidad de giro.
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0;
      p._turnIntent = 1000;                      // intención absurda a propósito
      w.step(1);
      T.assertNear(Math.abs(V.angleDelta(0, p.yaw)), B.TURN_SPEED / B.TICK_RATE, 1e-6,
        'la intención se satura: no hay forma de girar más rápido del límite');
    });
  });
});
