# BUILD REPORT · Project Arena v0.10

## BUILD

**Project Arena Ladder PvP · v0.10 · POWERBOOK + EXPANDED ARENA**

Baseline preservado: fixed tick, simulación autoritativa, `RELEASE`, WeaponState, cast transaccional, weaving, CC/counters, MatchFlow/Ladder, AnimationIntent y Three.js de presentación.

## CONTENT

La fuente maestra contiene 320 registros. El parser identifica **290 poderes reales** y **30 encabezados `undefined`** que son placeholders de tablas Warmaster, no habilidades. No se inventan entradas para ellos.

Asignación mecánica:

| Arena | Fuente base | Fuente especialización | Asignaciones |
|---|---|---|---:|
| Devastador | Guerrero | Bárbaro | 65 |
| Guardián | Guerrero | Caballero | 65 |
| Centinela | Arquero | Tirador | 65 |
| Rastreador | Arquero | Cazador | 65 |
| Arcanista | Mago | Brujo | 75 |
| Vinculador | Mago | Conjurador | 75 |

Total: **410 asignaciones**, **344 activas**, **66 pasivas**, **290 mecánicas fuente únicas**.

Los nombres, descripciones, disciplinas de presentación e iconos son originales de Project Arena. La fuente se usa para el contrato mecánico, no para copiar expresión audiovisual.

### Efectos implementados

Daño fijo directo, DoT fijo, drenaje de recurso, knockdown, root, stasis/parálisis, daze, silence, no-attack, utility lock, no-damage, AntiBuff, purge, cleanse, reveal, stealth, santuario, reflejo, redirección, barrera, curación, restauración de recurso, velocidad de movimiento/ataque/casteo, buffs/debuffs deterministas, protección, AntiHeal, bloqueo, wards de CC, auras, revive, cremate, summon y operaciones sobre compañeros.

El daño fuente de esta fase es **fixed/pure**. Las fórmulas nuevas de armadura/resistencia para esta biblioteca están deliberadamente diferidas.

## CASTING

Corregido el contrato de game feel:

- girar el personaje/cámara durante `PREPARE/CASTING` **no cancela**;
- caminar o saltar **sí cancela** antes de `RELEASE`;
- un cast cancelado no paga recurso/CD/GCD;
- `RELEASE` conserva la revalidación de rango, LoS y facing.

Se añadió una regresión específica para evitar que una línea del tipo “Resistir inmovilizar” pueda volver a traducirse como un auto-root. El mismo criterio cubre resistencia a noqueo, parálisis, stun, mareo y “no puede atacar”.

## UI / POWERBOOK

- 4 páginas × 12 slots = 48 posiciones por subclase.
- `1..9, 0, -, =` activa los 12 slots.
- `Shift+1..4` cambia página.
- `B` abre/cierra libro.
- Drag & drop real de activos.
- Pasivos visibles, no arrastrables.
- Persistencia por subclase.
- Cada poder fuente derivado recibe firma SVG propia y determinista.

## MAP

**El Foso de Ceniza · Frontera**: 86 × 62, 66 obstáculos y 4 plataformas.

Última medición del World Agent:

- cobertura a ≤4 u: **67.3 %**;
- cobertura a ≤8 u: **99.0 %**;
- distancia media a cobertura: **3.26 u**;
- peor apertura a cobertura: **9.64 u**;
- pares con LoS: **33.8 %**;
- pares en rango de arquero con LoS: **49.2 %**;
- componentes conectados: **1**;
- loops centrales r5/r7/r9: **cerrados 100 %**;
- simetría: **180°**.

## AGENTS

`node tools/run-agents.js`

1. Power Catalog Agent — cobertura, originalidad runtime, daño fixed/pure.
2. Caster Gamefeel Agent — giro vs movimiento durante cast.
3. Actionbar/Powerbook Agent — 4×12, drag/drop, pasivos y controles.
4. World/Map Agent — tamaño, cobertura, LoS, conectividad y contratos de arena.
5. Presentation Critic — entrada v0.10, iconos/UI y frontera de autoridad.
6. Integration/QA Agent — sintaxis, suite completa e identidad visual.

**Resultado: AGENTS APROBADO · 6/6.**

## TESTS

Suite final: **306/306 verdes**.

La suite incluye un smoke exhaustivo en el que los **344 poderes activos** alcanzan `RELEASE` mediante el AbilitySystem sin excepciones. Las advertencias `listener roto a propósito` que aparecen durante la suite pertenecen al fixture adversarial del EventBus y son esperadas.

## ARBITER

`node tools/arbiter.js`

**ARBITER: APROBADO.**

El árbitro conserva los gates previos de RELEASE, queue/weaving, autoridad, movimiento, AnimationIntent, MatchFlow y bots, y añade gates de cobertura fuente, fixed damage, caster turn, 4×12, powerbook, smoke de 344 poderes, fan-out y arena 86×62.

## KNOWN LIMITATIONS

- Se intentó smoke real con `CHROME_BIN=/usr/bin/chromium node tools/browser.js smoke`. Chromium abre, pero la política administrada del entorno bloquea `127.0.0.1` antes de cargar el juego. Evidencia: `docs/qa-browser-loopback-block-v010.png`. El mensaje del driver `Arena no está definido` es consecuencia de estar sobre la página de bloqueo, no una excepción del build.
- Pointer Lock continúa como `MANUAL_BROWSER_REQUIRED`; un gesto sintético no puede certificarlo de forma honesta.
- Falta playtest humano real después de esta expansión.
- 60 FPS no se vuelve a declarar hasta medirlo en una GPU/navegador real.
- El balance definitivo y las fórmulas de armadura/resistencia para los 290 poderes quedan para una fase posterior por decisión explícita del milestone.
- Algunas mecánicas de mundo que no tienen equivalente útil en una arena local (por ejemplo, información social/Warmaster) se conservan como metadata/efecto táctico determinista, no como sistemas online inventados.
