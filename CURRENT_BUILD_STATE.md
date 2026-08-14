# CURRENT_BUILD_STATE

> Estado vivo de la construcción. Se actualiza al cierre de cada wave.
> Si una ejecución se interrumpe, el siguiente agente continúa **desde aquí**
> sin volver a descubrir el proyecto.

**Wave actual:** Character Identity Pass cerrado · build de playtest preparada
**Build:** Ladder Vertical Slice **v0.9 · PLAYTEST** (`ladder-vertical-slice-v09-playtest`)
**Rama:** `claude/arena-mmo-concept-qeboc7`
**Ledger:** **145 / 146 VERIFIED + 1 MANUAL_BROWSER_REQUIRED**

> Los gates técnicos están cerrados. **Falta el gate humano: nadie ha jugado
> esto.** `docs/PLAYTEST_CHECKLIST.md` (10–15 min) es el siguiente paso, y
> `docs/DEPLOY_HOSTINGER.md` explica cómo subirla.

---

## Reproducir el estado en un comando

```
node tools/run-gates.js            # todo
node tools/run-gates.js --rapido   # sólo lo que no necesita navegador
```

Once puertas: la batería sin navegador, los números de la arena, el contorno de
las seis clases, la composición del HUD en las tres fases, casteo, las seis
clases, ratón, control, combate, rendimiento, Pointer Lock y animación/VFX.
Termina en rojo si algo falla. Ahora mismo: **todo en verde, 288/288 pruebas**.

La última puerta pinta por software y tarda varios minutos: es la única forma
de comprobar que lo que la simulación decide llega de verdad a la pantalla.

---

## Qué se cerró en esta sesión

### D1 — el HUD y el chrome de producto compartían píxeles
Reportado como «el panel de laboratorio se superpone al HUD de partida». En
partida de ladder no ocurría; en el Combat Lab ocurría **seis veces**. Al
convertir la medición en puerta ejecutable apareció un séptimo, ese sí en la
partida real: el roster de equipo se colocaba en un `top` fijo mientras el marco
del jugador crece con los estados activos.

De paso: el roster se reconstruía con `innerHTML` sesenta veces por segundo, y
la carga emitía un 404 de `favicon.ico`.

### La cámara se metía dentro del escenario
La colisión sólo miraba `arena.obstacles`, y las plataformas no están ahí
—se caminan y no cortan LoS—, así que la cámara las atravesaba y enseñaba el
reverso del nivel. Además el suelo mínimo del ojo era un absoluto (`y = 0.35`),
que sobre una plataforma de 1.5 deja el ojo por debajo del suelo pisado.

### WAVE 5 — la arena pasó de decorado a diseño de nivel
`docs/ARENA_LEVEL_DESIGN.md` tiene el detalle. Resumen: geometría simétrica por
construcción, spawns espejo exacto (antes uno estaba 2 u más cerca del centro),
eje de salida despejado para que los duelistas se vean, foso central limpio,
vuelta de 360° comprobada y 17 pruebas que son el contrato.

Rediseñar destapó cuatro cosas que el mapa anterior tapaba: tres fixtures atados
a coordenadas mágicas que seguían verdes probando aire, un bot que nacía dentro
de un muro y hacía parecer un problema de balance, dos maniquíes dentro de
columnas, y un TTK fuera de banda que se corrigió moviendo el mapa, no la banda.

### Barrido observable de las seis clases y del casteo
36/36 habilidades ejecutadas en navegador por la ruta real del jugador: todas
cobran, enfrían, castean si declaran casteo y aplican sus estados. Siete puertas
de casteo (prepare, release, GCD, cola, tres cancelaciones) en verde.

### P0 — el entrypoint del producto no animaba ningún combate
`visuals[id]` estaba en el contrato del renderer; su contenido no. El nativo
guardaba ahí el handle del backend de personaje y el de Three.js un envoltorio
de escena. `vfx.js` pasaba el envoltorio a `triggerAttack`, que empieza con
`if (!st.cfg) return;`. Resultado: cero ataques, cero casteos y cero reacciones
al daño en la presentación de Three.js, durante commits enteros, con la suite
verde. La locomoción va por otro camino y por eso los personajes seguían
andando con normalidad.

Corregido añadiendo `characterHandleOf(id)` al contrato, no parcheando la
llamada. `docs/ANIMATION_VFX_AUDIT.md` tiene la medición antes/después.

---

## Falsos positivos ya descartados — no reabrir

1. **El reloj de partida no está roto.** El navegador headless corre rAF a ~4 fps
   y `realDt` está topado a 0.1 s, así que el tiempo de producto avanza a ~0.35×
   del de pared **sólo en headless**. `MatchFlow.update` además topa a 0.25 s por
   llamada. A 60 fps ningún tope se activa. Sigue siendo P2 documentado: por
   debajo de 10 fps la cuenta atrás va lenta.

