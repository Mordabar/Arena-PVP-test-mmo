// Pose inspection uses the actual character factory/mixer, without a browser or GPU.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three-0.160.0/three.module.js';
import {GLTFLoader} from '../../vendor/three-0.160.0/examples/jsm/loaders/GLTFLoader.js';
import {loadArena,root} from './simHarness.mjs';
const sourceRoot=process.argv[3]||root;
const {createCharacterFactory}=await import(pathToFileURL(sourceRoot+'/js/render/three/threeCharacter.js'));
const A=loadArena({root:sourceRoot}),ld=new GLTFLoader(),gl=[];
for(const f of ['ual1-arena-runtime.glb','ual2-melee-runtime.glb','ual2-rm-runtime.glb']){
  const b=fs.readFileSync(root+'/assets/animations/'+f);
  gl.push(await ld.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
}
const out=process.argv[2];if(!out)throw Error('Pass absolute output directory');fs.mkdirSync(out,{recursive:true});
const states=['idle','attack','cast','hitWhileCasting','back','knockdown','death'];
const rows=[];
for(const cid of Object.keys(A.Data.classes)){
  const w=new A.Sim.World(),e=A.Data.makeEntity(cid,{id:cid,x:0,z:0});w.addEntity(e);
  const scene=new T.Scene(),factory=createCharacterFactory(A,scene,{baseCharacterGltf:gl[0],meleeBaseCharacterGltf:gl[0],animationLibraryGltf:{animations:gl.flatMap(g=>g.animations)}}),ch=factory.create(e);
  A.Render.CharacterVisual.update(ch.handle,e,1/60,w);
  const camera=new T.PerspectiveCamera(36,1,.1,30);camera.position.set(3,2.1,4.6);camera.lookAt(0,.9,0);camera.updateMatrixWorld();
  const ar=A.Data.archetypeOf(cid),h=ch.handle;
  for(const state of states){
    h.casting=false;h.deadTime=0;h.hurt=0;h.action.family=null;h.action.cancelled=false;h.ccExiting=false;h.intent.crowdControl=null;h.intent.combatMode=true;h.intent.castProgress=.7;
    h.loco.moveSpeed=0;h.loco.metersPerSecond=0;h.loco.airborne=false;h.loco.landingAmount=0;h.loco.moveForward=1;h.loco.moveRight=0;
    ch._modeTransition=null;ch._lastTargetMode=true;ch._nativeRecovery=null;
    if(state==='idle')h.intent.combatMode=false;
    if(state==='attack'){A.Render.CharacterBackend.current.triggerAttack(h,ar,false,null,null,0,null,0);h.action.t=.43;h.action.weight=1;}
    if(state==='cast'||state==='hitWhileCasting'){h.casting=true;h.intent.visualAction=ar==='archer'?'archer':'heavy';h.cast=.7;}
    if(state==='hitWhileCasting')h.hurt=.55;
    if(state==='back'){h.loco.moveSpeed=.65;h.loco.metersPerSecond=2;h.loco.moveForward=-1;}
    if(state==='knockdown'){h.intent.crowdControl='KNOCKDOWN';h.ccElapsed=.65;}
    if(state==='death')h.deadTime=1;
    for(let k=0;k<10;k++){ch.lastDt=1/60;ch.applyPose(e,e.pos,0,{accent:[.8,.6,.4]},1,0);}
    const sel=A.Render.AnimationStateMachine.select(h,ar);
    scene.updateMatrixWorld(true);
    const triangles=[],v=new T.Vector3(),pts=[],normal=new T.Vector3(),light=new T.Vector3(-.4,.8,.6).normalize();
    scene.traverseVisible(o=>{
      if(!o.isMesh||!o.geometry.attributes.position)return;
      if(o.isSkinnedMesh)o.skeleton.update();
      pts.length=0;
      for(let k=0;k<o.geometry.attributes.position.count;k++){
        o.getVertexPosition(k,v);v.applyMatrix4(o.matrixWorld);pts.push(v.clone());
      }
      const index=o.geometry.index,ind=index?Array.from(index.array):pts.map((_,k)=>k);
      for(let k=0;k<ind.length;k+=3){
        const p0=pts[ind[k]],p1=pts[ind[k+1]],p2=pts[ind[k+2]];
        normal.subVectors(p1,p0).cross(new T.Vector3().subVectors(p2,p0)).normalize();
        const l=.5+Math.abs(normal.dot(light))*.5;
        let mat=o.material;if(Array.isArray(mat)){const group=o.geometry.groups.find(g=>k>=g.start&&k<g.start+g.count);mat=mat[group?.materialIndex||0];}
        const color=(mat?.color||new T.Color('#b6bcc5')).clone();
        const screen=[p0,p1,p2].map(p=>{v.copy(p).project(camera);return [Number(v.x.toFixed(5)),Number(v.y.toFixed(5)),Number(v.z.toFixed(5))];});
        triangles.push({p:screen,c:color.multiplyScalar(l).convertLinearToSRGB().toArray().map(c=>Math.max(0,Math.min(255,Math.round(c*255))))});
      }
    });
    fs.writeFileSync(out+'/'+cid+'-'+state+'.json',JSON.stringify(triangles));
    const finite=ch.directBindAll.every(b=>b.bone.matrixWorld.elements.every(Number.isFinite));if(!finite)throw Error('Non-finite '+cid+' '+state);
    rows.push({class:cid,state,clip:ch.player.resolvedClip,selection:sel,finite});
  }
  ch.dispose();
}
fs.writeFileSync(sourceRoot===root?root+'/qa/offline-pose-matrix.json':out+'/report.json',JSON.stringify({method:'CPU pose projection using the real rig and character factory. Not browser gameplay footage.',rows},null,2));
console.log('Offline poses:',rows.length);
