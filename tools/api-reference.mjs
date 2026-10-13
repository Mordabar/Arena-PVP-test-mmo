#!/usr/bin/env node
/* =============================================================================
 * tools/api-reference.mjs — genera un llms.txt PARA LA VERSIÓN QUE ESTE
 * PROYECTO USA DE VERDAD.
 *
 * POR QUÉ NO SE USA EL DE threejs.org
 *
 * `https://threejs.org/docs/llms.txt` es un buen fichero, pero documenta la
 * rama de desarrollo (0.185 al escribir esto) y este proyecto vendoriza la
 * 0.160. Comprobado sobre el propio fichero vendorizado, lo primero que ese
 * documento recomienda NO EXISTE aquí:
 *
 *     WebGPURenderer            ❌
 *     MeshStandardNodeMaterial  ❌   (y las otras cuatro NodeMaterial)
 *     TSL                       ❌
 *
 * Y su instrucción número uno —«usa un import map contra un CDN, siempre la
 * última versión»— es exactamente lo que este proyecto rechaza por escrito: un
 * CDN caído deja el juego sin arrancar, y el entorno de desarrollo los bloquea.
 *
 * Una referencia GENERADA no puede desfasarse: sale del mismo fichero que el
 * juego carga. Si mañana se sube a otra versión, este documento se regenera y
 * dice la verdad nueva sin que nadie tenga que acordarse.
 *
 *   node tools/api-reference.mjs                  → por pantalla
 *   node tools/api-reference.mjs --out THREE_API.md
 *   node tools/api-reference.mjs --clase AnimationMixer
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };

/* --- localizar la copia vendorizada, sea cual sea su versión -------------- */
const vendorDir = fs.readdirSync(path.join(RAIZ, 'vendor')).find(d => /^three-/.test(d));
if (!vendorDir) { console.error('No hay vendor/three-*'); process.exit(2); }
const CORE = path.join(RAIZ, 'vendor', vendorDir, 'three.module.js');
const src = fs.readFileSync(CORE, 'utf8');
const rev = (src.match(/REVISION = '([^']+)'/) || [])[1] || '?';

/* --- superficie pública --------------------------------------------------- */
const bloque = src.match(/export\s*\{([\s\S]*?)\};?\s*$/);
const exportados = bloque
  ? bloque[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean).sort()
  : [];

/* Métodos públicos de cada clase. Se descartan los que empiezan por `_`: son
   internos de Three y usarlos desde el juego es pedir que se rompa al subir. */
const clases = new Map();
for (const m of src.matchAll(/^class (\w+)(?: extends (\w+))? \{/gm)) {
  const nombre = m[1], padre = m[2] || null, desde = m.index;
  /* Hasta la siguiente declaración de clase, que es donde acaba ésta. */
  const sig = src.indexOf('\nclass ', desde + 1);
  const cuerpo = src.slice(desde, sig > 0 ? sig : desde + 40000);
  const metodos = [...cuerpo.matchAll(/^\t(?:get |set )?([A-Za-z]\w*)\s*\(([^)]*)\)\s*\{/gm)]
    .map(x => x[1] + '(' + x[2].trim() + ')')
    .filter(x => !/^_/.test(x));
  clases.set(nombre, { padre, metodos: [...new Set(metodos)] });
}

/* --- addons disponibles --------------------------------------------------- */
const addons = [];
(function recorrer(dir, rel = '') {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) recorrer(path.join(dir, e.name), rel + e.name + '/');
    else if (e.name.endsWith('.js')) addons.push(rel + e.name);
  }
})(path.join(RAIZ, 'vendor', vendorDir, 'examples/jsm'));

/* --- consulta puntual ----------------------------------------------------- */
const soloClase = arg('clase');
if (soloClase) {
  const c = clases.get(soloClase);
  if (!c) {
    const parecidos = [...clases.keys()].filter(k => k.toLowerCase().includes(soloClase.toLowerCase()));
    console.error('No existe `' + soloClase + '` en r' + rev + '.' +
      (parecidos.length ? ' ¿Querías ' + parecidos.slice(0, 5).join(', ') + '?' : ''));
    process.exit(1);
  }
  console.log('## ' + soloClase + (c.padre ? ' extends ' + c.padre : '') + '   — Three.js r' + rev);
  c.metodos.forEach(m => console.log('  · ' + m));
  process.exit(0);
}

