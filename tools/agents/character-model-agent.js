#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8'); const g=(ok,n,d)=>{console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;};
const boot=read('js/render/three/bootstrap.js'), tc=read('js/render/three/threeCharacter.js'), cv=read('js/render/characterVisual.js');
g(fs.existsSync(path.join(R,'assets/models/dark-elf-base-rigged-50k.glb')),'GLB base rigged existe');
g(/loadAsync\('\.\/assets\/models\/dark-elf-base-rigged-50k\.glb/.test(boot),'GLB se precarga antes del boot');
g(/if \(this\.usedGlb\) \{[\s\S]*?return;/.test(tc),'ruta GLB termina antes del cuerpo procedural');
g(!/prototype\.applyRigPose/.test(tc)&&/cloneSkinnedScene/.test(tc)&&/rigBindQuat/.test(tc),'skeleton independiente animado en bind local');
g(/rig\.Hips/.test(cv)&&/rig\.LeftUpperArm/.test(cv)&&/rig\.RightFoot/.test(cv),'CharacterVisual expone pivotes humanoides');
for(const [label,script] of [['modelo','validate_dark_elf_glb.py'],['skinning','audit_skinning.py']]){try{const o=cp.execFileSync('python3',[path.join(R,'tools/model_pipeline',script),path.join(R,'assets/models/dark-elf-base-rigged-50k.glb')],{encoding:'utf8'});g(/"PASS"\s*:\s*true/.test(o),label+' adversarial en verde');}catch(e){g(false,label+' adversarial ejecutable');}}
process.exit(f?1:0);
