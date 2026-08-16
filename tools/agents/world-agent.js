#!/usr/bin/env node
'use strict';
const cp=require('child_process'),path=require('path');const R=path.join(__dirname,'../..');let f=0;
function g(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;}
try{let o=cp.execFileSync(process.execPath,[path.join(R,'tools/arena-analysis.js')],{encoding:'utf8'});let d=/ARENA (\d+) × (\d+)/.exec(o), cov=/cobertura a ≤ 4 u ....... ([\d.]+) %/.exec(o), los=/pares con LoS ...................... ([\d.]+) %/.exec(o);g(d&&+d[1]>=80&&+d[2]>=56,'Mapa ampliado',d?d[1]+'×'+d[2]:'sin métrica');g(cov&&+cov[1]>=60,'Cobertura útil',cov?cov[1]+'%':'');g(los&&+los[1]>=33&&+los[1]<=60,'LoS ni explanada ni laberinto',los?los[1]+'%':'');}catch(e){g(false,'Arena analysis ejecutable');}
try{let o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'Arena ·'],{encoding:'utf8'});g(/TODO OK/.test(o),'17 contratos de arena en verde');}catch(e){g(false,'Contratos de arena');}
process.exit(f?1:0);
