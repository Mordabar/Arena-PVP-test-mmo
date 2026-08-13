# Project Arena Ladder PvP — Alpha v0.8 Build Report

## BUILD

`0.8.0 · ladder-vertical-slice`

## IMPLEMENTADO

- Product loop local: lobby → countdown → match → results → rematch/lobby.
- Selección de Devastador, Guardián, Centinela, Rastreador, Arcanista y Vinculador.
- Training Lab accesible desde el shell de producto.
- 1v1 Ladder local y 2v2 Skirmish funcional sobre los escenarios existentes.
- Rating local encapsulado, placements, tiers, historial y persistencia segura en localStorage.
- Resultados por eventos de simulación, incluyendo doble KO/empate sin rating fantasma.
- Match chrome, team frames, countdown, stats post-match y shell responsive.
- Familias de audio para round start, victoria, derrota, selección y confirmación UI.
- Perfiles IA explícitos: melee pressure, ranged kiter, caster control, support healer, defensive peel y Ladder sparring.
- Los bots usan `World.turnEntityToward`, por lo que no reciben auto-face instantáneo privilegiado.

## ARQUITECTURA

Se mantiene la frontera:

`INPUT → COMMAND/INTENT → VALIDATION → ACTION STATE → RELEASE → RESOLUTION → EVENTS → PRESENTATION`

`product/ladder`, `product/matchFlow` y `ui/gameShell` no escriben HP, recurso, cooldowns ni resolución. El fin de partida se deriva de `EntityDied` y se evalúa tras el tick para preservar resultados simultáneos.

## TESTS

`node tools/run-tests.js` → **215/215**.

Incluye regresiones de RELEASE, cast transaccional, queue/weaving, cámara, movimiento, salto, LoS/facing, Animation Reference y producto Ladder.

## ARBITER

`node tools/arbiter.js` → **ARBITER: APROBADO**.

El árbitro v0.8 añade gates contra autoridad accidental desde UI/Product, doble KO, carga del entrypoint y privilegios de auto-face de bots.

## VISUAL CRITIC

`node tools/visual-audit.js` → **VISUAL CRITIC: APROBADO — auditoría estática v0.8**.

Valida entrypoint/assets, Arcane Wilds, vegetación instanciada, fog/sun, materiales, VFX, shell Ladder, six-class selection, match chrome, results y fronteras de autoridad.

## PERFORMANCE / BROWSER SMOKE

El smoke Chromium real fue intentado con `/usr/bin/chromium` usando `127.0.0.1` y la IP interna del contenedor. El navegador administrado bloquea ambos destinos con “Your organization doesn’t allow you to view this site”, antes de cargar JavaScript. La evidencia queda en `docs/qa-browser-policy-block.png`.

Por esta razón no se inventan métricas FPS/draw-call de v0.8 en este entorno. El build debe recibir un smoke/playtest final en un navegador sin esa política antes de considerar el gate visual-runtime observado.

## CRITICS

La revisión fresca detectó y resolvió: DOM estructural recreado por frame, auto-face privilegiado de IA, audio incorrecto en doble KO y auditores heredados de versiones anteriores. Detalle en `docs/FRESH_REVIEW_V08.md`.

## KNOWN LIMITATIONS

- Rating/matchmaking es deliberadamente local; está aislado para sustitución por backend autoritativo.
- Arte humanoide sigue siendo procedural/low-poly; la infraestructura visual continúa preparada para un backend GLB/skinned posterior.
- El smoke visual real está bloqueado por la política del Chromium de este entorno, no por un fallo detectado del proyecto.

## NEXT PRODUCT MILESTONE

Smoke visual externo + playtest humano del loop completo, corrección de defects observados y decisión del backend de personajes (GLB/skinned Three.js vs migración visual a Unity) sin reescribir la autoridad de combate.
