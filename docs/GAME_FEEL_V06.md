# Project Arena · Tactical Rhythm v0.6

## Diagnóstico de v0.5

La v0.5 ya tenía buen control, locomoción, salto, VFX y separación de renderer, pero el combate todavía mezclaba conceptos que debían vivir en relojes distintos: ataque normal, casteo, cooldown y GCD. El problema más importante era semántico: el sistema no expresaba con suficiente claridad **BEGIN vs RELEASE**, lo que hacía difícil reproducir stop-shot, weaving, cancelación sin coste y weapon skills que reemplazan un swing.

## Arquitectura temporal final

- **WeaponState**: `READY → WINDUP → RELEASE → RECOVERY → READY`. El intervalo sigue progresando mientras el jugador se mueve; moverse sólo impide comenzar/liberar el normal y puede cancelar un windup todavía no liberado.
- **ActionState**: comunica qué acción autoritativa está en curso sin delegar resolución al renderer.
- **PendingCast**: reserva intención, objetivo, posición/yaw inicial, duración, escuela y coste esperado. No paga nada al comenzar.
- **Release**: único punto transaccional para recurso, cooldown, GCD y creación/resolución del poder.
- **QueuedAction**: como máximo una intención futura. Una nueva entrada válida puede sustituir la anterior.
- **Weaving policies**: cada habilidad declara `normalInteraction` y `weaponIntervalPolicy`; nunca se infiere por “hace daño”.

## Secuencias objetivo

### Arquero
`mover → parar → normal WINDUP → normal RELEASE → poder weave → volver a mover`.

### Guerrero
`normal RELEASE → CC weave` conserva ambos eventos. Un `weaponSkill` solicitado antes del RELEASE puede reemplazar el normal; después del RELEASE ya no puede borrarlo y debe respetar el intervalo de arma.

### Mago
`BEGIN cast → CASTING → RELEASE/commit → GCD → queue → siguiente BEGIN`. Movimiento, salto o cancelación manual antes de RELEASE no consumen recurso, cooldown ni GCD.

## Presentación

`AnimationIntent` expone fase de arma, progreso, acción, RELEASE y cola. El humanoide procedural sincroniza la anticipación/impacto del normal con `weaponState`; la animación puede suavizar cancelaciones, pero jamás decidir el impacto.

## Timing Lab

El Combat Lab incluye ahora `Timing Lab` con blancos para practicar stop-shot, weave, replace, cancelación de cast, cadena de GCD y bordes de RELEASE. El Combat Log registra WINDUP, CANCEL, RELEASE y QUEUE con tiempo de simulación.
