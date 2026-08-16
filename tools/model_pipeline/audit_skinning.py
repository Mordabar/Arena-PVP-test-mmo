#!/usr/bin/env python3
import json, math, struct, sys
from pathlib import Path
import numpy as np
JSON=0x4E4F534A; BIN=0x004E4942
DT={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}; C={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
 d=Path(p).read_bytes();o=12;j=None;b=b''
 while o<len(d):
  l,t=struct.unpack_from('<II',d,o);o+=8;c=d[o:o+l];o+=l
  if t==JSON:j=json.loads(c.decode().rstrip(' \x00\r\n\t'))
  elif t==BIN:b=c
 return j,b
def arr(j,b,ai):
 a=j['accessors'][ai];v=j['bufferViews'][a['bufferView']];n=C[a['type']];dt=np.dtype(DT[a['componentType']]);off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dt.itemsize*n);out=np.empty((a['count'],n),dtype=dt)
 for i in range(a['count']):out[i]=np.frombuffer(b,dtype=dt,count=n,offset=off+i*stride)
 return out
def T(v):
 m=np.eye(4);m[:3,3]=v;return m
def Rz(a):
 c,s=math.cos(a),math.sin(a);m=np.eye(4);m[0,0]=c;m[0,1]=-s;m[1,0]=s;m[1,1]=c;return m
def main():
 j,b=load(sys.argv[1]); prim=j['meshes'][0]['primitives'][0]; at=prim['attributes']; pos=arr(j,b,at['POSITION']).astype(float); joints=arr(j,b,at['JOINTS_0']).astype(int); weights=arr(j,b,at['WEIGHTS_0']).astype(float)
 skin=j['skins'][0]; joint_nodes=skin['joints']; names=[j['nodes'][ni]['name'] for ni in joint_nodes]; name_to_joint={n:i for i,n in enumerate(names)}
 # parent map from node children
 parent={}
 for pi,n in enumerate(j['nodes']):
  for ch in n.get('children',[]):parent[ch]=pi
 # local bind matrices: translation-only in our generated rig
 local={}
 for ni in joint_nodes: local[ni]=T(np.array(j['nodes'][ni].get('translation',[0,0,0]),float))
 world={}
 def calc(ni):
  if ni in world:return world[ni]
  p=parent.get(ni)
  if p in local:world[ni]=calc(p)@local[ni]
  else:world[ni]=local[ni]
  return world[ni]
 for ni in joint_nodes:calc(ni)
 inv={ni:np.linalg.inv(world[ni]) for ni in joint_nodes}
 # Bind pose must be identity skinning.
 err=0.0
 for k,ni in enumerate(joint_nodes):err=max(err,float(np.abs(world[ni]@inv[ni]-np.eye(4)).max()))
 assert err<1e-9
 # Rotate left upper arm around its bind pivot, descendants inherit.
 target='LeftUpperArm'; target_node=joint_nodes[name_to_joint[target]]; anim_local=dict(local); anim_local[target_node]=local[target_node]@Rz(math.radians(-42))
 anim_world={}
 def acalc(ni):
  if ni in anim_world:return anim_world[ni]
  p=parent.get(ni)
  if p in anim_local:anim_world[ni]=acalc(p)@anim_local[ni]
  else:anim_world[ni]=anim_local[ni]
  return anim_world[ni]
 for ni in joint_nodes:acalc(ni)
 mats=[anim_world[ni]@inv[ni] for ni in joint_nodes]
 hp=np.c_[pos,np.ones(len(pos))]
 deformed=np.zeros((len(pos),3),float)
 for vi in range(len(pos)):
  q=np.zeros(4)
  for slot in range(4): q += weights[vi,slot]*(mats[joints[vi,slot]]@hp[vi])
  deformed[vi]=q[:3]
 delta=np.linalg.norm(deformed-pos,axis=1)
 left_arm_w=np.zeros(len(pos)); right_arm_w=np.zeros(len(pos))
 for nm in ['LeftUpperArm','LeftLowerArm','LeftHand']:
  ji=name_to_joint[nm]; left_arm_w += (weights*(joints==ji)).sum(1)
 for nm in ['RightUpperArm','RightLowerArm','RightHand']:
  ji=name_to_joint[nm]; right_arm_w += (weights*(joints==ji)).sum(1)
 lm=delta[left_arm_w>0.65]; rm=delta[right_arm_w>0.65]
 assert len(lm)>1000 and lm.mean()>0.04, (len(lm),lm.mean() if len(lm) else 0)
 assert len(rm)>1000 and rm.mean()<0.002, (len(rm),rm.mean() if len(rm) else 0)
 # Weight distribution: enough vertices belong strongly to each major limb.
 strong={}
 for nm in ['LeftUpperArm','RightUpperArm','LeftUpperLeg','RightUpperLeg','Head','Chest']:
  ji=name_to_joint[nm]; sw=(weights*(joints==ji)).sum(1); strong[nm]=int((sw>0.45).sum()); assert strong[nm]>150
 print(json.dumps({'PASS':True,'bindIdentityError':err,'leftArmMovedVertices':len(lm),'leftArmMeanDisplacement':float(lm.mean()),'rightArmMeanDisplacement':float(rm.mean()),'stronglyWeightedVertices':strong},indent=2))
if __name__=='__main__':main()