2. **«El jugador no hace daño».** Era un melee parado frente a un arquero que
   kitea. En rango y encarado: 1100 → 1046 en 6 s.

3. **Tres «defectos» de casteo que eran del arnés.** El bucle rAF simulando entre
   sondas, `pendingCast = null` a mano dejando el estado a medias, y medir antes
   de que llegue el proyectil. Los tres habrían sido informes falsos.

4. **«La estasis no llega a la animación».** Era la fatiga global de control
   rechazando la cuarta aplicación seguida. Comprobado en aislado:
   `stasis → STASIS`, `silence → SILENCE`, `disarm → DISARM`.

5. **«La pose está vacía».** `pose` se rellena en `render()`, no en
   `syncVisuals()`. Una sonda que no pinta mide cero piezas y pasa en vacío.

6. **«La intención dice DEATH sobre una entidad viva».** Costó seis ejecuciones
   del barrido. La sonda guardaba la **referencia viva** a la intención y la
   serializaba al final, con la entidad ya muerta: comparaba una foto contra un
   vídeo. El producto nunca estuvo mal.

---

## Qué se cerró en esta wave

### Las nueve filas de identidad visual
Las seis clases eran tres parejas de gemelos y estaba medido: `centinela ≈
rastreador` con un 0.3 % de diferencia. Ahora el peor par difiere un **18.5 %**
de contorno, medido desde tres vistas con `render/poseMetrics.js`.

Lo importante no es el número: es que el equipo pasó a ser un **sistema de
datos**. `render/equipment.js` tiene 24 fábricas paramétricas y
`data/classVisuals.js` describe cada clase con números. Añadir una séptima clase
no toca el renderer, y hay una prueba que lo comprueba (`buildPose` no puede
volver a mencionar una clase por su nombre).

De paso se terminó lo que el agente de personajes dejó a medias: `composeBuild()`
y `girth` existían en `data/races.js` y no los usaba nadie.

### El audio, que nadie había ejecutado
1602 líneas escritas por un agente que murió por límite externo. Nueve pruebas
juegan una partida real y comprueban las 31 rutas, los 55 cues y los 25 motivos
de rechazo. **Estaba bien**: los cuatro fallos iniciales eran del arnés.

### Pointer Lock, sin seguir peleando con el navegador
`js/ui/pointerLockDiag.js` (F9 o `?diag=pointerlock`), un gate que verifica lo
automatizable y deja constancia medida de lo que no, y
`docs/POINTER_LOCK_MANUAL.md` con el procedimiento de un minuto.

### Dos puertas del árbitro que llevaban tiempo podridas
Leía `index-three.html`, que ya no existe, y buscaba el Timing Lab en un
`switch` de `main.js` que se convirtió en datos. Además exigía exactamente 215
pruebas, lo que convierte cada prueba nueva en un fallo del árbitro.

---

## Siguiente tarea inmediata

**Ya no es código.** Es:

1. **Subir la build** siguiendo `docs/DEPLOY_HOSTINGER.md` y confirmar que la
   cabecera dice `v0.9 · PLAYTEST` (Hostinger cachea con agresividad y este
   proyecto ya ha probado una versión antigua creyendo probar la nueva).
2. **Cerrar Pointer Lock** con `docs/POINTER_LOCK_MANUAL.md`: un minuto, y el
   ledger pasa a 146/146 con evidencia en vez de con confianza.
3. **Jugar** con `docs/PLAYTEST_CHECKLIST.md` delante.

## Lo que NO falta y conviene no rehacer

- Las 60 filas de combate (normal, casteo, weaving, CC, counters), verificadas
  dentro del juego con 18 sondas.
- Movimiento, cámara y targeting, con 9 sondas más y arrastre de ratón real.
- Animación y VFX: 15 sondas, incluida la gramática visual de los 36 efectos.
- Las seis identidades de clase: 20 pruebas y tres vistas medidas.
- El audio: 9 pruebas sobre una partida real.
- Rendimiento: la simulación ocupa el 0.4 % de su presupuesto y diez partidas
  seguidas no dejan ni un nodo de DOM de más.

## Sin juicio humano todavía

Todo lo anterior es medición. **Nadie ha jugado esto.** El peso de un mandoble,
la legibilidad de un telegraph a distancia de duelo, si las seis siluetas se
distinguen jugando y no sólo mirándolas, y si el combate divierte, siguen
necesitando a una persona con las manos en el teclado.

Un 18.5 % de contorno distinto es un suelo, no un aprobado: una diferencia
estadística no garantiza una diferencia perceptual. El punto 8 del checklist
pregunta lo único que decide —«si estuvieran todas en gris y sin nombre, ¿las
distinguirías?»— y esa respuesta gana a la métrica.

