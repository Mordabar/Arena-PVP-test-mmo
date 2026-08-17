# Auditoría de los 43 clips de UAL2 Standard — v0.18

> **Universal Animation Library 2 · Standard**, de Quaternius, **CC0 1.0**.
> `assets/animations/ual2-standard.glb` — variante **sin** root motion.
> El gemelo `UAL2_Standard_RM.glb` (root motion horneado) **no está en el repo**;
> se ha usado sólo para *medir* distancia y velocidad por clip.
>
> Regenerar: `node tools/retarget-forensics.js --clips --rm RUTA_AL_RM`
>
> **Regla de esta auditoría:** no se afirma que existe un movimiento si no
> existe. No se convierte un `Walk_Carry_Loop` girado 90° en un strafe para
> marcar una casilla.

---

## 1 · Lo que el juego necesita y lo que hay

| estado del juego | clip | veredicto |
|---|---|---|
| Idle en combate | `Idle_No_Loop` / `Idle_Shield_Loop` | **sirve** |
| Andar adelante | `Walk_Carry_Loop` (0.650 m/s) | **sirve con reservas** — brazos ocupados |
| Correr | — | **NO EXISTE** |
| Andar atrás | — | **NO EXISTE** |
| Strafe izq/der | — | **NO EXISTE** |
| Giro sobre el sitio | — | **NO EXISTE** |
| Salto: impulso / aire / caída | `NinjaJump_Start` / `_Idle_Loop` / `_Land` | **sirve** |
| Impacto recibido (flinch) | `Hit_Knockback` (primer tercio) | **sirve enmascarado** |
| Derribo | `Hit_Knockback` (completo) | **sirve** — acaba en el suelo |
| Levantarse | `LayToIdle` | **sirve** |
| Melé ligero A/B/C | `Sword_Regular_A` / `_B` / `_C` | **sirve** |
| Melé pesado | `Sword_Heavy_Combo` | **sirve** |
| Bloqueo | `Sword_Block` | **sirve** |
| Carga / dash | `Sword_Dash`, `Shield_Dash` | **sirve** |
| Golpe de escudo | `Shield_OneShot` | **sirve** |
| Puñetazo / patada | `Melee_Hook` (+ `_Rec`) | **sirve** para el gancho; patada no hay |
| Lanzamiento | `OverhandThrow` | **sirve** para lanzar |
| Casteo de mago | — | **NO EXISTE** |
| Disparo de arco | — | **NO EXISTE** |
| Muerte | — | **NO EXISTE** (`Hit_Knockback` acaba tumbado, no muerto) |

**Cinco de las seis clases de Project Arena son a distancia o mágicas.** El
paquete es de espada y escudo. Para arquero y lanzadores no hay nada que
retargetear, y eso **no** se va a disimular: sus brazos siguen bajo la gramática
propia del proyecto (`skinnedAnimationContract.js`), y la pipeline nueva tiene
que permitir explícitamente esa mezcla en vez de pelearse con ella.

---

## 2 · Catálogo completo, medido

Columnas: **dur** en segundos · **bucle** = diferencia angular entre el primer y
el último fotograma (<8° = cerrado) · **brazoI/D** = elevación media del húmero
(0° colgando, 90° horizontal) · **apoyo** = % del clip con la punta izquierda
por debajo de 3 cm · **vel** = m/s medidos en el `_RM`.

