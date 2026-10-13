---
name: arena-animation-forensics
description: Diagnostica errores de animaciones, clips GLB, blending, estados, strafe, retroceso, giro, arco, caster y sincronización en Three.js sin inventar clips. Usar ante T-pose, sliding o gestos incorrectos.
---


# Forense de animación — Project Arena

Lee `docs/ANIMATION_PLAYBOOK.md` completo y `js/data/animationSourcePlan.js` real antes de proponer una solución.

## Árbol de diagnóstico
- **Estado de simulación incorrecto**: `js/sim/` y `js/combat/` (no arreglar con clips falsos).
- **Intención visual incorrecta**: `js/render/characterVisual.js` y `js/anim/animationIntent.js`.
- **Clip equivocado**: `js/render/animationStateMachine.js`, datos/animationSourcePlan.
- **El clip existe pero se ve mal**: inspecciona GLB en `tools/agent/arena-glb-inspect.mjs`; analiza skeleton, canales, origen, root motion y mezcla de upper/lower en `threeDirectAnim`.
- **El gesto es bueno pero llega tarde**: compara `RELEASE` del combate con `IMPACT` visual y el reloj autoritativo, NO alteres la simulación por estética.

## Pasos de validación
1. Ejecuta `node tools/audit-clips.mjs --clip NOMBRE_REAL` y `node tools/audit-clips.mjs`.
2. Para locomoción, prueba W/S/A/D, diagonales y Q/E con `node tools/anim-preview.mjs --set direccional` (si existe). Toma secuencias adicionales, porque un PNG puede ocultar patinamiento o snaps.
3. Para combate, `node tools/anim-preview.mjs --class devastador` y otras clases. Observa preparación→release→recovery y transiciones a hurt/CC/death.
4. Mantén rig Quaternius UAL 65 huesos nativo, no retargeting arbitrario. CMU direccional se desconectó por falta de verificación, no recuperarlo ciegamente.
5. Si falta un clip, declararlo `MISSING_EXACT_CLIP`, `PROVISIONAL`, `BLOCKED_ASSET` según versión. No reetiquetar como FINAL por existir un fallback visualmente equivocado.
6. Después de cada cambio, vuelve a correr auditor y navegador y compara resultados.

La calidad percibida siempre debe ser revisada por el usuario. Reporta defectos que siguen observables, sin confianza fingida.
