import os,sys,json,math,struct
import numpy as np
from scipy.spatial.transform import Rotation as R
sys.path.insert(0,os.path.dirname(__file__))
from fbx_motion import Motion

MAP={
 'hip':'pelvis','abdomen':'spine_01','chest':'spine_03','neck':'neck_01','head':'Head',
 'lCollar':'clavicle_l','lShldr':'upperarm_l','lForeArm':'lowerarm_l','lHand':'hand_l',
 'rCollar':'clavicle_r','rShldr':'upperarm_r','rForeArm':'lowerarm_r','rHand':'hand_r',
 'lThigh':'thigh_l','lShin':'calf_l','lFoot':'foot_l','rThigh':'thigh_r','rShin':'calf_r','rFoot':'foot_r'
}

def load_glb_nodes(path):
 d=open(path,'rb').read();off=12;js=None
 while off<len(d):
  ln,typ=struct.unpack_from('<II',d,off);off+=8;ch=d[off:off+ln];off+=ln
  if typ==0x4E4F534A:js=json.loads(ch.decode('utf-8').rstrip('\x00 '));break
 parents={}
 for i,n in enumerate(js['nodes']):
  for c in n.get('children',[]):parents[c]=i
 byname={n.get('name'):i for i,n in enumerate(js['nodes']) if n.get('name')}
 localq={}; localt={}
 for i,n in enumerate(js['nodes']):
  q=n.get('rotation',[0,0,0,1]);localq[i]=R.from_quat(q)
  localt[i]=np.array(n.get('translation',[0,0,0]),float)
 globalq={}
 def gq(i):
  if i in globalq:return globalq[i]
  p=parents.get(i);q=localq[i]
  globalq[i]=(gq(p)*q) if p is not None else q
  return globalq[i]
 for i in range(len(js['nodes'])):gq(i)
 return js,parents,byname,localq,globalq,localt

def quat_xyzw(rot):
 q=rot.as_quat()
 # normalize and deterministic sign w>=0 not always continuity; handled later
 return q

def retarget(src_path,target_glb,name,start,end,fps=20,notes=None):
 m=Motion(src_path)
 js,parents,tby,tlocal,tglobal,tpos=load_glb_nodes(target_glb)
 # corrections from source frame 0 -> target bind global
 sg0=m.globals(0.0)
 corr={}
 for sn,tn in MAP.items():
  if sn not in m.byname or tn not in tby: continue
  sq=sg0[m.byname[sn]][1]; tq=tglobal[tby[tn]]
  corr[sn]=tq*sq.inv()
 times=np.arange(start,end+1e-9,1.0/fps)
 if times[-1] < end-1e-5: times=np.append(times,end)
 out_tracks={tn:[] for tn in MAP.values() if tn in tby}
 prevq={}
 # build target hierarchy desired globals every frame. Mapped desired globals,
 # unmapped bones keep target bind global; local for mapped is relative to actual parent global.
 for st in times:
  sg=m.globals(float(st))
  desired_global={}
  for sn,tn in MAP.items():
   if sn in corr:
    desired_global[tn]=sg[m.byname[sn]][1]*sg0[m.byname[sn]][1].inv()*tglobal[tby[tn]]
  # derive locals against desired mapped parent chain; for target parent intermediates,
  # use recursively their bind or desired globals.
  actual_global={}
  def tgt_global(i):
   nm=js['nodes'][i].get('name')
   if nm in actual_global:return actual_global[nm]
   p=parents.get(i)
   pg=tgt_global(p) if p is not None else R.identity()
   if nm in desired_global:
    g=desired_global[nm]
   else:
    g=pg*tlocal[i]
   actual_global[nm]=g; return g
  for tn in out_tracks:
   i=tby[tn]; p=parents.get(i); pg=tgt_global(p) if p is not None else R.identity(); g=tgt_global(i)
   l=pg.inv()*g
   q=quat_xyzw(l)
   if tn in prevq and np.dot(prevq[tn],q)<0:q=-q
   prevq[tn]=q.copy();out_tracks[tn].extend(float(x) for x in q)
 reltimes=[round(float(t-start),6) for t in times]
 return {
  'name':name,'source':os.path.basename(src_path),'sourceWindow':[start,end],
  'duration':round(float(end-start),6),'fps':fps,'notes':notes or '',
  'tracks':[{'bone':tn,'times':reltimes,'values':[round(v,7) for v in vals]} for tn,vals in out_tracks.items()]
 }

def main(out,target,cdir):
 specs=[
  # Locomotion: isolated from actual navigation captures. World translation is stripped.
  ('Arena_CMU_Walk_Backward','113_01.fbx',2.40,3.733333,'backward gait cycle; root translation stripped'),
  ('Arena_CMU_Strafe_Left','143_40.fbx',2.366667,3.033333,'walk sideways: left cycle'),
  ('Arena_CMU_Strafe_Right','143_40.fbx',5.883333,7.183333,'walk sideways: right cycle'),
  ('Arena_CMU_Diagonal_FL','41_02.fbx',10.30,11.40,'navigation: forward-left diagonal cycle'),
  ('Arena_CMU_Diagonal_FR','40_02.fbx',7.333333,8.60,'navigation: forward-right diagonal cycle'),
  ('Arena_CMU_Diagonal_BL','41_02.fbx',20.433333,21.333333,'navigation: backward-left diagonal cycle'),
  ('Arena_CMU_Diagonal_BR','41_02.fbx',15.20,16.566667,'navigation: backward-right diagonal cycle'),
  ('Arena_CMU_Turn_Left','16_27.fbx',0.20,1.95,'walk-step 90-degree left turn; world yaw stripped'),
  ('Arena_CMU_Turn_Right','16_29.fbx',0.20,2.25,'walk-step 90-degree right turn; world yaw stripped'),

  # Martial kick. 135_04 is explicitly Front Kick, replacing the rejected soccer-kick candidate.
  ('Arena_CMU_Kick','135_04.fbx',0.50,3.20,'martial-arts front kick: chamber -> extension -> recovery'),

  # Bow 79_86 was semantically relevant but failed Arena's visual alignment gate.
  # It is intentionally not shipped in runtime; archer action slots remain blank.

 ]
 clips=[]
 for name,file,a,b,note in specs:
  clips.append(retarget(os.path.join(cdir,file),target,name,a,b,20,note))
 payload={
  'version':'0.31.0','sourcePack':'Anims_Only_FBX_V1.zip','sourceDataset':'CMU motion capture via RancidMilk FBX conversion',
  'policy':'directional locomotion + kick only; caster motions retired by user mapping',
  'clips':clips
 }
 os.makedirs(os.path.dirname(out),exist_ok=True)
 with open(out,'w') as f:json.dump(payload,f,separators=(',',':'))
 print('wrote',out,'clips',len(clips),'bytes',os.path.getsize(out))
 for c in clips:print(c['name'],c['duration'],len(c['tracks']))
if __name__=='__main__':main(sys.argv[1],sys.argv[2],sys.argv[3])
