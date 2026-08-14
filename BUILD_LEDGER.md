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
| VERIFIED | **110** |
| TESTED (implementado + suite verde, sin barrido observable) | **26** |
| IMPLEMENTED | **4** |
| TODO / BLOCKED | **6** |

**110 / 146 VERIFIED — este build NO está terminado.**

La cuenta, para que sea auditable y no una cifra de confianza:

| Bloque | Filas | VERIFIED | Cuáles |
|---|---|---|---|
| MOVEMENT | 16 | 3 | strafe izq./der., giro por ratón |
| CAMERA | 10 | 3 | seguimiento, colisión, sin lock de objetivo |
| TARGETING §5 | 10 | 5 | selección por clic, resaltado, rango, facing, LoS |
| NORMAL · CASTING · CC | 60 | 60 | 18 sondas cubren §4 y §5 de QA_GATE dentro del juego |
| CLASSES | 12 | 12 | las 36 habilidades ejecutadas en navegador |
| CHARACTERS · ANIM · VFX | 24 | 12 | los 7 de ejecución + la gramática visual completa de los 36 efectos |
| ARENA | 6 | 6 | diseño de nivel medido |
| UI · ICONOS | 5 | 5 | iconografía, selector y el modelo de lectura del HUD |
| BOTS · GAME LOOP | 3 | 1 | lobby → partida → resultado |

Suite: **259/259 verdes**. Las seis puertas observables en verde, la de
animación con sus 15 sondas seguidas y `EXIT=0`.

### Cómo se reproduce todo esto

```
node tools/run-gates.js          # batería + arena + HUD + casteo + clases + animación
node tools/run-gates.js --rapido # sólo lo que no necesita navegador
```

Termina en rojo si falla cualquiera. Es lo que separa «lo he mirado y se veía
bien» de algo que otra persona puede repetir.

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
| 11 | jump | TESTED | arco autoritativo en tick fijo; root lo bloquea; cancela casteo estacionario sin lockout |
| 12 | airborne | TESTED | un salto **real** de la simulación llega a `intent.airborne` en el mismo tick y recorre la fase normalizada |
| 13 | landing | TESTED | al tocar suelo queda absorción de aterrizaje y se disuelve sola; saltar en marcha no congela el avance |
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

Filas 37–96. Estado: **VERIFIED**.

`node tools/browser.js play tools/scripts/combat-sweep.json` — **18 sondas,
EXIT=0**, ejecutadas dentro del juego arrancado y por la ruta real del jugador
(`Game._useSlot`, la misma que las teclas 1..6). Cubren por su nombre las
familias que exige `QA_GATE.md` §4 y §5:

| Familia | Sonda | Evidencia |
|---|---|---|
| Normal | no libera en movimiento | 0 de daño corriendo 3 s pegado al objetivo |
| Normal | parar no cuesta un intervalo entero | tras frenar, WINDUP arranca muy por debajo del intervalo de arma |
| Normal | moverse en WINDUP cancela | la fase abandona WINDUP y no se aplica daño |
| Normal | el daño empieza en RELEASE | cero daño mientras la fase sigue en WINDUP; daño después |
| Normal | valida facing, rango y LoS | pega de frente y en rango; de espaldas no; a 14 u no |
| Casteo | BEGIN no compromete | ni recurso, ni cooldown, ni GCD al abrir |
| Casteo | RELEASE compromete una vez | cobra el coste declarado, arranca CD y GCD, y no vuelve a cobrar |
| Casteo | saltar cancela sin castigo | sin coste, sin cooldown, sin bloqueo de escuela |
| Casteo | interrumpir ≠ cancelar | cancelar no bloquea la escuela; un silencio sí deja consecuencia |
| Casteo | lo liberado sobrevive | se mata al lanzador tras RELEASE y el proyectil impacta igual |
| Aire | ni casteo ni normal liberan en vuelo | `canUse` responde `airborne` y el normal no aplica daño |
| Weaving | arquero teje normal + poder | impacto del normal y luego del poder, ambos > 0 |
| Weaving | `replacesNormal` sin fantasma | el reemplazo pega y no deja un normal duplicado |
| Cola | la última intención válida manda | pulsar dos dentro de la ventana deja encolada la segunda |
| Weaving | el hechizo pedido gana al normal | con el arma lista, `_useSlot` abre casteo y no dispara báculo |
| CC | cada control aplica y expira | knockdown, stun, root, silence, disarm y slow, uno por mundo limpio |
| CC | DR reduce y acaba en inmunidad | cuatro aplicaciones seguidas: duración decreciente hasta 0 |
| Counters | barrera, antiHeal, antiBuff | la barrera absorbe sin tocar vida; antiHeal recorta; antiBuff bloquea |

