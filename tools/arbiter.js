#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const R=path.join(__dirname,'..');let bad=0;
function gate(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)bad++;}
function run(file,args=[]){return cp.spawnSync(process.execPath,[path.join(R,'tools',file),...args],{cwd:R,encoding:'utf8',timeout:240000});}
function runGate(file,rx,name,detail){const r=run(file),out=(r.stdout||'')+(r.stderr||'');gate(r.status===0&&rx.test(out),name,detail);if(r.status!==0||!rx.test(out)) console.log(out.slice(-3000));}
console.log('ARBITER v0.31 · ADVERSARIAL WARRIOR UAL LITERAL CONTRACT');
runGate('run-tests.js',/TODO OK — 368 pruebas/,'regression suite','368/368');
runGate('audit-animation-state-v031.js',/ANIMATION_STATE_V031: APROBADO/,'literal UAL/source-state contract');
runGate('audit-cmu-v031.js',/CMU_AUDIT_V031: APROBADO/,'CMU retained only for directional locomotion + kick');
runGate('audit-reactions-v031.js',/REACTIONS_V031: APROBADO/,'damage reaction + hard-CC arbitration');
runGate('perf-assets-v031.js',/PERF_ASSETS_V031: APROBADO/,'runtime animation payload budget');
runGate('audit-deploy-v031.js',/DEPLOY_AUDIT_V031: APROBADO/,'production deploy audit');
runGate('audit-syntax-v031.js',/SYNTAX_V031: APROBADO · 119\/119/,'JavaScript syntax','119/119');
runGate('run-agents.js',/AGENTS: APROBADO · 10\/10/,'specialized adversarial reviewers','10/10');
runGate('audit-visual-v031.js',/VISUAL_V031: APROBADO/,'targeted Chromium visual evidence','Guardian + Devastador');

const ns=fs.readFileSync(path.join(R,'js/namespace.js'),'utf8');
const plan=fs.readFileSync(path.join(R,'js/data/animationSourcePlan.js'),'utf8');
const sm=fs.readFileSync(path.join(R,'js/render/animationStateMachine.js'),'utf8');
const boot=fs.readFileSync(path.join(R,'js/render/three/bootstrap.js'),'utf8');
const direct=fs.readFileSync(path.join(R,'js/render/three/threeDirectAnim.js'),'utf8');

gate(/0\.31\.0/.test(ns)&&/warrior-ual-literal-v031/.test(ns),'build sealed v0.31');
gate(/LATEST_USER_MAPPING_WINS_NO_SILENT_SUBSTITUTION/.test(plan),'latest user mapping is authority');
gate(/meleeNormalA:\s*slot\('Sword_Regular_A'/.test(plan)&&/meleeNormalARec:\s*slot\('Sword_Regular_A_Rec'/.test(plan)&&/meleeNormalB:\s*slot\('Sword_Regular_B'/.test(plan)&&/meleeNormalBRec:\s*slot\('Sword_Regular_B_Rec'/.test(plan),'melee normal A/B + REC literal');
gate(/meleeWeaponPower:\s*slot\('Sword_Regular_C'/.test(plan),'weapon-damage powers use Sword_Regular_C');
gate(/combatIdleOneHand:\s*slot\('Idle_Shield_Loop'/.test(plan)&&/combatIdleTwoHand:\s*slot\('Sword_Idle'/.test(plan),'Guardian/Devastador combat idles literal');
gate(/shieldBash:\s*slot\('Shield_Dash_RM'/.test(plan)&&/shieldGuard:\s*slot\('Shield_OneShot'/.test(plan),'shield power + buff literal');
gate(/hitChest:\s*slot\('Hit_Chest'/.test(plan)&&/hitHead:\s*slot\('Hit_Head'/.test(plan),'damage hit routing literal');
gate(/knockdownStart:\s*slot\('Slide_Start'/.test(plan)&&/knockdownLoop:\s*slot\('Slide_Loop'/.test(plan)&&/knockdownExit:\s*slot\('Slide_Exit'/.test(plan),'knockdown slide triplet');
gate(/Jump_Start/.test(plan)&&/Jump_Loop/.test(plan)&&/Jump_Land/.test(plan)&&/Sprint_Loop/.test(plan),'jump + sprint mapping literal');
gate(/Spell_Simple_Enter/.test(plan)&&/Spell_Simple_Exit/.test(plan)&&/Spell_Simple_Idle_Loop/.test(plan)&&/Spell_Simple_Shoot/.test(plan),'Spell family connected');
gate(/Arena_Archer_Default_Ready/.test(plan)&&/Arena_Archer_Default_Charge/.test(plan)&&/Arena_Archer_Default_Shoot/.test(plan)&&/Arena_Archer_Default_Buff/.test(plan),'archer placeholders explicit');
gate(!/Arena_Bow_StandardProxy/.test(sm)&&!/Pistol_Shoot/.test(sm)&&!/Pistol_Reload/.test(sm),'rejected bow proxies cannot return through selector');
gate(!/Arena_CMU_Caster/.test(sm)&&!/NinjaJump/.test(sm),'superseded caster/jump motions cannot return through selector');
gate(!/Sword_Attack/.test(boot),'superseded Sword_Attack not required at boot');
gate(/_lockVisualRoot/.test(direct),'root-motion visual XZ lock present');

const vd=path.join(R,'docs','shots','v031-final');let visual=true;
for(const c of ['guardian','devastador']){
  try{const j=JSON.parse(fs.readFileSync(path.join(vd,'runtime-report-'+c+'.json'),'utf8'));visual=visual&&!j.errors.length&&!j.requestFailures.length&&j.boot.version==='0.31.0'&&j.boot.three&&j.boot.payload.ual1===15&&j.boot.payload.ual2===13&&j.boot.payload.ual2rm===1&&j.boot.payload.cmu===10;}catch(e){visual=false;}
}
gate(visual,'Chromium evidence sealed','39 combined runtime clips; 0 errors/failures');

let smoke=false;try{const j=JSON.parse(fs.readFileSync(path.join(vd,'deploy-smoke-report.json'),'utf8'));smoke=!j.errors.length&&!j.requestFailures.length&&j.boot.version==='0.31.0'&&j.boot.build==='warrior-ual-literal-v031'&&j.boot.three;}catch(e){}
gate(smoke,'packaged deploy smoke evidence','Three.js + v0.31');

const archerHonest=/STATUS\.PLACEHOLDER/.test(plan)&&/Arena_Archer_Default/.test(plan);
gate(archerHonest,'ART_GATE remains honest','archer remains placeholder pending reference video');

console.log('\n'+(bad?'ARBITER v0.31: RECHAZADO · '+bad+' gates':'ARBITER v0.31: APROBADO · WARRIOR UAL LITERAL BASELINE\nART_GATE: WARRIOR MAPPING APPROVED · ARCHER PLACEHOLDER'));
process.exit(bad?1:0);
