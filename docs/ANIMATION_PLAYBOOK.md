# Cómo desarrollar animación en este proyecto — playbook para una IA

> Este documento existe porque el patrón que rompió la animación en este
> proyecto **no fue una mala decisión técnica concreta**: fue que cada sesión
> de IA reinició la arquitectura desde cero sin leer qué había, tomó un atajo
> distinto al de la sesión anterior, y nunca lo verificó en un navegador real.
> El resultado, repetido varias veces: "dije que estaba resuelto y no lo estaba".
>
> Esto no es una guía genérica de Three.js. Es el mapa de **lo que este
> proyecto tiene hoy**, con comandos que puedes ejecutar para comprobar cada
> afirmación tú mismo antes de creerla — incluidas las de este documento.

---

## 0 · Los tres hechos que no se negocian

1. **El cuerpo es el maniquí nativo de Quaternius (UAL), con sus 65 huesos,
   tal cual.** No hay retargeting a otro esqueleto. No hay modelo custom. Si
   una idea implica "adaptar las animaciones a un rig distinto", es la idea
   equivocada — ya se intentó, se documentó por qué fallaba (espejo de
   lateralidad, poses que no se alcanzan) y se abandonó a propósito.
2. **La simulación manda.** Posición, yaw, RELEASE, daño, cooldowns, GCD y
   legalidad de objetivo los decide `js/sim/` y `js/combat/`. Todo lo que hay
   en `js/render/` **lee** ese estado; nada de esto lo escribe. Si tu cambio
   toca un `entity.pos`, `entity.hp` o similar desde un fichero de animación,
   es un bug de arquitectura, no un detalle.
3. **Un clip que no existe en los binarios no está "resuelto".** Este
   proyecto ya declaró clips como `FINAL` que no estaban en ningún `.glb`.
   `tools/audit-clips.mjs` existe exactamente para que eso no vuelva a pasar
   sin que nadie se entere.

---

## 1 · Mapa del sistema, de arriba abajo

```
entity (simulación)                         ← verdad. Nunca se toca desde aquí.
   │
   ▼
render/characterVisual.js                   ← INTENCIÓN: locomoción, fase de
   │  CV.update()                              acción, casteo, control de masas.
   │                                            Estado neutral, sin geometría.
   ▼
render/animationStateMachine.js             ← QUÉ CLIP toca. Traduce la
   │  S.select(handle, archetype)              intención en {clip, mask, fade}.
   ▼
data/animationSourcePlan.js                 ← CATÁLOGO de clips por rol, con
data/animationProfiles.js                      status honesto (FINAL/PROVISIONAL/
                                                MISSING/...) y de dónde sale cada
                                                uno. Puros datos.
   ▼
render/three/threeDirectAnim.js             ← APLICACIÓN. Sanitiza clips,
   │  createDirectLibrary/resolveSelection/     compone lower+upper cuando hace
   │  clipFor/DirectPlayer                      falta, corre el AnimationMixer
   │                                            sobre el maniquí nativo.
   ▼
render/three/threeCharacter.js              ← ORQUESTA el fotograma: decide
   applySkinnedPose()                           mask/composición según el estado
                                                y aplica el resultado al GLB.
```

**Antes de tocar nada, identifica en qué capa está tu problema.** Si el
personaje ataca en el momento equivocado, el problema casi seguro está en
`characterVisual.js` o en la sincronía con `entity.weaponState` — no en
`threeDirectAnim.js`. Si el clip correcto no aparece, el problema está en
`animationStateMachine.js` o en el catálogo. Si el clip aparece pero se ve mal
(pie que patina, brazo que se retuerce), el problema está en
`threeDirectAnim.js` o es que el clip en sí no sirve para lo que se le pide.

---

## 2 · Los ficheros, uno por uno

| fichero | qué decide | qué NO decide |
|---|---|---|
| `render/characterVisual.js` | locomoción, ventana de acción, progreso de casteo, mezcla de CC | ningún nombre de clip, ninguna geometría |
| `render/animationStateMachine.js` | el ESTADO (`IDLE`, `WALK`, `ACTION`...) y su `mask`/`fade` | si el clip existe de verdad |
| `data/animationSourcePlan.js` | qué clip real corresponde a cada rol semántico, por clase | si ese clip está bien animado |
| `data/animationProfiles.js` | cobertura auditable del vertical slice (qué estados centrales tienen algo) | lo mismo que arriba, a otro nivel |
| `render/three/threeDirectAnim.js` | sanitización de clips, composición lower/upper, reproducción | posición/yaw de la entidad (los descarta a propósito) |
| `render/three/threeCharacter.js` | orquesta el fotograma completo por personaje | reglas de combate |

