# CURRENT BUILD STATE — Project Arena

**Build:** v0.16 · UAL2 RETARGET LOCOMOTION  
**Runtime:** `Arena.VERSION = 0.16.0` · `Arena.BUILD = ual2-retarget-locomotion-v016`

## Estado de QA

- **383/383 tests verdes.**
- Auditor de la biblioteca UAL2 suministrada: **24/24**.
- Auditor DOCX de poderes: **20/20**; la paridad funcional v0.13 permanece intacta.
- **12/12 auditores especializados**: asset/licencia, retarget, locomoción, controles, piel, melee, caster/arquero, autoridad, body+weapon, rig local, integración y fresh reviewer.
- **ARBITER v0.16: APROBADO.**
- **VISUAL CRITIC estático v0.16: APROBADO.**
- Sintaxis: **126 ficheros JS verificados, PASS**.
- Dark Elf: **50.000 triángulos · 76.070 vértices · 17 huesos · 1 SkinnedMesh**, skinning validado.
- Smoke de navegador local: **BLOQUEADO POR POLÍTICA DEL ENTORNO** (`127.0.0.1 is blocked`) antes de cargar Arena. Evidencia: `docs/QA_BROWSER_POLICY_BLOCK_V016.png`.

El milestone está **TESTED**, no `VERIFIED` visualmente. El juicio de locomoción integrada debe cerrarse en Hostinger con playtest humano.

## Qué se integró de Universal Animation Library 2 Standard

El paquete entregado por el usuario se conserva local en `assets/animations/ual2-standard.glb` junto a su licencia CC0. El runtime lo precarga antes del boot y retargetea las rotaciones al rig de 17 huesos del Elfo Oscuro.

Se usan clips externos para:

- micro-idle corporal;
- marcha forward;
- base temporal de backpedal mediante fase invertida, sin invertir yaw;
- takeoff / airborne / landing;
- reacción de impacto en upper-body;
- normales melee A/B/C;
- heavy;
- block;
- dash/charge;
- shield one-shot.

El paquete UAL2 Standard suministrado **no contiene una locomoción competitiva 8-direcciones completa**. Por ello strafe no reutiliza una caminata frontal rotada: A/D mantienen una gramática lateral dedicada hasta que exista un clip lateral real. Caster y arquero conservan sus gestos propios de báculo/casteo y draw/release porque UAL2 Standard no aporta esas familias específicas.

## Retarget y autoridad

```text
SIMULACIÓN / AnimationIntent
        ↓
selector de clip de presentación
        ↓
UAL2 source skeleton
        ↓  delta world desde bind
threeRetarget
        ↓  bind local Dark Elf
SkinnedAnimationContract (capas Arena)
        ↓
GLB Dark Elf + una sola arma
```

Root translation/yaw de UAL2 se descartan. Posición, yaw, RELEASE, daño, GCD y demás verdad de combate siguen viniendo únicamente de simulación.

## Controles corregidos

- `W/S`: avanzar / retroceder.
- `A/D`: **strafe izquierda / derecha**.
- `Q/E`: **giro del cuerpo izquierda / derecha**, acompañado por cámara según el contrato existente.
- Mouse izquierdo: steer cuerpo+cámara 1:1.
- Mouse derecho: free-look.

El mapeo vive ahora en `js/core/controlMap.js`, con tests que impiden volver a intercambiar A/D con Q/E.

## Piel del modelo

El aspecto facetado de la decimación se corrige en runtime sobre una copia de la geometría: se elimina la normal importada, se sueldan vértices compatibles, se recalculan y normalizan las normales, `flatShading=false`, y se modera el normal map. No modifica la simulación ni el asset fuente de 50k.

## Límite honesto

Los tests, el auditor binario y el critic estático pueden detectar contratos rotos, clips desconectados, root-motion indebido y regresiones de teclado. No sustituyen observar el personaje real moviéndose a cámara MMO. El navegador administrado del entorno bloquea localhost antes de ejecutar JavaScript; el siguiente gate es desplegar v0.16 y revisar idle, forward/backpedal, strafe, Q/E, salto, hit y melee en Hostinger.
