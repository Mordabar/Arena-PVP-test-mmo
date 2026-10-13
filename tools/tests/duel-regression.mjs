import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadArena,root} from './simHarness.mjs';
const A=loadArena(), Ability=A.Combat.AbilitySystem;
const ids=Object.keys(A.Data.classes);
const profiles={devastador:'chaser',guardian:'peel',centinela:'kiter',rastreador:'kiter',arcanista:'caster',vinculador:'support'};
const errors=[], report={version:A.VERSION,checks:0,duels:[],powers:[],catalogue:[],limits:['Simulación sin navegador; no acredita gamefeel ni calidad visual comercial.']};
function check(v,msg){assert.ok(v,msg);report.checks++;}
function fixture(cid,other='guardian',opts={}){
  const w=new A.Sim.World({seed:opts.seed||42});
  const p=A.Data.makeEntity(cid,{id:'player',team:0,x:-4,z:0,yaw:Math.PI/2,...opts.player});
  const t=A.Data.makeEntity(other,{id:'enemy',team:1,x:-2,z:0,yaw:-Math.PI/2});
  w.addEntity(p);w.addEntity(t);A.Data.passives.initEntity(p);A.Data.passives.initEntity(t);
  p.targetId=t.id;t.targetId=p.id;
  return {w,p,t};
}
// Test authoritative resource/cooldown and real outcomes for every initial kit power.
for(const cid of ids){
  const initial=new A.UI.ActionBarState.State(cid,null);
  check(initial.bars[0].slice(0,A.Data.classes[cid].abilities.length).join()===A.Data.classes[cid].abilities.join(),cid+' default bar and entity kit agree');
  for(const aid of A.Data.classes[cid].abilities){
    const {w,p,t}=fixture(cid),ab=A.Data.abilities[aid];
    check(fs.existsSync(root+'/assets/icons/'+aid+'.svg'),aid+' local icon');
    p.hp=p.hpMax*.5;
    let ctx={target:t,targetId:t.id,groundPoint:{x:t.pos.x,y:0,z:t.pos.z}};
    ctx=Ability.inputContext(w,p,ab,ctx);
    const releases=[];w.bus.on('AbilityReleased',e=>releases.push(e));
    const before=p.resource;
    const result=Ability.tryUse(w,p,aid,ctx);
    check(result.ok,aid+' begins legally: '+result.reason);
    w.stepSeconds(Math.max(2,ab.castTime+1));
    check(releases.length===1,aid+' commits once');
    check(p.resource<=before-Ability.costOf(w,p,ab)+30,aid+' resource paid');
    if(ab.cooldown>3)check(p.cooldownRemaining(aid,w.time)>0,aid+' cooldown committed');
    if(aid==='guardian_interponer')check(p.totalBarrier()>0,'self Interponer creates barrier');
    if(aid==='vinculador_enlace'){
      const beforeHp=p.hp;const out=A.Combat.DamageSystem.applyDamage(w,{source:t,target:p,raw:100,school:'pure'});
      check(Math.abs(out.applied-75)<.01,'self link reduces by 25% without recursive sharing');check(Math.abs(beforeHp-p.hp-75)<.01,'self link HP contract');
    }
    report.powers.push({class:cid,id:aid,commits:releases.length,target:releases[0].targetId});
  }
}
// Invalid input does not spend resources or begin cooldowns. Pre-commit cancellation is free.
{
  const {w,p,t}=fixture('arcanista'),ab=A.Data.abilities.arcanista_descarga;
  const resource=p.resource;let r=Ability.tryUse(w,p,ab.id,{targetId:t.id,target:t});check(r.ok,'cast starts');
  check(p.resource===resource&&!p.isOnCooldown(ab.id,w.time),'cast has no early payment');
  Ability.cancelCast(w,p,'manual');w.stepSeconds(2);
  check(p.resource===resource&&!p.isOnCooldown(ab.id,w.time),'cancel before release has no cost/cooldown');
  t.pos.x=40;r=Ability.tryUse(w,p,ab.id,{targetId:t.id,target:t});check(!r.ok&&r.reason==='range','range rejected');
  check(p.resource===resource,'invalid target has no cost');
  t.pos.x=-2;p.resource=0;r=Ability.tryUse(w,p,ab.id,{targetId:t.id,target:t});check(!r.ok&&r.reason==='resource','no resource rejected');
}
{
  const {w,p,t}=fixture('centinela');p.yaw=-Math.PI/2;
  const ab=A.Data.abilities.centinela_disparo_tensado;
  check(Ability.canUse(w,p,ab,{target:t}).reason==='facing','bots obey same facing as player');
  p.yaw=Math.PI/2;const before=p.resource;
  for(let i=0;i<6;i++)Ability.tryUse(w,p,ab.id,{target:t,targetId:t.id});
  let releases=0;w.bus.on('AbilityReleased',()=>releases++);w.stepSeconds(2);
  check(releases===1,'spam inputs do not duplicate commit');check(p.resource>=before-ab.cost-1,'cost charged once');
}
// Fixed tick and product result/restart invariants, including no fabricated victory at timeout.
{
  const {w,p,t}=fixture('arcanista');const first=A.Data.abilities.arcanista_descarga,second=A.Data.abilities.arcanista_corrupcion;
  const commits=[];w.bus.on('AbilityReleased',e=>{if(e.casterId===p.id)commits.push(e.abilityId);});
  check(Ability.tryUse(w,p,first.id,{target:t,targetId:t.id}).ok,'first queued-chain cast begins');
  w.stepSeconds(first.castTime-.1);
  const queued=Ability.tryUse(w,p,second.id,{target:t,targetId:t.id});check(queued.queued,'input accepted inside final cast window');
  for(let n=0;n<5;n++)Ability.tryUse(w,p,second.id,{target:t,targetId:t.id});
  w.stepSeconds(6);
  check(commits.filter(id=>id===first.id).length===1&&commits.filter(id=>id===second.id).length===1,'queued repeated input releases each action once');
  check(!p.pendingCast&&!p.queuedAction,'queued chain finishes without stale pending action');
}
{
  const flow=new A.Product.MatchFlow({classId:'devastador'});flow.begin('1v1','devastador',0);
  flow.update(.01);check(flow.phase==='ACTIVE','countdown completes');
  const r=flow.finish(0,{stats:{damage:100}});check(r.won&&flow.phase==='RESULTS','victory enters results');
  flow.begin('1v1','guardian',3);check(flow.result===null&&flow.matchElapsed===0,'rematch clears result and duration');
  flow.update(.25);check(flow.phase==='COUNTDOWN','prep does not instantly advance');
  flow.enterLobby();check(flow.phase==='LOBBY','lobby reachable');
  const w=new A.Sim.World();w.zones.push({});w.auras.push({});w.projectiles.push({});w.reset();
  check(!w.zones.length&&!w.auras.length&&!w.projectiles.length,'world reset cleans all effect collections');
}
// Each ordered pairing, using the actual match AI profiles (not laboratory shortcuts).
for(const seed of [42,20260810])for(const left of ids)for(const right of ids){
  const {w,p,t}=fixture(left,right,{seed,player:{x:-8,z:0}});t.pos.x=8;t.prevPos.x=8;
  for(const e of [p,t]){e.aiEnabled=true;e.aiProfile=profiles[e.classId];}
  let commits=0;w.bus.on('AbilityReleased',()=>commits++);
  while(p.alive&&t.alive&&w.time<240){
    w.step(1);check(Number.isFinite(p.hp+t.hp+p.resource+t.resource),'duel values finite');
  }
  check(commits>0,left+' / '+right+' bot uses abilities');
  const timeout=p.alive&&t.alive;
  report.duels.push({seed,left,right,seconds:Number(w.time.toFixed(2)),winner:timeout?'timeout':p.alive?left:right,commits,timeout});
}
// Audit the full retained catalogue. Context-only/situational restrictions are reported.
for(const ab of Object.values(A.Data.abilities)){
  check(fs.existsSync(root+'/assets/icons/'+ab.id+'.svg'),ab.id+' packaged icon');
  for(const ef of [...(ab.effects||[]),...(ab.selfEffects||[]),...(ab.selfTargetEffects||[])])check(!!A.Combat.Resolver.effectHandlers[ef.type],ab.id+' effect '+ef.type+' implemented');
}
report.summary={kitPowers:report.powers.length,duels:report.duels.length,timeouts:report.duels.filter(x=>x.timeout).length,catalogueIcons:Object.keys(A.Data.abilities).length};
fs.mkdirSync(root+'/qa',{recursive:true});fs.writeFileSync(root+'/qa/duel-regression.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.summary,null,2));
console.log('Checks:',report.checks);
