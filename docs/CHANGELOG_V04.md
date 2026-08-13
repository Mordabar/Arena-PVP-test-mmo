# Project Arena · Three.js Verdant Ruins v0.4

## Objetivo

Resolver dos regresiones visibles de v0.3 —strafe A/D percibido al revés y un
renderer Three.js demasiado parecido al laboratorio gris— sin tocar las reglas
de combate ni el mapa lógico.

## Cambios

- **A/D corregidos en la convención perceptual de la cámara:** con el avatar
  mirando a +Z y la cámara detrás, D usa −X y A usa +X. Se alinearon movimiento,
  locomoción procedural, foot locking y pruebas.
- **Verdant Ruins:** nuevo entorno visual Three.js sobre los mismos colliders.
  Los pilares son árboles antiguos, los muros son ruinas con musgo, las
  plataformas tienen turf y el exterior tiene bosque, rocas y colinas.
- Texturas procedurales para césped/camino, piedra y madera; cielo degradado,
  niebla, luz cálida y braseros.
- Modelos provisionales con más lectura de arquetipo: insignia/hombreras en
  melee, bufanda/bolsa en archer, manto/puños/sombrero/báculo en caster.
- Materiales diferenciados para piel, tela, cuero, metal, madera y magia.
- Ajuste de locomoción caster para reducir el shuffle sin alterar la velocidad
  lógica ni los timings de combate.
- Cámara inicial un poco más próxima y menos alta.
- HUD Three.js `Verdant Glass`.
- Cache-busting y `.htaccess` no-cache para evitar que Hostinger siga mostrando
  JS/CSS antiguos durante el desarrollo.
- Nuevo `tools/visual-audit.js` como árbitro adversarial estático de esta fase.

## Gate de entrega

```text
node tools/run-tests.js    -> 156/156
node tools/visual-audit.js -> ARBITER: APROBADO
```
