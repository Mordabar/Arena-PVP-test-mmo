import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadArena,root} from './simHarness.mjs';
const A=loadArena(),T=A.Data.trainerCatalogue,F=A.Combat.RegnumFormulas,R=A.Combat.Resolver,D=A.Combat.DamageSystem;
const raw=JSON.parse(fs.readFileSync(root+'/reference/trainerdata.json','utf8'));
let checks=0,cases=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const near=(a,b,m)=>check(Math.abs(a-b)<1e-6,m+': '+a+' vs '+b);
const at=(x,r)=>Array.isArray(x)?x[Math.min(x.length-1,r-1)]:x;
function fixture(cid='arcanista',targetClass='centinela'){
 const w=new A.Sim.World({seed:42});w.settings.aiEnabled=false;w.settings.rngEnabled=false;
 const p=A.Data.makeEntity(cid,{id:'p',team:0,x:0,z:0,yaw:Math.PI/2,hpMax:100000,resourceMax:100000,power:100,armor:100});
 const t=A.Data.makeEntity(targetClass,{id:'t',team:1,x:2,z:0,yaw:-Math.PI/2,hpMax:100000,armor:100});
 w.addEntity(p);w.addEntity(t);p.targetId=t.id;t.targetId=p.id;return {w,p,t};
}
check(Object.keys(raw.disciplines).length===32,'32 disciplines');
check(new Set(Object.values(T.ranks).map(e=>e.trainerKey)).size===290,'290 defined spells');
check(T.excluded.length===30,'30 empty slots explicitly excluded');
for(const [id,entry]of Object.entries(T.ranks))for(let rank=1;rank<=5;rank++){
 T.setRank(id,rank);const ab=A.Data.abilities[id],source=raw.disciplines[ab.trainerKey.split('|')[0]].spells.find(s=>s.name.en===ab.trainerKey.split('|')[1]);
 near(ab.cost,Number(at(source.mana,rank)||0),id+' cost rank '+rank);
 near(ab.castTime,Number(at(source.cast,rank)||0),id+' cast rank '+rank);
 near(ab.cooldown,Number(at(source.cooldown,rank)||0),id+' cooldown rank '+rank);
 check(fs.existsSync(root+'/'+ab.icon),'representative packaged icon '+id);
 check(ab.rank===rank&&ab.originalName===source.name.es,'rank and original identity');
 const {w,p,t}=fixture(ab.classId);p.hp=50000;p.resource=50000;
 const ally=A.Data.makeEntity(ab.classId,{id:'ally',team:0,x:1,z:0,hpMax:100000});w.addEntity(ally);ally.hp=50000;
 if(ab.flags&&ab.flags.revive)D.kill(w,ally,null,'fixture');
 if(ab.flags&&ab.flags.cremate)D.kill(w,t,null,'fixture');
 const victim=ab.target==='self'||ab.target==='allyOrSelf'?p:ab.target==='ally'||ab.affects==='allies'?ally:t;
 const ctx={target:victim,targetId:victim.id,groundPoint:{x:2,y:0,z:0},fromProjectile:true};
 if(ab.flags.passive)R._applyEffectList(w,p,p,ab,ab.selfEffects,{isSelf:true});
 else R.execute(w,p,ab,ctx);
 w.stepSeconds(2);
 check(w.entities.every(e=>Number.isFinite(e.hp)&&Number.isFinite(e.resource)),'finite mechanics '+id+' rank '+rank);
 cases++;
}
Object.keys(T.ranks).forEach(id=>T.setRank(id,5));
{
 const {w,p,t}=fixture();const meteor=T.find('arcanista','Meteor'),hits=[];
 w.bus.on('DamageApplied',h=>{if(h.abilityId===meteor.id&&h.targetId===t.id)hits.push(h);});
 R.resolveHit(w,p,t,meteor,{});
 check(hits.length===1,'meteor has one mixed hit, not two armor subtractions');
 near(hits[0].raw,750,'meteor source midpoint raw');near(hits[0].formula.armorReduction,52,'armor .52 once');near(hits[0].applied,698,'actual mixed HP damage');
 check(t.hasStatus('silence'),'meteor dizziness');near(t.getStatus('silence').endTime-w.time,7,'meteor rank 5 duration');
 T.setRank(meteor.id,1);const lo=T.find('arcanista','Meteor');check(lo.effects[0].min<350&&lo.sourceMechanics.duration===3,'rank1 gameplay differs, not just UI');T.setRank(meteor.id,5);
 w.settings.rngEnabled=true;const crit=D.applyDamage(w,{source:p,target:t,raw:200,school:'physical',element:'piercing',canCrit:true,critChance:1});
 near(crit.applied,(200-52)*1.33,'runtime critical after armor');
 const before=t.hp;D.applyDamage(w,{source:p,target:t,raw:200,school:'pure'});near(before-t.hp,200,'pure bypasses armor');
}
{
 const {w,p,t}=fixture('devastador');p.attributes.strength=50;p.weaponFlat=100;
 A.Combat.StatusSystem.apply(w,p,{effect:'sourceBuff',duration:20,data:{weaponDamagePct:1}},p);
 near(p.weaponComponents().slashing,260,'weapon buff doubles active100, not passive60');
 p.attributes.concentration=80;p.invalidateMods();near(p.criticalChance(),.05,'concentration critical base');
 A.Combat.StatusSystem.apply(w,p,{effect:'sourceBuff',duration:20,data:{criticalBonusPct:2}},p);near(p.criticalChance(),.15,'200% relative crit bonus');
 const guard=A.Data.makeEntity('guardian',{armor:100});w.addEntity(guard);
 const caution=T.find('guardian','Caution');R._applyEffectList(w,guard,guard,caution,caution.effects,{});check(guard.armor()>100,'positive protection buff is not clamped away');
 const madness=T.find('devastador','Unstoppable Madness');R._applyEffectList(w,p,p,madness,madness.effects,{});
 for(const cc of ['root','knockdown','stasis','stun','silence','disarm']){near(p.mods().ccResist[cc],1,'all madness rows retained '+cc);check(A.Combat.StatusSystem.apply(w,p,{effect:cc,duration:3,ignoreDR:true},t)===null,'resistance not bypassed by source DR policy '+cc);}
}
{
 const {w,p}=fixture('vinculador');const pet=w.spawnCompanion(p,{kind:'demonio',duration:30});let releases=0;w.bus.on('AbilityReleased',e=>{if(e.casterId===pet.id)releases++;});w.settings.aiEnabled=true;w.stepSeconds(8);check(releases===0,'companions never cast owner spell kit');
 check(F.family('vinculador')==='mage'&&F.attributeCoefficient('vinculador')===1.33,'healer formula alias');
}
{
 const {w,p}=fixture('vinculador'),pool=T.find('vinculador','Mana pool');R._applyEffectList(w,p,p,pool,pool.selfEffects,{});
 near(p.effectiveResourceMax(),p.resourceMax+500,'Mana pool adds capacity, not instant restoration');
 const regen=T.find('vinculador','Regenerate self');p.hp=50000;p.lastCombatAt=0;const max=p.effectiveHpMax();R.resolveHit(w,p,p,regen,{});w.stepSeconds(3.1);
 near(p.effectiveHpMax(),max,'regeneration does not inflate maximum HP');near(p.hp,50120,'regeneration restores 40 each second');
}
const report={version:A.VERSION,checks,rankMechanicsCases:cases,sourcePowers:290,classAssignments:410,rankVariants:2050,emptySlots:30,limits:['Headless engine tests; not browser/GPU or online multiplayer QA.','Workbook armor factor .52 is historical community beta.']};
fs.writeFileSync(root+'/qa/trainer-039.json',JSON.stringify(report,null,2));console.log(report);
