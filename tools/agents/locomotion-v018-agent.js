#!/usr/bin/env node
/* Locomoción v0.18: lo que existe, y sobre todo lo que se niega a fingirse. */
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8');
const g=(x,n)=>{console.log((x?'✓ ':'✗ ')+n);if(!x)f++;};
const s=read('js/render/animationStateMachine.js'), c=read('js/render/skinnedAnimationContract.js');
g(/Idle_No_Loop/.test(s),'el idle base ya no es el de brazos cruzados');
g(!/Idle_FoldArms_Loop/.test(s),'Idle_FoldArms_Loop retirado: peleaba con las guardias de arma');
g(/Walk_Carry_Loop/.test(s)&&/Zombie_Walk_Fwd_Loop/.test(s),'los dos ciclos reales del paquete están conectados');
g(/BACKPEDAL:\s*\{\s*clip:null/.test(s),'BACKPEDAL no tiene clip: no se reproduce la marcha al revés');
g(/STRAFE:\s*\{\s*clip:null/.test(s),'STRAFE no tiene clip: no se gira el andar 90°');
g(/TURN:\s*\{\s*clip:null/.test(s),'TURN no tiene clip');
g(!/phase\s*=\s*\(1-phase\)/.test(s),'la inversión de fase de la v0.16 (moonwalk) ya no existe');
g(/pureStrafe/.test(c)&&/turnRate/.test(c),'la gramática propia sigue cubriendo strafe y giro');
g(/playbackRate/.test(s),'la zancada se sincroniza con la velocidad real');
g(/rootSpeed/.test(s),'el rate sale de la velocidad MEDIDA del clip');
g(/metersPerSecond/.test(read('js/render/anim/locomotion.js')),'la locomoción publica m/s reales');
try{const o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'v0.18'],{encoding:'utf8'});
  g(/TODO OK — 30 pruebas/.test(o),'las 30 pruebas v0.18 pasan');}catch(e){g(false,'pruebas v0.18 ejecutables');}
process.exit(f?1:0);
