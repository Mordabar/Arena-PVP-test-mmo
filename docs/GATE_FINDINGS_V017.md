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

## 2 · Draw calls fuera de presupuesto — REAL, y en parte de este pase

| | Pico en 2v2 | Techo | Veredicto |
|---|---|---|---|
| Draw calls | **1078** | 900 | **FUERA** |
| Triángulos | 248 941 | 400 000 | dentro |

Cuatro personajes de 50.000 triángulos cada uno son 200.000 sólo de cuerpos: eso
es del modelo, no del equipo. Los **draw calls** sí llevan firma de este pase: el
equipo de clase son ~20 mallas por personaje y cada una es una llamada, porque
cada pieza cuelga de un hueso distinto y no se pueden fusionar sin perder el
seguimiento del skinning.

**Opciones, en orden de preferimos-la-primera:**

1. **Fusionar por hueso.** Las piezas que comparten hueso (la coraza, la gola y
   el emblema cuelgan las tres de `Chest`) sí se pueden unir en una sola malla.
   Bajaría de ~20 a ~8 llamadas por personaje sin cambiar nada visible.
2. **LOD de equipo por distancia**: a más de N unidades, sólo las piezas que
   aportan silueta. Cambia lo que se ve, así que necesita juicio humano.
3. Subir el techo. **No** sin medir FPS reales en una GPU primero: el techo de
   900 se puso mirando un presupuesto, no un fotograma.

## 3 · Solape en el HUD

```
#action-bar ∩ #help = 112 × 2 px
```

Dos píxeles de alto. Es P3, pero la puerta de composición del HUD existe
precisamente para que estos no se acumulen: en su día se encontraron siete de
golpe.

## 4 · Rechazos en el barrido de las seis clases

```
Rastreador · Confundir del Acecho       RECHAZADA por lockout
Rastreador · Emboscada del Viento       RECHAZADA por weaponInterval
Guardián  · Barrera deflectora          RECHAZADA por utilityLocked
Centinela · Penetra escudos             RECHAZADA por untargetable
Arcanista · Tormenta helada del Vacío   RECHAZADA por untargetable
Vinculador · Curar aliado: cobró 64.8, menos de la mitad de 145
```

**Probablemente el arnés, no el producto.** El barrido se escribió cuando cada
clase tenía seis habilidades; v0.13 metió el catálogo completo de poderes con
reglas nuevas —escuelas, bloqueos de utilidad, objetivos válidos— y la sonda
sigue lanzándolas todas contra el mismo maniquí, en el mismo orden y sin
respetar los estados que ella misma provoca.

`untargetable` sobre un maniquí de laboratorio es la firma clásica de un fixture
inválido, no de una habilidad rota. **Pero no se da por bueno sin comprobarlo**:
hasta que alguien lo verifique una por una, estas seis quedan aquí escritas.

## 5 · Proyectil y weaving

```
RELEASE no creó proyectil
matar al lanzador borró un proyectil ya liberado
no se encontró la habilidad de weave
```

La tercera delata a las otras dos: la sonda busca una habilidad por un nombre
que ya no existe. Mismo diagnóstico que el punto 4 y misma regla: **escrito
aquí hasta que se compruebe**, porque «matar al lanzador borra un proyectil ya
liberado» sería una violación directa de que RELEASE es irreversible, y eso no
se archiva por corazonada.

---

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