| clip | dur | bucle | brazoI | brazoD | apoyo | vel | uso en Project Arena |
|---|---|---|---|---|---|---|---|
| `A_TPose` | 2.50 | sí 0° | 90° | 90° | 100% | 0 | **calibración**, nunca en pantalla |
| `Chest_Open` | 1.37 | sí 0° | 21° | 51° | 100% | 0 | no |
| `ClimbUp_1m` | 0.67 | sí 0° | 52° | 80° | 8% | 2.93 | no (no hay trepar) |
| `Consume` | 1.33 | sí 0° | 61° | 37° | 100% | 0 | candidato a *usar poción* |
| `Farm_Harvest` | 2.50 | sí 0° | 58° | 21° | 100% | 0 | no |
| `Farm_PlantSeed` | 2.77 | sí 0° | 52° | 48° | 100% | 0 | no |
| `Farm_Watering` | 3.80 | sí 0° | 34° | 30° | 100% | 0 | no |
| `Hit_Knockback` | 0.83 | no 170° | 85° | 92° | 4% | 3.60 | **flinch** (enmascarado) y **derribo** (completo) |
| `Idle_FoldArms_Loop` | 2.50 | sí 0° | 60° | 47° | 76% | 0 | **retirar** — brazos cruzados |
| `Idle_Lantern_Loop` | 2.50 | sí 0° | 24° | 75° | 100% | 0 | no |
| `Idle_No_Loop` | 2.50 | sí 0° | **24°** | **29°** | **100%** | 0 | **idle base** |
| `Idle_Rail_Call` | 2.50 | sí 1° | 24° | 51° | 100% | 0 | no |
| `Idle_Rail_Loop` | 2.50 | sí 0° | 24° | 13° | 100% | 0 | alternativa de idle (piernas rectas) |
| `Idle_Shield_Break` | 1.07 | sí 0° | 57° | 38° | 100% | 0 | candidato a *guardia rota* |
| `Idle_Shield_Loop` | 2.50 | sí 0° | 59° | 27° | 100% | 0 | **idle del Guardián** |
| `Idle_TalkingPhone_Loop` | 2.93 | sí 0° | 23° | 58° | 100% | 0 | no |
| `LayToIdle` | 1.53 | no 104° | 35° | 53° | 52% | 0 | **levantarse** tras derribo |
| `Melee_Hook` | 0.47 | no 157° | 99° | 61° | 88% | 0.76 | gancho sin arma |
| `Melee_Hook_Rec` | 0.60 | no 168° | 68° | 49° | 100% | 0 | recuperación del gancho |
| `NinjaJump_Idle_Loop` | 2.00 | sí 0° | 83° | 74° | 0% | 0 | **fase aérea** |
| `NinjaJump_Land` | 1.27 | no 85° | 28° | 44° | 92% | 0 | **aterrizaje** |
| `NinjaJump_Start` | 0.97 | no 82° | 81° | 74° | 8% | 0 | **impulso de salto** |
| `OverhandThrow` | 1.33 | sí 0° | 81° | 46° | 92% | 0 | lanzamiento |
| `Shield_Dash` | 1.10 | no 177° | 46° | 73° | 92% | 0.91 | **carga con escudo** |
| `Shield_OneShot` | 0.83 | sí 0° | 55° | 35° | 100% | 0 | **golpe de escudo** |
| `Slide_Exit` | 0.50 | no 117° | 43° | 59° | 36% | 4.00 | no |
| `Slide_Loop` | 2.00 | sí 0° | 13° | 78° | 0% | 4.50 | no (pelvis a 0.05 m: derrape en el suelo) |
| `Slide_Start` | 0.83 | no 117° | 34° | 73° | 8% | 4.80 | no |
| `Sword_Block` | 1.23 | sí 0° | 55° | 40° | 100% | 0 | **bloqueo** |
| `Sword_Dash` | 1.57 | sí 0° | 49° | 78° | 100% | 2.36 | **carga con espada** |
| `Sword_Heavy_Combo` | 4.33 | no 46° | 60° | 55° | 44% | 1.23 | **pesado** (recortar: dura 4.3 s) |
| `Sword_Regular_A` | 0.43 | no 144° | 56° | 74° | 100% | 1.90 | **normal A** |
| `Sword_Regular_A_Rec` | 0.97 | no 144° | 47° | 64° | 88% | 0.32 | recuperación de A |
| `Sword_Regular_B` | 0.53 | no 172° | 53° | 97° | 100% | 0.10 | **normal B** — *encadena desde A* |
| `Sword_Regular_B_Rec` | 1.03 | no 82° | 49° | 75° | 100% | 0.36 | recuperación de B |
| `Sword_Regular_C` | 2.00 | no 83° | 74° | 51° | 36% | 0.78 | **normal C** |
| `Sword_Regular_Combo` | 3.00 | sí 5° | 65° | 62° | 60% | 0.78 | A+B+C ya encadenados |
| `TreeChopping_Loop` | 0.97 | sí 0° | 48° | 82° | 100% | 0 | candidato a *hachazo repetido* |
| `Walk_Carry_Loop` | 2.00 | sí 0° | 44° | 44° | 72% | **0.650** | **andar** (único) |
| `Yes` | 2.50 | sí 0° | 61° | 28° | 100% | 0 | emote |
| `Zombie_Idle_Loop` | 1.33 | sí 0° | 22° | 40° | 100% | 0 | no |
| `Zombie_Scratch` | 1.80 | sí 0° | 59° | 44° | 100% | 0 | no |
| `Zombie_Walk_Fwd_Loop` | 1.33 | sí 0° | 44° | 61° | 68% | **1.050** | **andar rápido** — ver §4 |

---

## 3 · Hallazgos que cambian decisiones

### 3.1 `Hit_Knockback` no es un flinch: es un derribo completo

La pelvis va de **0.86 m a 0.04 m** y la cabeza gira **178°**. El personaje
acaba **en el suelo**. Con 3.0 m de desplazamiento de raíz en 0.83 s.

- Usado **enmascarado al torso y con mezcla ≤ 0.78** —lo que hace la v0.17— da
  un retroceso de tronco correcto y la caída no llega a aplicarse.
- Usado **completo**, es el clip de **derribo** que el juego necesita para el
  CC duro, y `LayToIdle` es su levantada. **El paquete sí trae derribo y
  levantada**; simplemente no se llaman así.

### 3.2 `Idle_FoldArms_Loop` es la peor elección posible de idle

