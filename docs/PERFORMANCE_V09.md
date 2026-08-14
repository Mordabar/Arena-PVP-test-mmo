# Rendimiento — v0.9

```
node tools/browser.js play tools/scripts/perf-sweep.json
```

Cuatro sondas, **EXIT=0**.

---

## Lo que estos números NO dicen

**No hay GPU en este contenedor.** Chromium rasteriza por software con
SwiftShader. Publicar unos FPS medidos así como si fueran los del jugador sería
inventar el dato más importante del documento, así que esta puerta **no mide
fotogramas**.

Lo que sí mide es todo lo que es portable e igual de decisivo: el coste de la
simulación (que no toca GPU en absoluto), el presupuesto de dibujo, el techo del
sistema de partículas y las fugas. Un presupuesto que se dispara o una fuga tras
diez partidas se detectan igual sin tarjeta gráfica.

El objetivo de 60 FPS de `ARENA_VERTICAL_SLICE_SPEC.md` §19 sigue **pendiente de
una máquina con GPU**. Está anotado como tal y no se ha dado por bueno.

---

## Coste de la simulación

| | |
|---|---|
| Coste medio de un tick | **0.135 ms** |
| Presupuesto a 30 Hz | 33.3 ms |
| Ocupación | **0.4 %** |
| Medido sobre | 900 ticks = 30 s de 2v2 con bots activos |

La simulación es el único reloj que el jugador nota en las manos, y le sobra el
99.6 % de su presupuesto. Cualquier tirón que aparezca en una máquina real será
de dibujo, no de reglas — y eso es exactamente donde se quiere tener el margen,
porque el dibujo se puede bajar de calidad y las reglas no.

## Presupuesto de dibujo en combate

| | Pico en 2v2 | Techo |
|---|---|---|
| Draw calls | **640** | 900 |
| Triángulos | **41 253** | 400 000 |

Medido con cuatro personajes, bots activos y VFX en curso, no en escena vacía,
que es lo que pide el spec.

**Con las seis identidades de clase dentro.** Vestir a los personajes con equipo
propio —hombreras, faldares, escudo torre, carcajes, capas, sombreros— subió los
triángulos de 37 458 a 41 253, un 10 %, y **dejó los draw calls igual**: las
geometrías se suben una sola vez y se comparten, así que añadir piezas no añade
llamadas de dibujo. Sigue en el 10 % del techo de triángulos y el 71 % del de
draw calls.

## Partículas

| | |
|---|---|
| Pico vivo en combate | 88 |
| Tamaño del pool | 600, **estable** |
| Vivas 10 s después de parar | **0** |

El pool no crece: se reutiliza. Y al terminar el combate no queda nada
encendido.

## Fugas — diez ciclos de partida y reinicio

Lo que pide `QA_GATE.md` §14. Diez partidas completas alternando 1v1 y 2v2, con
vuelta al lobby entre cada una:

| | Primera ronda | Décima ronda |
|---|---|---|
| Entidades | 0 | **0** |
| Proyectiles | 0 | **0** |
| Zonas | 0 | **0** |
| Visuales de personaje | 0 | **0** |
| Nodos de DOM | 698 | **698** |
| Oyentes del bus | 87 | **87** |

Plano. Ni un nodo de DOM, ni un oyente, ni un visual de personaje de más después
de diez partidas.

---

## Un falso positivo, y por qué se comprobó antes de escribirlo

La primera medición decía «quedan 30 partículas vivas 10 s después de dejar de
pelear». Parecía una fuga.

No lo era: la sonda apagaba `aiEnabled`, pero `autoAttackOn` es una bandera **por
entidad**, así que los bots seguían soltando mandobles y lo que se medía era
combate en curso. Con el combate detenido de verdad —auto-ataque apagado,
casteos cancelados, estados retirados— la cuenta vuelve a **0**.

Se comprobó con una sonda aparte antes de escribir nada: sin combate desde el
principio, las partículas nunca pasan de cero.
