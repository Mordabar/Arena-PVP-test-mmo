#!/usr/bin/env node
'use strict';
const cp=require('child_process'),path=require('path');const R=path.join(__dirname,'..');
const agents=[
 ['UAL2 ASSET / LICENSE','ual2-asset-v016-agent.js'],
 ['RETARGET CONTRACT v0.18','retarget-v018-agent.js'],
 ['LOCOMOTION / IDLE / HIT','locomotion-v018-agent.js'],
 ['CONTROL MAP A/D Q/E','control-map-v016-agent.js'],
 ['SMOOTH SKIN','smooth-skin-v016-agent.js'],
 ['MELEE UAL2','melee-ual2-v018-agent.js'],
 ['CASTER + ARCHER PRESERVATION','caster-archer-preserve-v018-agent.js'],
 ['SIMULATION AUTHORITY','authority-v018-agent.js'],
 ['BODY + WEAPON CLEANUP','body-weapon-cleanup-agent.js'],
 ['RIG LOCAL BASIS','rig-basis-agent.js'],
 ['INTEGRATION / QA','integration-agent.js'],
 ['FRESH REVIEWER','fresh-reviewer-agent.js']
];let bad=0;
console.log('PROJECT ARENA v0.18 · HUMANOID RETARGET REBUILD · SPECIALIZED AUDIT FAN-OUT\n');
for(const [name,file] of agents){console.log('\n══ '+name+' ══');const r=cp.spawnSync(process.execPath,[path.join(R,'tools/agents',file)],{cwd:R,encoding:'utf8',timeout:60000});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0){bad++;console.log('→ RECHAZADO');}else console.log('→ APROBADO');}
console.log('\n'+(bad?'AGENTS: RECHAZADO · '+bad+' auditor(es)':'AGENTS: APROBADO · '+agents.length+'/'+agents.length));process.exit(bad?1:0);
