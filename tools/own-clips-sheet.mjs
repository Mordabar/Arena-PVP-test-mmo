#!/usr/bin/env node
/* Hoja de revisión de los clips propios: esqueleto en lado/arriba/atrás por fotograma.
 *   node tools/own-clips-sheet.mjs <Clip> <f1,f2,...> <salida.png> */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir, servir, sleep } from './lib/cdp.mjs';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [clip, frames, out] = process.argv.slice(2);
const srv = await servir(RAIZ);
const { session: s, cerrar } = await abrir({ width: 1800, height: 1100 });
try {
  await s.send('Page.navigate', { url: `http://127.0.0.1:${srv.port}/agent-qa/own-clips/sheet.html?clip=${clip}&f=${frames}` });
  for (let i = 0; i < 40 && (await s.evaluate('document.title')) !== 'listo'; i++) await sleep(150);
  const dim = await s.evaluate('[document.getElementById("c").width, document.getElementById("c").height]');
  const url = await s.evaluate('document.getElementById("c").toDataURL("image/png")');
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log('escrito', out, dim.join('x'));
} finally { await cerrar(); srv.cerrar(); }
