# Auditoría forense de retargeting — v0.18 · FASE 0

> **Ninguna línea de código de juego se ha tocado para escribir este documento.**
> Todas las cifras salen de un comando reproducible:
>
> ```bash
> node tools/retarget-forensics.js                 # con el _RM: --rm RUTA
> ```
>
> El lector se lee los bytes del `.glb` directamente (`tools/lib/glb.js`), sin
> Three.js y sin navegador. Three.js es correcto en runtime pero **interpreta**:
> rellena valores por defecto, normaliza cuaterniones y elige el camino corto en
> los slerp. Para una auditoría eso contamina. Aquí se mide el fichero.

---

## 0 · Resumen ejecutivo

El problema **no** es que falte una librería de animaciones, ni que el modelo
tenga pocos huesos. Son dos defectos concretos y medidos en el puente entre los
dos esqueletos:

| # | Defecto | Medida | Gravedad |
|---|---|---|---|
| **1** | **La lateralidad está invertida.** Los huesos `Left*` del Elfo Oscuro están en el lado **derecho** del personaje. El mapeo actual es por nombre, así que el brazo izquierdo de la fuente acaba en el brazo derecho del destino. | `LeftUpperArm` en `x = −0.255`; el proyecto define la derecha del personaje como `−X` (`js/main.js:742`) | **P0** |
| **2** | **El método de retargeting no puede alcanzar la pose de la animación.** Transfiere el *delta* respecto al reposo, y los dos reposos difieren 72° en el hombro (T-pose contra brazos colgando). El error es **constante**, no ruido: la media es igual al máximo. | brazos a **108.1°** de donde la animación los pone, en todo el clip, en todos los clips | **P0** |
| 3 | La librería **no contiene** carrera, retroceso, strafe ni giro sobre el sitio. Sólo hay dos ciclos de marcha, y el que se usa es un *carry* (brazos ocupados). | 43 clips catalogados, uno a uno | **P1** |
| 4 | Sin hueso de dedos del pie no existe la transición talón→punta. | `ball_l` recorre **33.7°** en la marcha, y no tiene destino | P2 |

**El rig de 17 huesos NO es la causa estructural.** Se demuestra en §6.

---

## 1 · Los dos esqueletos

| | Elfo Oscuro | UAL2 Standard |
|---|---|---|
| Fichero | `assets/models/dark-elf-base-rigged-50k.glb` | `assets/animations/ual2-standard.glb` |
| Huesos | **17** | **65** |
| Nodos | 20 | 67 |
| Malla | 1 `SkinnedMesh`, 50 000 triángulos, 76 070 vértices | 1 malla de referencia, 3 389 vértices |
| Clips | 0 | **43** |
| Altura de la malla | 1.8975 m | 1.8290 m |
| Atributos de vértice | `POSITION, TEXCOORD_0, JOINTS_0, WEIGHTS_0` | — |

**El `.glb` del Elfo no trae `NORMAL`.** Si no se calculan al cargar, la piel se
ve facetada. Ya se calculan en `js/render/three/bootstrap.js:59`; queda anotado
porque cualquier pipeline nueva que reimporte el modelo debe repetirlo.

### 1.1 Bind y reposo son la misma pose — en los dos

| | desviación máx entre `IBM⁻¹` y la pose de los nodos |
|---|---|
| Elfo Oscuro | `0.000000` |
| UAL2 | `0.000001` |

Esto elimina toda una familia de errores clásicos de retargeting. La malla del
Elfo **está** en su pose de bind, y `A_TPose` de UAL2 coincide con la pose de
reposo del fichero con **0.0002°** de desviación — o sea que sirve como
referencia de calibración, tal y como se sospechaba.

### 1.2 Jerarquías

