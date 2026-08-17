# Arquitectura de retargeting — v0.18

> Contrato congelado antes de implementar. Todo lo que aquí se decide sale de
> una medida de `docs/RETARGET_FORENSICS_V018.md` o de una prueba ejecutable.
>
> ```bash
> node tools/retarget-forensics.js   # la auditoría
> node tools/bench-retarget.js       # horneado contra runtime, con Three real
> node tools/run-tests.js v0.18      # la matemática, en Node
> ```

---

## 1 · La decisión matemática

**Método elegido: M4 — base conjugada, absoluta.**

```
At(b, t) = As(map(b), t) · B(b)

B(b) = (Rs⁻¹ · Cs) · (Rt⁻¹ · Ct)⁻¹        constante por hueso
```

`Rs`/`Rt` son las rotaciones mundiales en reposo, `Cs`/`Ct` los marcos
anatómicos en reposo, construidos con **el mismo procedimiento geométrico** en
los dos rigs.

No es una fórmula copiada. Es la solución de la ecuación «que los dos marcos
anatómicos coincidan en todo instante»:

```
At · (Rt⁻¹·Ct) = As · (Rs⁻¹·Cs)     ⇒     At = As · B
```

### Por qué no las otras tres

| | error medio en `Walk_Carry_Loop` | por qué se descarta |
|---|---|---|
| M1 delta mundial (v0.16/v0.17) | 33.5° / máx 76.9° | arrastra intacta la diferencia T-pose ↔ brazos colgando. El error es **constante**: los brazos nunca pueden llegar a donde la animación los pone |
| M2 delta local sin base | 49.8° / máx 147.1° | mezcla marcos locales que no significan lo mismo. Peor que no hacer nada, y además **deforma** el movimiento |
| M3 base conjugada, delta | 23.2° / máx 66.4° | corrige la base pero sigue siendo delta: conserva la pose de bind del destino y por tanto no alcanza la de la animación |
| **M4 base conjugada, absoluta** | **0° por construcción** | reproduce la pose de origen. Ver el aviso de honestidad abajo |

**Aviso de honestidad, repetido aquí a propósito:** el 0° de M4 es tautológico —
la métrica mide justo lo que `B` está definido para conseguir. Lo que la tabla
prueba es que **M1, M2 y M3 no reproducen la pose de origen**, no que M4 se vea
bien. Eso lo deciden el contacto de pie, la torsión y el ojo.

### Marcos anatómicos: tres reglas, todas medidas

| regla | huesos | justificación medida |
|---|---|---|
| `child` — eje = dirección al hijo | Hips, Spine, Chest, Neck, UpperArm, LowerArm, UpperLeg, LowerLeg | los dos rigs tienen ese hijo |
| `parent` — eje = dirección desde el padre | Hand | la mano continúa el antebrazo; hereda su corrección, que es lo que se quiere |
| `world` — marco = el del mundo | **Head, Foot** | medido: los dos personajes miran a `+Z`, tienen la cabeza recta y la planta **plana en el suelo** en reposo. Con marcos idénticos `B = Rs⁻¹·Rt` y la orientación de reposo se conserva **exacta** — que es lo que mantiene el pie plano y la cabeza a nivel |

La regla `world` tiene una consecuencia elegante: para los huesos cuyos marcos
ya coincidían, **M4 se reduce exactamente a M1**. Por eso las piernas y la
columna ya salían bien con el método viejo (1.5° y 1.9°). M4 no sustituye a M1:
lo generaliza insertando la alineación anatómica que faltaba.

### El mapa se DERIVA, no se escribe

El bug del espejo no se arregla corrigiendo una tabla a mano —eso se vuelve a
romper el día que alguien cambie un modelo. Se arregla haciéndolo imposible:

```js
// js/render/humanoidRetarget.js — buildMap()
// gana el candidato cuyo x de REPOSO tiene el mismo signo que el del destino
if ((xs < 0) !== (xt < 0)) continue;    // lado equivocado, descartado
```

Los nombres `_l`/`_r` y `Left`/`Right` **no participan en la decisión**. Sólo
declaran el papel anatómico (`upperArm`, `foot`…), que sí es dato legítimo.

Dos pruebas lo blindan: `el mapa se deriva del lado FÍSICO, no del nombre` y
`ningún hueso se empareja con uno del lado contrario`.

---

## 2 · La decisión de arquitectura: **horneado**

Medido con Three.js 0.160 real, el `AnimationMixer` real, la jerarquía real de
los dos `.glb` y los 21 clips que el juego usa. 4 personajes × 900 fotogramas:

