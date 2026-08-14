#!/usr/bin/env node
/* =============================================================================
 * tools/run-gates.js — Todas las puertas de calidad, de una vez.
 *
 * La batería de pruebas comprueba reglas sin navegador. Eso no basta: un panel
 * puede taparse con otro, un casteo puede no pintar su barra y una habilidad
 * puede no llegar nunca al sistema por la ruta real del jugador. Esas cosas sólo
 * se ven ejecutando el juego.
 *
 * Aquí se ejecutan las dos capas seguidas y el proceso termina en rojo si
 * cualquiera falla. Es lo que convierte «lo he mirado y se veía bien» en algo
 * que otra persona puede repetir.
 *
 *   node tools/run-gates.js            todo
 *   node tools/run-gates.js --rapido   sólo la batería sin navegador
 * ========================================================================== */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const soloRapido = process.argv.includes('--rapido');

const GATES = [
  {
    nombre: 'Batería de reglas (sin navegador)',
    cmd: ['node', ['tools/run-tests.js']],
    navegador: false
  },
  {
    nombre: 'Diseño de nivel · números de la arena',
    cmd: ['node', ['tools/arena-analysis.js']],
    navegador: false,
    silencioso: true
  },
  {
    nombre: 'Identidad visual · seis contornos medidos',
    cmd: ['node', ['tools/silhouette-report.js']],
    navegador: false,
    silencioso: true
  },
  {
    nombre: 'Composición del HUD en las tres fases',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/hud-layout-audit.json']],
    navegador: true
  },
  {
    nombre: 'Casteo · prepare · release · GCD · cola · cancelación',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/casting-sweep.json']],
    navegador: true
  },
  {
    nombre: 'Barrido de las seis clases · 36 habilidades',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/class-sweep.json']],
    navegador: true
  },
  {
    nombre: 'Ratón · arrastre izquierdo 1:1 y mirada libre',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/mouse-sweep.json']],
    navegador: true
  },
  {
    nombre: 'Movimiento, cámara y targeting en partida',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/control-sweep.json']],
    navegador: true
  },
  {
    nombre: 'Combate · normal, casteo, weaving, CC y counters',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/combat-sweep.json']],
    navegador: true
  },
  {
    nombre: 'Rendimiento · coste, presupuesto y fugas',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/perf-sweep.json']],
    navegador: true,
    lenta: true
  },
  {
    /* Devuelve verde comprobando lo que SÍ es automatizable —que el juego pide
       el lock por la ruta real y que el diagnóstico manual funciona— y deja
       constancia medida de lo que el navegador no concede a un gesto sintético.
       Ver docs/POINTER_LOCK_MANUAL.md. */
    nombre: 'Pointer Lock · MANUAL_BROWSER_REQUIRED',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/pointerlock-gate.json']],
    navegador: true
  },
  {
    nombre: 'Animación y VFX · lo que sale por pantalla',
    cmd: ['node', ['tools/browser.js', 'play', 'tools/scripts/anim-vfx-sweep.json']],
    navegador: true,
    // Pinta de verdad por software: es la puerta más lenta de todas.
    lenta: true
  }
];

let fallos = 0;
const resumen = [];

for (const gate of GATES) {
  if (soloRapido && gate.navegador) {
    resumen.push(['—', gate.nombre, 'omitida (--rapido)']);
    continue;
  }
  process.stdout.write('\n\x1b[1m▸ ' + gate.nombre + '\x1b[0m' +
    (gate.lenta ? '  \x1b[2m(pinta por software: varios minutos)\x1b[0m' : '') + '\n');
  const r = spawnSync(gate.cmd[0], gate.cmd[1], {
    cwd: ROOT,
    encoding: 'utf8',
    // Las puertas que pintan tardan bastante más que el tope por defecto del
    // driver CDP; sin esto la puerta falla por reloj, no por el juego.
    env: Object.assign({}, process.env,
      gate.lenta ? { CDP_TIMEOUT_MS: process.env.CDP_TIMEOUT_MS || '300000' } : null),
    stdio: gate.silencioso ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  if (gate.silencioso && r.stdout) {
    // De los informes largos basta con la cabecera y el veredicto.
    const l = r.stdout.split('\n').filter(x => /SIMETRÍA|separación|CERRADA|ABIERTA|piezas del|peor pareja/.test(x));
    l.forEach(x => console.log('  ' + x.trim()));
  }
  const ok = r.status === 0;
  if (!ok && !gate.informativo) fallos++;
  resumen.push([ok ? '✓' : (gate.informativo ? '·' : '✗'), gate.nombre,
    ok ? 'en verde' : (gate.informativo ? 'informativa' : 'FALLA')]);
}

console.log('\n\x1b[1m═══ RESUMEN DE PUERTAS ═══\x1b[0m');
for (const [marca, nombre, estado] of resumen) {
  console.log('  ' + marca + ' ' + nombre.padEnd(52) + ' ' + estado);
}
console.log(fallos === 0
  ? '\n\x1b[32mTodas las puertas obligatorias en verde.\x1b[0m'
  : '\n\x1b[31m' + fallos + ' puerta(s) en rojo.\x1b[0m');

process.exit(fallos === 0 ? 0 : 1);
