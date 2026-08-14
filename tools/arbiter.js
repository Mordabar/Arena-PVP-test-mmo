#!/usr/bin/env node
/* =============================================================================
 * tools/arbiter.js — árbitro adversarial Ladder Vertical Slice v0.9.
 * Ataca fronteras de autoridad y, sobre todo, bordes temporales alrededor de
 * WINDUP/RELEASE/GCD/queue que suelen crear daño o cooldowns fantasma.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = [];
function gate(ok, name, detail) {
  if (ok) console.log('✓ ' + name);
  else { console.log('✗ ' + name + (detail ? ' — ' + detail : '')); failures.push(name); }
}

console.log('ARBITER · auditoría adversarial Ladder Vertical Slice v0.9\n');

let testOut = '';
try {
  testOut = cp.execFileSync(process.execPath, [path.join(ROOT, 'tools/run-tests.js')], { encoding:'utf8', stdio:['ignore','pipe','pipe'] });
  /* Un número exacto convierte cada prueba nueva en un fallo del árbitro y
     empuja a no añadir pruebas. Lo que importa es que TODAS pasen y que la
     batería no encoja: un suelo detecta igual de bien que alguien borre media
     suite para pasar la puerta. */
  const m = /TODO OK — (\d+) pruebas/.exec(testOut);
  const n = m ? parseInt(m[1], 10) : 0;
  gate(n >= 279, 'batería completa en verde (' + n + ' pruebas, suelo 279)');
} catch (e) {
  gate(false, 'suite de tests ejecutable', String(e.message).split('\n')[0]);
}

const main = read('js/main.js');
const world = read('js/sim/world.js');
const ability = read('js/combat/abilitySystem.js');
const entity = read('js/core/entity.js');
const abilities = read('js/data/abilities.js');
const balance = read('js/data/balance.js');
const animIntent = read('js/anim/animationIntent.js');
const actions = read('js/render/anim/actions.js');
const charVis = read('js/render/characterVisual.js');
const three = read('js/render/three/threeRenderer.js');
const threeVfx = read('js/render/three/threeVfx.js');
const threeChar = read('js/render/three/threeCharacter.js');
const hud = read('js/ui/hud.js');
const log = read('js/ui/combatLog.js');
const icons = read('js/ui/abilityIcons.js');
const arena = read('js/sim/arena.js');
/* El entrypoint del producto es `index.html`: la separación en un
   `index-three.html` aparte se deshizo cuando Three.js pasó a ser el backend
   por defecto, y el árbitro se quedó leyendo un fichero que ya no existe. */
const html = read('index.html');
const missionTests = read('js/tests/gameFeelMissionTests.js');
const refTests = read('js/tests/animationReferenceTests.js');
const animCfg = read('js/data/animConfig.js');
const loco = read('js/render/anim/locomotion.js');
const ladder = read('js/product/ladder.js');
const matchFlow = read('js/product/matchFlow.js');
const gameShell = read('js/ui/gameShell.js');
const productTests = read('js/tests/productTests.js');
const ai = read('js/ai/dummyAI.js');

