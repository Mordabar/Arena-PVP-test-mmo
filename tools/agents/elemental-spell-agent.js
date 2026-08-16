#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8'); const g=(ok,n,d)=>{console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;};
const pl=read('js/data/powerLibrary.js'), res=read('js/combat/resolver.js'), world=read('js/sim/world.js'), vfx=read('js/render/vfx.js'), three=read('js/render/three/threeVfx.js');
const iconic={245:'meteor',261:'fireball',262:'iceBurst',263:'lightningBolt',266:'iceStorm',268:'magmaOrb',269:'tornado',270:'lightningStorm'};
for(const [idx,shape] of Object.entries(iconic)) g(new RegExp('"sourceIndex":'+idx+'[\\s\\S]{0,2200}"shape":"'+shape+'"').test(pl),'Fuente '+idx+' conserva lectura '+shape);
g(/case 'targetArea'/.test(res)&&/ability\.target === 'targetArea'/.test(res),'AoE de objetivo tiene resolución propia');
g(/Resolver\.execute\(this, caster, ability,[\s\S]*fromProjectile: true/.test(world),'proyectiles resuelven el payload completo al impacto');
g(/semanticRelease/.test(vfx)&&/meteor|fireball|lightningBolt|iceBurst/.test(vfx),'capa VFX recibe semántica elemental');
g(/lightningBolt|meteor|iceStorm|tornado/.test(three),'Three.js dibuja familias elementales distintas');
try{const o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'v0.12 · Gate adversarial de hechizos emblemáticos'],{encoding:'utf8'});g(/5\/5/.test(o)&&/TODO OK/.test(o),'cinco pruebas ejecutables de hechizos emblemáticos');}catch(e){g(false,'gate elemental ejecutable');}
process.exit(f?1:0);
