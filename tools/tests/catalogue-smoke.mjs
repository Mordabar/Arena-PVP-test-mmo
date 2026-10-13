import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadArena,root} from './simHarness.mjs';
const errors=[];
const A=loadArena({console:{...console,error:(...v)=>errors.push(v.join(' '))}}),AS=A.Combat.AbilitySystem;
const report={version:A.VERSION,scope:'Cada activo, una ejecución aislada con objetivo legal y sin trucos. No demuestra balance ni todos los contextos.',powers:[]};
for(const ab of Object.values(A.Data.abilities)){
 if(ab.flags?.passive)continue;
 const w=new A.Sim.World({seed:42});
 const cid=ab.allowedClasses?.[0]||ab.classId||'devastador';
 const p=A.Data.makeEntity(cid,{id:'player',team:0,isPlayer:true,x:-4,z:0,yaw:Math.PI/2});
 const enemy=A.Data.makeEntity('guardian',{id:'enemy',team:1,x:-2,z:0});
 const ally=A.Data.makeEntity(cid,{id:'ally',team:0,x:-3,z:0});
 for(const e of [p,enemy,ally]){w.addEntity(e);A.Data.passives.initEntity(e);e.hp=e.hpMax*.5;}
 p.targetId=enemy.id;enemy.targetId=p.id;
 let target=ab.target==='ally'?ally:enemy;
 if(ab.flags?.revive){target=ally;target.alive=false;target.hp=0;}
 if(ab.flags?.cremate){target=enemy;target.alive=false;target.hp=0;}
 const ctx=AS.inputContext(w,p,ab,{target,targetId:target.id,groundPoint:{x:-2,y:0,z:0}});
 let releases=0;w.bus.on('AbilityReleased',e=>{if(e.casterId===p.id&&e.abilityId===ab.id)releases++;});
 const r=AS.tryUse(w,p,ab.id,ctx);
 assert.ok(r.ok,`${ab.id}: ${r.reason}`);
 w.stepSeconds(Math.max(4,(ab.castTime||0)+3));
 assert.equal(releases,1,`${ab.id} release exactly once`);
 for(const e of w.entities)assert.ok(Number.isFinite(e.hp+e.resource+e.pos.x+e.pos.z),ab.id+' finite state');
 assert.equal(errors.length,0,ab.id+': '+errors.join('\n'));
 report.powers.push({id:ab.id,target:ctx.targetId,releases,hasEffect:!!(ab.effects?.length||ab.selfEffects?.length||ab.companionEffects?.length),situational:ab.flags?.revive?'Necesita aliado muerto; no disponible en 1v1':ab.flags?.cremate?'Necesita cadáver':ab.flags?.companionOnly?'Necesita invocación':undefined});
}
report.summary={activePowers:report.powers.length,runtimeErrors:errors.length};
fs.writeFileSync(root+'/qa/catalogue-smoke.json',JSON.stringify(report,null,2));console.log(report.summary);
