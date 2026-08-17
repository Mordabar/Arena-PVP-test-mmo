# Hallazgos de las puertas de navegador — v0.17

`node tools/run-gates.js`, catorce puertas. **Nueve en verde, cinco con
hallazgos.** Este documento existe porque las cinco importan y ninguna se ha
maquillado.

## El hallazgo de fondo

> **Las puertas de navegador llevaban rojas desde que entró el modelo real, y
> nadie podía verlo.**

v0.16 declaró «12/12 auditores especializados» y «ARBITER: APROBADO», y las dos
cosas son ciertas — pero ninguna de las dos ejecuta un navegador. El entorno de
v0.16 bloqueaba `127.0.0.1`, así que las puertas que sí pintan llevaban sin
correr desde antes de que el `.glb` sustituyera al maniquí procedural.

Cuando por fin corren, cuatro de ellas están midiendo **algo que ya no existe**.

---

## 1 · Las puertas de animación miden el maniquí, no el modelo

```
parado:   la pose sólo tiene 0 piezas
adelante: la pose sólo tiene 0 piezas   (×6 direcciones)
```

`visuals[id].pose` es la lista de piezas del **humanoide procedural**. En la ruta
GLB está vacía por diseño: el cuerpo lo pone el `.glb` y el equipo cuelga de los
huesos. Las sondas siguen preguntando por `pose`, así que miden cero y fallan.

**No es un defecto del producto: es una puerta que dejó de apuntar al sujeto.**
Y es peor que un fallo, porque mientras estuvo sin ejecutarse aparentaba
cobertura de locomoción que no existía.

**Arreglo:** leer el rig (`visuals[id].rigBones`) en vez de `pose`. La sonda de
equipo nueva (`gear-anim-gate.json`) ya lo hace y cubre 56 estados; estas otras
tienen que converger a lo mismo.

## 2 · Draw calls fuera de presupuesto — REAL, y **no** es el equipo

| | Pico en 2v2 | Techo | Veredicto |
|---|---|---|---|
| Draw calls | **1078** | 900 | **FUERA** |
| Triángulos | 248 941 | 400 000 | dentro |

**Corrección.** La primera versión de este documento decía que los draw calls
«llevan firma de este pase» porque el equipo son ~20 mallas por personaje. Se
escribió sin medir. Al contar los objetos dibujables de la escena en un 2v2:

| Qué | Objetos visibles |
|---|---|
| **escenario** (árboles, rocas, hierba, muros, ruinas) | **3 486** |
| equipo de las seis clases | 62 |
| armas | 34 |
| VFX de caster | 12 |
| cuerpos | 4 |
| **total** | **3 598** |

**El equipo es el 1.7 % de los objetos de la escena.** Aunque se fusionara
entero en una sola malla por personaje, el pico bajaría de 1078 a ~1030: seguiría
fuera de presupuesto. La palanca está en otro sitio.

**El lever real es el escenario.** Tres mil cuatrocientos objetos individuales,
la mayoría copias del mismo árbol, la misma roca y la misma mata de hierba, es
exactamente el caso de uso de `InstancedMesh`: una llamada por *tipo* de objeto
en vez de una por objeto. `CLAUDE.md` §14 ya lo pide por su nombre —«particle
pools/factories preferred over uncontrolled allocations», «reuse geometries and
materials»— y `js/render/three/threeEnvironment.js` es donde vive.

**Siguiente paso concreto:** instanciar el escenario por familia (`TreeFactory`,
`RockFactory` y la hierba ya generan por factoría, así que las copias comparten
geometría; falta que compartan también la llamada de dibujo). Es un cambio
acotado a un fichero de presentación, no toca simulación, y es lo único que
puede meter el pico dentro de 900.

**Y antes de tocarlo, medir FPS en una GPU real.** El techo de 900 se fijó
mirando un presupuesto, no un fotograma; con software rasterization aquí no se
puede saber si 1078 duele. Es el punto 10 del checklist de playtest.

## 3 · Solape en el HUD

```
#action-bar ∩ #help = 112 × 2 px
```

Dos píxeles de alto. Es P3, pero la puerta de composición del HUD existe
precisamente para que estos no se acumulen: en su día se encontraron siete de
golpe.

## 4 y 5 · Rechazos y proyectiles — **eran el fixture, y está demostrado**

La primera versión de este documento dejó estos dos puntos «escritos hasta que
se compruebe», porque uno de ellos —«matar al lanzador borró un proyectil ya
liberado»— sería una violación directa de que **RELEASE es irreversible**, la
regla más protegida del proyecto. Se comprobó. **No lo era.**

### El camino hasta la respuesta, porque el camino es el hallazgo

Cuatro intentos, cuatro suposiciones mías desmentidas por la medición:

| Intento | Qué decía | Qué pasaba de verdad |
|---|---|---|
| 1 | «ninguna habilidad del arcanista declara proyectil» | el flag vive en `ab.flags.projectile`, no en `ab.projectile` |
| 2 | «5 de 6 flechas del Centinela: RELEASE sin proyectil» | `tryUse` devolvía `noTarget`: **la habilidad nunca se usó**. No basta con `p.targetId`, hace falta el contexto `{targetId, target}` |
| 3 | con contexto, «rechazo=los» ×5 | había colocado a los dos **a ambos lados del muro central** de la arena |
| 4 | — | buscando un par de puntos con línea de visión **medida**: 6 de 6 crean proyectil |

### El resultado

```
Disparo tensado            ok=true  spawns=1
Flecha perforante          ok=true  spawns=1
Ráfaga disruptiva          ok=true  spawns=1
Pulso invernal             ok=true  spawns=1
Disparo dual del Viento    ok=true  spawns=1
Flecha paralizadora        ok=true  spawns=1

RELEASE es irreversible: 1 proyectil antes de matar al lanzador, 1 después.
```

**El sistema de proyectiles funciona y RELEASE aguanta.** Los seis rechazos del
barrido de clases son, con toda probabilidad, exactamente el mismo defecto de
fixture: una sonda que coloca a los combatientes sin comprobar línea de visión
y que llama a `tryUse` sin contexto de objetivo.

### Lo que queda hecho de esto

`tools/scripts/projectile-gate.json` es ahora una puerta permanente, y su
fixture **busca** un par de puntos con línea de visión usando
`ArenaMetrics.losBetween` en vez de escribir coordenadas a mano. Es la misma
lección que ya costó un rediseño de arena: *un fixture atado a coordenadas
mágicas deja de probar lo que dice en cuanto alguien mueve un muro.*

**Pendiente, y menor:** arreglar el barrido de clases con el mismo patrón. Los
seis rechazos concretos siguen sin verificarse uno a uno.

## Qué NO falló

Nueve puertas en verde, incluidas las tres que este pase construyó:

- batería completa (383/383) y análisis de la arena;
- identidad visual: seis contornos medidos en tres vistas;
- casteo: prepare, release, GCD, cola y tres cancelaciones;
- ratón 1:1 y mirada libre, con eventos reales;
- movimiento, cámara y targeting en partida;
- Pointer Lock (lo automatizable) y su diagnóstico manual;
- **equipo de clase en 56 estados de animación sobre el rig real**;
- **ajuste del equipo al volumen del cuerpo**;
- coste de simulación (0.08 ms/tick), pool de partículas y diez partidas sin
  fugas.
