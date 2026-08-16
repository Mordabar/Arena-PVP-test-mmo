#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'../..');let f=0;
function g(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;}
const asset=path.join(R,'assets/animations/ual2-standard.glb'),lic=path.join(R,'assets/animations/UAL2_LICENSE.txt');
g(fs.existsSync(asset)&&fs.statSync(asset).size>7e6,'UAL2 Standard local incluida');
g(fs.existsSync(lic)&&/CC0/i.test(fs.readFileSync(lic,'utf8')),'licencia CC0 incluida junto al asset');
const a=cp.spawnSync('python3',[path.join(R,'tools/audit-ual2-v016.py'),asset],{cwd:R,encoding:'utf8',timeout:30000});g(a.status===0&&/GATES:\s*24\/24/.test(a.stdout||''),'auditor binario UAL2 24/24');
process.exit(f?1:0);
