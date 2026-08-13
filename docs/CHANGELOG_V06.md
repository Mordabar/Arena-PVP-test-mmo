# Project Arena · Tactical Rhythm v0.6

## Game feel

- `RELEASE` pasa a ser el punto autoritativo de commit para recurso, cooldown y GCD.
- Nuevo `weaponState`: READY → WINDUP → RELEASE → RECOVERY.
- El intervalo de arma continúa mientras el personaje se mueve: stop-shot real.
- Moverse durante WINDUP cancela el normal sin daño fantasma.
- Casteos estacionarios cancelados antes de RELEASE no gastan recurso, CD ni GCD.
- Salto, movimiento, cancelación manual y rotación corporal se distinguen por motivo.
- Los proyectiles creados en RELEASE sobreviven al movimiento posterior del caster.

## Weaving

- Metadata `combatTiming` para las 36 habilidades.
- `weaveAfterNormal`, `replacesNormal`, `blocksNormal` e `independent`.
- `weaponIntervalPolicy` independiente del tipo de daño.
- Cola única y determinista; `latest valid input wins`.
- Arquero: normal → Flecha perforante / Pulso invernal.
- Guerrero: normal → Impacto sísmico; weapon skills pueden reemplazar el normal antes de RELEASE.
- Mago: spell solicitado gana prioridad a un pulso normal aún no liberado.

## Presentación y laboratorio

- `AnimationIntent` transporta fase/progreso de arma y queue.
- Acción visual normal sincronizada con `weaponState`.
- Cancelación visual usa blend-out breve, sin tocar simulación.
- Nuevo escenario `Timing Lab`.
- Combat Log registra WINDUP, CANCEL, RELEASE y QUEUE con `world.time`.
- Click izquierdo conserva deadzone y giro cámara+cuerpo 1:1.

## Verificación

- 185/185 pruebas automáticas.
- `tools/arbiter.js`: APROBADO.
- El smoke test de navegador queda para entorno Hostinger/local no restringido: el navegador del entorno de empaquetado bloquea por política tanto `file://` como hosts privados/localhost.