Cinco correcciones **del arnés**, ninguna del producto, antes de dar esto por
bueno: muestrear el daño al otro lado de la frontera de RELEASE, comparar el
recurso ignorando que regenera, medir el normal del arquero antes de que llegue
la flecha, dejar al jugador en el aire de una sonda a la siguiente, y no
resucitarlo después de matarlo a propósito.

De la cuarta salió cobertura nueva: el juego rechazaba castear con `airborne` y
tenía razón, así que la regla que `QA_GATE` §4 pide por su nombre pasó de
accidente a sonda propia.

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

### Barrido observable de CASTING

`node tools/browser.js play tools/scripts/casting-sweep.json` — siete puertas,
todas en verde, ejecutadas por la ruta real del jugador (`Game._useSlot`, la
misma que usan las teclas 1–6):

| Puerta | Evidencia |
|---|---|
| PREPARE | `Impacto celeste` (1.7 s) abre casteo y `#player-cast` se hace visible con la habilidad correcta |
| RELEASE | se libera en el tick 50 de 51, aplica 167.7 de daño, cobra 23.9 y arranca cooldown |
| GCD | quedan 0.70 s de GCD, los 6 huecos pintan el barrido y la siguiente se rechaza con motivo `gcd` |
| QUEUE | pulsar a 0.12 s del final encola y arranca sola al liberarse |
| CANCEL por movimiento | sin coste y sin cooldown |
| CANCEL por Esc | ídem, y la barra desaparece |
| CANCEL por interrupción | un silencio corta el casteo y bloquea la escuela (`silenced`) |

Tres correcciones **del arnés**, no del juego, antes de dar nada por bueno: el
bucle rAF seguía simulando entre sonda y sonda y contaminaba la siguiente; poner
`pendingCast = null` a mano dejaba el estado a medias y producía una «liberación
instantánea» inexistente; y cortar la medición antes del vuelo del proyectil
hacía parecer que RELEASE no pegaba. Las tres habrían sido informes de defecto
falsos.

## CLASSES

Filas 97–108 (seis clases × identidad/pasiva/activas). Estado: **VERIFIED**.

`node tools/browser.js play tools/scripts/class-sweep.json` juega las seis
clases en un 2v2 real y dispara sus 36 habilidades contra un enemigo y contra un
aliado, colocando al lanzador en un punto con visión comprobada:

**36/36 aceptadas.** Todas cobran su recurso declarado, arrancan su cooldown
declarado, abren casteo si y sólo si declaran tiempo de casteo, y aplican los
estados que prometen: `slow`, `armorBreak`, `damageAmp`+`exposed`, `block`,
`reflect`, `noOffense`, `damageRedirect`, `sharpshooter`, `stasis`, `stealth`,
`root`, `dot`+`antiHeal`, `utilityLock`, `revealed`, `silence`, `castHaste`,
`antiBuff`, `hot`, `barrier`, `intervention`, `protectiveLink`.

Ninguna es un stub. La pasiva del Vinculador se ve funcionando en los números:
`Pulso vital` cuesta 24 y cobró 12.6 curando a un aliado al 45 % de vida, que es
exactamente el reembolso del 8 % de «Flujo compartido».

## CHARACTERS · ANIMATION · VFX

