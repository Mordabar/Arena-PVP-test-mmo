#!/usr/bin/env node
/* =============================================================================
 * tools/extract-regnum-trainer.mjs — convierte el trainerdata.json del entrenador
 * de Champions of Regnum (CoRT) en documentación legible, con los valores de
 * CADA NIVEL de cada poder.
 *
 *   node tools/extract-regnum-trainer.mjs ruta/al/trainerdata.json
 *
 * Escribe, dentro de docs/regnum/:
 *   · POWERS.md        índice completo: clase → disciplina → poder → niveles
 *   · powers.json      mismo contenido en JSON, sólo nombres en inglés
 *
 * Fuente: el JSON es datos de juego de terceros (CoRT, cort.ovh). Este script
 * no lo redistribuye fuera del repositorio; sólo lo reformatea. Ver docs/regnum/
 * README para la nota de procedencia y de licencia.
 *
 * Sin dependencias. No inventa nada: si un campo no existe en el JSON, no sale.
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entrada = process.argv[2];
if (!entrada) {
  console.error('Uso: node tools/extract-regnum-trainer.mjs <trainerdata.json>');
  process.exit(2);
}

const d = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const version = d.version || '?';

/* Campos que el JSON trae por nivel (arrays de 5) y cómo se muestran. Los
   nombres de campo salen del propio archivo; no se asume ninguno que no esté. */
const CAMPOS_NIVEL = ['mana', 'damage', 'buffs', 'debuffs', 'heal', 'effects'];

/* Etiqueta en inglés de un texto multilingüe, o el valor tal cual. */
const en = v => (v && typeof v === 'object' && 'en' in v) ? v.en : v;
const fmtValor = v => Array.isArray(v) ? v.join(' / ') : String(v);

/* Un campo de nivel puede ser: array plano de 5 valores, o una lista de
   efectos cada uno con su propio nombre y array de 5 valores. */
function lineasNivel(campo, valor) {
  const out = [];
  if (campo === 'mana') { out.push(`**Maná:** ${fmtValor(valor)}`); return out; }
  if (!Array.isArray(valor)) return out;
  for (const e of valor) {
    if (e && typeof e === 'object') {
      const nombre = en(e.name) || en(e);
      const v = e.value !== undefined ? e.value : null;
      out.push(`**${campo === 'damage' ? 'Daño' : (campo === 'heal' ? 'Curación' : (campo === 'debuffs' ? 'Debuff' : 'Buff'))}** ${nombre}: ${fmtValor(v)}`);
    } else {
      out.push(`**${campo}:** ${fmtValor(e)}`);
    }
  }
  return out;
}

/* El trainer trae poderes placeholder: nombre y descripción literal "undefined"
   en todos los idiomas. No se inventa nombre; se marcan como SIN DATOS EN FUENTE. */
const esPlaceholder = s => /^undefined\d*$/.test(String(en(s.name))) || en(s.name) == null;

function bloquePoder(s) {
  const L = [];
  if (esPlaceholder(s)) {
    L.push(`#### (sin datos en la fuente)`);
    L.push('> Entrada placeholder del trainer ' + version + ': nombre y descripción vacíos. Pendiente de datos reales.');
    L.push('');
    return L.join('\n');
  }
  L.push(`#### ${en(s.name)}`);
  if (s.description) L.push(`> ${en(s.description)}`);
  L.push('');
  const meta = [];
  if (s.type) meta.push(`tipo ${s.type}`);
  if (s.cast !== undefined) meta.push(`cast ${s.cast}s`);
  if (s.gcd) meta.push(`GCD ${s.gcd}`);
  if (s.cooldown !== undefined) meta.push(`recarga ${s.cooldown}s`);
  if (s.range !== undefined) meta.push(`rango ${s.range}`);
  if (s.duration !== undefined) meta.push(`duración ${fmtValor(s.duration)}`);
  if (s.area !== undefined) meta.push(`área ${fmtValor(s.area)}`);
  if (s.weapon_interval) meta.push('afectado por intervalo de arma');
  if (s.blockable_100 !== undefined) meta.push(`bloqueable ${s.blockable_100}%`);
  if (s.resistible_100 !== undefined) meta.push(`resistible ${s.resistible_100}%`);
  if (meta.length) L.push(meta.join(' · '));
  L.push('');
  for (const campo of CAMPOS_NIVEL) {
    if (s[campo] === undefined) continue;
    for (const linea of lineasNivel(campo, s[campo])) L.push('- ' + linea);
  }
  if (s.note) L.push(`- *Nota:* ${en(s.note)}`);
  L.push('');
  return L.join('\n');
}

/* --- POWERS.md ------------------------------------------------------------- */
const porClase = {};
for (const [disc, v] of Object.entries(d.disciplines)) {
  (porClase[v.class] ||= []).push({ disc, display: en(v.display_name) || disc, spells: v.spells });
}

const L = [];
L.push(`# Poderes de Champions of Regnum — trainer ${version}`);
L.push('');
L.push('> GENERADO por `node tools/extract-regnum-trainer.mjs <trainerdata.json>`.');
L.push('> No editar a mano. Fuente: CoRT (cort.ovh), datos de juego de terceros.');
L.push('');
L.push(`Disciplinas: **${Object.keys(d.disciplines).length}** · Poderes: **${Object.values(d.disciplines).reduce((a, v) => a + v.spells.length, 0)}** · Niveles por poder: 5`);
L.push('');
L.push('## Progresión de personaje');
L.push('');
L.push('| Nivel | 1 | 2 | 3 | 4 | 5 | … |');
L.push('|---|---|---|---|---|---|---|');
const req = d.required;
L.push(`| Puntos de nivel acumulados | ${req.points.slice(0, 5).join(' | ')} | … |`);
L.push('');
L.push(`Puntos de poder disponibles por nivel: ${req.available.join(', ')}`);
L.push('');

for (const [clase, discs] of Object.entries(porClase)) {
  L.push(`## ${clase[0].toUpperCase() + clase.slice(1)}`);
  L.push('');
  for (const { disc, display, spells } of discs) {
    L.push(display === disc ? `### ${display}` : `### ${display} _(${disc})_`);
    L.push('');
    for (const s of spells) L.push(bloquePoder(s));
  }
}
const salidaDir = path.join(RAIZ, 'docs', 'regnum');
fs.mkdirSync(salidaDir, { recursive: true });
fs.writeFileSync(path.join(salidaDir, 'POWERS.md'), L.join('\n'));

/* --- powers.json (sólo inglés) -------------------------------------------- */
const plano = [];
for (const [disc, v] of Object.entries(d.disciplines)) {
  for (const s of v.spells) {
    const o = { class: v.class, discipline: disc, name: en(s.name), description: en(s.description) };
    for (const k of Object.keys(s)) {
      if (['name', 'description'].includes(k)) continue;
      o[k] = s[k];
    }
    plano.push(o);
  }
}
fs.writeFileSync(path.join(salidaDir, 'powers.json'), JSON.stringify({ version, powers: plano }, null, 1));

const placeholders = plano.filter(p => /^undefined\d*$/.test(String(p.name)) || p.name == null).length;
console.log(`placeholders sin datos en la fuente: ${placeholders}`);
console.log(`escrito docs/regnum/POWERS.md y docs/regnum/powers.json · trainer ${version} · ${plano.length} poderes`);
