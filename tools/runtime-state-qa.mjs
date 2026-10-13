#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from'node:url';
import{abrir,servir,sleep}from'./lib/cdp.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await servir(root);const{session,cerrar}=await abrir({width:1000,height:740});
const errors=session.pageErrors;
const page={evaluate:async(fn,arg)=>session.evaluate('('+fn.toString()+')('+JSON.stringify(arg)+')'),screenshot:async({path:filename})=>fs.writeFileSync(filename,await session.screenshotBuffer())};
const b={close:async()=>{await cerrar();server.cerrar();}};
await session.send('Page.navigate',{url:`http://127.0.0.1:${server.port}/index.html`});
let boot=false;for(let i=0;i<60;i++){boot=await session.evaluate('!!(window.Arena&&Arena.Game&&Arena.Game.renderer)');if(boot)break;await sleep(1000);}if(!boot){await b.close();throw Error('Game did not boot');}
console.log(await page.evaluate(()=>({version:Arena.VERSION,source:Arena.Render.animationSourceReport})));
await page.evaluate(()=>{Arena.Game._running=false;window.__qa={};});
fs.mkdirSync(path.join(root,'qa/states'),{recursive:true});
for(const cls of ['devastador','guardian','centinela','rastreador','arcanista','vinculador']){
 await page.evaluate(cls=>{
 const G=Arena.Game;G.startMatch('1v1',cls);G.renderer.syncVisuals(1/60);const p=G.world.getPlayer(),ch=G.renderer.visuals[p.id],T=ARENA_THREE;
 const scene=new T.Scene();scene.background=new T.Color('#202932');scene.add(new T.HemisphereLight(0xffffff,0x64676b,2.5));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(3,5,4);scene.add(sun);
 const ground=new T.Mesh(new T.PlaneGeometry(15,15),new T.MeshStandardMaterial({color:0x56605f,roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);scene.add(ch.root);
 const cam=new T.PerspectiveCamera(40,1000/740,.1,30);cam.position.set(3.0,2.0,4.1);cam.lookAt(0,.95,0);
 window.__qa={G,p,ch,scene,cam,T};document.body.appendChild(G.renderer.canvas);G.renderer.canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;display:block';document.querySelectorAll('body>*:not(canvas):not(script)').forEach(x=>x.style.display='none');
 },cls);
 for(const state of ['idle','combat','back','left','right','diagonal','turn','attack','recovery','power','cast','hit','stun','knockdown','getup','death','movingShot']){
  const info=await page.evaluate(state=>{
   const {G,p,ch,scene,cam}=__qa;const H=ch.handle;
   H.casting=false;H.deadTime=0;H.hurt=0;H.ccBlend=0;H.ccExiting=false;H.ccElapsed=.5;H.action.family=null;H.action.cancelled=false;
   H.loco.isMoving=false;H.loco.stride=.50;H.loco.duty=.6;H.loco.legs.forEach(l=>l.hasLock=false);H.loco.moveSpeed=0;H.loco.metersPerSecond=0;H.loco.airborne=false;H.loco.landingAmount=0;H.loco.turnRate=0;H.loco.moveForward=1;H.loco.moveRight=0;
   H.intent.combatMode=state!=='idle';H.intent.crowdControl=null;H.intent.visualAction=null;H.intent.castProgress=.6;ch._lastTargetMode=H.intent.combatMode;ch._modeTransition=null;ch._nativeRecovery=null;
   p.pos.x=p.pos.z=0;p.pos.y=0;p.yaw=0;
   const arche=Arena.Data.archetypeOf(p.classId);
   if(['back','left','right','diagonal','movingShot'].includes(state)){
    H.loco.isMoving=true;H.loco.moveSpeed=.65;H.loco.metersPerSecond=2.8;H.loco.moveForward=state==='back'?-1:state==='diagonal'?.707:0;H.loco.moveRight=state==='left'?-1:state==='back'?0:state==='diagonal'?.707:1;
   }
   if(state==='turn')H.loco.turnRate=.5;
   if(['attack','power','recovery','movingShot'].includes(state)){
    Arena.Render.CharacterBackend.current.triggerAttack(H,arche,state==='power',null,state==='power'?'heavy':null,0,null,0);H.action.t=state==='recovery'?.85:.45;H.action.weight=1;
   }
   if(state==='cast'){H.casting=true;H.intent.visualAction=arche==='archer'?'archerPower':'heavy';H.intent.castFamily='projectile';}
   if(state==='hit'){H.hurt=1;H.hurtSequence++;}
   if(state==='stun')H.intent.crowdControl='STUN';
   if(state==='knockdown')H.intent.crowdControl='KNOCKDOWN';
   if(state==='getup'){H.ccExiting=true;H.ccExitElapsed=.24;}
   if(state==='death')H.deadTime=1;
   let sel;
   for(let f=0;f<12;f++){
    if(H.loco.moveSpeed){p.pos.z+=H.loco.moveForward*2.8/60;p.pos.x-=H.loco.moveRight*2.8/60;H.loco.cycle=(H.loco.cycle+.025)%1;Arena.Render.Locomotion._updateLegs(H.loco,p,1/60);}
    ch.lastDt=1/60;ch.applySkinnedPose(p,p.pos,0);sel=Arena.Render.AnimationStateMachine.select(H,arche);
   }
   cam.position.set(p.pos.x+3,p.pos.y+2,p.pos.z+4.1);cam.lookAt(p.pos.x,p.pos.y+.95,p.pos.z);G.renderer.three.render(scene,cam);
   const bones={};for(const n of ['LeftFoot','RightFoot','LeftHand','RightHand']){const v=new ARENA_THREE.Vector3();ch.rigBones[n].getWorldPosition(v);bones[n]=v.toArray();}
   const finite=ch.directBindAll.every(b=>b.bone.position.toArray().concat(b.bone.quaternion.toArray()).every(Number.isFinite));
   return {state,selection:sel,actual:ch.player.resolvedClip,finite,bones,aim:ch._archerAimForwardDot};
  },state);
  await page.screenshot({path:path.join(root,`qa/states/${cls}-${state}.png`)});
  fs.writeFileSync(path.join(root,`qa/states/${cls}-${state}.json`),JSON.stringify(info,null,2));
  if(!info.finite)throw Error('Invalid bone '+cls+' '+state);
 }
 console.log('Checked',cls);
}
fs.writeFileSync(path.join(root,'qa/runtime-errors.json'),JSON.stringify(errors,null,2));console.log('Errors',errors);await b.close();if(errors.length)process.exitCode=1;
