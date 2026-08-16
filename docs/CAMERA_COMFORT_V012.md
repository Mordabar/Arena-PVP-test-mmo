# Project Arena v0.12 — Camera Comfort Contract

## Regla de control

### Arrastre izquierdo

El arrastre horizontal sigue siendo manipulación directa:

`deltaYawCamera === deltaYawCharacter`

La cámara rota con el mouse y la simulación recibe exactamente ese delta corporal. No hay auto-face al objetivo.

### Q / E

Q/E siguen siendo giro corporal limitado por la simulación. Después del `world.advance(realDt)`, la cámara copia **el delta de yaw que la simulación realmente aceptó**.

Esto evita dos defectos:

- si un hard CC impide girar, la cámara no gira fingiendo que el cuerpo sí lo hizo;
- no se duplica el giro cuando el usuario está usando steer con botón izquierdo.

### Botón derecho

Free-look permanece independiente: gira sólo la cámara. Soltarlo no produce snap al cuerpo.

## Invariante de autoridad

`Camera3D.followBodyYaw()` sólo modifica `camera.yaw`. Nunca escribe `entity.yaw`, posiciones, HP, cooldowns o estados.

## Gates

- left drag 1:1 preservado;
- Q/E camera follow usa delta post-simulación;
- pitch y zoom no cambian por `followBodyYaw`;
- free-look no recibe doble giro;
- test de hard-control existente sigue preservando autoridad de simulación.
