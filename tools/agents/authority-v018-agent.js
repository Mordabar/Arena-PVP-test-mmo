#!/usr/bin/env node
/* La frontera de autoridad. Ningún fichero de presentación puede decidir combate,
 * y el root motion de UAL2 no puede mover la entidad. */
'use strict';
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '../..');
let f = 0;
const read = x => fs.readFileSync(path.join(R, x), 'utf8');
const g = (x, n) => { console.log((x ? '✓ ' : '✗ ') + n); if (!x) f++; };

const files = ['js/render/humanoidRetarget.js', 'js/render/animationStateMachine.js',
  'js/render/three/threeAnimBake.js', 'js/render/three/threeCharacter.js',
  'js/render/skinnedAnimationContract.js'];
for (const file of files) {
  const s = read(file);
  g(!/\.hp\s*=|\.resource\s*=|gcdUntil\s*=|cooldowns\s*\[.*\]\s*=|entity\.pos\.[xyz]\s*=|entity\.yaw\s*=/.test(s),
    file + ' no escribe autoridad');
}
const b = read('js/render/three/threeAnimBake.js');
g(!/\broot\.position\s*=|\broot\.rotation\s*=/.test(b), 'el horneado no mueve la raíz del personaje');
g(/hips\[k\*3\] = restHipsPos\[0\]/.test(b) && /hips\[k\*3\+2\] = restHipsPos\[2\]/.test(b),
  'la pista de cadera deja X y Z en su reposo: sólo vive la Y');
g(/DESCARTA/.test(b) || /se DESCARTA/.test(b), 'el fichero declara por escrito que descarta el root motion');
const sm = read('js/render/animationStateMachine.js');
g(!/RELEASE\s*=|emit\(/.test(sm), 'la máquina de estados no emite eventos de combate');
g(/la simulación es quien lleva el reloj|La simulación es quien dice/i.test(read('js/render/three/threeAnimBake.js') + sm),
  'queda escrito que el reloj del combate es de la simulación');
process.exit(f ? 1 : 0);
