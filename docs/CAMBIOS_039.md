# Project Arena v0.39 · Trainer, fórmulas y animación

## Cómo probar

Abre Entrenamiento, elige una clase y pulsa **B**. Busca por nombre variante, original o rama. Cada tarjeta ofrece niveles 1–5, comparación de efectos y selección de pasivos. Arrastra los activos a las barras. Los cambios se guardan por navegador; el build se bloquea durante preparación y duelo. Un poder en casteo/vuelo no admite cambio de nivel.

En Combat Lab, **Fórmulas Regnum** permite elegir daño de arma, atributo principal, protección total del objetivo y grado de resistencia de sus piezas. El último golpe muestra bruto, resistencia, armadura y daño aplicado.

## Catálogo

- Fuente recibida: `reference/trainerdata.json`, CoRT 1.35.19. 32 ramas, 290 poderes reales; 30 slots indefinidos excluidos. Las ramas compartidas producen 410 asignaciones a las seis clases y 2.050 variantes de nivel.
- Nombres variantes e iconos SVG originales por poder; el nombre de referencia sigue visible. Meteorito del caos usa una roca encendida, Patada un pie, flechas/arcos sus motivos, curas sus símbolos.
- Maná, cast, cooldown, duración y valores de los cinco niveles provienen del JSON. Los pasivos son optativos, no se acumulan todos automáticamente. Se combinan las filas de un mismo buff para conservar todos sus efectos simultáneos.
- Las seis clases usan el recurso Maná del trainer; el pool inicial mantiene la calibración de Arena.
- Firmas VFX por poder: silueta temática, semilla, número de partículas, proporciones, pulso y giro. Son variaciones cosméticas; no añaden impactos de daño. El vuelo autoritativo sigue siendo único. Meteorito interrumpido cancela su visual.

## Fórmulas conectadas al combate

El modelo histórico del Excel recibido sustituye la reducción porcentual genérica: resistencia por pieza/elemento, suma de componentes, una resta de protección × 0,52 por golpe, crítico × 1,33 después. Arma y atributo usan sus coeficientes por clase; los bonus de arma no multiplican el daño pasivo del atributo. Probabilidad de crítico, evasión, resistencia de poderes, intervalos de ataque, velocidad de cast y GCD consumen el modelo. Ver `REGNUM_FORMULAS.md` para coordenadas y excepciones.

El equipo inicial es una calibración de Arena, no ítems inventados de Regnum: atributo principal 80 (resto 20), concentración 60, nivel 60, piezas normales distribuidas para conservar la protección base de cada clase. Esto evita que el ataque normal de equipo inicial quede anulado por la nueva resta de armadura. Vida/maná iniciales conservan la escala de Arena. El factor 0,52 del Excel es comunitario, experimental y probado originalmente sólo en arqueros; no se presenta como fórmula oficial actual.

## Animación

- Laterales y retroceso: base nativa de guardia con pies direccionales, sin contaminar torso de combate con pelvis/columna del clip Walk.
- Patada: IK temporal sobre el rig nativo; arco: mano, cuerda y nock coherentes; cast: bastón junto al cuerpo y mano libre canalizando.
- Patada y arco siguen siendo adaptaciones **provisionales**: los packs disponibles no incluyen sus clips originales. La representación no escribe HP, daño ni posición de simulación.

## Alcance y límites de primera fase

- Editor de build libre, no campaña completa con presupuesto de puntos y desbloqueos; arrays de progresión originales conservados para esa fase futura.
- Domar utiliza compañeros enemigos; no existe fauna salvaje ni ecosistema de criaturas/niveles. Las invocaciones utilizan el sistema actual de compañeros, no modelos dedicados por criatura.
- Revivir requiere aliado muerto y no inventa autocura/barrera en 1v1. Cremación requiere cadáver y bloquea resurrección; no hay altares de mundo abierto. Portales usan destino de suelo de Arena, no selección de locaciones externas.
- Rango dirigido 0 hereda alcance del arma. GCD por categorías usa segundos del perfil Arena: el trainer no proporciona segundos. Reglas de arma específica y mundo abierto aún no equivalen a un servidor Regnum.
- Duelo local contra IA, no red multijugador autoritativa. QA numérica/CPU no certifica navegador/GPU, balance competitivo ni calidad final AAA.

## Reproducibilidad

`node tools/generate-trainer-presentation.mjs` y `node tools/build-trainer.mjs` regeneran presentación y catálogo desde las fuentes empaquetadas. Desde la carpeta del juego, ejecutar `node tools/tests/regnum-formulas.mjs`, `node tools/tests/trainer-039.mjs`, `node tools/tests/duel-regression.mjs` y `node tools/tests/game-flow-regression.mjs`. Para tests que importan Three.js usar el alias local sin npm: `node --experimental-loader ./tools/tests/three-loader.mjs tools/tests/animation-regression.mjs` (también para `animation-sequences-039.mjs` y `static-visual-039.mjs`).
