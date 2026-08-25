#!/usr/bin/env node
/* =============================================================================
 * tools/anim-preview.mjs — capturas nombradas del jugador en cada estado de
 * animación, para el bucle plan→build→prueba→revisión que pidió el usuario.
 *
 * POR QUÉ EXISTE
 *
 * `inspect-canvas.mjs` comprueba que el canvas no esté en blanco y que el
 * presupuesto de render se respete; no dice si una pose concreta está bien
 * puesta. `audit-clips.mjs` comprueba que los nombres de clip existan; no dice
 * si el resultado se ve natural. Ninguno de los dos sirve para juzgar "¿esta
 * animación se ve bien?" — hace falta VERLA. Este script dispara cada estado
 * declarado en animationSourcePlan.js exactamente por la vía de producción
 * (teclado real para locomoción, CharacterBackend.triggerAttack/triggerHurt
 * para combate — las mismas funciones que llama vfx.js ante eventos reales de
 * simulación) y guarda una captura + el veredicto de la máquina de estados
 * (`AnimationStateMachine.select`) para cada una, con nombre de archivo legible.
 *
 * Nota de rendimiento: en Chromium headless sin foco, requestAnimationFrame se
 * limita a unos pocos Hz. El bucle de simulación sigue avanzando con el dt
 * real (topado a 0.1s/frame), sólo que en menos llamadas — de ahí las esperas
 * generosas entre disparo y captura.
 *
 *   node tools/anim-preview.mjs --class devastador
 *   node tools/anim-preview.mjs --class guardian --out qa/anim-guardian
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir, servir, sleep } from './lib/cdp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };

const CLASE = arg('class', 'devastador');
const OUT = path.resolve(RAIZ, arg('out', 'qa/anim-' + CLASE));
fs.mkdirSync(OUT, { recursive: true });

/* --- inicialización de partida, una sola vez -------------------------------
 * Igual que el ADAPTADOR de inspect-canvas.mjs: entra a ACTIVE bombeando
 * flow.update() a mano en vez de esperar rAF, que es justo lo que este mismo
 * script demuestra que hace falta evitar para lo determinista. */
const INIT = `(function(cls){
  Arena.Game.startMatch('1v1', cls);
  for (var i=0;i<80 && Arena.Game.flow && Arena.Game.flow.phase!=='ACTIVE'; i++) Arena.Game.flow.update(0.25);
  var p = Arena.Game.world.getPlayer();
  p.combatMode = false; p._moveIntent = null;
  window.__ctx = function(){
    var G=Arena.Game, w=G.world, pl=w.getPlayer();
    return {G:G, w:w, p:pl, renderer:G.renderer,
      handle:G.renderer.characterHandleOf(pl.id),
      archetype:Arena.Data.archetypeOf(pl.classId),
      CB:Arena.Render.CharacterBackend.current};
  };
  return {phase: Arena.Game.flow.phase, classId: p.classId};
})(${JSON.stringify(CLASE)})`;

/* Lee el veredicto de la máquina de estados SIN alterar nada: mismo handle
 * que ya está en vuelo, mismo archetype. Es la verdad de qué clip debería
 * verse en la captura que se toma justo después. */
const SONDA = `(function(){
  var c = window.__ctx();
  var sel = Arena.Render.AnimationStateMachine.select(c.handle, c.archetype);
  var lc = c.handle.loco || {};
  return {
    state: sel.state, clip: sel.clip, requestedClip: sel.requestedClip,
    fallbackClip: sel.fallbackClip || null, intentionalBlank: !!sel.intentionalBlank,
    qualityStatus: sel.qualityStatus, semanticSlot: sel.semanticSlot || null,
    syncProgress: sel.syncProgress, rate: sel.rate,
    directUpperBase: sel.directUpperBase||null, directLowerBase: sel.directLowerBase||null,
    locomotion: lc.state, moveSpeed: +((lc.moveSpeed||0).toFixed(2)),
    combatMode: !!c.p.combatMode, pos: {x:+c.p.pos.x.toFixed(2), z:+c.p.pos.z.toFixed(2)}
  };
})()`;

function key(k, down) {
  return `window.dispatchEvent(new KeyboardEvent(${down ? "'keydown'" : "'keyup'"}, {key:${JSON.stringify(k)}}))`;
}

/* --- las tomas ---------------------------------------------------------- */
/* `setup` corre una vez antes de esperar y capturar. `hold`/`release` son
 * para locomoción, que necesita la tecla abajo DURANTE la espera, no sólo un
 * disparo puntual. */
