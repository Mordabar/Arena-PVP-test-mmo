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

Ocho informes falsos evitados verificando el arnés antes que el juego.

---

## 4. Lo que sigue sin estar verificado

El build **no está terminado** y el ledger lo dice: 45 de 146 filas VERIFIED.

1. **CHARACTERS · ANIMATION · VFX**: verificado ahora en ejecución, pero **sin
   juicio artístico**. Que la pose no tenga NaN y que cada poder mueva el cuerpo
   no dice que se vea bien.
2. **Jump / airborne / landing**: TODO.
3. **Pointer Lock**: BLOCKED, headless no lo concede sin gesto humano.
4. **La IA no usa las rutas de cobertura** que la arena ahora ofrece.
5. **Ninguna regla premia la altura** de las plataformas.
6. **Sin playtest humano.** Todo lo de arriba es medición. El ritmo, la
   legibilidad y la sensación de peso necesitan a alguien jugando.

---

## 5. Veredicto

El build está **medido**, no **terminado**. Lo que se afirma verde en el ledger
tiene detrás un comando que cualquiera puede ejecutar. Lo que no, está listado
arriba como pendiente y no se ha maquillado.
