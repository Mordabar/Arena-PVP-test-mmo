# Animation Integration v0.16 — UAL2 Standard → Dark Elf

## Objetivo

Sustituir parte de la locomoción/acciones FK provisionales por clips humanoides del paquete **Universal Animation Library 2 Standard** entregado por el usuario, sin romper la autoridad de simulación ni volver a deformar el GLB del Elfo Oscuro.

## Asset integrado

- `assets/animations/ual2-standard.glb`
- `assets/animations/UAL2_LICENSE.txt`
- 43 clips detectados.
- Variante Standard sin root motion: el auditor mide 0 desplazamiento del `root` en `Walk_Carry_Loop`.

## Mapeo de rig

17 huesos objetivo:

`Hips, Spine, Chest, Neck, Head, Left/RightUpperArm, Left/RightLowerArm, Left/RightHand, Left/RightUpperLeg, Left/RightLowerLeg, Left/RightFoot`.

El retarget no copia matrices locales a ciegas. `threeRetarget.js`:

1. muestrea el source clip;
2. calcula quaternion WORLD del hueso fuente;
3. obtiene delta respecto al bind WORLD fuente;
4. aplica el delta sobre el bind WORLD del Dark Elf;
5. reconstruye quaternion LOCAL objetivo;
6. mezcla contra el bind LOCAL real del Dark Elf.

Esto evita repetir el defecto de v0.14, donde matrices del maniquí procedural se imponían sobre otro bind skeleton.

## Clips conectados

| Estado Arena | Clip UAL2 | Máscara / regla |
|---|---|---|
| Idle | `Idle_FoldArms_Loop` | lowerSpine; brazos siguen en guardia Arena |
| Forward | `Walk_Carry_Loop` | lowerSpine |
| Backpedal | `Walk_Carry_Loop` | fase invertida; yaw no se invierte |
| Hit | `Hit_Knockback` | upperBody; no congela locomoción |
| Jump takeoff | `NinjaJump_Start` | lowerSpine |
| Jump airborne | `NinjaJump_Idle_Loop` | lowerSpine |
| Landing | `NinjaJump_Land` | lowerSpine |
| Melee normal A/B/C | `Sword_Regular_A/B/C` | full body con blend |
| Heavy | `Sword_Heavy_Combo` | full body con blend |
| Block | `Sword_Block` / shield | full body |
| Charge | `Sword_Dash` | full body; root translation descartada |

Los clips de acción se muestrean entre 8% y 92% de su duración útil y usan entrada/salida suave. El auditor visual de skeleton encontró que los extremos de algunos clips vuelven hacia una postura de autoría/T-pose; el trimming evita ese snap en el juego.

## Lo que deliberadamente NO se falsea

UAL2 Standard suministrado no contiene una librería 8-direcciones completa de locomoción competitiva ni familias específicas de báculo/casteo/arco.

Por ello:

- **Strafe A/D** mantiene una gramática lateral dedicada; no se rota `Walk_Carry_Loop` 90°.
- Caster mantiene guardia de báculo, normal y cast propios.
- Archer mantiene guardia, raise/draw/release/recoil propios.
- La biblioteca externa funciona como base corporal donde realmente aporta un clip compatible.

## Controles

El contrato se centralizó en `js/core/controlMap.js`:

- W/S: forward/back.
- A/D: strafe izquierda/derecha.
- Q/E: turn-in-place izquierda/derecha.

Hay cinco tests dedicados que rechazan que A/D generen giro o Q/E generen strafe.

## Smooth skin

La decimación a 50k dejaba normales visibles por triángulo. En bootstrap, sobre una copia runtime de la geometría:

- se borra la normal importada;
- `mergeVertices(1e-5)` suelda vértices compatibles;
- `computeVertexNormals()` + `normalizeNormals()`;
- `flatShading = false`;
- normal map moderado a 0.42;
- roughness mínima 0.68.

El asset fuente de 50k no se destruye ni se vuelve a decimar.

## Autoridad

UAL2 nunca determina:

- posición;
- yaw;
- daño;
- RELEASE;
- cooldown/GCD;
- estado de salto;
- target.

El renderer recibe `pos`/`yaw` desde simulación y aplica únicamente pose visual de huesos. El root motion del asset se descarta.

## Gates

- 383/383 tests.
- UAL2 binary audit 24/24.
- Power source parity 20/20.
- 12/12 auditores especializados.
- ARBITER v0.16 APROBADO.
- VISUAL CRITIC estático APROBADO.

El smoke visual real no puede ejecutarse localmente porque Chromium administrado bloquea `127.0.0.1` antes de cargar JavaScript. La captura está en `QA_BROWSER_POLICY_BLOCK_V016.png`. El milestone queda TESTED hasta playtest en Hostinger.
