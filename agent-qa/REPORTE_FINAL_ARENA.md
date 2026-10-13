# Reporte final · Project Arena 1v1 · v0.39.0

Build `trainer-regnum-v039`. Árbol de trabajo: rama `claude/arena-mmo-concept-qeboc7`.
Snapshot previo a la sincronización con v0.39: etiqueta `pre-v039-agent-snapshot`.

Este reporte separa lo que se **comprobó** de lo que **no se pudo comprobar**. No certifica calidad visual ni de gamefeel: esa decisión es del usuario.

## 1. Versión y baseline

- Base de trabajo: zip `Project-Arena-v0.39-Trainer`, adoptado sobre el repositorio v0.34 (commit `3ca5957`). La versión más reciente manda, según CLAUDE.md.
- `CLAUDE.md`, `AGENTS.md` y el kit de skills instalados desde `ARENA_AGENT_SKILLS_KIT_v1_1` (commit `567f369`).
- `docs/ANIMATION_PLAYBOOK.md` presente.

## 2. Pruebas ejecutadas

| Prueba | Qué comprueba | Resultado |
|---|---|---|
| `tools/agent/arena-doctor.mjs` | Sintaxis de 70 JS, auditor de clips | 70/70 OK, 0 errores |
| `tools/tests/regnum-formulas.mjs` | 38 fórmulas históricas Regnum | PASS 38 |
| `tools/tests/trainer-039.mjs` | Catálogo del entrenador | OK |
| `tools/tests/duel-regression.mjs` | Duelos, recursos y cooldowns de los 36 poderes de kit | OK, 30 778 checks |
| `tools/tests/game-flow-regression.mjs` | Flujo de partida con HUD/renderer simulados | OK |
| `tools/tests/catalogue-smoke.mjs` | 382 poderes activos del catálogo | 0 errores de ejecución |
| `tools/tests/armor-comparison.mjs` (nueva) | Mitigación numérica, resistencias, debuffs | OK, 11 checks |
| `tools/tests/animation-regression.mjs` | Selección de estados, prioridades, mezcla nativa | OK |
| `tools/tests/animation-sequences-039.mjs` | Secuencias de pose por CPU | OK, 2018 checks, 42 instantáneas |
| `tools/tests/static-visual-039.mjs` | Rutas, SVG, VFX por CPU | OK |
| `tools/inspect-canvas.mjs --state combate` | Canvas no en blanco, presupuesto de render | APROBADO |
| `tools/e2e-duel.mjs` (6 clases) | Partida real en Chromium con teclado: lobby → arena → resultado → revancha → lobby | 6/6 recorren el flujo, 0 errores de consola |

Las pruebas de `tools/tests/` que importan Three.js necesitan el cargador local:
`node --experimental-loader ./tools/tests/three-loader.mjs tools/tests/<prueba>.mjs`.

## 3. Defectos encontrados y corregidos

1. **El debuff `resistBreak` no hacía nada.** Modificaba `entity.resist()`, que ningún código llama, y ningún poder lo aplica. Corregido en `js/combat/damageSystem.js`: `resistReductionPct` ahora reduce la resistencia elemental efectiva del objetivo. Cubierto por `armor-comparison.mjs`.
2. **El controlador E2E pulsaba W/Q/E a golpes**, así que el jugador casi nunca se acercaba. Corregido: las teclas de movimiento se mantienen mientras hagan falta. Esto es un defecto de la prueba, no del juego.
3. **Tiempo de espera insuficiente en E2E** para la cuenta atrás de 3 s en este contenedor. Subido a 120 s, con comentario que explica por qué.

## 4. Estado por punto del encargo

Estados según el skill `arena-armor-and-weapons`: `VALIDADO`, `PROVISIONAL`, `NO_PROBADO`, `BLOQUEADO_POR_ASSET`.

