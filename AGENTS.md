# Project Arena — contrato para agentes

Este es Project Arena (videojuego Three.js), NO la plataforma Laravel Regnum Arena Ladder. El usuario quiere un prototipo 1v1 completo en una sesión iterativa autónoma: gameplay tab-targeting, cast/reload/cooldown, poderes/iconos/VFX, bots, animaciones por estado y preview web, sin herramientas de pago.

PRIMERO identificar versión actual; existe historia v0.34→v0.39, no sustituir avances con archivos anteriores. Leer `docs/ANIMATION_PLAYBOOK.md` y `agent-qa/kit-reference/ARQUITECTURA_Y_BLOQUEOS.md` si presentes; en caso contrario consultar las skills `arena-project-audit` y `arena-animation-forensics`.

El mayor bloqueo anterior es animación visual; el gamefeel y lógica de combate eran aceptables. Reutilizar, no rehacer. Rig QUATERNIUS_UAL_NATIVE_65, sin retargeting arbitrario. Cambios de render nunca alteran simulación; `RELEASE` es reloj de impacto. Arquitectura v0.34: `characterVisual`→`animationStateMachine`→`animationSourcePlan`→`threeDirectAnim`→`threeCharacter`. Comprobar esquema de la versión actual.

Reglas de salida: clips auditados por `node tools/audit-clips.mjs`; acciones y temporización validadas EN JUEGO con `node tools/anim-preview.mjs` / `node tools/inspect-canvas.mjs` y secuencias; screenshots + logs de consola + prueba completa 1v1. No FINAL sin aceptación visual. Usar `node tools/agent/arena-doctor.mjs` e inventariar assets. Si falta un clip real, declarar PROVISIONAL/BLOCKED_ASSET, no inventar ni simular. No comprar ni copiar assets propietarios. Para ver faltantes y criterios, activar skills `.agents/skills/arena-*/SKILL.md`.

Trabajar en branch/snapshot previo. Documentar evidencias en `agent-qa/`. No declarar cumplimiento sin archivos de evidencia o sin indicar por qué falta entorno. No rediseñar universo/clases/modos futuros hasta entregar 1v1 jugable.


## Alcance vigente — SOLO Arena PvP 1v1
La instrucción actualizada y prioritaria es `PROMPT_MAESTRO_ARENA_1V1.txt` del kit. No crear MMORPG completo ni instalar Blender/MCP. Priorizar poderes, daño, ARMADURA NUMÉRICA, armas/escudos visuales, HUD y partida completa 1v1. Leer `arena-armor-and-weapons`. No afirmar que existe armadura visual cuando en v0.34 se retiró del renderer. Usar herramientas que YA trae el repo; el agente puede ejecutarlas en su propio entorno.
