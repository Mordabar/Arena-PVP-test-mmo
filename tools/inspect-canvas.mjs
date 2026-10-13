#!/usr/bin/env node
/* =============================================================================
 * tools/inspect-canvas.mjs — inspector de canvas para Three.js.
 *
 * Reemplaza el `scripts/inspect-threejs-canvas.mjs` que la skill
 * `threejs-qa-release` invoca y que nunca llegó al contenedor: de las nueve
 * skills de Three.js sólo se sincronizó el SKILL.md, sin código.
 *
 * Contrato que cumple, tomado del propio SKILL.md:
 *   · bloque `metrics` con entropía de color, densidad de bordes, contraste de
 *     luminancia y cuota del color dominante;
 *   · bloque `renderBudget` comparando contra un presupuesto por gama;
 *   · emulación móvil con `--mobile`;
 *   · estados con nombre vía `--state` y `--seed`, con salida sufijada;
 *   · **sale distinto de cero** si el canvas está en blanco o hay errores.
 *
 * Sin dependencias. Node 22 trae WebSocket y zlib; Chromium viene preinstalado.
 * Añadir Playwright obligaría a meter npm en un proyecto que lo prohíbe.
 *
 *   node tools/inspect-canvas.mjs
 *   node tools/inspect-canvas.mjs --state combate --mobile
 *   node tools/inspect-canvas.mjs --url http://127.0.0.1:8080/index.html
 *   node tools/inspect-canvas.mjs --budget alto --out qa/
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir, servir, sleep } from './lib/cdp.mjs';
import { decodePng } from './lib/png.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* --- argumentos ---------------------------------------------------------- */
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const flag = n => argv.includes('--' + n);
const OPC = {
  url: arg('url'),
  page: arg('page', 'index.html'),
  state: arg('state'),
  seed: arg('seed'),
  mobile: flag('mobile'),
  /* Con --mobile el presupuesto por defecto pasa a ser el de móvil. Medir un
     móvil contra el techo de escritorio deja pasar justo lo que hay que cazar. */
  budget: arg('budget', flag('mobile') ? 'movil' : 'navegador'),
  out: arg('out', 'qa'),
  settle: Number(arg('settle', 3500)),
  json: flag('json')
};

/* Presupuestos de render por gama. El de `navegador` NO es inventado: son los
   techos que este proyecto ya tenía documentados en su puerta de rendimiento. */
const PRESUPUESTOS = {
  movil:     { drawCalls: 300,  triangles: 150000,  textures: 40,  geometries: 150 },
  navegador: { drawCalls: 900,  triangles: 400000,  textures: 80,  geometries: 400 },
  alto:      { drawCalls: 2000, triangles: 1500000, textures: 200, geometries: 1200 }
};
/* `programs` sólo se compara si el juego lo publica. Dejar una fila que siempre
   dice NO MEDIDO entrena a ignorar la tabla, que es peor que no tenerla. */
const OPCIONALES = { programs: { movil: 30, navegador: 60, alto: 120 } };

/* ==========================================================================
 * Métricas de imagen
 * ======================================================================= */
