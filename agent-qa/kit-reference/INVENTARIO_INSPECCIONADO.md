# Inventario de referencia: v0.34 inspeccionada

> Este inventario **no implica** que otra rama v0.39 sea idéntica. El agente debe volver a inventariar antes de cambiar código.

- Web de inicio: `index.html`, Three.js vendorizado `vendor/three-0.160.0/` (sin package.json ni bundler principal).
- Núcleo combate: `js/core/`, `js/combat/`, `js/sim/`, `js/data/`, `js/ai/`.
- Clases: devastador, guardian, centinela, rastreador, arcanista, vinculador.
- Animación: `js/anim/animationIntent.js` + `js/render/animationStateMachine.js`, `js/render/characterVisual.js`, `js/render/three/threeDirectAnim.js`, `js/render/three/threeCharacter.js`, `js/data/animationSourcePlan.js`.
- Playbook de precedentes: `docs/ANIMATION_PLAYBOOK.md` (lectura obligatoria), con prohibiciones y diagnósticos concretos.
- Archivos de animación: `assets/animations/ual1-arena-runtime.glb` (17 clips), `ual2-melee-runtime.glb` (13), `ual2-rm-runtime.glb` (1) y `arena-cmu-v031.json` (10). Cuatro clips de arco sintetizados en tiempo real (no presentes en GLB). Total 45 catalogados en herramienta.
- Auditor: `node tools/audit-clips.mjs` → **45 nombres catalogados, 69 referencias aprobadas** en revisión local. Verificar que las 4 sintetizadas sigan generándose en runtime.
- Inspector browser: `node tools/inspect-canvas.mjs --state combate`. Inspector de estados: `node tools/anim-preview.mjs --class devastador` o `--class guardian`, `--set direccional`.
- Deuda observada: retroceso, strafe y giro sin animaciones nativas confiables; clase de arquero utiliza clips derivados de pistola; calidad de CMU sin verificar; 9 clips direccionales CMU desconectados intencionalmente.
- Render/Three.js no debe alterar HP, posición, cooldowns ni yaw autoritativo; el reloj de impacto se sincroniza con la simulación.
- Las capturas y métricas no son por sí solas una validación artística.

## Requisitos del usuario recuperados de rama de prototipado

- Objetivo ONE SHOT: prototipo **jugable 1v1** hasta calidad que permita evaluar el gamefeel, con poderes, iconos, tiempos de casteo/reload/cooldown, VFX de cada poder, reacciones al daño, controles y animación de estados.
- Conservar la base funcional existente. Vista local/interna donde el usuario y agente puedan abrir el juego y verificar cambios.
- Existe trabajo posterior en una rama v0.39 con integración de un catálogo grande de poderes; **no está incluido en este ZIP**, por tanto no asumir que el inventario 0.34 representa el estado más reciente.
- Sin presupuesto adicional para generación/hosting/herramientas de pago: priorizar herramientas y assets licenciados gratuitos.
- La modalidad 3v3 abierta y otras arenas son visión futura; no bloquear el vertical slice 1v1 por diseñarlas ahora.