| Área | Estado | Evidencia y límite |
|---|---|---|
| Defensa numérica (armadura física) | VALIDADO | Más armadura → menos daño (400 → 296 → 192). Nota de balance: armadura ≥ golpe/0.52 anula el golpe por completo. Es la fórmula documentada del proyecto, no un fallo, pero conviene vigilarla al equilibrar. |
| Resistencia elemental | VALIDADO | Equipo `very good` reduce el daño mágico (400 → 281). |
| `resistBreak` / `armorBreak` | VALIDADO | Ambos suben el daño o reducen la defensa mientras duran y se restauran al expirar. |
| Daño puro | VALIDADO | Ignora armadura y resistencia. |
| Armas 3D (una mano, dos manos, bastón, arco) | PROVISIONAL | Enlazadas a `RightHand`/`LeftHand` del rig nativo y visibles en las capturas E2E. No se comprobó en secuencias de idle, avance, ataque, cast y muerte: NO_PROBADO en secuencias. |
| Escudo 3D (guardián) | PROVISIONAL | Visible en las capturas. Pendiente de secuencias. |
| Armadura visual equipable | **BLOQUEADO_POR_ASSET** | El renderer no tiene armadura visual: el gear procedural se retiró (`threeCharacter.js`, `buildGear`). `ARMADURA_VISUAL_PENDIENTE_POR_ASSET`. |

## 5. Poderes

- **Kit inicial** (6 por clase, 36 filas): matriz generada en `agent-qa/PODERES_ESTADO.csv` con `tools/powers-matrix.mjs`. Todos los tipos de efecto usados tienen manejador en `resolver.js`. La matriz **no** dice que los poderes se vean bien: la columna `visual_navegador` es `NO_EVIDENCIA` en todas las filas.
- **Catálogo del entrenador** (32 ramas, 290 poderes reales, 30 huecos excluidos): es una capa de construcción de personaje. Su lógica se prueba en `trainer-039.mjs` y `duel-regression.mjs`. No todos aparecen en la matriz de kit.
- Fuente de datos: `trainerdata.json` 1.35.19 (idéntico en ambos archivos subidos, md5 `0dfea955…`).

## 6. Animaciones

- Pruebas de secuencia por CPU pasan (2018 checks), pero **no hay verificación de secuencias en navegador en esta sesión**.
- Según `CONTINUIDAD.md`, arco, patada y lateral/retroceso son **PROVISIONALES** y no tienen clips originales. Se mantienen así; no se declaran finales.
- Capturas E2E disponibles en `agent-qa/e2e-*/` (lobby, arena, combate, resultado).

## 7. Partidas completas contra bot

| Clase | Flujo completo | Errores de consola | Nota |
|---|---|---|---|
| Devastador | sí | 0 | Tras el controlador corregido: jugador no llegó a contacto en 90 s |
| Guardián | sí | 0 | Atasco de COUNTDOWN resuelto con 120 s de espera |
| Centinela | sí | 0 | Pasada anterior al controlador corregido |
| Rastreador | sí | 0 | Pasada anterior al controlador corregido |
| Arcanista | sí | 0 | Pasada anterior al controlador corregido |
| Vinculador | sí | 0 | Pasada anterior al controlador corregido |

**Bloqueo real para juzgar el combate**: en este contenedor el renderizado por software da ~1 fotograma por segundo. El bucle de simulación capa el tiempo por fotograma a 0.1 s, así que el juego avanza a ~10 % de velocidad real. Con 90–150 s de prueba sólo se simulan 9–15 s de combate, y el jugador no llega al alcance cuerpo a cuerpo. Por eso **no se puede afirmar que el combate esté equilibrado ni que las clases ganen o pierdan correctamente**. Las derrotas de las pasadas anteriores no son una medida válida.

Para evaluarlo hace falta un navegador con GPU real o una partida humana en el PC del usuario.

## 8. Pendiente, con honestidad

- Armadura visual equipable: `BLOQUEADO_POR_ASSET`.
- Secuencias de armas y escudo en navegador (idle, avance, ataque, cast, muerte): NO_PROBADO.
- Calidad de animación de arco, patada y lateral/retroceso: PROVISIONAL, sin clips originales.
- Combate equilibrado y partidas completas medidas a velocidad real: bloqueado por el entorno (ver §7).
- Visual de los 36 poderes del kit: NO_EVIDENCIA.
- Balance de armadura: la anulación completa del golpe a partir de armadura ≥ golpe/0.52 es una decisión de diseño pendiente de revisión.
- Las 30 entradas placeholder del entrenador (`undefined`) siguen sin datos en la fuente.

## 9. Cómo reproducir

```
node tools/agent/arena-doctor.mjs
node tools/tests/armor-comparison.mjs
node tools/tests/duel-regression.mjs
node tools/e2e-duel.mjs --class devastador --max-s 90
node tools/powers-matrix.mjs
sh agent-qa/run-all-classes.sh
```
