#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8');const g=(ok,n,d)=>{console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;};
const v=read('js/render/vfx.js'), t=read('js/render/three/threeVfx.js'), p=read('js/data/powerLibrary.js');
g((p.match(/"presentation":/g)||[]).length===410,'410 asignaciones tienen presentación semántica');
g(/VFX\.spells|spells\s*=/.test(v)&&/96/.test(v),'pool semántico acotado, sin crecimiento ilimitado');
g(/meteor|fireball|magma|lightning|ice|tornado/i.test(t),'renderer Three.js diferencia forma y elemento');
g(/ProjectileHit/.test(v)&&/semanticProjectileImpact/.test(v),'impacto visual de proyectil nace del evento autoritativo');
g(!/\.hp\s*=|\.resource\s*=|DamageSystem\.|Resolver\.execute/.test(v+'\n'+t),'VFX no gana autoridad de combate');
process.exit(f?1:0);
