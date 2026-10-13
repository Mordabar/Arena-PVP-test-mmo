# Project Arena — instrucciones siempre activas para Claude Code

Project Arena es el prototipo Three.js de combate PvP inspirado en sensaciones de MMO. NO es la plataforma Regnum Arena Ladder en Laravel.

OBJETIVO: completar y validar una demo 1v1 jugable; animaciones creíbles y coherentes antes que nuevas features. Usar las skills `.claude/skills/arena-*/SKILL.md`. Iniciar `arena-project-audit` antes de editar; luego activar skills específicas (rig, animation forensics, browser QA, combat, powers, oneshot, release).

Versiones diferentes existen (ZIP revisado v0.34; otra rama llegó a v0.39): la verdad es el árbol ACTUAL. Documentar baseline. Lee `docs/ANIMATION_PLAYBOOK.md` si existe, particularmente prohibiciones de retargeting y duplicación de lógica de clips.

El render solo LEE la simulación; nunca escribe HP, posición, yaw, cooldowns ni lógica autoritativa. No cambiar a otro esqueleto; conservar Quaternius UAL 65 huesos hasta autorización. No fingir animaciones faltantes ni poner `FINAL` si solo pasan tests automáticos. No sustituir walk-back/strafe por `Walk_Loop` frontal diciendo que están resueltos. No hacer animaciones de arco a partir de pistola como si fueran finales.

Un cambio visual requiere inspección REAL: `node tools/anim-preview.mjs --class devastador`, `--set direccional`, `node tools/inspect-canvas.mjs --state combate` y secuencias/video con sincronización frente al estado de simulación. Se comparan capturas anteriores y posteriores. Si no hay navegador informar y pedir revisión en PC del usuario, no inventar pruebas.

No reestructurar todo por defecto. Corregir un defecto según la capa que lo causa. Antes de entregar: `node tools/agent/arena-doctor.mjs`, evidencias `agent-qa/`, demo local, matriz de aceptación y faltantes honestos. Se permite iteración autónoma sobre un objetivo completo; no introducir gastos ni servicios pagados.


## Alcance vigente — SOLO Arena PvP 1v1
La instrucción actualizada y prioritaria es `PROMPT_MAESTRO_ARENA_1V1.txt` del kit. No crear MMORPG completo ni instalar Blender/MCP. Priorizar poderes, daño, ARMADURA NUMÉRICA, armas/escudos visuales, HUD y partida completa 1v1. Leer `arena-armor-and-weapons`. No afirmar que existe armadura visual cuando en v0.34 se retiró del renderer. Usar herramientas que YA trae el repo; el agente puede ejecutarlas en su propio entorno.
