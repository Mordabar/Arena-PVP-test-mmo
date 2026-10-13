import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import cp from 'node:child_process';import crypto from 'node:crypto';
import * as THREE from '../../vendor/three-0.160.0/three.module.js';
import {createVfxRenderer} from '../../js/render/three/threeVfx.js';
import {loadArena,root} from './simHarness.mjs';
const A=loadArena(),P=JSON.parse(fs.readFileSync(root+'/js/data/trainerPresentation.json','utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):/\.(js|mjs)$/.test(e.name)?[d+'/'+e.name]:[]);}
for(const file of [...walk(root+'/js'),...walk(root+'/tools')]){const r=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});ok(r.status===0,path.relative(root,file)+' syntax '+r.stderr);}
for(const m of fs.readFileSync(root+'/index.html','utf8').matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)(?:\?[^\"]*)?"/g))ok(fs.existsSync(root+'/'+m[1]),'HTML asset '+m[1]);
const real=Object.values(P).filter(p=>p.available),names=new Set(real.map(p=>p.name)),seeds=new Set(real.map(p=>p.seed));
ok(real.length===290&&names.size===290&&seeds.size===290,'unique real identities, names and VFX seeds');
const hashes=new Set();for(const p of Object.values(P)){const s=fs.readFileSync(root+'/'+p.icon,'utf8');ok(s.includes('<svg')&&s.includes('</svg>'),'SVG '+p.icon);hashes.add(crypto.createHash('sha256').update(s).digest('hex'));}ok(hashes.size===320,'distinct icon bytes');
const scene=new THREE.Scene(),renderer=createVfxRenderer(A,scene),V=A.Render.VFX;
for(const p of real){V.spells.forEach(s=>s.alive=false);const sp=V.spawnSpell({type:p.shape,element:p.element,start:{x:1,y:1,z:1},end:{x:2,y:0,z:2},life:1,seed:p.seed,variant:p.visualVariant,pulseRate:p.pulseRate,orbitDirection:p.orbitDirection,rank:5});
 for(const t of [.1,.5,.9]){sp.life=t;renderer.render();scene.updateMatrixWorld(true);ok(scene.children.every(o=>!o.visible||o.matrixWorld.elements.every(Number.isFinite)),'finite VFX '+p.name);}
}renderer.dispose();
const report={version:A.VERSION,checks,realIcons:290,uniqueIconFiles:320,vfxCases:real.length*3,scope:'Static paths, syntax, SVG identity, Three.js VFX transforms on CPU; no browser/GPU or visual gamefeel proof.'};
fs.writeFileSync(root+'/qa/static-visual-039.json',JSON.stringify(report,null,2));console.log(report);
