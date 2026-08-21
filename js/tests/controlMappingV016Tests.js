Arena.define('tests/controlMappingV016Tests',['tests/testRunner','core/controlMap'],function(Arena){
'use strict';var T=Arena.Tests,C=Arena.Core.ControlMap;
T.suite('v0.16 · contrato de teclas MMORPG',function(){
 T.test('A es strafe izquierda, D strafe derecha',function(){T.assertEqual(C.movement({a:true}).strafe,-1);T.assertEqual(C.movement({d:true}).strafe,1);});
 T.test('Q gira izquierda, E gira derecha',function(){T.assertEqual(C.turn({q:true}),-1);T.assertEqual(C.turn({e:true}),1);});
 T.test('A/D jamás generan giro',function(){T.assertEqual(C.turn({a:true}),0);T.assertEqual(C.turn({d:true}),0);});
 T.test('Q/E jamás generan strafe',function(){T.assertEqual(C.movement({q:true}).strafe,0);T.assertEqual(C.movement({e:true}).strafe,0);});
 T.test('diagonal W+D conserva ambas intenciones',function(){var m=C.movement({w:true,d:true});T.assertEqual(m.forward,1);T.assertEqual(m.strafe,1);});
 T.test('Shift activa caminar sin alterar el mapping WASD',function(){var m=C.movement({shift:true,w:true,d:true});T.assertEqual(m.walk,true);T.assertEqual(m.forward,1);T.assertEqual(m.strafe,1);T.assert(C.WALK_SPEED_SCALE>0&&C.WALK_SPEED_SCALE<0.4,'la marcha táctica debe ser menor que correr');});
 T.test('sin Shift correr sigue siendo el comportamiento por defecto',function(){T.assertEqual(C.movement({w:true}).walk,false);});
});
});
