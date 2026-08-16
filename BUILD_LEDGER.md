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


## MILESTONE v0.16 · UAL2 RETARGET LOCOMOTION — TESTED, visual Hostinger pendiente

Esta wave integra el paquete de animaciones UAL2 Standard suministrado sobre el Dark Elf skinned. **No se promueve a VERIFIED visual** porque el Chromium administrado del entorno bloquea `127.0.0.1` antes de cargar JavaScript.

| Gate | Estado |
|---|---|
| Full suite | **383/383 PASS** |
| UAL2 binary audit | **24/24 PASS** |
| Source power parity | **20/20 PASS** |
| Auditores especializados | **12/12 PASS** |
| Arbiter adversarial v0.16 | **APROBADO** |
| Visual critic estático | **APROBADO** |
| Browser smoke local | **EJECUTADO** — el navegador de este entorno sí carga el juego |
| Human Hostinger playtest | **TODO** |

Cambios auditables de esta wave:

- `A/D` son strafe izquierda/derecha; `Q/E` son giro izquierda/derecha. El mapping está centralizado en `js/core/controlMap.js` y tiene tests de signo/separación.
- UAL2 se usa para idle corporal, marcha forward/backpedal base, salto, hit recoil y melee; caster/archer mantienen sus acciones específicas.
- El strafe **no** reutiliza la caminata frontal rotada.
- El root motion de UAL2 jamás mueve la entidad; posición/yaw siguen en simulación.
- El retarget parte de bind WORLD fuente y reconstruye bind LOCAL del Dark Elf de 17 huesos.
- La piel se suaviza mediante normales recalculadas, sin volver a decimar el asset 50k.

Evidencia: `docs/BUILD_REPORT_V016.md`, `docs/ANIMATION_INTEGRATION_V016.md`, `docs/QA_TESTS_V016.txt`, `docs/QA_UAL2_V016.txt`, `docs/QA_ARBITER_V016.txt`, `docs/QA_VISUAL_STATIC_V016.txt`, `docs/QA_BROWSER_POLICY_BLOCK_V016.png`.

---

## El gate de navegador dejó de estar bloqueado, y encontró un P0

v0.16 se cerró **TESTED y no VERIFIED** porque su entorno bloqueaba `127.0.0.1`
antes de cargar JavaScript. En el entorno actual el navegador **sí** arranca el
juego, así que se ejecutó lo que faltaba. Encontró, en el primer fotograma:

> **Las seis clases eran el mismo elfo en ropa interior con un arma distinta.**

No fue un accidente: la ruta GLB dibujaba deliberadamente «cuerpo + arma» y el
árbitro lo blindaba con un gate. El modelo real entró y apagó el pase de
identidad visual —nueve filas de este ledger, 18.5 % de contorno medido— sin que
383 pruebas verdes ni doce auditores dijeran una palabra. **Ninguna suite puede
ver lo que no se dibuja.**

### Cerrado

| Qué | Cómo se comprueba |
|---|---|
| El equipo de las seis clases cuelga de los 17 huesos del modelo | `tools/scripts/gear-anim-gate.json` |
| Aguanta los **56 estados** de animación: idle, adelante, atrás, strafe, normal, poder, casteo, salto, impacto y muerte, por clase | el mismo gate: sin desprendimientos, sin congelados, sin pop y sin matrices no finitas |
| Las piezas encajan en el volumen del cuerpo real y no quedan por dentro | `tools/scripts/gear-fit.json` compara cajas envolventes |
| Los anclajes entre los dos esqueletos | `tools/rig-report.js` los imprime; no se estiman |

### Dos falsos positivos más del arnés, ninguno del producto

1. «La bota ignora la locomoción» — era **foot locking** haciendo su trabajo: el
   pie apoyado está clavado en el suelo mientras el cuerpo pasa por encima.
2. «Catorce piezas hacen pop a la vez al atacar» — se movió el **esqueleto
   entero** al arrancar el clip de ataque. Cada pieza acompañó a su hueso
   exactamente. El listón correcto no es el desplazamiento del personaje, es el
   movimiento del propio hueso.

**Veintiuno en total en el proyecto. Cero informes falsos publicados.**

