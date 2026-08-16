#!/usr/bin/env python3
import json, math, os, struct, sys, tempfile
from pathlib import Path
import numpy as np
import trimesh
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy

GLTF_JSON = 0x4E4F534A
GLTF_BIN = 0x004E4942

BONES = [
    # name, parent, world bind position
    ("Hips", None, (0.0, 0.955, 0.0)),
    ("Spine", "Hips", (0.0, 1.105, 0.0)),
    ("Chest", "Spine", (0.0, 1.305, 0.0)),
    ("Neck", "Chest", (0.0, 1.505, 0.0)),
    ("Head", "Neck", (0.0, 1.655, 0.015)),
    ("LeftUpperArm", "Chest", (-0.255, 1.425, 0.005)),
    ("LeftLowerArm", "LeftUpperArm", (-0.340, 1.165, 0.025)),
    ("LeftHand", "LeftLowerArm", (-0.398, 0.915, 0.055)),
    ("RightUpperArm", "Chest", (0.255, 1.425, 0.005)),
    ("RightLowerArm", "RightUpperArm", (0.340, 1.165, 0.025)),
    ("RightHand", "RightLowerArm", (0.398, 0.915, 0.055)),
    ("LeftUpperLeg", "Hips", (-0.105, 0.905, 0.000)),
    ("LeftLowerLeg", "LeftUpperLeg", (-0.105, 0.505, 0.008)),
    ("LeftFoot", "LeftLowerLeg", (-0.105, 0.105, 0.065)),
    ("RightUpperLeg", "Hips", (0.105, 0.905, 0.000)),
    ("RightLowerLeg", "RightUpperLeg", (0.105, 0.505, 0.008)),
    ("RightFoot", "RightLowerLeg", (0.105, 0.105, 0.065)),
]
BONE_INDEX = {b[0]: i for i, b in enumerate(BONES)}
BIND_POS = {b[0]: np.array(b[2], dtype=np.float64) for b in BONES}


def align4(n):
    return (n + 3) & ~3


def read_glb(path):
    data = Path(path).read_bytes()
    if len(data) < 20 or data[:4] != b'glTF':
        raise ValueError('Not a GLB')
    magic, version, total = struct.unpack_from('<4sII', data, 0)
    if version != 2:
        raise ValueError(f'GLB version {version} unsupported')
    off = 12
    doc = None; bin_blob = b''
    while off + 8 <= len(data):
        length, ctype = struct.unpack_from('<II', data, off); off += 8
        chunk = data[off:off+length]; off += length
        if ctype == GLTF_JSON:
            doc = json.loads(chunk.decode('utf-8').rstrip(' \t\r\n\x00'))
        elif ctype == GLTF_BIN:
            bin_blob = chunk
    if doc is None:
        raise ValueError('GLB has no JSON chunk')
    return doc, bytearray(bin_blob)


def write_glb(path, doc, bin_blob):
    # Buffer length excludes GLB padding but including it is valid and simpler.
    bin_pad = (-len(bin_blob)) % 4
    if bin_pad:
        bin_blob = bytes(bin_blob) + b'\x00' * bin_pad
    else:
        bin_blob = bytes(bin_blob)
    doc.setdefault('buffers', [{}])
    doc['buffers'][0]['byteLength'] = len(bin_blob)
    js = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_blob)
    out = bytearray()
    out += struct.pack('<4sII', b'glTF', 2, total)
    out += struct.pack('<II', len(js), GLTF_JSON) + js
    out += struct.pack('<II', len(bin_blob), GLTF_BIN) + bin_blob
    Path(path).write_bytes(out)