Brazos cruzados sobre el pecho (60°/47° de elevación). Las seis clases llevan
báculo, arco, espada o escudo en las manos: cruzar los brazos pelea de frente
con todas las guardias de arma. `Idle_No_Loop` mide 24°/29° con los pies 100 %
plantados — brazos colgando, que es sobre lo que una guardia se puede construir.

### 3.3 Los clips de espada avanzan de verdad

Medido en el `_RM`: `Sword_Regular_A` recorre **0.825 m en 0.433 s** (1.90 m/s).
Al usar la variante sin root motion, el cuerpo se queda clavado en el sitio y
los pies siguen ejecutando el avance: **patinaje garantizado durante cada
ataque**. No es un defecto del retarget; es el clip. Hay que compensarlo
explícitamente (bloqueo de pie o reproyección), y va a las puertas automáticas.

### 3.4 `Sword_Regular_B` empieza agachado

Su pelvis vive entre **0.49 y 0.57 m**, nunca sube. No es un ataque
independiente: es la continuación de `Sword_Regular_A`, que termina agachado.
Reproducir B desde idle mete un salto vertical de 30 cm en un fotograma.
**A/B/C sólo encadenan en orden, o hay que usar `Sword_Regular_Combo`**, que ya
los trae unidos y cierra el bucle a 5°.

### 3.5 `Sword_Heavy_Combo` dura 4.33 s

Ningún poder de Project Arena dura eso. Hay que recortarlo a una ventana, y la
ventana tiene que caer donde está el golpe, no donde sea cómodo.

---

## 4 · Lo que NO existe, y qué se puede honestamente hacer

### Carrera

**No hay ciclo de carrera.** El único candidato es `Zombie_Walk_Fwd_Loop`
(1.050 m/s frente a 0.650), pero es un andar de zombi: brazos adelante y
asimétricos (44°/61°), y sigue teniendo **68 % de apoyo por pie**, es decir sigue
siendo un *andar* (una carrera tiene fase de vuelo, apoyo <50 %).

Acelerar `Walk_Carry_Loop` con `playbackRate` da un andar rápido, no una
carrera, y por encima de ~1.4× se ve acelerado. Es lo que hay.

### Retroceso

**No hay.** Reproducir el andar al revés es lo que hace la v0.16/v0.17
(`animationLibraryMap.js:88`, `if (f < 0) phase = (1-phase) % 1`). Eso produce
moonwalk: el pie de apoyo se desliza hacia delante mientras el cuerpo va hacia
atrás, porque **invertir el tiempo no invierte el contacto** — el talón sigue
tocando primero.

Opciones reales, ninguna gratis:

1. **Gramática propia** (lo que ya hace `skinnedAnimationContract.js`): pasos
   cortos, torso erguido, contacto de punta primero. Es procedimental, pero al
   menos es *correcta* en el contacto.
2. **Derivar un retroceso del andar** invirtiendo el signo del avance del pie
   **en el espacio del contacto**, no en el tiempo. Es un horneado offline y es
   trabajo real.
3. **No tenerlo**: retroceder con el andar hacia delante a velocidad reducida.
   Honesto pero feo.

Se decide en `docs/RETARGET_ARCHITECTURE_V018.md`. **No se declara resuelto.**

### Strafe

**No hay clip lateral.** Girar el andar 90° cruza las rodillas y patina; está
descartado por escrito desde la v0.16 y se mantiene descartado.

Igual que el retroceso: gramática propia o nada. **No se va a marcar como
resuelto en ninguna lista.**

### Giro sobre el sitio

**No hay.** Q/E tienen que girar el cuerpo de forma visible, con pies y pelvis
participando. Sin clip, es gramática propia.

### Casteo, arco y muerte

**No hay ninguno.** Arcanista, Vinculador, Centinela y Rastreador seguirán con la
gramática propia del proyecto para sus acciones. La pipeline nueva **debe**
soportar que un arquetipo no tenga clip y no por eso se quede en T-pose — que es
justamente el riesgo del método absoluto (§4 de la forense).

---

## 5 · Consecuencia para la arquitectura

De las 43, **21 clips** entran en el juego (más `A_TPose`, que sólo se usa para
calibrar y nunca se dibuja):

```
idle        Idle_No_Loop · Idle_Shield_Loop
locomoción  Walk_Carry_Loop · Zombie_Walk_Fwd_Loop
salto       NinjaJump_Start · NinjaJump_Idle_Loop · NinjaJump_Land
impacto     Hit_Knockback (dos ventanas distintas) · LayToIdle
espada      Sword_Regular_A/B/C · Sword_Regular_Combo · Sword_Heavy_Combo
            Sword_Block · Sword_Dash
escudo      Shield_OneShot · Shield_Dash
otros       Melee_Hook (+ _Rec) · OverhandThrow
```

**22 clips no se usan, y no se hornean.** Reducir el horneado de 43 a 21 clips
es, además, la mitad del argumento de rendimiento.