---

## RESUMEN

| | |
|---|---|
| Filas obligatorias | **146** |
| VERIFIED | **145** |
| MANUAL_BROWSER_REQUIRED · Pointer Lock | **1** |

**145 / 146 VERIFIED + 1 MANUAL_BROWSER_REQUIRED.**

La fila 146 **no se marca verde**. Pointer Lock exige un gesto humano real y
Chromium lo rechaza literalmente cuando nace de un evento sintético
(`WrongDocumentError: The root document of this element is not valid for
pointer lock`). Poner 146/146 sería falsificar el único número que este
documento existe para proteger. El procedimiento para cerrarla a mano, sobre
el build ya desplegado, está en `docs/POINTER_LOCK_MANUAL.md` y tarda un
minuto.

**Y sigue faltando el gate humano.** Nadie ha jugado esto todavía:
`docs/PLAYTEST_CHECKLIST.md`.

La cuenta, para que sea auditable y no una cifra de confianza:

| Bloque | Filas | VERIFIED | Cuáles |
|---|---|---|---|
| MOVEMENT | 16 | 12 | WASD, diagonales, salto/aire/aterrizaje, colisión y combate |
| CAMERA | 10 | 9 | + 1 MANUAL_BROWSER_REQUIRED: Pointer Lock, que el navegador no concede a un gesto sintético |
| TARGETING §5 | 10 | 9 | + Tab, aliados, objetivo inválido y muerte |
| NORMAL · CASTING · CC | 60 | 60 | 18 sondas cubren §4 y §5 de QA_GATE dentro del juego |
| CLASSES | 12 | 12 | las 36 habilidades ejecutadas en navegador |
| CHARACTERS · ANIM · VFX | 24 | 24 | + las seis identidades de clase, medidas por contorno y miradas en captura |
| ARENA | 6 | 6 | diseño de nivel medido |
| UI · ICONOS | 5 | 5 | iconografía, selector y el modelo de lectura del HUD |
| BOTS · GAME LOOP | 3 | 3 | roles, bucle completo y rematch |

Suite: **288/288 verdes**. Once puertas ejecutables en verde, incluidas la de
animación con sus 15 sondas seguidas y la de identidad visual con sus tres
vistas medidas.

### Cómo se reproduce todo esto

```
node tools/run-gates.js          # batería + arena + HUD + casteo + clases + animación
node tools/run-gates.js --rapido # sólo lo que no necesita navegador
```

Termina en rojo si falla cualquiera. Es lo que separa «lo he mirado y se veía
bien» de algo que otra persona puede repetir.

---

## MOVEMENT

Arrastre de ratón: `node tools/browser.js play tools/scripts/mouse-sweep.json`.
Las filas 20 y 21 llevaban desde el principio marcadas como no verificables «sin
ratón real». No lo eran: el driver sólo sabía teclear. Ahora dispatcha
`mousePressed` → varios `mouseMoved` → `mouseReleased` y mide el resultado.

Barrido observable: `node tools/browser.js play tools/scripts/control-sweep.json`
— **9 sondas, EXIT=0**, cubriendo QA_GATE §6 dentro de la partida.

Una corrección **del arnés**: escribí «izquierda es −Z» de memoria y me volví a
invertir A/D, igual que le pasó al juego en su día. La sonda deriva ahora el
lado del mismo convenio que usa la simulación —`F = (sin yaw, cos yaw)`,
`R = F × up`— y proyecta el desplazamiento sobre él, así que no hay memoria que
equivocar.