```
ELFO OSCURO (17)                 UAL2 (65, sólo la estructura)
Hips                             root
├─ Spine                         └─ pelvis
│  └─ Chest                         ├─ spine_01
│     ├─ Neck                       │  └─ spine_02
│     │  └─ Head                    │     └─ spine_03
│     ├─ LeftUpperArm               │        ├─ neck_01 → Head
│     │  └─ LeftLowerArm            │        ├─ clavicle_l → upperarm_l →
│     │     └─ LeftHand             │        │   lowerarm_l → hand_l → 5 dedos×4
│     └─ RightUpperArm  …           │        └─ clavicle_r → … (espejo)
├─ LeftUpperLeg                     ├─ thigh_l → calf_l → foot_l → ball_l → hoja
│  └─ LeftLowerLeg                  └─ thigh_r → … (espejo)
│     └─ LeftFoot
└─ RightUpperLeg …
```

### 1.3 Convención de eje de hueso — **son distintas**

- **UAL2**: el hijo de cada hueso está en **`+Y` local**, uniformemente. Es la
  convención de Unreal exportada a glTF; el nodo `root` lleva la rotación de
  −90° sobre X que convierte Z-arriba en Y-arriba.
- **Elfo Oscuro**: **todas las rotaciones locales son la identidad**. El marco
  local de cada hueso es el marco del mundo. Los hijos están en `+Y` en la
  columna y en `−Y` en brazos y piernas.

Es decir: **los ejes de hueso de los dos rigs no coinciden y ni siquiera son
consistentes dentro del Elfo** (columna arriba, extremidades abajo). Cualquier
método que copie rotaciones locales de un rig al otro sin cambio de base está
mezclando marcos que no significan lo mismo. Se mide en §4.

---

## 2 · El defecto de lateralidad (P0)

El personaje mira a **`+Z`** en los dos ficheros. No es una suposición:

| evidencia | Elfo Oscuro | UAL2 |
|---|---|---|
| nariz (banda de la cara) | z ∈ [−0.139, **+0.151**] | z ∈ [−0.128, **+0.117**] |
| suela del pie | z ∈ [−0.105, **+0.170**] | z ∈ [−0.098, **+0.205**] |
| anchura X de la suela en el tercio delantero | 0.522 | 0.311 |
| anchura X de la suela en el tercio trasero | 0.402 | 0.277 |

La puntera es más larga y más ancha que el talón, y la nariz sobresale: los dos
miran a `+Z`.

Y el proyecto ya tiene decidido —y comentado en su propio código— qué es la
derecha de un personaje que mira a `+Z`:

```js
// js/main.js:736
// El proyecto usa +Z como frente; en un sistema diestro con Y arriba, la
// derecha visual de ese frente es −X, no +X.
var dx = sy * mv.forward - cy * mv.strafe;   // D (derecha) con yaw=0 → x = −1
```

Contrastado con dónde está cada hueso:

| rig | hueso | x | lado físico | ¿el nombre acierta? |
|---|---|---|---|---|
| Elfo | `LeftUpperArm` | **−0.255** | **derecho** | **no** |
| Elfo | `RightUpperArm` | **+0.255** | **izquierdo** | **no** |
| UAL2 | `upperarm_l` | +0.192 | izquierdo | sí |
| UAL2 | `upperarm_r` | −0.192 | derecho | sí |

`js/render/three/threeRetarget.js` mapea **por nombre**:
`LeftUpperArm ← upperarm_l`. Eso lleva el brazo izquierdo de la animación al
brazo derecho del modelo, **sin reflejarlo**. Un espejo no es una rotación: al
aplicar la rotación sin reflejar, el codo dobla hacia fuera, la rodilla se
invierte y el muslo aduce cruzando la línea media. Son exactamente los defectos
que se pedía cazar: *codos invertidos, piernas que se cruzan, brazos retorcidos*.

Efecto medido sobre el error angular de la pose (clip `Walk_Carry_Loop`,
método actual): **108.1° con el mapeo por nombre → 72.0° con el mapeo por lado
físico.** Corregir la lateralidad, sola, se lleva 36° del error del hombro.

> **Nota histórica:** este proyecto ya libró esta batalla una vez. El comentario
> de `js/main.js:736` documenta el bug de A/D invertido. El mismo espejo seguía
> vivo, sin que nadie lo viera, en el mapa de huesos — porque sobre un cuerpo
> simétrico y desnudo un espejo **no se ve**.

---

## 3 · El defecto de pose de reposo (P0)

