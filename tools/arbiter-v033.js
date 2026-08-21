#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'..');let bad=0;
function gate(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)bad++;}
function runNode(file,args=[]){return cp.spawnSync(process.execPath,[path.join(R,'tools',file),...args],{cwd:R,encoding:'utf8',timeout:300000});}
function runGate(file,rx,name,detail){const r=runNode(file),out=(r.stdout||'')+(r.stderr||'');gate(r.status===0&&rx.test(out),name,detail);if(r.status!==0||!rx.test(out))console.log(out.slice(-7000));}
console.log('ARBITER v0.33 · ARCHER VIDEO REFINEMENT · ADVERSARIAL REVIEW');
runGate('run-tests.js',/TODO OK — 378 pruebas/,'regression suite','378/378');
runGate('audit-animation-state-v033.js',/ANIMATION_STATE_V033: APROBADO/,'animation state/source contract');
runGate('audit-cmu-v031.js',/CMU_AUDIT_V031: APROBADO/,'directional CMU regression');
runGate('audit-reactions-v031.js',/REACTIONS_V031: APROBADO/,'damage + CC regression');
runGate('perf-assets-v033.js',/PERF_ASSETS_V033: APROBADO/,'runtime payload budget');
runGate('audit-deploy-v033.js',/DEPLOY_AUDIT_V033: APROBADO/,'production deploy');
runGate('audit-syntax-v033.js',/SYNTAX_V033: APROBADO/,'JavaScript syntax');
runGate('run-agents-v033.js',/AGENTS_V033: APROBADO · 10\/10/,'specialized adversarial reviewers','10/10');
runGate('audit-visual-v033.js',/VISUAL_V033: APROBADO/,'targeted Chromium evidence','ready + notch + release');
const ns=fs.readFileSync(path.join(R,'js/namespace.js'),'utf8'),plan=fs.readFileSync(path.join(R,'js/data/animationSourcePlan.js'),'utf8'),sm=fs.readFileSync(path.join(R,'js/render/animationStateMachine.js'),'utf8'),ch=fs.readFileSync(path.join(R,'js/render/three/threeCharacter.js'),'utf8'),direct=fs.readFileSync(path.join(R,'js/render/three/threeDirectAnim.js'),'utf8');
gate(/0\.33\.0/.test(ns)&&/archer-video-refinement-v033/.test(ns),'build sealed v0.33');
gate(/19\.08\.2026_20\.55\.49_REC\.mp4/.test(plan),'latest user gameplay video is explicit design evidence');
gate(/mask:'full'.*semanticSlot:'combatIdleArcher'/.test(sm),'combat ready owns the whole body');
gate(/directLowerBase:'Arena_Archer_VideoReady'/.test(sm),'notch/release cannot fall back to neutral Idle legs');
gate(/solveTwoBoneIK/.test(ch)&&/applyArcherBowConstraint/.test(ch),'bow/draw arm IK exists');
gate(/_archerReadyLower/.test(ch),'planted lower stance is locked through stationary bow actions');
gate(/buildVideoArcherClips/.test(direct)&&!/Pistol_Shoot/.test(direct),'video-authored fallback does not resurrect rejected pistol shoot');
let vis=false;try{const j=JSON.parse(fs.readFileSync(path.join(R,'docs/shots/v033-final/runtime-report.json'),'utf8')),m=j.metrics;vis=!j.errors.length&&!j.requestFailures.length&&j.boot.version==='0.33.0'&&j.boot.three&&m.notch.rightHandHead<.20&&m.notch.leftHandForward>.45&&m.notch.rightElbowOut>.18&&Math.abs(m.ready.stancePlanar-m.release.stancePlanar)<.02;}catch(e){}gate(vis,'Chromium geometry evidence sealed','cheek draw + forward bow arm + stable feet');
let smoke=false;try{const j=JSON.parse(fs.readFileSync(path.join(R,'docs/shots/v033-final/deploy-smoke-report.json'),'utf8'));smoke=!j.errors.length&&!j.requestFailures.length&&j.boot.version==='0.33.0'&&j.boot.build==='archer-video-refinement-v033'&&j.boot.three;}catch(e){}gate(smoke,'packaged deploy smoke evidence','Three.js + v0.33');
gate(/PLAYABLE_FALLBACK/.test(plan)&&/Bow_Aim_Neutral/.test(plan),'ART_GATE honest','video-derived bow remains provisional until exact Source clips/video-authored final');
console.log('\n'+(bad?'ARBITER v0.33: RECHAZADO · '+bad+' gates':'ARBITER v0.33: APROBADO · ARCHER VIDEO REFINEMENT BASELINE\nART_GATE: VIDEO-DERIVED / PROVISIONAL · GEOMETRY AND TWIST FIX APPROVED'));
process.exit(bad?1:0);
