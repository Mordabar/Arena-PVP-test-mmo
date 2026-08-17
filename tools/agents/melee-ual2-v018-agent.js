#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8');
const g=(x,n)=>{console.log((x?'✓ ':'✗ ')+n);if(!x)f++;};
const s=read('js/render/animationStateMachine.js'), t=read('js/render/three/threeCharacter.js');
['Sword_Regular_A','Sword_Regular_B','Sword_Regular_C','Sword_Heavy_Combo','Sword_Block','Sword_Dash','Shield_OneShot']
  .forEach(x=>g(s.includes(x),'clip melé '+x));
g(/ACTION:\s*\{\s*clip:null,\s*mask:'full'/.test(s),'las acciones son de cuerpo entero');
g(/skipMeleeAction: mandaTodo/.test(t),'sin ataque procedural encima del clip');
const cal=JSON.parse(read('js/data/rigCalibration.js').replace(/^[\s\S]*var C = /,'').replace(/;[\s\S]*$/,''));
g(cal.clips['Sword_Regular_A'].rootSpeed>1.5,'Sword_Regular_A avanza de verdad (patinaje conocido y medido)');
process.exit(f?1:0);
