Arena.define('ui/duelPolish', ['ui/gameShell','combat/abilitySystem'], function (Arena) {
  'use strict';
  function DuelPolish(game) {
    this.game=game;this.lastReason='';this.flash=0;
    var root=document.createElement('div');root.className='duel-polish';
    root.innerHTML='<div class="damage-vignette" aria-hidden="true"></div><div class="duel-utilities"><span>v0.38</span><button data-open>Ajustes</button><button data-lobby>Salir al lobby</button></div>'+
      '<div class="weapon-cycle"><div class="weapon-cycle-head"><b data-weapon>ARMA PREPARADA</b><span data-time></span></div><div class="weapon-cycle-track"><i></i></div><small data-guidance></small></div>'+
      '<section class="duel-settings" hidden><h2>Ajustes</h2><label>Volumen <input data-volume type="range" min="0" max="100" value="50"></label><label>Sensibilidad <input data-sensitivity type="range" min="10" max="60" value="31"></label><label><input data-motion type="checkbox"> Reducir sacudidas y destellos</label><p>WASD · mover / Q y E · girar<br>1–8 · kit de clase / T · ataque normal<br>Tab · rival / Esc · cancelar / R · revancha<br>Botón izquierdo · orientar / derecho · mirar</p><button data-close>Volver al juego</button></section>';
    document.body.appendChild(root);this.root=root;
    this.vignette=root.querySelector('.damage-vignette');this.cycle=root.querySelector('.weapon-cycle');
    this.weapon=root.querySelector('[data-weapon]');this.time=root.querySelector('[data-time]');
    this.progress=root.querySelector('.weapon-cycle-track i');this.guidance=root.querySelector('[data-guidance]');
    var panel=root.querySelector('.duel-settings'),self=this;this.panel=panel;
    root.querySelector('[data-open]').onclick=function(){panel.hidden=!panel.hidden;game._keys=Object.create(null);game._exitPointerLock();};
    root.querySelector('[data-close]').onclick=function(){self.closeSettings();};
    root.querySelector('[data-lobby]').onclick=function(){panel.hidden=true;game.enterLobby();};
    root.querySelector('[data-volume]').oninput=function(){if(Arena.Audio.setVolume)Arena.Audio.setVolume(Number(this.value)/100);self.save();};
    root.querySelector('[data-sensitivity]').oninput=function(){game.renderer.camera.sensitivity=Number(this.value)/10000;self.save();};
    root.querySelector('[data-motion]').onchange=function(){game.renderer.camera.reducedMotion=this.checked;game.renderer.camera._shake=0;self.save();};
    this.load();
    game.world.bus.on('DamageApplied',function(p){if(p.targetId===game.hud.playerId&&p.applied>0&&!p.periodic)self.flash=Math.min(.32,self.flash+p.applied/1200);});
    game.world.bus.on('WorldReset',function(){self.flash=0;self.lastReason='';});
  }
  DuelPolish.prototype.closeSettings=function(){if(this.panel.hidden)return false;this.panel.hidden=true;if(this.game.renderer.canvas)this.game.renderer.canvas.focus({preventScroll:true});return true;};
  DuelPolish.prototype.save=function(){
    try{localStorage.setItem('arena.settings.v038',JSON.stringify({volume:Number(this.root.querySelector('[data-volume]').value),sensitivity:Number(this.root.querySelector('[data-sensitivity]').value),motion:this.root.querySelector('[data-motion]').checked}));}catch(e){}
  };
  DuelPolish.prototype.load=function(){
    try{var s=JSON.parse(localStorage.getItem('arena.settings.v038')||'null');if(!s)return;
      var vol=Math.max(0,Math.min(100,Number(s.volume)||0)),sens=Math.max(10,Math.min(60,Number(s.sensitivity)||31));
      this.root.querySelector('[data-volume]').value=vol;this.root.querySelector('[data-sensitivity]').value=sens;
      this.root.querySelector('[data-motion]').checked=!!s.motion;
      // Audio is already registered; its context may still be awaiting a gesture.
      Arena.Audio.setVolume(vol/100);this.game.renderer.camera.sensitivity=sens/10000;
      this.game.renderer.camera.reducedMotion=!!s.motion;
    }catch(e){}
  };
  DuelPolish.prototype.update=function(dt){
    var g=this.game,p=g.world.getPlayer(),active=g.flow.phase==='ACTIVE';
    this.cycle.hidden=!active||!p||!p.alive;
    this.flash=Math.max(0,this.flash-dt*.8);
    this.vignette.style.opacity=g.renderer.camera.reducedMotion?'0':String(this.flash);
    if(!active||!p||!p.alive)return;
    var now=g.world.time,ws=p.weaponState||{},ar=Arena.Data.archetypeOf(p.classId);
    var phase=ws.phase||'READY',left=Math.max(0,(ws.readyAt||0)-now),fraction=1;
    var label='Arma preparada';
    if(phase==='WINDUP'){
      left=Math.max(0,(ws.releaseAt||0)-now);fraction=1-left/Math.max(.001,(ws.releaseAt||0)-(ws.windupStartedAt||0));
      label=ar==='archer'?'Tensando el arco':ar==='caster'?'Preparando descarga':'Preparando golpe';
    }else if(left>0){
      var cycle=Arena.Combat.AbilitySystem._weaponCycle(p);fraction=1-left/cycle;
      label=ar==='archer'?'Preparando flecha':ar==='caster'?'Recuperando energía':'Recuperando arma';
    }
    if(p.cast){label='Lanzando poder';left=Math.max(0,p.cast.endTime-now);fraction=(now-p.cast.startTime)/Math.max(.001,p.cast.duration);}
    this.weapon.textContent=label;this.time.textContent=left>0?left.toFixed(1)+' s':(p.autoAttackOn?'Ataque normal activo':'T · activar ataque normal');
    this.progress.style.transform='scaleX('+Math.max(0,Math.min(1,fraction))+')';
    var target=g.world.getEntity(p.targetId),guidance='';
    if(!p.mods().canUseAbility)guidance='Bajo control · revisa los estados';
    else if(!target||!target.alive)guidance='Tab · selecciona al rival';
    else if(g.world.areHostile(p,target)){
      var V=Arena.Math.Vec3,dist=V.distXZ(p.pos,target.pos)-p.radius-target.radius;
      if(Math.abs(V.angleDelta(p.yaw,V.yawTo(p.pos,target.pos)))>Arena.Data.balance.AUTO_ATTACK_HALF_ANGLE)guidance='Gira para encarar al rival';
      else if(dist>p.autoAttackRange)guidance='Acércate · fuera de alcance';
      else if(!g.world.hasLineOfSight(p.eyePos(),target.centerPos(),p,target))guidance='Rodea el obstáculo · sin línea de visión';
      else guidance='Rival a '+Math.max(0,dist).toFixed(1)+' m · '+(p.autoAttackOn?'presión activa':'T para iniciar presión');
    }
    this.guidance.textContent=guidance;
  };
  Arena.UI.DuelPolish=DuelPolish;
});