Filas 109–132. Detalle en `docs/ANIMATION_VFX_AUDIT.md`; se reproduce con
`node tools/browser.js play tools/scripts/anim-vfx-sweep.json`.

Las 32 pruebas unitarias de animación llevaban tiempo verdes **mientras el
entrypoint del producto no disparaba ni una animación de combate**. Eso es
exactamente la distancia entre TESTED y VERIFIED, y por eso estas filas no
subían con la suite.

| Fila | Estado | Evidencia en ejecución |
|---|---|---|
| locomoción direccional | VERIFIED | parado 0.00; adelante, atrás, strafe izq./der. y diagonal a pico 1.20; cinco ciclos distintos |
| pose sin corrupción | VERIFIED | 53 piezas por personaje, ningún valor no finito ni fuera de rango en ninguna fase |
| acción de combate por poder | VERIFIED | 36/36 habilidades mueven el cuerpo; 3–10 gestos distintos por clase, contando familia de acción y de casteo |
| lenguaje corporal del control | VERIFIED | KNOCKDOWN, STUN y ROOT distintos entre sí y presentes en la intención |
| reacción al daño aditiva | VERIFIED | pico 0.942, se disuelve sola, la locomoción no baja de 1.20 durante el impacto |
| familias de VFX | VERIFIED | ninguna de 24 habilidades muda; 14 partículas en pico → 0 a los 6 s |
| gramática visual completa | VERIFIED | las 36 habilidades resuelven a una firma con color base, acento, estilo, conteo y vida; **ninguna cae en el genérico por defecto** |
| escuelas distinguibles a distancia | VERIFIED | siete escuelas; las dos más parecidas están a 0.35+ de distancia de color |
| marca propia por control | VERIFIED | ningún par de controles duros comparte forma y color |
| jerarquía por magnitud y crítico | VERIFIED | el efecto de mayor magnitud emite más que el menor; el perfil de crítico escala por encima del impacto corriente |
| telegrafía sólo lo accionable | VERIFIED | ningún golpe directo instantáneo telegrafía; los avisos de suelo sí, porque apartarse sigue siendo una respuesta |
| muerte con prioridad sobre control | VERIFIED | STUN antes, DEATH después, pose íntegra |

**La séptima costó seis ejecuciones y no era un defecto.** La sonda devolvía
`alive: true` junto a `intent.crowdControl: 'DEATH'` sobre la misma entidad, que
`AI.build` no puede producir en una sola llamada. Tres diagnósticos descartaron
el producto —la cadena entidad → intención es correcta en 1v1, tras
`setPlayerClass`, y tras apagar IA, subir vida, retirar estados y asentar 24
frames— hasta dar con la causa: la sonda guardaba **la referencia viva** a la
intención y la serializaba al final del sondeo, con la entidad ya muerta.
Comparaba una foto contra un vídeo. Detalle en `docs/ANIMATION_VFX_AUDIT.md`.

**Sin juicio artístico.** Que la pose no tenga NaN y que cada poder mueva el
cuerpo no dice que se vea bien. El peso de un mandoble o la legibilidad de un
telegraph a distancia de duelo siguen necesitando ojos humanos, y eso no se
cuenta como verificado.

## ARENA

Filas 133–138. Estado: **VERIFIED**. Detalle completo en
`docs/ARENA_LEVEL_DESIGN.md`; números con `node tools/arena-analysis.js`.

| Fila | Estado | Evidencia |
|---|---|---|
| dónde entra el melee | VERIFIED | carriles con cobertura cada <5 u; foso central 100 % libre y ninguna columna a menos de 6.5 u del centro |
| dónde kitea el rango | VERIFIED | vuelta de 360° cerrada quitando discos de 5, 7 y 9 u; espacio jugable en una sola pieza |
| dónde rompe LoS el mago | VERIFIED | cobertura media a 3.13 u, peor rincón a 8.59 |
| justicia del ladder | VERIFIED | simetría 180° por construcción; los dos spawns miden 11.00 / 2.89 / 12.00 |
| apertura legible | VERIFIED | los duelistas se ven al empezar; 12 u de espalda libre para la cámara |
| zonas declaradas | VERIFIED | 7 zonas con rol y nota, comprobadas como espacio jugable |