const LUM = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function medir(png) {
  const { width: w, height: h, channels: c, data } = png;

  /* Se muestrea en rejilla en vez de recorrer 1600×900 enteros: para entropía y
     contraste, 250 000 muestras dan el mismo número con una fracción del coste,
     y este inspector puede correr varias veces por revisión. */
  const objetivo = 250000;
  const paso = Math.max(1, Math.round(Math.sqrt((w * h) / objetivo)));

  const hist = new Map();          // color cuantizado a 5 bits por canal
  const lums = [];
  let n = 0;

  for (let y = 0; y < h; y += paso) {
    for (let x = 0; x < w; x += paso) {
      const i = (y * w + x) * c;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const clave = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      hist.set(clave, (hist.get(clave) || 0) + 1);
      lums.push(LUM(r, g, b));
      n++;
    }
  }

  /* Entropía de Shannon sobre el histograma. Un fondo plano tiende a 0; una
     escena con material, luz y variación sube. El techo teórico con 5 bits por
     canal son 15 bits. */
  let entropia = 0;
  for (const cnt of hist.values()) { const p = cnt / n; entropia -= p * Math.log2(p); }
  const dominante = Math.max(...hist.values()) / n;

  /* Contraste de luminancia: RMS (desviación típica) y rango entre percentiles,
     que es más robusto que min/max ante un píxel suelto quemado. */
  const media = lums.reduce((s, v) => s + v, 0) / n;
  const varianza = lums.reduce((s, v) => s + (v - media) * (v - media), 0) / n;
  const orden = lums.slice().sort((a, b) => a - b);
  const pct = q => orden[Math.min(orden.length - 1, Math.floor(q * orden.length))];

  /* Densidad de bordes: gradiente Sobel sobre luminancia, en rejilla completa
     para no perder detalle fino. Mide cuánta forma legible hay, que es lo que
     distingue una escena con silueta de una mancha de color. */
  const gl = (x, y) => {
    const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * c;
    return LUM(data[i], data[i + 1], data[i + 2]);
  };
  let bordes = 0, tot = 0;
  const pasoB = Math.max(1, Math.round(paso / 2));
  for (let y = 1; y < h - 1; y += pasoB) {
    for (let x = 1; x < w - 1; x += pasoB) {
      const gx = (gl(x+1,y-1) + 2*gl(x+1,y) + gl(x+1,y+1)) - (gl(x-1,y-1) + 2*gl(x-1,y) + gl(x-1,y+1));
      const gy = (gl(x-1,y+1) + 2*gl(x,y+1) + gl(x+1,y+1)) - (gl(x-1,y-1) + 2*gl(x,y-1) + gl(x+1,y-1));
      if (Math.hypot(gx, gy) > 0.10) bordes++;
      tot++;
    }
  }

  const r3 = v => Math.round(v * 1000) / 1000;
  return {
    sampled: n,
    colorEntropy: r3(entropia),
    colorEntropyMax: 15,
    distinctColors: hist.size,
    dominantColorShare: r3(dominante),
    edgeDensity: r3(bordes / Math.max(1, tot)),
    luminanceMean: r3(media),
    luminanceContrastRms: r3(Math.sqrt(varianza)),
    luminanceP05P95: [r3(pct(0.05)), r3(pct(0.95))],
    luminanceRange: r3(pct(0.95) - pct(0.05))
  };
}

/** Un canvas en blanco no es un fallo de gusto: es un fallo duro. */
function enBlanco(m) {
  const razones = [];
  if (m.dominantColorShare > 0.98) razones.push('un solo color ocupa el ' + (m.dominantColorShare * 100).toFixed(1) + '%');
  if (m.edgeDensity < 0.002) razones.push('densidad de bordes ' + m.edgeDensity + ': no hay formas');
  if (m.colorEntropy < 0.35) razones.push('entropía de color ' + m.colorEntropy + ': imagen plana');
  return razones;
}

/* ==========================================================================
 * Estados con nombre
 * ======================================================================= */
/* La skill define `__THREE_GAME_TEST_HOOKS__` como interfaz estándar. Si el
   juego no la expone, se cae a la API real de este proyecto en vez de fallar:
   un inspector que sólo funciona con juegos generados por su propio andamio no
   sirve para el juego que ya existe. */
