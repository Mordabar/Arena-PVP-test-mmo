# CURRENT_BUILD_STATE

> Estado vivo de la construcción. Se actualiza al cierre de cada wave.
> Si una ejecución se interrumpe, el siguiente agente continúa **desde aquí**
> sin volver a descubrir el proyecto.

**Wave actual:** WAVE 1 — Barrido observable (en curso)
**Build importado:** Vertical Slice v0.8 (zip del usuario)
**Commit de importación:** `07339a4`
**Rama:** `claude/arena-mmo-concept-qeboc7`

---

## Qué acaba de ocurrir

El usuario entregó el proyecto como zip. Se comprobó que es **descendiente
directo** de esta rama (conserva el arreglo de handedness de A/D, `_faceIntent`,
`MOVE_SPEED_BASE 4.15`, arco frontal del ataque normal) y que añade por encima
el bucle de producto, el shell de UI, la iconografía y tres suites de test.

Se importó como commit propio, sin mezclar, para que el diff quede aislable.

## Estado verificado en esta sesión

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Suite completa | **215/215 verdes** | `node tools/run-tests.js` |
| Arranque `index.html` | OK, 0 errores | `tools/browser.js smoke` |
| Lobby renderiza | OK | `docs/shots/vs-01-lobby.png` |
| Lobby → countdown → ACTIVE | OK | sondeo de `flow.phase` |
| Combate con bot, daño aplicado | OK (1350 → 1132 HP) | sondeo en navegador |
| Errores JS durante partida | **0** | `window.onerror` + `unhandledrejection` |

### Desbloqueo importante

`FRESH_REVIEW_V08.md` declaraba el gate observable **pendiente** porque el
Chromium del entorno bloqueaba `127.0.0.1`. **Ese bloqueo ya no aplica aquí:**
`tools/browser.js` levanta un servidor estático en un puerto efímero y carga la
página por HTTP. El gate observable se puede ejecutar y se ejecutó.

---

## Hallazgos de esta sesión

### Falso positivo descartado (documentado para que no se persiga otra vez)

**El reloj de partida NO está roto.** Una primera medición sugería que
`matchElapsed` se quedaba en 0. La causa real es del entorno de medida: el
navegador headless corre rAF a ~4 fps y `realDt` está limitado a 0.1 s
(`Math.min(0.1, …)`, protección anti espiral de la muerte), así que el tiempo de
producto avanza a ~0.35× del tiempo de pared **sólo en headless**. A 60 fps el
tope nunca se activa.

Consecuencia real, menor: por debajo de 10 fps el countdown y el cronómetro de
partida corren más lentos que el reloj de pared. Clasificado **P2**, no
bloqueante, anotado en el ledger.

### Defectos abiertos observados (pendientes de verificar uno a uno)

| # | Sev | Descripción | Estado |
|---|---|---|---|
| D1 | P2 | Panel del Combat Lab superpuesto al HUD de partida | ABIERTO |
| D2 | P1 | Iconos repetidos dentro de una misma clase | **CERRADO** — 6 colisiones, 10 glifos nuevos, 4 tests |
| D3 | P2 | Reloj de producto ligado a fps por el tope de `realDt` | ABIERTO, documentado |
| D4 | — | Entrypoint por defecto | **RESUELTO** |
| D5 | — | «El jugador no hace daño» | **DESCARTADO** — era melee parado frente a arquero que kitea |

**D4 resuelto en autónomo.** `index.html` es ahora la presentación de Three.js
—la que tiene cielo con degradado, sombras de contacto, braseros y jerarquía de
valores— y el renderer nativo pasa a `index-webgl2.html` como respaldo sin
dependencias que sigue abriéndose con doble clic. El producto se enseña con su
mejor cara; el respaldo existe para quien no pueda servir por HTTP.

---

## Siguiente tarea inmediata

1. **D1**: confirmar la superposición del panel de laboratorio sobre el HUD de
   partida y ocultarlo cuando `flow.phase !== 'LOBBY'`.
2. Barrido observable de CASTING (prepare/release/GCD/queue/cancel) y de las
   seis clases jugadas una a una.
3. WAVE 5 (arena como diseño de nivel PvP) sigue sin empezar: la arena tiene
   obstáculos pero no responde a «dónde entra melee / dónde kitea el arquero /
   dónde rompe LoS el mago».
4. Jump / airborne / landing siguen en TODO.

## Tests fallando

Ninguno. **219/219.**

## Último resultado de árbitro

`docs/FRESH_REVIEW_V08.md` (agente anterior): sin críticos estáticos abiertos,
gate observable pendiente. **Ese gate ya no está pendiente** en lo básico
(arranque, flujo de partida, combate, cero errores); falta el barrido completo
de la Completion Matrix en ejecución.

## Última revisión visual

Lobby y combate capturados en esta sesión. El lobby tiene calidad de producto
—selector de clase, perfil de ladder, iconografía—, no de prototipo.
