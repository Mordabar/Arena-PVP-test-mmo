#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');let bad=0;function g(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)bad++;}
const f=path.join(R,'assets/animations/arena-cmu-v031.json'),p=JSON.parse(fs.readFileSync(f,'utf8')),clips=p.clips||[];
console.log('CMU RUNTIME AUDIT v0.31');g(p.version==='0.31.0','payload version','0.31.0');g(clips.length===10,'only directional locomotion + kick retained','10');
let finite=true,norm=true,shape=true;for(const c of clips){for(const t of c.tracks||[]){if(!Array.isArray(t.times)||!Array.isArray(t.values)||t.values.length!==t.times.length*4)shape=false;for(const v of t.values)if(!Number.isFinite(v))finite=false;for(let i=0;i<t.values.length;i+=4){const n=Math.hypot(...t.values.slice(i,i+4));if(Math.abs(n-1)>.003)norm=false;}}}
g(shape,'quaternion track shape');g(finite,'all values finite');g(norm,'quaternions normalized');g(fs.statSync(f).size<350*1024,'CMU payload compact',(fs.statSync(f).size/1024).toFixed(1)+' KiB');
const names=new Set(clips.map(c=>c.name));['Arena_CMU_Walk_Backward','Arena_CMU_Strafe_Left','Arena_CMU_Strafe_Right','Arena_CMU_Diagonal_FL','Arena_CMU_Diagonal_FR','Arena_CMU_Diagonal_BL','Arena_CMU_Diagonal_BR','Arena_CMU_Turn_Left','Arena_CMU_Turn_Right','Arena_CMU_Kick'].forEach(n=>g(names.has(n),'runtime clip: '+n));
g(![...names].some(n=>/Caster|Archer|Swordplay/.test(n)),'retired caster/bow/swordplay CMU clips absent');let raw=[];(function w(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const x=path.join(d,e.name);e.isDirectory()?w(x):/\.fbx$/i.test(e.name)&&raw.push(x);}})(path.join(R,'assets'));g(raw.length===0,'no raw FBX inside project assets');
console.log(bad?'CMU_AUDIT_V031: RECHAZADO':'CMU_AUDIT_V031: APROBADO');process.exit(bad?1:0);
