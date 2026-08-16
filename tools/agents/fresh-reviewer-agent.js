#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8');const g=(ok,n,d)=>{console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;};
const html=read('index.html'),pl=read('js/data/powerLibrary.js'),main=read('js/main.js'),cm=read('js/core/controlMap.js'),map=read('js/data/animationLibraryMap.js'),boot=read('js/render/three/bootstrap.js');
g(/v0\.16/.test(html)&&/UAL2 RETARGET/.test(html),'Build visible inequívoco v0.16');
g(/"name":"Meteorito del Vacío"/.test(pl)&&/source-rank5-exact/.test(pl),'paridad de poderes no se perdió');
g(/ControlMap\.movement/.test(main)&&/ControlMap\.turn/.test(main),'main no vuelve a duplicar teclado');
g(/strafe:\(k\['d'\]\?1:0\)-\(k\['a'\]\?1:0\)/.test(cm),'A/D son strafe');
g(/return \(k\['e'\]\?1:0\)-\(k\['q'\]\?1:0\)/.test(cm),'Q/E son giro');
g(/Walk_Carry_Loop/.test(map)&&/Idle_FoldArms_Loop/.test(map)&&/Sword_Regular_A/.test(map),'biblioteca UAL2 se usa realmente');
g(/mergeVertices/.test(boot)&&/computeVertexNormals/.test(boot),'piel recibe suavizado real');
g(!/rootMotion/i.test(map)||/root motion/i.test(map),'contrato documenta frontera de root motion');
process.exit(f?1:0);
