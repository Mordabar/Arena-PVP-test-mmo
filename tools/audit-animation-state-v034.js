#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),G=require('./lib/glb.js'),R=path.join(__dirname,'..');let bad=0;
function g(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)bad++;}
function names(rel){return (G.load(path.join(R,rel)).json.animations||[]).map(a=>a.name);}
const a1=names('assets/animations/ual1-standard.glb'),a2=names('assets/animations/ual2-standard.glb'),rm=names('assets/animations/ual2-standard-rm.glb');
const r1=names('assets/animations/ual1-arena-runtime.glb'),r2=names('assets/animations/ual2-melee-runtime.glb'),rr=names('assets/animations/ual2-rm-runtime.glb');
const all=new Set([...a1,...a2]);
const plan=fs.readFileSync(path.join(R,'js/data/animationSourcePlan.js'),'utf8');
const sm=fs.readFileSync(path.join(R,'js/render/animationStateMachine.js'),'utf8');
const direct=fs.readFileSync(path.join(R,'js/render/three/threeDirectAnim.js'),'utf8');
const ch=fs.readFileSync(path.join(R,'js/render/three/threeCharacter.js'),'utf8');
const ns=fs.readFileSync(path.join(R,'js/namespace.js'),'utf8');
console.log('ANIMATION STATE AUDIT v0.34');
g(a1.length===43,'UAL1 Standard inventory','43'); g(a2.length===43,'UAL2 Standard inventory','43'); g(rm.length===43,'UAL2 RM inventory','43');
const sk=G.load(path.join(R,'assets/animations/ual1-standard.glb')).json.skins?.[0]; g(!!sk&&sk.joints&&sk.joints.length===65,'native humanoid skeleton','65 joints');
['Hit_Chest','Hit_Head','Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land','Sword_Idle','Spell_Simple_Enter','Spell_Simple_Exit','Spell_Simple_Idle_Loop','Spell_Simple_Shoot'].forEach(n=>g(all.has(n),'UAL1 source: '+n));
['Idle_Shield_Loop','Shield_OneShot','Sword_Regular_A','Sword_Regular_A_Rec','Sword_Regular_B','Sword_Regular_B_Rec','Sword_Regular_C','Slide_Start','Slide_Loop','Slide_Exit','Shield_Dash'].forEach(n=>g(all.has(n),'UAL2 source: '+n));
g(!all.has('Sword_Regular_C_Rec'),'C recovery is not invented');
g(rm.includes('Shield_Dash'),'RM source contains Shield_Dash');
g(rr.length===1&&rr[0]==='Shield_Dash_RM','RM runtime isolated','Shield_Dash_RM');
g(/0\.34\.0/.test(ns)&&/warrior-ual-literal-speed-facing-v034/.test(ns),'build sealed v0.34');
g(/2026-08-20-warrior-literal-speed-facing-v034/.test(plan),'v0.34 contract sealed');
g(/meleeNormalA:\s*slot\('Sword_Regular_A'/.test(plan)&&/meleeNormalARec:\s*slot\('Sword_Regular_A_Rec'/.test(plan),'normal A + REC literal');
g(/meleeNormalB:\s*slot\('Sword_Regular_B'/.test(plan)&&/meleeNormalBRec:\s*slot\('Sword_Regular_B_Rec'/.test(plan),'normal B + REC literal');
g(/meleeWeaponPower:slot\('Sword_Regular_C'/.test(plan),'weapon powers use Sword_Regular_C');
g(/shieldBash:\s*slot\('Shield_Dash_RM'/.test(plan)&&/shieldGuard:\s*slot\('Shield_OneShot'/.test(plan),'guardian shield mapping literal');
g(/normalIdle:\s*slot\('Idle_Loop'/.test(plan)&&/walkForward:\s*slot\('Walk_Loop'/.test(plan)&&/runForward:\s*slot\('Jog_Fwd_Loop'/.test(plan)&&/sprintForward:\s*slot\('Sprint_Loop'/.test(plan),'idle/walk/jog/sprint literal');
g(/active:\s*\['Jump_Start','Jump_Loop','Jump_Land'\]/.test(plan),'jump triplet literal');
g(/hitChest:\s*slot\('Hit_Chest'/.test(plan)&&/hitHead:\s*slot\('Hit_Head'/.test(plan),'damage reaction mapping literal');
g(/knockdownStart:\s*slot\('Slide_Start'/.test(plan)&&/knockdownLoop:\s*slot\('Slide_Loop'/.test(plan)&&/knockdownExit:\s*slot\('Slide_Exit'/.test(plan),'knockdown slide triplet');
g(/combatIdleOneHand:\s*slot\('Idle_Shield_Loop'/.test(plan)&&/combatIdleTwoHand:\s*slot\('Sword_Idle'/.test(plan),'normal/combat warrior stances distinct');
g(/syncAuthoritative:false[\s\S]{0,160}meleeRecoveryRate/.test(sm),'REC no longer compressed into sim tail');
g(/Spell_Simple_Enter/.test(ch)&&/Spell_Simple_Exit/.test(ch)&&/Spell_Simple_Idle_Loop/.test(sm)&&/casterNormalAttack:slot\('Spell_Simple_Shoot'/.test(plan)&&/casterPowerRelease:slot\('Spell_Simple_Shoot'/.test(plan),'all Spell family assigned');
g(/sanitizeAnimationClip/.test(direct)&&/applyYOrientationOffset/.test(direct)&&/mixamorig/.test(direct),'clip sanitation + optional facing correction installed');
g(/WORLD-FORWARD BOW BASIS/.test(ch)&&/_archerAimForwardDot/.test(ch),'archer world-forward IK correction installed');
g(!/flipYOrientation:true/.test(sm),'current archer does not blindly flip pelvis');
g(!fs.existsSync(path.join(R,'assets/models')),'legacy character model payload absent');
console.log(bad?'ANIMATION_STATE_V034: RECHAZADO':'ANIMATION_STATE_V034: APROBADO');process.exit(bad?1:0);
