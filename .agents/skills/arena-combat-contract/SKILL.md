---
name: arena-combat-contract
description: Conserva la simulación autoritativa y alinea las animaciones, poderes, damage, cooldown, cast, GCD, CC y condiciones del 1v1. Úsala al integrar gameplay y evitar regresiones.
---


# Contrato de combate sim→render

El usuario reportó gamefeel aceptable. No rehacer sim, colisiones, combate o movimiento sin falla reproducible.

1. Localiza fuente real para posición, yaw, HP, cooldowns, cast/windup/release/recovery y estados CC. En v0.34: `js/sim/`, `js/core/`, `js/combat/`, `js/data/`.
2. La simulación decide legalidad de target, costes, daño, curación, GCD, efectos, duración y muerte. Los módulos `render/` SOLO representan los eventos/estados.
3. Probar sincronía: el visual WINDUP inicia con fase real y RELEASE tiene un frame de impacto; RECOVERY no altera la duración real. No duplicar relojes de gameplay en UI.
4. Un ataque interrumpido no puede aplicar daño o emitir VFX de impacto válido; si la simulación así lo dicta, animación debe reflejarlo.
5. HUD/cooldown/icono debe leer datos, no valores hardcodeados distintos.
6. Prueba de regresión 1v1 contra bot: daño, rango, line-of-sight si aplica, aggro/target, cast cancel/interrupción, CC, muerte, victoria y restart.
7. Si se toca combate, documentar before/after y caso de prueba; no arreglar una animación moviendo hitboxes sin evidencia.

La muerte/revivir del sanador y equipo de 3 son reglas de FUTURO 3v3, no criterios para la demo 1v1 actual.
