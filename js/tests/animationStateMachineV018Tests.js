/* =============================================================================
 * tests/animationStateMachineV018Tests.js
 *
 * La máquina de estados sustituye a la selección por fotograma de la v0.16.
 * Estas pruebas fijan sobre todo lo que la v0.18 se NIEGA a hacer: fingir un
 * strafe, fingir un retroceso invirtiendo el tiempo, o dejar que un clip decida
 * cuándo ocurre un RELEASE.
 * ========================================================================== */
Arena.define('tests/animationStateMachineV018Tests',
  ['tests/testRunner','render/animationStateMachine','data/rigCalibration','render/humanoidRetarget'],
  function (Arena) {
  'use strict';
  var T = Arena.Tests, S = Arena.Render.AnimationStateMachine, C = Arena.Data.RigCalibration;

  function h(extra) {
    var o = {
      loco: { moveSpeed:0, metersPerSecond:0, moveForward:0, moveRight:0, airborne:false,
        jumpPhase:0, landingAmount:0, hitAmount:0, turnRate:0 },
      action: { family:null, t:0, variant:0 },
      cast:0, casting:false, cc:null, ccBlend:0, deadTime:0
    };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function andando(mps) {
    var x = h(); x.loco.moveSpeed = 0.8; x.loco.moveForward = 1; x.loco.metersPerSecond = mps;
    return x;
  }

  T.suite('v0.18 · máquina de estados de animación', function () {

    /* ---- lo que la v0.18 se niega a fingir ---------------------------- */

    T.test('STRAFE no tiene clip y lo dice', function () {
      var x = h(); x.loco.moveSpeed = 0.9; x.loco.moveRight = 1;
      var s = S.select(x, 'melee', C);
      T.assertEqual(s.state, 'STRAFE');
      T.assertEqual(s.clip, null, 'UAL2 no tiene clip lateral: no se puede inventar');
      T.assertEqual(s.procedural, true);
    });

    T.test('BACKPEDAL no reproduce la marcha al revés', function () {
      var x = h(); x.loco.moveSpeed = 0.8; x.loco.moveForward = -1; x.loco.metersPerSecond = 0.6;
      var s = S.select(x, 'melee', C);
      T.assertEqual(s.state, 'BACKPEDAL');
      T.assertEqual(s.clip, null, 'invertir el tiempo no invierte el contacto: sale moonwalk');
      T.assertEqual(s.procedural, true);
    });

    T.test('TURN no tiene clip: Q/E son gramática propia', function () {
      var x = h(); x.loco.turnRate = 0.9;
      var s = S.select(x, 'melee', C);
      T.assertEqual(s.state, 'TURN');
      T.assertEqual(s.clip, null);
    });

    T.test('casteo y arco se marcan como sin clip, no como resueltos', function () {
      ['cast','pulse','ranged'].forEach(function (fam) {
        var x = h(); x.action = { family:fam, t:0.5, variant:0 };
        var s = S.select(x, fam === 'ranged' ? 'archer' : 'caster', C);
        T.assertEqual(s.state, 'ACTION');
        T.assertEqual(s.clip, null, fam + ' no tiene clip en UAL2');
        T.assertEqual(s.procedural, true);
      });
    });

    /* ---- lo que sí existe --------------------------------------------- */

    T.test('andar usa el único ciclo real y no pisa los brazos', function () {
      var s = S.select(andando(0.65), 'caster', C);
      T.assertEqual(s.state, 'WALK');
      T.assertEqual(s.clip, 'Walk_Carry_Loop');
      T.assertEqual(s.mask, 'lower', 'la locomoción no puede robar los brazos de báculo/arco');
      T.assertBetween(s.rate, 0.99, 1.01, 'a la velocidad nominal el rate es 1');
    });

    T.test('la velocidad estira el clip con la zancada MEDIDA', function () {
      T.assertBetween(S.select(andando(0.90), 'melee', C).rate, 1.38, 1.39, 'rate a 0.90 m/s');
      /* Por encima de ~0.95 m/s entra el otro ciclo, que es más rápido. */
      var rapido = S.select(andando(1.30), 'melee', C);
      T.assertEqual(rapido.state, 'RUN');
      T.assertBetween(rapido.rate, 1.23, 1.25, 'rate del ciclo rápido a 1.30 m/s');
    });

    T.test('el rate está topado: no hay ciclo de carrera que estirar sin límite', function () {
      T.assertEqual(S.select(andando(9.0), 'melee', C).rate, 1.65);
    });

    T.test('melé usa las tres variantes reales de espada', function () {
      var x = h();
      ['Sword_Regular_A','Sword_Regular_B','Sword_Regular_C'].forEach(function (clip, i) {
        x.action = { family:'light', t:0.5, variant:i };
        var s = S.select(x, 'melee', C);
        T.assertEqual(s.clip, clip);
        T.assertEqual(s.mask, 'full');
        T.assertEqual(s.procedural, false);
      });
    });

    T.test('un arquetipo sin clips de espada NO recibe los de espada', function () {
      var x = h(); x.action = { family:'light', t:0.5, variant:0 };
      T.assertEqual(S.select(x, 'archer', C).clip, null);
      T.assertEqual(S.select(x, 'caster', C).clip, null);
    });

    T.test('salto separa impulso, vuelo y aterrizaje', function () {
      var x = h(); x.loco.airborne = true;
      x.loco.jumpPhase = 0.10; T.assertEqual(S.select(x,'melee',C).state, 'JUMP_START');
      x.loco.jumpPhase = 0.50; T.assertEqual(S.select(x,'melee',C).state, 'AIRBORNE');
      x.loco.jumpPhase = 0.90; T.assertEqual(S.select(x,'melee',C).state, 'LAND');
    });

    T.test('el golpe recibido es sólo tronco y no congela las piernas', function () {
      var x = andando(0.8); x.loco.hitAmount = 0.7;
      var s = S.select(x, 'archer', C);
      T.assertEqual(s.state, 'HIT');
      T.assertEqual(s.mask, 'upper', 'un golpe no puede parar la locomoción');
      T.assertEqual(s.clip, 'Hit_Knockback');
    });

    T.test('derribo y levantada salen del mismo CC, y la levantada cuesta más', function () {
      var x = h({ cc:{ rootPitch:1.2 }, ccBlend:0.9 });
      T.assertEqual(S.select(x,'melee',C).state, 'KNOCKDOWN');
      x.ccBlend = 0.3;
      var g = S.select(x,'melee',C);
      T.assertEqual(g.state, 'GETUP');
      T.assertEqual(g.clip, 'LayToIdle');
    });

    T.test('la muerte manda sobre todo lo demás', function () {
      var x = andando(1.0); x.deadTime = 0.4; x.action = { family:'light', t:0.5, variant:0 };
      T.assertEqual(S.select(x,'melee',C).state, 'DEATH');
    });

    /* ---- autoridad ---------------------------------------------------- */

    T.test('todos los clips declarados existen de verdad en el paquete', function () {
      var faltan = S.clipsUsados().filter(function (n) { return !C.clips[n]; });
      T.assertEqual(faltan.length, 0, 'clips inventados: ' + faltan.join(', '));
    });

    T.test('las máscaras sólo nombran huesos del rig de 17', function () {
      var R = Arena.Render.HumanoidRetarget;
      for (var m in S.MASKS) {
        S.MASKS[m].forEach(function (b) {
          T.assert(R.TARGET_BONES.indexOf(b) >= 0, m + ' nombra un hueso inexistente: ' + b);
        });
      }
      T.assertEqual(S.MASKS.full.length, 17);
    });

    T.test('ningún estado escribe combate: sólo devuelve clip, máscara y mezcla', function () {
      var s = S.select(andando(0.8), 'melee', C);
      ['hp','resource','cooldown','gcd','damage','release','targetId'].forEach(function (k) {
        T.assert(s[k] === undefined, 'la selección de animación devolvió ' + k);
      });
    });
  });
});
