/* =============================================================================
 * tests/sourceParityTests.js — v0.13 · fidelidad literal del Documento Maestro.
 *
 * No prueba “balance Arena”: prueba que la base de balance ES la fuente rank-5.
 * ========================================================================== */
Arena.define('tests/sourceParityTests', ['tests/testRunner'], function (Arena) {
  'use strict';
  var T=Arena.Tests, PL=Arena.Data.powerLibrary, AB=Arena.Data.abilities;
  var EXPECT={devastador:65,guardian:65,centinela:65,rastreador:65,arcanista:75,vinculador:75};

  function bySource(classId,idx){
    var ids=PL.byClass[classId]||[];
    for(var i=0;i<ids.length;i++){var a=AB[ids[i]];if(a&&a.sourceIndex===idx)return a;}
    return null;
  }
  function fx(ab,type){
    var all=(ab.effects||[]).concat(ab.selfEffects||[]);
    for(var i=0;i<all.length;i++)if(all[i].type===type)return all[i];
    return null;
  }
  function status(ab,effect){
    var all=(ab.effects||[]).concat(ab.selfEffects||[]);
    for(var i=0;i<all.length;i++)if(all[i].type==='status'&&all[i].effect===effect)return all[i];
    return null;
  }
  function launchableHasEffect(ab){
    return ab.flags.passive || (ab.effects&&ab.effects.length) || (ab.selfEffects&&ab.selfEffects.length);
  }

  T.suite('v0.13 · Documento Maestro como fuente única', function(){
    T.test('320 registros → 290 poderes reales + 30 placeholders → 410 asignaciones', function(){
      T.assertEqual(PL.coverage.sourceEntries,320);
      T.assertEqual(PL.coverage.validNamedPowers,290);
      T.assertEqual(PL.coverage.excludedPlaceholders,30);
      T.assertEqual(PL.coverage.classAssignments,410);
      T.assertEqual(PL.excluded.length,30);
    });

    T.test('cada subclase contiene exactamente su base + especialización fuente', function(){
      for(var k in EXPECT) T.assertEqual((PL.byClass[k]||[]).length,EXPECT[k],k);
    });

    T.test('el libro jugable no contiene poderes ajenos a la fuente', function(){
      for(var k in EXPECT){
        var ids=Arena.Data.classes[k].powerBook||[];
        T.assertEqual(ids.length,EXPECT[k],k+' powerBook');
        for(var i=0;i<ids.length;i++) T.assert(AB[ids[i]]&&AB[ids[i]].sourceDerived,k+' contiene '+ids[i]);
      }
    });

    T.test('cada nombre conserva el nombre fuente y añade sólo una variación rastreable', function(){
      for(var i=0;i<PL.list.length;i++){
        var a=PL.list[i], src=a.sourceMechanics.sourceName;
        T.assert(a.name!==src,'no debe quedar nombre idéntico: '+src);
        T.assert(a.name.indexOf(src)===0,'variación irreconocible: '+a.name+' ← '+src);
      }
    });

    T.test('todo poder lanzable tiene efecto runtime y usa daño source-rank5-exact', function(){
      for(var i=0;i<PL.list.length;i++){
        var a=PL.list[i];
        T.assert(launchableHasEffect(a),'stub sin efecto: '+a.name);
        T.assertEqual(a.damageModel,'source-rank5-exact',a.name);
        if(!a.flags.passive) T.assertEqual(a.cost,a.sourceMechanics.manaRank5,'maná '+a.name);
      }
    });

    T.test('Meteorito del Vacío conserva casteo, coste, rango, daño dual y mareo', function(){
      var a=bySource('arcanista',245); T.assert(a,'Meteorito');
      T.assertEqual(a.name,'Meteorito del Vacío'); T.assertEqual(a.castTime,2); T.assertEqual(a.cooldown,15);
      T.assertEqual(a.cost,220); T.assertEqual(a.range,30);
      T.assertEqual(a.effects[0].min,350); T.assertEqual(a.effects[0].max,400);
      T.assertEqual(a.effects[1].min,350); T.assertEqual(a.effects[1].max,400);
      T.assertEqual(status(a,'silence').duration,7);
    });

    T.test('Bola de fuego / Hielo / Relámpago conservan literalmente el rango 5', function(){
      var f=bySource('arcanista',261), ice=bySource('arcanista',262), l=bySource('arcanista',263);
      T.assertEqual(f.name,'Bola de fuego del Vacío'); T.assertEqual(f.castTime,1.5); T.assertEqual(f.cooldown,15); T.assertEqual(f.radius,6); T.assertEqual(f.effects[0].min,650); T.assertEqual(f.effects[0].max,800);
      T.assertEqual(ice.name,'Explosión de hielo del Vacío'); T.assertEqual(ice.castTime,1); T.assertEqual(ice.cooldown,20); T.assertEqual(ice.effects[0].min,170); T.assertEqual(ice.effects[0].max,200); T.assertEqual(status(ice,'slow').data.slowPct,0.4); T.assertEqual(status(ice,'slow').duration,2);
      T.assertEqual(l.name,'Relámpago del Vacío'); T.assertEqual(l.castTime,2); T.assertEqual(l.cooldown,20); var d=fx(l,'sourceDot'); T.assertEqual(d.min,240); T.assertEqual(d.max,240); T.assertEqual(d.duration,5); T.assertEqual(d.interval,1);
    });

    T.test('Vampirismo realmente drena al enemigo y cura al brujo', function(){
      var w=T.makeWorld(), c=T.spawn(w,'arcanista',{team:0,x:0,z:0,hpMax:2000}), e=T.spawn(w,'guardian',{team:1,x:2,z:0,hpMax:3000});
      c.hpMaxBase=2000; c.hpMax=2000; e.hpMaxBase=3000; e.hpMax=3000; c.invalidateMods(); e.invalidateMods(); c.hp=1000; e.hp=3000; var a=bySource('arcanista',251); T.assertEqual(a.target,'enemy'); T.assertEqual(a.range,20);
      T.resolveDirect(w,c,a.id,e);
      T.assertNear(e.hp,2475,0.01,'drena 525, punto medio determinista de 450–600');
      T.assertNear(c.hp,1525,0.01,'transfiere exactamente el daño aplicado');
    });

    T.test('Curar aliado suma +700 y +5% de salud máxima; Salvador cura 60%', function(){
      var w=T.makeWorld(), c=T.spawn(w,'vinculador',{team:0,x:0,z:0,hpMax:1200}), a=T.spawn(w,'guardian',{team:0,x:1,z:0,hpMax:1000});
      var heal=bySource('vinculador',281), sav=bySource('vinculador',287);
      a.hpMaxBase=1000; a.hpMax=1000; a.invalidateMods(); var mx=a.effectiveHpMax();
      a.hp=100; T.resolveDirect(w,c,heal.id,a); T.assertNear(a.hp,Math.min(mx,100+700+mx*0.05),0.01,'700 + 5% de salud máxima efectiva');
      a.hp=100; T.resolveDirect(w,c,sav.id,a); T.assertNear(a.hp,Math.min(mx,100+mx*0.60),0.01,'60% de salud máxima efectiva');
    });

    T.test('Aplasta mentes conserva +100% arma y purga 2 con 100% de chance', function(){
      var a=bySource('devastador',17), p=fx(a,'purge'), wd=fx(a,'sourceWeaponDamage');
      T.assertEqual(wd.pctMin,1); T.assertEqual(wd.pctMax,1); T.assert(wd.bonus,'+100% es bonus');
      T.assertEqual(p.count,2); T.assertEqual(p.chance,1);
    });

    T.test('Sirvientes sádicos drena 25 maná por segundo durante 30 s', function(){
      var a=bySource('arcanista',256), d=fx(a,'sourceManaDrainDot');
      T.assert(d,'drenaje periódico'); T.assertEqual(d.min,25); T.assertEqual(d.max,25); T.assertEqual(d.duration,30); T.assertEqual(d.interval,1);
    });

    T.test('Defensa salvaje y Lazo extraplanar preservan 30%/50% de redirección', function(){
      var h=fx(bySource('rastreador',153),'companionProtectOwner');
      var c=fx(bySource('vinculador',292),'companionProtectOwner');
      T.assertEqual(h.redirectPct,0.3); T.assertEqual(h.duration,30);
      T.assertEqual(c.redirectPct,0.5); T.assertEqual(c.duration,45);
    });

    T.test('Furia natural explota desde la mascota: 750 punzante + 500 fuego + derribo 3s', function(){
      var a=bySource('rastreador',159), ca=fx(a,'companionAoE'); T.assert(ca,'AoE de mascota');
      T.assertEqual(ca.radius,10); T.assertEqual(ca.effects[0].min,750); T.assertEqual(ca.effects[1].min,500);
      T.assertEqual(ca.effects[2].effect,'knockdown'); T.assertEqual(ca.effects[2].duration,3);
    });

    T.test('pasivos de mascota se aplican a la criatura y las invocaciones expiran', function(){
      var w=T.makeWorld(), owner=T.spawn(w,'rastreador',{team:0,x:0,z:0,hpMax:1000});
      var pet=w.spawnCompanion(owner,{kind:'bestia',duration:1});
      T.assert(pet.effectiveHpMax()>pet.hpMaxBase,'Adiestramiento fuente aumenta la salud de la mascota');
      T.assertNear(pet.hp,pet.effectiveHpMax(),0.01,'nace al máximo efectivo');
      var id=pet.id; T.advance(w,1.2); T.assert(!w.getEntity(id),'la duración fuente elimina la invocación');
    });


    T.test('resistencias físicas y mágicas no se mezclan en un modificador genérico', function(){
      var wall=bySource('guardian',57), star=bySource('guardian',59), mb=bySource('vinculador',306), mw=bySource('vinculador',307);
      T.assertEqual(wall.effects[0].data.physicalDamageTakenPct,-0.5); T.assert(wall.effects[0].data.magicalDamageTakenPct===undefined,'Muro no reduce magia');
      T.assertEqual(star.effects[0].data.magicalDamageTakenPct,-0.5); T.assert(star.effects[0].data.physicalDamageTakenPct===undefined,'Escudo estelar no reduce físico');
      T.assertEqual(mb.effects[0].data.magicalDamageTakenPct,-0.3); T.assertEqual(mw.effects[0].data.physicalDamageTakenPct,-0.3);
    });

    T.test('Asistencia del Paladín protege al aliado objetivo y recibe 100% de su daño', function(){
      var w=T.makeWorld(), knight=T.spawn(w,'guardian',{team:0,x:0,z:0,hpMax:2000}), ally=T.spawn(w,'devastador',{team:0,x:1,z:0,hpMax:1500}), enemy=T.spawn(w,'arcanista',{team:1,x:2,z:0,hpMax:1200});
      knight.hpMaxBase=2000; knight.hp=2000; ally.hpMaxBase=1500; ally.hp=1500;
      var a=bySource('guardian',64); T.assertEqual(a.target,'allyOrSelf');
      Arena.Combat.Resolver.execute(w,knight,a,{target:ally});
      var rd=ally.getStatus('damageRedirect'); T.assert(rd,'el redirect vive en el aliado'); T.assertEqual(rd.data.protectorId,knight.id); T.assertEqual(rd.data.redirectPct,1);
      Arena.Combat.DamageSystem.applyDamage(w,{source:enemy,target:ally,raw:300,school:'pure',abilityId:'test'});
      T.assertNear(ally.hp,1500,0.01,'aliado no pierde HP'); T.assertNear(knight.hp,1700,0.01,'caballero recibe todo el daño');
    });

    T.test('Represalia devuelve 90% del próximo daño recibido y se consume', function(){
      var w=T.makeWorld(), ar=T.spawn(w,'centinela',{team:0,x:0,z:0,hpMax:1500}), enemy=T.spawn(w,'guardian',{team:1,x:2,z:0,hpMax:2000});
      ar.hpMaxBase=1500; ar.hp=1500; enemy.hpMaxBase=2000; enemy.hp=2000;
      var a=bySource('centinela',124); Arena.Combat.Resolver.execute(w,ar,a,{}); T.assert(ar.hasStatus('sourceRetaliation'),'carga activa');
      Arena.Combat.DamageSystem.applyDamage(w,{source:enemy,target:ar,raw:200,school:'pure',abilityId:'hit1'});
      T.assertNear(ar.hp,1300,0.01); T.assertNear(enemy.hp,1820,0.01,'retorna 180'); T.assert(!ar.hasStatus('sourceRetaliation'),'se consume');
      Arena.Combat.DamageSystem.applyDamage(w,{source:enemy,target:ar,raw:100,school:'pure',abilityId:'hit2'});
      T.assertNear(enemy.hp,1820,0.01,'no retorna un segundo golpe');
    });

    T.test('Espejo del karma devuelve 30% de cada daño durante su duración, sin consumirse', function(){
      var w=T.makeWorld(), c=T.spawn(w,'vinculador',{team:0,x:0,z:0,hpMax:1500}), enemy=T.spawn(w,'guardian',{team:1,x:2,z:0,hpMax:2000});
      c.hpMaxBase=1500; c.hp=1500; enemy.hpMaxBase=2000; enemy.hp=2000;
      var a=bySource('vinculador',305); Arena.Combat.Resolver.execute(w,c,a,{}); T.assert(c.hasStatus('sourceDamageReflect'),'espejo activo');
      Arena.Combat.DamageSystem.applyDamage(w,{source:enemy,target:c,raw:100,school:'pure',abilityId:'h1'});
      Arena.Combat.DamageSystem.applyDamage(w,{source:enemy,target:c,raw:100,school:'pure',abilityId:'h2'});
      T.assertNear(enemy.hp,1940,0.01,'30 + 30 devueltos'); T.assert(c.hasStatus('sourceDamageReflect'),'no es una sola carga');
    });

    T.test('Campo estático pulsa 100 eléctrico/s y 30% slow sólo a enemigos dentro de 10', function(){
      var w=T.makeWorld(), c=T.spawn(w,'arcanista',{team:0,x:0,z:0,hpMax:1200}), ally=T.spawn(w,'vinculador',{team:0,x:2,z:0,hpMax:1200}), enemy=T.spawn(w,'guardian',{team:1,x:3,z:0,hpMax:1500,resist:0});
      enemy.hpMaxBase=1500; enemy.hp=1500; var a=bySource('arcanista',225); Arena.Combat.Resolver.execute(w,c,a,{});
      T.advance(w,0.30); T.assertNear(enemy.mods().slowPct,0.3,0.001,'slow enemigo'); T.assertNear(ally.mods().slowPct,0,0.001,'aliado intacto'); T.assertNear(enemy.hp,1500,0.01,'sin tick anticipado');
      T.advance(w,0.80); T.assertNear(enemy.hp,1400,0.05,'primer tick exacto a 1s'); T.assertNear(ally.hp,1200,0.01,'sin daño aliado');
    });

    T.test('Comunión de mana restaura 15 por segundo a aliados y lanzador dentro del aura', function(){
      var w=T.makeWorld(), c=T.spawn(w,'vinculador',{team:0,x:0,z:0}), ally=T.spawn(w,'guardian',{team:0,x:2,z:0}), enemy=T.spawn(w,'guardian',{team:1,x:2,z:1});
      c.resource=0; ally.resource=0; enemy.resource=0; w._tickRegen=function(){}; var a=bySource('vinculador',219); Arena.Combat.Resolver.execute(w,c,a,{});
      T.advance(w,1.10); T.assertNear(c.resource,15,0.05,'caster recibe +15'); T.assertNear(ally.resource,15,0.05,'aliado recibe +15'); T.assertNear(enemy.resource,0,0.05,'enemigo no recibe aura');
    });

    T.test('Curación mayor usa un área de 6 alrededor del objetivo y no cura enemigos', function(){
      var w=T.makeWorld(), c=T.spawn(w,'vinculador',{team:0,x:0,z:0}), anchor=T.spawn(w,'guardian',{team:0,x:8,z:0,hpMax:1500}), ally=T.spawn(w,'devastador',{team:0,x:10,z:0,hpMax:1500}), enemy=T.spawn(w,'guardian',{team:1,x:9,z:0,hpMax:1500});
      anchor.hpMaxBase=ally.hpMaxBase=enemy.hpMaxBase=1500; anchor.hp=500; ally.hp=500; enemy.hp=500;
      var a=bySource('vinculador',289); Arena.Combat.Resolver.execute(w,c,a,{target:anchor});
      T.assertNear(anchor.hp,1075,0.01,'objetivo recibe promedio 575'); T.assertNear(ally.hp,1075,0.01,'aliado en área recibe 575'); T.assertNear(enemy.hp,500,0.01,'enemigo no recibe curación');
    });
  });
});
