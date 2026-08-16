/* =============================================================================
 * threeRetarget.js — v0.16 UAL2 → Dark Elf humanoid retarget bridge
 *
 * Presentation only. Samples CC0 reference clips on their source skeleton,
 * measures WORLD-SPACE rotation deltas from the source bind pose, then applies
 * those deltas to the Dark Elf bind pose. The target root/yaw/position remain
 * simulation-authoritative and are never read back into gameplay.
 * ========================================================================== */
import * as THREE from 'three';

const SOURCE_FOR_TARGET = {
  Hips:'pelvis', Spine:'spine_01', Chest:'spine_03', Neck:'neck_01', Head:'Head',
  LeftUpperArm:'upperarm_l', LeftLowerArm:'lowerarm_l', LeftHand:'hand_l',
  RightUpperArm:'upperarm_r', RightLowerArm:'lowerarm_r', RightHand:'hand_r',
  LeftUpperLeg:'thigh_l', LeftLowerLeg:'calf_l', LeftFoot:'foot_l',
  RightUpperLeg:'thigh_r', RightLowerLeg:'calf_r', RightFoot:'foot_r'
};
const TARGET_PARENT = {
  Hips:null, Spine:'Hips', Chest:'Spine', Neck:'Chest', Head:'Neck',
  LeftUpperArm:'Chest', LeftLowerArm:'LeftUpperArm', LeftHand:'LeftLowerArm',
  RightUpperArm:'Chest', RightLowerArm:'RightUpperArm', RightHand:'RightLowerArm',
  LeftUpperLeg:'Hips', LeftLowerLeg:'LeftUpperLeg', LeftFoot:'LeftLowerLeg',
  RightUpperLeg:'Hips', RightLowerLeg:'RightUpperLeg', RightFoot:'RightLowerLeg'
};
const TARGET_ORDER = Object.keys(TARGET_PARENT);

const _srcQ=new THREE.Quaternion(), _invBind=new THREE.Quaternion(), _delta=new THREE.Quaternion();
const _desired=new THREE.Quaternion(), _parentInv=new THREE.Quaternion(), _local=new THREE.Quaternion();
const _identity=new THREE.Quaternion(), _pos=new THREE.Vector3();

function nodesByName(root){
  const out=Object.create(null); root.traverse(o=>{ if(o.name) out[o.name]=o; }); return out;
}
function bindWorld(root){
  root.updateMatrixWorld(true);
  const q=Object.create(null), p=Object.create(null), nodes=nodesByName(root);
  Object.keys(nodes).forEach(n=>{
    q[n]=nodes[n].getWorldQuaternion(new THREE.Quaternion());
    p[n]=nodes[n].getWorldPosition(new THREE.Vector3());
  });
  return {q,p};
}

export function createRetargetLibrary(gltf){
  if(!gltf || !gltf.scene) return null;
  const clipMap=Object.create(null);
  (gltf.animations||[]).forEach(c=>{ clipMap[c.name]=c; });
  const sourceBind=bindWorld(gltf.scene);

  function Instance(){
    this.root=gltf.scene.clone(true);
    this.root.visible=false;
    this.nodes=nodesByName(this.root);
    this.mixer=new THREE.AnimationMixer(this.root);
    this.actions=Object.create(null);
    this.current=null;
    this.lastPhase=-1;
  }
  Instance.prototype.has=function(name){ return !!clipMap[name]; };
  Instance.prototype._sample=function(name,phase){
    const clip=clipMap[name]; if(!clip) return false;
    let action=this.actions[name];
    if(!action){
      action=this.mixer.clipAction(clip); action.enabled=true; action.clampWhenFinished=true;
      this.actions[name]=action;
    }
    if(this.current!==name){
      this.mixer.stopAllAction();
      action.reset().play(); action.paused=true; action.enabled=true; action.setEffectiveWeight(1);
      this.current=name;
    }
    phase=Math.max(0,Math.min(0.999999,phase||0));
    action.time=phase*Math.max(1e-4,clip.duration);
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    this.lastPhase=phase;
    return true;
  };
  Instance.prototype.retarget=function(spec,targetBones,targetBindWorld,targetBindLocalQuat){
    if(!spec || !this._sample(spec.clip,spec.phase)) return {applied:false,hipsLift:0};
    const maskNames=(window.Arena && window.Arena.Data && window.Arena.Data.AnimationLibraryMap && window.Arena.Data.AnimationLibraryMap.masks[spec.mask]) || TARGET_ORDER;
    const mask=new Set(maskNames);
    const desiredWorld=Object.create(null), out=Object.create(null);
    const blend=Math.max(0,Math.min(1,spec.blend===undefined?1:spec.blend));

    for(let i=0;i<TARGET_ORDER.length;i++){
      const tName=TARGET_ORDER[i]; if(!mask.has(tName)) continue;
      const sName=SOURCE_FOR_TARGET[tName], src=this.nodes[sName], sb=sourceBind.q[sName], tb=targetBindWorld[tName];
      if(!src||!sb||!tb||!targetBones[tName]) continue;
      src.getWorldQuaternion(_srcQ);
      _invBind.copy(sb).invert();
      _delta.copy(_srcQ).multiply(_invBind).normalize();
      // Damp exaggerated source rotations for gameplay readability if asked.
      if(spec.motionScale!==undefined && spec.motionScale!==1){
        _delta.slerp(_identity, 1-Math.max(0,Math.min(1.35,spec.motionScale)));
      }
      _desired.copy(_delta).multiply(tb).normalize();
      const parent=TARGET_PARENT[tName];
      const parentWorld=parent ? (desiredWorld[parent] || targetBindWorld[parent]) : null;
      if(parentWorld){ _parentInv.copy(parentWorld).invert(); _local.copy(_parentInv).multiply(_desired).normalize(); }
      else _local.copy(_desired);
      // Blend in local space against the real Dark Elf bind quaternion.
      const bindLocal=targetBindLocalQuat[tName];
      out[tName]=bindLocal.clone().slerp(_local,blend).normalize();
      // Parent world for descendants must reflect the blended local result.
      if(parent){ desiredWorld[tName]=(desiredWorld[parent]||targetBindWorld[parent]).clone().multiply(out[tName]).normalize(); }
      else desiredWorld[tName]=out[tName].clone();
    }

    let hipsLift=0;
    const pelvis=this.nodes.pelvis, bindPelvis=sourceBind.p.pelvis;
    if(pelvis&&bindPelvis){ pelvis.getWorldPosition(_pos); hipsLift=(_pos.y-bindPelvis.y)*blend; hipsLift=Math.max(-0.11,Math.min(0.11,hipsLift)); }
    return {applied:true,localQuats:out,hipsLift:hipsLift,clip:spec.clip};
  };
  Instance.prototype.dispose=function(){ this.mixer.stopAllAction(); this.actions=Object.create(null); this.root=null; this.nodes=null; };

  return {
    clips:clipMap,
    has:function(name){return !!clipMap[name];},
    create:function(){return new Instance();},
    sourceMap:SOURCE_FOR_TARGET
  };
}
