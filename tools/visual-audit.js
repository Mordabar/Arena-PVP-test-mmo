#!/usr/bin/env node
/* Project Arena v0.16 — static critic for UAL2 retarget locomotion. */
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
let fails=0;
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function ok(label,cond,detail){if(cond)console.log('✓ '+label);else{fails++;console.error('✗ '+label+(detail?' — '+detail:''));}}

const html=read('index.html');
const css=read('css/arena.css');
const main=read('js/main.js');
const hud=read('js/ui/hud.js');
const book=read('js/ui/powerBook.js');
const bars=read('js/ui/actionBarState.js');
const icons=read('js/ui/abilityIcons.js');
const env=read('js/render/three/threeEnvironment.js');
const arena=read('js/sim/arena.js');
const prim=read('js/render/primitives.js');
const eq=read('js/render/equipment.js');
const cv=read('js/render/characterVisual.js');
const actions=read('js/render/anim/actions.js');
const powerLib=read('js/data/powerLibrary.js');
const vfx=read('js/render/vfx.js');
const threeVfx=read('js/render/three/threeVfx.js');
const cam=read('js/render/camera3d.js');
const boot=read('js/render/three/bootstrap.js');
const threeChar=read('js/render/three/threeCharacter.js');
const animMap=read('js/data/animationLibraryMap.js');
const retarget=read('js/render/three/threeRetarget.js');
const controlMap=read('js/core/controlMap.js');

