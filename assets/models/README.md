# assets/models

Aquí van los `.glb` cuando existan:

```
human_melee.glb
human_archer.glb
human_caster.glb
```

Todavía **no hay ninguno**, y el juego no los necesita: los personajes son
procedurales y se dibujan con la geometría que genera `render/characterVisual.js`.

## Qué tendrá que cumplir un modelo para entrar

1. **Rig humanoide** con los nombres de hueso que declara
   `js/render/anim/skeleton.js` (`PELVIS`, `SPINE_01/02`, `CHEST`, `NECK`,
   `HEAD`, `CLAVICLE_*`, `UPPER_ARM_*`, `LOWER_ARM_*`, `HAND_*`, `THIGH_*`,
   `CALF_*`, `FOOT_*`). Si el exportador usa otros, se escribe una tabla de
   equivalencia en el backend — no se renombra el proyecto.
2. **Sockets de arma**: `SOCKET_WEAPON_R`, `SOCKET_WEAPON_L`, `SOCKET_SHIELD`,
   `SOCKET_BACK`, `SOCKET_HEAD`, `SOCKET_PROJECTILE`.
3. **Sin root motion.** La posición la decide la simulación. Un clip que lleve
   desplazamiento incorporado hay que desactivarlo al importarlo, o el
   personaje visual y el lógico se separarán.
4. **Escala en metros**, con el personaje midiendo ~1.85 unidades, que es
   `B.ENTITY_HEIGHT`.
5. **Origen en los pies**, mirando hacia **+Z**.

Ver `docs/RENDERER_MIGRATION.md`.
