# Project Arena · Animation Reference Pass v0.7

## Objetivo

Traducir las referencias visuales entregadas por el usuario a **principios de movimiento originales**, no a copias de clips: contacto de pies, transferencia de peso, lectura de preparación, RELEASE, follow-through y recuperación.

## Cambios principales

### Mago
- Locomoción con paso direccional específico para forward/backpedal/strafe/diagonal.
- Báculo con compensación de hombro→codo→muñeca, offset de agarre e inercia angular.
- El báculo deja de comportarse como una pieza soldada a la mano.
- Cast mantiene PREPARE→GATHER→CHANNEL y el RELEASE entra directamente en el marker autoritativo.
- Pulso normal continúa siendo distinto de un spell cast.

### Arquero
- Cast de arco ya no usa la pose genérica del mago.
- RAISE→NOCK→DRAW ocurre antes del RELEASE.
- RELEASE reduce `draw`, añade recoil y vibración del arco.
- Strafe y backpedal tienen amplitudes distintas de forward.

### Guerrero
- Normal A: tajo horizontal.
- Normal B: diagonal descendente.
- Alternancia determinista; no modifica daño ni intervalo de arma.
- Nuevas familias procedurales: `kick`, `shield`, `charge`, `cry`.
- El puntapié mueve realmente el objetivo IK de la pierna derecha.
- Utility pasiva ya no finge un heavy swing.

## Sincronía

Los normales leen el `weaponState` autoritativo y **no pueden cruzar visualmente su marker de impacto antes de RELEASE**. Los poderes llegan a presentación en `AbilityReleased`, por lo que la animación entra en el marker de release/follow-through en vez de reproducir un segundo windup tardío.

## Contrato futuro

`AnimationIntent` transporta ahora también:

- `actionVariant`
- `visualAction`

Esto permite que un futuro `ThreeSkinnedCharacterVisual` o `UnityAnimatorBridge` reproduzca exactamente la misma semántica con mallas riggeadas.

## Validación

- `node tools/run-tests.js` → 206/206
- `node tools/arbiter.js` → APROBADO
