#!/usr/bin/env node
'use strict'; const cp=require('child_process'),path=require('path'); const R=path.join(__dirname,'../..');
try{const o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'v0.10 · Casteo plantado'],{encoding:'utf8'});process.stdout.write(o);process.exit(/TODO OK/.test(o)?0:1);}catch(e){process.stderr.write((e.stdout||'')+(e.stderr||''));process.exit(1);}
