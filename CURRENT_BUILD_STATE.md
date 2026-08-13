# CURRENT_BUILD_STATE

> Estado vivo de la construcción. Se actualiza al cierre de cada wave.
> Si una ejecución se interrumpe, el siguiente agente continúa **desde aquí**
> sin volver a descubrir el proyecto.

**Wave actual:** WAVE 5 cerrada · barridos observables de clases, casteo y animación
**Build importado:** Vertical Slice v0.8 (zip del usuario), commit `07339a4`
**Rama:** `claude/arena-mmo-concept-qeboc7`
**Ledger:** 52 / 146 VERIFIED — **el build NO está terminado**

---

## Reproducir el estado en un comando

```
node tools/run-gates.js            # todo
node tools/run-gates.js --rapido   # sólo lo que no necesita navegador
```

Ejecuta la batería sin navegador, los números de la arena, la composición del
HUD en las tres fases, el barrido de casteo, el de las seis clases y el de
animación/VFX. Termina en rojo si algo falla. Ahora mismo: **todo en verde,
241/241 pruebas**.

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

## Siguiente tarea inmediata

1. **Juicio artístico, que es lo que ninguna medición da.** La animación y los
   VFX responden —36/36 poderes mueven el cuerpo, ninguna pose se corrompe— pero
   nadie ha dicho si el mandoble pesa, si el telegraph se lee a distancia de
   duelo o si el Guardián con tres gestos se siente pobre en la mano.
2. **Bots y game loop (WAVE 8).** El bucle lobby → partida → resultado está
   verificado, pero la IA **no usa las rutas de cobertura** que la arena ahora
   ofrece: los carriles existen y el bot va en línea recta.
3. **Jump / airborne / landing** siguen en TODO (filas 11–13).
4. **Pointer Lock** (fila 22) sigue BLOCKED: headless no lo concede sin gesto
   humano. Las filas 20–21 (arrastre izquierdo, mirada libre derecha) siguen
   IMPLEMENTED sin verificación con ratón real.
5. **Ninguna regla premia la altura.** Las plataformas dan lectura del foso y
   cuestan tiempo al subir, pero no hay ventaja mecánica de alto.
6. **Audio.** Existe y no se ha auditado en ejecución.

## Tests fallando

Ninguno. **241/241.**

Puertas observables: las cinco primeras en verde y reproducidas varias veces.

La sexta —animación y VFX— tiene todas sus sondas medidas en verde, pero la
ejecución seguida **moría por reloj**, no por el juego: la sonda de acciones era
un único `Runtime.evaluate` que simulaba ~3600 pasos y pintaba cientos de veces
por software, y rozaba el tope del driver CDP. Con `EXIT=2` y
`FALLO: Timeout en Runtime.evaluate`.

Partida en once sondas —una por clase para acciones, una por clase para VFX—
ninguna llamada individual se acerca al tope, y además un fallo señala a la
clase culpable en vez de a un bloque de treinta y seis habilidades. Pendiente de
ver la tirada completa con el nuevo reparto.

**Lección de arnés, no de producto:** un filtro `grep ✓|✗` en la tubería se
comió el mensaje de timeout, y el código de salida que leí venía del final de la
tubería (`cut`), no del driver. Una puerta que se lee a través de un filtro
puede estar mintiendo por omisión.
