# Animación v0.39 — comprobación y límites

## Cambios de presentación

- Máscara inferior nativa: raíz, pelvis y piernas. Ya no pisa las pistas del torso de la guardia o el casteo.
- Desplazamiento lateral/retroceso: base neutral `Idle_Loop` y ciclo de pies existente, resuelto por IK de dos huesos. Se limitan cruces de piernas y alcance de anclajes durante cambios de dirección. La simulación sigue determinando posición, orientación y velocidad.
- Puntapié: se retira el retarget de `Arena_CMU_Kick`. Patada frontal conservadora sobre las longitudes reales de las piernas UAL, con rodilla elevada, extensión, apoyo y retorno. El progreso sigue `action.t` y su marcador de impacto; no cambia daño ni controles.
- Arco: mano del arco, nock y mejilla comparten el mismo plano de tiro. La cuerda llega a la posición real de la mano de tiro después del ajuste final del socket. En RELEASE la cuerda vuelve a reposo mientras la mano conserva su recuperación.
- Mago: la mano del báculo mantiene el agarre junto al cuerpo; la mano libre conserva el gesto de liberación y canaliza durante la carga. Las piernas conservan base estable o locomoción independiente.

## Evidencia

`animation-sequences-039-CPU.png` es un atlas de **42 poses calculadas por CPU sobre la malla y el mixer reales**. Se inspeccionó visualmente. No contiene capturas WebGL, secuencias de juego ni una evaluación de calidad profesional. La proyección no dibuja líneas, por lo que la cuerda se valida numéricamente.

`animation-sequences-039.json`: **2018 comprobaciones**, incluyendo matrices finitas, invariancia del estado de simulación durante render, separación de pies y unión cuerda/mano menor de 0.00001 m. A partir de 40% de carga, el producto escalar del eje de tiro con el frente autoritativo supera 0.99; con carga completa es aproximadamente 1.00 (antes: 0.84, unos 33 grados de desviación).

`animation-regression.json`: **374 comprobaciones**, 90 clips muestreados. Auditoría: **78 referencias** válidas.

## Repetición

```sh
node --experimental-loader ./tools/tests/three-loader.mjs tools/tests/animation-sequences-039.mjs
node --experimental-loader ./tools/tests/three-loader.mjs tools/tests/animation-regression.mjs
node tools/audit-clips.mjs
```

El test de secuencias no genera los grandes JSON de triángulos por defecto. Para inspección visual adicional:

```sh
node --experimental-loader ./tools/tests/three-loader.mjs tools/tests/animation-sequences-039.mjs --projections /ruta/temporal/poses
python tools/tests/render-animation-sequences-039.py /ruta/temporal/poses
```

## Estados que siguen provisionales

**Arco, patada y locomoción direccional siguen siendo adaptaciones propias.** Los packs Standard no contienen `Bow_*`, un clip `Kick` original ni ciclos nativos de ocho direcciones. No se atribuyen esos movimientos a originales inexistentes. El atlas permite revisar poses y coherencia geométrica; la evaluación de fluidez, transiciones y sensación durante partidas requiere pruebas en navegador. No se afirma calidad AAA ni que cada poder tenga un clip exclusivo.
