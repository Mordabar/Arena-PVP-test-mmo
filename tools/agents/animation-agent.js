#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8'); const g=(ok,n,d)=>{console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;};
const act=read('js/render/anim/actions.js'), pl=read('js/data/powerLibrary.js'), ai=read('js/anim/animationIntent.js');
g(/_archerCastPose/.test(act)&&/_meleeCastPose/.test(act),'Archer/melee tienen pre-release propios');
g(/var CAST_MOD =/.test(act)&&['projectile','control','buff','heal','aoe','channel','instant'].every(k=>act.includes(k+':')),'Caster expone siete familias corporales de casteo');
g(/archerVolley|archerControl|archerQuick|archerPower/.test(act+pl),'Arquero expone draw/release por función');
g(/visualVariant/.test(pl)&&/actionVariant/.test(ai),'Variantes viajan por AnimationIntent, no por IDs en renderer');
g(/_kick/.test(act)&&/_shieldBash/.test(act)&&/_charge/.test(act),'Warrior conserva kick/shield/charge distintos');
try{const o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'Animation Reference Pass'],{encoding:'utf8'});g(/TODO OK/.test(o),'Animation Reference Pass completo en verde');}catch(e){g(false,'Animation Reference Pass ejecutable');}
process.exit(f?1:0);
