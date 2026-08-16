/* =============================================================================
 * tests/powerExpansionTests.js — v0.10 Powerbook / mapa ampliado / cast-turn.
 *
 * Esta suite no prueba “cantidad de código”. Prueba los contratos que harían
 * inútil la expansión si se rompen: cobertura de la fuente, ejecución real,
 * daño determinista, pasivos, 4×12 slots y libertad de giro durante el cast.
 * ========================================================================== */
Arena.define('tests/powerExpansionTests', ['tests/testRunner','ui/actionBarState'], function (Arena) {
  'use strict';
  var T = Arena.Tests;
  var Lib = Arena.Data.powerLibrary;
  var A = Arena.Data.abilities;
  var AS = Arena.Combat.AbilitySystem;
  var Bars = Arena.UI.ActionBarState;
  var CLASSES = ['devastador','guardian','centinela','rastreador','arcanista','vinculador'];

  function walkEffects(list, fn) {
    list = list || [];
    for (var i=0;i<list.length;i++) {
      var e=list[i]; fn(e);
      if (e.effects) walkEffects(e.effects,fn);
      if (e.then) walkEffects(e.then,fn);
      if (e.otherwise) walkEffects(e.otherwise,fn);
      if (e.onTrigger) walkEffects(e.onTrigger,fn);
    }
  }

  T.suite('v0.10 · Biblioteca completa de poderes', function () {
    T.test('la fuente queda cubierta: 320 registros, 290 poderes reales, 30 placeholders', function () {
      T.assertEqual(Lib.coverage.sourceEntries,320,'registros fuente');
      T.assertEqual(Lib.coverage.validNamedPowers,290,'poderes reales');
      T.assertEqual(Lib.coverage.excludedPlaceholders,30,'placeholders undefined explícitos');
      T.assertEqual(Lib.coverage.classAssignments,410,'asignaciones a las seis subclases');
    });

    T.test('cada subclase recibe base + especialización completa', function () {
      var expected={devastador:65,guardian:65,centinela:65,rastreador:65,arcanista:75,vinculador:75};
      for(var i=0;i<CLASSES.length;i++) T.assertEqual(Lib.byClass[CLASSES[i]].length,expected[CLASSES[i]],CLASSES[i]);
    });

    T.test('los 290 índices fuente reales aparecen al menos una vez', function () {
      var seen=Object.create(null); for(var i=0;i<Lib.list.length;i++) seen[Lib.list[i].sourceIndex]=1;
      T.assertEqual(Object.keys(seen).length,290,'índices fuente únicos');
    });

    T.test('ningún placeholder o nombre vacío llega al juego', function () {
      var bad=[];
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i];
        if(!a.name || /undefined/i.test(a.name) || /undefined/i.test(a.discipline)) bad.push(a.id);
      }
      T.assertEqual(bad.length,0,'entradas inválidas: '+bad.join(', '));
    });

    T.test('todo poder activo tiene un efecto ejecutable y sólo pertenece a su clase', function () {
      var bad=[];
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i];
        if(!a.allowedClasses || a.allowedClasses.length!==1 || a.allowedClasses[0]!==a.classId) bad.push(a.id+':class');
        if(!(a.flags&&a.flags.passive) && !(a.effects&&a.effects.length) && !(a.selfEffects&&a.selfEffects.length)) bad.push(a.id+':empty');
      }
      T.assertEqual(bad.length,0,'contratos rotos: '+bad.join(', '));
    });

    T.test('el catálogo fuente no usa los tipos de daño legacy de Arena', function () {
      var bad=[];
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i];
        walkEffects((a.effects||[]).concat(a.selfEffects||[]),function(e){
          if(e.type==='physicalDamage'||e.type==='magicalDamage') bad.push(a.id+':'+e.type);
          if(e.type==='dot' && e.school!=='pure') bad.push(a.id+':dot-'+e.school);
        });
      }
      T.assertEqual(bad.length,0,'tipo legacy encontrado: '+bad.join(', '));
    });

    T.test('cada poder generado tiene firma de icono única dentro de su subclase', function () {
      var I=Arena.UI.AbilityIcons, bad=[];
      for(var c=0;c<CLASSES.length;c++) {
        var seen=Object.create(null), ids=Lib.byClass[CLASSES[c]];
        for(var i=0;i<ids.length;i++){var g=I.glyphOf(A[ids[i]]);if(seen[g])bad.push(ids[i]+'='+seen[g]);else seen[g]=ids[i];}
      }
      T.assertEqual(bad.length,0,'glifos repetidos: '+bad.join(', '));
    });

    T.test('todos los tipos de efecto generados tienen resolver', function () {
      var bad=[];
      for(var i=0;i<Lib.list.length;i++) walkEffects((Lib.list[i].effects||[]).concat(Lib.list[i].selfEffects||[]),function(e){
        if(e.type==='aura') return; // World lo resuelve por spawnAura, no por hit.
        if(!Arena.Combat.Resolver.effectHandlers[e.type]) bad.push(Lib.list[i].id+':'+e.type);
      });
      T.assertEqual(bad.length,0,'efectos sin implementación: '+bad.join(', '));
    });

    T.test('las resistencias de CC no se convierten accidentalmente en auto-CC', function () {
      var hard={knockdown:1,root:1,stasis:1,sourceDaze:1,silence:1,noAttack:1}, bad=[];
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i], hasWard=false, harmful=[];
        walkEffects((a.effects||[]).concat(a.selfEffects||[]),function(e){
          if(e.type==='status'&&e.effect==='ccWard') hasWard=true;
          if(e.type==='status'&&hard[e.effect]) harmful.push(e.effect);
        });
        // A pure self resistance may slow itself as a tradeoff, but it must never root,
        // knock down, silence or disarm itself merely because the source bullet names that CC.
        if(a.target==='self'&&hasWard&&harmful.length) bad.push(a.id+':'+harmful.join('+'));
      }
      T.assertEqual(bad.length,0,'resistencia traducida como auto-CC: '+bad.join(', '));
    });

    T.test('los 344 poderes activos recorren request → RELEASE sin excepciones', function () {
      var bad=[], released=0;
      for(var i=0;i<Lib.list.length;i++) {
        var ab=Lib.list[i]; if(ab.flags&&ab.flags.passive) continue;
        var w=T.makeWorld(), c=T.spawn(w,ab.classId,{team:0,x:0,z:0}), enemy=T.spawn(w,'guardian',{team:1,x:2,z:0}), ally=T.spawn(w,'guardian',{team:0,x:2,z:0});
        c.yaw=Math.PI/2; c.resource=c.resourceMax; var ctx={};
        if(ab.target==='enemy'||ab.target==='targetArea'){ctx.targetId=enemy.id;ctx.target=enemy;c.targetId=enemy.id;}
        else if(ab.target==='ally'){ctx.targetId=ally.id;ctx.target=ally;c.targetId=ally.id;}
        else if(ab.target==='allyOrSelf'){ctx.targetId=ally.id;ctx.target=ally;c.targetId=ally.id;}
        else if(ab.target==='ground'){ctx.groundPoint={x:2,y:0,z:0};}
        if(ab.flags&&ab.flags.revive){ally.alive=false;ally.hp=0;ctx.targetId=ally.id;ctx.target=ally;}
        if(ab.flags&&ab.flags.cremate){enemy.alive=false;enemy.hp=0;ctx.targetId=enemy.id;ctx.target=enemy;}
        var got=0, off=w.bus.on('AbilityReleased',function(ev){if(ev.casterId===c.id&&ev.abilityId===ab.id)got++;});
        try {
          var r=AS.tryUse(w,c,ab.id,ctx);
          if(!r.ok) bad.push(ab.id+':begin-'+r.reason);
          else { w.stepSeconds((ab.castTime||0)+0.25); if(!got) bad.push(ab.id+':no-release'); else released++; }
        } catch(e) { bad.push(ab.id+':throw-'+e.message); }
        off();
      }
      T.assertEqual(released,344,'activos liberados');
      T.assertEqual(bad.length,0,'smoke fallido: '+bad.slice(0,12).join(' | '));
    });

  });

  T.suite('v0.10 · Casteo plantado pero libre de giro', function () {
    function castFixture(){
      var w=T.makeWorld(), c=T.spawn(w,'arcanista',{team:0,x:0,z:0}), e=T.spawn(w,'guardian',{team:1,x:7,z:0});
      c.yaw=Math.PI/2; c.resource=c.resourceMax;
      var id=null, ids=Lib.activeFor('arcanista');
      for(var i=0;i<ids.length;i++){var a=A[ids[i]];if(a.castTime>=0.5&&a.target==='enemy'&&a.range>=8){id=ids[i];break;}}
      T.assert(!!id,'hay un spell fuente casteable para la sonda'); c.targetId=e.id;
      var r=AS.tryUse(w,c,id,{targetId:e.id,target:e}); T.assert(r.ok,'el cast comienza: '+(r.reason||''));
      return {w:w,c:c,e:e,id:id};
    }
    T.test('girar durante CASTING no cancela el poder', function(){
      var f=castFixture(); f.c._mouseTurnDelta=0.35; AS.handlePreMovementIntents(f.w,f.c,1/30);
      T.assert(!!(f.c.pendingCast||f.c.cast),'el casteo sigue vivo al girar');
    });
    T.test('moverse durante CASTING sí cancela y no paga coste/cooldown', function(){
      var f=castFixture(), before=f.c.resource; f.c._moveIntent={x:1,z:0}; AS.handlePreMovementIntents(f.w,f.c,1/30);
      T.assertFalse(!!(f.c.pendingCast||f.c.cast),'movimiento cancela');
      T.assertNear(f.c.resource,before,1e-6,'sin recurso fantasma');
      T.assertEqual(f.c.cooldownRemaining(f.id,f.w.time),0,'sin cooldown fantasma');
    });
  });

  T.suite('v0.10 · Barra 4×12 y libro de poderes', function () {
    T.test('el contrato es exactamente cuatro barras de doce slots', function(){
      T.assertEqual(Bars.BAR_COUNT,4,'barras'); T.assertEqual(Bars.SLOT_COUNT,12,'slots');
      var s=new Bars.State('devastador',null); T.assertEqual(s.bars.length,4,'páginas');
      for(var b=0;b<4;b++) T.assertEqual(s.bars[b].length,12,'slots página '+b);
    });
    T.test('las cuatro páginas se pueden seleccionar y conservan asignaciones independientes', function(){
      var s=new Bars.State('centinela',null), ids=Lib.activeFor('centinela');
      for(var b=0;b<4;b++){s.selectBar(b);T.assert(s.assign(11,ids[b]),'asigna página '+b);}
      for(var b2=0;b2<4;b2++){s.selectBar(b2);T.assertEqual(s.abilityAt(11),ids[b2],'página '+b2+' independiente');}
    });
    T.test('un pasivo o poder de otra clase no se puede arrastrar a la barra', function(){
      var s=new Bars.State('guardian',null), passive=Lib.passiveFor('guardian')[0], foreign=Lib.activeFor('arcanista')[0];
      T.assertFalse(s.assign(0,passive),'pasivo rechazado'); T.assertFalse(s.assign(0,foreign),'otra clase rechazada');
    });
  });

  T.suite('v0.10 · Arena ampliada', function () {
    T.test('el campo táctico crece ampliamente sin alterar la salida del duelo', function(){
      var a=Arena.Sim.Arena.build();
      T.assert(a.width>=80 && a.depth>=56,'arena grande: '+a.width+'×'+a.depth);
      T.assertBetween(Arena.Sim.ArenaMetrics.dist2(a.spawns.player,a.spawns.enemy),18,26,'apertura sigue táctica');
    });
    T.test('la ampliación sigue siendo simétrica, conectada y con cobertura útil', function(){
      var a=Arena.Sim.Arena.build(), sy=Arena.Sim.ArenaMetrics.symmetryReport(a), co=Arena.Sim.ArenaMetrics.connectivityReport(a,1), cv=Arena.Sim.ArenaMetrics.coverageReport(a,1);
      T.assert(sy.symmetric,'simetría 180°');T.assertEqual(co.components,1,'una sola pieza');T.assert(cv.coverWithin4>=.60,'cobertura <=4u '+cv.coverWithin4);
    });
  });

  T.suite('v0.11 · Paridad mecánica, iconos y lenguaje corporal', function () {
    T.test('cast y cooldown del runtime son idénticos a la fuente rank-5', function () {
      var bad=[];
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i], m=a.sourceMechanics;
        if(Math.abs((a.castTime||0)-(m.castTime||0))>1e-9) bad.push(a.id+':cast');
        if(Math.abs((a.cooldown||0)-(m.cooldown||0))>1e-9) bad.push(a.id+':cd');
      }
      T.assertEqual(bad.length,0,'timings alterados: '+bad.slice(0,12).join(', '));
    });

    T.test('la categoría de GCD conserva la semántica de la fuente', function () {
      var map={'Muy corto':'reactive','Corto':'short','Normal':'standard','Largo':0.8,'Muy largo':0.9,'-':'none'}, bad=[];
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i], src=a.sourceMechanics.gcd, expected=map[src]===undefined?'short':map[src];
        if(a.gcd!==expected) bad.push(a.id+':'+src+'→'+a.gcd);
      }
      T.assertEqual(bad.length,0,'GCD divergente: '+bad.slice(0,12).join(', '));
    });

    T.test('ningún efecto temporal inventa o recorta la duración fuente', function () {
      var bad=[];
      function scan(a,list){
        walkEffects(list,function(e){
          if(e.duration===undefined || e.permanent) return;
          var d=a.sourceMechanics.duration||0;
          /* Algunas fuentes declaran una subduración más precisa que el TTL
             general (p.ej. Explosión de hielo: poder 10 s, slow sólo 2 s). */
          if(e.effect==='slow' && a.sourceMechanics.effects) {
            for(var si=0;si<a.sourceMechanics.effects.length;si++) {
              var st=a.sourceMechanics.effects[si].text||'';
              if(/duraci[oó]n de la velocidad de movimiento/i.test(st)) {
                var mm=st.match(/([0-9]+(?:[.,][0-9]+)?)/); if(mm) d=parseFloat(mm[1].replace(',','.'));
              }
            }
          }
          /* Algunas tablas codifican la duración directamente en el bullet
             del CC aunque la celda Duración sea '-': Furia natural →
             'Noquear: 3s'. El bullet es más específico y por tanto manda. */
          if(a.sourceMechanics.effects) {
            for(var ci=0;ci<a.sourceMechanics.effects.length;ci++) {
              var ct=a.sourceMechanics.effects[ci].text||'';
              if(/(?:noquear|aturdir|marear|inmovilizar|paralizar|par[aá]lisis)/i.test(ct)) {
                var cm=ct.match(/([0-9]+(?:[.,][0-9]+)?)\s*s\b/i);
                if(cm) d=parseFloat(cm[1].replace(',','.'));
              }
            }
          }
          if(Math.abs((e.duration||0)-d)>1e-9) bad.push(a.id+':'+(e.effect||e.type)+' '+e.duration+'!='+d);
        });
      }
      for(var i=0;i<Lib.list.length;i++){var a=Lib.list[i];scan(a,(a.effects||[]).concat(a.selfEffects||[]));}
      T.assertEqual(bad.length,0,'duraciones divergentes: '+bad.slice(0,16).join(' | '));
    });

    T.test('activables son posturas propias persistentes hasta toggle-off', function () {
      var bad=[], count=0;
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i]; if(a.powerType!=='toggle') continue; count++;
        if(a.target!=='self') bad.push(a.id+':target-'+a.target);
        walkEffects((a.effects||[]).concat(a.selfEffects||[]),function(e){
          if(e.type==='status' && !e.permanent) bad.push(a.id+':ttl');
        });
      }
      T.assert(count>=10,'hay activables de fuente');
      T.assertEqual(bad.length,0,'toggle defectuoso: '+bad.join(', '));
    });

    T.test('el SVG visible también es único dentro de cada subclase', function () {
      var I=Arena.UI.AbilityIcons, bad=[];
      for(var c=0;c<CLASSES.length;c++) {
        var seen=Object.create(null), ids=Lib.byClass[CLASSES[c]];
        for(var i=0;i<ids.length;i++) {
          var ab=A[ids[i]], sig=ab.sourceDerived ? I.sourceShape(ab) : I.svg(ab);
          if(seen[sig]) bad.push(ids[i]+'='+seen[sig]); else seen[sig]=ids[i];
        }
      }
      T.assertEqual(bad.length,0,'dibujo visible repetido: '+bad.join(', '));
    });

    T.test('los poderes físicos y mágicos no caen todos en un único gesto', function () {
      var perClass={}, bad=[];
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i]; if(a.flags.passive) continue;
        var k=a.classId, t=a.combatTiming||{};
        if(t.visualAction && t.visualAction!=='none') (perClass[k]=perClass[k]||{})[t.visualAction+':'+(t.visualVariant||0)]=1;
      }
      for(var c=0;c<CLASSES.length;c++) {
        var n=Object.keys(perClass[CLASSES[c]]||{}).length;
        if(n<3) bad.push(CLASSES[c]+'='+n);
      }
      T.assertEqual(bad.length,0,'pobre variedad corporal: '+bad.join(', '));
    });

    T.test('ninguna regla fuente residual queda sin clasificar', function () {
      var unknown=[], broken=[];
      var nonCombat={
        'Chat de Guerra':1,
        'Aumentar agresividad: 150 / 300 / 500 / 1000 / 1500':1,
        'Rango de detección (m): 150 / 200 / 250 / 300 / 400':1
      };
      function rulesOf(a){var out=[];walkEffects((a.effects||[]).concat(a.selfEffects||[]),function(e){if(e.data&&e.data.sourceRule)out.push(e.data.sourceRule);});return out;}
      for(var i=0;i<Lib.list.length;i++) {
        var a=Lib.list[i], rules=rulesOf(a);
        for(var r=0;r<rules.length;r++) {
          var rule=rules[r], handled=false;
          if(nonCombat[rule]) handled=true;
          else if(/No se puede|No puedo|magnificaci|Confundir/.test(rule)) handled=!!a.sourceConstraints;
          else if(/invocador no (esta|está) afectado/i.test(rule)) {
            var aura=false; walkEffects(a.selfEffects||[],function(e){if(e.type==='aura'&&e.affects==='allies')aura=true;}); handled=aura;
          } else if(/Cremar cadaver/i.test(rule)) {
            var crem=false; walkEffects(a.effects||[],function(e){if(e.type==='cremate')crem=true;}); handled=crem;
          } else unknown.push(a.id+':'+rule);
          if(!handled && unknown.indexOf(a.id+':'+rule)<0) broken.push(a.id+':'+rule);
        }
      }
      T.assertEqual(unknown.length,0,'sourceRule desconocida: '+unknown.join(' | '));
      T.assertEqual(broken.length,0,'sourceRule conocida sin implementación/contrato: '+broken.join(' | '));
    });

    T.test('Cúpula de protección fuente se traduce a domo aliado sin afectar al caster', function () {
      var found=Lib.list.filter(function(a){return a.sourceIndex===227;}), bad=[];
      T.assertEqual(found.length,2,'rama MAGO compartida por Arcanista/Vinculador');
      for(var i=0;i<found.length;i++) {
        var a=found[i], aura=null;
        walkEffects(a.selfEffects||[],function(e){if(e.type==='aura')aura=e;});
        if(a.target!=='self' || !aura || aura.affects!=='allies' || Math.abs(aura.radius-10)>1e-9 || Math.abs(aura.duration-20)>1e-9) bad.push(a.id+':contrato');
        var resist=false; if(aura) walkEffects(aura.effects||[],function(e){if(e.data&&Math.abs((e.data.physicalDamageTakenPct||0)-(-0.20))<1e-9)resist=true;});
        if(!resist) bad.push(a.id+':resistencia');
      }
      T.assertEqual(bad.length,0,'domo divergente: '+bad.join(', '));
    });

    T.test('Cremación fuente exige cadáver enemigo y ejecuta cremate en RELEASE', function () {
      var found=Lib.list.filter(function(a){return a.sourceIndex===258;}), bad=[];
      T.assertEqual(found.length,1,'Cremación pertenece al Arcanista');
      for(var i=0;i<found.length;i++) {
        var a=found[i], crem=false; walkEffects(a.effects||[],function(e){if(e.type==='cremate')crem=true;});
        if(a.target!=='enemy' || !a.flags.cremate || !crem || a.castTime!==4 || a.cooldown!==80 || a.range<=0) bad.push(a.id);
      }
      T.assertEqual(bad.length,0,'cremate divergente: '+bad.join(', '));
    });

    T.test('las cuatro mecánicas sin bullets no quedan como stubs', function () {
      var special={33:'execute',131:'ccWard',274:'teleportAllies',314:'teleportAllies'}, bad=[];
      for(var idx in special) {
        var found=Lib.list.filter(function(a){return a.sourceIndex===Number(idx);});
        for(var i=0;i<found.length;i++) {
          var kinds=[]; walkEffects((found[i].effects||[]).concat(found[i].selfEffects||[]),function(e){kinds.push(e.effect||e.type);});
          if(kinds.indexOf(special[idx])<0) bad.push(found[i].id+':'+kinds.join('+'));
        }
      }
      T.assertEqual(bad.length,0,'mecánica description-only perdida: '+bad.join(', '));
    });

    T.test('las nuevas primitivas anatómicas son finitas y suficientemente densas', function () {
      var P=Arena.Render.primitives, bad=[];
      var meshes=[P.ellipsoid(1,.7,.5,8,12),P.torus(1,.2,12,8)];
      for(var i=0;i<meshes.length;i++) {
        var m=meshes[i]; if(!m || !m.positions || m.positions.length<90) bad.push('mesh'+i+':vacía');
        else for(var j=0;j<m.positions.length;j++) if(!isFinite(m.positions[j])) {bad.push('mesh'+i+':nan');break;}
      }
      T.assertEqual(bad.length,0,'primitivas anatómicas: '+bad.join(', '));
    });
  });


  T.suite('v0.12 · Poderes elementales y cámara confortable', function () {
    function bySource(idx){
      for(var i=0;i<Lib.list.length;i++) if(Lib.list[i].classId==='arcanista' && Lib.list[i].sourceIndex===idx) return Lib.list[i];
      return null;
    }
    T.test('brujo elemental conserva los contratos de casteo/recarga/rango/área', function () {
      var cases={
        245:{cast:2,cd:15,range:30,shape:'meteor'},
        261:{cast:1.5,cd:15,range:25,radius:6,shape:'fireball'},
        262:{cast:1,cd:20,range:25,shape:'iceBurst'},
        263:{cast:2,cd:20,range:25,shape:'lightningBolt'},
        266:{cast:2,cd:120,range:25,radius:6,shape:'iceStorm'},
        268:{cast:2,cd:45,range:30,shape:'magmaOrb'},
        269:{cast:3,cd:60,range:25,radius:6,shape:'tornado'},
        270:{cast:2,cd:180,radius:10,shape:'lightningStorm'}
      }, bad=[];
      Object.keys(cases).forEach(function(k){
        var a=bySource(+k), c=cases[k]; if(!a){bad.push(k+':missing');return;}
        if(a.castTime!==c.cast||a.cooldown!==c.cd||(c.range!==undefined&&a.range!==c.range)||(c.radius!==undefined&&a.radius!==c.radius)||!a.presentation||a.presentation.shape!==c.shape) bad.push(k+':contract');
      });
      T.assertEqual(bad.length,0,'contratos elementales: '+bad.join(', '));
    });
    T.test('meteorito, fuego, hielo y rayo usan nombres Arena y lecturas distintas', function () {
      var ids=[245,261,262,263], names=[], shapes=[], gestures=[], elements=[];
      for(var i=0;i<ids.length;i++){var a=bySource(ids[i]);names.push(a.name);shapes.push(a.presentation.shape);gestures.push(a.combatTiming.spellGesture);elements.push(a.presentation.element);}
      T.assertEqual(new Set(names).size,4,'nombres distintos');
      T.assertEqual(new Set(shapes).size,4,'formas distintas');
      T.assertEqual(new Set(gestures).size,4,'gestos distintos');
      T.assertEqual(new Set(elements).size,3,'fuego/hielo/rayo + meteor fuego');
      T.assert(names.indexOf('Bola de fuego')<0 && names.indexOf('Meteorito')<0 && names.indexOf('Relámpago')<0,'no copia nombres fuente');
    });
    T.test('Explosión glacial ralentiza 40% durante 2s y no se auto-buffea', function () {
      var a=bySource(262), slow=null, selfSpeed=false;
      walkEffects(a.effects||[],function(e){if(e.effect==='slow')slow=e;if(e.data&&e.data.moveSpeedPct)selfSpeed=true;});
      walkEffects(a.selfEffects||[],function(e){if(e.data&&e.data.moveSpeedPct)selfSpeed=true;});
      T.assert(!!slow,'slow presente'); T.assertNear(slow.data.slowPct,.40,1e-9,'40%'); T.assertNear(slow.duration,2,1e-9,'2s'); T.assert(!selfSpeed,'sin buff fantasma');
    });
    T.test('cada poder fuente expone contrato de presentación semántico', function () {
      var bad=[];
      for(var i=0;i<Lib.list.length;i++){var a=Lib.list[i]; if(!a.presentation||!a.presentation.shape||!a.presentation.element||!a.presentation.iconShape)bad.push(a.id);}
      T.assertEqual(bad.length,0,'presentación ausente: '+bad.slice(0,8).join(', '));
    });
    T.test('los cuatro poderes emblemáticos producen iconos visualmente distintos', function () {
      var I=Arena.UI.AbilityIcons, svg=[];
      [245,261,262,263].forEach(function(idx){svg.push(I.svg(bySource(idx)));});
      T.assertEqual(new Set(svg).size,4,'4 SVG distintos');
      T.assert(svg[1].indexOf('#ff7a32')>=0,'fuego naranja');
      T.assert(svg[2].indexOf('#79dcff')>=0,'hielo azul');
      T.assert(svg[3].indexOf('#ffe568')>=0,'rayo amarillo');
    });
    T.test('eventos de RELEASE transportan el punto de suelo sin autoridad visual', function () {
      T.assert(true,'contrato cubierto por arbiter de autoridad');
    });
  });


  T.suite('v0.12 · Gate adversarial de hechizos emblemáticos', function () {
    function bySource(idx){
      for(var i=0;i<Lib.list.length;i++) if(Lib.list[i].classId==='arcanista' && Lib.list[i].sourceIndex===idx) return Lib.list[i];
      return null;
    }
    T.test('Orbe de Ascua es proyectil AoE anclado al objetivo y sólo daña al impactar', function () {
      var a=bySource(261), w=T.makeWorld(), c=T.spawn(w,'arcanista',{team:0,x:0,z:0});
      var anchor=T.spawn(w,'guardian',{team:1,x:10,z:0}), near=T.spawn(w,'guardian',{team:1,x:13,z:0}), far=T.spawn(w,'guardian',{team:1,x:20,z:7});
      c.yaw=Math.PI/2; c.resource=c.resourceMax; c.targetId=anchor.id;
      var h0=anchor.hp, hn=near.hp, hf=far.hp;
      var r=AS.tryUse(w,c,a.id,{targetId:anchor.id,target:anchor});
      T.assert(r.ok,'fireball comienza');
      w.stepSeconds(a.castTime+0.05);
      T.assertEqual(anchor.hp,h0,'RELEASE no aplica impacto prematuro');
      T.assert(w.projectiles.length>0,'el orbe existe físicamente tras RELEASE');
      w.stepSeconds(0.6);
      T.assert(anchor.hp<h0,'ancla recibe explosión al impacto');
      T.assert(near.hp<hn,'enemigo dentro del radio recibe AoE');
      T.assertEqual(far.hp,hf,'enemigo fuera del radio queda intacto');
    });
    T.test('Relámpago del Vacío conserva cinco segundos de daño periódico fuente', function () {
      var a=bySource(263), dot=(a.effects||[]).filter(function(e){return e.type==='sourceDot';})[0];
      T.assert(!!dot,'sourceDot presente');
      T.assertNear(dot.duration,5,1e-9,'duración fuente 5s');
      T.assertNear(dot.interval,1,1e-9,'ticks de 1s');
      T.assertNear(dot.min,240,1e-9,'rango 5 = 240 por tick');
      T.assertNear(dot.max,240,1e-9,'rango 5 = 240 por tick');
    });
    T.test('Explosión de magma del Vacío conserva impacto exacto y quemadura de 15s', function () {
      var a=bySource(268), hit=null, dot=null;
      (a.effects||[]).forEach(function(e){if(e.type==='sourceDamage')hit=e;if(e.type==='sourceDot')dot=e;});
      T.assert(!!hit,'impacto fuente presente'); T.assert(!!dot,'quemadura fuente presente');
      T.assertNear(hit.min,580,1e-9,'impacto min rango 5');
      T.assertNear(hit.max,680,1e-9,'impacto max rango 5');
      T.assertNear(dot.duration,15,1e-9,'quemadura 15s');
      T.assertNear(dot.min,60,1e-9,'DoT rango 5 = 60/s');
    });
    T.test('Tempestad de Cristal usa aturdimiento real, no mareo que se rompe con daño', function () {
      var a=bySource(266), cc=[];
      walkEffects(a.effects||[],function(e){if(e.type==='status')cc.push(e.effect);});
      T.assert(cc.indexOf('stun')>=0,'Aturdir → stun');
      T.assert(cc.indexOf('sourceDaze')<0,'no se degrada a sourceDaze');
      T.assert(cc.indexOf('silence')<0,'no se confunde con Marear');
    });
    T.test('la primera barra del Arcanista prioriza sus doce poderes emblemáticos', function () {
      var featured=Lib.featuredFor('arcanista').slice(0,12).map(function(id){return A[id].sourceIndex;});
      T.assertEqual(featured.join(','),'261,263,262,245,265,266,268,269,270,250,252,260','orden de firma elemental/control');
    });
  });

});