def accessor_array(doc, blob, accessor_index):
    acc = doc['accessors'][accessor_index]
    bv = doc['bufferViews'][acc['bufferView']]
    comp = acc['componentType']
    dtypes = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
    comps = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[acc['type']]
    dt = np.dtype(dtypes[comp])
    base = bv.get('byteOffset',0) + acc.get('byteOffset',0)
    stride = bv.get('byteStride')
    count = acc['count']
    if not stride or stride == dt.itemsize * comps:
        arr = np.frombuffer(blob, dtype=dt, count=count*comps, offset=base).reshape(count, comps)
        return arr.copy()
    out = np.empty((count, comps), dtype=dt)
    for i in range(count):
        out[i] = np.frombuffer(blob, dtype=dt, count=comps, offset=base+i*stride)
    return out


def decimate(source, target, face_target=50000):
    scene = trimesh.load(source, force='scene')
    if not scene.geometry:
        raise RuntimeError('No mesh geometry in source')
    mesh = next(iter(scene.geometry.values()))
    verts = np.asarray(mesh.vertices, dtype=np.float32)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    if len(faces) <= face_target:
        Path(target).write_bytes(Path(source).read_bytes()); return len(faces), len(verts)
    uv = np.asarray(mesh.visual.uv, dtype=np.float32) if hasattr(mesh.visual, 'uv') and mesh.visual.uv is not None else None
    normals = np.asarray(mesh.vertex_normals, dtype=np.float32)

    pts = vtk.vtkPoints(); pts.SetData(numpy_to_vtk(verts, deep=True))
    poly = vtk.vtkPolyData(); poly.SetPoints(pts)
    legacy = np.empty((faces.shape[0],4), dtype=np.int64); legacy[:,0]=3; legacy[:,1:]=faces
    cells = vtk.vtkCellArray(); cells.SetCells(faces.shape[0], numpy_to_vtk(legacy.ravel(), deep=True, array_type=vtk.VTK_ID_TYPE)); poly.SetPolys(cells)
    if uv is not None:
        tc = numpy_to_vtk(uv, deep=True); tc.SetNumberOfComponents(2); tc.SetName('TCoords'); poly.GetPointData().SetTCoords(tc)
    na = numpy_to_vtk(normals, deep=True); na.SetNumberOfComponents(3); na.SetName('Normals'); poly.GetPointData().SetNormals(na)

    # vtkDecimatePro preserves topology and, unlike QuadricDecimation with
    # AttributeErrorMetric, keeps UV seams stable without pulling vertices into
    # texture-coordinate space (an adversarial preview caught that failure).
    dec = vtk.vtkDecimatePro(); dec.SetInputData(poly)
    dec.SetTargetReduction(max(0.0, min(0.99, 1.0 - float(face_target)/len(faces))))
    dec.PreserveTopologyOn(); dec.BoundaryVertexDeletionOff(); dec.SplittingOff(); dec.SetFeatureAngle(60.0)
    dec.Update(); out = dec.GetOutput()
    out_faces = vtk_to_numpy(out.GetPolys().GetData()).reshape(-1,4)[:,1:].astype(np.int64)
    out_verts = vtk_to_numpy(out.GetPoints().GetData()).astype(np.float64)
    out_uv = vtk_to_numpy(out.GetPointData().GetTCoords()).astype(np.float64) if out.GetPointData().GetTCoords() else None

    visual = None
    if out_uv is not None and hasattr(mesh.visual, 'material'):
        visual = trimesh.visual.texture.TextureVisuals(uv=out_uv, material=mesh.visual.material)
    reduced = trimesh.Trimesh(vertices=out_verts, faces=out_faces, process=False, visual=visual)
    reduced.fix_normals()
    sc = trimesh.Scene(reduced)
    target_bytes = trimesh.exchange.gltf.export_glb(sc)
    Path(target).write_bytes(target_bytes)
    return len(out_faces), len(out_verts)


def point_segment_distance(p, a, b):
    ab = b-a; den = float(np.dot(ab,ab))
    if den < 1e-12: return np.linalg.norm(p-a)
    t = max(0.0, min(1.0, float(np.dot(p-a,ab)/den)))
    q = a+t*ab
    return float(np.linalg.norm(p-q))


def add_weight(acc, bone, value):
    if value <= 0: return
    acc[BONE_INDEX[bone]] = acc.get(BONE_INDEX[bone], 0.0) + float(value)


