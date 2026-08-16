# BUILD REPORT · Project Arena v0.11

## BUILD

**Ladder Vertical Slice v0.11 · Character & Animation / Power Fidelity Pass**

## IMPLEMENTADO

- anatomía procedural curva para reducir apariencia de maniquí/cajas;
- equipo crítico rehecho: arco, escudos, aros/coronas y armadura;
- siete familias de lenguaje corporal caster;
- cuatro familias funcionales de poderes de arquero;
- familias guerrero preservadas y diferenciadas;
- 410 iconos derivados con dibujo visible globalmente único;
- biblioteca 320 → 290 reales → 410 asignaciones;
- cast, GCD, cooldown y duración fuente rank-5 protegidos por tests;
- mecánicas especiales y restricciones cruzadas compiladas a contratos data-driven;
- Cremación y Cúpula de protección corregidas tras hallazgos adversariales;
- 10 agentes/revisores ejecutables + árbitro v0.11.

## ARQUITECTURA

Se conserva:

`INPUT → COMMAND → VALIDATION → ACTION STATE → RELEASE → RESOLUTION → EVENTS → PRESENTATION`

Modelos, animación, iconos y VFX siguen siendo presentación. Ningún cambio visual obtiene autoridad sobre HP, recurso, cooldown, GCD, posición o resolución.

## CONTENT

- Devastador: 65 asignaciones;
- Guardián: 65;
- Centinela: 65;
- Rastreador: 65;
- Arcanista: 75;
- Vinculador: 75.

Total: **410 asignaciones / 344 activos / 66 pasivos**.

## TESTS

`node tools/run-tests.js` → **319/319 verdes**.

`node tools/run-agents.js` → **10/10 APROBADOS**.

`node tools/visual-audit.js` → **VISUAL CRITIC APROBADO (estático)**.

`node tools/arbiter.js` → **ARBITER: APROBADO**.

`node tools/run-gates.js --rapido` → puertas headless obligatorias verdes.

## ARBITER

Fix waves reales de esta iteración:

1. posesión de invocación sin lectura VFX → rol CONTROL;
2. Cremación con target incorrecto → cadáver enemigo + `cremate`;
3. Cúpula de protección mal traducida → aura aliada, radio 10, 20 s, caster excluido;
4. GCD fuente añadido al gate de paridad;
5. iconografía globalmente única, no sólo por subclase.

## MODELOS / SILUETA

Peor diferencia de contorno:

- frontal: 19.2 %;
- 3/4: 21.8 %;
- perfil: 28.2 %.

## RESEARCH

Se documentaron candidatos CC0 para el futuro backend skinned/GLTF: Quaternius Universal Base Characters + Universal Animation Library 2 y KayKit Adventurers/Character Animations. Ver `docs/V011_ASSET_RESEARCH.md`.

## LIMITACIONES NO FALSIFICADAS

- smoke browser real bloqueado por política organizacional de loopback; captura adjunta;
- Pointer Lock sigue `MANUAL_BROWSER_REQUIRED`;
- 60 FPS debe medirse en GPU real;
- el backend actual sigue siendo procedural por piezas, aunque mucho menos ortogonal; el salto definitivo de calidad requerirá skinned GLTF/GLB retargetable.

## SIGUIENTE MACRO HITO

Playtest visual de v0.11 desplegado. Si la nueva anatomía todavía se percibe como procedural, sustituir sólo la representación por backend skinned GLTF manteniendo `AnimationIntent`, RELEASE y toda la simulación actual.
