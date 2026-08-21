#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),G=require('./lib/glb.js'),R=path.join(__dirname,'..');let bad=0;
function g(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)bad++;}
function names(rel){return (G.load(path.join(R,rel)).json.animations||[]).map(a=>a.name);}
const a1=names('assets/animations/ual1-standard.glb'),a2=names('assets/animations/ual2-standard.glb'),rm=names('assets/animations/ual2-standard-rm.glb');
const r1=names('assets/animations/ual1-arena-runtime.glb'),r2=names('assets/animations/ual2-melee-runtime.glb'),rr=names('assets/animations/ual2-rm-runtime.glb');
const all=new Set([...a1,...a2]), plan=fs.readFileSync(path.join(R,'js/data/animationSourcePlan.js'),'utf8'),sm=fs.readFileSync(path.join(R,'js/render/animationStateMachine.js'),'utf8'),direct=fs.readFileSync(path.join(R,'js/render/three/threeDirectAnim.js'),'utf8');
console.log('ANIMATION STATE AUDIT v0.31');
g(a1.length===43,'UAL1 Standard inventory','43');g(a2.length===43,'UAL2 Standard inventory','43');g(rm.length===43,'UAL2 RM inventory','43');
const sk=G.load(path.join(R,'assets/animations/ual1-standard.glb')).json.skins?.[0];g(!!sk&&sk.joints&&sk.joints.length===65,'native humanoid skeleton','65 joints');
['Hit_Chest','Hit_Head','Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land','Sword_Idle','Spell_Simple_Enter','Spell_Simple_Exit','Spell_Simple_Idle_Loop','Spell_Simple_Shoot'].forEach(n=>g(all.has(n),'UAL1 source: '+n));
['Idle_Shield_Loop','Shield_OneShot','Sword_Regular_A','Sword_Regular_A_Rec','Sword_Regular_B','Sword_Regular_B_Rec','Sword_Regular_C','Slide_Start','Slide_Loop','Slide_Exit'].forEach(n=>g(all.has(n),'UAL2 source: '+n));
g(rm.includes('Shield_Dash'),'RM source contains Shield_Dash');
g(r1.length===15,'UAL1 runtime trimmed','15 clips');g(r2.length===13,'UAL2 runtime trimmed','13 clips');g(rr.length===1&&rr[0]==='Shield_Dash_RM','RM runtime renamed exact','Shield_Dash_RM');
g(!r1.includes('Sword_Attack'),'superseded Sword_Attack excluded from runtime');g(!r1.some(n=>/^Pistol_/.test(n)),'pistol family excluded from runtime');g(!r2.some(n=>/^NinjaJump_/.test(n)),'NinjaJump superseded by UAL1 jump');
g(/meleeNormalA:\s*slot\('Sword_Regular_A'/.test(plan)&&/meleeNormalB:\s*slot\('Sword_Regular_B'/.test(plan),'normal A/B literal contract');
g(/meleeWeaponPower:slot\('Sword_Regular_C'/.test(plan),'weapon power literal contract');
g(/shieldBash:\s*slot\('Shield_Dash_RM'/.test(plan)&&/shieldGuard:\s*slot\('Shield_OneShot'/.test(plan),'shield power/buff literal contract');
g(/recoveryPairs:[\s\S]*Sword_Regular_A:'Sword_Regular_A_Rec'[\s\S]*Sword_Regular_B:'Sword_Regular_B_Rec'/.test(plan),'A/B REC pairing explicit');
g(/Slide_Start/.test(sm)&&/Slide_Loop/.test(sm)&&/Slide_Exit/.test(sm),'knockdown slide triplet connected');
g(/Spell_Simple_Shoot/.test(plan)&&!/Arena_CMU_Caster_/.test(sm)&&!/Arena_CMU_Caster_/.test(plan),'Spell family active; old CMU caster retired');
g(!/Pistol_/.test(direct)&&!/Arena_Bow_StandardProxy/.test(direct),'archer old proxies cannot return through direct library');
g(!fs.existsSync(path.join(R,'assets/models')),'legacy character model payload absent');
console.log(bad?'ANIMATION_STATE_V031: RECHAZADO':'ANIMATION_STATE_V031: APROBADO');process.exit(bad?1:0);