const TOMAS = [
  { name: '01-idle', wait: 1200, setup: `var c=window.__ctx(); c.p.combatMode=false;` },
  { name: '02-combat-idle', wait: 1400, setup: `var c=window.__ctx(); c.p.combatMode=true;` },
  { name: '03-walk', wait: 1800, holdKeys: ['shift', 'w'] },
  { name: '04-jog', wait: 1800, holdKeys: ['w'] },
  { name: '05-jump-start', wait: 250, setup: `var c=window.__ctx(); c.p._jumpRequested=true;` },
  { name: '06-jump-air', wait: 550, setup: `` },
  { name: '07-jump-land', wait: 650, setup: `` },
  { name: '08-hit-chest', wait: 300,
    setup: `var c=window.__ctx(); c.CB.triggerHurt(c.handle, c.p, {x:c.p.pos.x, z:c.p.pos.z-2}, 'chest');` },
  { name: '09-hit-head', wait: 300,
    setup: `var c=window.__ctx(); c.CB.triggerHurt(c.handle, c.p, {x:c.p.pos.x, z:c.p.pos.z-2}, 'head');` },
  { name: '10-normal-a-attack', wait: 150,
    setup: `var c=window.__ctx(); c.p.combatMode=true; c.CB.triggerAttack(c.handle, c.archetype, false, null, null, 0, null, 0);` },
  { name: '11-normal-a-recovery', wait: 550, setup: `` },
  { name: '12-normal-b-attack', wait: 150,
    setup: `var c=window.__ctx(); c.CB.triggerAttack(c.handle, c.archetype, false, null, null, 0, null, 0);` },
  { name: '13-normal-b-recovery', wait: 550, setup: `` },
  { name: '14-power-c', wait: 250,
    setup: `var c=window.__ctx(); c.CB.triggerAttack(c.handle, c.archetype, true, null, 'heavy', 0, null, 0);` },
  { name: '15-power-c-follow', wait: 500, setup: `` },
  { name: '16-knockdown-start', wait: 250,
    setup: `var c=window.__ctx(); Arena.Combat.StatusSystem.apply(c.w, c.p, {effect:'knockdown', duration:2.2}, c.p);` },
  { name: '17-knockdown-loop', wait: 900, setup: `` },
  { name: '18-knockdown-exit', wait: 1400, setup: `` }
];

const TOMAS_GUARDIAN_EXTRA = [
  { name: '19-shield-dash', wait: 200,
    setup: `var c=window.__ctx(); c.p.combatMode=true; c.CB.triggerAttack(c.handle, c.archetype, true, null, 'shield', 0, null, 0);` },
  { name: '20-shield-dash-follow', wait: 500, setup: `` },
  { name: '21-shield-oneshot', wait: 250,
    setup: `var c=window.__ctx(); c.CB.triggerAttack(c.handle, c.archetype, true, null, 'guardBuff', 0, null, 0);` },
  { name: '22-shield-oneshot-follow', wait: 500, setup: `` }
];

async function main() {
  const servidor = await servir(RAIZ);
  const url = `http://127.0.0.1:${servidor.port}/index.html`;
  const { session, cerrar } = await abrir({ width: 1280, height: 720 });
  const informe = [];
  try {
    await session.send('Page.navigate', { url });
    await sleep(2500);
    const boot = await session.evaluate(INIT);
    console.log('arranque: ' + JSON.stringify(boot));

    const lista = CLASE === 'guardian' ? TOMAS.concat(TOMAS_GUARDIAN_EXTRA) : TOMAS;
    let heldKeys = [];
    for (const toma of lista) {
      // Soltar teclas de la toma anterior si esta no las repite.
      const nextHeld = toma.holdKeys || [];
      for (const k of heldKeys) if (!nextHeld.includes(k)) await session.evaluate(key(k, false));
      for (const k of nextHeld) if (!heldKeys.includes(k)) await session.evaluate(key(k, true));
      heldKeys = nextHeld;

      if (toma.setup !== undefined) await session.evaluate(toma.setup || '0');
      await sleep(toma.wait);

      const sonda = await session.evaluate(SONDA);
      const shot = await session.screenshotBuffer();
      const pngPath = path.join(OUT, toma.name + '.png');
      fs.writeFileSync(pngPath, shot);
      informe.push({ name: toma.name, ...sonda });
      console.log(toma.name.padEnd(24) + ' state=' + String(sonda.state).padEnd(16) +
        ' clip=' + String(sonda.clip).padEnd(22) + (sonda.intentionalBlank ? ' [BLANK]' : '') +
        (sonda.fallbackClip ? ' fallback→' + sonda.fallbackClip : ''));
    }
    for (const k of heldKeys) await session.evaluate(key(k, false));

    fs.writeFileSync(path.join(OUT, '_informe.json'), JSON.stringify(informe, null, 2));
    console.log('\n→ ' + path.relative(RAIZ, OUT) + '/  (' + informe.length + ' capturas + _informe.json)');
    if (session.pageErrors.length) {
      console.log('\nerrores de consola durante la sesión:');
      session.pageErrors.slice(0, 20).forEach(e => console.log('  · ' + String(e).slice(0, 200)));
    }
  } finally {
    await cerrar();
    servidor.cerrar();
  }
}

main();
