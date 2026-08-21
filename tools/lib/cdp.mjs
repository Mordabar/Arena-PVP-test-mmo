/* =============================================================================
 * tools/lib/cdp.mjs — arnés mínimo de Chrome DevTools Protocol.
 *
 * Adaptado del `tools/browser.js` que este proyecto ya tenía probado. Cero
 * dependencias: Node 22 trae WebSocket, y Chromium viene preinstalado en el
 * contenedor. Meter Playwright aquí obligaría a añadir npm a un proyecto cuya
 * constitución lo prohíbe expresamente.
 *
 * Sirve para: abrir una página, recoger errores de consola, ejecutar JavaScript
 * dentro del juego y capturar el fotograma compuesto de verdad.
 * ========================================================================== */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';

const CANDIDATOS = [
  process.env.CHROME_BIN,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'
].filter(Boolean);

export const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

export class Session {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    this.consoleLogs = []; this.pageErrors = [];
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method === 'Runtime.consoleAPICalled') {
        const text = (m.params.args || [])
          .map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
        this.consoleLogs.push({ type: m.params.type, text });
        if (m.params.type === 'error') this.pageErrors.push(text);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        this.pageErrors.push(d.exception?.description || d.text);
      } else if (m.method === 'Log.entryAdded') {
        const e = m.params.entry;
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
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('Timeout en ' + method)); }
      }, Number(process.env.CDP_TIMEOUT_MS || 180000));
    });
  }

  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }

  /** Captura el fotograma COMPUESTO. Devuelve el Buffer del PNG. */
  async screenshotBuffer() {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(r.data, 'base64');
  }
}

/**
 * Abre Chromium headless y devuelve { session, cerrar }.
 * `viewport` permite emular móvil sin relanzar el navegador.
 */
export async function abrir({ width = 1600, height = 900, mobile = false, dpr = 1 } = {}) {
  const chrome = CANDIDATOS.find(p => fs.existsSync(p));
  if (!chrome) throw new Error('No hay Chromium. Rutas probadas:\n  ' + CANDIDATOS.join('\n  '));
  const port = Number(process.env.CDP_PORT || 9333);
  const userDir = fs.mkdtempSync('/tmp/arena-cdp-');
  const child = spawn(chrome, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
    `--window-size=${width},${height}`,
    /* Sin GPU en el contenedor: ANGLE + SwiftShader es la única forma de que los
       shaders se compilen y se rinda de verdad. Los FPS que salgan de aquí NO
       son los del jugador y no deben publicarse como tales. */
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let stderr = '';
  child.stderr.on('data', d => (stderr += d.toString()));

  let version = null;
  for (let i = 0; i < 80; i++) {
    try {
      const v = await httpJson(`http://127.0.0.1:${port}/json/version`);
      if (v.webSocketDebuggerUrl) { version = v; break; }
    } catch { /* aún arrancando */ }
    await sleep(250);
  }
  if (!version) { child.kill(); throw new Error('Chromium no arrancó.\n' + stderr.slice(-1500)); }

  const targets = await httpJson(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find(t => t.type === 'page') || await httpJson(`http://127.0.0.1:${port}/json/new?about:blank`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('no se pudo abrir el WebSocket de CDP')), { once: true });
  });

  const session = new Session(ws);
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Log.enable');
  await session.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: dpr, mobile
  });

  return {
    session,
    async cerrar() {
      try { ws.close(); } catch { /* da igual */ }
      child.kill();
      try { fs.rmSync(userDir, { recursive: true, force: true }); } catch { /* da igual */ }
    }
  };
}

/** Servidor estático efímero: los módulos ES no cargan sobre file://. */
export function servir(root, port = 0) {
  const TIPOS = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
    '.woff2': 'font/woff2', '.ico': 'image/x-icon'
  };
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = root + rel;
      if (!file.startsWith(root)) { res.writeHead(403).end('403'); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 ' + rel); return; }
        res.writeHead(200, {
          'Content-Type': TIPOS[(file.match(/\.[^.]+$/) || [''])[0].toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-cache'
        });
        res.end(data);
      });
    });
    srv.listen(port, '127.0.0.1', () => resolve({ port: srv.address().port, cerrar: () => srv.close() }));
  });
}