Dirección mundial de cada hueso en reposo (hacia su hijo):

| hueso destino | Elfo Oscuro | fuente | UAL2 | Δ por nombre | Δ por lado |
|---|---|---|---|---|---|
| Hips | 0.000, 1.000, 0.000 | pelvis | 0.000, 0.968, 0.250 | 14.5° | 14.5° |
| Spine | 0.000, 1.000, 0.000 | spine_01 | 0.000, 0.992, 0.123 | 7.0° | 7.0° |
| Chest | 0.000, 1.000, 0.000 | spine_03 | 0.000, 0.999, −0.032 | 1.9° | 1.9° |
| Neck | 0.000, 0.995, 0.100 | neck_01 | 0.000, 0.982, 0.189 | 5.2° | 5.2° |
| **LeftUpperArm** | −0.310, −0.948, 0.073 | upperarm_l | **1.000, 0.000, −0.017** | **108.1°** | **72.0°** |
| **LeftLowerArm** | −0.224, −0.968, 0.116 | lowerarm_l | **1.000, 0.000, 0.017** | **102.9°** | **76.9°** |
| LeftUpperLeg | 0.000, −1.000, 0.020 | thigh_l | 0.000, −1.000, −0.007 | 1.5° | 1.5° |
| LeftLowerLeg | 0.000, −0.990, 0.141 | calf_l | 0.000, −0.997, −0.080 | 12.7° | 12.7° |

**Columna y piernas concuerdan dentro de 15°. Los brazos difieren 72°.**

UAL2 está en **T-pose pura**: el húmero es exactamente horizontal
(`upperarm_l`, `lowerarm_l` y `hand_l` comparten `y = 1.4408`). El Elfo Oscuro
tiene los brazos **colgando a 18° de la vertical**. Son dos poses de reposo
separadas por 72° en el hombro.

### Por qué eso rompe el método actual

`threeRetarget.js` calcula un **delta mundial** desde el reposo:

```js
_delta   = qFuenteAnimado · qFuenteReposo⁻¹      // lo que la fuente ha girado
_desired = _delta · qDestinoReposo               // se le aplica al destino
```

Es matemáticamente consistente, y en reposo devuelve el reposo del destino. El
problema es geométrico: **el mismo giro aplicado a dos huesos que apuntan a
sitios distintos produce movimientos distintos.**

En T-pose el brazo apunta a `+X`, así que «balancear el brazo adelante y atrás»
es un giro alrededor del eje `Y`. En el Elfo el brazo apunta a `−Y`, es decir
**paralelo a ese eje**. Girar un hueso alrededor del eje al que es paralelo no
lo mueve: **lo retuerce sobre sí mismo**. El balanceo de brazos de todos los
ciclos de marcha de UAL2 se convierte, sobre el Elfo Oscuro, en **torsión de
hombro**.

Eso es, literalmente, *«un muñeco cuyos huesos giran independientemente»*.

Y la medida lo confirma como **error constante, no como ruido**:

```
LeftUpperArm   media 108.1°  /  máximo 108.1°
LeftLowerArm   media 102.9°  /  máximo 102.9°
```

Media igual a máximo significa que el error **no depende del fotograma**: es la
diferencia de reposo, arrastrada intacta durante todo el clip. Con este método
los brazos del Elfo **nunca** pueden llegar a donde la animación los pone. No es
un problema de calidad; es un problema de alcance.

---

## 4 · Los cuatro métodos, medidos

Métrica: error angular entre la **dirección mundial del hueso fuente** y la del
hueso retargeteado. La dirección del hueso es lo que el ojo ve.

Notación: `Rs`, `Rt` = rotación mundial en reposo (fuente / destino);
`As` = rotación mundial animada de la fuente; `B` = corrección de base.

| | fórmula |
|---|---|
| **M1** delta mundial (el actual) | `At = (As · Rs⁻¹) · Rt` |
| **M2** delta local sin cambio de base | `At = Rt · (Rs⁻¹ · As)` |
| **M3** base conjugada, delta | `At = Rt · B⁻¹ · (Rs⁻¹ · As) · B` |
| **M4** base conjugada, absoluta | `At = As · B` |

