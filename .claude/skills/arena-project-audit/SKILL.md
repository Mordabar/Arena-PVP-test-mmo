---
name: arena-project-audit
description: Audita antes de editar código el proyecto Three.js Project Arena, versión real, árbol de módulos, recursos/GLB, comandos y defectos. Úsala al abrir una rama, ZIP nuevo o pedir un cambio amplio.
---


# Objetivo
Inventariar EXACTAMENTE la versión actual del repo antes de modificarla. El ZIP previamente inspeccionado corresponde a v0.34, pero podría existir v0.39 u otra variante.

## Pasos
1. Identifica raíz real (`index.html`, `js/`, `assets/`, `tools/`). Obtén `git status` y commit, si existe repo; nunca resetees cambios ajenos.
2. Lee `docs/ANIMATION_PLAYBOOK.md`, `js/data/animationSourcePlan.js`, `js/anim/animationIntent.js`, `js/render/three/threeDirectAnim.js` y `js/render/animationStateMachine.js`. Si cambió estructura, describe diferencias.
3. Ejecuta `node tools/agent/arena-doctor.mjs`, `node tools/agent/arena-glb-inspect.mjs`. Corre audit original si existe.
4. Lista clases, habilidades, estados, binds UI, VFX, activos de personajes y licencias; si hay `trainerdata.json` o poderes extra, cuenta nombres/IDs reales.
5. Identifica las rutas de preview y QA que funcionan en esta versión, sin instaladores innecesarios.
6. Crea `agent-qa/BASELINE.md`: versión, comandos, lista de bloques, fallos reproduci(b)les y riesgos. No califiques de FINAL nada sin prueba visual.

## Salida
Inventario técnico comprobable y lista corta de principales defectos; NO reescribas módulos en esta fase. Prioriza preservar el gamefeel.
