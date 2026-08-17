#!/usr/bin/env node
/* Project Arena v0.18 — árbitro adversarial: retargeting humanoide, horneado,
 * controles, autoridad y honestidad sobre lo que el paquete de clips NO trae. */
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..'), read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
let fail=[];function gate(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)fail.push(n);}
function run(cmd,args,timeout=45000){return cp.spawnSync(cmd,args,{cwd:ROOT,encoding:'utf8',timeout});}
console.log('ARBITER · Humanoid Retarget Rebuild v0.18\n');

// 1. Historical product/combat contract must survive the animation replacement.
let r=run(process.execPath,[path.join(ROOT,'tools/run-tests.js')],60000),out=(r.stdout||'')+(r.stderr||'');let m=/TODO OK — (\d+) pruebas/.exec(out),n=m?+m[1]:0;
gate(r.status===0&&n>=402,'suite completa en verde ('+n+'; suelo 402)');

// 2. Source powers remain exact; animation work may not regress gameplay data.
r=run('python3',[path.join(ROOT,'tools/audit-power-parity.py'),path.join(ROOT,'reference/Regnum_Documento_Maestro_Poderes.docx'),'--runtime',path.join(ROOT,'js/data/powerLibrary.js'),'--resolver',path.join(ROOT,'js/combat/resolver.js')],45000);out=(r.stdout||'')+(r.stderr||'');
gate(r.status===0&&/GATES:\s*20\/20/.test(out),'paridad de poderes DOCX 20/20');

// 3. Audit the user-supplied animation binary independently from runtime mapping.
r=run('python3',[path.join(ROOT,'tools/audit-ual2-v016.py'),path.join(ROOT,'assets/animations/ual2-standard.glb')],35000);out=(r.stdout||'')+(r.stderr||'');
gate(r.status===0&&/GATES:\s*24\/24/.test(out)&&/UAL2 AUDIT:\s*APROBADO/.test(out),'UAL2 binaria 24/24');

const map=read('js/render/animationStateMachine.js'), ret=read('js/render/humanoidRetarget.js'), bake=read('js/render/three/threeAnimBake.js'), cal=read('js/data/rigCalibration.js'), tc=read('js/render/three/threeCharacter.js'), boot=read('js/render/three/bootstrap.js'), cm=read('js/core/controlMap.js'), main=read('js/main.js'), html=read('index.html'), ns=read('js/namespace.js'), contract=read('js/render/skinnedAnimationContract.js');

// 4. Controls: attack the exact regression reported by the player.
gate(/strafe:\(k\['d'\]\?1:0\)-\(k\['a'\]\?1:0\)/.test(cm),'A izquierda / D derecha = strafe');
gate(/return \(k\['e'\]\?1:0\)-\(k\['q'\]\?1:0\)/.test(cm),'Q izquierda / E derecha = giro');
gate(/ControlMap\.movement/.test(main)&&/ControlMap\.turn/.test(main),'main usa un único contrato de controles');
gate(/Strafe<\/b> <kbd>A<\/kbd> izquierda[\s\S]{0,60}<kbd>D<\/kbd> derecha/.test(html)&&/Girar<\/b> <kbd>Q<\/kbd><kbd>E<\/kbd>/.test(html),'HUD coincide con A/D strafe + Q/E giro');

// 5. Los clips que SÍ existen están conectados, y los que NO existen se declaran.
['Idle_No_Loop','Walk_Carry_Loop','Zombie_Walk_Fwd_Loop','Hit_Knockback','LayToIdle','NinjaJump_Start','NinjaJump_Idle_Loop','NinjaJump_Land','Sword_Regular_A','Sword_Regular_B','Sword_Regular_C','Sword_Heavy_Combo','Sword_Block','Sword_Dash','Shield_OneShot'].forEach(c=>gate(map.includes(c),'clip conectado: '+c));
gate(!/Idle_FoldArms_Loop/.test(map),'el idle de brazos cruzados, que peleaba con las guardias, está retirado');
/* Lo importante de la v0.18 no es lo que conecta: es lo que se NIEGA a fingir.
   Un strafe fabricado girando el andar, o un retroceso reproducido al revés,
   pasarían cualquier lista de clips conectados y se verían mal igual. */
