# BUILD REPORT v0.15 — SKINNED ANIMATION REBUILD

## 1. Diagnóstico

v0.14 usaba un puente incorrecto entre el humanoide procedural y el skeleton GLB, y además conservaba la composición procedural de equipo. Las capturas desplegadas demostraron corrupción estética visible aunque el rig fuese técnicamente skinned.

## 2. Arquitectura

Se añade `render/skinnedAnimationContract.js`. Consume estado visual ya derivado de la simulación y produce offsets locales para los 17 huesos. `threeCharacter.js` restablece bind local por frame y aplica dichos offsets. El root conserva posición/yaw mundial. La presentación no altera HP, daño, RELEASE, target, movimiento ni combat truth.

## 3. Alcance implementado

- cuerpo GLB limpio para las seis subclases;
- sin ropa/armadura procedural en ruta skinned;
- una sola arma visible por arquetipo;
- caster con guardia, normal de báculo y cast plantado completo;
- arquero con raise/draw/release/recoil/recovery y cuerda dinámica;
- melee con gramática original inicial;
- CC/knockdown sobre root/bones sin contaminar el arma;
- locomoción skinned conservadora sin transferencia de matrices del maniquí;
- FK adversarial para el full draw del arquero.

## 4. Archivos principales

- `js/render/skinnedAnimationContract.js`
- `js/render/three/threeCharacter.js`
- `js/tests/skinnedAnimationV015Tests.js`
- `tools/arbiter.js`
- `tools/visual-audit.js`
- `tools/agents/*motion*`, `rig-basis-agent.js`, `body-weapon-cleanup-agent.js`, `reference-motion-agent.js`
- `index.html`, `tests.html`, `js/namespace.js`
- documentación v0.15.

## 5. Tests

- suite: **367/367**;
- gate específico skinned: **12/12**;
- modelo GLB: **50.000 tris, 76.070 vértices, 17 bones, 1 skin, 3 imágenes PBR**;
- pesos: suma mínima 0.9999999553 / máxima 1.0000000447;
- auditor de skinning: mueve la cadena izquierda sin desplazar materialmente la derecha;
- sintaxis: **113 JS + 5 Python PASS**.

## 6. Agentes

Pasaron 11 agentes/revisores relevantes:

1. rig basis;
2. staff motion;
3. archer motion;
4. melee motion;
5. body+weapon cleanup;
6. reference motion;
7. animation;
8. character model;
9. integration;
10. presentation;
11. fresh reviewer.

## 7. Árbitro adversarial

**APROBADO.** Entre otras cosas prohíbe volver a `applyRigPose`, exige bind local, cuerpo+arma en GLB, modelo 50k/17 huesos, precarga del asset y suite completa verde.

El propio gate del arquero rechazó la primera solución del full draw porque la mano de cuerda no quedaba suficientemente detrás del arco. Se corrigió antes del cierre.

## 8. Auditoría visual

**Critic estático: APROBADO.** La inspección del navegador local no se puede ejecutar legítimamente: Chromium muestra `127.0.0.1 is blocked` antes de cargar JavaScript. Evidencia: `QA_BROWSER_POLICY_BLOCK_V015.png`.

Por honestidad, no se declara el game feel visual `VERIFIED` hasta el playtest desplegado.

## 9. Rendimiento

El asset sigue en **50k triángulos** y un único SkinnedMesh. Esta wave elimina además múltiples piezas de ropa/equipo procedural de la ruta GLB, pero no se publica una cifra de FPS porque el entorno no permite un smoke GPU real.

## 10. Próximo hito

Desplegar v0.15 y capturar secuencias cortas de: idle/walk, staff normal, spell cast, bow normal, bow power draw y melee. El ojo humano sobre esas seis secuencias decide la siguiente correction wave.
