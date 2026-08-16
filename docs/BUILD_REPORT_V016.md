# Build Report v0.16 — UAL2 Retarget Locomotion

## 1. Diagnóstico

El v0.15 seguía dependiendo de FK artesanal para toda la locomoción. El cuerpo ya no se deformaba como en v0.14, pero movimiento, giro y transición corporal continuaban siendo poco naturales. Además, el mapping de teclado había sufrido regresiones históricas A/D↔Q/E y la decimación del cuerpo mostraba facetas de normales.

## 2. Arquitectura

Se añadió una capa de selección + retarget externa sin tocar combate:

`AnimationIntent / locomotion state → AnimationLibraryMap → UAL2 sampler → threeRetarget → Dark Elf bind local → additive Arena weapon/cast layer`.

Los clips jamás escriben root gameplay. `ControlMap` centraliza teclado para impedir nuevas inversiones.

## 3. Scope implementado

- UAL2 Standard local precargada antes del boot.
- Retarget de 17 huesos.
- Idle corporal.
- Forward gait.
- Backpedal base con fase inversa.
- Salto start/air/land.
- Hit reaction upper-body.
- Melee A/B/C, heavy, block, dash/charge.
- Caster/archer mantienen gramáticas propias encima de la base corporal.
- Dedicated strafe; no forward clip rotado.
- A/D strafe; Q/E turn.
- Smooth normals/material skin pass.
- Body + one weapon route intacta.

## 4. Ficheros principales

- `js/data/animationLibraryMap.js`
- `js/core/controlMap.js`
- `js/render/three/threeRetarget.js`
- `js/render/three/threeCharacter.js`
- `js/render/three/bootstrap.js`
- `js/render/skinnedAnimationContract.js`
- `js/main.js`
- `js/tests/animationLibraryV016Tests.js`
- `js/tests/controlMappingV016Tests.js`
- `tools/audit-ual2-v016.py`
- `tools/arbiter.js`
- `tools/run-agents.js`

## 5. Tests

- Full suite: **383/383**.
- UAL2 binary audit: **24/24**.
- Power parity: **20/20**.
- JS syntax: **126 checked / PASS**.
- Model: **50,000 tris · 76,070 vertices · 17 bones · 1 skin**.
- Skin weights remain normalized.

## 6. Hallazgos del árbitro

- Rechazó dos falsos negativos iniciales de auditores: uno contaba mal el mapping de huesos y otro buscaba texto en vez del selector real de strafe. Se corrigió el arnés, no el producto.
- Detectó y protege la regresión concreta A/D vs Q/E.
- Exige que strafe no reutilice `Walk_Carry_Loop` rotado.
- Exige que root motion fuente no sea autoridad.
- Exige smooth normals y que cuerpo skinned no vuelva a mezclar atuendo procedural.

## 7. Auditoría visual/gameplay

Static critic: **APROBADO**.

No se declara browser visual aprobado: Chromium administrado devuelve `127.0.0.1 is blocked` antes de cargar Arena. `QA_BROWSER_POLICY_BLOCK_V016.png` conserva la evidencia.

## 8. Rendimiento

No se añadió geometría por frame. UAL2 se carga una vez y cada personaje mantiene un `AnimationMixer`/source skeleton oculto para sampling. La geometría del cuerpo se suaviza una sola vez durante bootstrap. FPS de GPU real sigue siendo gate de Hostinger/máquina real.

## 9. Limitaciones reales

El paquete UAL2 Standard suministrado no trae locomoción 8-way completa ni animación específica de caster/archer. Strafe y cast/draw siguen siendo capas Arena específicas. No se finge que una caminata frontal sea un strafe lateral.

## 10. Próximo hito recomendado

Playtest de v0.16 en Hostinger y, a partir de capturas/video, ajustar retarget scale/blends/cadencia. Si se incorpora una librería con jog/run/strafe/backpedal reales, reemplazar gradualmente la capa direccional provisional usando el mismo contrato.
