/* =============================================================================
 * tests/gameFeelMissionTests.js — Contrato temporal de la misión Tactical Rhythm.
 * Protege RELEASE, normales estacionarios, cancelación transaccional, weaving y
 * prioridad de spell sobre autoattack. No testea "belleza"; sí invariantes.
 * ========================================================================== */
Arena.define('tests/gameFeelMissionTests', [], function (Arena) {
  'use strict';
  var T = Arena.Tests;
  var A = Arena.Combat.AbilitySystem;
  var B = Arena.Data.balance;

  function duel(world, classId, range) {
    var p = T.spawn(world, classId, { team:0, x:0, z:0 });
    p.isPlayer = true; p.yaw = 0; p.prevYaw = 0;
    var e = T.spawn(world, 'guardian', { team:1, x:0, z:range === undefined ? 2 : range });
    p.targetId = e.id; p.autoAttackOn = true; p.combatMode = true;
    return { p:p, e:e };
  }

  function tick(world, n) { for (var i=0;i<n;i++) world.stepSeconds(1/30); }
  function startNormal(world, p) { tick(world, 1); return A._weapon(p); }

  T.suite('Misión · ataque normal y RELEASE', function () {
    T.test('moverse impide iniciar normal sin resetear el intervalo', function () {
      var w=T.makeWorld(), d=duel(w,'devastador',2), p=d.p;
      var ready=A._weapon(p).readyAt;
      p._moveIntent={x:0,z:1}; tick(w,3);
      T.assertEqual(A._weapon(p).phase,'READY');
      T.assertNear(A._weapon(p).readyAt,ready,1e-6,'caminar no debe reiniciar el arma');
    });

    T.test('stop-shot: al detenerse con arma lista empieza el windup en el siguiente tick', function () {
      var w=T.makeWorld(), d=duel(w,'centinela',6), p=d.p;
      p._moveIntent={x:1,z:0}; tick(w,4);
      p._moveIntent=null; tick(w,1);
      T.assertEqual(A._weapon(p).phase,'WINDUP');
    });

    T.test('moverse durante windup cancela antes de release y no hace daño', function () {
      var w=T.makeWorld(), d=duel(w,'devastador',2), p=d.p, e=d.e;
      var hp=e.hp; startNormal(w,p);
      p._moveIntent={x:1,z:0}; tick(w,1);
      T.assertEqual(A._weapon(p).phase,'READY');
      T.assertEqual(e.hp,hp,'no debe existir daño fantasma');
    });

    T.test('el daño melee aparece sólo al alcanzar RELEASE', function () {
      var w=T.makeWorld(), d=duel(w,'devastador',2), p=d.p, e=d.e, hp=e.hp;
      var ws=startNormal(w,p);
      T.assertEqual(e.hp,hp,'WINDUP no hace daño');
      var remain=Math.max(0,ws.releaseAt-w.time-1/30); if(remain>0) T.advance(w,remain);
      T.assertEqual(e.hp,hp,'antes del release sigue intacto');
      tick(w,2);
      T.assert(e.hp<hp,'el release debe aplicar el daño');
    });

    T.test('normal exige facing, rango, LoS, no casteo y suelo', function () {
      var w=T.makeWorld(), d=duel(w,'centinela',6), p=d.p;
      p.yaw=Math.PI; tick(w,1); T.assertEqual(A._weapon(p).phase,'READY','facing');
      p.yaw=0; d.e.pos.z=40; tick(w,1); T.assertEqual(A._weapon(p).phase,'READY','rango');
      d.e.pos.z=10; p.jumpActive=true; tick(w,1); T.assertEqual(A._weapon(p).phase,'READY','aire');
      p.jumpActive=false; p.pendingCast={abilityId:'x'}; p.cast=p.pendingCast; tick(w,1); T.assertEqual(A._weapon(p).phase,'READY','cast');
    });
  });

  T.suite('Misión · casteo transaccional', function () {
    T.test('BEGIN no consume recurso, cooldown ni GCD; RELEASE sí', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e;
      p.autoAttackOn=false; p.combatMode=false;
      var ab=Arena.Data.abilities.arcanista_descarga, r0=p.resource;
      var r=A.tryUse(w,p,ab.id,{target:e,targetId:e.id});
      T.assert(r.ok && p.pendingCast,'debe comenzar el cast');
      T.assertEqual(p.resource,r0,'recurso en BEGIN');
      T.assertEqual(p.gcdUntil,0,'GCD en BEGIN');
      T.assertEqual(p.cooldowns[ab.id]||0,0,'CD en BEGIN');
      T.advance(w,ab.castTime+0.08);
      T.assert(p.resource<r0,'recurso en RELEASE');
      T.assert(p.gcdUntil>w.time-0.2,'GCD debe nacer en release');
      T.assert((p.cooldowns[ab.id]||0)>w.time,'CD debe nacer en release');
    });

    T.test('movimiento antes de RELEASE cancela sin coste, CD ni GCD', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e, ab=Arena.Data.abilities.arcanista_descarga;
      p.autoAttackOn=false; var r0=p.resource;
      A.tryUse(w,p,ab.id,{target:e,targetId:e.id});
      p._moveIntent={x:1,z:0}; tick(w,1);
      T.assertEqual(p.pendingCast,null);
      T.assertEqual(p.resource,r0);
      T.assertEqual(p.gcdUntil,0);
      T.assertEqual(p.cooldowns[ab.id]||0,0);
    });

    T.test('cancelación manual conserva recurso, CD y GCD', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e, ab=Arena.Data.abilities.arcanista_descarga, r0=p.resource;
      p.autoAttackOn=false; A.tryUse(w,p,ab.id,{target:e,targetId:e.id});
      A.cancelCast(w,p,'manual');
      T.assertEqual(p.resource,r0); T.assertEqual(p.gcdUntil,0); T.assertEqual(p.cooldowns[ab.id]||0,0);
    });

    T.test('salto cancela cast estacionario sin commit', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e, ab=Arena.Data.abilities.arcanista_descarga, r0=p.resource;
      p.autoAttackOn=false; A.tryUse(w,p,ab.id,{target:e,targetId:e.id});
      p._jumpRequested=true; tick(w,1);
      T.assertEqual(p.pendingCast,null); T.assertEqual(p.resource,r0); T.assertEqual(p.cooldowns[ab.id]||0,0);
    });

    T.test('proyectil nace en RELEASE y permanece después de que el caster se mueva', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e, ab=Arena.Data.abilities.arcanista_descarga;
      p.autoAttackOn=false; A.tryUse(w,p,ab.id,{target:e,targetId:e.id});
      T.assertEqual(w.projectiles.length,0,'BEGIN no crea proyectil');
      T.advance(w,ab.castTime+0.05);
      T.assert(w.projectiles.length>0,'RELEASE crea proyectil');
      var id=w.projectiles[0].id; p._moveIntent={x:1,z:0}; tick(w,1);
      T.assert(w.projectiles.some(function(x){return x.id===id;}),'moverse post-release no borra proyectil');
    });
  });

  T.suite('Misión · weaving y prioridad', function () {
    T.test('arquero: normal → Flecha perforante se encola y conserva ambos releases', function () {
      var w=T.makeWorld(), d=duel(w,'centinela',6), p=d.p, e=d.e;
      var normal=0, power=0;
      w.bus.on('AutoAttackReleased',function(ev){if(ev.casterId===p.id)normal++;});
      w.bus.on('AbilityReleased',function(ev){if(ev.casterId===p.id&&ev.abilityId==='centinela_flecha_perforante')power++;});
      var ws=startNormal(w,p); T.advance(w,Math.max(0,ws.releaseAt-w.time-B.INPUT_QUEUE_WINDOW/2));
      var q=A.tryUse(w,p,'centinela_flecha_perforante',{target:e,targetId:e.id});
      T.assert(q.queued,'debe quedar afterNormal');
      T.advance(w,1.2);
      T.assertEqual(normal,1); T.assertEqual(power,1);
    });

    T.test('arquero: normal → Pulso invernal también es weave', function () {
      var w=T.makeWorld(), d=duel(w,'centinela',6), p=d.p, e=d.e;
      var ws=startNormal(w,p); T.advance(w,Math.max(0,ws.releaseAt-w.time-0.10));
      var q=A.tryUse(w,p,'centinela_pulso_invernal',{target:e,targetId:e.id});
      T.assert(q.queued); T.advance(w,1.4);
      T.assert((p.cooldowns.centinela_pulso_invernal||0)>w.time,'el poder debe haber liberado');
    });

    T.test('guerrero: normal → Impacto sísmico permite normal + CC', function () {
      var w=T.makeWorld(), d=duel(w,'devastador',2), p=d.p, e=d.e;
      var normal=0,power=0; w.bus.on('AutoAttackReleased',function(){normal++;});
      w.bus.on('AbilityReleased',function(ev){if(ev.abilityId==='devastador_impacto_sismico')power++;});
      var ws=startNormal(w,p); T.advance(w,Math.max(0,ws.releaseAt-w.time-0.10));
      T.assert(A.tryUse(w,p,'devastador_impacto_sismico',{target:e,targetId:e.id}).queued);
      T.advance(w,0.8); T.assertEqual(normal,1); T.assertEqual(power,1);
    });

    T.test('weapon skill antes de RELEASE reemplaza el normal sin daño fantasma', function () {
      var w=T.makeWorld(), d=duel(w,'devastador',2), p=d.p, e=d.e;
      var normal=0; w.bus.on('AutoAttackReleased',function(){normal++;});
      startNormal(w,p);
      var r=A.tryUse(w,p,'devastador_golpe_quebrador',{target:e,targetId:e.id});
      T.assert(r.ok,'el weapon skill debe reemplazar el swing listo');
      T.advance(w,0.6);
      T.assertEqual(normal,0,'normal pre-release fue reemplazado');
    });

    T.test('después del RELEASE un weapon skill no borra el normal y respeta intervalo', function () {
      var w=T.makeWorld(), d=duel(w,'devastador',2), p=d.p, e=d.e, normal=0;
      w.bus.on('AutoAttackReleased',function(){normal++;});
      var ws=startNormal(w,p); T.advance(w,Math.max(0,ws.releaseAt-w.time+0.05));
      T.assertEqual(normal,1);
      var r=A.tryUse(w,p,'devastador_golpe_quebrador',{target:e,targetId:e.id});
      T.assertFalse(r.ok); T.assertEqual(r.reason,'weaponInterval');
      T.assertEqual(normal,1,'el golpe ya liberado es irreversible');
    });

    T.test('mago: un spell solicitado cancela el normal no liberado y gana prioridad', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e, normal=0;
      w.bus.on('AutoAttackReleased',function(){normal++;});
      startNormal(w,p);
      var r=A.tryUse(w,p,'arcanista_descarga',{target:e,targetId:e.id});
      T.assert(r.ok && p.pendingCast); T.assertEqual(normal,0); T.assertEqual(A._weapon(p).phase,'READY');
    });
  });

  T.suite('Misión · cadena del mago', function () {
    T.test('spell B en últimos 200 ms de GCD se encola y comienza al liberarse', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e;
      p.autoAttackOn=false;
      A.tryUse(w,p,'arcanista_descarga',{target:e,targetId:e.id});
      T.advance(w,Arena.Data.abilities.arcanista_descarga.castTime+0.05);
      var remain=p.gcdUntil-w.time;
      if(remain>B.INPUT_QUEUE_WINDOW*0.75) T.advance(w,remain-B.INPUT_QUEUE_WINDOW*0.75);
      var q=A.tryUse(w,p,'arcanista_prision',{target:e,targetId:e.id});
      T.assert(q.queued,'debe aceptar la cola del GCD');
      T.advance(w,B.INPUT_QUEUE_WINDOW+0.10);
      T.assert(p.pendingCast && p.pendingCast.abilityId==='arcanista_prision','B debe empezar sin machacar tecla');
    });
  });


  T.suite('Misión · bordes adversariales', function () {
    T.test('el normal también exige LoS: una columna bloquea el windup', function () {
      var w=T.makeWorld();
      var f=T.pillarFixture(w);                       // columna real de la arena
      var p=T.spawn(w,'centinela',{team:0,x:f.a.x,z:f.a.z}); p.isPlayer=true; p.yaw=Math.PI/2;
      var e=T.spawn(w,'guardian',{team:1,x:f.b.x,z:f.b.z});
      p.targetId=e.id; p.autoAttackOn=true; p.combatMode=true;
      T.assertFalse(w.hasLineOfSight(p.eyePos(),e.centerPos(),p,e),'fixture debe estar detrás de columna');
      tick(w,1); T.assertEqual(A._weapon(p).phase,'READY');
    });

    T.test('target que sale de rango antes de RELEASE hace fizzle sin commit', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e, ab=Arena.Data.abilities.arcanista_descarga, r0=p.resource;
      p.autoAttackOn=false; A.tryUse(w,p,ab.id,{target:e,targetId:e.id});
      e.pos.z=30; T.advance(w,ab.castTime+0.08);
      T.assertEqual(p.pendingCast,null); T.assertEqual(p.resource,r0); T.assertEqual(p.gcdUntil,0); T.assertEqual(p.cooldowns[ab.id]||0,0);
    });

    T.test('movimiento en el último tick antes de RELEASE gana y cancela', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e, ab=Arena.Data.abilities.arcanista_descarga, r0=p.resource;
      p.autoAttackOn=false; A.tryUse(w,p,ab.id,{target:e,targetId:e.id});
      var until=Math.max(0,ab.castTime-1/30-0.001); if(until>0) T.advance(w,until);
      p._moveIntent={x:1,z:0}; tick(w,1);
      T.assertEqual(p.pendingCast,null); T.assertEqual(p.resource,r0); T.assertEqual(p.cooldowns[ab.id]||0,0);
    });

    T.test('resultado del normal es coherente a 30/60/120/144 FPS de presentación', function () {
      function run(fps) {
        var w=T.makeWorld(), d=duel(w,'devastador',2), p=d.p, e=d.e;
        for(var i=0;i<fps*3;i++) w.advance(1/fps);
        return {hp:e.hp,releases:p.weaponState.lastReleaseAt,ticks:w.tickCount};
      }
      var a=run(30), b=run(60), c=run(120), d=run(144);
      T.assertNear(a.hp,b.hp,0.001); T.assertNear(a.hp,c.hp,0.001); T.assertNear(a.hp,d.hp,0.001);
      T.assertEqual(a.ticks,b.ticks); T.assertEqual(a.ticks,c.ticks); T.assertEqual(a.ticks,d.ticks);
    });

    T.test('la cola mantiene una sola intención: el último input válido reemplaza al anterior', function () {
      var w=T.makeWorld(), d=duel(w,'arcanista',6), p=d.p, e=d.e;
      p.autoAttackOn=false;
      A.tryUse(w,p,'arcanista_descarga',{target:e,targetId:e.id});
      T.advance(w,Arena.Data.abilities.arcanista_descarga.castTime+0.05);
      var remain=p.gcdUntil-w.time; if(remain>0.15) T.advance(w,remain-0.15);
      T.assert(A.tryUse(w,p,'arcanista_prision',{target:e,targetId:e.id}).queued);
      T.assert(A.tryUse(w,p,'arcanista_corrupcion',{target:e,targetId:e.id}).queued);
      T.assertEqual(p.queuedAction.abilityId,'arcanista_corrupcion');
    });
  });
});
