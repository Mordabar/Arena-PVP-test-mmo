#!/usr/bin/env python3
"""Create compact Arena runtime GLBs from the user-supplied CC0 UAL packs.

This is an offline packaging tool. It never changes gameplay.  It copies only
bufferViews reachable from the selected AnimationClips (+ mesh/skin for UAL1),
so the browser does not download/parse dozens of clips Project Arena does not
use in the vertical slice.
"""
from __future__ import annotations
import argparse, copy, json, struct
from pathlib import Path

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path: Path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from('<III', data, 0)
    if magic != 0x46546C67 or version != 2 or total != len(data):
        raise ValueError(f'{path}: GLB 2 inválido')
    off = 12
    jlen, jtype = struct.unpack_from('<II', data, off); off += 8
    if jtype != JSON_CHUNK: raise ValueError('falta JSON chunk')
    doc = json.loads(data[off:off+jlen]); off += jlen
    blen, btype = struct.unpack_from('<II', data, off); off += 8
    if btype != BIN_CHUNK: raise ValueError('falta BIN chunk')
    return doc, data[off:off+blen]


def pad4(b: bytes, pad=b'\x00') -> bytes:
    return b + pad * ((4 - len(b) % 4) % 4)


def write_glb(path: Path, doc: dict, blob: bytes):
    blob = pad4(blob, b'\x00')
    doc['buffers'] = [{'byteLength': len(blob)}]
    js = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    js = pad4(js, b' ')
    total = 12 + 8 + len(js) + 8 + len(blob)
    out = bytearray(struct.pack('<III', 0x46546C67, 2, total))
    out += struct.pack('<II', len(js), JSON_CHUNK) + js
    out += struct.pack('<II', len(blob), BIN_CHUNK) + blob
    path.write_bytes(out)