`B` no se copia de ningún sitio: se **construye** a partir de la geometría de
los dos rigs. Para cada hueso se levanta un marco anatómico
`[eje del hueso, adelante, lateral]` con el mismo procedimiento en los dos, y

```
B = (Rs⁻¹ · Cfuente) · (Rt⁻¹ · Cdestino)⁻¹
```

que es la rotación constante que lleva el marco anatómico del destino al de la
fuente. La derivación completa: si se quiere que los dos marcos anatómicos
coincidan en todo instante, `At · (Rt⁻¹·Ct) = As · (Rs⁻¹·Cs)`, y despejando sale
`At = As · B`. **M4 no es una fórmula heredada: es la solución de esa ecuación.**

### Resultado, `Walk_Carry_Loop`, 24 muestras por hueso

**Mapeo por nombre (el actual):**

| hueso | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| LeftUpperArm | 108.1° / 108.1° | 114.0° / 120.4° | 86.6° / 95.4° | 0.0° |
| LeftLowerArm | 102.9° / 102.9° | 136.0° / 147.2° | 47.1° / 58.3° | 0.0° |
| LeftUpperLeg | 1.5° / 1.5° | 4.3° / 10.0° | 1.5° / 1.5° | 0.0° |
| LeftLowerLeg | 12.7° / 12.7° | 13.2° / 15.0° | 12.7° / 12.7° | 0.0° |
| Spine | 7.0° | 7.0° | 7.0° | 0.0° |
| Chest | 1.9° | 1.9° | 1.9° | 0.0° |
| **TOTAL** | **45.9° / 108.1°** | 54.9° / 147.8° | 30.1° / 96.6° | 0.0° |

**Mapeo por lado físico:**

| | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| **TOTAL** | **33.5° / 76.9°** | 49.8° / 147.1° | 23.2° / 66.4° | 0.0° |

### Aviso de honestidad sobre M4

**M4 da 0.0° por construcción.** `B` se define exactamente para que los marcos
anatómicos coincidan, y esta métrica mide exactamente eso. El cero **no es una
nota de calidad de M4**; es la demostración de que M1, M2 y M3 **no reproducen
la pose de origen**, cada uno por su motivo:

- **M1** arrastra intacta la diferencia de reposo (72–108°).
- **M2** es peor que M1: mezcla marcos locales que no significan lo mismo, y
  además introduce error *variable* (media 49.8°, máximo 147.1°), o sea que
  deforma el movimiento además de desplazarlo.
- **M3** corrige la base pero sigue siendo un delta: mantiene la pose de bind
  del destino y por tanto no llega a la de la animación. Reduce el error a la
  mitad, no lo elimina.

**La calidad real de M4 no la decide esta tabla.** La deciden el contacto de
pie, la torsión alrededor del eje del hueso (que esta métrica no ve), y el ojo
en el Animation Lab. Eso es trabajo de la fase siguiente, no de ésta.

### Lo que M4 cuesta

M4 **descarta la pose de bind del destino**. El Elfo deja de tener «sus brazos
colgando» como base y adopta la pose absoluta de la animación. Para un modelo
skinneado eso es correcto —la pose de bind es un artefacto de modelado, no una
intención de diseño— y es lo que hace que un ciclo de marcha con los brazos
naturalmente colgando se vea con los brazos naturalmente colgando. Pero implica
que **cualquier hueso sin clip que lo alimente se queda en T-pose**, así que la
máquina de estados no puede tener huecos. Es un requisito de la fase siguiente,
y va a la lista de puertas automáticas: *ningún flash de T-pose*.

---

## 5 · Proporciones — no son el problema

