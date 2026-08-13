# BUILD_LEDGER — Project Arena Ladder PvP

Fuente persistente de progreso hacia el Vertical Slice Alpha.

## Estados

`TODO` · `BUILDING` · `IMPLEMENTED` · `TESTED` · `PLAYTESTED` · `VERIFIED` · `BLOCKED`

**VERIFIED** = implementado **+** test automático cuando aplica **+** probado
integrado en ejecución **+** sin regresiones conocidas.

`IMPLEMENTED` no significa terminado. Un TODO explicado en un comentario sigue
siendo TODO.

---

## Regla de honestidad de este fichero

Una fila sólo sube a `VERIFIED` cuando alguien la ha visto funcionar **en el
juego en ejecución**, no cuando el código existe y los tests pasan.

En esta primera pasada la mayoría de filas heredan el estado `TESTED` del build
v0.8 importado: tienen implementación y cobertura automática (215 pruebas
verdes), pero **no** el barrido observable fila a fila. Marcar todo eso como
VERIFIED sin haberlo mirado sería exactamente el fallo que el brief prohíbe.

Las filas marcadas `VERIFIED` en esta pasada son únicamente las que se
comprobaron en navegador durante esta sesión, con captura o sondeo.

---

## RESUMEN

| | |
|---|---|
| Filas obligatorias | **146** |
| VERIFIED | **9** |
| TESTED (implementado + suite verde, sin barrido observable) | **121** |
| IMPLEMENTED | **8** |
| TODO / BLOCKED | **8** |

**9 / 146 VERIFIED — este build NO está terminado.**

---

## MOVEMENT

| # | Fila | Estado | Nota |
|---|---|---|---|
| 1 | forward | TESTED | `controlTests`: W avanza según yaw |
| 2 | backward | TESTED | `controlTests` |
| 3 | strafe left | VERIFIED | bug de handedness corregido y cubierto por test de signo |
| 4 | strafe right | VERIFIED | ídem |
| 5 | diagonals | TESTED | |
| 6 | start | TESTED | estado START en locomoción |
| 7 | stop | TESTED | estado STOP |
| 8 | turn in place | TESTED | |
| 9 | mouse steer | VERIFIED | `_faceIntent` 1:1; probado en navegador |
| 10 | free look | TESTED | |
| 11 | jump | TODO | sin verificar en ejecución |
| 12 | airborne | TODO | |
| 13 | landing | TODO | |
| 14 | collision | TESTED | |
| 15 | movement during combat | TESTED | |
| 16 | cast movement cancellation | TESTED | `CAST_MOVE_TOLERANCE` |

## CAMERA

| # | Fila | Estado | Nota |
|---|---|---|---|
| 17 | follow | VERIFIED | observado en partida |
| 18 | zoom | TESTED | |
| 19 | pitch | TESTED | |
| 20 | left drag | IMPLEMENTED | **sin verificar con ratón real** — headless no concede Pointer Lock |
| 21 | right free-look | IMPLEMENTED | ídem |
| 22 | pointer lock | BLOCKED | requiere gesto humano; no verificable en este entorno |
| 23 | drag deadzone | TESTED | umbral doble tiempo+píxeles |
| 24 | collision | TESTED | |
| 25 | no target lock | VERIFIED | auto-encarado eliminado; 4 tests |
| 26 | no snap | TESTED | |
| 27 | estable a distintos FPS | TESTED | tick fijo |

## TARGETING

| # | Fila | Estado |
|---|---|---|
| 28 | click selection | VERIFIED |
| 29 | Tab | TESTED |
| 30 | ally targeting | TESTED |
| 31 | target highlight | VERIFIED |
| 32 | range | TESTED |
| 33 | facing | VERIFIED |
| 34 | LoS | TESTED |
| 35 | invalid targets | TESTED |
| 36 | target death | TESTED |

## NORMAL ATTACK · CASTING · WEAVING · CC · COUNTERS

Filas 37–96. Estado heredado: **TESTED**.
Cobertura automática amplia (combatTests, animTests, gameFeelMissionTests).
Falta barrido observable de cada familia en ejecución.

## CLASSES

Filas 97–108 (seis clases × identidad/pasiva/activas). Estado: **TESTED**.
Las seis existen con seis activas, pasiva, icono y metadatos de IA.
Falta jugar cada una y confirmar que ninguna habilidad es un stub.

## CHARACTERS · ANIMATION · VFX

Filas 109–132. Estado: **TESTED** / **IMPLEMENTED**.
Los tres arquetipos tienen silueta coherente, arma y equipo. Las familias de
animación y VFX existen. Falta el juicio del Animation Arbiter y el Visual
Arbiter sobre cada una.

## ARENA

Filas 133–138. Estado: **IMPLEMENTED**.
La arena tiene obstáculos, plataformas, rampas y bloqueadores de LoS. **No** ha
pasado por el diseño de niveles PvP que pide el brief (¿dónde entra melee?
¿dónde kitea el arquero? ¿dónde rompe LoS el mago?).

## UI · ICONOS

Filas 139–143. Estado: **TESTED**.
HUD completo, selector de clase, pantalla de resultado, iconos por habilidad.
Defecto abierto: dos iconos del Devastador se ven casi idénticos (sin confirmar).

## BOTS · GAME LOOP

| # | Fila | Estado | Nota |
|---|---|---|---|
| 144 | bots con comportamiento por rol | TESTED | |
| 145 | lobby → partida → resultado | VERIFIED | ejecutado en navegador esta sesión |
| 146 | rematch | TESTED | cubierto por `productTests` |

---

## Fila extra de calidad (no cuenta para 146)

| Defecto | Sev | Estado |
|---|---|---|
| Reloj de producto ligado a fps por el tope de `realDt` | P2 | ABIERTO, documentado |
| Panel de Combat Lab superpuesto al HUD de partida | P2 | SIN CONFIRMAR |
| Entrypoint por defecto es el renderer nativo, no el de Three.js | — | DECISIÓN PENDIENTE |