/* --- lo que la documentación de threejs.org da por hecho y aquí NO existe -- */
const MODERNAS = ['WebGPURenderer', 'MeshBasicNodeMaterial', 'MeshStandardNodeMaterial',
  'MeshPhysicalNodeMaterial', 'LineBasicNodeMaterial', 'SpriteNodeMaterial',
  'NodeMaterial', 'StorageBufferAttribute', 'RenderTarget3D'];
const set = new Set(exportados);
const ausentes = MODERNAS.filter(n => !set.has(n));

/* --- documento ------------------------------------------------------------ */
const L = [];
L.push('# Three.js r' + rev + ' — API real de este proyecto');
L.push('');
L.push('> GENERADO por `node tools/api-reference.mjs` desde `vendor/' + vendorDir + '/`.');
L.push('> No editar a mano: se regenera y no puede desfasarse de lo que el juego carga.');
L.push('');
L.push('## Aviso para cualquier IA que programe sobre este proyecto');
L.push('');
L.push('**No uses `https://threejs.org/docs/llms.txt`.** Documenta la rama de desarrollo');
L.push('(0.185+) y aquí se usa **r' + rev + '**. Concretamente, esto NO existe:');
L.push('');
ausentes.forEach(n => L.push('- `' + n + '`'));
L.push('');
L.push('Y su primera recomendación —import map contra CDN con «siempre la última');
L.push('versión»— está **prohibida** aquí: Three.js va vendorizado en `vendor/` porque');
L.push('un CDN caído deja el juego sin arrancar, y el entorno de desarrollo los bloquea.');
L.push('El import map de `index.html` apunta a `./vendor/`, no a la red.');
L.push('');
L.push('```html');
L.push('<script type="importmap">');
L.push('{ "imports": {');
L.push('    "three": "./vendor/' + vendorDir + '/three.module.js",');
L.push('    "three/addons/": "./vendor/' + vendorDir + '/examples/jsm/"');
L.push('} }');
L.push('</script>');
L.push('```');
L.push('');
L.push('Renderizador: **`WebGLRenderer`**. No hay WebGPU ni TSL en esta versión.');
L.push('');
L.push('## Resumen');
L.push('');
L.push('| | |');
L.push('|---|---|');
L.push('| revisión | r' + rev + ' |');
L.push('| símbolos exportados | ' + exportados.length + ' |');
L.push('| clases con métodos | ' + clases.size + ' |');
L.push('| addons en `examples/jsm` | ' + addons.length + ' |');
L.push('');
L.push('## Addons disponibles');
L.push('');
L.push('Sólo estos. Cualquier otro addon de la documentación oficial **no está');
L.push('vendorizado** y habría que traerlo a mano.');
L.push('');
addons.forEach(a => L.push('- `three/addons/' + a + '`'));
L.push('');
L.push('## Clases y sus métodos públicos');
L.push('');
L.push('Los métodos que empiezan por `_` son internos de Three y se omiten a');
L.push('propósito: usarlos rompe el juego en cuanto se suba de versión.');
L.push('');
[...clases.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([n, c]) => {
  if (!c.metodos.length) return;
  L.push('### ' + n + (c.padre ? ' extends ' + c.padre : ''));
  L.push('');
  c.metodos.forEach(m => L.push('- `' + m + '`'));
  L.push('');
});
L.push('## Todos los símbolos exportados');
L.push('');
L.push(exportados.map(n => '`' + n + '`').join(' · '));
L.push('');

const texto = L.join('\n');
const salida = arg('out');
if (salida) {
  const f = path.resolve(RAIZ, salida);
  fs.writeFileSync(f, texto);
  console.log('escrito ' + path.relative(RAIZ, f) + '  (' + (texto.length / 1024).toFixed(0) + ' KB)');
  console.log('  r' + rev + ' · ' + exportados.length + ' símbolos · ' + clases.size +
    ' clases · ' + addons.length + ' addons');
  console.log('  ausentes respecto a la doc oficial: ' + ausentes.join(', '));
} else {
  console.log(texto);
}