| cadena | Elfo | UAL2 | Elfo/UAL2 |
|---|---|---|---|
| Hips→Spine | 0.1500 | 0.1382 | 1.086 |
| Spine→Chest | 0.2000 | 0.1240 | 1.612 |
| Chest→Neck | 0.2000 | 0.1729 | 1.157 |
| Neck→Head | 0.1507 | 0.0826 | 1.825 |
| **UpperArm→LowerArm** | **0.2743** | **0.2744** | **0.999** |
| LowerArm→Hand | 0.2584 | 0.2726 | 0.948 |
| **UpperLeg→LowerLeg** | **0.4001** | **0.4003** | **0.999** |
| LowerLeg→Foot | 0.4040 | 0.4295 | 0.941 |
| **PIERNA (cadera→tobillo)** | **0.8041** | **0.8298** | **0.969** |
| cadera sobre el suelo | 0.9550 | 0.9167 | 1.042 |

Los huesos que mueven la silueta —húmero, antebrazo, fémur, tibia— coinciden
**dentro del 6 %**, y el húmero y el fémur al 0.1 %. La pierna entera difiere un
3 %. Las diferencias grandes están en cuello y columna alta, que son cortas y
apenas mueven el contorno.

**Conclusión: las proporciones no explican ningún defecto visual.** Refuerza el
diagnóstico: el problema está en la base y en el espejo, no en el cuerpo.

El 3 % de diferencia de pierna sí importa para el **contacto de pie**: con
orientaciones absolutas, un pie que en la fuente apoya a `y = 0` en el Elfo cae
unos 2.5 cm. Es corrección de IK, no de retargeting, y va a la fase siguiente.

---

## 6 · ¿Es el rig de 17 huesos la causa estructural?

**No.** Se pedía demostrarlo, no opinarlo. Recorrido angular **local** máximo de
cada articulación de la fuente, medido sobre seis clips representativos:

| articulación fuente | ¿destino? | recorrido máx | ¿se pierde? |
|---|---|---|---|
| `pelvis` | Hips | 167.4° | no |
| `spine_01` | Spine | **0.0°** | — *(la mocap no la anima nunca)* |
| `spine_02` | — | 58.2° | **no**, ver abajo |
| `spine_03` | Chest | 52.8° | no |
| `neck_01` | Neck | 38.2° | no |
| `clavicle_l` / `_r` | — | 22.4° / 17.2° | **no**, ver abajo |
| `upperarm_l` | LeftUpperArm | 85.5° | no |
| `lowerarm_l` | LeftLowerArm | 122.9° | no |
| `hand_l` | LeftHand | 38.5° | no |
| `thigh_l` / `calf_l` / `foot_l` | …UpperLeg/LowerLeg/Foot | 125.8° / 154.7° / 60.9° | no |
| **`ball_l`** (dedos del pie) | **—** | **33.7°** | **SÍ** |
| `root` | — | 0.0° | irrelevante (rotación nula; su traslación es root motion) |
| 42 huesos de dedos y hojas | — | — | sí, y no importan a esta distancia de cámara |

### La tabla de compresión propuesta, evaluada

Se pidió expresamente **no** aceptarla y medirla. Medida:

- **`clavicle + upperarm → UpperArm`**: no hace falta «fusionar» nada. Muestreando
  en **espacio mundo**, la rotación de `upperarm_l` **ya contiene** la de la
  clavícula, porque el mundo es la composición de la cadena. Lo único que se
  pierde es la *traslación* de la clavícula (el omóplato deslizando), que a
  escala de cámara MMO es invisible. **No es un problema.**
- **`spine_01 + spine_02 + parte de spine_03 → Spine`**: mismo argumento —
  `spine_03` en mundo ya lleva `spine_01` y `spine_02` dentro. Y la variante
  concreta que propone la tabla es **peor** medida contra la forma real de la
  columna (error de forma normalizado sobre cinco clips, 24 muestras cada uno):

  | mapeo de `Spine` | error de forma medio | máx |
  |---|---|---|
  | **`← spine_01` (el actual)** | **0.0367** | 0.0899 |
  | `← spine_02` | 0.0657 | 0.2063 |

  El motivo es de altura: el hueso `Spine` del Elfo está a `y = 1.105`, más cerca
  de `spine_01` (1.051) que de `spine_02` (1.174). Poner la curvatura de
  `spine_02` en un hueso que está a la altura de `spine_01` dobla la espalda en
  el sitio equivocado. **La tabla propuesta se rechaza en este punto, con número.**
