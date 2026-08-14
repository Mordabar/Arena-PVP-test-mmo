# Árbitro adversarial — v0.9

Revisión de esta sesión. El criterio no es «¿compila y se ve bien?» sino
**¿qué afirmación de este build no está respaldada por una medición que otra
persona pueda repetir?**

Reproducir todo:

```
node tools/run-gates.js
```

---

## 1. El hallazgo que justifica toda la sesión

La revisión anterior (`FRESH_REVIEW_V08.md`) cerró con «sin críticos
estáticos/arquitectónicos abiertos» y el gate observable declarado bloqueado por
el entorno. Esa conclusión era correcta **para lo que una revisión estática puede
mirar**. En cuanto el gate observable se pudo ejecutar apareció un **P0**:

> En la presentación de Three.js —el entrypoint del producto— no se disparaba
> **ni una sola animación de combate**. Ni ataques, ni casteos, ni reacciones al
> daño. Durante commits enteros.

La causa fue un contrato incompleto: `visuals[id]` estaba declarado, su contenido
no. Los dos renderers guardaban cosas distintas ahí y `vfx.js` pasaba el
contenido equivocado a `triggerAttack`, que se salía en su primera línea.

Nadie lo vio porque **la locomoción va por otro camino**. Los personajes
caminaban, corrían, giraban y frenaban perfectamente. Sólo que no atacaban.

**Lección para el siguiente árbitro:** una suite verde y una captura bonita son
compatibles con que la mitad de la presentación esté muerta. La única defensa es
ejecutar y medir lo que sale por pantalla.

---

## 2. Defectos encontrados y cerrados

| # | Sev | Defecto | Cómo se encontró |
|---|---|---|---|
| 1 | P0 | Ninguna animación de combate en el entrypoint del producto | sondeando `actionFamily` en la intención viva |
| 2 | P1 | Seis solapes del HUD con el chrome en Combat Lab | midiendo rectángulos, no mirando capturas |
| 3 | P1 | Roster de equipo pisando el marco del jugador en partida | apareció al convertir la medición en puerta |
| 4 | P1 | Spawns de duelo asimétricos en un modo con rating | análisis de la arena |
| 5 | P1 | La cámara entraba dentro de las plataformas | prueba de suelo bajo el ojo |
| 6 | P1 | 14 habilidades compartían icono con una hermana de clase | test de colisiones de glifo |
| 7 | P2 | Roster reconstruido con `innerHTML` 60 veces por segundo | leyendo el código al arreglar el solape |
| 8 | P2 | Fixture de balance naciendo dentro de un muro | contrato de arena |
| 9 | P2 | Dos maniquíes del laboratorio dentro de columnas nuevas | contrato de escenarios |
| 10 | P3 | `favicon.ico` 404 en cada carga | auditoría de recursos |

---

## 3. Falsos positivos que NO se reportaron

Esto importa tanto como lo anterior. Un informe de defectos con ruido hace que
se deje de leer.

| Sospecha | Realidad |
|---|---|
| «El jugador no hace daño» | Melee parado frente a un arquero que kitea. En rango y encarado: 1100 → 1046 en 6 s |
| «El reloj de partida está parado» | rAF a ~4 fps en headless + tope de `realDt` a 0.1 s. A 60 fps no se activa |
| «RELEASE no aplica daño» | La medición cortaba antes de que llegara el proyectil |
| «El casteo se libera al instante» | El arnés ponía `pendingCast = null` a mano y dejaba el estado a medias |
| «Las partículas no se apagan» | El arnés no llamaba a `VFX.update` |
| «Las instantáneas no cobran recurso» | El arnés muestreaba el recurso después de `tryUse` |
| «Ninguna habilidad de aliado funciona» | El arnés colocaba al lanzador junto al enemigo, no junto al aliado |
| «Avanzar no anima» | El arnés medía tras 1.6 s de correr contra una barrera |
| «La estasis no llega a la animación» | La fatiga global de control rechazaba la cuarta aplicación seguida. En aislado funciona |
| «La intención dice DEATH sobre una entidad viva» | La sonda guardaba la referencia viva a la intención y la serializaba al final, ya muerta la entidad |

Diez informes falsos evitados verificando el arnés antes que el juego.

El último costó **seis ejecuciones del barrido** y tres sondas de diagnóstico
que descartaron el producto una por una. Merecía ese gasto: la alternativa era
publicar «la animación de muerte se aplica a personajes vivos», que habría
mandado a alguien a buscar durante días un fallo inexistente en la capa de
animación.

---

## 4. Lo que seguía sin verificar tras la primera vuelta *(histórico)*

En ese momento el ledger decía 52 de 146. Se conserva para que se vea de dónde
salió cada fila; el estado actual está en la sección 8.

1. **CHARACTERS · ANIMATION · VFX**: siete filas verificadas en ejecución, pero
   **sin juicio artístico**. Que la pose no tenga NaN y que cada poder mueva el
   cuerpo no dice que se vea bien. 17 de las 24 filas del bloque siguen sin
   barrido.
2. **Jump / airborne / landing**: TODO.
3. **Pointer Lock**: BLOCKED, headless no lo concede sin gesto humano.
4. **La IA no usa las rutas de cobertura** que la arena ahora ofrece.
5. **Ninguna regla premia la altura** de las plataformas.
6. **Sin playtest humano.** Todo lo de arriba es medición. El ritmo, la
   legibilidad y la sensación de peso necesitan a alguien jugando.

---

## 5. Segunda vuelta: de 52 a 136 filas

| Bloque | Cómo se cerró |
|---|---|
| Combate 37–96 (60 filas) | 18 sondas dentro del juego, por la ruta real del jugador |
| Movimiento, cámara, targeting | 9 sondas + arrastre de ratón real dispatchado |
| Presentación (HUD y VFX) | 16 pruebas sobre las dos capas puras |
| Rendimiento | 4 sondas: 0.135 ms/tick, diez partidas sin fugas |

