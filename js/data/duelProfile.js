/* El kit de duelo es compartido por jugador, bot y HUD. El catálogo amplio
 * continúa disponible en el libro; el rig y el contrato RELEASE no cambian. */
Arena.define('data/duelProfile', ['data/powerLibrary'], function (Arena) {
  'use strict';
  var C = Arena.Data.classes, A = Arena.Data.abilities;
  var kits = {
    devastador: ['embestida','impacto_sismico','golpe_quebrador','bramido','furia','profanador'],
    guardian: ['avasallamiento','guardia_absoluta','interponer','egida','proteccion_aliada','postura'],
    centinela: ['disparo_tensado','flecha_perforante','rafaga_disruptiva','pulso_invernal','retroceso','lluvia_astillas'],
    rastreador: ['camuflaje','emboscada','trampa','marca_corrosiva','confusion','revelar'],
    arcanista: ['descarga','prision','impacto_celeste','estasis','corrupcion','velo_nulo'],
    vinculador: ['pulso_vital','regeneracion','barrera','intervencion','purificacion','enlace']
  };
  Object.keys(kits).forEach(function (id) {
    kits[id] = kits[id].map(function (suffix) { return id + '_' + suffix; });
    C[id].abilities = kits[id].slice();
    kits[id].forEach(function (aid) { A[aid].duelKit = true; A[aid].cost *= 3; });
  });
  // Dos herramientas ofensivas ya existentes completan la autonomía del sanador.
  [['power_vinculador_001','vinculador_misil_duelo'],['power_vinculador_005','vinculador_hiedra_duelo']].forEach(function(pair){
    var a=JSON.parse(JSON.stringify(A[pair[0]]));a.id=pair[1];a.sourceOrigin=pair[0];a.damageModel='arena-duel-adapted';
    a.name=pair[1]==='vinculador_misil_duelo'?'Misil del Nexo':'Hiedra del Nexo';
    a.desc=pair[1]==='vinculador_misil_duelo'?'Proyectil mágico de presión a distancia. Daño ajustado para duelo.':'Daño físico moderado e inmovilización de 1.6 s.';
    a.tip='Adaptación de duelo. La versión original se conserva en el libro de poderes.';
    if(pair[1]==='vinculador_misil_duelo'){a.effects[0].min=210;a.effects[0].max=230;a.cooldown=9;a.cost=90;}
    else {a.effects[0].min=110;a.effects[0].max=130;a.effects[1].duration=1.6;a.cost=90;}
    A[a.id]=a;a.duelKit=true;kits.vinculador.push(a.id);C.vinculador.abilities.push(a.id);
  });
  ['vinculador_pulso_vital','vinculador_regeneracion','vinculador_barrera'].forEach(function(id){A[id].cost=120;});
  // Presentación semántica para los poderes del kit pequeño, dirigida por eventos.
  var visual = {
    devastador:['physicalSkill','earthSpike','physicalSkill','dreadWave','enrage','physicalSkill'],
    guardian:['physicalSkill','ward','ward','elementWard','healPulse','ward'],
    centinela:['physicalSkill','physicalSkill','controlSeal','iceBurst','windWard','aoeRune'],
    rastreador:['windWard','physicalSkill','massRoots','darkSeal','debilitate','controlSeal'],
    arcanista:['arcaneBolt','freezePrison','meteor','controlSeal','darkSeal','darkSeal'],
    vinculador:['healPulse','healPulse','ward','elementWard','healPulse','ward']
  };
  Object.keys(visual).forEach(function(cid){visual[cid].forEach(function(shape,i){
    var a=A[kits[cid][i]],element=cid==='arcanista'?'arcane':cid==='vinculador'?'life':cid==='guardian'?'ice':cid==='rastreador'?'nature':cid==='centinela'?'wind':'earth';
    if(a.id==='centinela_pulso_invernal'||a.id==='arcanista_prision')element='ice';
    if(a.id==='arcanista_impacto_celeste')element='lightning';
    a.presentation={shape:shape,element:element,intensity:'standard',impactRadius:a.radius||1.2};
  });});
  // Apoyos sobre ti: las redirecciones a uno mismo no tienen significado.
  A.guardian_interponer.target = 'allyOrSelf';
  A.guardian_interponer.selfTargetEffects = [{type:'barrier',coefficient:1.6,duration:4}];
  A.guardian_interponer.desc = 'Sobre un aliado: te acercas y desvías el 35 % de su daño durante 4 s. Sobre ti: escudo durante 4 s.';
  A.guardian_interponer.tip = 'En duelo, se aplica sobre ti al tener al rival seleccionado.';
  A.guardian_proteccion_aliada.target = 'allyOrSelf';
  A.guardian_proteccion_aliada.desc = 'Limpia 1 control duro o 2 perjuicios menores y restaura vida al aliado o a ti.';
  A.vinculador_intervencion.target = 'allyOrSelf';
  A.vinculador_intervencion.desc = 'Durante 5 s el aliado o tú ignora poderes hostiles que no causan daño.';
  A.vinculador_enlace.target = 'allyOrSelf';
  A.vinculador_enlace.selfTargetEffects = [{type:'status',effect:'sourceBuff',duration:5,data:{damageTakenPct:-0.25}}];
  A.vinculador_enlace.desc = 'Sobre un aliado: reduce el daño un 25 % y comparte el coste. Sobre ti: reduce el daño un 25 % durante 5 s.';
  A.vinculador_enlace.tip = 'La aplicación sobre ti no redirige daño ni lo duplica.';
  A.vinculador_pulso_vital.tip = 'Repetir curaciones consume maná: alterna defensa, ataque normal y reposicionamiento.';
  // El catálogo también debe poder ayudar al lanzador cuando no hay equipo.
  Object.keys(A).forEach(function(id){
    var a=A[id];
    if(a.affects==='allies' && (a.target==='aoeSelf'||a.target==='targetArea'||a.target==='ground') && !(a.flags&&a.flags.revive)) {
      a.sourceAffects=a.affects;a.affects='alliesAndSelf';
      if(a.flags){a.flags.offensive=false;a.flags.requiresFacing=false;}
      a.tip=(a.tip||'')+' En duelo, también te beneficia a ti.';
    }
    if(a.effects && a.effects.some(function(e){return e.type==='teleportAllies';})){
      var portals=a.effects.filter(function(e){return e.type==='teleportAllies';});
      a.effects=a.effects.filter(function(e){return e.type!=='teleportAllies';});
      a.selfEffects=(a.selfEffects||[]).concat(portals);
      a.desc='Teletransporta al lanzador y a sus aliados cercanos al punto del suelo. Se ejecuta una sola vez.';
    }
  });
  A.power_guardian_062.selfTargetEffects=[{type:'status',effect:'sourceBuff',duration:8,data:{damageTakenPct:-0.30}}];
  A.power_guardian_062.desc='En un aliado, desvía su daño al Guardián. Sobre ti, reduce el daño recibido un 30 % durante 8 s.';
  A.power_vinculador_043.target='allyOrSelf';
  A.power_vinculador_043.selfTargetEffects=[{type:'heal',flat:200},{type:'barrier',flat:240,duration:8}];
  A.power_vinculador_043.desc='Revive a un aliado caído. Sobre ti, recupera 200 de vida y aporta un escudo de 240 durante 8 s; requiere completar 6 s de preparación.';
  A.power_vinculador_043.tip='La aplicación sobre ti es una adaptación de duelo, no una resurrección después de morir.';
  A.power_vinculador_050.selfEffects=[{type:'heal',flat:200},{type:'barrier',flat:240,duration:8}];
  A.power_vinculador_050.desc='Revive aliados caídos del área y ayuda al lanzador: recupera 200 de vida y un escudo de 240 durante 8 s.';
  A.power_arcanista_058.effects=[{type:'conditional',check:'targetAlive',then:[{type:'sourceDot',min:35,max:35,duration:6,interval:1,school:'magical',element:'fire'}],otherwise:[{type:'cremate'}]}];
  A.power_arcanista_058.flags.offensive=true;
  A.power_arcanista_058.desc='Sobre un rival vivo, quema durante 6 s (35 de daño mágico bruto por segundo). Sobre un cadáver, impide resucitarlo.';
  A.power_arcanista_058.tip='Daño periódico adaptado al duelo. La preparación de 4 s puede interrumpirse.';
  // El mismo encare temporal rige para el bot y el jugador.
  Object.keys(A).forEach(function (id) {
    var a = A[id];
    if (a.flags && a.flags.offensive && (a.target === 'enemy' || a.target === 'targetArea')) {
      a.flags.requiresFacing = true;
    }
  });
  Arena.Data.duelProfile = { kits:kits, version:'0.38.0', maxSeconds:240 };
});