| # | Fila | Estado | Nota |
|---|---|---|---|
| 1 | forward | VERIFIED | en partida: W avanza +3.73 u proyectados sobre el frente del cuerpo |
| 2 | backward | VERIFIED | S retrocede sobre el mismo eje, sin auto-girar |
| 3 | strafe left | VERIFIED | bug de handedness corregido y cubierto por test de signo |
| 4 | strafe right | VERIFIED | ídem |
| 5 | diagonals | VERIFIED | la diagonal recorre lo mismo que el recto: está normalizada |
| 6 | start | TESTED | estado START en locomoción |
| 7 | stop | TESTED | estado STOP |
| 8 | turn in place | TESTED | |
| 9 | mouse steer | VERIFIED | `_faceIntent` 1:1; probado en navegador |
| 10 | free look | VERIFIED | la cámara gira y el yaw del cuerpo no cambia ni un dígito |
| 11 | jump | VERIFIED | arco autoritativo; root lo bloquea; cancela casteo sin castigo, comprobado en partida |
| 12 | airborne | VERIFIED | el salto real llega a `intent.airborne` en el mismo tick; en vuelo `canUse` responde `airborne` y el normal no libera |
| 13 | landing | VERIFIED | absorción al tocar suelo que se disuelve sola; saltar en marcha no congela el avance |
| 14 | collision | VERIFIED | 150 frames corriendo: la cámara nunca queda dentro de geometría ni bajo el suelo |
| 15 | movement during combat | VERIFIED | moverse cancela el windup y el casteo sin daño ni coste fantasma |
| 16 | cast movement cancellation | TESTED | `CAST_MOVE_TOLERANCE` |

## CAMERA

| # | Fila | Estado | Nota |
|---|---|---|---|
| 17 | follow | VERIFIED | observado en partida |
| 18 | zoom | VERIFIED | respeta mínimo y máximo bajo 60 pasos en cada sentido |
| 19 | pitch | VERIFIED | respeta ambos topes |
| 20 | left drag | VERIFIED | **con ratón real dispatchado**: arrastre de 260 px → cuerpo −0.8190 y cámara −0.8190, idénticos |
| 21 | right free-look | VERIFIED | arrastre derecho de 240 px → cámara 0.7560, cuerpo **0** exacto |
| 22 | pointer lock | **MANUAL_BROWSER_REQUIRED** | Chromium rechaza el `requestPointerLock()` que nace de un evento sintético con `WrongDocumentError`. Lo automatizable SÍ está verde: que el arrastre lo **solicite** por la ruta real, que el 1:1 se cumpla con eventos de ratón de verdad, que la mirada libre no gire el cuerpo y que el diagnóstico manual funcione sin escribir simulación (`tools/scripts/pointerlock-gate.json`). Falta que un humano se lo conceda: `docs/POINTER_LOCK_MANUAL.md`, un minuto sobre el build desplegado |
| 23 | drag deadzone | TESTED | umbral doble tiempo+píxeles |
| 24 | collision | VERIFIED | plataformas incluidas; el ojo sigue el suelo bajo él |
| 25 | no target lock | VERIFIED | auto-encarado eliminado; 4 tests |
| 26 | no snap | VERIFIED | soltar la mirada libre no produce salto de cámara |
| 27 | estable a distintos FPS | VERIFIED | resultado del normal idéntico a 30/60/120/144 |

## TARGETING

| # | Fila | Estado |
|---|---|---|
| 28 | click selection | VERIFIED |
| 29 | Tab | VERIFIED |
| 30 | ally targeting | VERIFIED |
| 31 | target highlight | VERIFIED |
| 32 | range | VERIFIED |
| 33 | facing | VERIFIED |
| 34 | LoS | VERIFIED |
| 35 | invalid targets | VERIFIED |
| 36 | target death | VERIFIED |

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

### Siluetas: seis clases, seis contornos — CERRADO

```
node tools/silhouette-report.js            # perfil y matriz de distancias
node tools/silhouette-report.js --bandas   # además, banda a banda
node tools/run-tests.js Identidad          # 20 pruebas de contrato y contorno
```

**El punto de partida era malo y estaba medido.** Existían tres familias de
arquetipo —espada, arco, báculo— y eso cumplía el §17 del spec, pero no el §5 de
la constitución: las seis clases eran tres parejas de gemelos.

```
devastador ≈ guardian     Δmasa 1.2 %
centinela  ≈ rastreador   Δmasa 0.3 %
devastador ≈ rastreador   Δmasa 4.5 %   ← cruzando arquetipos
```