| | por fotograma (4 pj) | por personaje |
|---|---|---|
| **A · runtime** — mixer sobre 65 huesos y 8 385 pistas, leer 17 mundos, retargetear, escribir 17 | 217.6 µs | 54.4 µs |
| **B · horneado** — mixer sobre el destino, 17 pistas de rotación + 1 de posición | **19.3 µs** | **4.8 µs** |

**El horneado es 11.3× más barato por fotograma.** Coste único: **225 ms** para
los 21 clips (10.7 ms cada uno), 378 pistas, 17 856 llaves, ~291 KB. Se amortiza
en 38 s de juego, y en la práctica se paga entero detrás de la pantalla de carga
que ya existe para los 14 MB de assets.

Además desaparecen las **2 795 pistas de `scale`** (constantes, medido) y **2 731
de las 2 795 de `translation`** (constantes salvo `pelvis`). El mixer dejaba de
interpolar 8 385 pistas para producir las 130 que importan.

### ¿Cambia el resultado? No más que el propio motor

| | |
|---|---|
| suelo de ruido del `AnimationMixer` de Three, **sin retargeting** | **0.056°** |
| horneado contra runtime, **en las llaves originales** | **0.028°** |
| horneado contra runtime, **entre llaves** | 0.750° |

El horneado queda **por debajo del ruido del propio motor** en las llaves: no
introduce error propio. Ese ruido es de Three (su `PropertyMixer` acumula en
`Float32` y mezcla contra el valor original, así que su salida depende del
estado previo del hueso: la misma escena reconstruida da 0.056° de diferencia
consigo misma). La ruta runtime lo paga igual, sobre 65 huesos en vez de 17.

Entre llaves la diferencia es real y **conocida**: el runtime interpola los
cuaterniones locales de la fuente, compone la cadena y luego retargetea; el
horneado interpola los locales ya retargeteados. Interpolar antes o después de
componer no es lo mismo cuando el padre también gira. 0.750° en el pico del
mandoble más rápido del paquete es el precio, y es barato.

### Se hornea en las llaves ORIGINALES

Los clips de UAL2 están autorizados a **30 Hz exactos, interpolación LINEAR**
(medido: `Δt = 0.03333` constante en los 43). La simulación de Project Arena
corre a **30 Hz**. Muestrear en las llaves originales es por tanto **sin pérdida
de remuestreo**: mismas llaves, mismos tiempos, mismo número.

No se deriva el paso de un `keyStep` redondeado — hacerlo acumulaba 0.2 ms de
deriva en el clip de 4.3 s y convertía un horneado exacto en uno «casi».

---

## 3 · Qué se hornea y qué no

**21 clips** de los 43 (`docs/ANIMATION_CLIP_AUDIT_V018.md`). Los otros 22 no
entran en el juego y no se hornean.

Cada clip horneado produce:

- 17 `QuaternionKeyframeTrack`, una por hueso destino, en **espacio local**;
- 1 `VectorKeyframeTrack` para `Hips.position`, sólo con la componente Y viva.

`Hips.position` lleva la oscilación vertical de la pelvis de la fuente escalada
por la razón de pierna **medida** (`legRatio = 0.969`), topada a ±0.40 m:

```
hipsY = reposoY_destino + (pelvisY_fuente(t) − reposoY_fuente) · 0.969
```

**X y Z de `Hips` nunca se escriben.** El root motion de UAL2 se midió (§9 de la
forense) y se usa para calibrar velocidad y zancada; **jamás** para mover la
entidad. La posición y el yaw siguen siendo de la simulación, sin excepción.

---

## 4 · Velocidad de reproducción

```
playbackRate = velocidad_deseada / velocidad_del_clip
```

`velocidad_del_clip` **se mide**, no se inventa: sale del gemelo
`UAL2_Standard_RM.glb` con el root motion horneado, y viaja en
`js/data/rigCalibration.js` porque el fichero de 8 MB no entra en el repo.

| clip | velocidad medida |
|---|---|
| `Walk_Carry_Loop` | **0.650 m/s** (1.300 m por ciclo de dos pasos) |
| `Zombie_Walk_Fwd_Loop` | 1.050 m/s |

Topado a `[0.55, 1.65]`. Por encima de 1.65× un andar acelerado deja de leerse
como andar, y **no hay ciclo de carrera en el paquete** que lo sustituya.

---

## 5 · Máquina de estados