- **`foot + ball → Foot`**: aquí sí hay pérdida real, y es la única.

### La única carencia estructural real

**No existe hueso de dedos del pie.** `ball_l` recorre 33.7° en el ciclo de
marcha: es exactamente el desenrollado talón→punta que se pide en los mínimos de
calidad de locomoción. Sin ese hueso **no se puede representar**, ni con IK ni
con compensaciones, porque no hay nada que girar entre el tobillo y el suelo.

**Cambio de rig mínimo propuesto: dos huesos, `LeftToe` y `RightToe`,** hijos de
`LeftFoot` / `RightFoot`, en la posición del metatarso. El rig pasaría de 17 a
19 huesos.

**No es requisito para arreglar los defectos actuales**, y por eso no se ejecuta
en esta fase: primero se corrigen el espejo y la base, se mira el resultado, y
sólo entonces se decide si el desenrollado del pie sigue haciendo falta. Añadir
huesos a un `.glb` obliga a repesar la malla, y eso es un riesgo que no se paga
antes de saber si hace falta.

### Skinning: sí hay un defecto estructural, y no es el que parecía

Máximo 4 influencias por vértice, ningún vértice sin peso, ningún hueso huérfano.

`Head` acumula el **46.7 %** del peso y toca 45 107 de 76 070 vértices, lo que a
primera vista parece un error grave de pesado. **No lo es**: de los 8 712
vértices dominados por `Head` que están por debajo del cuello, **8 712 están
detrás del cuerpo** (`z ∈ [−0.167, −0.075]`) y ninguno delante. Es **pelo largo
cayendo por la espalda**, pesado correctamente a la cabeza.

**El defecto real es el contrario: los pesos están demasiado difuminados.**

Peso máximo que cada hueso alcanza sobre cualquier vértice de la malla:

| hueso | peso máx | vértices con w > 0.9 |
|---|---|---|
| `Head` | 1.000 | 23 201 |
| `RightUpperArm` / `LeftUpperArm` | 0.989 / 0.967 | 200 / 185 |
| `LeftUpperLeg` | 0.894 | **0** |
| `Hips` | 0.887 | **0** |
| `Chest` | 0.872 | **0** |
| `LeftLowerArm` | 0.866 | **0** |
| `Spine` / `Neck` | 0.855 | **0** |
| `LeftHand` | 0.846 | **0** |
| `LeftLowerLeg` | **0.775** | **0** |
| **`LeftFoot`** | **0.684** | **0** |

**Sólo tres huesos de diecisiete llegan a controlar del todo un solo vértice.**
En la zona del pie izquierdo (`y < 0.10`), el reparto medio es:

```
LeftFoot      0.532
LeftLowerLeg  0.418      ← la tibia se lleva el 42 % de la piel del pie
```

Y la «autoridad» de cada hueso —el peso medio que tiene sobre los vértices que
sí domina— es:

| hueso | autoridad | con `w^γ` normalizado, γ=2 | γ=3 |
|---|---|---|---|
| Hips | 0.772 | 0.935 | 0.973 |
| Chest | 0.523 | 0.697 | 0.784 |
| LowerArm | 0.60 | 0.71 | 0.76 |
| **LowerLeg** | **0.525** | 0.602 | 0.636 |
| **Foot** | **0.544** | 0.632 | 0.689 |
| **media de los 17** | **0.646** | 0.766 | 0.817 |

**Consecuencia predicha:** cuando el tobillo gira 30°, la piel del pie gira unos
16°, porque la mitad de esa piel sigue a la tibia. El pie se dobla como goma en
vez de pivotar, y no se ve apoyado. Lo mismo, más suave, en codo y muñeca.

**Esto no lo arregla el retargeting.** Es del modelo. Tres caminos:

1. **Repesar la malla en Blender**, con caída más dura en tobillo, rodilla,
   muñeca y codo. Es la solución correcta y es trabajo fuera de este repo.
2. **Endurecer los pesos al cargar**, con `w' = wᵞ / Σwᵞ`. Es una línea, es
   medible y es reversible. Sube la autoridad media de 0.646 a 0.82 con γ=3 —
   **mejora clara pero no completa**, y endurecer pesos puede reintroducir el
   pellizco de caramelo en las articulaciones. Habría que mirarlo.
