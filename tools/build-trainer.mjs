/* Rebuild the gameplay catalogue from the supplied CoRT trainer, retaining
 * the native engine handlers and subclass IDs. No web fetch or paid assets. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=process.argv[2]||path.join(root,'reference/trainerdata.json');
const raw=JSON.parse(fs.readFileSync(input,'utf8'));
const base=JSON.parse(fs.readFileSync(path.join(root,'reference/catalogue-engine-templates.json'),'utf8'));
const visuals=JSON.parse(fs.readFileSync(path.join(root,'js/data/trainerPresentation.json'),'utf8'));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const clone=x=>JSON.parse(JSON.stringify(x));
const at=(v,r)=>Array.isArray(v)?v[Math.min(v.length-1,r-1)]:v;
function number(v){ if(v===true)return {min:1,max:1,bool:true}; const s=String(v??'0').replace(/,/g,'.'); const ns=s.match(/[+-]?\d+(?:\.\d+)?/g)||['0'];let a=Number(ns[0]),b=ns.length>1?Math.abs(Number(ns[1])):a;return {min:a,max:b,pct:s.includes('%')}; }
const statMap={Strength:'strength',Dexterity:'dexterity',Intelligence:'intelligence',Constitution:'constitution',Concentration:'concentration','Class attribute':'classAttribute'};
const channelMap={
 moveSpeedPct:['Movement speed','Movement Speed'],attackSpeedPct:['Attack speed','Attack Speed','Opponent attack speed','Attack speed bonus (dual handed weapons only)','Attack Speed bonus (dual handed weapons only)'],
 castSpeedPct:['Cast speed','Cast Speed','Casting speed','Opponent casting speed'],attackRangePct:['Attack range','Attack Range','Attack range reduction'],
 criticalBonusPct:['Critical Chance','Critical Hit Chance','Critical hit chance','Opponent critical chance','Opponent critical hit chance','Target critical hit chance','Critical chance reduction'],
 critDamagePct:['Critical damage'],evasionBonusPct:['Evade chance','Evade Chance','Opponent evade chance','Opponent evasion chance'],
 armorReductionPct:['Protection'],resistReductionPct:['Protection'],damageDealtPct:['Damage bonus','Damage Bonus','Opponent damage','Damage malus'],
 weaponDamagePct:['Weapon damage bonus'],spellDamagePct:['Spell damage'],healingBonusPct:['Healing bonus','Healing Bonus'],
 healthRegenPct:['Regenerate health'],resourceRegenPct:['Mana regeneration'],lifestealPct:['Vitality absorption'],statusDurationPct:['Spell duration'],
 onHitResourceFlat:['Mana recover per hit'],onHitHealthFlat:['Health recover per hit'],detectionRange:['Detection range (m)'],threatFlat:['Increase aggressiveness'],
 normalHealthCostFlat:['Health per arrow'],normalResourceCostFlat:['Mana per arrow'],normalStackDamageFlat:['Damage per impact (two handed weapon only)'],
 normalStackDamagePct:['Attack speed bonus (dual handed weapons only)'],spellDamagePerIntOver:['1 extra damage point per Intelligence point after'],
 physicalDamageTakenPct:['Resist physical damage','Resistance to Physical and Magical Damage'],magicalDamageTakenPct:['Resist magical damage','Magical damage resistance','Resistance to Physical and Magical Damage'],
 rangedDamageTakenPct:['Ranged received damage','Range received damage','Ranged damage received'],meleeDamageTakenPct:['Melee received damage'],
 sourceDamageTakenPct:['Resist Damage','Resist damage'],blockPct:['Absolute block chance','Block Chance','Block chance'],powerImmunityPct:['Absolute spell resistance chance'],
 maxHealthFlat:['Health','Health bonus','Health for allies'],maxHealthPct:['Health','Health bonus','Health for allies']
};
const list=[], excluded=[],report={sourceVersion:raw.version,entries:[],unmatched:[]};let index=0;
for(const [dn,d] of Object.entries(raw.disciplines))for(const spell of d.spells){
 index++; if(!spell.type||/^undefined/.test(spell.name.en)){excluded.push({trainerIndex:index,discipline:dn});continue;}
 const key=dn+'|'+spell.name.en,view=visuals[key]; if(!view)throw Error('Presentation missing '+key);
 const candidates=base.filter(a=>norm(a.sourceMechanics.sourceName)===norm(spell.name.es));
 const classes=d.class==='Archer'?['centinela','rastreador']:d.class==='Mage'?['arcanista','vinculador']:d.class==='Warrior'?['devastador','guardian']:
   ({Hunter:['rastreador'],Marksman:['centinela'],Conjurer:['vinculador'],Warlock:['arcanista'],Barbarian:['devastador'],Knight:['guardian']})[d.class];
 if(!classes)throw Error('Unknown class '+d.class);
 const rows=['damage','buffs','debuffs'].flatMap(section=>(spell[section]||[]).map(e=>({...e,section})));
 const rowByLabel=(label)=>rows.find(e=>norm(e.es)===norm(label));
 const findRow=(names)=>rows.find(e=>names.some(n=>norm(n)===norm(e.en)));
 for(const cid of classes){
  const template=candidates.find(a=>a.classId===cid);if(!template)throw Error('Engine template missing '+cid+' '+spell.name.es);
  let ranks=[];
  for(let rank=1;rank<=5;rank++){
   let a=clone(template),duration=Number(at(spell.duration,rank)||0),oldDuration=Number(template.sourceMechanics.duration||0);
   a.trainerIndex=index;a.trainerKey=key;a.rank=rank;a.name=view.name;a.originalName=spell.name.es;a.discipline=d.display_name.es;a.icon=view.icon;
   a.presentation={...view,impactRadius:Number(at(spell.area,rank)||a.radius||1),spellGesture:template.presentation.spellGesture||'cast',intensity:rank>=4?'major':'standard'};
   a.cost=Number(at(spell.mana,rank)||0);a.castTime=Number(at(spell.cast,rank)||0);a.cooldown=Number(at(spell.cooldown,rank)||0);
   a.gcd=({'Very Short':'reactive',Short:'short',Normal:'standard',Long:'long','Very Long':'veryLong'})[spell.gcd]||'none';
   a.range=Number(at(spell.range,rank)||0);if(a.range===0&&['enemy','targetArea','cone','ally','allyOrSelf'].includes(a.target))a.range=template.range;
   if(spell.area)a.radius=Number(at(spell.area,rank));
   a.flags.blockable=!spell.blockable_100;a.flags.resistible=!spell.resistible_100;
   a.damageModel='trainer-rank-selected';a.sourceMechanics={...a.sourceMechanics,trainerVersion:raw.version,castTime:a.castTime,cooldown:a.cooldown,gcd:spell.gcd||'-',manaRank5:Number(at(spell.mana,5)||0),manaSelected:a.cost,duration,range:Number(at(spell.range,rank)||0),area:Number(at(spell.area,rank)||0),rank,rows:rows.map(e=>({section:e.section,label:e.es,value:at(e.value,rank)}))};
   a.desc=spell.description.es.replace(/</g,'&lt;');a.tip='Trainer '+raw.version+' · nivel '+rank+'/5. Rango 0 dirigido hereda el alcance del arma. GCD numérico: perfil Arena.';
   const N=row=>number(at(row.value,rank)),fraction=row=>N(row).min/(N(row).pct?100:1);
   function walk(e){
    if(e.duration!==undefined&&(Math.abs(e.duration-oldDuration)<.001||e.effect==='root'||e.effect==='silence'||e.effect==='stun'||e.effect==='knockdown'||e.effect==='stasis'))e.duration=duration;
    if(e.sourceText){
     const row=rowByLabel(e.sourceText.split(':')[0]);
     if(row){let n=N(row);e.sourceText=row.es+': '+String(at(row.value,rank));
      if(e.min!==undefined){e.min=n.min;e.max=n.max;}
      if(e.pctMin!==undefined){e.pctMin=n.min/100;e.pctMax=n.max/100;}
     }
    }
    if(e.data){
     const declared=e.sourceText&&rowByLabel(e.sourceText.split(':')[0]);
     if(declared&&declared.en==='Protection'){
       delete e.data.sourceDamageTakenPct;delete e.data.damageTakenPct;
       e.data.armorReductionPct=-N(declared).min/100;
     }
     for(let [k,names] of Object.entries(channelMap)){
      let existing=k==='criticalBonusPct'?'critChancePct':k==='evasionBonusPct'?'evasionPct':k;
      if(e.data[existing]===undefined)continue;
      let row=findRow(names);if(!row)continue;let n=N(row),v=n.min;
      if(/Pct$/.test(k)||k==='blockPct')v=n.pct?v/100:v;
      if(/DamageTakenPct$/.test(k)&&/^Resist|^Resistance|resistance/.test(row.en))v=-v;
      if(k==='armorReductionPct'||k==='resistReductionPct')v=-v;
      if(k==='castSpeedPct')v=-v;
      if(k==='maxHealthFlat'&&n.pct){delete e.data.maxHealthFlat;e.data.maxHealthPct=n.min/100;continue;}
      if(k==='maxHealthPct'&&!n.pct){delete e.data.maxHealthPct;e.data.maxHealthFlat=n.min;continue;}
      delete e.data[existing];e.data[k]=v;
     }
     if(e.data.slowPct!==undefined){let row=findRow(['Movement speed','Movement speed (40° arc)']);if(row)e.data.slowPct=Math.abs(N(row).min)/100;}
     if(e.data.antiHealPct!==undefined){let row=findRow(['Healing bonus','Healing Bonus']);if(row)e.data.antiHealPct=Math.abs(N(row).min)/100;}
     if(e.data.sourceStats){for(let [label,k] of Object.entries(statMap)){let row=findRow([label]);if(row&&e.data.sourceStats[k]){let n=N(row);e.data.sourceStats[k]={value:n.min,percent:!!n.pct};}}}
     if(e.data.sourceBonusDamageFlat){for(let [element,label] of Object.entries({slashing:'Slashing damage',piercing:'Piercing damage',blunt:'Blunt damage',fire:'Fire damage',ice:'Ice damage',lightning:'Lightning damage',physical:'Slashing damage'})){let row=findRow([label]);if(row&&e.data.sourceBonusDamageFlat[element]!==undefined){let n=N(row);if(n.pct){delete e.data.sourceBonusDamageFlat[element];e.data.sourceBonusDamagePct=e.data.sourceBonusDamagePct||{};e.data.sourceBonusDamagePct[element]=n.min/100;}else e.data.sourceBonusDamageFlat[element]=n.min;}}}
     if(e.data.returnPct!==undefined){let row=findRow(['Return damage','Returned damage']);if(row)e.data.returnPct=N(row).min/100;}
     if(e.data.ccResist){for(let [cc,names] of Object.entries({root:['Resist immobilize'],silence:['Resist dizzy'],stasis:['Resist freeze'],stun:['Resist stun','Resistance to stun'],knockdown:['Resist knock','Resistance to knock down'],disarm:['Resist cannot attack']})){let row=findRow(names);if(row&&e.data.ccResist[cc]!==undefined)e.data.ccResist[cc]=N(row).min/100;}}
     if(e.data.ccResist&&e.data.ccResist.noAttack!==undefined){e.data.ccResist.disarm=e.data.ccResist.noAttack;delete e.data.ccResist.noAttack;}
     if(e.data.elementDamageTakenPct){for(let [el,names] of Object.entries({fire:['Resist fire','Fire protection'],ice:['Resist cold','Ice protection'],lightning:['Resist electrical damage','Lightning protection'],slashing:['Resist slashing damage'],piercing:['Resist piercing damage'],blunt:['Blunt Resistance']})){let row=findRow(names);if(row&&e.data.elementDamageTakenPct[el]!==undefined)e.data.elementDamageTakenPct[el]=-N(row).min/100;}}
    }
    if(e.type==='barrier'){let row=findRow(['Magic barrier']);if(row)e.flat=N(row).min;}
    if(e.type==='revive'){let hp=findRow(['Health','Health (instant)']),san=findRow(['Sanctuary (seconds)','Sanctuary (s)']);if(hp){let n=N(hp);e.hpFlat=n.pct?undefined:n.min;e.hpPct=n.pct?n.min/100:0;}if(san)e.sanctuarySeconds=N(san).min;}
    if(e.type==='companionRevive'){let row=findRow(['Health']);if(row)e.hpPct=N(row).min/100;}
    if(e.type==='sourceHeal'&&!e.sourceText){let row=findRow(['Health']);if(row){let n=N(row);e.min=n.min;e.max=n.max;e.percentOfMax=!!n.pct;}}
    if(e.type==='cleanse'){let row=findRow(['Dispel negative powers (chance)']);if(row){e.chance=N(row).min/100;e.hard=999;e.minor=999;}}
    if(e.type==='possessCompanion'){let row=findRow(['Possess summon (chance)']);if(row)e.chance=N(row).min/100;}
    if(e.type==='purge'){let row=findRow(['Dispel positive powers']),chance=findRow(['Dispel chance']);if(row)e.count=N(row).min;if(chance)e.chance=N(chance).min/100;}
    if(e.type==='drainResource'){let row=rows.find(r=>r.section==='debuffs'&&r.en==='Mana');if(row){let n=N(row);if(n.pct){delete e.flat;e.pct=Math.abs(n.min)/100;}else{delete e.pct;e.flat=Math.abs(n.min);}}}
    if(e.type==='summon'){let row=findRow(['Summon','Summon imps','Summon zombies']);if(row){let value=at(row.value,rank);if(typeof value==='string')e.kind=value;else e.count=Number(value)||1;}let control=findRow(['Controllable']);e.controllable=control?at(control.value,rank)==='yes':false;}
    if(e.type==='manaBurn'){let row=findRow(['Convert mana to damage']);if(row)e.flat=N(row).min;}
    if(e.type==='execute'){let row=rows.find(r=>/health|salud/i.test(r.en+' '+r.es));if(row)e.threshold=Math.abs(N(row).min);}
    if(e.type==='tameCreature'){let row=findRow(['Tame creatures up to level']);if(row)e.maxLevel=N(row).min;}
    if(e.redirectPct!==undefined){let row=findRow(['Redirected Damage']);if(row)e.redirectPct=Math.abs(N(row).min)/100;}
    for(let field of ['effects','then','otherwise'])if(e[field])e[field].forEach(walk);
    return e;
   }
   a.effects.forEach(walk);a.selfEffects.forEach(walk);
   if(a.selfTargetEffects)a.selfTargetEffects.forEach(walk);
   if(a.companionEffects)a.companionEffects.forEach(walk);
   // Instant sacrifice consumes current health, not maximum health for 0 s.
   if(spell.name.en==='Ambitious sacrifice')a.effects=a.effects.filter(e=>!(e.data&&e.data.maxHealthFlat)).concat([{type:'selfHealthCost',flat:Math.abs(N(findRow(['Health'])).min)}]);
   // Devotion speed is a divisor (1 + VI), not a linear duration reduction.
   if(spell.name.en==='Arcane devotion'){for(const e of a.effects.concat(a.selfEffects))if(e.data){delete e.data.castSpeedPct;e.data.castSpeedBonusPct=N(findRow(['Cast speed','Casting speed'])).min/100;}}
   if(spell.name.en==='Cremation'){a.flags.cremate=true;a.effects=[{type:'cremate',chance:N(findRow(['Cremate corpse (chance)'])).min/100}];a.contextRequired='Requiere un cadáver enemigo; Arena bloquea la resurrección, sin altar de mundo abierto.';}
   if(spell.name.en==='Possess summoning')a.contextRequired='Requiere una invocación enemiga.';
   if(spell.name.en==='Heal Pet')a.contextRequired='Requiere una mascota propia activa.';
   if(spell.name.en==='Mana pool'){const row=findRow(['Mana']);a.selfEffects=[{type:'status',effect:'sourceBuff',permanent:true,data:{maxResourceFlat:N(row).min}}];}
   if(['Regenerate self','Regenerate ally'].includes(spell.name.en)){const row=findRow(['Health']),n=N(row);a.effects=[{type:'sourceHot',min:n.min,max:n.max,duration,interval:1,sourceText:row.es+': '+at(row.value,rank)}];a.selfEffects=[];}
   if(spell.name.en==='Resurrect'){a.target='ally';delete a.selfTargetEffects;a.contextRequired='Requiere un aliado muerto; no sirve como autocura en 1v1.';}
   if(/Portal$/.test(spell.name.en)){a.range=template.range||25;a.contextRequired='Adaptación Arena: destino marcado en el suelo; no hay mapa de altares ni locaciones del mundo abierto.';}
   // The runtime refreshes one status per effect/ability/source key. Combine
   // sibling rows now, so a six-resistance buff doesn't retain only row six.
   function mergeData(dest,src){for(const [k,v]of Object.entries(src||{})){if(v&&typeof v==='object'&&!Array.isArray(v)){dest[k]=dest[k]||{};mergeData(dest[k],v);}else if(typeof v==='number'&&typeof dest[k]==='number')dest[k]+=v;else dest[k]=v;}return dest;}
   function coalesce(effects){const out=[];for(const e of effects){if(e.type==='status'&&['sourceBuff','sourceDebuff'].includes(e.effect)){const prev=out.find(p=>p.type==='status'&&p.effect===e.effect&&p.duration===e.duration&&p.permanent===e.permanent);if(prev){mergeData(prev.data,e.data);continue;}}out.push(e);}return out;}
   a.effects=coalesce(a.effects);a.selfEffects=coalesce(a.selfEffects);if(a.companionEffects)a.companionEffects=coalesce(a.companionEffects);
   a.duelKit=false;a._causesDamage=undefined;ranks.push(a);
  }
  list.push({id:template.id,trainerKey:key,ranks});
 }
 report.entries.push({trainerIndex:index,key,name:view.name,classes});
}
const payload={version:raw.version,points:raw.points,required:raw.required,classDisciplines:raw.class_disciplines,excluded,list};
const js=`/* Generated only by tools/build-trainer.mjs. User-supplied trainer is authoritative. */\nArena.define('data/trainerCatalogue',['data/powerLibrary','data/duelProfile'],function(Arena){\n'use strict';\nvar p=${JSON.stringify(payload)};\nvar A=Arena.Data.abilities,L=Arena.Data.powerLibrary,ranks=Object.create(null);\nfunction choose(id,rank){var e=ranks[id];if(!e)return false;rank=Math.max(1,Math.min(5,Number(rank)||5));var next=JSON.parse(JSON.stringify(e.ranks[rank-1])),ab=A[id];Object.keys(ab).forEach(function(k){delete ab[k];});Object.keys(next).forEach(function(k){ab[k]=next[k];});return true;}\np.list.forEach(function(e){ranks[e.id]=e;choose(e.id,5);});\nvar kits={devastador:['Kick','Ribs breaker','South cross','Deafening roar','Frenzy','Unstoppable Madness'],guardian:['Kick','Shield bash','Precise block','Caution','Charge','Deflecting barrier'],centinela:['Dual shot','Grounding arrow','Winter stroke','Shield piercing','Arcana strike','Repetition shot'],rastreador:['Dual shot','Ambush','Confuse','Camouflage','Tear apart','Stalker surroundings'],arcanista:['Meteor','Fire ball','Lightning','Pricking ivy','Energy borrow','Freeze'],vinculador:['Arcane missile','Pricking ivy','Heal self','Energy barrier','Ambitious sacrifice','Summon demon']};\nfunction find(cid,name){return L.list.find(function(a){return a.classId===cid&&a.trainerKey&&a.trainerKey.split('|')[1]===name;});}\nObject.keys(kits).forEach(function(cid){var found=kits[cid].map(function(n){return find(cid,n);}).filter(Boolean).map(function(a){return a.id;});if(found.length<6){L.list.filter(function(a){return a.classId===cid&&!a.flags.passive&&a.effects.concat(a.selfEffects).some(function(e){return e.type!=='status';});}).forEach(function(a){if(found.length<6&&found.indexOf(a.id)<0)found.push(a.id);});}Arena.Data.classes[cid].abilities=found;Arena.Data.classes[cid].passiveId=null;Arena.Data.classes[cid].resourceType='mana';L.featured[cid]=found.slice();Arena.Data.duelProfile.kits[cid]=found.slice();});\nArena.Data.trainerCatalogue={version:p.version,points:p.points,required:p.required,classDisciplines:p.classDisciplines,excluded:p.excluded,ranks:ranks,setRank:choose,find:find};\nArena.Data.duelProfile.version='0.39.0';\n});\n`;
fs.writeFileSync(path.join(root,'js/data/trainerCatalogue.js'),js);
fs.writeFileSync(path.join(root,'qa/trainer-catalogue.json'),JSON.stringify(report,null,2));
console.log({sourceVersion:raw.version,sourcePowers:report.entries.length,classAssignments:list.length,rankVariants:list.length*5,excluded:excluded.length});
