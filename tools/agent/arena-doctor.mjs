#!/usr/bin/env node
// Read-only doctor. Run from Project Arena root. Node >=22.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const cwd=process.cwd(), problems=[], warnings=[];
const required=['index.html','js/main.js','js/render/three/bootstrap.js','js/render/animationStateMachine.js','js/render/three/threeDirectAnim.js'];
console.log('Project Arena agent doctor');console.log('Repositorio:',cwd,'Node:',process.version);
for(const f of required){if(fs.existsSync(path.join(cwd,f)))console.log('  [OK]',f);else{console.log('  [FAIL]',f);problems.push('Falta '+f);}}
const skills=path.join(cwd,'.claude','skills');
if(fs.existsSync(skills)){const ss=fs.readdirSync(skills).filter(x=>x.startsWith('arena-'));console.log('Skills Claude:',ss.length,ss.join(', '));}
else warnings.push('No veo .claude/skills');
const files=[];
function traverse(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory()){if(!['node_modules','.git','.claude','.agents','agent-qa'].includes(entry.name))traverse(full);}else if(entry.name.endsWith('.js')||entry.name.endsWith('.mjs'))files.push(full);}}
if(fs.existsSync(path.join(cwd,'js')))traverse(path.join(cwd,'js'));
console.log('JS del juego:',files.length);
let checked=0;
for(const file of files){let r=spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:15000}); if(r.status!==0){problems.push('JS sintaxis '+path.relative(cwd,file)+' '+(r.stderr||'').trim().slice(-300));}else checked++;}
console.log('JS check OK:',checked,'/',files.length);
const audit=path.join(cwd,'tools','audit-clips.mjs');
if(fs.existsSync(audit)){const result=spawnSync(process.execPath,[audit],{cwd,encoding:'utf8',timeout:30000});console.log('\nAuditor original:\n'+(result.stdout||'').trim());if(result.status!==0)problems.push('Auditor falló: '+(result.stderr||'').slice(-300));}
else warnings.push('No existe tools/audit-clips.mjs en esta versión');
console.log('\nAdvertencias:',warnings.length,'Errores:',problems.length);
for(const p of warnings)console.warn(' WARN',p);for(const p of problems)console.error(' FAIL',p);
console.log('Aviso: ¡NO acredita calidad de animación ni partidas jugables!');
process.exitCode=problems.length?1:0;