const ADAPTADOR = `(function(estado, semilla){
  if (window.__THREE_GAME_TEST_HOOKS__ && typeof window.__THREE_GAME_TEST_HOOKS__.setState === 'function') {
    window.__THREE_GAME_TEST_HOOKS__.setState(estado, semilla);
    return {via:'__THREE_GAME_TEST_HOOKS__', estado:estado};
  }
  if (typeof Arena === 'undefined' || !Arena.Game) return {via:null, error:'ni hooks ni Arena.Game'};
  var G = Arena.Game;
  if (estado === 'lobby') return {via:'Arena.Game', estado:estado};
  if (estado === 'combate' || estado === 'partida' || estado === 'active-play') {
    G.startMatch('1v1', G.playerClass || 'devastador');
    for (var i = 0; i < 80 && G.flow && G.flow.phase !== 'ACTIVE'; i++) G.flow.update(0.25);
    var p = G.world.getPlayer && G.world.getPlayer();
    if (p && estado === 'combate') { p.combatMode = true; p.autoAttackOn = true; }
    return {via:'Arena.Game', estado:estado, phase: G.flow && G.flow.phase};
  }
  return {via:'Arena.Game', estado:estado, aviso:'estado no reconocido; se deja como está'};
})(${JSON.stringify(OPC.state || 'lobby')}, ${OPC.seed === null ? 'null' : Number(OPC.seed)})`;

const SONDA = `(function(){
  var out = {ok:true};
  var fatal = document.getElementById('fatal');
  if (fatal && fatal.classList && fatal.classList.contains('show')) {
    var pre = fatal.querySelector('pre');
    return {ok:false, why:'pantalla de error: ' + (pre ? pre.textContent.slice(0,500) : '')};
  }
  var cv = document.querySelector('canvas');
  out.canvas = cv ? [cv.width, cv.height] : null;
  if (!cv) return {ok:false, why:'no hay <canvas> en la página'};
  if (typeof Arena !== 'undefined' && Arena.Game) {
    var g = Arena.Game;
    out.version = Arena.VERSION; out.build = Arena.BUILD;
    if (g.renderer && g.renderer.stats) {
      out.drawCalls = g.renderer.stats.drawCalls;
      out.triangles = Math.round(g.renderer.stats.triangles || 0);
      out.textures = g.renderer.stats.textures;
      out.geometries = g.renderer.stats.geometries;
      if (g.renderer.stats.programs !== undefined) out.programs = g.renderer.stats.programs;
    }
    if (g.world) { out.entities = g.world.entities.length; out.tick = g.world.tickCount; }
  }
  return out;
})()`;

/* ==========================================================================
 * Ejecución
 * ======================================================================= */