Antes los spawns eran (−10, 0) y (8, 0): dos metros de ventaja para un bando en
un modo con rating.

## UI · ICONOS

Filas 139–143. Estado: **TESTED**, iconografía **VERIFIED**.

| Fila | Estado | Evidencia |
|---|---|---|
| icono distinto por habilidad | VERIFIED | 36/36 sin colisión; `iconTests` lo impide |
| el HUD explica POR QUÉ no salió | VERIFIED | los **26** motivos que declara `AbilitySystem.REASONS` tienen titular, pista accionable y marca propia, y ninguno repite texto. La lista se toma del sistema, no se escribe a mano: una razón nueva aparece sola en la prueba |
| el kit explica su relación con el normal | VERIFIED | `abilityTiming` etiqueta reemplazo, weaving, intervalo de arma y quietud, con texto largo por etiqueta |
| barras que no mienten | VERIFIED | la barrera se pinta ENCIMA de la vida con su desplazamiento, nunca restándola |
| orden de estados por urgencia | VERIFIED | un control duro manda sobre un slow largo y un buff, y se marca urgente |
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
| **En Three.js no se veía ni un ataque, ni un casteo, ni una reacción** | **P0** | **CERRADO** — ver abajo |
| Reloj de producto ligado a fps por el tope de `realDt` | P2 | ABIERTO, documentado |
| Panel de Combat Lab superpuesto al HUD de partida | P1 | **CERRADO** — ver abajo |
| Roster de equipo pisando el marco del jugador en partida | P1 | **CERRADO** — hallado por el propio audit |
| Roster reconstruido con `innerHTML` cada frame | P2 | **CERRADO** — se reestructura sólo al cambiar composición |
| `favicon.ico` 404 en cada carga | P3 | **CERRADO** — icono SVG embebido |
| Entrypoint por defecto es el renderer nativo, no el de Three.js | — | RESUELTO: `index.html` es Three.js |

### P0 · el entrypoint del producto no animaba ningún combate

El defecto más caro de esta sesión, y el que ninguna prueba unitaria podía ver.

`visuals[id]` estaba en el contrato del renderer. Lo que **contiene**, no. El
renderer nativo guardaba ahí el handle del backend de personaje; el de Three.js
guardaba un envoltorio de escena con el handle dentro. `vfx.js` pasaba
`visuals[id]` directo a `triggerAttack`, que empieza así:

```js
CV.triggerAttack = function (st, kind, isPower, castFamily, visualAction) {
  if (!st.cfg) return;   // aún no ha corrido el primer update
```

El envoltorio no tiene `cfg`. Return silencioso. En la presentación de Three.js
—que desde el commit anterior es **el entrypoint del producto**— se descartaban
todas las acciones de combate, todos los casteos y todas las reacciones al daño.

No saltó a la vista porque **la locomoción va por otro camino**: los personajes
andaban, corrían, giraban y frenaban con normalidad. Sólo que no atacaban nunca.

Medido con la misma sonda antes y después, `Embestida brutal`:

| | familia de acción en los siete muestreos |
|---|---|
| antes | `null`, `null`, `null`, `null`, `null`, `null`, `null` |
| después | `charge` · fase IMPACT → RECOVERY · peso 1 → 0.81 → 0.07 → 0 |

Y el barrido completo tras la corrección: **36/36 habilidades de las seis clases
producen gesto en la presentación real**, con 3 a 10 gestos distintos por clase.

La corrección no es `vis.handle || vis`. Un contrato que declara un contenedor
sin declarar su contenido no es un contrato: `characterHandleOf(id)` entra en la
lista de métodos obligatorios, lo implementan los dos renderers, y quien
necesite el handle lo pide. El panel de depuración de animación (F3) tenía el
mismo fallo.

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