gate(/STRAFE:\s*\{\s*clip:null/.test(map),'STRAFE declarado SIN clip: no se gira el andar 90°');
gate(/BACKPEDAL:\s*\{\s*clip:null/.test(map),'BACKPEDAL declarado SIN clip: no se invierte el tiempo (moonwalk)');
gate(/TURN:\s*\{\s*clip:null/.test(map),'TURN declarado SIN clip');
gate(/SIN_CLIP\s*=\s*\['cast', 'pulse', 'ranged'\]/.test(map),'casteo y arco declarados SIN clip');
gate(!/phase\s*=\s*\(1-phase\)/.test(map),'la inversión de fase de la v0.16 ya no existe');
gate(/mask:'upper'/.test(map)&&/HIT:/.test(map),'el impacto es de tronco y no congela las piernas');

// 6. Retargeting: base conjugada, mapa por lado FÍSICO, horneado equivalente.
gate(!fs.existsSync(path.join(ROOT,'js/render/three/threeRetarget.js')),'el retarget por delta de la v0.16 fue retirado');
gate(/TARGET_BONES/.test(ret)&&(ret.match(/'(Hips|Spine|Chest|Neck|Head|Left\w+|Right\w+)'/g)||[]).length>=17,'17 huesos objetivo declarados');
/* El defecto raíz de la v0.16/v0.17: los huesos `Left*` del Elfo están en x<0,
   que es el lado DERECHO del personaje. Mapear por nombre metía el brazo
   izquierdo de la fuente en el derecho del modelo, sin reflejarlo. Aquí se
   exige que el mapa se DERIVE midiendo, no que alguien haya corregido la tabla. */
gate(/\(xs < 0\) !== \(xt < 0\)/.test(ret),'el mapa fuente→destino se deriva del LADO FÍSICO medido');
gate(/buildBasis/.test(ret)&&/qMul\(CsL, qInv\(CtL\)\)/.test(ret),'corrección de base (Rs⁻¹Cs)(Rt⁻¹Ct)⁻¹');
gate(/qMul\(q, basis\[b\]\)/.test(ret),'método absoluto At = As·B');
gate(/targetRestLocal/.test(ret)&&/nunca a T-pose|no a T-pose|reposo/.test(ret),'un hueso sin clip cae a su reposo, no a T-pose');
gate(!/entity\.pos|entity\.yaw|\.hp\s*=|\.resource\s*=|gcdUntil\s*=/.test(ret),'la matemática no puede escribir simulación');
gate(/QuaternionKeyframeTrack/.test(bake)&&/AnimationMixer/.test(bake)&&/crossFadeFrom/.test(bake),'clips horneados nativos con crossfade real');
gate(/hips\[k\*3\] = restHipsPos\[0\]/.test(bake),'la cadera horneada sólo mueve Y');
gate(/rootSpeed/.test(cal)&&/"rootSpeed": 0.65/.test(cal),'la zancada medida del ciclo de marcha viaja en la calibración');
gate(/this\.root\.position\.set\(pos\.x, pos\.y, pos\.z\)/.test(tc)&&/this\.root\.rotation\.set\(a\.rootPitch, yaw, a\.rootRoll\)/.test(tc),'posición/yaw siguen llegando de simulación');

// 7. Skin surface: specific regression from visible faceting.
gate(/mergeVertices/.test(boot)&&/deleteAttribute\('normal'\)/.test(boot)&&/computeVertexNormals/.test(boot)&&/normalizeNormals/.test(boot),'normales de piel se recalculan suaves');
gate(/flatShading\s*=\s*false/.test(boot)&&/normalScale\.set\(0\.42,0\.42\)/.test(boot),'material evita facetado exagerado');

// 8. Layering and body-only route.
gate(/skipLocomotion: mandaPiernas/.test(tc)&&/skipMeleeAction: mandaTodo/.test(tc),'sin doble locomoción/melee');
gate(/casterCast/.test(contract)&&/archerShot/.test(contract)&&/meleeAction/.test(contract),'lenguaje caster/archer/melee permanece diferenciado');
let branch=tc.slice(tc.indexOf('if (this.usedGlb) {',tc.indexOf('prototype.applyPose')),tc.indexOf('Backend.current.buildPose',tc.indexOf('prototype.applyPose')));
/* v0.17 invierte este gate. Hasta v0.16 exigía que la ruta GLB fuese «cuerpo +
   arma» y eso es exactamente lo que dejó a las seis clases en ropa interior: un
   gate defendiendo un defecto. Ahora exige lo contrario — que el equipo de clase
   se cuelgue de los huesos — y que el maniquí procedural siga apagado. */
gate(/return;/.test(branch)&&!/buildPose/.test(branch),'la ruta GLB no reconstruye el maniquí procedural');
gate(/buildGear/.test(tc)&&/GEAR_SOCKET/.test(tc)&&/GEAR_ANCHOR/.test(tc)&&/GEAR_FIT/.test(tc),
  'el equipo de clase se cuelga de los huesos del modelo');
gate(!/classId\s*===/.test(tc),'el renderer no ramifica por identificador de clase');

// 9. Model still valid after animation integration.
const model=path.join(ROOT,'assets/models/dark-elf-base-rigged-50k.glb');r=run('python3',[path.join(ROOT,'tools/model_pipeline/validate_dark_elf_glb.py'),model],35000);out=(r.stdout||'')+(r.stderr||'');
gate(r.status===0&&/"triangles"\s*:\s*50000/.test(out),'Dark Elf conserva 50.000 tris + rig');
r=run('python3',[path.join(ROOT,'tools/model_pipeline/audit_skinning.py'),model],35000);gate(r.status===0,'skinning base sigue funcional');

// 10. Boot/cache/deployment seal.
gate(/Promise\.all/.test(boot)&&/ual2-standard\.glb/.test(boot)&&boot.indexOf('loadAsync')<boot.indexOf('Arena.Game.boot'),'modelo + animaciones precargan antes de boot');
gate(/Arena\.VERSION = '0\.18\.0'/.test(ns)&&/humanoid-retarget-rebuild-v018/.test(ns),'runtime declara v0.18');
const seals=html.match(/\?build=v0180-20260817-humanoid-retarget/g)||[];gate(seals.length>=40,'cache-busting v0.18 ('+seals.length+' scripts)');
gate(/v0\.18 · HUMANOID RETARGET REBUILD/.test(html),'cabecera visible identifica build correcto');
gate(fs.existsSync(path.join(ROOT,'assets/animations/UAL2_LICENSE.txt'))&&/CC0/i.test(read('assets/animations/UAL2_LICENSE.txt')),'licencia del paquete viaja en entrega');

console.log('\n-----------------------------------------------');
if(fail.length){console.log('ARBITER: RECHAZADO · '+fail.length+' gate(s)');fail.forEach(x=>console.log('  - '+x));process.exit(1);}
console.log('ARBITER: APROBADO');
console.log('v0.18 bloquea el espejo de lateralidad, el retarget por delta que dejaba los\n' +
  'brazos a 72° de la animación, el moonwalk de invertir la fase, el strafe fingido\n' +
  'girando el andar, la doble animación y cualquier root motion que mueva la entidad.');
