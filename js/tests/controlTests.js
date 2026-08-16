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
    return { x: sy * forward - cy * strafe, z: cy * forward + sy * strafe };
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

      /* Mirando a +Z con la cámara detrás, la derecha visible en pantalla es
         −X. Este test protege el bug REAL que el usuario detecta jugando: D no
         puede desplazar el avatar hacia la izquierda de la pantalla. */
      T.assert(p.pos.x < -0.8, 'strafe derecha visual va a −X, fue a ' + p.pos.x.toFixed(2));
      T.assertNear(p.pos.z, 0, 0.05, 'sin componente frontal');
      T.assertEqual(p.yaw, yaw0, 'strafe NO puede cambiar la orientación');

      // Y A va al lado contrario, que es la otra mitad del mismo error.
      var w2 = T.makeWorld();
      var q = T.spawn(w2, 'devastador', { team: 0, x: 0, z: 0 });
      q.yaw = 0;
      q._moveIntent = moveIntentFor(q, 0, -1);   // A
      for (var j = 0; j < 15; j++) w2.step(1);
      T.assert(q.pos.x > 0.8, 'strafe izquierda visual va a +X');
    });

    T.test('Q y E giran sin desplazar', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      var x0 = p.pos.x, z0 = p.pos.z, yaw0 = p.yaw;

      // Menos de media vuelta a propósito: el yaw se envuelve a [−π, π], así
      // que pasarse de π convertiría "giró a la derecha" en un ángulo negativo
      // y el test mediría el envoltorio en vez del giro.
      p._turnIntent = 1;                        // D
      for (var i = 0; i < 6; i++) w.step(1);

      T.assert(V.angleDelta(yaw0, p.yaw) > 0.2, 'E debe girar a la derecha');
      T.assertEqual(p.pos.x, x0, 'girar no desplaza en X');
      T.assertEqual(p.pos.z, z0, 'girar no desplaza en Z');

      var yaw1 = p.yaw;
      p._turnIntent = -1;                       // A
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
      // Dnraizar clava los pies, no el cuello. Poder girar anclado es lo que
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
      // Dnemigo en +X: mirando a +X (yaw = π/2) está de frente.
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
      // Dste test protege al SIGUIENTE renderer, no al actual. Sin él, añadir
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
      T.assertEqual(RB.METHODS.join(','), 'init,syncVisuals,render,resize,characterHandleOf',
        'métodos del contrato');
      T.assertEqual(RB.PROPS.join(','), 'camera,canvas,visuals,playerId,selectedId,hoverId',
        'propiedades del contrato');
    });

    T.test('el handle de personaje se pide por método, no leyendo visuals[id]', function () {
      /* Éste es el fallo que costó todas las animaciones de combate en la
         presentación de Three.js. `visuals` estaba en el contrato; lo que
         CONTIENE, no. El renderer nativo guardaba ahí el handle del backend y
         el de Three.js un envoltorio de escena con el handle dentro. `vfx.js`
         pasaba `visuals[id]` a `triggerAttack`, que empieza con
         `if (!st.cfg) return;` y descartaba en silencio cada ataque, cada
         casteo y cada reacción al daño. La locomoción iba por otro camino, así
         que los personajes se movían y parecía que todo estaba bien.

         La regla que impone este test: quien necesite el handle lo pide por
         `characterHandleOf(id)`. Nadie deduce el contenido de `visuals`. */
      var RB = Arena.Render.RendererBackend;
      T.assert(RB.METHODS.indexOf('characterHandleOf') >= 0,
        'el contrato obliga a exponerlo');

      var handle = { cfg: {}, action: {}, intent: {}, loco: {} };
      var comoNativo = {
        visuals: { e1: handle },
        characterHandleOf: function (id) { return this.visuals[id] || null; }
      };
      var comoThree = {
        visuals: { e1: { handle: handle, root: {}, pose: [] } },
        characterHandleOf: function (id) {
          var v = this.visuals[id]; return v ? v.handle : null;
        }
      };
      T.assertEqual(comoNativo.characterHandleOf('e1'), handle,
        'el nativo devuelve el handle');
      T.assertEqual(comoThree.characterHandleOf('e1'), handle,
        'Three.js devuelve el MISMO handle, no su envoltorio');
      T.assertEqual(comoThree.characterHandleOf('nadie'), null,
        'una entidad que no existe da null, no undefined encubierto');

      // Y la razón por la que importa: sin `cfg` el disparo de acción se cae.
      T.assert(comoThree.characterHandleOf('e1').cfg,
        'lo devuelto es lo que triggerAttack necesita para no salirse en la primera línea');
    });
  });

  T.suite('Control · salto', function () {
    T.test('Space/request inicia un arco autoritativo y vuelve al suelo', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p._jumpRequested = true;
      w.step(1);
      T.assert(p.jumpActive, 'el salto debe arrancar');
      T.assert(p.jumpOffset > 0, 'debe elevarse por encima del suelo');
      var peak = p.jumpOffset;
      for (var i=0;i<Math.ceil(B.JUMP.duration*B.TICK_RATE)+4;i++) {
        w.step(1); peak = Math.max(peak, p.jumpOffset);
      }
      T.assert(peak > B.JUMP.height * 0.90, 'alcanza un ápice cercano a la altura configurada');
      T.assertFalse(p.jumpActive, 'termina el salto');
      T.assertNear(p.jumpOffset, 0, 1e-6, 'vuelve al suelo');
    });

    T.test('un enraizado/aturdido no puede iniciar salto', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      Arena.Combat.StatusSystem.apply(w, p, { effect: 'root', duration: 3 }, p);
      p._jumpRequested = true; w.step(1);
      T.assertFalse(p.jumpActive, 'root bloquea salto porque clava los pies');
    });

    T.test('saltar cancela un casteo estacionario sin aplicar lockout', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'arcanista', { team: 0, x: 0, z: 0 });
      p.cast = { abilityId: 'arcanista_descarga', startTime: w.time, endTime: w.time + 1, duration: 1,
                 startPos: V.clone(p.pos), movable: false, interruptible: true, school: 'arcane' };
      p._jumpRequested = true; w.step(1);
      T.assert(p.jumpActive, 'el salto sí arranca');
      T.assertEqual(p.cast, null, 'el cuerpo no sigue canalizando en el aire');
      T.assertEqual(p.schoolLockouts.arcane || 0, 0, 'moverse no penaliza la escuela');
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

    T.test('el arrastre de ratón gira 1:1, sin límite de velocidad', function () {
      /* El ratón es manipulación directa: el jugador agarra el cuerpo y lo gira.
         Pasarlo por TURN_SPEED hacía que arrastrar se sintiera desconectado —el
         cuerpo llegaba tarde y a veces parecía no girar—, porque la mano se
         mueve más rápido de lo que el límite permite. */
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0;
      p._faceIntent = 2.5;                 // giro grande de un solo gesto
      w.step(1);
      T.assertNear(p.yaw, 2.5, 1e-6, 'un solo tick basta: es directo');
    });

    T.test('el delta del ratón se aplica exactamente una vez y 1:1', function () {
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0.4;
      p._mouseTurnDelta = 0.73;
      w.step(1);
      T.assertNear(V.angleDelta(0.4, p.yaw), 0.73, 1e-6, 'mismo delta que la cámara');
      var after = p.yaw;
      w.step(1);
      T.assertNear(p.yaw, after, 1e-6, 'el delta se consume y no se repite por tick');
    });

    T.test('el mismo gesto horizontal produce exactamente el mismo delta en cámara y cuerpo', function () {
      var cam = new Arena.Render.Camera3D();
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      cam.yaw = -0.35; p.yaw = 1.10;
      var camBefore = cam.yaw, bodyBefore = p.yaw;
      cam.orbit(117, 0);
      var mouseDelta = V.angleDelta(camBefore, cam.yaw);
      p._mouseTurnDelta = mouseDelta;
      w.step(1);
      T.assertNear(V.angleDelta(bodyBefore, p.yaw), mouseDelta, 1e-6,
        'el cuerpo no persigue la cámara: copia el desplazamiento angular del mouse');
    });

    T.test('el giro por ratón sigue respetando el control', function () {
      // Directo no significa exento: un aturdido no se reorienta ni con ratón.
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0;
      Arena.Combat.StatusSystem.apply(w, p, { effect: 'stun', duration: 5 }, p);
      p._faceIntent = 2.5;
      w.step(1);
      T.assertEqual(p.yaw, 0, 'aturdido no gira, venga de donde venga la orden');
    });

    T.test('Q/E hace que la cámara acompañe exactamente el giro aceptado por simulación', function () {
      var cam = new Arena.Render.Camera3D();
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: 0, z: 0 });
      p.yaw = 0.35; cam.yaw = -2.50;
      var body0=p.yaw, cam0=cam.yaw;
      p._turnIntent=1; w.step(1);
      var d=V.angleDelta(body0,p.yaw);
      cam.followBodyYaw(d);
      T.assertNear(V.angleDelta(cam0,cam.yaw),d,1e-9,'la cámara copia el delta autoritativo de Q/E');
    });

    T.test('followBodyYaw no altera pitch, zoom ni simulación', function () {
      var cam=new Arena.Render.Camera3D(), w=T.makeWorld(), p=T.spawn(w,'devastador',{team:0,x:0,z:0});
      var pitch=cam.pitch, dist=cam.distance, yaw=p.yaw;
      cam.followBodyYaw(0.72);
      T.assertNear(cam.pitch,pitch,1e-12,'pitch intacto');
      T.assertNear(cam.distance,dist,1e-12,'zoom intacto');
      T.assertNear(p.yaw,yaw,1e-12,'la cámara no escribe cuerpo');
    });

    T.test('el giro por tecla SÍ está limitado', function () {
      // Dl renderer nunca escribe yaw: emite una intención acotada a −1..1 que
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

  T.suite('Cámara · nunca dentro del escenario', function () {

    /* La cámara entraba dentro de las plataformas elevadas y enseñaba su cara
       interior: se veía el reverso del nivel desde debajo del suelo. La causa
       era que la colisión de cámara sólo miraba `obstacles`, y las plataformas
       viven aparte porque se caminan y no cortan línea de visión. */

    T.test('las plataformas son sólidas para la cámara y transitables para el jugador', function () {
      var arena = Arena.Sim.Arena.build();
      T.assert(arena.cameraBlockers.length > arena.obstacles.length,
        'la lista de la cámara incluye algo más que los obstáculos');
      T.assertEqual(arena.cameraBlockers.length, arena.obstacles.length + arena.platforms.length,
        'una caja de cámara por plataforma, ni una más');

      for (var i = 0; i < arena.obstacles.length; i++) {
        T.assert(arena.cameraBlockers.indexOf(arena.obstacles[i]) >= 0,
          'todo obstáculo sigue bloqueando la cámara');
      }
      for (var j = 0; j < arena.cameraBlockers.length; j++) {
        if (arena.cameraBlockers[j].kind !== 'platform') continue;
        T.assert(arena.obstacles.indexOf(arena.cameraBlockers[j]) < 0,
          'la plataforma NO entra en obstacles: rompería movimiento y LoS');
      }
    });

    T.test('la caja de cámara de una plataforma cubre su volumen real', function () {
      var arena = Arena.Sim.Arena.build();
      var p = arena.platforms[0];
      var found = null;
      for (var i = 0; i < arena.cameraBlockers.length; i++) {
        var b = arena.cameraBlockers[i];
        if (b.kind === 'platform' && Math.abs(b.center.x - p.x) < 1e-9) found = b;
      }
      T.assert(found, 'la plataforma tiene caja de cámara');
      T.assertNear(found.min.y, 0, 1e-9, 'apoyada en el suelo');
      T.assertNear(found.max.y, p.h, 1e-9, 'llega justo hasta su superficie pisable');
      T.assertNear(found.max.x - found.min.x, p.sx, 1e-9, 'anchura real');
      T.assertNear(found.max.z - found.min.z, p.sz, 1e-9, 'profundidad real');
    });

    T.test('el ojo nunca queda por debajo del suelo que el jugador pisa', function () {
      /* Un tope absoluto en y=0.35 basta en suelo llano y falla en cuanto hay
         relieve: sobre una plataforma de 1.5 el ojo acababa 1.15 por debajo de
         la superficie. El mínimo tiene que seguir al terreno. */
      var w = T.makeWorld();
      var arena = w.arena;
      var plat = arena.platforms[0];
      var cam = new Arena.Render.Camera3D();
      cam.pitch = cam.minPitch;                  // lo más rasante posible
      cam.distance = cam.targetDistance = 10;

      var samples = [
        { x: plat.x, z: plat.z, h: plat.h },
        { x: plat.ramp.x, z: plat.ramp.z, h: null },
        { x: 0, z: 0, h: 0 }
      ];

      for (var s = 0; s < samples.length; s++) {
        var pt = samples[s];
        var ground = Arena.Sim.Arena.groundHeightAt(arena, pt.x, pt.z);
        cam.focus.x = cam.smoothFocus.x = pt.x;
        cam.focus.z = cam.smoothFocus.z = pt.z;
        cam.focus.y = cam.smoothFocus.y = ground + 1.4;
        for (var k = 0; k < 8; k++) cam.update(1 / 60, w, 16 / 9);
        var floorUnderEye = Arena.Sim.Arena.groundHeightAt(arena, cam.position.x, cam.position.z);
        T.assert(cam.position.y >= floorUnderEye + 0.44,
          'el ojo se mantiene sobre el suelo que hay debajo de él');
      }
    });

    T.test('la cámara sigue sin escribir nada en la simulación', function () {
      // La corrección de colisión toca posición de cámara, no de entidades.
      var w = T.makeWorld();
      var p = T.spawn(w, 'devastador', { team: 0, x: -12.5, z: -9 });
      var cam = new Arena.Render.Camera3D();
      cam.focus.x = cam.smoothFocus.x = p.x;
      cam.focus.z = cam.smoothFocus.z = p.z;
      var x0 = p.x, y0 = p.y, z0 = p.z, yaw0 = p.yaw;
      for (var i = 0; i < 30; i++) cam.update(1 / 60, w, 16 / 9);
      T.assertEqual(p.x, x0, 'x intacta');
      T.assertEqual(p.y, y0, 'y intacta');
      T.assertEqual(p.z, z0, 'z intacta');
      T.assertEqual(p.yaw, yaw0, 'yaw intacto');
    });
  });
});
