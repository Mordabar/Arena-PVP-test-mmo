# El Foso de Ceniza — la arena como diseño de nivel

Antes de esta pasada la arena era un decorado: tenía muros, columnas y
plataformas, y no contestaba a ninguna pregunta de PvP. Ahora contesta a cuatro,
y cada respuesta está medida.

Reproducir las medidas:

```
node tools/arena-analysis.js          # los números
node tools/run-tests.js "Arena ·"     # el contrato, en rojo si alguien lo rompe
```

---

## Las cuatro preguntas

### 1. ¿Dónde entra el melee?

Por los carriles norte y sur, con cobertura escalonada. Desde el spawn hasta el
foso hay ruina, columna y barrera a menos de 5 u de separación, así que un
Devastador acorta 22 u sin comerse 22 u en campo abierto. Eso es exactamente lo
que hace injugable al melee en un mapa mal compuesto.

Y el foso **está limpio**: el anillo de 5 u alrededor del centro es 100 %
transitable y no hay ninguna columna a menos de 6.5 u del centro. Antes había
dos a 4.5 u, que es la distancia perfecta para que el rango baile alrededor de
una columna a distancia de melee y el melee no cobre nunca. Una prueba lo impide
ahora.

### 2. ¿Dónde kitea el rango?

Por el anillo exterior, y se puede dar **la vuelta completa**. La comprobación no
es «hay hueco»: se quita un disco central de 5, 7 y 9 u, se busca la pieza
conectada más grande de lo que queda y se exige que cubra los 360°. Si quedara un
hueco, el kiteador que rodea el centro se toparía con un fondo de saco.

Medir una circunferencia perfecta no servía: nadie kitea en circunferencia
perfecta, se kitea rodeando cosas.

### 3. ¿Dónde rompe LoS el mago?

En todas partes. La cobertura media está a **3.1 u** y ningún punto jugable la
tiene a más de 8.6 u. Un Arcanista que necesita cortar un casteo entrante tiene
una esquina a un paso, no a media arena.

### 4. ¿Es justo?

La geometría es simétrica a 180° **por construcción**: las piezas se colocan con
un helper `pair()` que empuja la pieza y su gemela rotada. Los spawns son espejo
exacto y reciben lo mismo medido: 11.00 u al centro, 2.89 u a la cobertura más
cercana, 12.00 u de espalda libre, los dos.

Antes eran (−10, 0) y (8, 0). Dos metros de ventaja en un duelo son dos metros de
ventaja.

---

## Números actuales

| Medida | Valor | Contrato |
|---|---|---|
| Simetría 180° | sí | obligatorio |
| Separación entre spawns | 22.0 u | 18–26 |
| LoS entre spawns al empezar | sí | obligatorio |
| Espalda libre del spawn | 12.0 u | ≥ 9 |
| Cobertura a ≤ 4 u | 70.3 % | ≥ 60 % |
| Distancia media a la cobertura | 3.13 u | ≤ 4.5 |
| Peor rincón | 8.59 u | ≤ 10 |
| Pares con LoS | 39.1 % | 33–60 % |
| A rango de arquero (18–26 u) | 30.6 % | ≥ 20 % |
| Piezas del espacio jugable | 1 | exactamente 1 |
| Vuelta al foso (r = 5, 7, 9) | cerrada | obligatorio |
| Anillo de 5 u transitable | 100 % | 100 % |

---

## Zonas declaradas

La intención vive en `arena.zones`, no en un documento que se desincroniza:

| Zona | Rol | Para qué |
|---|---|---|
| `foso` | melee: choque | Suelo abierto con las barreras a la espalda. Aquí se decide el cuerpo a cuerpo. |
| `carril-norte` / `carril-sur` | melee: ruta de entrada | Cobertura escalonada para acortar sin cruzar en abierto. |
| `anillo-oeste` / `anillo-este` | rango: kiteo | Ruinas escalonadas: se retrocede rompiendo esquina. |
| `alto-noroeste` / `alto-sureste` | control: altura | Lee el foso desde arriba. Subir cuesta rampa y se ve venir. |

Una prueba comprueba que cada zona declarada es espacio jugable de verdad y no
un macizo, y que los tres roles están cubiertos.

---

## Lo que se rompió al rediseñar, y cómo se supo

Mover la geometría destapó cuatro cosas. Vale la pena anotarlas porque ninguna
era un fallo del rediseño: eran fallos que el mapa anterior tapaba.

1. **Tres pruebas ataban su fixture a una coordenada mágica.** `x: 4.5` porque
   ahí había una columna. Al moverla, la prueba seguía verde comprobando aire.
   Ahora buscan la columna en la arena real (`T.pillarFixture`) y fallan en voz
   alta si el nivel deja de tener una.

2. **Una prueba de balance nacía dentro de un muro.** El soporte del 2v2
   aparecía dentro de una ruina nueva, dejaba de pelear y curaba 170 en vez de
   500. El número parecía un problema de balance y era un bot atascado. Las dos
   fixtures de balance exigen ahora que su sitio esté libre.

3. **El layout de los escenarios estaba en un `switch` de `main.js`**, que
   necesita DOM y no entra en la batería. Dos maniquíes de la sala de counters
   quedaron dentro de columnas y no había forma de saberlo sin abrirla a mano.
   Ahora es `data/scenarios.js` y una prueba lo verifica contra la geometría.

4. **El TTK del duelo Devastador vs Centinela se salió de banda** (32.6 s sobre
   un máximo de 32). No se tocó la banda: se corrigió el mapa. Las columnas
   interiores estaban pegadas al foso y le regalaban al kiteador un corte de LoS
   a distancia de melee. Movidas a r ≈ 9.2, el duelo vuelve a 12–32 s y el foso
   queda limpio, que era la intención de diseño desde el principio.

---

## Lo que todavía no hace

- La IA **no usa las rutas de cobertura**. Los carriles existen y un humano puede
  usarlos; el bot va en línea recta. Es una carencia de IA, no de nivel, y está
  anotada en el ledger.
- Las plataformas dan altura pero **ninguna regla premia la altura**. Hoy sirven
  para leer el foso y para forzar un compromiso de tiempo al subir. Si el diseño
  quiere ventaja de alto, es una regla de combate que no existe.