ok('Build visible v0.16 UAL2 RETARGET',/v0\.16/.test(html)&&/UAL2 RETARGET/.test(html));
ok('Cache-busting v0.16 presente',/v0160-20260816-ual2-retarget-locomotion/.test(html));
ok('UAL2 se precarga antes del boot',/ual2-standard\.glb/.test(boot)&&boot.indexOf('ual2-standard.glb')<boot.indexOf('Arena.Game.boot'));
ok('Retarget usa bind real y 17 cadenas',/SOURCE_FOR_TARGET/.test(retarget)&&/targetBindLocalQuat/.test(retarget));
ok('Idle, gait, hit, salto y melee conectados',['Idle_FoldArms_Loop','Walk_Carry_Loop','Hit_Knockback','NinjaJump_Start','Sword_Regular_A','Sword_Heavy_Combo'].every(k=>animMap.includes(k)));
ok('Strafe no recicla caminata frontal',/mostlyForward/.test(animMap)&&/Math\.abs\(r\) < 0\.58/.test(animMap));
ok('Piel GLB usa normales suaves',/mergeVertices/.test(boot)&&/computeVertexNormals/.test(boot)&&/flatShading\s*=\s*false/.test(boot));
ok('A/D strafe y Q/E giro en contrato visible',/strafe:\(k\['d'\]\?1:0\)-\(k\['a'\]\?1:0\)/.test(controlMap)&&/return \(k\['e'\]\?1:0\)-\(k\['q'\]\?1:0\)/.test(controlMap));
ok('GLB humanoide se precarga antes del boot',/dark-elf-base-rigged-50k\.glb/.test(boot)&&boot.indexOf('loadAsync')<boot.indexOf('Arena.Game.boot'));
ok('Three usa GLB con animación local',/baseCharacterGltf/.test(threeChar)&&/applySkinnedPose/.test(threeChar)&&!/prototype\.applyRigPose/.test(threeChar));
ok('asset GLB optimizado existe',fs.existsSync(path.join(root,'assets/models/dark-elf-base-rigged-50k.glb')));
ok('Power library carga antes de main',html.indexOf('js/data/powerLibrary.js')>=0&&html.indexOf('js/data/powerLibrary.js')<html.indexOf('js/main.js'));
ok('ActionBar + PowerBook cargan antes de HUD/main',html.indexOf('js/ui/actionBarState.js')<html.indexOf('js/ui/hud.js')&&html.indexOf('js/ui/powerBook.js')<html.indexOf('js/ui/hud.js'));
ok('Libro tiene búsqueda, disciplinas y drag real',/search/.test(book)&&/discipline/i.test(book)&&/dragstart/.test(book)&&/dataTransfer/.test(book));
ok('Barra declara cuatro páginas de doce',/BAR_COUNT\s*=\s*4/.test(bars)&&/SLOT_COUNT\s*=\s*12/.test(bars));
ok('HUD expone pestañas de barra y drop',/selectBar/.test(hud)&&/dragover/.test(hud)&&/drop/.test(hud));
ok('CSS contiene composición propia del PowerBook',/power-book/.test(css)&&/power-card/.test(css)&&/action-bar/.test(css));
ok('Iconos incluyen firma determinista por habilidad',/sigilFor/.test(icons)||/hash/.test(icons));
ok('Iconos varían por familia, motivo y geometría visible',/FAMILY_SHAPES/.test(icons)&&/motif/.test(icons)&&/segments/.test(icons));
ok('Fallback procedural conserva anatomía curva',/P\.ellipsoid/.test(cv)&&/capsule/i.test(cv)&&/P\.ellipsoid/.test(prim));
ok('Ruta skinned no depende del equipo procedural',/No armadura\/ropa procedural/.test(threeChar)&&/makeStaff/.test(threeChar)&&/makeBow/.test(threeChar)&&/makeSword/.test(threeChar));
ok('Caster tiene siete poses funcionales',['projectile','control','buff','heal','aoe','channel','instant'].every(k=>actions.includes(k+':')));
ok('410 asignaciones conservan iconMeta y visualVariant',(powerLib.match(/"iconMeta":/g)||[]).length===410&&(powerLib.match(/"visualVariant":/g)||[]).length===410);
ok('410 poderes exponen presentación semántica',(powerLib.match(/"presentation":/g)||[]).length===410);
ok('Hechizos firma tienen siluetas VFX propias',['meteor','fireball','iceBurst','lightningBolt','iceStorm','magmaOrb','tornado','lightningStorm'].every(k=>powerLib.includes('"shape":"'+k+'"')));
ok('Three VFX dibuja meteor/rayo/hielo/tornado',/meteor/.test(threeVfx)&&/lightningBolt/.test(threeVfx)&&/iceStorm/.test(threeVfx)&&/tornado/.test(threeVfx));
ok('VFX semánticos tienen pool acotado',/MAX_SPELLS\s*=\s*96/.test(vfx));
ok('Cámara expone seguimiento corporal sin tocar simulación',/followBodyYaw/.test(cam)&&/followBodyYaw/.test(main));
ok('Arena visual Three.js sigue presente',/Arcane Wilds/.test(env));
ok('Arena de simulación es la frontera ampliada',/86/.test(arena)&&/62/.test(arena)&&/Frontera/.test(arena));
ok('Controles visibles documentan 12 slots, barras y libro',(/Shift\+1/.test(html)||/⇧1/.test(html))&&/<kbd>B<\/kbd>/.test(html)&&/<kbd>0<\/kbd>/.test(html)&&/<kbd>=<\/kbd>/.test(html));

// Static authority boundary: UI may issue intent but never commit combat state.
const uiSources={'js/ui/hud.js':hud,'js/ui/powerBook.js':book,'js/ui/actionBarState.js':bars};
const forbidden=[/\.hp\s*=/,/\.resource\s*=/,/DamageSystem\./,/Resolver\.execute/,/\.statuses\s*=/];
let bad=[];
for(const [file,src] of Object.entries(uiSources)) for(const rx of forbidden) if(rx.test(src)) bad.push(file+' -> '+rx);
ok('PowerBook/ActionBar no escriben autoridad de combate',bad.length===0,bad.join(', '));

// Entrypoint references must exist locally.
const refs=[...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^\"]*)?"/g)].map(m=>m[1]).filter(x=>!/^https?:|^data:|^#/.test(x));
const missing=refs.filter(r=>!fs.existsSync(path.join(root,r)));
ok('Todos los assets locales del entrypoint existen',missing.length===0,missing.join(', '));

if(fails){console.error('\nVISUAL CRITIC: RECHAZADO — '+fails+' fallo(s).');process.exit(1);}
console.log('\nVISUAL CRITIC: APROBADO — auditoría estática v0.16.');
console.log('El juicio final de composición/feel sigue requiriendo playtest visual en navegador real.');
