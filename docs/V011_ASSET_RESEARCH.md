# v0.11 · Investigación de assets — personajes y animación

Objetivo: encontrar referencias y bases legales que permitan abandonar progresivamente el aspecto de “maniquí de primitivas” sin tocar la autoridad de simulación ni el contrato `AnimationIntent`.

## Criterios

- humanoide riggeado / retargetable;
- glTF/GLB o FBX;
- estética low-poly/stylized compatible con cámara MMO;
- licencia clara para prototipo y eventual uso comercial;
- suficiente cobertura de locomoción y combate;
- se usa como **base de producción**, nunca para copiar assets, animaciones o identidad de Champions of Regnum.

## Shortlist verificado

### Quaternius · Universal Base Characters

- 6 modelos base humanoides, variantes de proporción y 20 peinados;
- topología optimizada para animación, rig humanoide y retargeting;
- promedio declarado de ~13k triángulos;
- FBX y glTF;
- licencia CC0.

Referencia: https://quaternius.com/packs/universalbasecharacters.html

**Uso recomendado en Arena:** mejor candidato para el futuro backend skinned/GLTF porque permite conservar una topología más humana y añadir equipo propio de cada subclase sin rehacer simulación.

### Quaternius · Universal Animation Library 2

- 130+ animaciones;
- rig humanoide universal;
- FBX/GLB/Blend;
- combos separados en golpes y recovery;
- licencia CC0.

Referencia: https://quaternius.com/packs/universalanimationlibrary2.html

**Uso recomendado:** biblioteca de referencia/retargeting para locomoción, ataques armados y recoveries. Los markers de `RELEASE` de Arena siguen siendo autoridad; ningún clip importado decide impactos.

### KayKit · Adventurers

- 5 personajes fantasy stylized low-poly gratuitos;
- riggeados y animados;
- 25+ armas/accesorios, incluidos espada, escudo, arco y báculo;
- FBX/GLTF;
- licencia CC0.

Referencia: https://kaylousberg.itch.io/kaykit-adventurers

**Uso recomendado:** benchmark rápido de proporciones, legibilidad de silueta y densidad de equipo. Su tono es más “toy” que el objetivo de Arena, por lo que no se adopta sin un pass fuerte de identidad.

### KayKit · Character Animations

Referencia: https://kaylousberg.itch.io/kaykit-character-animations

**Uso recomendado:** segunda biblioteca de referencia para ciclos humanoides y pruebas de retargeting.

## Qué se incorporó en v0.11

No se empaquetó ningún asset externo: los sitios de descarga requieren flujo de descarga separado y esta iteración debe seguir siendo reproducible/redistribuible sin introducir archivos de terceros a ciegas.

En cambio, el backend procedural actual se acercó a una anatomía útil para el playtest:

- elipsoides/cápsulas para torso, cabeza, brazos, piernas, manos y pies;
- toro real para aros y coronas mágicas;
- rotación X/Z para equipo curvo/no ortogonal;
- arco con segmentos curvos;
- escudo torre y armaduras con volumen menos “box-on-box”.

Esto es un **puente**, no el techo visual. La ruta recomendada después del playtest de v0.11 es:

`AnimationIntent → ThreeSkinnedCharacterVisual(GLTF) → clips retargeted → marker visual sincronizado con RELEASE`

La simulación, los poderes y los tests no cambian al sustituir la representación.
