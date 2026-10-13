import fs from 'node:fs';
import {loadArena,root}from './simHarness.mjs';
const A=loadArena(),SM=A.Render.AnimationStateMachine,Act=A.Render.Actions,rows=[];
const cases=[
 ['Reposo',h=>h.intent.combatMode=false,0,'Sin entrada; mezcla a guardia al entrar en combate'],
 ['Guardia',h=>{},0,'Modo de combate; sale al moverse o actuar'],
 ['Caminar',h=>Object.assign(h.loco,{moveSpeed:.2,metersPerSecond:.8}),1,'Desplazamiento real; sale al detenerse'],
 ['Correr',h=>Object.assign(h.loco,{moveSpeed:1,metersPerSecond:4}),1,'Desplazamiento real; sale al detenerse'],
 ['Sprint',h=>{h.intent.speedBoosted=true;Object.assign(h.loco,{moveSpeed:1.2,metersPerSecond:5});},1,'Buff de velocidad y desplazamiento'],
 ['Retroceso',h=>Object.assign(h.loco,{moveSpeed:.5,metersPerSecond:2,moveForward:-1}),1,'Ajuste de pies nativo provisional'],
 ['Lateral izquierdo',h=>Object.assign(h.loco,{moveSpeed:.5,metersPerSecond:2,moveForward:0,moveRight:-1}),1,'Ajuste de pies nativo provisional'],
 ['Lateral derecho',h=>Object.assign(h.loco,{moveSpeed:.5,metersPerSecond:2,moveForward:0,moveRight:1}),1,'Ajuste de pies nativo provisional'],
 ['Diagonal',h=>Object.assign(h.loco,{moveSpeed:.5,metersPerSecond:2,moveForward:.7,moveRight:.7}),1,'Ajuste de pies nativo provisional'],
 ['Giro',h=>h.loco.turnRate=.5,1,'Rotación real; pie pivota, adaptación provisional'],
 ['Salto inicio',h=>Object.assign(h.loco,{airborne:true,jumpPhase:.1}),5,'Evento de salto; transición a vuelo'],
 ['Salto vuelo',h=>Object.assign(h.loco,{airborne:true,jumpPhase:.6}),5,'En el aire; transición al contacto con suelo'],
 ['Aterrizaje',h=>h.loco.landingAmount=.5,5,'Contacto con suelo; peso visual llega a cero'],
 ['Normal preparación',(h,ar)=>{Act.trigger(h.action,Act.familyFor(ar,false,null),h.cfg,false);h.action.t=.2;},3,'WINDUP real; cancelar o RELEASE'],
 ['Normal ejecución',(h,ar)=>{Act.trigger(h.action,Act.familyFor(ar,false,null),h.cfg,false);h.action.t=h.cfg.phases[h.action.family].impact;},3,'RELEASE autoritativo; nuevo evento reinicia clip'],
 ['Normal recuperación',(h,ar)=>{Act.trigger(h.action,Act.familyFor(ar,false,null),h.cfg,false);h.action.t=.85;},3,'RECOVERY/readyAt; disponible al cumplir ciclo'],
 ['Preparación de poder',(h,ar)=>{h.casting=true;h.intent.castProgress=.5;h.cast=.5;h.intent.visualAction=ar==='archer'?'archerPower':'heavy';},3,'CastStarted; termina en RELEASE, cancelación o control'],
 ['Poder ofensivo',(h,ar)=>{Act.trigger(h.action,Act.familyFor(ar,true,null),h.cfg,true,'damage');h.action.t=.5;},3,'AbilityReleased; animación no decide el daño'],
 ['Curación / buff',(h,ar)=>{Act.trigger(h.action,Act.familyFor(ar,true,ar==='melee'?'cry':null),h.cfg,true,'heal',ar==='melee'?'cry':null);h.action.t=.5;},3,'AbilityReleased; reutiliza gesto nativo de utilidad'],
 ['Daño leve',h=>{h.hurt=1;h.hurtSequence=1;},4,'DamageApplied; decae sin alterar simulación'],
 ['Daño durante casteo',(h,ar)=>{h.casting=true;h.cast=.5;h.hurt=.5;h.intent.castProgress=.5;h.intent.visualAction=ar==='archer'?'archerPower':'heavy';},3,'Capa aditiva breve de pecho; conserva casteo'],
 ['Bloqueo',h=>{h.block=1;h.blockSequence=1;},4,'AbilityBlocked; melee usa Sword_Block, demás VFX; respeta acciones'],
 ['Interrupción',h=>{h.action.cancelled=true;h.casting=false;},0,'CastCancelled; vuelve a guardia, sin commit anticipado'],
 ['Aturdimiento',h=>h.intent.crowdControl='STUN',8,'StatusApplied/Removed; pose sostenida'],
 ['Noqueo caída',h=>{h.intent.crowdControl='KNOCKDOWN';h.ccElapsed=.1;},8,'Primeros 0.38 s; reutiliza Death01'],
 ['Noqueo tendido',h=>{h.intent.crowdControl='KNOCKDOWN';h.ccElapsed=.7;},8,'Control activo; mantiene último fotograma de Death01'],
 ['Levantarse',h=>{h.ccExiting=true;h.ccExitElapsed=.3;},7,'Control eliminado; LayToIdle durante salida visual'],
 ['Enraizamiento',h=>h.intent.crowdControl='ROOT',0,'Simulación bloquea desplazamiento; permite acciones legales'],
 ['Silencio',h=>h.intent.crowdControl='SILENCE',0,'Simulación restringe poderes; locomoción y arma según reglas'],
 ['Desarme',h=>h.intent.crowdControl='DISARM',0,'Simulación restringe arma; permite magia legal'],
 ['Ralentización',h=>Object.assign(h.loco,{moveSpeed:.3,metersPerSecond:1.2}),1,'Velocidad real gobierna paso; no inmovilización total'],
 ['Estasis',h=>h.intent.crowdControl='STASIS',9,'Pose anterior congelada; continúa al eliminar estado'],
 ['Muerte',h=>h.deadTime=1,10,'EntityDied; supera acciones y controles; pose final sostenida']
];
for(const cid of Object.keys(A.Data.classes))for(const [label,setup,priority,exit]of cases){
 const ar=A.Data.archetypeOf(cid),h={cfg:A.Data.animConfigFor(cid,ar),intent:{classId:cid,combatMode:true},action:Act.createState(1),loco:{moveSpeed:0,moveForward:1,moveRight:0,metersPerSecond:0},deadTime:0,hurt:0};setup(h,ar);const s=SM.select(h,ar);
 rows.push({class:cid,state:label,selectedState:s.state,clip:s.clip,fallback:s.fallbackClip||null,source:s.source,status:s.qualityStatus,priority,exit,layer:label==='Daño durante casteo'?'Chest quaternion aditivo':label==='Bloqueo'&&ar!=='melee'?'VFX por evento':s.mask});
}
fs.writeFileSync(root+'/qa/animation-coverage.json',JSON.stringify({version:A.VERSION,scope:'Selección real sobre fixtures; prioridad numérica documental (mayor gana); no implica observación en navegador.',rows},null,2));
let md='# Matriz de animaciones · v0.38\n\nLa simulación decide las restricciones, tiempos y resultados. Esta matriz enumera la selección real con fixtures: no es evidencia de una partida en navegador. Clips UAL nativos se cargan de los tres GLB incluidos. Las adaptaciones de arco, pies direccionales, caída/noqueo y poses sostenidas conservan su condición provisional. La calificación FINAL del contrato describe la elección de fuente; no acredita calidad artística AAA.\n\nEl arranque/parada combina locomoción con reposo mediante las mezclas existentes; no se inventan clips dedicados. No hay canalización independiente en el kit de duelo: las preparaciones largas usan el estado CAST_CHARGE. Evasión, absorción, resistencia, reflejo y escudo tienen texto/VFX por evento, sin mover al personaje ni cancelar casteo. Entrar/salir del modo mágico reutiliza Spell_Simple_Enter/Exit; estas transiciones nunca superan muerte, noqueo, aturdimiento o estasis.\n\nEl reinicio elimina las entidades y sus handles; crea reposo y cooldowns nuevos. Una acción repetida recibe un token nuevo aunque comparta clip. Las piernas siguen el movimiento real durante acciones compatibles. Bloqueo durante casteo/ataque conserva la acción y muestra VFX; daño leve añade una reacción de pecho.\n\n| Clase | Estado real | Selección / clip | Origen y adaptación | Prioridad | Transición y salida |\n|---|---|---|---|---:|---|\n';
for(const r of rows)md+=`| ${r.class} | ${r.state} | ${r.selectedState} · ${r.clip||'pose congelada'}${r.fallback?' → '+r.fallback:''} | ${r.source} / ${r.status} · ${r.layer} | ${r.priority} | ${r.exit} |\n`;
fs.writeFileSync(root+'/docs/ANIMATION_MATRIX_038.md',md);console.log('Coverage rows:',rows.length);