**Ninguno de estos ficheros duplica al otro.** Si vas a "arreglar la
animación" tocando cinco ficheros a la vez, párate: probablemente estás a
punto de reintroducir una segunda fuente de verdad.

---

## 3 · Los tres assets reales, y sólo estos

```
assets/animations/ual1-arena-runtime.glb    17 clips  (cuerpo + locomoción + casteo)
assets/animations/ual2-melee-runtime.glb    13 clips  (espada, escudo)
assets/animations/ual2-rm-runtime.glb        1 clip   (root motion horneado)
assets/animations/arena-cmu-v031.json       10 clips  (CMU: retroceso, strafe, giro, patada)
```

**41 clips reales en los binarios.** Ni uno más. Cualquier nombre de clip que
escribas en un contrato de datos tiene que salir de esta lista, comprobada,
no de memoria ni de lo que dice un comentario.

(`tools/audit-clips.mjs --list` mostrará 45: los 41 de aquí más los 4 que
`threeDirectAnim.js` sintetiza en runtime a partir de clips reales — ver §6.)

```bash
node tools/audit-clips.mjs --list              # los 41, con su fuente
node tools/audit-clips.mjs --clip Sword_Regular_A   # ¿existe? ¿dónde?
```

---

## 4 · Procedimiento para añadir o arreglar UN estado de animación

Sigue este orden. Saltarte un paso es exactamente cómo se llegó al estado
anterior del proyecto.

### Paso 1 — Verifica que el clip existe, antes de escribir nada

```bash
node tools/audit-clips.mjs --clip Nombre_Del_Clip
```

Si no existe, tu tarea real es **decidir el fallback honesto** (¿otro clip
real? ¿gramática procedural? ¿marcarlo `MISSING` y seguir?), no inventar un
nombre y asumir que "ya aparecerá".

### Paso 2 — Declara el rol en `data/animationSourcePlan.js`

Un `slot(clip, status, role, extra)` con el `STATUS` que corresponda de
verdad. Si el clip es una solución provisional, `PROVISIONAL`, no `FINAL`. El
sistema de status sólo protege si se usa con honestidad.

### Paso 3 — Conecta el rol en `render/animationStateMachine.js`

Es aquí donde `S.select()` decide, a partir del `handle` (intención) y el
`archetype`, qué slot usar y con qué `mask`. Mira `combatUpper()` y
`locomotionFromSlot()` como ejemplos de cómo ya se hace.

### Paso 4 — Corre la auditoría de datos

```bash
node tools/audit-clips.mjs
```

Tiene que salir en verde. Si tu cambio introduce una referencia rota, esto lo
dice ANTES de que lo veas (o no lo veas) en pantalla.

### Paso 5 — Verifícalo en un navegador real

Esto es obligatorio, no opcional. Nada de lo anterior demuestra que se VE
bien.

```bash
node tools/inspect-canvas.mjs --state combate
```

Abre el PNG que deja en `qa/canvas-combate.png` y **míralo**. El informe JSON
te da draw calls/triángulos/geometrías contra presupuesto, pero el veredicto
final sobre si una animación se ve bien lo da el ojo, no un número.

Para dirigir el estado exacto que quieres inspeccionar, edita el `ADAPTADOR`
de `tools/inspect-canvas.mjs` o añade una llamada directa por consola:

```js
Arena.Game.startMatch('1v1', 'devastador');
// ... adelantar el mundo ...
Arena.Game.renderer.visuals[playerId] // handle del personaje en pantalla
```

### Paso 6 — Compara con el estado anterior

Si tenías una captura de antes de tu cambio, compárala. `inspect-canvas.mjs`
guarda `metrics` (entropía de color, densidad de bordes, contraste) que
cambian de forma medible si algo se rompió visualmente — un T-pose, por
ejemplo, baja la entropía y los bordes en seco.

---

## 5 · Lo que este proyecto YA hace bien — no lo reinventes

- **Composición lower+upper.** `threeDirectAnim.js` ya sabe tomar la parte
  inferior de un clip de acción y sostener la parte superior en una pose de
  guardia (o al revés). Es lo que usan arco y magia mientras caminan. Antes
  de escribir tu propia mezcla de máscaras, mira `clipFor()`.
