/* =============================================================================
 * tests/humanoidRetargetV018Tests.js
 *
 * Estas pruebas existen para que la matemática de retargeting se pueda dar por
 * buena SIN mirar una captura. Corren en Node contra la calibración medida de
 * los dos .glb (js/data/rigCalibration.js, generado), así que si alguien cambia
 * un asset y no regenera, se enteran aquí y no en el playtest.
 * ========================================================================== */
Arena.define('tests/humanoidRetargetV018Tests',
  ['tests/testRunner','render/humanoidRetarget','data/rigCalibration'], function (Arena) {
  'use strict';
  var T = Arena.Tests, R = Arena.Render.HumanoidRetarget, C = Arena.Data.RigCalibration;

  var MAPA = R.buildMap(C.source, C.target);
  var MAP = MAPA.map;
  var BASE = R.buildBasis(C.source, C.target, MAP, C.sourceParent);

  function grados(rad) { return rad * 180 / Math.PI; }
  function anguloEntre(a, b) {
    var d = R.q.mul(R.q.norm(a), R.q.inv(R.q.norm(b)));
    return grados(2 * Math.acos(Math.min(1, Math.abs(d[3]))));
  }
  function aplicar(q, v) {
    var ix =  q[3]*v[0] + q[1]*v[2] - q[2]*v[1];
    var iy =  q[3]*v[1] + q[2]*v[0] - q[0]*v[2];
    var iz =  q[3]*v[2] + q[0]*v[1] - q[1]*v[0];
    var iw = -q[0]*v[0] - q[1]*v[1] - q[2]*v[2];
    return [ix*q[3] + iw*-q[0] + iy*-q[2] - iz*-q[1],
            iy*q[3] + iw*-q[1] + iz*-q[0] - ix*-q[2],
            iz*q[3] + iw*-q[2] + ix*-q[1] - iy*-q[0]];
  }
  /* Dirección mundial de un hueso destino dada su rotación mundial. */
  function dirDestino(b, qMundo) {
    var h = R.TARGET_CHILD[b]; if (!h) return null;
    return R.v.norm(aplicar(qMundo, C.target[h].localPos));
  }
  function dirFuenteReposo(s) {
    var h = R.SOURCE_CHILD[s]; if (!h || !C.source[h]) return null;
    return R.v.norm(R.v.sub(C.source[h].worldPos, C.source[s].worldPos));
  }

  T.suite('v0.18 · retargeting humanoide', function () {

    /* ---- el defecto que motivó todo esto ------------------------------- */

    T.test('el mapa se deriva del lado FÍSICO, no del nombre', function () {
      /* Los huesos `Left*` del Elfo están en x<0. El personaje mira a +Z, así
         que x<0 es su lado DERECHO y le toca la fuente `_r`. */
      T.assert(C.target.LeftUpperArm.worldPos[0] < 0, 'LeftUpperArm debería estar en x<0');
      T.assert(C.source.upperarm_l.worldPos[0] > 0, 'upperarm_l debería estar en x>0');
      T.assertEqual(MAP.LeftUpperArm, 'upperarm_r');
      T.assertEqual(MAP.RightUpperArm, 'upperarm_l');
      T.assertEqual(MAP.LeftFoot, 'foot_r');
      T.assertEqual(MAP.RightUpperLeg, 'thigh_l');
    });

    T.test('ningún hueso se empareja con uno del lado contrario', function () {
      var malos = [];
      for (var b in MAP) {
        var xt = C.target[b].worldPos[0], xs = C.source[MAP[b]].worldPos[0];
        if (Math.abs(xt) < 0.01 || Math.abs(xs) < 0.01) continue;   // centrales
        if ((xt < 0) !== (xs < 0)) malos.push(b + '←' + MAP[b]);
      }
      T.assertEqual(malos.length, 0, 'emparejamientos cruzados: ' + malos.join(', '));
    });

    T.test('los 17 huesos destino tienen fuente y corrección de base', function () {
      var faltan = R.TARGET_BONES.filter(function (b) { return !MAP[b] || !BASE[b]; });
      T.assertEqual(faltan.length, 0, 'sin mapear: ' + faltan.join(', '));
    });

    /* ---- la corrección de base hace lo que dice ------------------------ */

    T.test('en reposo el destino reproduce la pose de la FUENTE, no la suya', function () {
      /* Es la diferencia entre el método absoluto y el de delta: aplicando el
         reposo de la fuente, el brazo del Elfo tiene que quedar horizontal
         (T-pose de UAL2), no colgando. */
      var q = R.q.mul(C.source[MAP.LeftUpperArm].worldQuat, BASE.LeftUpperArm);
      var d = dirDestino('LeftUpperArm', q);
      var esperado = dirFuenteReposo(MAP.LeftUpperArm);
      var err = grados(Math.acos(Math.max(-1, Math.min(1, R.v.dot(d, esperado)))));
      T.assert(err < 0.5, 'el brazo no reproduce la dirección de la fuente: ' + err.toFixed(2) + '°');
      T.assert(Math.abs(d[1]) < 0.15, 'el brazo debería quedar horizontal, y[' + d[1].toFixed(3) + ']');
    });

    T.test('el eje de todos los huesos con hijo casa con el de la fuente', function () {
      var peor = 0, quien = '';
      R.TARGET_BONES.forEach(function (b) {
        if (!R.TARGET_CHILD[b] || !MAP[b] || !R.SOURCE_CHILD[MAP[b]]) return;
        var q = R.q.mul(C.source[MAP[b]].worldQuat, BASE[b]);
        var d = dirDestino(b, q), e = dirFuenteReposo(MAP[b]);
        if (!d || !e) return;
        var a = grados(Math.acos(Math.max(-1, Math.min(1, R.v.dot(d, e)))));
        if (a > peor) { peor = a; quien = b; }
      });
      T.assert(peor < 1.0, 'peor desalineación ' + peor.toFixed(2) + '° en ' + quien);
    });

    T.test('pie y cabeza conservan su orientación de reposo', function () {
      /* Con marco de mundo en los dos rigs, B = Rs⁻¹·Rt y el hueso destino
         vuelve exactamente a su reposo. Es lo que mantiene el pie plano. */
      ['LeftFoot','RightFoot','Head'].forEach(function (b) {
        var q = R.q.mul(C.source[MAP[b]].worldQuat, BASE[b]);
        T.assert(anguloEntre(q, C.target[b].worldQuat) < 0.5,
          b + ' se desvía ' + anguloEntre(q, C.target[b].worldQuat).toFixed(2) + '° de su reposo');
      });
    });

    /* ---- higiene numérica --------------------------------------------- */

    T.test('las correcciones de base son cuaterniones unitarios y finitos', function () {
      for (var b in BASE) {
        var q = BASE[b];
        var n = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
        T.assert(isFinite(n), b + ': base no finita');
        T.assertBetween(n, 0.999, 1.001, b + ': base no normalizada (' + n.toFixed(6) + ')');
      }
    });

    T.test('un fotograma completo sale finito y normalizado', function () {
      var mundoFuente = {};
      for (var s in C.source) mundoFuente[s] = C.source[s].worldQuat;
      var restLocal = {};
      R.TARGET_BONES.forEach(function (b) { restLocal[b] = C.target[b].localQuat; });
      var out = R.retargetFrame(mundoFuente, MAP, BASE, restLocal);
      T.assertEqual(Object.keys(out).length, 17);
      R.TARGET_BONES.forEach(function (b) {
        var q = out[b];
        var n = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
        T.assert(isFinite(n), b + ': NaN en la salida');
        T.assertBetween(n, 0.999, 1.001, b + ': salida no normalizada');
      });
    });

    T.test('un hueso sin clip cae a su reposo, nunca a T-pose', function () {
      /* Es el único riesgo real del método absoluto: si un hueso no recibe
         fuente, tiene que quedarse en la pose de bind del Elfo. */
      var mundoFuente = {};
      for (var s in C.source) mundoFuente[s] = C.source[s].worldQuat;
      delete mundoFuente[MAP.LeftHand];
      var restLocal = {};
      R.TARGET_BONES.forEach(function (b) { restLocal[b] = C.target[b].localQuat; });
      var out = R.retargetFrame(mundoFuente, MAP, BASE, restLocal);
      T.assert(anguloEntre(out.LeftHand, C.target.LeftHand.localQuat) < 0.01,
        'la mano sin clip no volvió a su reposo');
    });

    /* ---- cadera y velocidad, con números medidos ----------------------- */

    T.test('la altura de cadera se escala por la razón de pierna medida', function () {
      var d = R.hipsOffsetY(C.meta.sourcePelvisY - 0.10, C.meta.sourcePelvisY, C.meta.legRatio);
      T.assertBetween(d, -0.0975, -0.0965, 'offset de cadera mal escalado: ' + d);
      T.assertBetween(C.meta.legRatio, 0.96, 0.98, 'razón de pierna fuera de lo medido');
    });

    T.test('la cadera está topada: ningún clip la puede lanzar al infinito', function () {
      T.assertEqual(R.hipsOffsetY(100, 0, 1), 0.40);
      T.assertEqual(R.hipsOffsetY(-100, 0, 1), -0.40);
    });

    T.test('playbackRate sale de la zancada MEDIDA, no de un número inventado', function () {
      var walk = C.clips.Walk_Carry_Loop;
      T.assert(walk.rootSpeed !== null, 'falta la velocidad medida del clip de marcha');
      T.assertBetween(walk.rootSpeed, 0.64, 0.66, 'la marcha debería ir a 0.650 m/s');
      T.assertBetween(R.playbackRate(0.650, walk.rootSpeed), 0.999, 1.001, 'a velocidad nominal el rate es 1');
      T.assertBetween(R.playbackRate(0.975, walk.rootSpeed), 1.499, 1.501, 'a 1.5× la velocidad, rate 1.5');
      T.assertEqual(R.playbackRate(9.0, walk.rootSpeed), 1.65, 'el rate tiene que estar topado');
    });

    /* ---- la calibración horneada sigue describiendo los assets --------- */

    T.test('la calibración trae los 17 huesos destino y el reposo de UAL2', function () {
      R.TARGET_BONES.forEach(function (b) { T.assert(C.target[b], 'falta ' + b + ' en la calibración'); });
      ['pelvis','spine_01','spine_03','upperarm_l','thigh_r','foot_l'].forEach(function (s) {
        T.assert(C.source[s], 'falta ' + s + ' en la calibración');
      });
      T.assertEqual(C.meta.rmMedido, true, 'la calibración se generó sin el gemelo _RM');
    });

    T.test('los dos esqueletos siguen en T-pose y en pose colgante', function () {
      /* Si alguien cambia el modelo, esta prueba avisa de que las conclusiones
         de docs/RETARGET_FORENSICS_V018.md dejan de aplicar. */
      var brazoFuente = dirFuenteReposo('upperarm_l');
      T.assert(Math.abs(brazoFuente[1]) < 0.05, 'UAL2 ya no está en T-pose');
      var brazoDestino = R.v.norm(R.v.sub(C.target.LeftLowerArm.worldPos, C.target.LeftUpperArm.worldPos));
      T.assert(brazoDestino[1] < -0.85, 'el Elfo ya no tiene los brazos colgando');
      var dif = grados(Math.acos(Math.max(-1, Math.min(1,
        R.v.dot(brazoDestino, dirFuenteReposo(MAP.LeftUpperArm))))));
      T.assertBetween(dif, 70, 74, 'la diferencia de hombro medida era 72°, ahora ' + dif.toFixed(1));
    });
  });
});
