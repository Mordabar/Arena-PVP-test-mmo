# CURRENT_BUILD_STATE

> Estado vivo de la construcción. Se actualiza al cierre de cada wave.
> Si una ejecución se interrumpe, el siguiente agente continúa **desde aquí**
> sin volver a descubrir el proyecto.

**Wave actual:** WAVE 5 cerrada · barrido observable de clases y casteo cerrado
**Build importado:** Vertical Slice v0.8 (zip del usuario), commit `07339a4`
**Rama:** `claude/arena-mmo-concept-qeboc7`
**Ledger:** 45 / 146 VERIFIED — **el build NO está terminado**

---

## Reproducir el estado en un comando

```
node tools/run-gates.js
```

Ejecuta la batería sin navegador, los números de la arena, la composición del
HUD en las tres fases, el barrido de casteo y el de las seis clases. Termina en
rojo si algo falla. Ahora mismo: **todo en verde, 240/240 pruebas**.

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

---

## Siguiente tarea inmediata

1. **WAVES 2–4 y 6–10 del master prompt**, que siguen sin barrido observable:
   character feel, visuales de personaje, familias de VFX, bots y game loop
   completos, pulido y asalto final de calidad.
2. **CHARACTERS · ANIMATION · VFX (filas 109–132): 0 VERIFIED.** Es el bloque más
   grande sin verificar. Necesita el juicio del Animation Arbiter y del Visual
   Arbiter sobre cada arquetipo y cada familia.
3. **Jump / airborne / landing** siguen en TODO (filas 11–13).
4. **La IA no usa las rutas de cobertura de la arena.** Los carriles existen y un
   humano puede usarlos; el bot va en línea recta. Carencia de IA, no de nivel.
5. **Pointer Lock** (fila 22) sigue BLOCKED: headless no lo concede sin gesto
   humano. Las filas 20–21 (arrastre izquierdo, mirada libre derecha) siguen
   IMPLEMENTED sin verificación con ratón real.
6. **Ninguna regla premia la altura.** Las plataformas dan lectura del foso y
   cuestan tiempo al subir, pero no hay ventaja mecánica de alto.

## Tests fallando

Ninguno. **240/240.** Todas las puertas observables en verde.
