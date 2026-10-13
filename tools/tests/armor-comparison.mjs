// Armadura NUMÉRICA frente a golpes reales: misma fuente, mismo golpe, distinta defensa.
// Contrato del skill arena-armor-and-weapons, sin navegador:
//   · más armadura física → menos daño físico (fórmula: suma − armadura×0.52, una vez);
//   · más resistencia elemental (equipo) → menos daño elemental;
//   · resistBreak reduce la resistencia efectiva → más daño elemental, y se restaura;
//   · armorBreak reduce la armadura mientras dura y la restaura al expirar;
//   · el daño puro ignora armadura y resistencia; nunca hay daño negativo.
import assert from 'node:assert/strict';
import {loadArena} from './simHarness.mjs';

const A = loadArena();
const D = A.Combat.DamageSystem, S = A.Combat.StatusSystem, F = A.Combat.RegnumFormulas;
let checks = 0;
const check = (v, msg) => { assert.ok(v, msg); checks++; };

// Equipo con un grado de resistencia elemental uniforme en todas las piezas de la clase.
function equipo(classId, grado, elemento) {
  const piezas = {};
  for (const k of Object.keys(F.armorCoefficients(classId))) piezas[k] = {base: 0, resistances: {[elemento]: grado}};
  return piezas;
}

function escenario({armor = 0, grado = null} = {}) {
  const w = new A.Sim.World({seed: 7});
  const atacante = A.Data.makeEntity('guardian', {id: 'src', team: 1, x: -2, z: 0, yaw: -Math.PI / 2});
  const objetivo = A.Data.makeEntity('devastador', {id: 'dst', team: 0, x: -4, z: 0, yaw: Math.PI / 2, armor});
  if (grado) objetivo.equipment = equipo('devastador', grado, 'fire');
  w.addEntity(atacante); w.addEntity(objetivo);
  A.Data.passives.initEntity(atacante); A.Data.passives.initEntity(objetivo);
  return {w, atacante, objetivo};
}

function golpe(school, opts, raw = 400) {
  const {w, atacante, objetivo} = escenario(opts);
  const hp0 = objetivo.hp;
  D.applyDamage(w, {source: atacante, target: objetivo, raw, school, element: school === 'magical' ? 'fire' : 'slash'});
  return {dmg: hp0 - objetivo.hp, objetivo, w, atacante};
}

// 1) Física: a más armadura, menos daño. Valores bajo el umbral 400/0.52 ≈ 769,
//    donde la mitigación aún no anula el golpe.
const f0 = golpe('physical', {armor: 0}).dmg;
const f1 = golpe('physical', {armor: 200}).dmg;
const f2 = golpe('physical', {armor: 400}).dmg;
check(f0 > f1 && f1 > f2 && f2 > 0, `más armadura reduce el daño físico (${f0} > ${f1} > ${f2} > 0)`);
// Documentado: con armadura ≥ golpe/0.52 el golpe se anula. Es la fórmula del proyecto (no un fallo),
// pero conviene vigilarlo al equilibrar: se anota en el reporte como nota de balance.
check(golpe('physical', {armor: 800}).dmg === 0, 'armadura ≥ golpe/0.52 anula el golpe (fórmula documentada)');

// 2) Elemental: resistencia del equipo. Sin equipo frente a grado "muy buena".
const e0 = golpe('magical', {}).dmg;
const e1 = golpe('magical', {grado: 'very good'}).dmg;
check(e1 < e0, `más resistencia elemental reduce el daño mágico (${e0} > ${e1})`);

// 3) resistBreak: la reducción de resistencia debe SUBIR el daño elemental y restaurarse al expirar.
{
  const {w, atacante, objetivo} = escenario({grado: 'very good'});
  const antes = objetivo.elementResistance('fire');
  S.apply(w, objetivo, {effect: 'resistBreak', duration: 5, data: {resistReductionPct: 0.5}}, atacante);
  const durante = objetivo.elementResistance('fire') * (1 - objetivo.mods().resistReductionPct);
  check(objetivo.mods().resistReductionPct > 0, 'resistBreak activa resistReductionPct');
  check(durante < antes, `resistBreak reduce la resistencia efectiva (${antes.toFixed(3)} → ${durante.toFixed(3)})`);
  const dmgConBreak = (() => { const hp0 = objetivo.hp; D.applyDamage(w, {source: atacante, target: objetivo, raw: 400, school: 'magical', element: 'fire'}); return hp0 - objetivo.hp; })();
  const sin = golpe('magical', {grado: 'very good'}).dmg;
  check(dmgConBreak > sin, `con resistBreak el mismo golpe hace más daño (${sin} → ${dmgConBreak})`);
  w.stepSeconds(8);
  check(objetivo.mods().resistReductionPct === 0, 'tras expirar resistBreak la resistencia vuelve a la normalidad');
}

// 4) armorBreak: reduce armadura mientras dura y la restaura al expirar.
{
  const {w, atacante, objetivo} = escenario({armor: 1200});
  const antes = objetivo.armor();
  S.apply(w, objetivo, {effect: 'armorBreak', duration: 5, data: {armorReductionPct: 0.25}}, atacante);
  const durante = objetivo.armor();
  check(durante < antes, `armorBreak reduce la armadura (${antes.toFixed(1)} → ${durante.toFixed(1)})`);
  w.stepSeconds(8);
  check(Math.abs(objetivo.armor() - antes) < 1e-6, `tras expirar armorBreak la armadura vuelve a ${antes.toFixed(1)}`);
}

// 5) Daño puro ignora armadura y resistencia.
const p0 = golpe('pure', {}).dmg, p1 = golpe('pure', {armor: 2000, grado: 'excellent'}).dmg;
check(p0 === p1 && p0 > 0, `el daño puro no depende de la defensa (${p0} = ${p1})`);

// 6) Nunca hay daño negativo (curación encubierta) con defensa absurda.
check(golpe('physical', {armor: 1e6}).dmg >= 0, 'defensa muy alta nunca produce daño negativo');

console.log(JSON.stringify({ok: true, checks, fisico: [f0, f1, f2], elemental: [e0, e1], puro: p0}, null, 1));