3. **No tocarlo** hasta ver si a distancia de cámara MMO se nota.

**No se decide aquí.** Se anota, con número, y se mira en el Animation Lab una
vez arreglado el retargeting — porque hoy el defecto de base es tan grande que
tapa cualquier juicio sobre éste.

### Y el tobillo está mal colocado

A la altura del tobillo (`y ∈ [0.09, 0.12]`) la sección de la pierna ocupa
`z ∈ [−0.115, +0.050]`. El hueso `LeftFoot` está en **`z = +0.065`**: **fuera de
la pierna, por delante**. La articulación del pie del Elfo Oscuro no está en el
tobillo, está hacia el medio del pie.

Efecto: del talón a la punta hay 0.275 m, y la articulación está a 0.105 m de la
punta y 0.170 m del talón — al revés que un tobillo real. Al levantar el talón,
el pie pivota alrededor del punto equivocado.

Es la segunda mitad del mismo argumento sobre los huesos de dedos: si algún día
se toca el rig, **mover `Foot` hacia atrás al tobillo real y añadir `Toe`** son
la misma operación y valen la pena juntas. Sigue sin ser requisito para arreglar
lo que se rompe hoy.

---

## 7 · Los 43 clips — lo que hay y lo que no

Catálogo completo en `docs/ANIMATION_CLIP_AUDIT_V018.md`. El titular:

| se necesita | ¿existe en UAL2 Standard? |
|---|---|
| Idle | **sí** — nueve; el más neutro por medida es `Idle_No_Loop` (brazos a 24°/29°, pies 100 % plantados) |
| Andar adelante | **sí**, uno: `Walk_Carry_Loop`, 0.650 m/s |
| Correr | **NO** |
| **Andar hacia atrás** | **NO** |
| **Strafe lateral** | **NO** |
| **Giro sobre el sitio** | **NO** |
| Salto | **sí** — `NinjaJump_Start / _Idle_Loop / _Land` |
| Impacto recibido | **sí** — `Hit_Knockback` |
| Melé con espada | **sí** — A, B, C, combo, pesado, bloqueo, dash |
| Escudo | **sí** — `Shield_OneShot`, `Shield_Dash` |
| Caída / levantarse | parcial — `LayToIdle` sólo la salida |
| Muerte | **NO** |

Y el clip de locomoción que la v0.17 usa para **todo** movimiento es
`Walk_Carry_Loop`: los dos brazos elevados **44°** y simétricos, es decir
**cargando algo con las dos manos**. Su balanceo sagital mide ±7°, frente a los
±15° del otro ciclo de marcha del paquete (`Zombie_Walk_Fwd_Loop`) — o sea que
es el más pobre en balanceo de los dos que hay. El idle por defecto es
`Idle_FoldArms_Loop`:
**brazos cruzados**, que pelea con las guardias de arma de las seis clases.

> **No se va a afirmar que el strafe está resuelto.** No hay clip lateral. La
> decisión sobre qué hacer entra en `docs/RETARGET_ARCHITECTURE_V018.md`, con las
> opciones sobre la mesa y sus costes, no con un checkbox marcado.

---

## 8 · Pistas de animación — 2/3 del coste es basura

Por cada uno de los 43 clips, sobre 65 huesos:

| | pistas | variación máxima observada |
|---|---|---|
| `rotation` | 2 795 | — |
| `translation` | 2 795 | **0.853 m**, y **sólo en `pelvis`** |
| `scale` | 2 795 | **0.000002** — constante |

- **Las 2 795 pistas de `scale` son constantes.** Se pueden descartar enteras: no
  hay squash ni stretch que transferir.
- **Las 2 795 de `translation` son constantes salvo en `pelvis`.** Un solo hueso
  traslada de verdad; los otros 64 repiten su valor de reposo en cada llave.
- En el gemelo `_RM` traslada además `root`, que es el root motion horneado.

