// Real native rig/mixer CPU sampling. This is not browser footage or visual acceptance.
import fs from 'node:fs';import assert from 'node:assert/strict';
import * as T from '../../vendor/three-0.160.0/three.module.js';
import {GLTFLoader} from '../../vendor/three-0.160.0/examples/jsm/loaders/GLTFLoader.js';
import {createCharacterFactory} from '../../js/render/three/threeCharacter.js';
import {loadArena,root} from './simHarness.mjs';
const A=loadArena(),ld=new GLTFLoader(),gl=[];
for(const f of ['ual1-arena-runtime.glb','ual2-melee-runtime.glb','ual2-rm-runtime.glb']){const b=fs.readFileSync(root+'/assets/animations/'+f);gl.push(await ld.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}
const projections=process.argv.includes('--projections');
const out=process.argv.slice(2).find(a=>!a.startsWith('--'))||root+'/qa/sequences-039';if(projections)fs.mkdirSync(out,{recursive:true});
const cases=[['devastador','left'],['devastador','right'],['devastador','back'],['devastador','kick'],['centinela','draw'],['centinela','release'],['arcanista','cast']];
const phases=[0,.2,.4,.6,.8,1],rows=[];let checks=0;
for(const [cid,state] of cases){
 const w=new A.Sim.World(),e=A.Data.makeEntity(cid,{id:cid,x:0,z:0});w.addEntity(e);
 const scene=new T.Scene(),factory=createCharacterFactory(A,scene,{baseCharacterGltf:gl[0],meleeBaseCharacterGltf:gl[0],animationLibraryGltf:{animations:gl.flatMap(g=>g.animations)}}),ch=factory.create(e);
 A.Render.CharacterVisual.update(ch.handle,e,1/60,w);const h=ch.handle,ar=A.Data.archetypeOf(cid);
 h.intent.combatMode=true;h.casting=false;h.action.family=null;ch._modeTransition=null;ch._lastTargetMode=true;
 const moving=['left','right','back'].includes(state);
 if(state==='kick'){h.action.family='kick';h.action.sequence=3;h.action.isPower=true;h.action.cancelled=false;h.action.weight=1;}
 if(state==='draw'||state==='cast'){h.casting=true;h.intent.visualAction=state==='draw'?'archerPower':'heavy';}
 if(state==='release'){h.action.family='ranged';h.action.sequence=3;h.action.isPower=true;h.action.cancelled=false;h.action.weight=1;}
 for(let frame=0;frame<=120;frame++){
  if(moving){e.pos.x+=(state==='left'?1:state==='right'?-1:0)*2/60;e.pos.z+=(state==='back'?-1:0)*2/60;A.Render.Locomotion.update(h.loco,e,1/60);}
  const p=frame/120;h.action.t=p;h.intent.castProgress=p;h.cast=h.casting?p:0;ch.fxTime+=1/60;
  const prior=JSON.stringify(e);ch.lastDt=1/60;ch.applyPose(e,e.pos,0,{accent:[.8,.6,.4]},1,0);assert.equal(JSON.stringify(e),prior,'render must not mutate simulation');checks++;
  scene.updateMatrixWorld(true);assert.ok(ch.directBindAll.every(b=>b.bone.matrixWorld.elements.every(Number.isFinite)),'finite native pose');checks++;
  if(moving&&frame>15){const lf=ch.rigBones.LeftFoot.getWorldPosition(new T.Vector3()),rf=ch.rigBones.RightFoot.getWorldPosition(new T.Vector3());assert.ok(lf.x-rf.x>.10,'lateral feet must not cross');checks++;}
  if(![0,24,48,72,96,120].includes(frame))continue;
  const fn=cid+'-'+state+'-'+frame+'.json';
  if(projections){
  const camera=new T.PerspectiveCamera(36,1,.1,30);camera.position.set(e.pos.x+2.8,2.1,e.pos.z+4.5);camera.lookAt(e.pos.x,.9,e.pos.z);camera.updateMatrixWorld();
  const triangles=[],v=new T.Vector3(),pts=[],normal=new T.Vector3(),light=new T.Vector3(-.4,.8,.6).normalize();
  scene.traverseVisible(o=>{if(!o.isMesh||!o.geometry.attributes.position)return;if(o.isSkinnedMesh)o.skeleton.update();pts.length=0;
   for(let k=0;k<o.geometry.attributes.position.count;k++){o.getVertexPosition(k,v);v.applyMatrix4(o.matrixWorld);pts.push(v.clone());}
   const ind=o.geometry.index?Array.from(o.geometry.index.array):pts.map((_,k)=>k);
   for(let k=0;k<ind.length;k+=3){const a=pts[ind[k]],b=pts[ind[k+1]],c=pts[ind[k+2]];normal.subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).normalize();let mat=o.material;if(Array.isArray(mat)){const g=o.geometry.groups.find(g=>k>=g.start&&k<g.start+g.count);mat=mat[g?.materialIndex||0];}
    const color=(mat?.color||new T.Color('#b6bcc5')).clone().multiplyScalar(.5+Math.abs(normal.dot(light))*.5).convertLinearToSRGB();
    triangles.push({p:[a,b,c].map(p=>{v.copy(p).project(camera);return [v.x,v.y,v.z];}),c:color.toArray().map(c=>Math.max(0,Math.min(255,Math.round(c*255))))});
   }
  });
  fs.writeFileSync(out+'/'+fn,JSON.stringify(triangles));
  }
  const left=ch.rigBones.LeftHand.getWorldPosition(new T.Vector3()),right=ch.rigBones.RightHand.getWorldPosition(new T.Vector3()),foot=ch.rigBones.RightFoot.getWorldPosition(new T.Vector3());
  let nockGap=null;if(state==='draw'&&p>.02){const pa=ch.weapons.bow.userData.string.geometry.attributes.position.array;const nock=new T.Vector3(pa[3],pa[4],pa[5]);ch.weapons.bow.localToWorld(nock);nockGap=nock.distanceTo(right);assert.ok(nockGap<1e-5,'bow string must meet draw hand');checks++;if(p>=.4){assert.ok(ch._archerAimForwardDot>.99,'drawn bow must align with authoritative forward');checks++;}}
  rows.push({class:cid,state,phase:p,file:projections?fn:null,selected:A.Render.AnimationStateMachine.select(h,ar),left:left.toArray(),right:right.toArray(),foot:foot.toArray(),nockGap,aimForwardDot:ch._archerAimForwardDot});
 }
 ch.dispose();
}
const report={passed:true,checks,method:'CPU projections of actual native rig with gait updates. Forced action phases; not gameplay recording.',rows};if(projections)fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));fs.writeFileSync(root+'/qa/animation-sequences-039.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks,snapshots:rows.length}));