**Lo primero que hubo que arreglar fue el medidor.** Sumar volúmenes de caja no
mide una silueta: dos personajes con la misma masa pasaban por distintos aunque
uno fuera una columna y el otro un cubo. `render/poseMetrics.js` mide ahora el
CONTORNO —anchura ocupada en 16 bandas horizontales, desde tres vistas— sobre
los vértices reales densificados por arista. La caja envolvente convertía un
cono en un cilindro, es decir, borraba justo la diferencia que se quería medir.

Contorno distinto entre cada pareja, en la peor de las tres vistas:

| | devast | guardi | centin | rastre | arcani | vincul |
|---|---|---|---|---|---|---|
| **devastador** | · | 35 % | 28 % | 21 % | 30 % | 19 % |
| **guardian** | 35 % | · | 42 % | 43 % | 46 % | 22 % |
| **centinela** | 28 % | 42 % | · | 27 % | 29 % | 29 % |
| **rastreador** | 21 % | 43 % | 27 % | · | 20 % | 33 % |
| **arcanista** | 30 % | 46 % | 29 % | 20 % | · | 37 % |
| **vinculador** | 19 % | 22 % | 29 % | 33 % | 37 % | · |

**Peor pareja: 18.5 %. Antes: 0.3 %.**

Y cada clase cumple además la lectura que declara, comprobado por separado: el
Guardián es el más ancho, el Arcanista el más alto, el Centinela más esbelto que
su hermano de arquetipo, el Devastador estrecha la cintura donde el Guardián no,
y el Vinculador queda por debajo del Arcanista.

#### Cómo se construyó — sistema, no seis hacks

| Fichero | Qué aporta |
|---|---|
| `render/equipment.js` | 24 fábricas paramétricas: hombrera, peto, gola, faldar, capelina, capa, túnica, capucha, sombrero, yelmo, carcaj, bolsa, trampa, espada, maza, escudo, arco, báculo… |
| `data/classVisuals.js` | el perfil de cada clase como DATOS: proporciones, peso de armadura, paleta, piezas por socket, armas, accesorios |
| `render/characterVisual.js` | ya sólo COLOCA lo que el perfil declara; se fueron las tres ramas `outfit === 'plate' | 'leather' | 'robe'` |

Una prueba comprueba que `buildPose` no vuelve a mencionar ninguna clase por su
nombre. Añadir una séptima clase es añadir una entrada de datos.

De paso se terminó lo que el agente de personajes dejó a medias antes de caer:
`composeBuild()` y `girth` existían en `data/races.js` y **no los usaba nadie**.
Ahora el grosor del tronco es independiente de la anchura de hombros, que es
exactamente lo que da la V del atacante y lo que faltaba.

#### Lo que las capturas encontraron y los números no

El bucle de calidad incluye mirar el fotograma, y menos mal:

| Defecto | Cómo se veía |
|---|---|
| La capelina del Vinculador salía **invertida** | un embudo abierto hacia el cielo alrededor de la cabeza: la fábrica tomaba el radio del dobladillo por el del cuello |
| El escudo torre del Guardián se veía **de canto** | la inclinación heredada del escudo redondo dejaba la plancha casi horizontal. Un escudo torre visto de canto es un palo |
| El arco del Centinela **desaparecía** de frente | perfectamente de canto justo en la vista que más importa |
| La diadema del Vinculador parecía **cuernos** | puntas largas y separadas en un personaje que tiene que comunicar lo contrario |

Ninguno de los cuatro lo habría detectado la métrica: los cuatro los detectó una
persona mirando una captura de la cámara real de juego.

#### Y dos trampas del arnés, otra vez

La primera tanda de capturas salió con **una pierna estirada un metro hacia un
lado**. No era el modelo: la sonda teletransportaba al personaje al punto de la
foto y el foot locking mantenía el pie plantado donde estaba, haciendo
exactamente su trabajo. Ahora el personaje **camina** hasta el sitio. La segunda:
`getPlayer()` hay que volver a pedirlo después de `setPlayerClass()`, o se mueve
una referencia huérfana y el encuadre sale vacío.

**El ojo manda sobre la métrica.** Un 18.5 % de contorno distinto es un suelo,
no un aprobado: una diferencia estadística no garantiza una diferencia
perceptual. Por eso el punto 8 de `docs/PLAYTEST_CHECKLIST.md` pregunta lo único
que importa —«si estuvieran todas en gris y sin nombre, ¿las distinguirías?»— y
la respuesta humana gana a la tabla de arriba.

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

