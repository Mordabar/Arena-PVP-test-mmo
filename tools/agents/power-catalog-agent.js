#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const R=path.join(__dirname,'../..');let f=0;const read=x=>fs.readFileSync(path.join(R,x),'utf8');
function g(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;}
const report=JSON.parse(read('docs/POWER_LIBRARY_REPORT_V013.json')),lib=read('js/data/powerLibrary.js');
g(report.source_entries===320,'Fuente completa: 320 registros');
g(report.valid_named_powers===290&&report.excluded_placeholders===30,'290 poderes reales + 30 placeholders excluidos');
g(report.class_assignments===410,'410 asignaciones a subclases');
g(JSON.stringify(report.class_counts)===JSON.stringify({devastador:65,guardian:65,centinela:65,rastreador:65,arcanista:75,vinculador:75}),'Cobertura 65/65/65/65/75/75');
g((lib.match(/"sourceDerived":true/g)||[]).length>=410,'Toda asignación jugable deriva de la fuente');
g(!/"damageModel":"fixed-pure"/.test(lib)&&/"damageModel":"source-rank5-exact"/.test(lib),'Sin rebalanceo Arena en poderes fuente');
g(/"name":"Meteorito del Vacío"/.test(lib)&&/"name":"Carga de Guerra"/.test(lib),'Nombres fuente + variación sistemática');
try{const o=cp.execFileSync('python3',[path.join(R,'tools/audit-power-parity.py'),path.join(R,'reference/Regnum_Documento_Maestro_Poderes.docx'),'--runtime',path.join(R,'js/data/powerLibrary.js'),'--resolver',path.join(R,'js/combat/resolver.js')],{encoding:'utf8'});g(/GATES:\s*20\/20/.test(o)&&/ARBITER: APROBADO/.test(o),'Auditor independiente del DOCX 20/20');}catch(e){g(false,'Auditor independiente del DOCX',e.message.split('\n')[0]);}
process.exit(f?1:0);