Cinco falsos positivos más del arnés, ninguno del producto: muestrear el daño al
otro lado de RELEASE, ignorar que el recurso regenera, medir el disparo del
arquero antes de que llegue la flecha, dejar al jugador en el aire entre sondas,
y no resucitarlo después de matarlo. **Quince en total en la sesión.**

Y dos errores míos que merecen mención porque son el mismo error del proyecto:
escribí «izquierda es −Z» de memoria y volví a invertir A/D —justo lo que el
usuario reportó roto en su día—, y puse un umbral de silueta de 0.04 % que no
podía fallar. Los dos se detectaron comparando contra el convenio derivado en
vez de contra la memoria.

## 6. Tercera vuelta: el Character Identity Pass

### El defecto era el medidor, no sólo el modelo

La ronda anterior cerró con nueve filas abiertas y tres parejas de clases
confundibles. Al ir a arreglarlas apareció algo peor que el problema original:

> **La métrica que declaraba el problema no podía medir la solución.**

`silhouette-sweep` sumaba volúmenes de caja. Con eso, un cono y un cilindro del
mismo radio pesan lo mismo, así que una túnica acampanada y una columna daban
idéntico. Se estaba midiendo masa y llamándolo silueta.

`render/poseMetrics.js` mide el contorno de verdad: anchura ocupada en 16 bandas
horizontales, desde tres vistas, sobre los vértices reales. Y hubo que
densificar por arista, porque los cilindros de este proyecto tienen dos anillos
—arriba y abajo— y nada en medio: muestreando sólo vértices, las bandas
centrales salían vacías y el personaje aparecía con agujeros en el contorno.

**Lección:** antes de creerse un número, comprobar que el número puede cambiar.
Es la misma lección del umbral de 0.04 % de la ronda anterior, en otra forma.

### Lo que la métrica no vio y una captura sí

Con las tres vistas en verde, las capturas de la cámara real enseñaron cuatro
defectos que ningún número iba a dar:

| Defecto | Severidad |
|---|---|
| La capelina del Vinculador salía invertida: un embudo abierto hacia el cielo | P1 |
| El escudo torre del Guardián se veía de canto desde el frente | P1 |
| El arco del Centinela desaparecía en la vista frontal | P2 |
| La diadema del Vinculador parecía un par de cuernos | P2 |

Los cuatro pasaban las tres vistas medidas. **Ninguna métrica de contorno
sustituye a mirar el fotograma**, y por eso el bucle de calidad incluye
capturar desde la cámara de juego y no sólo ejecutar el informe.

### El audio: mil seiscientas líneas que nadie había ejecutado

Escritas por un agente que murió por límite externo. La página arrancaba sin
errores, que es exactamente el estado en el que un juego puede estar mudo.

Nueve pruebas juegan una partida real y comprueban las 31 rutas, los 55 cues y
los 25 motivos de rechazo. **El audio estaba bien.** Los cuatro fallos iniciales
eran míos:

| Sospecha | Realidad |
|---|---|
| «44 cues no suenan» | el campo es `dur`, no `duration` |
| «la distancia no atenúa» | `distanceFalloff` devuelve `{gain, tone}`, no un número |
| «los 25 motivos de rechazo son mudos» | `REASONS` mapea código→texto; yo recorría los textos |
| «la partida entera es muda» | casi toda ruta de audio es relativa al jugador y el arnés no había llamado a `install()` |

**Diecinueve falsos positivos del arnés en la sesión. Cero informes falsos
publicados.**

### Dos puertas del propio árbitro estaban podridas

Este documento existe para no fiarse de nada, así que tampoco de sí mismo:

- leía `index-three.html`, un fichero que dejó de existir cuando Three.js pasó a
  ser el backend por defecto — el árbitro llevaba tiempo **reventando**, no
  aprobando;
- buscaba el Timing Lab en un `switch` de `main.js` que se había convertido en
  datos;
- exigía **exactamente** 215 pruebas, lo que convierte cada prueba nueva en un
  fallo del árbitro y desincentiva escribir pruebas. Ahora es un suelo.

### Y otra vez, el arnés antes que el producto

La primera tanda de capturas salió con una pierna estirada un metro hacia un
lado. No era el modelo: la sonda teletransportaba al personaje al punto de la
foto y el foot locking mantenía el pie plantado donde estaba —haciendo
exactamente su trabajo—. Ahora el personaje camina hasta el sitio.

## 7. Lo que sigue abierto, con número

- **1 fila**: Pointer Lock — `MANUAL_BROWSER_REQUIRED`. Chromium rechaza el
  `requestPointerLock()` que nace de un evento sintético, y lo dice con nombre y
  apellidos: `WrongDocumentError`. Lo automatizable está verde; falta un humano.
  `docs/POINTER_LOCK_MANUAL.md`, un minuto.
- **60 FPS**: sin GPU en este contenedor no se mide y no se inventa.
- **La IA sigue sin usar las rutas de cobertura** del mapa.
- **Nadie ha jugado esto.** `docs/PLAYTEST_CHECKLIST.md`.

## 8. Veredicto

El build está **medido**. Lo que se afirma verde en el ledger tiene detrás un
comando que cualquiera puede ejecutar; lo que no, está listado arriba y no se ha
maquillado. **145 de 146, y la que falta se dice por su nombre en vez de
redondearse a 146.**

Lo que no está es **jugado**. Ninguna de las 288 pruebas, ninguna de las once
puertas y ninguno de los cinco árbitros puede decir si el combate divierte. Ese
gate es humano y sigue abierto.
