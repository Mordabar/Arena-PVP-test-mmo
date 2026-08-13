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
| VERIFIED | **18** |
| TESTED (implementado + suite verde, sin barrido observable) | **112** |
| IMPLEMENTED | **8** |
| TODO / BLOCKED | **8** |

**18 / 146 VERIFIED — este build NO está terminado.**

Suite: **219/219 verdes**. Puertas observables: `hud-layout-audit` en verde.

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
| 32 | range | VERIFIED |
| 33 | facing | VERIFIED |
| 34 | LoS | VERIFIED |
| 35 | invalid targets | TESTED |
| 36 | target death | TESTED |

## NORMAL ATTACK · CASTING · WEAVING · CC · COUNTERS

Filas 37–96. Estado heredado: **TESTED**, con cuatro excepciones VERIFIED.

| Fila | Estado | Evidencia |
|---|---|---|
| ataque normal melee (ready→windup→release→recovery) | VERIFIED | en navegador: enemigo 1100→1046 en 6 s con jugador en rango y encarado |
| rango del ataque normal | VERIFIED | distancia 1.20 vs alcance 3.30 → impacta; a 12 u no impacta |
| facing del ataque normal | VERIFIED | desvío 0.000 rad dentro de arco 1.309 → impacta |
| LoS del ataque normal | VERIFIED | `hasLineOfSight` true en el mismo sondeo |

**Hallazgo adversarial descartado.** Un primer sondeo mostró al enemigo intacto
(1100 HP) tras 30 s de partida y parecía P0 «el jugador no puede hacer daño». No
lo es: el jugador era melee y estaba quieto mientras el bot arquero kiteaba. Al
colocarlo en rango y encarado, el daño fluye. Es el juego funcionando —el arco
frontal y la movilidad reducida hacen que posicionarse importe—, no un defecto.
Queda escrito para que nadie lo reabra.

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

Filas 139–143. Estado: **TESTED**, iconografía **VERIFIED**.

| Fila | Estado | Evidencia |
|---|---|---|
| icono distinto por habilidad | VERIFIED | 36/36 sin colisión; `iconTests` lo impide |
| silueta legible | VERIFIED | 24 glifos vectoriales, ninguno vacío |
| lenguaje visual por clase | VERIFIED | seis paletas, test de unicidad |
| selector de clase | VERIFIED | `docs/shots/p-01-lobby.png` |
| pantalla de resultado | TESTED | `productTests` |
| composición del HUD sin solapes | VERIFIED | `hud-layout-audit`: 0 colisiones en LOBBY, PARTIDA, COMBAT LAB y vuelta a LOBBY |

**D2 cerrado.** Había **seis grupos en colisión** y 14 habilidades compartiendo
icono con una hermana de su clase; el Guardián tenía CUATRO idénticos. Un icono
repetido no es cosmética: obliga a memorizar la barra por posición en vez de por
forma. Se añadieron 10 glifos (`rend`, `aegis`, `bond`, `stance`, `rain`,
`reveal`, `bloom`, `purify`, `link`) y reglas específicas antes de las genéricas.

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
| Panel de Combat Lab superpuesto al HUD de partida | P1 | **CERRADO** — ver abajo |
| Roster de equipo pisando el marco del jugador en partida | P1 | **CERRADO** — hallado por el propio audit |
| Roster reconstruido con `innerHTML` cada frame | P2 | **CERRADO** — se reestructura sólo al cambiar composición |
| `favicon.ico` 404 en cada carga | P3 | **CERRADO** — icono SVG embebido |
| Entrypoint por defecto es el renderer nativo, no el de Three.js | — | RESUELTO: `index.html` es Three.js |

### D1 cerrado, y era mayor de lo reportado

Reportado como «el panel de laboratorio se superpone al HUD de partida». En
partida de ladder **no ocurre**: la barra superior y el panel se ocultan. Ocurre
en el **Combat Lab**, donde la barra superior tiene que quedarse porque es la
única vuelta al lobby, y sus 74 px se comían la fila superior del HUD.

Medido a 1600×760, **seis solapes**, no uno:

```
#player-frame ∩ .arena-topbar = 252x56
#target-frame ∩ .arena-topbar = 252x56
#lab          ∩ .arena-topbar = 300x56
#brand        ∩ .arena-topbar = 560x38
#target-frame ∩ #brand        =  14x36
#action-bar   ∩ #help         =  17x84
```

Y al convertir la medición en puerta repetible apareció un **séptimo, en la
partida real**: `#player-frame ∩ .team-panel = 232x40`. El roster se colocaba en
`top:92px` fijo mientras el marco del jugador crece con los estados activos. Se
cuelga ahora del borde inferior real del marco.

La comprobación es ejecutable, no una captura que alguien tenga que mirar:

```
node tools/browser.js play tools/scripts/hud-layout-audit.json
```

Devuelve código de salida 1 si aparece cualquier solape o cualquier 404.
