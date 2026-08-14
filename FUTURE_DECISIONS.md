# FUTURE_DECISIONS.md

## Backend competitivo

El rating, placements e historial de v0.8 son locales y reemplazables. No deben presentarse como seguridad/matchmaking de producción. El servidor autoritativo, cuentas y matchmaking remoto pertenecen a un milestone posterior.

## Personajes

El renderer procedural actual cumple legibilidad de arquetipo y conserva el Animation Reference Pass. Antes de invertir en más micro-geometría procedural, evaluar un backend GLB/skinned compatible con `AnimationIntent`, o migración visual a Unity manteniendo la simulación/contratos.

## Gate visual runtime

En el entorno de build actual, Chromium está administrado y bloquea HTTP local/loopback antes de cargar el proyecto. Repetir `node tools/browser.js smoke` y playtest manual en un navegador no administrado como primer gate externo de v0.8.

## Cobertura para bots: intentado, medido y revertido

La arena v0.9 coloca columnas y ruinas para romper la línea de tiro, y los bots
no las usan: retroceden en línea recta hasta el muro. Se intentó darles una
huida hacia cobertura y **se revirtió**. Vale la pena escribir por qué, porque
el siguiente que lo intente se va a encontrar lo mismo en el mismo orden.

Lo que funcionó y quedó demostrado por el camino:

1. **La huida tiene que ser una emergencia con precio.** Sin umbral de vida, el
   kiteador se escondía en cada acercamiento y el duelo Devastador vs Centinela
   pasaba de 32 s a 46 s, fuera de la banda de TTK. Sin límite de distancia, dos
   ranged se escondían el uno del otro y el duelo llegaba al tope de 90 s sin
   resolverse. Sin excepción para el sanador, el soporte rompía LoS con su
   propio aliado y curaba **0**.
2. **Tiene que comprometerse.** Un cambio de rumbo de 0.35 s recorre metro y
   medio: no llega a ninguna columna. Con 1.6 s de compromiso sí avanza.
3. **Tiene que cancelar el casteo.** Un casteo estacionario clava los pies: el
   bot «huía» recorriendo 2 u en 1.6 s porque seguía canalizando.
4. **Hay que ir a una columna concreta, no a un ángulo.** Muestrear un abanico
   de ±80° detrás del personaje falla justo cuando importa: con el melee al
   norte y la única columna al suroeste, la dirección buena cae a 120° y no se
   muestrea nunca.

Y lo que lo tumbó: **con todo lo anterior, el bot llega a la columna y se queda
clavado contra su cara cercana.** Apuntar al lado ciego en línea recta hace que
el cuerpo empuje el obstáculo; el deslizamiento de colisión no lo rodea dentro
de la ventana de huida. Muriendo pegado a una columna avanza menos que
retrocediendo en recto, así que la «mejora» era un empeoramiento.

**Lo que falta es navegación, no heurística**: rodear el obstáculo por la
tangente, con un par de waypoints. Es una funcionalidad con entidad propia, no
un ajuste de la IA actual, y por eso no entró a medias.

Prueba de fuego para quien lo retome: un fixture donde huir en recto **no**
tape al ranged (columna en diagonal, no en la línea de retirada). El primer
intento de esta prueba pasaba con la búsqueda de cobertura desactivada —
comprobaba la forma del escenario, no el comportamiento del bot.

---

## Identidad visual — decisiones que quedan abiertas y no bloquean

Cerradas las nueve filas, quedan cuatro cosas que se decidieron «por ahora» y
que alguien tendrá que resolver de verdad. Ninguna impide jugar.

### 1. El aro del báculo del Vinculador es un polígono de cajas

`F.staff` con `crown: 'ring'` compone el aro con N cajas alineadas a los ejes,
sin girarlas tangencialmente. A distancia de juego se lee como un círculo; de
cerca se lee como un engranaje. Girar cada segmento pide una rotación de malla
alrededor de Z que `render/primitives.js` no tiene (sólo hay `rotateY`).

**Decisión pendiente:** añadir `P.rotateZ` / `P.rotateX` a las primitivas, o
generar el toro directamente como una primitiva más. Lo segundo es más limpio y
sirve además para barreras, sellos y telegraphs circulares.

### 2. La intersección grosera se juzga a ojo, no se mide

Las pruebas comprueban que ninguna pieza se desprenda, se congele ni haga pop,
y que la pose no degenere en diez estados de animación. **No** comprueban que
una hombrera no se hunda dentro del pecho: definir «grosero» numéricamente sin
falsos positivos es difícil —muchas piezas *deben* solaparse con el cuerpo— y
un umbral mal puesto sería otro umbral que no puede fallar.

**Decisión pendiente:** o se mide con oclusión real (renderizar la silueta con
y sin la pieza y comparar el área aportada: una pieza que no aporta contorno
está enterrada), o se acepta que es juicio visual y se deja en el checklist.
La primera opción es medible y barata con el `poseMetrics` que ya existe.

### 3. Una sola raza

`data/classVisuals.js` multiplica sus proporciones por las de la raza y el
resultado se acota en `BUILD_LIMITS`, así que la segunda raza no obliga a tocar
las seis clases. Pero **eso no se ha probado con una segunda raza**, y hasta que
exista una, la afirmación es de diseño, no de hecho.

**Prueba de fuego para quien añada la siguiente:** las seis clases tienen que
seguir separando por contorno con la raza nueva. `node tools/silhouette-report.js`
mide una raza a la vez; habrá que recorrerlas.

### 4. Las dos parejas más difíciles se separan por poco

`devastador ≈ vinculador` (18.5 %) y `devastador ≈ rastreador` (20.8 %) son las
más ajustadas del elenco. Están por encima del suelo y las dos se distinguen a
ojo en las capturas, pero son las primeras que se romperán si alguien engorda
al Devastador o adelgaza al Vinculador.

**Regla práctica:** cualquier cambio de proporciones pasa antes por
`node tools/run-tests.js Identidad`, que tarda 400 ms.