def compute_weights(vertices):
    n = len(vertices)
    joints = np.zeros((n,4), dtype=np.uint16)
    weights = np.zeros((n,4), dtype=np.float32)
    for i,p in enumerate(vertices.astype(np.float64)):
        x,y,z = p; ax=abs(x); side = 'Left' if x < 0 else 'Right'
        acc = {}
        # Long hair / head mass. z<0 catches the long rear hair without stealing chest skin.
        if y > 1.56 or (y > 1.26 and z < -0.075 and ax < 0.23):
            t = max(0.0, min(1.0, (y-1.46)/0.20))
            add_weight(acc,'Head',0.60+0.40*t)
            add_weight(acc,'Neck',0.40*(1.0-t))
        # Arms/hands: source model has relaxed arms away from torso.
        elif y > 0.76 and ax > 0.255:
            up = side+'UpperArm'; lo = side+'LowerArm'; hand = side+'Hand'
            shoulder=BIND_POS[up]; elbow=BIND_POS[lo]; wrist=BIND_POS[hand]
            hand_tip = wrist + np.array([(-0.015 if side=='Left' else 0.015), -0.10, 0.015])
            d = [(up,point_segment_distance(p, shoulder, elbow)),
                 (lo,point_segment_distance(p, elbow, wrist)),
                 (hand,point_segment_distance(p, wrist, hand_tip))]
            for name,dist in d: add_weight(acc,name,1.0/((dist+0.025)**2))
            if y > 1.30 and ax < 0.31: add_weight(acc,'Chest',8.0*(1.48-y+0.05))
        # Legs and feet.
        elif y < 0.88:
            up=side+'UpperLeg'; lo=side+'LowerLeg'; foot=side+'Foot'
            hip=BIND_POS[up]; knee=BIND_POS[lo]; ankle=BIND_POS[foot]; toe=ankle+np.array([0,-0.045,0.18])
            # central crotch/underwear belongs partly to hips
            if y > 0.76 and ax < 0.14:
                add_weight(acc,'Hips',6.0*(0.15-ax+0.02))
            for name,a,b in [(up,hip,knee),(lo,knee,ankle),(foot,ankle,toe)]:
                dist=point_segment_distance(p,a,b); add_weight(acc,name,1.0/((dist+0.028)**2))
        else:
            # Torso; interpolate along vertical chain.
            chain=['Hips','Spine','Chest','Neck','Head']
            for name in chain:
                bp=BIND_POS[name]
                dy=abs(y-bp[1]); dx=max(0.0, ax-0.14)*0.35
                dz=abs(z-bp[2])*0.12
                add_weight(acc,name,1.0/((dy+dx+dz+0.055)**2))
            # shoulder seam blending
            if y>1.30 and ax>0.18:
                add_weight(acc,side+'UpperArm',1.0/((abs(ax-0.255)+abs(y-1.425)+0.05)**2))

        if not acc:
            acc[BONE_INDEX['Hips']]=1.0
        best=sorted(acc.items(), key=lambda kv:kv[1], reverse=True)[:4]
        s=sum(v for _,v in best) or 1.0
        for j,(bi,w) in enumerate(best):
            joints[i,j]=bi; weights[i,j]=w/s
    return joints, weights


def append_view_accessor(doc, blob, arr, component_type, gltf_type, minmax=False):
    while len(blob)%4: blob.append(0)
    offset=len(blob); raw=np.ascontiguousarray(arr).tobytes(); blob.extend(raw)
    bv_index=len(doc.setdefault('bufferViews',[])); doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)})
    acc={'bufferView':bv_index,'componentType':component_type,'count':int(arr.shape[0]),'type':gltf_type}
    if minmax:
        acc['min']=arr.min(axis=0).astype(float).tolist(); acc['max']=arr.max(axis=0).astype(float).tolist()
    ai=len(doc.setdefault('accessors',[])); doc['accessors'].append(acc)
    return ai


