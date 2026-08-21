import sys, math, numpy as np
from scipy.spatial.transform import Rotation as R
sys.path.insert(0,'/mnt/data')
from parse_fbx import parse_nodes
TICKS=46186158000.0

def clean_name(s): return str(s).split('\x00')[0]

def prop70(node):
    out={}
    ps=node.child('Properties70')
    if not ps: return out
    for p in ps[0].children:
        if p.name=='P' and p.props:
            out[p.props[0]]=p.props[4:]
    return out

def interp(times, vals, t):
    if len(times)==0: return None
    if t<=times[0]: return vals[0]
    if t>=times[-1]: return vals[-1]
    import bisect
    i=bisect.bisect_right(times,t)-1
    a=(t-times[i])/(times[i+1]-times[i])
    return vals[i]*(1-a)+vals[i+1]*a

class Motion:
    def __init__(self,path,euler='XYZ'):
        self.path=path;self.euler=euler
        v,roots=parse_nodes(open(path,'rb').read()); self.version=v
        rd={r.name:r for r in roots}; self.rd=rd
        objs=rd['Objects']; conns=rd['Connections']
        self.objects={int(c.props[0]):c for c in objs.children if c.props and isinstance(c.props[0],int)}
        self.models={i:o for i,o in self.objects.items() if o.name=='Model' and len(o.props)>=3 and o.props[2]=='LimbNode'}
        self.names={i:clean_name(o.props[1]) for i,o in self.models.items()}
        self.byname={n:i for i,n in self.names.items()}
        self.parent={}
        self.anim_to_model={}; self.curve_to_node={}; self.curve_axis={}
        for c in conns.children:
            p=c.props
            if not p: continue
            typ=p[0]
            if typ=='OO' and len(p)>=3 and p[1] in self.models and p[2] in self.models:
                self.parent[p[1]]=p[2]
            if typ=='OP' and len(p)>=4:
                child,parent,prop=p[1],p[2],p[3]
                if child in self.objects and self.objects[child].name=='AnimationCurveNode' and parent in self.models:
                    self.anim_to_model[child]=(parent,prop)
                elif child in self.objects and self.objects[child].name=='AnimationCurve' and parent in self.objects and self.objects[parent].name=='AnimationCurveNode':
                    self.curve_to_node[child]=parent; self.curve_axis[child]=prop
        self.rest_t={};self.rest_e={}
        for i,o in self.models.items():
            pr=prop70(o)
            self.rest_t[i]=np.array(pr.get('Lcl Translation',[0,0,0]),dtype=float)
            self.rest_e[i]=np.array(pr.get('Lcl Rotation',[0,0,0]),dtype=float)
        self.curves={}
        self.max_time=0.0
        for cid,nodeid in self.curve_to_node.items():
            c=self.objects[cid]
            kt=c.child('KeyTime'); kv=c.child('KeyValueFloat')
            if not kt or not kv: continue
            times=np.array(kt[0].props[0],dtype=float)/TICKS
            vals=np.array(kv[0].props[0],dtype=float)
            self.max_time=max(self.max_time,float(times[-1]) if len(times) else 0)
            self.curves[(nodeid,self.curve_axis[cid])]=(times,vals)
        # model channel nodes
        self.model_channels={}
        for nid,(mid,prop) in self.anim_to_model.items(): self.model_channels.setdefault(mid,{})[prop]=nid
    def local(self,mid,t):
        e=self.rest_e[mid].copy(); tr=self.rest_t[mid].copy()
        ch=self.model_channels.get(mid,{})
        for prop,base in [('Lcl Rotation',e),('Lcl Translation',tr)]:
            nid=ch.get(prop)
            if nid:
                for j,ax in enumerate(['d|X','d|Y','d|Z']):
                    cv=self.curves.get((nid,ax))
                    if cv: base[j]=interp(cv[0],cv[1],t)
        q=R.from_euler(self.euler,e,degrees=True)
        return tr,q
    def globals(self,t):
        cache={}
        def calc(mid):
            if mid in cache:return cache[mid]
            lt,lq=self.local(mid,t)
            p=self.parent.get(mid)
            if p is None:
                gp=np.zeros(3);gq=R.identity()
            else: gp,gq=calc(p)
            pos=gp+gq.apply(lt); q=gq*lq
            cache[mid]=(pos,q); return cache[mid]
        for mid in self.models:calc(mid)
        return cache
    def duration(self): return self.max_time

if __name__=='__main__':
 m=Motion(sys.argv[1]);print('duration',m.duration(),'bones',len(m.models),'curves',len(m.curves))
 for n in ['hip','chest','rHand','lHand','rFoot','lFoot']:
  mid=m.byname[n]; print(n,m.globals(0)[mid][0])
