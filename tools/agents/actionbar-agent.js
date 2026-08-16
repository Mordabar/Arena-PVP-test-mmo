#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'); const R=path.join(__dirname,'../..');let f=0;
function g(ok,n){console.log((ok?'✓ ':'✗ ')+n);if(!ok)f++;}
const st=fs.readFileSync(path.join(R,'js/ui/actionBarState.js'),'utf8'), book=fs.readFileSync(path.join(R,'js/ui/powerBook.js'),'utf8'), hud=fs.readFileSync(path.join(R,'js/ui/hud.js'),'utf8'), main=fs.readFileSync(path.join(R,'js/main.js'),'utf8');
g(/BAR_COUNT = 4, SLOT_COUNT = 12/.test(st),'4 barras × 12 slots');
g(/draggable=true/.test(book)&&/application\/x-arena-ability/.test(book),'Libro arrastra poderes activos');
g(/flags&&ab\.flags\.passive/.test(book),'Pasivos visibles pero no arrastrables');
g(/selectBar/.test(hud)&&/togglePowerBook/.test(hud),'HUD expone cambio de barra y libro');
g(/Shift\+1\.\.4/.test(main)&&/'=':11/.test(main)&&/case 'b'/.test(main),'Teclas 12 slots + Shift 1..4 + B');
try{let o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'v0.10 · Barra 4×12'],{encoding:'utf8'});g(/TODO OK/.test(o),'Estado de barra y validaciones en verde');}catch(e){g(false,'Estado de barra y validaciones');}
process.exit(f?1:0);
