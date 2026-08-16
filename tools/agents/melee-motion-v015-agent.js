#!/usr/bin/env node
'use strict';const cp=require('child_process'),path=require('path'),R=path.join(__dirname,'../..');try{let o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'Skinned Animation v0.15'],{cwd:R,encoding:'utf8'});process.stdout.write(o);process.exit(/melee normal alterna dirección/.test(o)&&/melee usa espada/.test(o)?0:1)}catch(e){process.exit(1)}
