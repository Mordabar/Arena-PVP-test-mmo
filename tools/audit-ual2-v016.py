#!/usr/bin/env python3
import json,struct,sys,math,os
from pathlib import Path

COMP={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
NCOMP={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def load_glb(path):
    b=Path(path).read_bytes(); magic,ver,total=struct.unpack_from('<4sII',b,0)
    if magic!=b'glTF': raise SystemExit('not glb')
    off=12; js=None; binchunk=b''
    while off<total:
        ln,tp=struct.unpack_from('<II',b,off); off+=8; data=b[off:off+ln]; off+=ln
        if tp==0x4E4F534A: js=json.loads(data.decode('utf-8').rstrip('\x00 '))
        elif tp==0x004E4942: binchunk=data
    return js,binchunk

def accessor(js,binchunk,idx):
    a=js['accessors'][idx]; bv=js['bufferViews'][a['bufferView']]; fmt,size=COMP[a['componentType']]; n=NCOMP[a['type']]
    stride=bv.get('byteStride',n*size); start=bv.get('byteOffset',0)+a.get('byteOffset',0); out=[]
    for i in range(a['count']):
        pos=start+i*stride; vals=struct.unpack_from('<'+fmt*n,binchunk,pos); out.append(vals)
    return out

def q_angle(q1,q2):
    d=abs(sum(a*b for a,b in zip(q1,q2))); d=max(-1,min(1,d)); return 2*math.acos(d)

def main(path):
    js,binchunk=load_glb(path); names=[n.get('name','') for n in js['nodes']]
    clips={a.get('name',''):a for a in js.get('animations',[])}
    required=['Idle_FoldArms_Loop','Walk_Carry_Loop','Hit_Knockback','NinjaJump_Start','NinjaJump_Idle_Loop','NinjaJump_Land','Sword_Regular_A','Sword_Regular_B','Sword_Regular_C','Sword_Heavy_Combo','Sword_Block','Sword_Dash','Shield_OneShot']
    gates=[]
    def gate(ok,msg): gates.append(ok); print(('✓ ' if ok else '✗ ')+msg)
    gate(len(clips)>=43,f'{len(clips)} clips disponibles (>=43)')
    gate(all(x in clips for x in required),'clips requeridos presentes')
    sourcebones=['pelvis','spine_01','spine_03','neck_01','Head','upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r']
    gate(all(x in names for x in sourcebones),'17 cadenas fuente para retarget presentes')

    def channel(anim,node,path):
        ni=names.index(node)
        for ch in anim['channels']:
            if ch['target']['node']==ni and ch['target']['path']==path:
                sm=anim['samplers'][ch['sampler']]; return accessor(js,binchunk,sm['input']),accessor(js,binchunk,sm['output'])
        return None,None

    wt=clips['Walk_Carry_Loop']
    _,ql=channel(wt,'thigh_l','rotation'); _,qr=channel(wt,'thigh_r','rotation')
    swing=max(q_angle(ql[0],q) for q in ql) if ql else 0
    swing2=max(q_angle(qr[0],q) for q in qr) if qr else 0
    gate(swing>0.35 and swing2>0.35,f'Walk_Carry mueve ambas piernas ({swing:.2f}/{swing2:.2f} rad)')
    _,pel=channel(wt,'pelvis','translation')
    if pel:
        yr=[v[2] for v in pel] # root bind rotates source Z into world Y
        gate(max(yr)-min(yr)>0.015 and max(yr)-min(yr)<0.35,f'pelvis gait vertical legible sin salto ({max(yr)-min(yr):.3f} m)')
    else: gate(False,'pelvis gait translation')

    idle=clips['Idle_FoldArms_Loop']
    _,iq=channel(idle,'thigh_l','rotation'); _,ic=channel(idle,'spine_03','rotation')
    idle_leg=max(q_angle(iq[0],q) for q in iq) if iq else 0; idle_chest=max(q_angle(ic[0],q) for q in ic) if ic else 0
    gate(0.01<idle_leg<0.25 and 0.005<idle_chest<0.20,f'Idle_FoldArms aporta micro-movimiento natural ({idle_leg:.3f}/{idle_chest:.3f} rad)')

    # Non-root-motion variant must not drag authoritative gameplay root.
    _,rootT=channel(wt,'root','translation')
    if rootT:
        span=max(math.dist(rootT[0],v) for v in rootT)
        gate(span<1e-4,f'archivo Standard sin root motion ({span:.6f} m)')
    else: gate(True,'root sin track de desplazamiento')

    for clipname in ['Sword_Regular_A','Sword_Regular_B','Sword_Heavy_Combo','Sword_Block']:
        a=clips[clipname]; _,qa=channel(a,'upperarm_r','rotation'); _,qs=channel(a,'spine_03','rotation')
        ma=max(q_angle(qa[0],q) for q in qa) if qa else 0; ms=max(q_angle(qs[0],q) for q in qs) if qs else 0
        gate(ma>0.35 and ms>0.05,f'{clipname}: brazo+torso participan ({ma:.2f}/{ms:.2f} rad)')

    # All required clips animate mapped chains, so no silent T-pose fallback.
    for clipname in required:
        a=clips[clipname]; animated=set()
        for ch in a['channels']:
            if ch['target']['path']=='rotation': animated.add(names[ch['target']['node']])
        gate(len(set(sourcebones)&animated)>=15,f'{clipname}: {len(set(sourcebones)&animated)}/17 huesos mapeados con rotación')

    ok=all(gates); print(f'\nGATES: {sum(gates)}/{len(gates)}'); print('UAL2 AUDIT: '+('APROBADO' if ok else 'RECHAZADO'))
    return 0 if ok else 1
if __name__=='__main__': sys.exit(main(sys.argv[1] if len(sys.argv)>1 else 'assets/animations/ual2-standard.glb'))