- **Status honesto por slot.** El sistema `FINAL_USER_LOCKED` /
  `PROVISIONAL` / `SOURCE_DERIVED` / `MISSING_EXACT_CLIP` /
  `MISSING_EXACT_FALLBACK_PLAYABLE` ya existe y ya se usa en casi todo el
  catálogo. Es bueno. Complétalo, no lo sustituyas.
- **Reloj autoritativo del ataque normal.** `characterVisual.js` ya sincroniza
  el `impact` del clip con el `RELEASE` real de la simulación
  (`ws.phase === 'WINDUP'` / `'RELEASE'` / `'RECOVERY'`). No inventes un
  segundo reloj para la animación.

---

## 6 · Lo que está roto AHORA MISMO, medido, no supuesto

Ejecuta `node tools/audit-clips.mjs` en cualquier momento para ver el estado
actual. A fecha de escribir esto:

**Los cuatro clips Source del arco no existen: `Bow_Aim_Neutral`,
`Bow_Notch`, `Bow_Shoot`, `Bow_RapidShoot`.** Están en el contrato de datos
pero ausentes de los 45 clips reales — son de la biblioteca UAL2 *Source*, que
este proyecto no tiene, sólo la *Standard*.

**Esto NO significa que el arquero esté roto.** Cada uno de esos slots declara
un `fallback` (`Arena_Archer_VideoReady/VideoNotch/VideoShoot/VideoBuff`), y
esos SÍ funcionan: `threeDirectAnim.js` los **sintetiza en runtime**
(`buildVideoArcherClips()`) a partir de `Pistol_Aim_Neutral` +
`Pistol_Reload`, que sí existen. Comprobado en navegador real:
`animLib.has('Arena_Archer_VideoReady') === true`.

Esta es la trampa exacta que hay que evitar: `audit-clips.mjs`, por ser
estático, **no ve** clips sintetizados en runtime — la primera versión de esta
misma herramienta los marcaba como ausentes por error, hasta que se comprobó
en un navegador de verdad y se corrigió (ver el bloque
`SINTETIZADOS_EN_RUNTIME` dentro del script). Si algún día
`buildVideoArcherClips()` cambia y deja de producir esos nombres, hay que
actualizar esa lista o el auditor volverá a mentir — en el sentido seguro
(dirá que existen aunque no), así que la comprobación en navegador sigue
siendo la que manda.

Lo que sí queda pendiente de verdad: si esos cuatro fallbacks video-derived se
VEN bien de arquero (silueta de tiro, pies, torso) es una pregunta de
`inspect-canvas.mjs` + ojo humano, no de este auditor.

---

## 7 · Prohibido, con el motivo real de cada prohibición

| NO hagas esto | por qué, exactamente |
|---|---|
| Retargetear a un esqueleto distinto al maniquí nativo | Ya se hizo, se midió el fallo (72° de diferencia de pose de reposo entre T-pose y brazos colgando, espejo de lateralidad) y se abandonó. Repetirlo es repetir el mismo defecto ya diagnosticado. |
| Declarar `status: FINAL` sin correr `audit-clips.mjs` | Es exactamente el hueco que dejó el arquero roto sin que nadie lo notara. |
| "Arreglar" una animación sin capturar el resultado en `inspect-canvas.mjs` | Un cambio de datos que compila no es un cambio verificado. La sintaxis nunca fue el problema de este proyecto. |
| Escribir una segunda función que decide qué clip tocar, en paralelo a `animationStateMachine.js` | Es cómo se llega a dos fuentes de verdad compitiendo. Todo el que decide clip pasa por `S.select()`. |
| Mover posición/yaw/hp desde cualquier fichero de `render/` | El contrato de autoridad de la simulación no es una sugerencia. `render/` lee, nunca escribe. |
| Asumir que un clip "debería estar" en el binario porque el nombre suena lógico | Compruébalo. `node tools/audit-clips.mjs --clip <nombre>` tarda un segundo. |

---

## 8 · Cuando termines

No digas "arreglado" sin poder enseñar:

1. La salida en verde de `node tools/audit-clips.mjs`.
2. Un PNG de `tools/inspect-canvas.mjs` con el estado en cuestión, mirado de
   verdad — no sólo generado.
3. Qué `STATUS` quedó en cada slot que tocaste, y si sigue siendo honesto.
