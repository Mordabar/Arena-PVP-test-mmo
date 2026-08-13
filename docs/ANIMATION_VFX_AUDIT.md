# Animación y VFX — auditoría en ejecución

Las 32 pruebas unitarias de animación comprueban **reglas** sin navegador:
foot locking, cadencia derivada de la velocidad, capas independientes, IK,
determinismo, contrato neutral. Todas verdes desde hace tiempo.

Lo que no comprobaban es si algo de eso **llega a la pantalla**. Y no llegaba:
durante commits enteros el entrypoint del producto no disparó ni una animación
de combate. La suite seguía verde.

Este documento recoge la auditoría que sí lo mira:

```
node tools/browser.js play tools/scripts/anim-vfx-sweep.json
```

---

## 1. El P0 que motivó todo esto

`vfx.js` escucha los eventos de combate y llama a `triggerAttack`,
`beginCast` y `triggerHurt` sobre el personaje. Les pasaba `renderer.visuals[id]`.

En el renderer nativo eso **es** el handle del backend de personaje. En el de
Three.js es un envoltorio de escena que **contiene** el handle. Y
`CV.triggerAttack` empieza así:

```js
if (!st.cfg) return;   // aún no ha corrido el primer update
```

El envoltorio no tiene `cfg`. Return silencioso, sin error, sin aviso.

Resultado en el entrypoint del producto: **cero ataques, cero casteos, cero
reacciones al daño**. La locomoción se construye en `updateCharacter`, por otro
camino, y por eso los personajes seguían andando, corriendo y girando con
normalidad. Nadie mira una captura y piensa «aquí falta la mitad de la
presentación» cuando el personaje camina bien.

Sonda, misma habilidad, antes y después:

| | familia de acción en siete muestreos de `Embestida brutal` |
|---|---|
| antes | `null` × 7 |
| después | `charge`, fase IMPACT → RECOVERY, peso 1 → 0.81 → 0.07 → 0 |

**Corrección**: `characterHandleOf(id)` entra en el contrato del renderer. Los
dos lo implementan, y quien necesita el handle lo pide en lugar de deducir qué
guarda `visuals`. Un contrato que declara un contenedor sin declarar su
contenido no es un contrato.

---

## 2. Resultado del barrido

| Puerta | Estado | Medida |
|---|---|---|
| Acciones · las 36 habilidades mueven el cuerpo | ✓ verde | 36/36 ejecutadas, de 3 a 10 gestos distintos por clase |
| Control · lenguaje corporal propio | ✓ verde | KNOCKDOWN, STUN y ROOT distintos entre sí y en la intención |
| VFX · emiten y se apagan | ✓ verde | ninguna de 24 habilidades muda; pico 13 partículas → 0 tras 6 s |
| Locomoción · seis direcciones, seis ciclos | ~ | cinco estados distintos, pico 1.20 en las seis, 53 piezas de pose sin NaN. Falta confirmar el caso «parado» con el montaje asentado |
| Reacción al daño · aditiva | ~ | pico de reacción 0.942 y se disuelve sola. Falta medir la recuperación en carril despejado |
| Muerte · gana a cualquier control | ✗ sin resolver | la sonda lee `alive: true` y `crowdControl: 'DEATH'` a la vez, que `AI.build` no puede producir en una sola llamada. Está instrumentada para devolver el `entityId` de la intención y decidir si es handle cruzado (defecto real) o montaje del arnés |

**Las tres primeras están confirmadas y son las que cierran el P0.** Las tres
últimas siguen en medición y NO se dan por buenas: dos por ajuste del arnés
—ambas medían corriendo contra una barrera del foso— y una por una
contradicción sin explicar que puede ser un defecto de verdad.

Gestos distintos por clase: Devastador 10, Rastreador 7, Arcanista 6,
Vinculador 6, Centinela 4, Guardián 3. El Guardián es el más pobre y tiene
explicación: cuatro de sus seis poderes declaran `visualAction: 'none'` a
propósito (guardia, interponer, égida, postura son estados, no gestos).

---

## 3. Falsos positivos del arnés, documentados para que no se repitan

Ninguno de estos era un defecto del juego. Todos parecían serlo.

| Lo que parecía | Lo que era |
|---|---|
| «Ninguna acción produce familia» | cierto la primera vez — era el P0. Después, el arnés |
| «Las partículas no se apagan: 26 → 26» | el arnés no llamaba a `VFX.update` |
| «La pose tiene 0 piezas» | `pose` se rellena en `render()`, no en `syncVisuals()` |
| «Avanzar no anima» | el arnés medía tras correr 1.6 s contra una barrera |
| «Parado, el ciclo llega a 0.14» | el teletransporte del montaje se lee como arranque (pendiente de confirmar con los frames de asentado) |
| «La estasis no llega a la animación» | la fatiga global de control rechazaba la cuarta aplicación seguida. En aislado: `stasis → STASIS`, `silence → SILENCE`, `disarm → DISARM` |
| «Las habilidades de aliado fallan por rango» | el arnés colocaba al lanzador junto al enemigo |

La regla que sale de aquí: **antes de escribir un defecto, demostrar que el
arnés mide lo que dice medir.** Una sonda que pasa en vacío es peor que una que
falla.

---

## 4. Lo que esta auditoría NO dice

Mide que la presentación **responde**: que cada poder mueve el cuerpo, que cada
control tiene pose, que las partículas nacen y mueren, que ninguna pose contiene
NaN ni valores absurdos.

No dice que **se vea bien**. El peso de un mandoble, la legibilidad de un
telegraph a distancia de duelo, si el Guardián con tres gestos se siente pobre
en la mano: eso necesita ojos humanos. Está anotado como pendiente en el ledger
y no se ha maquillado como verificado.