## RENDIMIENTO

Detalle en `docs/PERFORMANCE_V09.md`; se reproduce con
`node tools/browser.js play tools/scripts/perf-sweep.json` (4 sondas, EXIT=0).

| Medida | Resultado | Techo |
|---|---|---|
| Coste de un tick de simulación | **0.135 ms** (0.4 % del presupuesto) | 33.3 ms |
| Draw calls, pico en 2v2 | 641 | 900 |
| Triángulos, pico en 2v2 | 37 458 | 400 000 |
| Partículas vivas 10 s tras parar | **0** | pool estable en 600 |
| Diez partidas: DOM / oyentes / entidades | 685 → 685, 87 → 87, 0 → 0 | sin crecimiento |

**Lo que esta puerta NO afirma:** no hay GPU en este contenedor, así que no mide
fotogramas y no se inventan. El objetivo de 60 FPS del spec §19 sigue pendiente
de una máquina con tarjeta gráfica, y así está anotado.

Un falso positivo comprobado antes de escribirlo: «quedan 30 partículas 10 s
después de parar» era combate en curso —apagar `aiEnabled` no apaga
`autoAttackOn`, que es por entidad—, no una fuga. Con el combate detenido de
verdad la cuenta vuelve a 0.

## BOTS · GAME LOOP

| # | Fila | Estado | Nota |
|---|---|---|---|
| 144 | bots con comportamiento por rol | VERIFIED | seis perfiles jugando sus duelos dentro de la banda de TTK |
| 145 | lobby → partida → resultado | VERIFIED | ejecutado en navegador esta sesión |
| 146 | rematch | VERIFIED | vuelta a partida desde resultados, con perfil de ladder conservado |

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

---

## ADDENDUM v0.15 · SKINNED ANIMATION REBUILD

**Estado de esta wave:** `TESTED` / auditorías automáticas verdes; **no se promueve a VERIFIED visual** hasta mirarla en navegador real desplegado.

Las capturas de v0.14 mostraron que el modelo skinned estaba integrado con una arquitectura visual equivocada: matrices de pose del maniquí procedural se transferían a un skeleton con bind distinto y, además, el equipo procedural seguía montándose sobre el cuerpo GLB. Ese camino se elimina en v0.15.

| Gate | Resultado |
|---|---|
| Suite completa | **367/367** |
| Skinned Animation v0.15 | **12/12** |
| Agentes/revisores relevantes | **11/11** |
| Modelo | **50.000 tris · 76.070 vértices · 17 huesos · 1 skin** |
| Skinning | **PASS** |
| Árbitro adversarial | **APROBADO** |
| Critic visual estático | **APROBADO** |
| Browser visual real | **EJECUTADO** — ver más abajo: encontró un P0 que ninguna suite verde detectó |

### Cambio de contrato visual

`CharacterVisual` deja de ser una fuente de matrices para el GLB. Su handle continúa aportando el estado de locomoción/acción/cast/CC, pero `SkinnedAnimationContract` lo convierte en offsets locales sobre el bind real del modelo. La simulación continúa siendo autoridad y RELEASE no depende de la animación.

### Cuerpo limpio

En la ruta skinned sólo se muestra cuerpo + arma. Se elimina la composición procedural de armadura/ropa/accesorios que en v0.14 atravesaba o flotaba sobre el modelo.

### Referencias de movimiento

Caster y arquero se reconstruyen a partir de los principios visibles en las secuencias suministradas por el usuario: preparación clara, cadena corporal, release legible y recuperación. La animación no replica clips propietarios. Melee usa una gramática original derivada de la cadena `pie → pelvis → torso → hombro → arma`.

### Gate nuevo del arquero

Una prueba FK sobre el bind real exige que en full draw:

- la mano del arco quede proyectada al frente;
- la mano de cuerda quede detrás de la mano de arco;
- la mano de cuerda se mantenga cerca del eje del rostro;
- su altura permanezca anatómicamente plausible.

La primera implementación falló esta puerta y fue corregida antes del cierre.
