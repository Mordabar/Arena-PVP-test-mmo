#!/usr/bin/env node
/* =============================================================================
 * tools/powers-matrix.mjs — matriz de poderes de la arena 1v1, generada desde
 * las fuentes del juego (no escrita a mano).
 *
 *   node tools/powers-matrix.mjs            → agent-qa/PODERES_ESTADO.csv
 *
 * Una fila por (clase, poder) de los kits de la arena. Columnas:
 *   · datos: id, clase, nombre, coste, recurso, cast, GCD, recarga, rango, tipos
 *   · estado técnico: efectos resueltos (todos los tipos tienen manejador),
 *     icono local presente, presente en el kit inicial de la clase
 *   · evidencia: las pruebas automáticas que ejercitan el poder. Lo que NO se
 *     ha comprobado en navegador queda como NO_EVIDENCIA, nunca como OK.
 *
 * Se apoya en tools/tests/simHarness.mjs para cargar el juego sin navegador.
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArena, root } from './tests/simHarness.mjs';

const A = loadArena();
const sal = path.join(root, 'agent-qa', 'PODERES_ESTADO.csv');
const cab = ['id', 'clase', 'nombre', 'coste', 'cast_s', 'gcd', 'recarga_s', 'rango', 'tipos_efecto',
  'icono_local', 'en_kit_inicial', 'manejador_efectos', 'prueba_automatica', 'visual_navegador'];

// Tipos de efecto con manejador en combat/resolver.js (Arena.Combat.Resolver.effectHandlers).
const manejados = new Set(Object.keys(A.Combat.Resolver.effectHandlers));
const tieneManejador = t => (manejados.has(t) ? 'SI' : 'NO');

function tiposDe(list, acc = new Set()) {
  for (const e of list || []) {
    if (!e || typeof e !== 'object') continue;
    if (e.type) acc.add(e.type);
    if (Array.isArray(e.then)) tiposDe(e.then, acc);
    if (Array.isArray(e.otherwise)) tiposDe(e.otherwise, acc);
  }
  return acc;
}

const filas = [];
for (const [cid, cls] of Object.entries(A.Data.classes)) {
  const kit = new Set(cls.abilities);
  for (const aid of cls.abilities) {
    const ab = A.Data.abilities[aid];
    const tipos = [...tiposDe(ab.effects)];
    const icono = fs.existsSync(path.join(root, 'assets', 'icons', aid + '.svg')) ? 'SI' : 'NO';
    const coste = ab.cost !== undefined ? ab.cost : '';
    filas.push([aid, cid, ab.name, coste, ab.castTime ?? '', ab.gcd ?? '', ab.cooldown ?? '',
      ab.range ?? '', tipos.join('|'), icono, kit.has(aid) ? 'SI' : 'NO',
      tipos.map(t => t + ':' + tieneManejador(t)).join('|'),
      'duel-regression (inicio/recurso/cooldown) ; armor-comparison (mitigación)',
      'NO_EVIDENCIA']);
  }
}

const esc = v => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
fs.mkdirSync(path.dirname(sal), { recursive: true });
fs.writeFileSync(sal, [cab, ...filas].map(r => r.map(esc).join(';')).join('\n') + '\n');
console.log(`escrito ${path.relative(root, sal)} · ${filas.length} filas (${Object.keys(A.Data.classes).length} clases)`);
