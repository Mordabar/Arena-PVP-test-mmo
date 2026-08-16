#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8');const g=(ok,n,d)=>{console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;};
const main=read('js/main.js'),cam=read('js/render/camera3d.js'),html=read('index.html');
g(/_mouseTurnDelta/.test(main)&&/angleDelta\(yawBefore, self\.renderer\.camera\.yaw\)/.test(main),'arrastre izquierdo mantiene cuerpo↔cámara 1:1');
g(/followBodyYaw/.test(cam)&&/followBodyYaw/.test(main),'la cámara sigue el giro corporal por teclado');
g(/world\.advance\(realDt\)[\s\S]*followBodyYaw/.test(main),'seguimiento usa delta autoritativo aceptado');
g(/rightDragging|button === 2|free.?look/i.test(main),'free-look derecho permanece separado');
g(/var s = \(k\['e'\] \? 1 : 0\) - \(k\['q'\] \? 1 : 0\)/.test(main),'Q izquierda / E derecha son strafe');
g(/_turnIntent = \(k\['d'\] \? 1 : 0\) - \(k\['a'\] \? 1 : 0\)/.test(main),'A izquierda / D derecha giran sin inversión');
g(/Strafe[\s\S]{0,80}Q[\s\S]{0,30}izquierda[\s\S]{0,60}E[\s\S]{0,30}derecha[\s\S]{0,100}Girar[\s\S]{0,60}A[\s\S]{0,20}D/i.test(html),'ayuda visible coincide con controles');
process.exit(f?1:0);
