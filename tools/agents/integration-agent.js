#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'../..');let f=0;
function g(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;}
function walk(dir,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.name.endsWith('.js'))out.push(p);}return out;}
let bad=[];for(const file of walk(path.join(R,'js')).concat(walk(path.join(R,'tools')))){let r=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)bad.push(path.relative(R,file));}g(bad.length===0,'Sintaxis JS completa',bad.join(', '));
try{let o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js')],{encoding:'utf8'}),m=/TODO OK — (\d+) pruebas/.exec(o);g(m&&+m[1]>=383,'Suite completa en verde',m?m[1]+' pruebas':'sin total');}catch(e){g(false,'Suite completa ejecutable');}
try{let o=cp.execFileSync(process.execPath,[path.join(R,'tools/silhouette-report.js')],{encoding:'utf8'});g(/peor pareja/i.test(o),'Identidad visual sigue medible');}catch(e){g(false,'Silhouette report');}
process.exit(f?1:0);