Hoy el `AnimationMixer` interpola las 8 385 pistas cada fotograma para producir
las ~130 que importan. Es el argumento de peso a favor del **horneado offline**,
que se decide con prueba en el documento de arquitectura.

## 9 · Root motion, medido en el gemelo `_RM`

No se ha borrado la información sin mirarla. El fichero `UAL2_Standard_RM.glb`
—que **no** está en el repo, es el gemelo del que sí está— tiene el
desplazamiento horneado en `root`, y da la escala real de cada clip:

| clip | duración | distancia | velocidad |
|---|---|---|---|
| `Walk_Carry_Loop` | 2.000 s | **1.300 m** | **0.650 m/s** |
| `Zombie_Walk_Fwd_Loop` | 1.333 s | 1.400 m | 1.050 m/s |
| `Sword_Regular_A` | 0.433 s | 0.825 m | 1.903 m/s |
| `Sword_Heavy_Combo` | 4.333 s | 5.324 m | 1.229 m/s |
| `Shield_Dash` | 1.100 s | 1.000 m | 0.909 m/s |
| `Slide_Loop` | 2.000 s | 9.000 m | 4.500 m/s |
| `Hit_Knockback` | 0.833 s | 3.000 m | 3.600 m/s |
| todos los `Idle_*`, `Farm_*`, `Sword_Block`… | — | 0.000 m | 0.000 |

De aquí salen dos datos que la fase siguiente necesita:

1. **Zancada del ciclo de marcha: 0.650 m por paso** (1.300 m por ciclo de dos
   pasos). Es el denominador de `playbackRate = velocidad deseada / 0.650`. **No
   hay que inventar ningún número.**
2. **Los clips de espada avanzan de verdad.** `Sword_Regular_A` recorre 0.825 m
   en 0.433 s. Al usar la variante sin root motion, el cuerpo se queda clavado
   pero los pies siguen queriendo avanzar: **patinaje garantizado durante los
   ataques**. Está medido, y hay que compensarlo.

Y de la marcha, para la calidad de locomoción:

| | |
|---|---|
| oscilación vertical de la pelvis | **0.1044 m** |
| pelvis en reposo → en marcha | 0.9167 → 0.8368 m (baja 0.0799) |
| fase de apoyo (punta bajo 3 cm) | **68 %** del ciclo, cada pie |
| penetración máx bajo el suelo | −0.0075 m |

68 % de apoyo por pie es un **andar** de manual (>50 % de solape = las dos
plantas en el suelo parte del ciclo). Confirma que no hay carrera en el paquete.

**El root motion se mide y se usa para calibrar; nunca para mover la entidad.**
La posición de la simulación sigue siendo la verdad, sin excepción.

---

## 10 · Lo que esta fase NO ha hecho

Para que nadie lo lea como más de lo que es:

- **No se ha tocado una línea de código de juego.** Los ficheros nuevos son
  `tools/lib/glb.js`, `tools/lib/pose.js` y `tools/retarget-forensics.js`, todos
  fuera de runtime.
- **No se ha visto nada en un navegador.** Todo esto es geometría de fichero.
  Ninguna de estas conclusiones está `VERIFIED`; están **medidas**, que es otra
  cosa.
- **No se ha probado que M4 se vea bien.** Se ha probado que M1 no puede verse
  bien. No es lo mismo y no se va a presentar como si lo fuera.
- **La torsión alrededor del eje del hueso no está medida.** La métrica de esta
  fase es direccional y no la ve. Entra en la fase siguiente.

## 11 · Lo que decide la fase siguiente

1. Mapa fuente→destino **por lado físico**, no por nombre.
2. Método **M4** como base, con la torsión medida antes de darlo por bueno.
3. Horneado offline contra runtime, **con prueba**, sabiendo que 2/3 de las
   pistas son constantes.
4. Qué hacer con retroceso, strafe, carrera, giro y muerte, que **no existen**.
5. IK de pie para los 2.5 cm de diferencia de pierna y para el patinaje medido
   de los clips de espada — **como corrección, nunca como locomoción principal**.
6. Si tras todo eso el desenrollado del pie sigue faltando, los dos huesos de
   dedos.
