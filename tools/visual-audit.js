/* Project Arena v0.8 — adversarial static audit for Ladder + Three.js presentation. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let fails = 0;
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function ok(label, cond, detail){
  if (cond) console.log('✓ ' + label);
  else { fails++; console.error('✗ ' + label + (detail ? ' — ' + detail : '')); }
}

const html = read('index-three.html');
const css = read('css/arena.css');
const main = read('js/main.js');
const env = read('js/render/three/threeEnvironment.js');
const threeChar = read('js/render/three/threeCharacter.js');
const threeVfx = read('js/render/three/threeVfx.js');
const gameShell = read('js/ui/gameShell.js');
const ladder = read('js/product/ladder.js');
const matchFlow = read('js/product/matchFlow.js');
const audio = read('js/audio/audio.js');

ok('Build visible Ladder Vertical Slice v0.8', /Ladder Vertical Slice · v0\.8/.test(html));
ok('CSS cache-busted v0.8', /arena\.css\?build=v080-20260813-1006/.test(html));
ok('Three bootstrap cache-busted v0.8', /bootstrap\.js\?build=v080-20260813-1006/.test(html));
ok('Three theme enabled', /body class="three-theme"/.test(html));
ok('Product modules load before main', html.indexOf('js/product/ladder.js') < html.indexOf('js/main.js') && html.indexOf('js/ui/gameShell.js') < html.indexOf('js/main.js'));

ok('Camera MMO baseline remains tightened', /cam\.targetDistance = 7\.8/.test(main));
ok('A/D remain strafe, not turn', /var s = \(k\['d'\] \? 1 : 0\) - \(k\['a'\] \? 1 : 0\)/.test(main));
ok('Mouse steering remains 1:1 path', /_mouseTurnDelta/.test(main) && /angleDelta\(yawBefore, self\.renderer\.camera\.yaw\)/.test(main));

ok('Arcane Wilds environment present', /"Arcane Wilds"/.test(env));
ok('Terrain texture procedural', /function terrainTexture\(/.test(env));
ok('Instanced vegetation present', /new THREE\.InstancedMesh/.test(env));
ok('Fog and directional sun present', /new THREE\.Fog/.test(env) && /new THREE\.DirectionalLight/.test(env));
ok('Ruins + exterior forest compose perimeter', /ruinGate\(/.test(env) && /Bosque exterior/.test(env));

ok('Character materials separate skin/cloth/metal', /SKIN/.test(threeChar) && /CLOTH/.test(threeChar) && /METAL/.test(threeChar));
ok('Caster local magic light', /PointLight/.test(threeChar));
ok('Three VFX supports projectile trails', /createProjectileRenderer/.test(threeVfx) && /trail/.test(threeVfx));

ok('Lobby shell exists and is responsive product UI', /\.arena-shell/.test(css) && /\.arena-lobby/.test(css) && /@media/.test(css));
ok('Lobby exposes all six class ids', ['devastador','guardian','centinela','rastreador','arcanista','vinculador'].every(id => gameShell.includes("'"+id+"'")));
ok('Match chrome + countdown + team panels exist', /countdown-overlay/.test(gameShell) && /team-panel/.test(gameShell) && /match-header/.test(gameShell));
ok('Product shell avoids rebuilding structural DOM every frame', /this\._view !== 'LOBBY'/.test(gameShell) && /this\._view !== 'RESULTS'/.test(gameShell) && /this\._view !== 'MATCH'/.test(gameShell));
ok('Results expose victory/defeat/draw + rematch', /VICTORIA/.test(gameShell) && /DERROTA/.test(gameShell) && /EMPATE/.test(gameShell) && /REVANCHA/.test(gameShell));
ok('Ladder UI exposes rating, placement and recent history', /PERFIL LADDER/.test(gameShell) && /placementRemaining/.test(ladder) && /recent/.test(ladder));
ok('UI audio has select + confirm families', /uiSelect/.test(audio) && /uiConfirm/.test(audio));
ok('Combat audio has round/victory/defeat feedback', /roundStart/.test(audio) && /victory/.test(audio) && /defeat/.test(audio));

// Presentation boundary: UI/Three may read state, never assign combat authority.
const presentationFiles = {
  'js/render/three/threeRenderer.js': read('js/render/three/threeRenderer.js'),
  'js/render/three/threeEnvironment.js': env,
  'js/render/three/threeCharacter.js': threeChar,
  'js/render/three/threeVfx.js': threeVfx,
  'js/ui/gameShell.js': gameShell,
  'js/product/ladder.js': ladder,
  'js/product/matchFlow.js': matchFlow
};
const forbidden = [/\.hp\s*=/, /\.resource\s*=/, /DamageSystem\./, /Resolver\.execute/, /AbilitySystem\.(?:tryUse|requestNormal)/];
let bad=[];
for (const [file, source] of Object.entries(presentationFiles)) {
  forbidden.forEach(rx => { if (rx.test(source)) bad.push(file + ' -> ' + rx); });
}
ok('Presentation/product layers have no combat-authority writes', bad.length === 0, bad.join(', '));

// Every local asset referenced by entrypoint must exist.
const refs = [...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^\"]*)?"/g)].map(m=>m[1]).filter(x=>!/^https?:|^#/.test(x));
const missing = refs.filter(r=>!fs.existsSync(path.join(root,r)));
ok('All local entrypoint assets exist', missing.length === 0, missing.join(', '));

if (fails) {
  console.error(`\nVISUAL CRITIC: RECHAZADO — ${fails} fallo(s).`);
  process.exit(1);
}
console.log('\nVISUAL CRITIC: APROBADO — auditoría estática v0.8.');
console.log('Nota: el smoke Chromium real se ejecuta por separado; esta auditoría no sustituye una captura navegable.');
