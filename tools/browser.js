#!/usr/bin/env node
/* =============================================================================
 * tools/browser.js — Driver mínimo de Chrome DevTools Protocol.
 *
 * Sirve para ejecutar el Combat Lab de verdad en un navegador headless durante
 * el desarrollo: abrirlo, recoger errores de consola, jugar una secuencia de
 * teclas y capturar la pantalla. Sin dependencias: Node 22 ya trae WebSocket.
 *
 *   node tools/browser.js smoke               arranque + errores + captura
 *   node tools/browser.js play <guion.json>   ejecuta un guion de entrada
 *   node tools/browser.js shot <salida.png>   sólo captura
 * ========================================================================== */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.CDP_PORT || 9333);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function launch() {
  const userDir = fs.mkdtempSync('/tmp/arena-cdp-');
  const child = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDir}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=1600,900',
    // WebGL2 por software: sin GPU en el contenedor, ANGLE + SwiftShader es la
    // única forma de que los shaders se compilen y se rindan de verdad.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let stderr = '';
  child.stderr.on('data', d => (stderr += d.toString()));

  for (let i = 0; i < 60; i++) {
    try {
      const v = await httpJson(`http://127.0.0.1:${PORT}/json/version`);
      if (v.webSocketDebuggerUrl) return { child, userDir, version: v };
    } catch (e) { /* aún arrancando */ }
    await sleep(250);
  }
  child.kill();
  throw new Error('Chromium no arrancó.\n' + stderr.slice(-2000));
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleLogs = [];
    this.pageErrors = [];
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || [])
          .map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
        this.consoleLogs.push({ type: msg.params.type, text });
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.pageErrors.push(d.exception?.description || d.text);
      } else if (msg.method === 'Log.entryAdded') {
        const e = msg.params.entry;
        if (e.level === 'error') this.pageErrors.push(`[${e.source}] ${e.text}`);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout en ${method}`));
        }
      }, 30000);
    });
  }

  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }

  async key(key, code, keyCode, opts = {}) {
    const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, ...opts };
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }

  async holdKey(key, code, keyCode, ms) {
    const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
    await sleep(ms);
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }

  async mouse(type, x, y, button = 'left') {
    await this.send('Input.dispatchMouseEvent', {
      type, x, y, button, buttons: button === 'left' ? 1 : (button === 'right' ? 2 : 0),
      clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0
    });
  }

  async screenshot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
}

async function connect() {
  const { child, userDir } = await launch();
  const targets = await httpJson(`http://127.0.0.1:${PORT}/json/list`);
  let page = targets.find(t => t.type === 'page');
  if (!page) {
    const created = await httpJson(`http://127.0.0.1:${PORT}/json/new?about:blank`);
    page = created;
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const s = new Session(ws);
  await s.send('Runtime.enable');
  await s.send('Page.enable');
  await s.send('Log.enable');
  return { session: s, child, userDir };
}

const KEYS = {
  '1': ['1', 'Digit1', 49], '2': ['2', 'Digit2', 50], '3': ['3', 'Digit3', 51],
  '4': ['4', 'Digit4', 52], '5': ['5', 'Digit5', 53], '6': ['6', 'Digit6', 54],
  w: ['w', 'KeyW', 87], a: ['a', 'KeyA', 65], s: ['s', 'KeyS', 83], d: ['d', 'KeyD', 68],
  q: ['q', 'KeyQ', 81], e: ['e', 'KeyE', 69], space: [' ', 'Space', 32],
  t: ['t', 'KeyT', 84], r: ['r', 'KeyR', 82], f: ['f', 'KeyF', 70],
  tab: ['Tab', 'Tab', 9], escape: ['Escape', 'Escape', 27]
};

async function main() {
  /** Servidor estático en un puerto libre, para las páginas con módulos ES. */
function startServer() {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const TYPES = {
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
      '.png': 'image/png', '.glb': 'model/gltf-binary'
    };
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404).end('404 ' + rel); return; }
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
        });
        res.end(data);
      });
    });
    srv.on('error', reject);
    srv.listen(0, () => resolve(srv.address().port));
  });
}

const cmd = process.argv[2] || 'smoke';
  const arg = process.argv[3];
  const { session, child, userDir } = await connect();
  let exitCode = 0;

  try {
    /* La página se puede pedir por argumento o por ARENA_PAGE. `index-three.html`
       usa módulos ES, que el navegador bloquea sobre file://, así que en ese
       caso se levanta el servidor estático y se carga por HTTP — igual que
       hará el hosting real. */
    const page = process.env.ARENA_PAGE || 'index.html';
    let url;
    if (page.indexOf('three') >= 0 || process.env.ARENA_HTTP) {
      const port = await startServer();
      url = 'http://' + (process.env.ARENA_HOST || '127.0.0.1') + ':' + port + '/' + page;
    } else {
      url = 'file://' + path.join(ROOT, page);
    }
    await session.send('Page.navigate', { url });
    await sleep(2500);

    const boot = await session.evaluate(`(function(){
      if (typeof Arena === 'undefined') return { ok:false, why:'Arena no está definido' };
      var fatal = document.getElementById('fatal');
      if (fatal && fatal.classList.contains('show')) {
        return { ok:false, why:'Pantalla de error: ' + fatal.querySelector('pre').textContent.slice(0,600) };
      }
      var g = Arena.Game;
      if (!g || !g.world) return { ok:false, why:'El juego no arrancó' };
      return {
        ok: true,
        entities: g.world.entities.length,
        tick: g.world.tickCount,
        drawCalls: g.renderer.stats.drawCalls,
        triangles: Math.round(g.renderer.stats.triangles),
        canvas: [g.renderer.canvas.width, g.renderer.canvas.height],
        classId: g.playerClass
      };
    })()`);

    console.log('ARRANQUE:', JSON.stringify(boot));
    if (!boot.ok) exitCode = 1;

    if (cmd === 'play' && arg) {
      const script = JSON.parse(fs.readFileSync(arg, 'utf8'));
      for (const step of script) {
        if (step.eval) console.log('  eval →', JSON.stringify(await session.evaluate(step.eval)));
        if (step.key) { const k = KEYS[step.key]; if (k) await session.key(...k); }
        if (step.hold) { const k = KEYS[step.hold]; if (k) await session.holdKey(...k, step.ms || 400); }
        if (step.wait) await sleep(step.wait);
        if (step.shot) await session.screenshot(step.shot);
      }
    }

    if (cmd === 'shot' || cmd === 'smoke') {
      const out = arg || path.join(ROOT, 'docs', 'screenshot.png');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await session.screenshot(out);
      console.log('CAPTURA:', out);
    }

    if (session.pageErrors.length) {
      console.log('\nERRORES DE PÁGINA (' + session.pageErrors.length + '):');
      session.pageErrors.slice(0, 12).forEach(e => console.log('  · ' + String(e).split('\n')[0]));
      exitCode = 1;
    }
    const warnings = session.consoleLogs.filter(l => l.type === 'error' || l.type === 'warning');
    if (warnings.length) {
      console.log('\nCONSOLA (' + warnings.length + '):');
      warnings.slice(0, 12).forEach(l => console.log(`  [${l.type}] ${l.text.slice(0, 220)}`));
    }
  } catch (err) {
    console.error('FALLO:', err.message);
    exitCode = 2;
  } finally {
    try { session.ws.close(); } catch (e) {}
    child.kill();
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {}
  }
  process.exit(exitCode);
}

main();
