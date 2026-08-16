# v0.11 · Auditoría de modelos, animación e iconografía

## Diagnóstico

La captura de v0.10 mostraba tres problemas de producto:

1. anatomía compuesta por volúmenes demasiado ortogonales, especialmente torso, cara, manos y pies;
2. acciones corporales demasiado parecidas entre poderes de una misma familia;
3. cientos de poderes técnicamente distintos que visualmente compartían una gramática de iconos demasiado similar.

## Modelos

Cambios principales:

- `render/primitives.js`: `ellipsoid`, `torus`, `rotateX`, `rotateZ`;
- `render/characterVisual.js`: torso, abdomen, pelvis, cráneo, mandíbula, extremidades, manos y pies reconstruidos con masas curvas;
- `render/equipment.js`: aro de báculo como toro real, arco curvado por segmentos, escudo/armadura con perfiles menos ortogonales;
- se conserva `classVisuals` como fuente de identidad y el renderer no ramifica por nombres de clase.

El análisis de contorno sigue en verde. Peores parejas después del cambio:

- frontal: Centinela ≈ Rastreador, 19.2 %;
- 3/4: Centinela ≈ Vinculador, 21.8 %;
- perfil: Centinela ≈ Arcanista, 28.2 %.

## Animación

`AnimationIntent` sigue siendo el contrato neutral. La wave añade variedad sin entregar autoridad al renderer:

### Caster

Siete lenguajes funcionales:

- projectile;
- control;
- buff;
- heal;
- aoe;
- channel;
- instant.

Cada familia tiene variantes deterministas para hombro, mano libre, torso y báculo. Girar durante un cast sigue permitido; desplazarse/saltar antes de `RELEASE` sigue cancelando según simulación.

### Arquero

Familias data-driven:

- `archerQuick`;
- `archerControl`;
- `archerVolley`;
- `archerPower`.

Se mantiene la secuencia de lectura `RAISE → DRAW → RELEASE → RECOIL/RECOVERY`, sincronizada con el release autoritativo.

### Guerrero

Se preservan gestos separados para:

- normal horizontal/diagonal;
- kick;
- shield bash;
- charge;
- thrust/heavy;
- cry.

## Iconos

Los 410 poderes asignados tienen:

- familia funcional;
- motivo;
- acento;
- rotación;
- número de segmentos;
- espejo opcional;
- firma propia.

Gate: **410/410 firmas únicas y 410/410 SVG visibles distintos**.

## Powers / fidelity

- 320 registros fuente auditados;
- 290 poderes reales;
- 30 placeholders `undefined` excluidos;
- 410 asignaciones;
- 344 activos + 66 pasivos.

La v0.11 fija mediante tests:

- cast rank-5;
- categoría GCD;
- cooldown rank-5;
- duración rank-5;
- restricciones cruzadas traducidas a datos;
- reglas especiales sin caer en texto muerto;
- daño de la expansión continúa fixed/pure por decisión del milestone.

Defectos encontrados por el árbitro durante esta wave y corregidos:

- “resistir CC” no puede convertirse en auto-CC;
- posesión de invocación tenía mecánica pero carecía de rol VFX explícito;
- Cremación apuntaba al caster aunque su contrato exige cadáver enemigo;
- Cúpula de protección se había convertido en buff de objetivo; ahora es domo de radio 10, dura 20 s y excluye al caster.

## Gate visual real

Chromium del entorno abre, pero la política administrada bloquea `127.0.0.1` antes de cargar JavaScript. Evidencia: `docs/qa-browser-loopback-block-v011.png`.

Por ello no se declara falsamente un playtest visual browser como aprobado. El critic estático sí está verde; el juicio final de peso, timing y composición debe hacerse sobre el build desplegado.
