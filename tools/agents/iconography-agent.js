#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8'); const g=(ok,n,d)=>{console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;};
const ic=read('js/ui/abilityIcons.js'), pl=read('js/data/powerLibrary.js');
g(/FAMILY_SHAPES/.test(ic)&&/motif/i.test(ic),'IconFactory combina familia funcional + motivo');
g(/rotation/.test(ic)&&/segments/.test(ic)&&/mirror/.test(ic),'Firma altera geometría visible, no sólo metadata');
g((pl.match(/"iconMeta":/g)||[]).length===410,'Las 410 asignaciones declaran iconMeta');
g((new Set([...pl.matchAll(/"signature":"([^"]+)"/g)].map(m=>m[1]))).size===410,'410 firmas de icono son globalmente únicas');
try{const o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'Iconografía'],{encoding:'utf8'});g(/TODO OK/.test(o),'Suite de iconografía en verde');}catch(e){g(false,'Suite iconográfica ejecutable');}
process.exit(f?1:0);
