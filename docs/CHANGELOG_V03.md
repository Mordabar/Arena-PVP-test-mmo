# Project Arena · Three.js Visual Pass v0.3

## Cambios principales

- Corregido el strafe A/D: con el personaje mirando a +Z, `A` va a -X y `D` a +X.
- Actualizada la proyección local de locomoción y sus pruebas para que la animación de strafe coincida con el desplazamiento real.
- Nuevo entorno Three.js low-poly sobre el mismo mapa lógico 32×24:
  - césped y caminos procedurales;
  - piedra texturizada proceduralmente;
  - árboles, arbustos, rocas, colinas y ruinas perimetrales;
  - banderas y braseros con animación ligera;
  - cielo, niebla, iluminación y sombras revisadas.
- Materiales de personajes con texturas procedurales distintas para piel, tela, cuero, metal, madera y magia.
- Mejoras de silueta:
  - sombrero low-poly para Arcanista;
  - dagas secundarias visibles para Centinela/Rastreador;
  - capa y túnica con movimiento secundario visual.
- `index.html` mantiene el fallback local WebGL2, pero en HTTP/HTTPS redirige automáticamente a `index-three.html`.
- Three.js sigue vendorizado en `vendor/three-0.160.0/`; no se añadió npm ni ninguna dependencia nueva.

## Validación

- 156/156 pruebas automáticas pasan.
- Se validó sintaxis de los módulos Three.js y scripts modificados con `node --check`.