def trim(src: Path, dst: Path, names: list[str], keep_mesh: bool, renames: dict[str,str] | None = None):
    doc, blob = read_glb(src)
    byname = {a.get('name',''): a for a in doc.get('animations', [])}
    missing = [n for n in names if n not in byname]
    if missing: raise ValueError(f'{src.name}: clips ausentes: {missing}')
    chosen = [copy.deepcopy(byname[n]) for n in names]
    if renames:
        for a in chosen:
            if a.get('name') in renames:
                a['name'] = renames[a['name']]

    used_acc: set[int] = set()
    for a in chosen:
        for s in a.get('samplers', []):
            used_acc.add(s['input']); used_acc.add(s['output'])

    if keep_mesh:
        for mesh in doc.get('meshes', []):
            for prim in mesh.get('primitives', []):
                used_acc.update(prim.get('attributes', {}).values())
                if 'indices' in prim: used_acc.add(prim['indices'])
                for target in prim.get('targets', []): used_acc.update(target.values())
        for skin in doc.get('skins', []):
            if 'inverseBindMatrices' in skin: used_acc.add(skin['inverseBindMatrices'])

    old_accessors = doc.get('accessors', [])
    # sparse accessors can reference bufferViews directly; support them even
    # though the supplied packs currently don't use sparse data.
    used_bv: set[int] = set()
    for ai in used_acc:
        acc = old_accessors[ai]
        if 'bufferView' in acc: used_bv.add(acc['bufferView'])
        sp = acc.get('sparse')
        if sp:
            used_bv.add(sp['indices']['bufferView']); used_bv.add(sp['values']['bufferView'])

    old_bvs = doc.get('bufferViews', [])
    bv_order = sorted(used_bv)
    bv_map = {old:i for i,old in enumerate(bv_order)}
    new_blob = bytearray()
    new_bvs = []
    for old in bv_order:
        bv = copy.deepcopy(old_bvs[old])
        start = bv.get('byteOffset', 0); length = bv['byteLength']
        while len(new_blob) % 4: new_blob.append(0)
        bv['buffer'] = 0; bv['byteOffset'] = len(new_blob)
        new_blob += blob[start:start+length]
        new_bvs.append(bv)

    acc_order = sorted(used_acc)
    acc_map = {old:i for i,old in enumerate(acc_order)}
    new_accs = []
    for old in acc_order:
        acc = copy.deepcopy(old_accessors[old])
        if 'bufferView' in acc: acc['bufferView'] = bv_map[acc['bufferView']]
        sp = acc.get('sparse')
        if sp:
            sp['indices']['bufferView'] = bv_map[sp['indices']['bufferView']]
            sp['values']['bufferView'] = bv_map[sp['values']['bufferView']]
        new_accs.append(acc)

    for a in chosen:
        for s in a.get('samplers', []):
            s['input'] = acc_map[s['input']]; s['output'] = acc_map[s['output']]

    out = copy.deepcopy(doc)
    out['animations'] = chosen
    out['accessors'] = new_accs
    out['bufferViews'] = new_bvs

    if keep_mesh:
        for mesh in out.get('meshes', []):
            for prim in mesh.get('primitives', []):
                prim['attributes'] = {k:acc_map[v] for k,v in prim.get('attributes', {}).items()}
                if 'indices' in prim: prim['indices'] = acc_map[prim['indices']]
                if 'targets' in prim:
                    prim['targets'] = [{k:acc_map[v] for k,v in t.items()} for t in prim['targets']]
        for skin in out.get('skins', []):
            if 'inverseBindMatrices' in skin: skin['inverseBindMatrices'] = acc_map[skin['inverseBindMatrices']]
    else:
        for n in out.get('nodes', []):
            n.pop('mesh', None); n.pop('skin', None); n.pop('weights', None)
        for key in ('meshes','skins','materials','textures','images','samplers'):
            out.pop(key, None)

    out.setdefault('asset', {})['generator'] = 'Project Arena runtime trim (source: Quaternius UAL, CC0)'
    out.setdefault('extras', {})['arenaRuntimeTrim'] = {
        'sourceFile': src.name, 'clips': names, 'keepsMeshSkin': keep_mesh
    }
    dst.parent.mkdir(parents=True, exist_ok=True)
    write_glb(dst, out, bytes(new_blob))
    return {
        'source': src.stat().st_size, 'output': dst.stat().st_size,
        'clips': len(names), 'accessors': len(new_accs), 'bufferViews': len(new_bvs)
    }


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',default=Path(__file__).resolve().parents[1]); args=ap.parse_args()
    root=Path(args.root); ad=root/'assets'/'animations'
    u1=['Death01','Hit_Chest','Hit_Head','Idle_Loop','Jog_Fwd_Loop','Sprint_Loop','Sword_Idle','Walk_Loop',
        'Jump_Start','Jump_Loop','Jump_Land',
        'Spell_Simple_Enter','Spell_Simple_Exit','Spell_Simple_Idle_Loop','Spell_Simple_Shoot',
        'Pistol_Aim_Neutral','Pistol_Reload']
    u2=['Idle_Shield_Loop','Shield_OneShot','Sword_Dash','Sword_Block','Yes',
        'Sword_Regular_A','Sword_Regular_A_Rec','Sword_Regular_B','Sword_Regular_B_Rec','Sword_Regular_C',
        'Slide_Start','Slide_Loop','Slide_Exit']
    a=trim(ad/'ual1-standard.glb', ad/'ual1-arena-runtime.glb', u1, True)
    b=trim(ad/'ual2-standard.glb', ad/'ual2-melee-runtime.glb', u2, False)
    c=trim(ad/'ual2-standard-rm.glb', ad/'ual2-rm-runtime.glb', ['Shield_Dash'], False, {'Shield_Dash':'Shield_Dash_RM'})
    print(json.dumps({'ual1':a,'ual2':b,'ual2rm':c},indent=2))
if __name__=='__main__': main()
