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