```
        ┌──────── IDLE ────────┐
        │                      │
   START│                 STOP │
        ▼                      │
    LOCOMOTION ────────────────┘
        │  ▲
   JUMP │  │ LAND
        ▼  │
  AIRBORNE─┘

  cualquier estado ──► COMBAT_ACTION ──► de vuelta al anterior
  cualquier estado ──► CC ──► GETUP ──► IDLE
  cualquier estado ──► DEATH   (terminal)
```

| transición | crossfade |
|---|---|
| IDLE → LOCOMOTION | 0.16 s |
| LOCOMOTION → IDLE | 0.20 s |
| cambio de dirección | 0.14 s |
| entrada a COMBAT_ACTION | 0.08 s |
| salida de COMBAT_ACTION | 0.18 s |
| a AIRBORNE / LAND | 0.10 s |
| a CC / DEATH | 0.12 s |

Aproximados a propósito: son un punto de partida para el ojo, no dogma.

**`CombatAction` nunca decide el combate.** La simulación emite el estado y la
presentación elige el clip. Un clip que termina **no** produce RELEASE, no
aplica daño y no libera el GCD. Hay puerta para eso.

---

## 6 · Lo que NO existe, y qué se hace con ello

Decidido aquí, con su coste, en vez de marcarlo como resuelto:

| falta | decisión v0.18 |
|---|---|
| **carrera** | acelerar `Walk_Carry_Loop` hasta 1.65×. Por encima, se satura. Se anota como carencia real del paquete |
| **retroceso** | **gramática propia** del proyecto (`skinnedAnimationContract.js`), NO el andar invertido en el tiempo. Invertir el tiempo no invierte el contacto: el talón sigue tocando primero y sale moonwalk. Se retira la inversión de fase de la v0.16 |
| **strafe** | **gramática propia**. No hay clip lateral y no se va a fabricar girando el andar. **No se declara resuelto en ninguna lista** |
| **giro Q/E** | **gramática propia** de giro sobre el sitio, con pies y pelvis participando |
| **casteo y arco** | gramática propia. Cuatro de las seis clases no tienen nada que retargetear en este paquete |
| **muerte** | `Hit_Knockback` completo como derribo terminal. No es una muerte autorada; es lo que hay |

**La mezcla entre clip horneado y gramática propia es obligatoria, no opcional.**
El método absoluto deja en T-pose cualquier hueso que no reciba clip, así que
`retargetFrame` **rellena con el reposo del destino** los huesos sin fuente, y
hay prueba (`un hueso sin clip cae a su reposo, nunca a T-pose`) y puerta.

---

## 7 · Contacto de pie: corrección, nunca locomoción

Dos causas de patinaje **medidas**, no supuestas:

1. **Proporción**: la pierna del Elfo es un 3 % más corta (0.804 frente a 0.830).
   Un pie que en la fuente apoya a `y = 0` cae ~2.5 cm en el destino.
2. **Los clips de espada avanzan**: `Sword_Regular_A` recorre 0.825 m en 0.433 s
   en el gemelo con root motion. Sin él, el cuerpo se queda clavado y los pies
   siguen ejecutando el avance. **Patinaje por construcción.**

El IK de pie corrige eso y **sólo** eso. No sustituye la animación, no genera la
zancada y no puede activarse cuando el pie está en vuelo. La animación original
manda; el IK ajusta el último tramo.

---

## 8 · Autoridad — sin cambios

```
INPUT → COMANDO → VALIDACIÓN → ESTADO → RELEASE → RESOLUCIÓN → EVENTOS → PRESENTACIÓN
```

Nada de esta pipeline escribe vida, recurso, cooldown, GCD, posición, yaw,
objetivo ni resultado. El root motion de UAL2 se mide y se descarta. Las puertas
nuevas lo comprueban una por una.

---

## 9 · Ficheros

| fichero | qué es |
|---|---|
| `js/render/humanoidRetarget.js` | matemática pura. Sin Three, sin DOM. 14 pruebas en Node |
| `js/data/rigCalibration.js` | **generado**. Reposo medido de los dos rigs + metadatos de los 43 clips + velocidades del `_RM` |
| `tools/bake-rig-calibration.js` | el generador |
| `tools/lib/glb.js`, `tools/lib/pose.js` | lector de `.glb` y muestreador, sin navegador |
| `tools/lib/three-from-glb.mjs` | grafo de Three sin `GLTFLoader`, para poder medir en Node |
| `tools/retarget-forensics.js` | la auditoría de la fase 0, reproducible |
| `tools/bench-retarget.js` | horneado contra runtime, con Three real |
