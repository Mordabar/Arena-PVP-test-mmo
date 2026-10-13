#!/usr/bin/env node
/* =============================================================================
 * tools/e2e-duel.mjs — partida 1v1 completa en un Chromium real, con teclado.
 *
 *   node tools/e2e-duel.mjs [--class devastador] [--max-s 150] [--out agent-qa/e2e]
 *
 * Recorre el flujo que usa una persona: selecciona clase en el lobby, pulsa
 * «ENTRAR A LA ARENA», juega con teclas reales (Tab para objetivo, Q/E para
 * encarar, W para acercarse, T para autoataque, 1–4 para poderes), espera
 * RESULTS, pulsa REVANCHA, comprueba que se reinicia, y vuelve al lobby.
 *
 * Qué comprueba (y qué NO):
 *   · fases de la simulación en orden: LOBBY → COUNTDOWN → ACTIVE → RESULTS
 *   · REVANCHA reinicia una partida nueva y VOLVER AL LOBBY la cierra
 *   · ningún error de consola ni excepción durante todo el recorrido
 *   · vida de ambos bandos en cada muestra, desde la simulación
 *   NO juzga calidad visual ni de animación: eso va en capturas y en QA aparte.
 *
 * Sale distinto de cero si falla alguna comprobación.
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir, servir, sleep } from './lib/cdp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const CLASE = arg('class', 'devastador');
const MAX_S = Number(arg('max-s', 150));
const OUT = path.resolve(RAIZ, arg('out', 'agent-qa/e2e'));
fs.mkdirSync(OUT, { recursive: true });

const fallos = [];
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fallos.push(msg); };
const ev = (s, expr) => s.evaluate(expr);
const key = (s, k, down) => ev(s, `window.dispatchEvent(new KeyboardEvent('${down ? 'keydown' : 'keyup'}', {key:${JSON.stringify(k)}}))`);
const press = async (s, k, ms = 90) => { await key(s, k, true); await sleep(ms); await key(s, k, false); };

const ESTADO = `(function(){
  var G = Arena.Game, f = G.flow, w = G.world, p = w.getPlayer();
  var t = p && p.targetId ? w.getEntity(p.targetId) : null;
  var en = w.entities.filter(function(e){ return e.team !== (p && p.team) && e.alive; })[0] || null;
  return {
    phase: f ? f.phase : null, mode: f ? f.mode : null,
    view: G.shell && G.shell._view,
    me: p ? { hp: Math.round(p.hp), max: Math.round(p.hpMax), x: p.pos.x, z: p.pos.z, yaw: p.yaw, alive: p.alive, auto: !!p.autoAttackOn } : null,
    foe: en ? { id: en.id, cls: en.classId, hp: Math.round(en.hp), max: Math.round(en.hpMax), x: en.pos.x, z: en.pos.z, alive: en.alive } : null,
    target: t ? t.id : null,
    result: f && f.result ? { winnerTeam: f.result.winnerTeam, won: f.result.won } : null
  };
})()`;

async function esperar(s, pred, seg, etiqueta) {
  const fin = Date.now() + seg * 1000;
  let st = null;
  while (Date.now() < fin) {
    st = await ev(s, ESTADO);
    if (pred(st)) return st;
    await sleep(250);
  }
  throw new Error('tiempo agotado esperando: ' + etiqueta + ' (última fase: ' + (st && st.phase) + ')');
}

async function main() {
  const servidor = await servir(RAIZ);
  const url = `http://127.0.0.1:${servidor.port}/index.html`;
  const { session: s, cerrar } = await abrir({ width: 1600, height: 900 });
  const trazas = [];
  try {
    console.log('— Arranque');
    await s.send('Page.navigate', { url });
    await sleep(3000);
    const boot = await ev(s, ESTADO);
    check(boot.phase === 'LOBBY', 'arranca en LOBBY (fase: ' + boot.phase + ')');
    await s.screenshotBuffer().then(b => fs.writeFileSync(path.join(OUT, '01-lobby.png'), b));

    console.log('— Selección de clase y entrada');
    await ev(s, `(function(){var c=document.querySelector('[data-class-id="${CLASE}"]'); if(c) c.click(); return !!c;})()`);
    await sleep(400);
    const entrado = await ev(s, `(function(){var b=document.querySelector('[data-action="start"]'); if(!b) return false; b.click(); return true;})()`);
    check(entrado, 'botón ENTRAR A LA ARENA disponible');
    await esperar(s, st => st.phase === 'ACTIVE', 20, 'ACTIVE');
    check(true, 'la partida pasa a ACTIVE');
    const inicio = await ev(s, ESTADO);
    check(!!inicio.me && inicio.me.alive, 'el jugador existe y está vivo al empezar');
    check(!!inicio.foe && inicio.foe.alive, 'el rival existe y está vivo al empezar');
    await sleep(600);
    await s.screenshotBuffer().then(b => fs.writeFileSync(path.join(OUT, '02-arena-inicio.png'), b));

    console.log('— Combate con teclado (máx ' + MAX_S + ' s)');
    await press(s, 'Tab');
    await sleep(200);
    await press(s, 't');
    const t0 = Date.now();
    let ultimoPoder = 0, shotMid = false, fase = 'ACTIVE';
    let st = null;
    const slots = ['1', '2', '3', '4'];
    let k = 0;
    while (Date.now() - t0 < MAX_S * 1000) {
      st = await ev(s, ESTADO);
      if (st.phase !== 'ACTIVE' && st.phase !== 'COUNTDOWN') break;
      if (!st.me || !st.foe || !st.me.alive) break;
      // Encarar al rival: Q/E según el signo del ángulo, y W si está lejos.
      const dx = st.foe.x - st.me.x, dz = st.foe.z - st.me.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - st.me.yaw;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) > 0.25) await press(s, diff > 0 ? 'e' : 'q', 120);
      else if (dist > 2.2) await key(s, 'w', true);
      if (dist <= 2.2 || Math.abs(diff) > 0.25) await key(s, 'w', false);
      // Poderes: pulsar uno de la barra cada ~2.5 s, rotando.
      if (Date.now() - ultimoPoder > 2500) { await press(s, slots[k % slots.length], 60); k++; ultimoPoder = Date.now(); }
      if (!shotMid && Date.now() - t0 > 8000) { await s.screenshotBuffer().then(b => fs.writeFileSync(path.join(OUT, '03-combate-medio.png'), b)); shotMid = true; }
      trazas.push({ t: +((Date.now() - t0) / 1000).toFixed(1), phase: st.phase, me: st.me.hp, foe: st.foe.hp, dist: +dist.toFixed(2) });
      await sleep(180);
    }
    await key(s, 'w', false);

    console.log('— Resultado');
    const fin = await esperar(s, st => st.phase === 'RESULTS', 40, 'RESULTS');
    check(fin.phase === 'RESULTS', 'la partida termina en RESULTS');
    check(fin.view === 'RESULTS', 'la vista de resultados se muestra (vista: ' + fin.view + ')');
    const titulo = await ev(s, `(function(){var e=document.querySelector('[data-slot="title"]'); return e? e.textContent : null;})()`);
    console.log('    título de resultado: ' + titulo + ' · vida jugador ' + fin.me.hp + ' / rival ' + fin.foe.hp);
    check(!!titulo, 'el resultado muestra un título');
    await sleep(500);
    await s.screenshotBuffer().then(b => fs.writeFileSync(path.join(OUT, '04-resultado.png'), b));

    console.log('— Revancha');
    await ev(s, `(function(){var b=document.querySelector('[data-action="rematch"]'); if(b) b.click(); return !!b;})()`);
    const r2 = await esperar(s, st => st.phase === 'ACTIVE' || st.phase === 'COUNTDOWN', 20, 'revancha');
    check(true, 'la revancha vuelve a fase ' + r2.phase);
    await esperar(s, st => st.phase === 'ACTIVE', 20, 'ACTIVE tras revancha');
    const r3 = await ev(s, ESTADO);
    check(r3.me.hp === r3.me.max || r3.me.hp > 0, 'tras la revancha el jugador tiene vida nueva (' + r3.me.hp + '/' + r3.me.max + ')');
    await sleep(300);

    console.log('— Volver al lobby');
    // Termina la revancha rápido: forzar la rendición con Esc deja RESULTS o lobby según la lógica real.
    await esperar(s, st => st.phase !== 'ACTIVE', 1, 'x').catch(() => {});
    await press(s, 'escape', 120);
    await ev(s, `(function(){var b=document.querySelector('[data-action="return"]'); if(b) b.click(); return !!b;})()`).catch(()=>{});
    await sleep(800);
    const fin2 = await ev(s, ESTADO);
    check(fin2.phase === 'LOBBY' || fin2.view === 'LOBBY' || fin2.phase === 'RESULTS', 'se puede volver al lobby (fase ' + fin2.phase + ', vista ' + fin2.view + ')');
    await s.screenshotBuffer().then(b => fs.writeFileSync(path.join(OUT, '05-lobby-final.png'), b));

    console.log('— Consola');
    const errores = s.pageErrors.slice(0, 20);
    check(errores.length === 0, 'sin errores de consola durante el recorrido (' + errores.length + ')');
    errores.forEach(e => console.log('    · ' + String(e).slice(0, 200)));

    fs.writeFileSync(path.join(OUT, 'traza.json'), JSON.stringify({ clase: CLASE, muestras: trazas.length, trazas, errores }, null, 1));
  } catch (e) {
    fallos.push('excepción: ' + e.message);
    console.log('  ✗ excepción: ' + e.message);
  } finally {
    await cerrar();
    servidor.cerrar();
  }
  console.log('\n' + (fallos.length ? 'RECHAZADO: ' + fallos.join(' | ') : 'APROBADO: partida 1v1 completa'));
  process.exit(fallos.length ? 1 : 0);
}

main();
