---
name: arena-armor-and-weapons
description: Auditar e implementar de modo honesto armadura numérica, resistencia mágica, ruptura de armadura, armas y escudos visibles con los recursos existentes de Project Arena.
---

# Armadura numérica ≠ armadura visual ≠ armas

**Primero inspecciona la versión actual.** En el ZIP v0.34 hay protección numérica en `js/core/entity.js` (métodos `armor()` / `resist()`), aplicación de defensa en `js/combat/damageSystem.js`, valores de clase en `js/data/classes.js` y `js/data/balance.js`, estado de ruptura `armorBreak` en `js/data/effects.js` y armas/escudo 3D enlazados a huesos en `js/render/three/threeCharacter.js`.

En v0.34 `threeCharacter.js` indica expresamente que la antigua armadura visual procedural fue retirara del runtime por problemas de integración; `buildGear` **no** equipa armaduras visuales. No declares el equipamiento completo simplemente porque `armor()` reduzca el daño.

## Pruebas obligatorias (automatizadas y visuales)

1. Comparar mismo ataque y RNG desactivado contra dos defensas diferentes. Mayor defensa física → menor daño físico. Mayor resistencia → menor daño mágico. El daño puro no debe usar la misma mitigación. Comprobar límites y efectos de `armorBreak`; tras expirar, se restaura la defensa.
2. Comprobar en secuencias (no un solo screenshot) que arma de una mano/dos manos/arco/bastón/escudo siguen los huesos correctos durante idle, avance, strafe, ataques, cast, daño y muerte, y no atraviesan torso/cara ni flotan gravemente.
3. Si los modelos actuales incluyen o permiten UNA armadura visual sostenible, integrarla solo tras registrar resultado visual aceptable. NO reintroducir el gear legacy si genera roturas; no generar por código piezas de armadura de baja calidad solo para marcar la tarea como lista.
4. Si no hay assets adecuados, declarar `ARMADURA_VISUAL_PENDIENTE_POR_ASSET` y entregar protección numérica funcional con evidencia. Se puede pulir color/material básico del cuerpo SIN presentarlo como armadura equipable.
5. No permitir que render modifique HP, defensa o estados de combate; no crear/destruir geometría por fotograma.

## Estado verificable

Reportar separadamente `DEFENSA_NUMERICA`, `ARMAS_3D`, `ESCUDO_3D`, `ARMADURA_VISUAL_EQUIPABLE` con valores `VALIDADO`, `PROVISIONAL`, `NO_PROBADO`, `BLOQUEADO_POR_ASSET` y evidencias por cada estado.
