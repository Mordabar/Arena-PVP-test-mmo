#!/usr/bin/env node
/* Contrato de retargeting v0.18: base conjugada, mapa por lado físico, horneado. */
'use strict';
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8');
const g=(x,n)=>{console.log((x?'✓ ':'✗ ')+n);if(!x)f++;};
const m=read('js/render/humanoidRetarget.js'), b=read('js/render/three/threeAnimBake.js');
g(!fs.existsSync(path.join(R,'js/render/three/threeRetarget.js')),'el retarget por delta de la v0.16 ya no existe');
g(/buildBasis/.test(m)&&/qMul\(CsL, qInv\(CtL\)\)/.test(m),'la corrección de base es (Rs⁻¹Cs)(Rt⁻¹Ct)⁻¹');
g(/qMul\(q, basis\[b\]\)/.test(m),'se aplica el método ABSOLUTO At = As·B');
g(/\(xs < 0\) !== \(xt < 0\)/.test(m),'el mapa descarta el lado contrario MIDIENDO x, no leyendo nombres');
g(!/upperarm_l['"]?\s*:/.test(m.slice(m.indexOf('ROLE_SOURCE'))) || /ROLE_SOURCE/.test(m),'los nombres sólo declaran papel');
g(/AXIS_RULE/.test(m)&&/world/.test(m),'los huesos hoja declaran de dónde sale su eje');
g(/targetRestLocal/.test(m)&&/out\[b\] = rl\.slice\(\)/.test(m),'un hueso sin clip cae a su reposo, no a T-pose');
g(/hipsOffsetY/.test(m)&&/-0\.40/.test(m),'la traslación de cadera está acotada');
g(/times\[k\] = t/.test(b)&&/llaves ORIGINALES/.test(b),'se hornea en las llaves originales, sin remuestreo');
g(/QuaternionKeyframeTrack/.test(b)&&/AnimationMixer/.test(b),'la salida son AnimationClip nativos con mixer');
['js/render/humanoidRetarget.js','js/render/animationStateMachine.js','js/render/three/threeAnimBake.js'].forEach(x=>{
  const s=read(x);
  g(!/\.hp\s*=|\.resource\s*=|gcdUntil\s*=|entity\.pos\.[xyz]\s*=|entity\.yaw\s*=|cooldowns\s*\[/.test(s),x+' no escribe autoridad');
});
g(!/hips\[k\*3\]\s*=\s*[^r]/.test(b)||/restHipsPos\[0\]/.test(b),'la cadera sólo mueve Y: X y Z siguen siendo de la simulación');
process.exit(f?1:0);
