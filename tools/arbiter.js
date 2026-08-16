#!/usr/bin/env node
/* Project Arena v0.16 — adversarial arbiter: UAL2 retarget, controls, smooth skin, authority. */
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..'), read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
let fail=[];function gate(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)fail.push(n);}
function run(cmd,args,timeout=45000){return cp.spawnSync(cmd,args,{cwd:ROOT,encoding:'utf8',timeout});}
console.log('ARBITER · UAL2 Retarget Locomotion v0.16\n');

// 1. Historical product/combat contract must survive the animation replacement.
let r=run(process.execPath,[path.join(ROOT,'tools/run-tests.js')],60000),out=(r.stdout||'')+(r.stderr||'');let m=/TODO OK — (\d+) pruebas/.exec(out),n=m?+m[1]:0;
gate(r.status===0&&n>=383,'suite completa en verde ('+n+'; suelo 383)');

// 2. Source powers remain exact; animation work may not regress gameplay data.
r=run('python3',[path.join(ROOT,'tools/audit-power-parity.py'),path.join(ROOT,'reference/Regnum_Documento_Maestro_Poderes.docx'),'--runtime',path.join(ROOT,'js/data/powerLibrary.js'),'--resolver',path.join(ROOT,'js/combat/resolver.js')],45000);out=(r.stdout||'')+(r.stderr||'');
gate(r.status===0&&/GATES:\s*20\/20/.test(out),'paridad de poderes DOCX 20/20');

// 3. Audit the user-supplied animation binary independently from runtime mapping.
r=run('python3',[path.join(ROOT,'tools/audit-ual2-v016.py'),path.join(ROOT,'assets/animations/ual2-standard.glb')],35000);out=(r.stdout||'')+(r.stderr||'');
gate(r.status===0&&/GATES:\s*24\/24/.test(out)&&/UAL2 AUDIT:\s*APROBADO/.test(out),'UAL2 binaria 24/24');

const map=read('js/data/animationLibraryMap.js'), ret=read('js/render/three/threeRetarget.js'), tc=read('js/render/three/threeCharacter.js'), boot=read('js/render/three/bootstrap.js'), cm=read('js/core/controlMap.js'), main=read('js/main.js'), html=read('index.html'), ns=read('js/namespace.js'), contract=read('js/render/skinnedAnimationContract.js');

// 4. Controls: attack the exact regression reported by the player.
gate(/strafe:\(k\['d'\]\?1:0\)-\(k\['a'\]\?1:0\)/.test(cm),'A izquierda / D derecha = strafe');
gate(/return \(k\['e'\]\?1:0\)-\(k\['q'\]\?1:0\)/.test(cm),'Q izquierda / E derecha = giro');
gate(/ControlMap\.movement/.test(main)&&/ControlMap\.turn/.test(main),'main usa un único contrato de controles');
gate(/Strafe<\/b> <kbd>A<\/kbd> izquierda[\s\S]{0,60}<kbd>D<\/kbd> derecha/.test(html)&&/Girar<\/b> <kbd>Q<\/kbd><kbd>E<\/kbd>/.test(html),'HUD coincide con A/D strafe + Q/E giro');

// 5. Supplied clips must be connected, not merely copied into assets.
['Idle_FoldArms_Loop','Walk_Carry_Loop','Hit_Knockback','NinjaJump_Start','NinjaJump_Idle_Loop','NinjaJump_Land','Sword_Regular_A','Sword_Regular_B','Sword_Regular_C','Sword_Heavy_Combo','Sword_Block','Sword_Dash','Shield_OneShot'].forEach(c=>gate(map.includes(c),'clip conectado: '+c));
gate(/phase:0\.08\+t\*0\.84/.test(map),'bordes T-pose de acciones se recortan');
gate(/Math\.abs\(r\) < 0\.58/.test(map)&&/mostlyForward/.test(map),'strafe puro no reutiliza caminata frontal');
gate(/hitReaction:true/.test(map)&&/mask:'upperBody'/.test(map),'recoil de impacto es upper-body y no congela piernas');