def inverse_translation_matrix(pos):
    # glTF MAT4 column-major
    x,y,z = pos
    return np.array([
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        -x,-y,-z,1
    ],dtype=np.float32)


def rig_glb(source_glb, out_glb):
    doc, blob=read_glb(source_glb)
    # locate first primitive with POSITION
    prim=None; mesh_node_index=None
    for ni,node in enumerate(doc.get('nodes',[])):
        if 'mesh' in node:
            mesh_node_index=ni
            mesh=doc['meshes'][node['mesh']]
            if mesh.get('primitives'):
                prim=mesh['primitives'][0]; break
    if prim is None: raise RuntimeError('No mesh primitive')
    vertices=accessor_array(doc,blob,prim['attributes']['POSITION']).astype(np.float32)
    joints,weights=compute_weights(vertices)
    ji=append_view_accessor(doc,blob,joints,5123,'VEC4')
    wi=append_view_accessor(doc,blob,weights,5126,'VEC4')
    prim['attributes']['JOINTS_0']=ji; prim['attributes']['WEIGHTS_0']=wi

    # Add Armature root then bone nodes. World bind positions are converted to local translations.
    nodes=doc.setdefault('nodes',[])
    armature_index=len(nodes); nodes.append({'name':'Armature','children':[]})
    node_for={}
    for name,parent,world in BONES:
        node_for[name]=len(nodes)
        if parent is None:
            local=np.array(world,dtype=float)
        else:
            local=np.array(world,dtype=float)-BIND_POS[parent]
        nodes.append({'name':name,'translation':local.astype(float).tolist(),'children':[]})
    for name,parent,world in BONES:
        idx=node_for[name]
        if parent is None: nodes[armature_index]['children'].append(idx)
        else: nodes[node_for[parent]]['children'].append(idx)
    # remove empty children for cleanliness
    for node in nodes[armature_index:]:
        if node.get('children') == []: node.pop('children',None)

    ibm=np.stack([inverse_translation_matrix(BIND_POS[name]) for name,_,_ in BONES],axis=0)
    ibm_idx=append_view_accessor(doc,blob,ibm,5126,'MAT4')
    skin_idx=len(doc.setdefault('skins',[]))
    doc['skins'].append({'name':'DarkElfHumanoidSkin','inverseBindMatrices':ibm_idx,
                         'skeleton':node_for['Hips'],'joints':[node_for[name] for name,_,_ in BONES]})
    doc['nodes'][mesh_node_index]['skin']=skin_idx
    # Ensure armature is part of the active scene.
    scene_index=doc.get('scene',0); scenes=doc.setdefault('scenes',[{'nodes':[]}])
    scenes[scene_index].setdefault('nodes',[]).append(armature_index)
    doc.setdefault('asset',{})['generator']='Project Arena humanoid rig + VTK quadric decimation v0.14'
    doc['asset']['extras']={'sourceTriangles':120000,'targetTriangles':50000,'rig':'ProjectArenaHumanoid17'}
    write_glb(out_glb,doc,blob)
    return len(vertices), joints, weights


def main():
    if len(sys.argv)<3:
        print('usage: rig_optimize_dark_elf.py SOURCE.glb OUT.glb [faces]'); return 2
    src=Path(sys.argv[1]); out=Path(sys.argv[2]); faces=int(sys.argv[3]) if len(sys.argv)>3 else 50000
    out.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        reduced=Path(td)/'reduced.glb'
        fc,vc=decimate(src,reduced,faces)
        vcount,joints,weights=rig_glb(reduced,out)
    print(json.dumps({
        'source':str(src),'output':str(out),'targetFaces':faces,'actualFaces':fc,
        'vertices':vcount,'bones':len(BONES),'weightsMin':float(weights.sum(1).min()),
        'weightsMax':float(weights.sum(1).max()),'sizeBytes':out.stat().st_size
    },indent=2))
    return 0
if __name__=='__main__': raise SystemExit(main())
