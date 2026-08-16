#!/usr/bin/env python3
import json, struct, sys
from pathlib import Path
import numpy as np

JSON=0x4E4F534A; BIN=0x004E4942
DT={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}
COMP={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
REQ=['Hips','Spine','Chest','Neck','Head','LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot']

def load(path):
 d=Path(path).read_bytes();o=12;j=None;b=b''
 assert d[:4]==b'glTF'
 while o<len(d):
  l,t=struct.unpack_from('<II',d,o);o+=8;c=d[o:o+l];o+=l
  if t==JSON:j=json.loads(c.decode().rstrip(' \x00\r\n\t'))
  elif t==BIN:b=c
 return j,b

def arr(j,b,ai):
 a=j['accessors'][ai];v=j['bufferViews'][a['bufferView']];n=COMP[a['type']];dt=np.dtype(DT[a['componentType']]);off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dt.itemsize*n)
 out=np.empty((a['count'],n),dtype=dt)
 for i in range(a['count']):out[i]=np.frombuffer(b,dtype=dt,count=n,offset=off+i*stride)
 return out

def main():
 p=sys.argv[1];j,b=load(p)
 prim=j['meshes'][0]['primitives'][0];attrs=prim['attributes']
 assert 'JOINTS_0' in attrs and 'WEIGHTS_0' in attrs
 joints=arr(j,b,attrs['JOINTS_0']);weights=arr(j,b,attrs['WEIGHTS_0']).astype(float)
 pos=arr(j,b,attrs['POSITION'])
 if 'indices' in prim:
  idx=arr(j,b,prim['indices']).reshape(-1); tris=len(idx)//3
 else: tris=len(pos)//3
 names={n.get('name') for n in j.get('nodes',[])}
 missing=[n for n in REQ if n not in names]
 assert not missing, missing
 assert len(j.get('skins',[]))==1
 assert len(j['skins'][0]['joints'])==17
 assert tris==50000, tris
 sums=weights.sum(1)
 assert np.max(np.abs(sums-1.0))<1e-4, (sums.min(),sums.max())
 assert joints.max()<17
 assert len(j.get('materials',[]))>=1 and len(j.get('images',[]))>=1
 print(json.dumps({'PASS':True,'triangles':tris,'vertices':len(pos),'bones':17,'skins':1,'materials':len(j.get('materials',[])),'images':len(j.get('images',[])),'weightSumMin':float(sums.min()),'weightSumMax':float(sums.max()),'bytes':Path(p).stat().st_size},indent=2))
if __name__=='__main__':main()
