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

---

# v0.17 · EL EQUIPO VUELVE, SOBRE EL RIG REAL

## El defecto que sólo se ve arrancando el juego

v0.16 quedó **TESTED, no VERIFIED**, porque su entorno bloqueaba el navegador
local antes de cargar Arena (`docs/QA_BROWSER_POLICY_BLOCK_V016.png`). En este
entorno el navegador **sí** arranca, así que lo primero fue ejecutar el gate que
faltaba. Encontró un P0 en el primer fotograma:

> **Las seis clases son el mismo elfo en ropa interior con un arma distinta.**

No es una regresión accidental: la ruta GLB dibujaba deliberadamente «cuerpo +
arma», y el propio árbitro lo blindaba con un gate llamado *«ruta GLB = cuerpo +
arma, sin armadura procedural»*. El modelo real entró y, con él, se apagó el
pase de identidad visual que había costado nueve filas del ledger y que estaba
medido: 18.5 % de contorno distinto en la peor pareja.

Evidencia: `docs/shots/v017-*.png`.

## Lo que se construye

El equipo vuelve, pero colgado de huesos de verdad. **No se reescribe nada**:

- las medidas siguen en `data/classVisuals.js`;
- las formas las siguen fabricando las 24 factorías de `render/equipment.js`;
- las geometrías ya estaban subidas a GPU, porque `buildMeshes()` las incluye.

Lo único que hacía falta era colgar cada pieza del hueso que le toca, y eso
tiene una consecuencia que compensa el trabajo: **el equipo sigue al skinning
gratis**. Una hombrera atada a `Chest` acompaña al torso en cualquier clip de
UAL2, presente o futuro, sin que el renderer sepa qué animación suena.

Los offsets se siguen escribiendo en **espacio de personaje** (+X derecha, +Y
arriba, +Z al frente) y se convierten a espacio de hueso con la inversa de la
orientación de bind. Si se autorizaran directamente en espacio de hueso, cada
número dependería de cómo exportó el rig quien hizo el modelo, y cambiar de
modelo obligaría a reescribir las seis clases.

## Dos defectos que costaron una iteración cada uno

**El arma salía disparada.** Con un solo grupo, el `w.rotation.set(pitch, yaw,
roll)` que la capa de acciones aplica cada fotograma BORRABA la corrección de
bind: en Three, `rotation` y `quaternion` son la misma cosa. Ahora hay dos
grupos —uno externo con la inversa de bind que no toca nadie, y uno interno que
la animación gira— y el espadón deja de flotar delante del pecho.

**Las hombreras salían en el cuello.** El maniquí procedural tenía los hombros
0.20 por encima del nodo de pecho; el Elfo Oscuro los tiene 0.116 por encima de
su hueso `Chest`. Medido con `tools/rig-report.js`, no supuesto. La tabla
`GEAR_ANCHOR` absorbe esa diferencia para que los números de `classVisuals.js`
sigan valiendo.

## Estado honesto

| Socket | Estado |
|---|---|
| `head` — yelmos, sombrero, capucha, diadema | **correcto** |
| `hips` — cinturones, faldar, bolsas, trampas, talismanes | **correcto** |
| `thigh` / `knee` / `ankle` — quijotes, rodilleras, botas | **correcto** |
| `handL` / `handR` — armas de clase, escudo torre, orbe | **correcto de sitio**, falta afinar el ángulo de guardia del escudo |
| `chest` — petos y corazas | **incompleto**: la coraza no cubre el pecho |
| `robe` — túnicas de los dos casters | **incompleto**: se lee como un panel estrecho, no como campana |

El Guardián ya se lee como un caballero acorazado con escudo torre y el
Arcanista como un mago con sombrero y báculo. El Devastador y los dos casters
necesitan otra vuelta de medición sobre el socket de pecho.

**Siguiente paso concreto:** una sonda que compare la caja envolvente de cada
pieza de equipo contra la del hueso que la sujeta. Los dos sockets que fallan
fallan por escala, no por posición, y eso es exactamente lo que una caja mide y
una captura no.
