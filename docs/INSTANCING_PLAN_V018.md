# Plan de instanciación — la puerta de rendimiento que falta

**Estado:** medido y planificado, **no implementado**. Este documento existe para
que la próxima sesión lo ejecute de una pasada en vez de volver a descubrirlo.

## El número

| | Pico en 2v2 | Techo | |
|---|---|---|---|
| Draw calls | **1078** | 900 | **FUERA** |
| Triángulos | 248 941 | 400 000 | dentro |

`QA_GATE.md` §14 y `CLAUDE.md` §14. Es la única violación de presupuesto medida
del proyecto.

## Lo que la escena tiene dentro

Contado en un 2v2 real, agrupando por **(geometría, material)**, que es la clave
exacta con la que `InstancedMesh` puede fusionar:

| | |
|---|---|
| Mallas no-skinned en escena | **3 612** |
| Familias distintas | 1 016 |
| Familias **repetidas** (≥2 copias) | **148** |
| Objetos dentro de familias repetidas | **2 744** |
| **Objetos tras instanciar** | **1 016** |

Una reducción del **72 %** de objetos. Las mayores:

```
288× IcosahedronGeometry  MeshBasicMaterial    #f3f9bc
282× IcosahedronGeometry  MeshBasicMaterial    #ffffff
240× DodecahedronGeometry MeshStandardMaterial #3d6a3b
120× CylinderGeometry     MeshStandardMaterial #ffffff
120× CylinderGeometry     MeshStandardMaterial #3e3024
120× DodecahedronGeometry MeshStandardMaterial #6d8b4d
120× DodecahedronGeometry MeshStandardMaterial #81934e
120× IcosahedronGeometry  MeshStandardMaterial #6d8b4d
 96× CylinderGeometry     MeshStandardMaterial #d6c29a
 96× ConeGeometry         MeshStandardMaterial #b8c1ca
 80× BoxGeometry          MeshStandardMaterial #b4aa95
```

## Lo que este documento NO afirma

**No se ha podido atribuir cuántos de los 1078 draw calls pone cada grupo.** El
experimento correcto —apagar cada hijo de la escena por turnos y volver a
renderizar— necesita ~40 renders completos, y con rasterización por software y
personajes de 50 000 triángulos se pasa del tope del driver CDP.

Y el conteo de objetos **sobreestima** los draw calls: un hijo con `visible =
true` dentro de un grupo con `visible = false` **no se dibuja**. Los pools de
VFX usan exactamente ese patrón. Así que «3 612 objetos» no es «3 612 llamadas».

**Por eso este plan no se ha ejecutado a ciegas.** Instanciar sin saber qué
familia paga los 178 draw calls que sobran sería optimizar por corazonada, que
es justo lo que este proyecto lleva toda la sesión evitando.

## Primer paso obligatorio: atribuir

Dos caminos, cualquiera vale:

1. **En una máquina con GPU**, el experimento de apagar grupos por turnos corre
   en segundos. Es el camino limpio.
2. **Sin GPU**, reducir el coste por render antes de medir: bajar el canvas a
   320×180 y sustituir temporalmente el `.glb` por el humanoide procedural. Los
   draw calls de escenario no dependen de la resolución ni del personaje.

Hasta que exista esa tabla, cualquier trabajo aquí es a ciegas.

## Después, instanciar por familia

### Estático — directo

Rocas (6), colinas (6), banderas, portales de ruina y muros. Geometría y
material compartidos, transformadas fijas: `InstancedMesh` con `setMatrixAt` una
sola vez en el arranque. Sin riesgo.

### Follaje — cuidado con la animación

El bosque son ~37 árboles × 7 mallas (tronco + collar + 5 copas) ≈ **259
mallas**, y las copas **se mecen**: `animatedFoliage` las mueve cada fotograma.

Instanciarlas sigue siendo la respuesta correcta —una `InstancedMesh` con
`setMatrixAt` por copa y un solo `instanceMatrix.needsUpdate` sale más barato
que 259 matrices más 259 llamadas— pero **hay que reescribir el balanceo** para
que escriba en el buffer de instancias en vez de en `Object3D.position`.

Riesgo real: perder el mecido o desincronizarlo. Se cierra con una sonda que
compare la posición de una copa concreta entre dos fotogramas, igual que hace
`gear-anim-gate.json` con el equipo.

### Hierba y flores — los dos primeros de la lista

Las dos familias de 288 y 282 icosaedros con `MeshBasicMaterial` son las mayores
del elenco. Son decoración pura, sin sombra ni interacción: candidatas ideales.
**Confirmar antes que estén realmente visibles** y no dentro de un grupo oculto.

## Lo que NO hay que hacer

- **Subir el techo de 900.** Se fijó mirando un presupuesto, no un fotograma.
  Antes de tocarlo hacen falta **FPS reales en una GPU** — punto 10 de
  `docs/PLAYTEST_CHECKLIST.md`. Puede que 1078 no se note, y puede que 900 ya
  fuera generoso; ninguna de las dos cosas se sabe hoy.
- **Instanciar el equipo de clase.** Ya está medido: son **62 objetos, el 1.7 %**
  de la escena. Fusionarlo entero bajaría de 1078 a ~1030. No es la palanca.
- **Tocar la simulación.** Nada de esto la roza: es presentación entera.

## Definición de hecho

1. Tabla de atribución de draw calls por grupo, medida.
2. Familias instanciadas de mayor a menor hasta bajar de 900.
3. El mecido del follaje sigue vivo, comprobado con sonda.
4. Captura antes/después desde la cámara de juego: **el escenario tiene que
   verse idéntico**. Si se ve más pobre, la optimización no vale.
5. Puerta nueva en `run-gates.js` que fije el techo y no deje volver a subirlo.
