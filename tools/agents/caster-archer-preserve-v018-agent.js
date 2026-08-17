#!/usr/bin/env node
/* Cuatro de las seis clases NO tienen clips en UAL2. Su lenguaje propio no puede perderse. */
'use strict';
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8');
const g=(x,n)=>{console.log((x?'✓ ':'✗ ')+n);if(!x)f++;};
const c=read('js/render/skinnedAnimationContract.js'), t=read('js/render/three/threeCharacter.js'), s=read('js/render/animationStateMachine.js');
g(/casterCast/.test(c)&&/casterNormal/.test(c),'el caster conserva casteo y pulso propios');
g(/archerShot/.test(c)&&/archerPreCast/.test(c),'el arquero conserva tensar y soltar propios');
g(/SIN_CLIP\s*=\s*\['cast', 'pulse', 'ranged'\]/.test(s),'casteo y arco declarados SIN clip, no disimulados');
g(/mask:'lower'/.test(s),'la locomoción horneada no roba los brazos');
g(/skipGuard: mandaTodo/.test(t),'la guardia de arma sólo se apaga con clip de cuerpo entero');
g(/skipCasterAction: mandaTodo/.test(t)&&/skipArcherAction: mandaTodo/.test(t),'sin doble animación en caster/arquero');
g(/archetype === 'melee'/.test(s),'los clips de espada no se le dan a quien no lleva espada');
process.exit(f?1:0);
