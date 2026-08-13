/* =============================================================================
 * tests/animationReferenceTests.js — Animation Reference Pass v0.7
 *
 * Protege el lenguaje corporal extraído de las referencias del usuario sin
 * copiar animaciones: direcciones distintas, báculo con masa, arco con draw y
 * familias propias para el guerrero. Todo sigue siendo matemática determinista.
 * ========================================================================== */
Arena.define('tests/animationReferenceTests',
  ['tests/testRunner', 'render/anim/locomotion', 'render/anim/actions', 'data/abilities'],
  function (Arena) {
  'use strict';
  var T = Arena.Tests;
  var Loco = Arena.Render.Locomotion;
  var Act = Arena.Render.Actions;
  var cfgFor = Arena.Data.animConfigFor;

  function fake(classId) {
    return { id:'ref', classId:classId || 'devastador', pos:{x:0,y:0,z:0}, yaw:0,
      moveSpeedBase:5.4, alive:true, _statuses:[],
      hasStatus:function(id){ return this._statuses.indexOf(id)>=0; } };
  }
  function move(st,e,vx,vz,n) {
    var dt=1/60; n=n||90;
    for (var i=0;i<n;i++) { e.pos.x+=vx*dt; e.pos.z+=vz*dt; Loco.update(st,e,dt); }
  }
  function pose(family, archetype, visualAction, t) {
    var cfg=cfgFor(archetype==='caster'?'arcanista':(archetype==='archer'?'centinela':'devastador'), archetype);
    var st=Act.createState(77);
    Act.trigger(st, family, cfg, !!visualAction, null, visualAction || null);
    st.t=t===undefined?0.5:t; st.weight=1;
    return Act.upperBodyPose(st,cfg,archetype,{right:archetype==='caster'?'staff':(archetype==='archer'?'bow':'sword'),left:null},0,false,0);
  }

  T.suite('Animation Reference Pass · locomoción', function () {
    T.test('backpedal usa una zancada visual menor que avanzar', function () {
      var ef=fake(), eb=fake();
      var sf=Loco.createState(cfgFor('arcanista','caster'));
      var sb=Loco.createState(cfgFor('arcanista','caster'));
      move(sf,ef,0,5.4); move(sb,eb,0,-5.4);
      T.assert(sf.motionProfile.stride > sb.motionProfile.stride, 'backpedal debe acortar paso');
      T.assert(sf.motionProfile.twist > sb.motionProfile.twist, 'backpedal debe reducir torsión');
    });

    T.test('strafe del arquero tiene perfil propio y no reutiliza forward', function () {
      var ef=fake('centinela'), es=fake('centinela');
      var sf=Loco.createState(cfgFor('centinela','archer'));
      var ss=Loco.createState(cfgFor('centinela','archer'));
      move(sf,ef,0,5.4); move(ss,es,-4.8,0);
      T.assertEqual(ss.state,Loco.STATE.STRAFE_R,'estado lateral');
      T.assert(ss.motionProfile.arm < sf.motionProfile.arm,'strafe controla más los brazos');
      T.assert(ss.motionProfile.twist < sf.motionProfile.twist,'strafe torsiona menos el torso');
    });

    T.test('diagonal conserva más amplitud que strafe puro', function () {
      var ed=fake('centinela'), es=fake('centinela');
      var sd=Loco.createState(cfgFor('centinela','archer'));
      var ss=Loco.createState(cfgFor('centinela','archer'));
      move(sd,ed,-3.8,3.8); move(ss,es,-4.8,0);
      T.assert(sd.motionProfile.stride > ss.motionProfile.stride,'diagonal no debe sentirse como strafe puro');
    });
  });

  T.suite('Animation Reference Pass · mago', function () {
    T.test('la guardia del mago compensa el báculo contra el paso', function () {
      var cfg=cfgFor('arcanista','caster'), st=Act.createState(5);
      var a=Act.upperBodyPose(st,cfg,'caster',{right:'staff',left:null},0,false,0.28);
      var b=Act.upperBodyPose(st,cfg,'caster',{right:'staff',left:null},0,false,-0.28);
      T.assert(Math.abs(a.weaponPitch-b.weaponPitch)>0.08,'el asta debe contrapesar la mano');
      T.assert(Math.abs(a.right.wrist-b.right.wrist)>0.03,'la muñeca acompaña el agarre');
    });

    T.test('el báculo conserva orientación física en ambos extremos de zancada', function () {
      var cfg=cfgFor('arcanista','caster'), st=Act.createState(6);
      [-0.34,0,0.34].forEach(function(sw){
        var A=Act.upperBodyPose(st,cfg,'caster',{right:'staff',left:null},0,false,sw);
        var wp=A.right.pitch+A.right.elbow+A.weaponPitch;
        T.assertBetween(wp,-0.40,0.38,'asta estable durante locomoción');
      });
    });

    T.test('casteo y pulso normal siguen siendo siluetas distintas', function () {
      var cfg=cfgFor('arcanista','caster');
      var p=pose(Act.FAMILY.ARCANE_PULSE,'caster',null,0.50);
      var c=pose(Act.FAMILY.CAST,'caster','cast',0.50);
      var d=Math.abs(p.right.pitch-c.right.pitch)+Math.abs(p.left.pitch-c.left.pitch)+Math.abs(p.chestYaw-c.chestYaw);
      T.assert(d>0.50,'spell release no puede leerse como pulso normal');
    });
  });

  T.suite('Animation Reference Pass · arquero', function () {
    T.test('draw del arco flexiona el brazo de cuerda sin doblar el brazo del arco', function () {
      var A=pose(Act.FAMILY.ARCHER_SHOT,'archer','archer',0.50);
      T.assert(A.right.elbow>A.left.elbow+0.70,'mano de cuerda debe cerrar mucho más el codo');
      T.assert(A.draw>0.35,'debe existir tensión visible');
    });

    T.test('release del arco reduce draw y produce recoil', function () {
      var cfg=cfgFor('centinela','archer'), st=Act.createState(8);
      Act.trigger(st,Act.FAMILY.ARCHER_SHOT,cfg,false,null,null); st.weight=1;
      st.t=0.50; var before=Act.upperBodyPose(st,cfg,'archer',{right:'bow',left:null},0,false,0);
      st.t=0.70; var after=Act.upperBodyPose(st,cfg,'archer',{right:'bow',left:null},0,false,0);
      T.assert(before.draw>after.draw,'la cuerda debe liberarse');
      T.assert(after.bowShake>0,'release debe vibrar el arco');
    });
  });

  T.suite('Animation Reference Pass · guerrero', function () {
    T.test('los normales melee alternan horizontal y diagonal determinísticamente', function () {
      var cfg=cfgFor('devastador','melee'), st=Act.createState(9);
      Act.trigger(st,Act.FAMILY.LIGHT_SWING,cfg,false); var v0=st.variant;
      Act.trigger(st,Act.FAMILY.LIGHT_SWING,cfg,false); var v1=st.variant;
      Act.trigger(st,Act.FAMILY.LIGHT_SWING,cfg,false); var v2=st.variant;
      T.assertEqual(v0,0); T.assertEqual(v1,1); T.assertEqual(v2,0);
    });

    T.test('las dos variantes del normal producen siluetas distintas', function () {
      var cfg=cfgFor('devastador','melee'), st=Act.createState(10);
      st.family=Act.FAMILY.LIGHT_SWING; st.weight=1; st.t=0.46; st.variant=0;
      var a=Act.upperBodyPose(st,cfg,'melee',{right:'sword',left:null},0,false,0);
      st.variant=1;
      var b=Act.upperBodyPose(st,cfg,'melee',{right:'sword',left:null},0,false,0);
      var d=Math.abs(a.right.pitch-b.right.pitch)+Math.abs(a.right.yaw-b.right.yaw)+Math.abs(a.chestYaw-b.chestYaw);
      T.assert(d>0.55,'horizontal y diagonal deben leerse diferentes');
    });

    T.test('puntapié tiene familia propia y extensión de pierna', function () {
      T.assertEqual(Act.familyFor('melee',true,'kick'),Act.FAMILY.KICK,'familia kick');
      var A=pose(Act.FAMILY.KICK,'melee','kick',0.46);
      T.assert(A.kick>0.55,'la pose debe pedir extensión de pierna');
    });

    T.test('golpe de escudo y carga no reutilizan heavy swing', function () {
      T.assertEqual(Act.familyFor('melee',true,'shield'),Act.FAMILY.SHIELD_BASH);
      T.assertEqual(Act.familyFor('melee',true,'charge'),Act.FAMILY.CHARGE);
      T.assert(Act.FAMILY.SHIELD_BASH!==Act.FAMILY.HEAVY_SWING && Act.FAMILY.CHARGE!==Act.FAMILY.HEAVY_SWING);
    });
  });

  T.suite('Animation Reference Pass · metadata visual', function () {
    T.test('habilidades utility pasivas no fingen un heavy swing', function () {
      T.assertEqual(Arena.Data.abilities.guardian_guardia_absoluta.combatTiming.visualAction,'none');
      T.assertEqual(Arena.Data.abilities.rastreador_camuflaje.combatTiming.visualAction,'none');
    });

    T.test('las habilidades de arco declaran gesto de arquero', function () {
      T.assertEqual(Arena.Data.abilities.centinela_flecha_perforante.combatTiming.visualAction,'archer');
      T.assertEqual(Arena.Data.abilities.rastreador_marca_corrosiva.combatTiming.visualAction,'archer');
    });

    T.test('los hechizos del mago declaran gesto de cast', function () {
      T.assertEqual(Arena.Data.abilities.arcanista_descarga.combatTiming.visualAction,'cast');
      T.assertEqual(Arena.Data.abilities.vinculador_pulso_vital.combatTiming.visualAction,'cast');
    });
  });

  T.suite('Animation Reference Pass · sincronía de RELEASE', function () {
    T.test('un cast de arquero prepara draw antes del release', function () {
      var cfg=cfgFor('centinela','archer'), st=Act.createState(20);
      Act.beginCast(st,null,'archer');
      var A=Act.upperBodyPose(st,cfg,'archer',{right:'bow',left:null},0.82,true,0);
      T.assert(A.draw>0.35,'durante cast debe tensar el arco');
      T.assertEqual(A.gemFlash,0,'un arquero no debe heredar glow de caster');
    });

    T.test('un weapon skill melee carga cuerpo antes de release', function () {
      var cfg=cfgFor('devastador','melee'), st=Act.createState(21);
      Act.beginCast(st,null,'heavy');
      var A=Act.upperBodyPose(st,cfg,'melee',{right:'sword',left:null},0.85,true,0);
      T.assert(A.right.pitch>1.20,'arma cargada antes del release');
      T.assert(A.chestPitch<0,'torso anticipa el golpe');
    });

    T.test('beginCast transporta visualAction sin conocer ids', function () {
      var st=Act.createState(22);
      Act.beginCast(st,'projectile','archer');
      T.assertEqual(st.visualAction,'archer');
      T.assertEqual(st.castFamily,'projectile');
    });

    T.test('AnimationIntent conserva visualAction durante pre-release sin actionFamily', function () {
      var st=Act.createState(221);
      Act.beginCast(st,'projectile','archer');
      var intent=Arena.Anim.AnimationIntent.create();
      var e=fake('centinela');
      var world={ time:0, getEntity:function(){return null;} };
      Arena.Anim.AnimationIntent.build(intent,e,world,null,st);
      T.assertEqual(intent.visualAction,'archer');
    });

    T.test('todas las habilidades declaran visualAction', function () {
      var abs=Arena.Data.abilities;
      for (var id in abs) if (Object.prototype.hasOwnProperty.call(abs,id)) {
        T.assert(typeof abs[id].combatTiming.visualAction==='string','falta visualAction en '+id);
      }
    });

    T.test('las familias especiales siguen siendo deterministas', function () {
      var cfg=cfgFor('devastador','melee');
      var a=Act.createState(23), b=Act.createState(23);
      Act.trigger(a,Act.FAMILY.KICK,cfg,true,null,'kick');
      Act.trigger(b,Act.FAMILY.KICK,cfg,true,null,'kick');
      a.t=b.t=0.46; a.weight=b.weight=1;
      var pa=Act.upperBodyPose(a,cfg,'melee',{right:'sword',left:null},0,false,0);
      var pb=Act.upperBodyPose(b,cfg,'melee',{right:'sword',left:null},0,false,0);
      T.assertNear(pa.kick,pb.kick,1e-12,'misma seed/estado, misma pose');
      T.assertNear(pa.chestPitch,pb.chestPitch,1e-12,'torso determinista');
    });
  });

});
