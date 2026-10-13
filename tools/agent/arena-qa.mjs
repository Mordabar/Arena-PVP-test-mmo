#!/usr/bin/env node
// QA coordinator for original Project Arena scripts; no npm dependencies.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const cwd=process.cwd(),visual=process.argv.includes('--visual');let failures=0;
function run(relative,args=[],timeout=180000){const file=path.join(cwd,relative);if(!fs.existsSync(file)){console.warn('SKIP - '+relative+' no existe');return;}
 const r=spawnSync(process.execPath,[file,...args],{cwd,encoding:'utf8',timeout,maxBuffer:10*1024*1024,env:process.env});
 console.log('\n'+relative+' '+args.join(' ')+'\n'+(r.stdout||'').slice(-20000));if(r.stderr)console.error(r.stderr.slice(-6000));
 if(r.status!==0){console.error('ERROR',r.status??r.error?.message);failures++;} }
run('tools/agent/arena-doctor.mjs',[],90000);
if(visual){
  run('tools/inspect-canvas.mjs',['--state','combate'],180000);
  run('tools/anim-preview.mjs',['--class','devastador'],240000);
  run('tools/anim-preview.mjs',['--class','devastador','--set','direccional'],240000);
}
console.log('\nGate técnico:',failures?'NO APROBADO':'SIN FALLOS REGISTRADOS','| calidad visual NO CERTIFICADA por este script');
process.exitCode=failures?1:0;
