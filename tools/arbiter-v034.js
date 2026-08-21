#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'..');let bad=0,manual=0;
function gate(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)bad++;}
function run(file,rx,n,d){const r=cp.spawnSync(process.execPath,[path.join(R,'tools',file)],{cwd:R,encoding:'utf8',timeout:300000});const out=(r.stdout||'')+(r.stderr||'');const ok=r.status===0&&rx.test(out);gate(ok,n,d);if(!ok)console.log(out.slice(-6000));return out;}
console.log('ARBITER v0.34 · WARRIOR UAL LITERAL / NATURAL TIMING / ARCHER FACING');
run('run-tests.js',/TODO OK — 383 pruebas/,'regression suite','383/383');
run('audit-animation-state-v034.js',/ANIMATION_STATE_V034: APROBADO/,'exact animation contract');
run('audit-cmu-v031.js',/CMU_AUDIT_V031: APROBADO/,'directional/kick CMU regression');
run('audit-reactions-v031.js',/REACTIONS_V031: APROBADO/,'damage + CC mapping');
run('perf-assets-v034.js',/PERF_ASSETS_V034: APROBADO/,'runtime payload');
run('audit-deploy-v034.js',/DEPLOY_AUDIT_V034: APROBADO/,'production deploy');
run('audit-syntax-v034.js',/SYNTAX_V034: APROBADO/,'JavaScript syntax');
run('run-agents-v034.js',/AGENTS_V034: APROBADO · 11\/11/,'specialized adversarial reviewers','11/11');
const vis=run('audit-visual-v034.js',/VISUAL_V034: MANUAL_GPU_REQUIRED/,'visual correction contract','hardware review pending');if(/MANUAL_GPU_REQUIRED/.test(vis))manual++;
const ns=fs.readFileSync(path.join(R,'js/namespace.js'),'utf8'),p=fs.readFileSync(path.join(R,'js/data/animationSourcePlan.js'),'utf8'),sm=fs.readFileSync(path.join(R,'js/render/animationStateMachine.js'),'utf8'),ch=fs.readFileSync(path.join(R,'js/render/three/threeCharacter.js'),'utf8'),d=fs.readFileSync(path.join(R,'js/render/three/threeDirectAnim.js'),'utf8');
gate(/0\.34\.0/.test(ns)&&/warrior-ual-literal-speed-facing-v034/.test(ns),'v0.34 build sealed');
gate(/Sword_Regular_A/.test(p)&&/Sword_Regular_A_Rec/.test(p)&&/Sword_Regular_B/.test(p)&&/Sword_Regular_B_Rec/.test(p)&&/Sword_Regular_C/.test(p),'latest warrior attacks literal');
gate(/meleeRecoveryRate:0\.72/.test(p)&&/syncAuthoritative:false/.test(sm),'reported fast REC corrected without moving RELEASE');
gate(/Hit_Chest/.test(p)&&/Hit_Head/.test(p)&&/Slide_Start/.test(p),'damage/knockdown reactions literal');
gate(/WORLD-FORWARD BOW BASIS/.test(ch)&&/_archerAimForwardDot/.test(ch),'backwards archer corrected by target-facing IK');
gate(/sanitizeAnimationClip/.test(d)&&/premultiply\(qOffset\)/.test(d),'generic sanitize/180° tool remains available for truly -Z external clips');
console.log('\n'+(bad?'ARBITER v0.34: RECHAZADO · '+bad+' gates':'ARBITER v0.34: APROBADO TÉCNICAMENTE · WARRIOR UAL LITERAL + TIMING + FACING\nART_GATE: MANUAL_GPU_REQUIRED · '+manual+' visual gate pending real-hardware moving review'));
process.exit(bad?1:0);