// 6. Retarget: bind-space del Dark Elf, no el old mannequin; source root never owns gameplay.
const srcMap=(/const SOURCE_FOR_TARGET = \{([\s\S]*?)\};/.exec(ret)||[])[1]||'';
gate((srcMap.match(/:/g)||[]).length===17,'17 huesos objetivo mapeados');
gate(/sourceBind/.test(ret)&&/targetBindWorld/.test(ret)&&/targetBindLocalQuat/.test(ret),'retarget usa delta de bind fuente→bind Dark Elf');
gate(/getWorldQuaternion/.test(ret)&&/slerp/.test(ret),'rotaciones se retargetean y mezclan');
gate(!/entity\.pos|entity\.yaw|\.hp\s*=|\.resource\s*=|gcdUntil\s*=/.test(ret),'retarget no escribe simulación');
gate(/this\.root\.position\.set\(pos\.x, pos\.y, pos\.z\)/.test(tc)&&/this\.root\.rotation\.set\(a\.rootPitch, yaw, a\.rootRoll\)/.test(tc),'posición/yaw siguen llegando de simulación');

// 7. Skin surface: specific regression from visible faceting.
gate(/mergeVertices/.test(boot)&&/deleteAttribute\('normal'\)/.test(boot)&&/computeVertexNormals/.test(boot)&&/normalizeNormals/.test(boot),'normales de piel se recalculan suaves');
gate(/flatShading\s*=\s*false/.test(boot)&&/normalScale\.set\(0\.42,0\.42\)/.test(boot),'material evita facetado exagerado');

// 8. Layering and body-only route.
gate(/skipLocomotion:\s*externalLocomotion/.test(tc)&&/skipMeleeAction:\s*fullExternal/.test(tc),'sin doble locomoción/melee');
gate(/casterCast/.test(contract)&&/archerShot/.test(contract)&&/meleeAction/.test(contract),'lenguaje caster/archer/melee permanece diferenciado');
let branch=tc.slice(tc.indexOf('if (this.usedGlb) {',tc.indexOf('prototype.applyPose')),tc.indexOf('Backend.current.buildPose',tc.indexOf('prototype.applyPose')));
gate(/return;/.test(branch)&&!/buildPose/.test(branch),'ruta GLB = cuerpo + arma, sin armadura procedural');

// 9. Model still valid after animation integration.
const model=path.join(ROOT,'assets/models/dark-elf-base-rigged-50k.glb');r=run('python3',[path.join(ROOT,'tools/model_pipeline/validate_dark_elf_glb.py'),model],35000);out=(r.stdout||'')+(r.stderr||'');
gate(r.status===0&&/"triangles"\s*:\s*50000/.test(out),'Dark Elf conserva 50.000 tris + rig');
r=run('python3',[path.join(ROOT,'tools/model_pipeline/audit_skinning.py'),model],35000);gate(r.status===0,'skinning base sigue funcional');

// 10. Boot/cache/deployment seal.
gate(/Promise\.all/.test(boot)&&/ual2-standard\.glb/.test(boot)&&boot.indexOf('loadAsync')<boot.indexOf('Arena.Game.boot'),'modelo + animaciones precargan antes de boot');
gate(/Arena\.VERSION = '0\.16\.0'/.test(ns)&&/ual2-retarget-locomotion-v016/.test(ns),'runtime declara v0.16');
const seals=html.match(/\?build=v0160-20260816-ual2-retarget-locomotion/g)||[];gate(seals.length>=40,'cache-busting v0.16 ('+seals.length+' scripts)');
gate(/v0\.16 · UAL2 RETARGET · SMOOTH SKIN · A\/D STRAFE · Q\/E TURN/.test(html),'cabecera visible identifica build correcto');
gate(fs.existsSync(path.join(ROOT,'assets/animations/UAL2_LICENSE.txt'))&&/CC0/i.test(read('assets/animations/UAL2_LICENSE.txt')),'licencia del paquete viaja en entrega');

console.log('\n-----------------------------------------------');
if(fail.length){console.log('ARBITER: RECHAZADO · '+fail.length+' gate(s)');fail.forEach(x=>console.log('  - '+x));process.exit(1);}
console.log('ARBITER: APROBADO');
console.log('v0.16 bloquea regresiones de controles, root-motion, retarget, facetado y doble animación.');
