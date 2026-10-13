import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
import * as THREE from '../../vendor/three-0.160.0/three.module.js';
import {GLTFLoader} from '../../vendor/three-0.160.0/examples/jsm/loaders/GLTFLoader.js';
import {createDirectLibrary} from '../../js/render/three/threeDirectAnim.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const Arena={Data:{},Render:{},Math:{},Anim:{},define(n,d,f){f(this);}};const sandbox={Arena,console,Math,Object,Number,Array,String};vm.createContext(sandbox);
for(const f of ['js/math/vec3.js','js/data/balance.js','js/data/animConfig.js','js/data/animationProfiles.js','js/data/animationSourcePlan.js','js/render/anim/skeleton.js','js/render/anim/actions.js','js/render/animationStateMachine.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),sandbox,{filename:f});
const loader=new GLTFLoader();async function glb(f){const b=fs.readFileSync(path.join(root,f));return await new Promise((ok,bad)=>loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',ok,bad));}
const source=await glb('assets/animations/ual1-arena-runtime.glb'),second=await glb('assets/animations/ual2-melee-runtime.glb'),rm=await glb('assets/animations/ual2-rm-runtime.glb');
const clips=[...source.animations,...second.animations,...rm.animations];const target=source.scene;const lib=createDirectLibrary(Arena,{animations:clips},target);let checks=0;function check(condition,msg){assert.ok(condition,msg);checks++;}
const SM=Arena.Render.AnimationStateMachine,Act=Arena.Render.Actions;
function handle(cls){return {cfg:Arena.Data.animConfigFor(cls,Arena.Data.archetypeOf(cls)),intent:{classId:cls,combatMode:true},action:Act.createState(1),loco:{moveSpeed:0,moveForward:1,moveRight:0,metersPerSecond:0},deadTime:0,hurt:0,hurtSequence:0};}
for(const cls of Object.keys(Arena.Data.AnimationSourcePlan.classPolicy)){
 const h=handle(cls),ar=Arena.Data.archetypeOf(cls);
 check(!!lib.resolveSelection(SM.select(h,ar)),cls+' idle exists');
 h.deadTime=1;h.intent.crowdControl='STUN';check(SM.select(h,ar).state==='DEATH','death wins');h.deadTime=0;
 check(SM.select(h,ar).state==='STUN','stun suppresses action');h.intent.crowdControl='STASIS';check(SM.select(h,ar).freezeCurrent,'stasis freezes pose');h.intent.crowdControl='KNOCKDOWN';h.ccElapsed=.1;
 check(SM.select(h,ar).state==='KNOCKDOWN_START','fall has dedicated start');h.ccElapsed=.6;check(SM.select(h,ar).state==='KNOCKDOWN_LOOP','downed hold');h.intent.crowdControl=null;h.ccExiting=true;h.ccExitElapsed=.2;check(SM.select(h,ar).state==='KNOCKDOWN_EXIT','getup phase');h.ccExiting=false;
 h.casting=true;h.intent.castProgress=.4;h.intent.visualAction=ar==='archer'?'archerPower':'heavy';let sel=SM.select(h,ar);check(sel.state==='CAST_CHARGE','cast has state');check(!!lib.resolveSelection(sel),'cast clip exists');h.casting=false;
 Act.trigger(h.action,Act.familyFor(ar,false,null),h.cfg,false,null,null,0,null);h.action.t=.3;const a=SM.select(h,ar);Act.trigger(h.action,Act.familyFor(ar,false,null),h.cfg,false,null,null,0,null);check(a.eventToken!==SM.select(h,ar).eventToken,'new attack gets new token');
 h.loco.moveSpeed=.8;h.loco.metersPerSecond=3;const moving=SM.select(h,ar);check(!!moving.liveLowerLocomotion,'moving action has independent legs');
 Act.cancelVisual(h.action);check(SM.select(h,ar).state!=='ACTION','cancel does not complete strike');
 h.action.family=null;h.hurt=1;h.hurtSequence=2;check(SM.select(h,ar).eventToken==='hit:2','hit retrigger token');h.hurt=0;
 h.loco.airborne=true;h.loco.jumpPhase=.9;check(SM.select(h,ar).state==='AIRBORNE','no landing before ground');h.loco.airborne=false;h.loco.landingAmount=.5;check(SM.select(h,ar).state==='LAND','landing on ground');
}
const pl=lib.createPlayer(target);const base={clip:'Idle_Loop',mask:'full',state:'IDLE',loop:true,rate:.8};pl.play(base,.01);pl.update(.1);check(pl.accion.getEffectiveTimeScale()===.8,'idle rate set');pl.play({...base,clip:'Walk_Loop'},.01);check(pl.accion.getEffectiveTimeScale()===.8,'new action inherits selected rate correctly');
{
 const h=handle('guardian');h.block=1;h.blockSequence=1;
 let s=SM.select(h,'melee');check(s.state==='BLOCK'&&!!lib.resolveSelection(s),'real block clip selected');
 h.blockSequence=2;check(SM.select(h,'melee').eventToken!==s.eventToken,'repeated block retriggers');
 h.casting=true;h.intent.visualAction='shield';check(SM.select(h,'melee').state==='CAST_CHARGE','block does not cancel cast');
 h.intent.crowdControl='KNOCKDOWN';h.ccElapsed=.7;check(SM.select(h,'melee').state==='KNOCKDOWN_LOOP','knockdown beats block and cast');
 h.deadTime=1;check(SM.select(h,'melee').state==='DEATH','death beats block and cast');
}
pl.play({clip:'Hit_Head',state:'HIT',mask:'full',loop:false,rate:1,eventToken:'hit1'},0);pl.update(.1);check(pl.accion.time>0,'hit advances');pl.play({clip:'Hit_Head',state:'HIT',mask:'full',loop:false,rate:1,eventToken:'hit2'},0);check(pl.accion.time===0,'repeated hit restarts identical clip');
pl.play({clip:'Spell_Simple_Shoot',state:'ACTION',mask:'upper',syncAuthoritative:true,syncProgress:.4,eventToken:'cast1',liveLowerLocomotion:'Jog_Fwd_Loop',lowerRate:1},0);pl.update(.05);const main=pl.accion.time,lower=pl.lowerAction.time;pl.update(.05);check(Math.abs(pl.accion.time-main)<1e-6,'hold follows authority exactly');check(pl.lowerAction.time>lower,'legs advance while cast is held');
pl.play({freezeCurrent:true,state:'STASIS'},0);const frozen=pl.accion.time;pl.update(.1);check(pl.accion.time===frozen,'stasis keeps current pose');pl.play(base,0);pl.update(.1);check(!pl.frozen,'stasis release unfreezes');check(!pl.lowerAction,'leg layer removed when leaving moving shot');
const rawChecks=[];for(const c of Object.values(lib.raw)){
 const player=lib.createPlayer(target);player.play({clip:c.name,mask:'full',loop:true,state:'QA'},0);for(const f of [.1,.5,.9]){player.accion.time=c.duration*f;player.update(0);target.updateMatrixWorld(true);let finite=true;target.traverse(n=>{if(n.isBone&&!n.matrixWorld.elements.every(Number.isFinite))finite=false;});check(finite,c.name+' finite pose');}rawChecks.push(c.name);player.dispose();
}
const report={passed:true,checks,clipsSampled:rawChecks.length,scope:'State selection, native skeleton/mixer playback, priorities, timing, independent leg layer. Visual quality evaluated separately.'};fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/animation-regression.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
