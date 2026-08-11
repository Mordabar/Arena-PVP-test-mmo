/* =============================================================================
 * tests/animTests.js — La capa de animación, verificada de verdad.
 *
 * Una animación puede parecer correcta en un pantallazo y estar mintiendo: el
 * pie que se desliza medio centímetro por paso, el ataque que salta a su pose
 * final en un fotograma, el derribo que se confunde con un aturdimiento. Todo
 * eso es MEDIBLE, y lo que es medible entra aquí.
 *
 * Lo que estos tests protegen:
 *
 *   §2  la presentación no escribe jamás en la simulación
 *   §3  parámetros continuos y máquina de estados direccional
 *   §4  foot locking: el pie apoyado NO se desplaza
 *   §5  las acciones tienen fases y ningún salto de pose
 *   §8  cada control se lee distinto (derribo ≠ aturdimiento)
 *   §16 capas LOWER / UPPER independientes
 *   §25 nada de Math.random() en la presentación
 *
 * Corren sin WebGL ni DOM: la capa de animación es matemática pura, y ésa es
 * exactamente la razón por la que se puede testear.
 * ========================================================================== */
Arena.define('tests/animTests',
  ['tests/testRunner', 'render/anim/locomotion', 'render/anim/actions'], function (Arena) {
  'use strict';

  var T = Arena.Tests;
  var SK = Arena.Render.Skeleton;
  var Loco = Arena.Render.Locomotion;
  var Act = Arena.Render.Actions;
  var cfgFor = Arena.Data.animConfigFor;

  /* =========================================================================
   * Utilidades
   * ====================================================================== */

  /** Entidad falsa: sólo lo que la capa de animación tiene derecho a leer. */
  function fakeEntity(opts) {
    opts = opts || {};
    return {
      id: opts.id || 'test1',
      classId: opts.classId || 'devastador',
      pos: { x: 0, y: 0, z: 0 },
      yaw: opts.yaw || 0,
      moveSpeedBase: opts.moveSpeedBase || 5.4,
      alive: opts.alive === undefined ? true : opts.alive,
      _statuses: opts.statuses || [],
      hasStatus: function (id) { return this._statuses.indexOf(id) >= 0; }
    };
  }

  /** Avanza N fotogramas moviendo la entidad a velocidad constante. */
  function walk(st, e, frames, dt, vx, vz) {
    for (var i = 0; i < frames; i++) {
      e.pos.x += vx * dt;
      e.pos.z += vz * dt;
      Loco.update(st, e, dt);
    }
  }

  /* =========================================================================
   * §3 — Parámetros continuos y máquina de estados
   * ====================================================================== */
  T.suite('Animación · locomoción direccional', function () {

    T.test('avanzar produce estado FORWARD y velocidad normalizada creciente', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      walk(st, e, 60, 1 / 60, 0, 5.4);
      T.assertEqual(st.state, Loco.STATE.FORWARD, 'debería estar avanzando');
      T.assertBetween(st.moveSpeed, 0.85, 1.05, 'velocidad normalizada');
      T.assert(st.moveForward > 0.9, 'la componente frontal debe dominar');
    });

    T.test('retroceder NO usa el ciclo de avance', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      walk(st, e, 60, 1 / 60, 0, -3.9);
      T.assertEqual(st.state, Loco.STATE.BACKWARD, 'debería retroceder');
      T.assert(st.moveForward < -0.9, 'la componente frontal debe ser negativa');
    });

    T.test('desplazarse de lado da STRAFE del lado correcto', function () {
      var e = fakeEntity();
      var stR = Loco.createState(cfgFor('centinela', 'archer'));
      walk(stR, e, 60, 1 / 60, 4.8, 0);
      T.assertEqual(stR.state, Loco.STATE.STRAFE_R, 'strafe a la derecha');

      var e2 = fakeEntity();
      var stL = Loco.createState(cfgFor('centinela', 'archer'));
      walk(stL, e2, 60, 1 / 60, -4.8, 0);
      T.assertEqual(stL.state, Loco.STATE.STRAFE_L, 'strafe a la izquierda');
    });

    T.test('avanzar y desplazarse a la vez da DIAGONAL', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      walk(st, e, 60, 1 / 60, 3.8, 3.8);
      T.assertEqual(st.state, Loco.STATE.DIAGONAL, 'diagonal');
    });

    T.test('girar parado dispara giro en el sitio, no deslizamiento', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      var dt = 1 / 60;
      for (var i = 0; i < 60; i++) { e.yaw += 2.2 * dt; Loco.update(st, e, dt); }
      T.assertEqual(st.state, Loco.STATE.TURN_R, 'giro en el sitio a la derecha');
      T.assertFalse(st.isMoving, 'no debería considerarse desplazamiento');
    });

    T.test('arrancar pasa por START y parar por STOP', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      var dt = 1 / 60;
      e.pos.z += 5.4 * dt; Loco.update(st, e, dt);
      e.pos.z += 5.4 * dt; Loco.update(st, e, dt);
      T.assertEqual(st.state, Loco.STATE.START, 'anticipación de arranque');

      walk(st, e, 40, dt, 0, 5.4);
      // Frenar no es instantáneo a propósito: el cuerpo conserva inercia unas
      // décimas. Se le da ese margen y se comprueba que acaba en STOP, no que
      // se detenga en el mismo fotograma en que se suelta la tecla.
      var reached = false;
      for (var i = 0; i < 30 && !reached; i++) {
        Loco.update(st, e, dt);                              // sin desplazarse
        if (st.state === Loco.STATE.STOP) reached = true;
      }
      T.assert(reached, 'debe pasar por la absorción de frenada, estado: ' + st.state);
    });

    T.test('la aceleración es más lenta que el frenado (peso)', function () {
      var cfg = cfgFor('devastador', 'melee');
      T.assert(cfg.decelRate > cfg.accelRate,
        'frenar debe ser más rápido que arrancar: es lo que da sensación de masa');
    });
  });

  /* =========================================================================
   * §4 — Foot locking. El test que más veces salva la papeleta.
   * ====================================================================== */
  T.suite('Animación · foot locking', function () {

    T.test('el pie apoyado no se desplaza mientras dura el apoyo', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      var dt = 1 / 60;
      walk(st, e, 30, dt, 0, 5.4);          // asentar la velocidad

      var maxSlip = 0;
      var prev = [null, null];
      for (var i = 0; i < 240; i++) {
        e.pos.z += 5.4 * dt;
        Loco.update(st, e, dt);
        for (var L = 0; L < 2; L++) {
          var leg = st.legs[L];
          if (leg.hasLock && prev[L]) {
            var dx = leg.footPos.x - prev[L].x;
            var dz = leg.footPos.z - prev[L].z;
            var slip = Math.sqrt(dx * dx + dz * dz);
            if (slip > maxSlip) maxSlip = slip;
          }
          prev[L] = leg.hasLock ? { x: leg.footPos.x, z: leg.footPos.z } : null;
        }
      }
      T.assert(maxSlip < 1e-9,
        'un pie anclado no puede moverse ni un micrómetro — deslizamiento: ' + maxSlip);
    });

    T.test('parado, ambos pies quedan anclados', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      for (var i = 0; i < 60; i++) Loco.update(st, e, 1 / 60);
      T.assert(st.legs[0].hasLock && st.legs[1].hasLock,
        'de pie quieto los dos pies están en el suelo');
    });

    T.test('caminando siempre hay un pie en el suelo', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      var dt = 1 / 60;
      walk(st, e, 30, dt, 0, 1.6);
      var bothAirborne = 0;
      for (var i = 0; i < 300; i++) {
        e.pos.z += 1.6 * dt;
        Loco.update(st, e, dt);
        if (!st.legs[0].hasLock && !st.legs[1].hasLock) bothAirborne++;
      }
      // A ritmo de marcha el duty factor está por encima de 0.5: si esto falla,
      // el personaje está flotando.
      T.assertEqual(bothAirborne, 0, 'caminando siempre hay un pie apoyado');
    });

    T.test('el pie apoyado nunca sale del alcance de la pierna', function () {
      // ESTE es el test que importa. El pie anclado no se mueve —eso ya se
      // comprobó— pero el CUERPO sí avanza sobre él. Si el ciclo no está
      // derivado de la velocidad real, el cuerpo deja el pie atrás, la cadena
      // de IK se satura y la pierna se queda apuntando al horizonte. No hay
      // patinaje, hay una pierna rota, que es peor.
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      var dt = 1 / 60;
      // Alcance horizontal máximo de la pierna con la cadera a su altura de
      // reposo: sqrt(pierna² − altura²). Ver data/animConfig.js.
      var legLen = (0.45 + 0.43) * 1.06;
      var hipHeight = 0.92 - 0.10;
      var maxHoriz = Math.sqrt(Math.max(0, legLen * legLen - hipHeight * hipHeight));

      walk(st, e, 40, dt, 0, 6.0);
      var worst = 0;
      for (var i = 0; i < 400; i++) {
        e.pos.z += 6.0 * dt;
        Loco.update(st, e, dt);
        for (var L = 0; L < 2; L++) {
          var leg = st.legs[L];
          if (!leg.hasLock) continue;
          var dx = leg.footPos.x - e.pos.x;
          var dz = leg.footPos.z - e.pos.z;
          var d = Math.sqrt(dx * dx + dz * dz);
          if (d > worst) worst = d;
        }
      }
      T.assert(worst <= maxHoriz,
        'separación cadera→pie apoyado ' + worst.toFixed(3) +
        ' supera el alcance anatómico ' + maxHoriz.toFixed(3));
    });

    T.test('la cadencia se deriva de la velocidad, no está fijada', function () {
      var cfg = cfgFor('devastador', 'melee');
      function cadence(v) {
        var e = fakeEntity();
        var st = Loco.createState(cfg);
        walk(st, e, 90, 1 / 60, 0, v);
        return st.stepFreq;
      }
      var slow = cadence(1.8), fast = cadence(6.0);
      T.assert(fast > slow * 1.25,
        'correr debe dar más pasos por segundo que andar — ' +
        slow.toFixed(2) + ' vs ' + fast.toFixed(2));
    });

    T.test('correr abre fase de vuelo; andar no', function () {
      var cfg = cfgFor('devastador', 'melee');
      function flight(v) {
        var e = fakeEntity();
        var st = Loco.createState(cfg);
        var dt = 1 / 60;
        walk(st, e, 60, dt, 0, v);
        var n = 0;
        for (var i = 0; i < 300; i++) {
          e.pos.z += v * dt;
          Loco.update(st, e, dt);
          if (!st.legs[0].hasLock && !st.legs[1].hasLock) n++;
        }
        return n;
      }
      // Correr rápido con los dos pies siempre en el suelo obligaría a una
      // zancada más larga que la pierna. La fase de vuelo es la que permite
      // cubrir terreno sin romper la anatomía.
      T.assert(flight(6.0) > 0, 'corriendo debe haber fotogramas sin apoyo');
      T.assertEqual(flight(1.6), 0, 'andando siempre hay un pie apoyado');
    });
  });

  /* =========================================================================
   * §2 y §25 — Fronteras
   * ====================================================================== */
  T.suite('Animación · fronteras de autoridad', function () {

    T.test('la locomoción no escribe NADA en la entidad', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      var dt = 1 / 60;
      walk(st, e, 20, dt, 1.0, 4.0);

      var before = { x: e.pos.x, y: e.pos.y, z: e.pos.z, yaw: e.yaw };
      // Un fotograma más SIN mover la entidad: si la presentación tocara la
      // simulación, aquí se vería.
      var act = Act.createState(1);
      Loco.update(st, e, dt);
      Loco.trackTarget(st, e, { x: 5, y: 0, z: 5 }, dt);
      Act.update(act, cfgFor('devastador', 'melee'), dt);

      T.assertEqual(e.pos.x, before.x, 'x intacta');
      T.assertEqual(e.pos.y, before.y, 'y intacta');
      T.assertEqual(e.pos.z, before.z, 'z intacta');
      T.assertEqual(e.yaw, before.yaw, 'yaw intacto');
    });

    T.test('seguir al objetivo mueve la cabeza, no el personaje', function () {
      var e = fakeEntity();
      var st = Loco.createState(cfgFor('devastador', 'melee'));
      var yaw0 = e.yaw;
      for (var i = 0; i < 60; i++) Loco.trackTarget(st, e, { x: 8, y: 0, z: 0 }, 1 / 60);
      T.assertEqual(e.yaw, yaw0, 'el personaje NO gira hacia el objetivo');
      T.assert(Math.abs(st.headYaw) > 0.3, 'pero la cabeza sí lo sigue');
    });

    T.test('el seguimiento de cabeza respeta el límite anatómico', function () {
      var e = fakeEntity();
      var cfg = cfgFor('devastador', 'melee');
      var st = Loco.createState(cfg);
      // Objetivo justo detrás: nadie gira la cabeza 180°.
      for (var i = 0; i < 120; i++) Loco.trackTarget(st, e, { x: 0, y: 0, z: -8 }, 1 / 60);
      T.assert(Math.abs(st.headYaw) <= cfg.headTrackMaxYaw + 1e-6,
        'giro de cabeza ' + st.headYaw.toFixed(2) + ' > límite ' + cfg.headTrackMaxYaw);
    });

    T.test('la capa de acción es determinista: misma semilla, misma pose', function () {
      var a = Act.createState(1234);
      var b = Act.createState(1234);
      T.assertEqual(a.idleNoise, b.idleNoise, 'la semilla visual debe ser determinista');
      var c = Act.createState(9999);
      T.assert(c.idleNoise !== a.idleNoise, 'semillas distintas dan desfases distintos');
    });

    T.test('el código de animación no contiene Math.random()', function () {
      var sources = [Loco.update, Loco._updateLegs, Loco._updateCenterOfMass,
                     Act.update, Act.upperBodyPose, Act.ccPose, Act.createState];
      for (var i = 0; i < sources.length; i++) {
        T.assertFalse(/Math\.random/.test(String(sources[i])),
          'ninguna función de animación puede usar Math.random(): función #' + i);
      }
    });
  });

  /* =========================================================================
   * §5, §6, §7 — Acciones de combate
   * ====================================================================== */
  T.suite('Animación · acciones de combate', function () {

    T.test('cada arquetipo usa su familia de acción', function () {
      T.assertEqual(Act.familyFor('melee', false), Act.FAMILY.LIGHT_SWING, 'melee normal');
      T.assertEqual(Act.familyFor('melee', true), Act.FAMILY.HEAVY_SWING, 'melee poder');
      T.assertEqual(Act.familyFor('archer', false), Act.FAMILY.ARCHER_SHOT, 'arquero normal');
      T.assertEqual(Act.familyFor('archer', true), Act.FAMILY.ARCHER_SHOT, 'arquero poder');
      // El mago tiene DOS gestos, no uno con variación: el ataque normal
      // canaliza por el báculo, el poder libera un hechizo.
      T.assertEqual(Act.familyFor('caster', false), Act.FAMILY.ARCANE_PULSE, 'mago normal');
      T.assertEqual(Act.familyFor('caster', true), Act.FAMILY.CAST, 'mago poder');
    });

    T.test('una acción recorre sus fases y termina volviendo a la guardia', function () {
      var cfg = cfgFor('devastador', 'melee');
      var st = Act.createState(1);
      Act.trigger(st, Act.FAMILY.LIGHT_SWING, cfg, false);
      T.assert(st.family !== null, 'la acción arranca');

      var dt = 1 / 60, frames = 0;
      while (st.family && frames < 600) { Act.update(st, cfg, dt); frames++; }
      T.assert(frames < 600, 'la acción debe terminar sola');
      T.assertEqual(st.weight, 0, 'al terminar no queda peso de acción');
    });

    T.test('la acción entra y sale mezclada, sin corte en las costuras', function () {
      // Lo que se mide NO es la velocidad del golpe: un tajo es rápido y debe
      // serlo. Lo que se mide son las COSTURAS —el fotograma en que la acción
      // empieza y el fotograma en que termina—, que es donde un sistema mal
      // mezclado teletransporta el brazo de la guardia a la pose de ataque.
      var cfg = cfgFor('devastador', 'melee');
      var st = Act.createState(2);
      var dt = 1 / 60;
      var loadout = { right: 'sword', left: null };

      function pitch() {
        return Act.upperBodyPose(st, cfg, 'melee', loadout, 0, false, 0).right.pitch;
      }

      var guard = pitch();
      Act.trigger(st, Act.FAMILY.HEAVY_SWING, cfg, true);
      Act.update(st, cfg, dt);
      var firstFrame = pitch();
      T.assert(Math.abs(firstFrame - guard) < 0.20,
        'el primer fotograma tras disparar no puede saltar: ' +
        Math.abs(firstFrame - guard).toFixed(3) + ' rad');

      // Correr la acción entera hasta que la mezcla se agota del todo.
      var last = firstFrame, lastJump = 0;
      for (var i = 0; i < 300 && (st.family || st.weight > 0); i++) {
        Act.update(st, cfg, dt);
        var now = pitch();
        lastJump = Math.abs(now - last);
        last = now;
      }
      T.assertEqual(st.weight, 0, 'la mezcla debe cerrarse');
      T.assert(lastJump < 0.12,
        'el último fotograma de la salida salta ' + lastJump.toFixed(3) + ' rad');
      T.assertNear(last, guard, 1e-6, 'y se acaba exactamente en la guardia');
    });

    T.test('el poder del arquero es una variación del disparo, no otro gesto', function () {
      var cfg = cfgFor('centinela', 'archer');
      var loadout = { right: 'bow', left: null };

      function shot(isPower) {
        var st = Act.createState(3);
        Act.trigger(st, Act.FAMILY.ARCHER_SHOT, cfg, isPower);
        var r = { draw: 0, chest: 0, drawFrames: 0 };
        for (var i = 0; i < 200 && st.family; i++) {
          Act.update(st, cfg, 1 / 60);
          var A = Act.upperBodyPose(st, cfg, 'archer', loadout, 0, false, 0);
          if (A.draw > r.draw) r.draw = A.draw;
          if (Math.abs(A.chestYaw) > Math.abs(r.chest)) r.chest = A.chestYaw;
          if (A.draw > 0.5) r.drawFrames++;
        }
        return r;
      }
      var normal = shot(false), power = shot(true);

      T.assert(normal.draw > 0.6, 'el disparo normal tensa el arco');
      T.assert(power.draw > 0.6, 'el poder también');
      // La diferencia pedida es "una ligera variación": mismo gesto, más
      // tensado y más torsión de tronco. Si fuera otra animación distinta, el
      // arquero dejaría de leerse como el mismo personaje.
      T.assert(power.drawFrames > normal.drawFrames,
        'el poder mantiene el arco tensado más tiempo — ' +
        power.drawFrames + ' vs ' + normal.drawFrames + ' fotogramas');
      T.assert(Math.abs(power.chest) > Math.abs(normal.chest) * 1.1,
        'y gira más el tronco — ' + power.chest.toFixed(3) + ' vs ' + normal.chest.toFixed(3));
    });

    T.test('el mago tiene pose de casteo distinta de la de ataque', function () {
      var cfg = cfgFor('arcanista', 'caster');
      var loadout = { right: 'staff', left: null };
      var st = Act.createState(4);

      var guard = Act.upperBodyPose(st, cfg, 'caster', loadout, 0, false, 0);
      var casting = Act.upperBodyPose(st, cfg, 'caster', loadout, 1, true, 0);
      T.assert(Math.abs(casting.right.pitch - guard.right.pitch) > 1.0,
        'canalizar debe alzar el báculo de forma inconfundible');

      // La liberación se mide por el RECORRIDO del gesto, no por un ángulo
      // suelto: la pose pasa por la posición de canalización mientras baja, así
      // que comparar un instante contra otro no dice nada.
      Act.trigger(st, Act.FAMILY.CAST, cfg, true, 'projectile');
      var reach = 0;
      for (var i = 0; i < 90 && st.family; i++) {
        Act.update(st, cfg, 1 / 60);
        var r = Act.upperBodyPose(st, cfg, 'caster', loadout, 0, false, 0);
        var d = Math.abs(r.right.pitch - casting.right.pitch);
        if (d > reach) reach = d;
      }
      T.assert(reach > 0.7,
        'el brazo debe recorrer un trecho claro al liberar — máximo ' + reach.toFixed(2));
    });

    T.test('el ataque normal del mago no es la liberación de un hechizo', function () {
      var cfg = cfgFor('arcanista', 'caster');
      var loadout = { right: 'staff', left: null };

      function peakOf(family, castFamily) {
        var st = Act.createState(11);
        Act.trigger(st, family, cfg, true, castFamily);
        var best = { pitch: 0, weapon: 0 };
        for (var i = 0; i < 90 && st.family; i++) {
          Act.update(st, cfg, 1 / 60);
          var A = Act.upperBodyPose(st, cfg, 'caster', loadout, 0, false, 0);
          if (Math.abs(A.right.pitch) > Math.abs(best.pitch)) best.pitch = A.right.pitch;
          if (Math.abs(A.weaponPitch) > Math.abs(best.weapon)) best.weapon = A.weaponPitch;
        }
        return best;
      }
      var pulse = peakOf(Act.FAMILY.ARCANE_PULSE, null);
      var cast = peakOf(Act.FAMILY.CAST, 'projectile');
      // El pulso es un gesto contenido; la liberación levanta el brazo entero.
      T.assert(Math.abs(cast.pitch) > Math.abs(pulse.pitch) * 1.5,
        'liberar debe mover mucho más el brazo que el ataque normal — ' +
        pulse.pitch.toFixed(2) + ' vs ' + cast.pitch.toFixed(2));
    });

    T.test('la liberación gana a la canalización que se disuelve', function () {
      // castProgress decae suavemente al terminar el casteo. Si la pose de
      // canalización tuviera prioridad, seguiría ganando justo durante el medio
      // segundo en el que hay que ver la liberación.
      var cfg = cfgFor('arcanista', 'caster');
      var loadout = { right: 'staff', left: null };
      var st = Act.createState(12);
      Act.trigger(st, Act.FAMILY.CAST, cfg, true, 'projectile');
      Act.update(st, cfg, 1 / 60);

      var withDecay = Act.upperBodyPose(st, cfg, 'caster', loadout, 0.9, false, 0);
      var clean = Act.upperBodyPose(st, cfg, 'caster', loadout, 0, false, 0);
      T.assertNear(withDecay.right.pitch, clean.right.pitch, 1e-9,
        'con una acción en curso, el resto de castProgress no puede mandar');
    });

    T.test('cada familia de hechizo se ve distinta', function () {
      var cfg = cfgFor('arcanista', 'caster');
      var loadout = { right: 'staff', left: null };
      var fams = ['projectile', 'control', 'buff', 'heal', 'aoe', 'channel', 'instant'];

      function signature(fam) {
        var st = Act.createState(13);
        var A = Act.upperBodyPose(st, cfg, 'caster', loadout, 0.75, true, 0);
        return [A.left.pitch, A.left.roll, A.left.yaw, A.right.pitch,
                A.weaponPitch, A.chestPitch, A.chestYaw];
        function unused() { return fam; }
      }
      // Se compara la pose de CANALIZACIÓN, que es donde el jugador enemigo
      // tiene que leer qué le viene encima y decidir si interrumpe.
      var seen = [];
      for (var i = 0; i < fams.length; i++) {
        var st2 = Act.createState(13);
        Act.beginCast(st2, fams[i]);
        var A2 = Act.upperBodyPose(st2, cfg, 'caster', loadout, 0.75, true, 0);
        seen.push([A2.left.pitch, A2.left.roll, A2.left.yaw, A2.right.pitch,
                   A2.weaponPitch, A2.chestPitch, A2.chestYaw]);
      }
      for (var a = 0; a < seen.length; a++) {
        for (var b = a + 1; b < seen.length; b++) {
          var d = 0;
          for (var k = 0; k < seen[a].length; k++) d += Math.abs(seen[a][k] - seen[b][k]);
          T.assert(d > 0.10,
            'las familias ' + fams[a] + ' y ' + fams[b] +
            ' se ven casi igual (distancia ' + d.toFixed(3) + ')');
        }
      }
      T.assert(signature('projectile').length === 7, 'firma completa');
    });

    T.test('la reacción al daño es aditiva y se disuelve sola', function () {
      var cfg = cfgFor('devastador', 'melee');
      var st = Act.createState(5);
      var loadout = { right: 'sword', left: null };
      var calm = Act.upperBodyPose(st, cfg, 'melee', loadout, 0, false, 0).chestPitch;

      Act.react(st, 1, 0);
      var hit = Act.upperBodyPose(st, cfg, 'melee', loadout, 0, false, 0).chestPitch;
      T.assert(hit > calm, 'un golpe frontal echa el pecho hacia atrás');

      for (var i = 0; i < 120; i++) Act.update(st, cfg, 1 / 60);
      T.assertEqual(st.react.amount, 0, 'la reacción se agota');
      var after = Act.upperBodyPose(st, cfg, 'melee', loadout, 0, false, 0).chestPitch;
      T.assertNear(after, calm, 1e-6, 'y la pose vuelve a la de partida');
    });

    T.test('golpear no congela las piernas (capas independientes)', function () {
      var e = fakeEntity();
      var cfg = cfgFor('devastador', 'melee');
      var loco = Loco.createState(cfg);
      var act = Act.createState(6);
      var dt = 1 / 60;
      walk(loco, e, 40, dt, 0, 5.4);

      var cycleBefore = loco.cycle;
      Act.trigger(act, Act.FAMILY.HEAVY_SWING, cfg, true);
      for (var i = 0; i < 20; i++) {
        e.pos.z += 5.4 * dt;
        Loco.update(loco, e, dt);
        Act.update(act, cfg, dt);
      }
      T.assert(loco.cycle !== cycleBefore, 'el ciclo de paso sigue avanzando');
      T.assert(loco.moveSpeed > 0.5, 'y el personaje sigue moviéndose a ritmo');
    });
  });

  /* =========================================================================
   * §8 — Crowd control legible
   * ====================================================================== */
  T.suite('Animación · lenguaje corporal del control', function () {

    T.test('sin control no hay pose de control', function () {
      T.assertEqual(Act.ccPose(fakeEntity(), 1), null, 'una entidad libre no tiene pose de CC');
    });

    T.test('derribo y aturdimiento NO se ven igual', function () {
      var down = Act.ccPose(fakeEntity({ statuses: ['knockdown'] }), 1);
      var stun = Act.ccPose(fakeEntity({ statuses: ['stun'] }), 1);
      T.assert(down.rootPitch > 1.0, 'el derribo lleva el cuerpo al suelo');
      T.assert(stun.rootPitch < 0.5, 'el aturdimiento se sufre DE PIE');
      T.assert(stun.sway > 0, 'y se tambalea');
      // Confundirlos a veinte unidades cuesta la pelea: la diferencia tiene que
      // ser estructural, no un matiz.
      T.assert(down.rootPitch - stun.rootPitch > 1.0, 'diferencia inconfundible');
    });

    T.test('la estasis congela en vez de dejar de actualizar', function () {
      var p = Act.ccPose(fakeEntity({ statuses: ['stasis'] }), 1);
      T.assert(p.frozen === true, 'la estasis marca la pose como congelada');
      T.assertEqual(p.sway, 0, 'y no tiembla');
    });

    T.test('enraizar bloquea los pies pero no derriba', function () {
      var p = Act.ccPose(fakeEntity({ statuses: ['root'] }), 1);
      T.assert(p.kneeBend > 0, 'las rodillas se tensan');
      T.assert(p.rootPitch < 0.5, 'pero el personaje sigue erguido');
    });

    T.test('el desarme baja el arma sin tocar las piernas', function () {
      var p = Act.ccPose(fakeEntity({ statuses: ['disarm'] }), 1);
      T.assert(p.armDrop > 0.5, 'el arma cae');
      T.assertEqual(p.kneeBend, 0, 'las piernas no se enteran');
    });

    T.test('la muerte tiene prioridad sobre cualquier control', function () {
      var p = Act.ccPose(fakeEntity({ alive: false, statuses: ['stun', 'root'] }), 1);
      T.assert(p.rootPitch > 1.0, 'muerto va al suelo pase lo que pase');
    });
  });

  /* =========================================================================
   * Cinemática
   * ====================================================================== */
  T.suite('Animación · cinemática inversa', function () {

    T.test('la cadena alcanza un objetivo dentro de su rango', function () {
      var out = SK.solveTwoBoneIK({ x: 0, y: 1, z: 0 }, { x: 0, y: 0.2, z: 0 }, 0.45, 0.43, {});
      T.assertBetween(out.reach, 0.9, 1.0, 'casi estirada');
      T.assert(out.bend > 0, 'y algo doblada, nunca recta del todo');
    });

    T.test('un objetivo inalcanzable no rompe la solución', function () {
      var out = SK.solveTwoBoneIK({ x: 0, y: 1, z: 0 }, { x: 0, y: -8, z: 0 }, 0.45, 0.43, {});
      T.assert(isFinite(out.pitch) && isFinite(out.bend), 'ángulos finitos');
      T.assert(out.bend >= 0 && out.bend < 0.15, 'la cadena se estira al límite, no explota');
    });

    T.test('la rodilla dobla hacia atrás y el codo hacia delante', function () {
      var knee = SK.solveTwoBoneIK({ x: 0, y: 1, z: 0 }, { x: 0, y: 0.4, z: 0 }, 0.45, 0.43, {}, false);
      var elbow = SK.solveTwoBoneIK({ x: 0, y: 1, z: 0 }, { x: 0, y: 0.4, z: 0 }, 0.30, 0.29, {}, true);
      T.assert(knee.bend > 0, 'rodilla hacia atrás');
      T.assert(elbow.bend < 0, 'codo hacia delante');
    });
  });
});