// 1 — RELEASE realmente es el commit, BEGIN no.
const beginBlock = ability.slice(ability.indexOf('A._begin ='), ability.indexOf('A._release ='));
const releaseBlock = ability.slice(ability.indexOf('A._release ='), ability.indexOf('ATAQUE NORMAL'));
gate(!/caster\.resource\s*=|gcdUntil\s*=|cooldowns\[/.test(beginBlock),
  'BEGIN de un cast no consume recurso/CD/GCD');
gate(/caster\.resource\s*=/.test(releaseBlock) && /caster\.gcdUntil\s*=/.test(releaseBlock) && /caster\.cooldowns\[ability\.id\]/.test(releaseBlock),
  'RELEASE concentra el commit transaccional');
gate(releaseBlock.includes('releaseValidation: true'), 'rango/LoS/facing se revalidan justo antes de RELEASE');

// 2 — arma con estado propio; caminar no reinicia readyAt.
gate(entity.includes('weaponState') && /phase:\s*'READY'/.test(entity), 'WeaponState explícito en Entity');
gate(ability.includes("'WINDUP'") && ability.includes("'RELEASE'") && ability.includes("'RECOVERY'"),
  'normal usa READY/WINDUP/RELEASE/RECOVERY');
const preMove = ability.slice(ability.indexOf('A.handlePreMovementIntents'), ability.indexOf('A._processQueue'));
gate(preMove.includes('cancelWeaponWindup') && preMove.includes('interruptCast'),
  'movimiento cancela normal/cast antes de resolución');
gate(!/readyAt\s*=/.test(preMove), 'caminar/cancelar no reinicia el intervalo preparado');

// 3 — política de weaving es data, no ids dentro del motor.
gate(abilities.includes('normalInteraction') && abilities.includes('weaponIntervalPolicy'),
  'relación poder↔normal declarada en datos');
gate(abilities.includes("weaveAfterNormal") && abilities.includes("replacesNormal") && abilities.includes("respectReady"),
  'existen políticas weave/replace/intervalo');
gate(!/devastador_|centinela_|arcanista_/.test(ability), 'AbilitySystem no ramifica por IDs concretos de poder');
gate(ability.includes('AbilityQueuedAfterNormal') && ability.includes('AbilityQueueReplaced'),
  'queue única expone afterNormal y latest-valid-input-wins');

// 4 — adversarial: justo antes del release, movimiento se procesa primero.
const preIndex = world.indexOf('Ability.handlePreMovementIntents');
const moveIndex = world.indexOf('this.moveEntityBy');
const tickAbilityIndex = world.indexOf('Ability.tick(this');
gate(preIndex >= 0 && preIndex < moveIndex && moveIndex < tickAbilityIndex,
  'orden adversarial: cancelación → movimiento → RELEASE');
gate(missionTests.includes('weapon skill antes de RELEASE') && missionTests.includes('después del RELEASE'),
  'tests cubren ambos lados irreversibles del borde de RELEASE');
gate(missionTests.includes('movimiento antes de RELEASE cancela') && missionTests.includes('proyectil nace en RELEASE'),
  'tests cubren cast cancelado y proyectil post-release');
gate(read('js/core/fixedTick.js').includes('var eps = 1e-10') && missionTests.includes('30/60/120/144 FPS'),
  'fixed tick adversarial evita perder un tick por deriva a 30/60/120/144 FPS');

// 5 — cámara/click: deadzone primero, luego 1:1; free-look separado.
gate(main.includes('pendingDragDx') && main.includes('pendingDragDy') && main.includes('CLICK_MAX_PX'),
  'click izquierdo acumula deadzone antes de convertirse en drag');
gate(main.includes('_mouseTurnDelta') && main.includes('angleDelta(yawBefore, self.renderer.camera.yaw)'),
  'drag izquierdo transporta exactamente el delta de cámara al cuerpo');
gate(world.includes('e.yaw = V.wrapAngle(e.yaw + e._mouseTurnDelta)'),
  'yaw del ratón se consume en simulación 1:1');
gate(/var s = \(k\['d'\] \? 1 : 0\) - \(k\['a'\] \? 1 : 0\)/.test(main),
  'A izquierda / D derecha siguen sin invertir');

// 6 — animación representa el reloj autoritativo, no lo inventa.
gate(animIntent.includes('weaponPhase') && animIntent.includes('weaponProgress') && animIntent.includes('queuedAction'),
  'AnimationIntent transporta weapon timeline y queue');
gate(charVis.includes("ws.phase === 'WINDUP'") && charVis.includes("ws.phase === 'RELEASE'"),
  'pose del normal se sincroniza con WeaponState');
gate(actions.includes('cancelVisual'), 'cancelación visual hace blend-out sin devolver autoridad al renderer');

// 7 — laboratorio y telemetría.
/* El Timing Lab dejó de ser un `switch` en main.js: los escenarios son DATOS
   en `data/scenarios.js` y el panel los ofrece desde ahí. La puerta sigue
   exigiendo lo mismo —que las estaciones existan— pero en el sitio donde
   ahora viven, que es lo que hay que verificar. */
const scenarios = read('js/data/scenarios.js');
const labPanel = read('js/ui/labPanel.js');
gate(scenarios.includes('STOP-SHOT') && scenarios.includes('GCD CHAIN') &&
     /timing\s*:/.test(scenarios) && labPanel.includes("'timing'"),
  'Timing Lab contiene estaciones stop-shot/weave/replace/cast/GCD');
gate(log.includes('ARMA · WINDUP') && log.includes('ARMA · RELEASE') && log.includes('QUEUE'),
  'Combat Log expone timeline temporal con world.time');

// 8 — visual v0.5 preservado: Three.js sigue sólo como presentación.
gate(threeVfx.includes('createProjectileRenderer') && threeVfx.includes('trail'), 'proyectiles Three.js con estela preservados');
gate(threeChar.includes('caster-fx:') && threeChar.includes('gemPos'), 'VFX del caster siguen anclados al báculo');
gate(icons.includes('ability-svg') && icons.includes('glyphFor'), 'iconografía vectorial propia preservada');
const forbidden = [/\.hp\s*=/, /\.resource\s*=/, /DamageSystem\./, /Resolver\.execute/];
const presentation = three + '\n' + threeVfx + '\n' + threeChar;
gate(forbidden.every(rx => !rx.test(presentation)), 'Three.js continúa sin autoridad sobre combate');

// 9 — Animation Reference Pass: lenguaje corporal sin tocar autoridad.
gate(animCfg.includes('directional: {') && loco.includes('resolveMotionProfile'),
  'backpedal/strafe/diagonal usan perfiles direccionales data-driven');
gate(actions.includes('normalSequence') && actions.includes('st.variant = st.normalSequence & 1') && actions.includes('variant === 0'),
  'normales melee alternan horizontal/diagonal de forma determinista');
gate(actions.includes('Act._kick') && actions.includes('Act._shieldBash') && actions.includes('Act._charge'),
  'guerrero tiene kick/shield/charge como familias corporales propias');
gate(abilities.includes("visualAction:'kick'") && abilities.includes("visualAction:'shield'") && abilities.includes("visualAction:'none'"),
  'gesto visual de poderes vive en metadata, no en ids dentro del renderer');
gate(actions.includes('weaponOffsetY') && actions.includes('staffWalkCounter') && charVis.includes('A.weaponOffsetY'),
  'báculo usa muñeca, compensación y offset para vender masa');
gate(animIntent.includes('actionVariant') && animIntent.includes('visualAction'),
  'AnimationIntent transporta variante y gesto para futuro backend skinned');
gate(refTests.includes('backpedal usa una zancada visual menor') && refTests.includes('puntapié tiene familia propia'),
  'tests adversariales protegen locomoción y guerrero del Reference Pass');
gate(actions.includes('Act._archerCastPose') && actions.includes('Act._meleeCastPose'),
  'cast pre-RELEASE respeta arquetipo: arco y weapon skill no usan pose de mago');
gate(charVis.includes('releaseT = aph.impact') && charVis.includes('releaseT - 0.012'),
  'normal visual no puede cruzar IMPACT antes del RELEASE autoritativo');

// 10 — producto: la capa Ladder orquesta, nunca decide combate.
const productPresentation = ladder + '\n' + matchFlow + '\n' + gameShell;
const productForbidden = [/\.hp\s*=/, /\.resource\s*=/, /DamageSystem\./, /Resolver\.execute/, /AbilitySystem\.(tryUse|requestNormal)/];
gate(productForbidden.every(rx => !rx.test(productPresentation)),
  'Ladder/MatchFlow/GameShell no escriben resultados autoritativos de combate');
gate(matchFlow.includes("this.phase = 'COUNTDOWN'") && matchFlow.includes("this.phase = 'ACTIVE'") && matchFlow.includes("this.phase = 'RESULTS'"),
  'MatchFlow declara lobby/countdown/active/results explícitos');
gate(main.includes("world.bus.on('EntityDied'") && main.includes('_matchEndPending') && main.includes('_evaluateMatchEnd'),
  'fin de partida nace de EntityDied y se evalúa después del tick');
gate(main.includes("winner = (!alive0 && !alive1) ? -1") && productTests.includes('doble KO produce empate sin rating fantasma'),
  'doble KO se resuelve como empate sin rating fantasma');
gate(ladder.includes('placementRemaining') && ladder.includes('expectedScore') && ladder.includes('makeStorage'),
  'rating local/placements/storage están encapsulados y son reemplazables');
gate(gameShell.includes('ENTRAR A LA ARENA') && gameShell.includes('Training Lab') && gameShell.includes('showResults'),
  'shell cubre lobby, selección, training y resultados/rematch');
gate(main.includes("flow.begin('training'") && main.includes("this.flow.begin(this._lastMatch.mode") && main.includes('this.flow.finish(winner'),
  'main integra training + 1v1/2v2 + resultado sin saltarse MatchFlow');
gate(['chaser','kiter','caster','support','peel','sparring'].every(id => ai.includes(id + ': {')),
  'IA expone presión melee, kiter, caster, healer, peel y sparring Ladder');
gate(ai.includes('world.turnEntityToward(self') && !ai.includes('self.yaw = V.yawTo'),
  'bots no tienen auto-face instantáneo: usan giro limitado por simulación');

// 11 — mapa/salto/build y hosting cache.
const m = arena.match(/var W = ([0-9.]+), D = ([0-9.]+)/);
gate(m && Number(m[1]) >= 46 && Number(m[2]) >= 34, 'Arcane Wilds conserva mapa ampliado');
gate(/B\.JUMP\s*=/.test(balance) && world.includes('_tickJump'), 'salto continúa en fixed tick');
gate(/Ladder Vertical Slice · v0\.9/.test(html), 'build visible Ladder Vertical Slice v0.9');
/* El sello tiene que cambiar en cada build que se sube: Hostinger sirve los
   .js con caché agresiva y sin esto el jugador prueba la versión anterior
   creyendo que prueba la nueva. */
const sello = /\?build=([a-z0-9-]+)"/.exec(html);
gate(!!sello && sello[1] === 'v090-20260814-playtest',
  'cache-busting del build actual presente', sello ? sello[1] : 'ninguno');
gate((html.match(/\?build=v090-20260814-playtest/g) || []).length >= 40,
  'todos los scripts llevan el sello de caché');
gate(html.includes('js/product/ladder.js') && html.includes('js/product/matchFlow.js') && html.includes('js/ui/gameShell.js'),
  'entrypoint Three.js carga explícitamente el producto Ladder');

console.log('\n-----------------------------------------------');
if (failures.length) {
  console.log('ARBITER: RECHAZADO · ' + failures.length + ' gates fallaron');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('ARBITER: APROBADO');
console.log('Ladder Vertical Slice v0.9 protege RELEASE, mantiene autoridad de simulación y añade loop de producto competitivo local.');
