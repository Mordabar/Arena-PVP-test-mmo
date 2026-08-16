#!/usr/bin/env node
'use strict';const fs=require('fs'),path=require('path'),R=path.join(__dirname,'../..');let f=0,s=fs.readFileSync(path.join(R,'js/render/three/threeCharacter.js'),'utf8');function g(x,n){console.log((x?'✓ ':'✗ ')+n);if(!x)f++;}
let branch=s.slice(s.indexOf('if (this.usedGlb) {',s.indexOf('prototype.applyPose')),s.indexOf('Backend.current.buildPose',s.indexOf('prototype.applyPose')));
g(/return;/.test(branch),'ruta GLB termina antes del procedural');g(!/buildPose/.test(branch),'ruta GLB no construye atuendo procedural');g(/makeStaff/.test(s)&&/makeBow/.test(s)&&/makeSword/.test(s),'sólo tres armas base se crean para el skinned');g(/weapons\.staff\.visible=kind===/.test(s),'una sola arma visible por arquetipo');process.exit(f?1:0);
