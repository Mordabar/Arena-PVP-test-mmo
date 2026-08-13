# Project Arena · Arcane Wilds v0.5

## Game Feel + VFX pass

- Arena lógica ampliada a 46×34 manteniendo el núcleo táctico central y añadiendo cobertura exterior.
- Salto con `Espacio`, resuelto en fixed tick y desacoplado de rango/LoS horizontal.
- Click izquierdo sostenido: el delta horizontal del ratón gobierna cámara y giro del personaje 1:1; sin límite artificial de TURN_SPEED.
- Click derecho sostenido: free-look de cámara sin girar el personaje.
- Locomoción del caster refinada: zancada, pelvis, contrapeso, brazo de bastón e inercia visual.
- Casteos del mago refinados y aura procedural alrededor de la gema del bastón.
- Proyectiles Three.js visibles: flechas y proyectiles mágicos con núcleo, halo y estela.
- VFX de impacto/casteo con chispas, fragmentos, wisps y runas.
- Iconografía vectorial propia por habilidad, generada localmente sin assets externos.
- Entorno ampliado con bosque exterior, ruinas, props, fog y luciérnagas ambientales.
- Mantiene la separación `INPUT → COMMAND → SIMULATION → EVENTS → PRESENTATION`.
- `AnimationIntent` transporta `airborne` + progreso de salto para futuros GLB/Unity.
- El bastón usa orientación compensada hombro→codo→mano para evitar flips durante channel/release.