async function main() {
  const presupuesto = PRESUPUESTOS[OPC.budget];
  if (!presupuesto) {
    console.error('Presupuesto desconocido: ' + OPC.budget + '. Opciones: ' + Object.keys(PRESUPUESTOS).join(', '));
    process.exit(2);
  }

  let servidor = null, url = OPC.url;
  if (!url) {
    servidor = await servir(RAIZ);
    url = `http://127.0.0.1:${servidor.port}/${OPC.page}`;
  }

  const vista = OPC.mobile ? { width: 390, height: 844, mobile: true, dpr: 2 }
                           : { width: 1600, height: 900, mobile: false, dpr: 1 };
  const { session, cerrar } = await abrir(vista);
  const fallos = [];
  let salida = 0;

  try {
    await session.send('Page.navigate', { url });
    await sleep(OPC.settle);

    let adaptado = null;
    if (OPC.state) {
      adaptado = await session.evaluate(ADAPTADOR);
      await sleep(900);
    }

    const sonda = await session.evaluate(SONDA);
    if (!sonda.ok) fallos.push(sonda.why);

    const shot = await session.screenshotBuffer();
    const png = decodePng(shot);
    const metrics = medir(png);
    const razonesBlanco = enBlanco(metrics);
    if (razonesBlanco.length) fallos.push('canvas en blanco — ' + razonesBlanco.join('; '));

    /* Errores de consola. Se listan y cuentan; no se silencian. */
    const errores = session.pageErrors.slice(0, 12);
    if (errores.length) fallos.push(errores.length + ' error(es) de consola');

    /* Comparación contra presupuesto. Una fila fuera no tumba la ejecución
       —puede haber un compromiso documentado— pero se marca. */
    const renderBudget = {};
    const techos = Object.assign({}, presupuesto);
    for (const k of Object.keys(OPCIONALES)) {
      if (sonda[k] !== undefined) techos[k] = OPCIONALES[k][OPC.budget];
    }
    for (const k of Object.keys(techos)) {
      const v = sonda[k];
      renderBudget[k] = v === undefined
        ? { value: null, budget: techos[k], status: 'NO MEDIDO' }
        : { value: v, budget: techos[k], status: v <= techos[k] ? 'DENTRO' : 'FUERA' };
    }

    const sufijo = [OPC.state, OPC.mobile ? 'movil' : null, OPC.seed].filter(Boolean).join('-');
    /* `resolve` y no `join`: con join, un --out absoluto acababa colgando
       de la raíz del proyecto en vez de donde lo pidieron. */
    const base = path.resolve(RAIZ, OPC.out);
    fs.mkdirSync(base, { recursive: true });
    const nombre = 'canvas' + (sufijo ? '-' + sufijo : '');
    const png_ = path.join(base, nombre + '.png');
    const json_ = path.join(base, nombre + '.json');
    fs.writeFileSync(png_, shot);        // la misma captura que se midió, no otra

    const informe = {
      url, state: OPC.state || null, seed: OPC.seed === null ? null : Number(OPC.seed),
      viewport: { width: vista.width, height: vista.height, mobile: vista.mobile, dpr: vista.dpr },
      stateAdapter: adaptado,
      page: sonda,
      metrics,
      renderBudget,
      consoleErrors: errores,
      /* La GPU es software (SwiftShader). Los FPS de aquí NO son los del
         jugador y publicarlos como tales sería inventar el dato más importante. */
      notes: ['render por software (ANGLE/SwiftShader): no medir FPS con esto'],
      failures: fallos,
      verdict: fallos.length ? 'RECHAZADO' : 'APROBADO'
    };
    fs.writeFileSync(json_, JSON.stringify(informe, null, 2));

    if (OPC.json) {
      console.log(JSON.stringify(informe, null, 2));
    } else {
      const fueraP = Object.entries(renderBudget).filter(([, v]) => v.status === 'FUERA');
      console.log('INSPECTOR DE CANVAS · ' + (OPC.state || 'estado por defecto') + (OPC.mobile ? ' · móvil' : ''));
      console.log('  url            ' + url);
      if (sonda.version) console.log('  build          ' + sonda.version + ' / ' + sonda.build);
      console.log('  canvas         ' + (sonda.canvas || []).join('×') + '   imagen ' + png.width + '×' + png.height);
      console.log('  entropía color ' + metrics.colorEntropy + ' / 15   (' + metrics.distinctColors + ' colores)');
      console.log('  color dominante' + String(metrics.dominantColorShare).padStart(7) + '   de la imagen');
      console.log('  bordes         ' + metrics.edgeDensity + '   contraste RMS ' + metrics.luminanceContrastRms);
      console.log('  luminancia     media ' + metrics.luminanceMean + '   p05–p95 ' + metrics.luminanceP05P95.join('–'));
      for (const [k, v] of Object.entries(renderBudget)) {
        console.log('  ' + k.padEnd(15) + String(v.value ?? '—').padStart(8) + ' / ' + String(v.budget).padEnd(9) + v.status);
      }
      if (fueraP.length) console.log('  ⚠ ' + fueraP.length + ' fila(s) fuera de presupuesto: hace falta un compromiso documentado');
      if (errores.length) { console.log('  errores de consola:'); errores.forEach(e => console.log('    · ' + String(e).slice(0, 160))); }
      console.log('  → ' + png_.replace(RAIZ + '/', ''));
      console.log('  → ' + json_.replace(RAIZ + '/', ''));
      console.log('\n  ' + informe.verdict + (fallos.length ? ': ' + fallos.join(' | ') : ''));
    }
    salida = fallos.length ? 1 : 0;
  } catch (e) {
    console.error('INSPECTOR: fallo — ' + e.message);
    salida = 2;
  } finally {
    await cerrar();
    if (servidor) servidor.cerrar();
  }
  process.exit(salida);
}

main();
