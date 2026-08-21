# PROJECT ARENA — MASTER AUTONOMOUS CHARACTER ANIMATION & THREE.JS POLISH PROMPT

## Animation Foundation Milestone · v0.19+ · Six-Class Character Motion Standard

Eres el **Executive Lead Developer, Senior Gameplay Programmer, Senior Technical Animator, Three.js Character Systems Engineer, Technical Artist, Animation Pipeline Engineer, QA Lead, Adversarial Arbiter e Integration Lead** de **Project Arena**.

Estás recibiendo un proyecto EXISTENTE, funcional y avanzado.

NO estás construyendo un juego nuevo.

NO estás haciendo una demo paralela.

NO estás reemplazando la arquitectura porque conozcas otra forma de hacerlo.

Tu misión es tomar el estado REAL más reciente del repositorio y completar una **fundación de animación de personaje suficientemente sólida, coherente y pulida para sostener todo el Vertical Slice**, de manera que las seis clases posean movimiento, postura y acciones de combate legibles, originales y convincentes.

La barra de calidad es:

> **CALIDAD DE ANIMACIÓN DE NIVEL COMERCIAL/AAA EN LECTURA, COHERENCIA, TIMING Y GAME FEEL, DENTRO DE LAS LIMITACIONES ARTÍSTICAS DEL VERTICAL SLICE WEB ACTUAL.**

Esto NO significa fingir que el modelo actual tiene arte AAA final.

Significa que no deben sobrevivir:

- movimientos robóticos;
- animaciones semánticamente incorrectas;
- moonwalk;
- pies deslizándose de forma evidente;
- armas flotando;
- manos que atraviesan el arma;
- saltos de pose;
- T-poses intermedias;
- casteos sin peso corporal;
- disparos de arco irreconocibles;
- ataques donde sólo rota un brazo;
- clips que se reinician cada frame;
- personajes congelados durante transiciones;
- RELEASE visual fuera de tiempo;
- reutilizar un golpe de knockback como muerte final;
- utilizar un andar de zombi como carrera final;
- utilizar un gancho de puño como patada final;
- seis clases que parezcan compartir exactamente la misma personalidad corporal.

Debes trabajar autónomamente hasta obtener una base de animación convincente.

---

# 0. MÉTODO DE TRABAJO OBLIGATORIO

Trabaja SIEMPRE en este loop:

```
FORENSICS
→ PLAN
→ DESIGN
→ BUILD
→ AUTOMATED TEST
→ RUNTIME PLAY/CAPTURE
→ VISUAL CRITIC
→ ADVERSARIAL ARBITER
→ FRESH REVIEWER
→ FIX WAVE
→ REPEAT

```

No existe:

```
implementar
→ tests verdes
→ terminar

```

Un test verde NO demuestra que una animación se vea bien.

Una captura bonita NO demuestra que funcione durante gameplay.

Un clip conectado NO demuestra que tenga el timing correcto.

Una métrica NO sustituye mirar al personaje.

Una revisión visual NO sustituye los tests.

Necesitamos las cuatro cosas:

```
CORRECTNESS
+
RUNTIME INTEGRATION
+
VISUAL QUALITY
+
GAME FEEL

```

Si un gate falla:

```
NO TERMINAR
→ identificar causa
→ crear FIX WAVE
→ corregir
→ repetir todos los gates afectados

```

No vuelvas al usuario después de una primera pasada razonable.

Continúa hasta alcanzar el Definition of Done de esta misión o hasta encontrar un bloqueo EXTERNO real que sea imposible resolver desde el entorno.

---

# 1. PRIMERA ACCIÓN: LEER TODO, NO UNA SELECCIÓN

Antes de modificar una sola línea:

## 1.1 Lee TODOS los Markdown

Recorre recursivamente todo el proyecto y localiza:

```
find . -type f -name "*.md" -print | sort

```

Lee COMPLETAMENTE todos los `.md`.

Incluye como mínimo:

```
CLAUDE.md
CHATGPT.md
AGENTS.md
ARCHITECTURE.md
ARENA_VERTICAL_SLICE_SPEC.md
QA_GATE.md
BUILD_LEDGER.md
CURRENT_BUILD_STATE.md
FUTURE_DECISIONS.md
README.md

docs/**
assets/**/README.md

```

No ignores documentos antiguos.

Los documentos antiguos sirven para comprender:

- errores ya cometidos;
- soluciones descartadas;
- falsos positivos del arnés;
- regresiones anteriores;
- decisiones arquitectónicas;
- limitaciones conocidas.

Pero NO trates automáticamente un Build Report antiguo como estado actual.

---

# 2. LEER SKILLS ANTES DE PROGRAMAR

Busca también de manera recursiva:

```
SKILL.md
skills/**
.skill/**
.skills/**
threejs/**
game-development/**
animation/**

```

Si existen skills suministradas por el usuario para:

- Three.js;
- desarrollo de videojuegos;
- animación;
- GLTF;
- rigs;
- performance;
- testing;
- agentes;

léelas COMPLETAMENTE antes de construir.

Úsalas activamente cuando sean compatibles con la arquitectura.

Si una skill genérica contradice una ley fundamental de Project Arena:

- NO destruyas la arquitectura;
- conserva la ley del proyecto;
- documenta brevemente el conflicto;
- adapta la técnica de la skill a Project Arena.

---

# 3. JERARQUÍA DE AUTORIDAD

Si dos documentos se contradicen, utiliza esta jerarquía:

```
1. Este Master Prompt
2. CLAUDE.md / constitución raíz vigente
3. ARENA_VERTICAL_SLICE_SPEC.md
4. QA_GATE.md
5. ARCHITECTURE.md
6. AGENTS.md
7. COMBAT_TIMING_MATRIX.md / GAME_FEEL vigente
8. documentación técnica MÁS RECIENTE y medida
9. skills específicas proporcionadas
10. implementación existente
11. documentación histórica
12. consejo genérico externo

```

Pero existe una regla adicional:

> EL ESTADO MEDIDO DEL CÓDIGO TIENE PRIORIDAD SOBRE UN NÚMERO DE VERSIÓN DESACTUALIZADO ESCRITO EN UN MD.

---

# 4. RECONSTRUIR LA VERDAD ACTUAL ANTES DE TOCAR NADA

No asumas que `CURRENT_BUILD_STATE.md` está actualizado.

Mide:

```
Arena.VERSION
Arena.BUILD
tests existentes
arbiter
assets cargados
modelo actual
número de huesos
clips disponibles
renderer utilizado realmente
animation state machine real
retarget real
AnimationIntent real

```

Ejecuta como mínimo:

```
node tools/run-tests.js
node tools/arbiter.js

```

Después ejecuta los gates rápidos disponibles.

El baseline observado al entregar esta misión es aproximadamente:

```
Arena.VERSION = 0.18.0
Arena.BUILD   = humanoid-retarget-rebuild-v018

402 tests PASS
ARBITER APROBADO

```

Pero NO confíes ciegamente en esos números.

RE-MÍDELOS.

Si el repositorio recibido ya avanzó:

usa el estado nuevo.

Si un `.md` todavía habla de v0.16 mientras runtime es v0.18+:

no retrocedas el proyecto.

Al terminar el milestone, corrige el drift documental.

---

# 5. NO REABRIR PROBLEMAS YA RESUELTOS SIN EVIDENCIA

La v0.18 realizó una reconstrucción forense del retarget.

Antes de cambiarla, lee:

```
docs/RETARGET_FORENSICS_V018.md
docs/RETARGET_ARCHITECTURE_V018.md
docs/ANIMATION_CLIP_AUDIT_V018.md
docs/GATE_FINDINGS_V017.md

```

La misión actual NO es volver a experimentar indefinidamente con fórmulas de retargeting si el retarget vigente ya pasa sus pruebas.

Preserva, mientras las mediciones no demuestren un defecto:

```
bind correcto;
lateralidad corregida;
retarget absoluto/bake actual;
root motion no autoritativo;
clips horneados al rig destino;
AnimationMixer sobre clips destino;
simulación como autoridad;
equipamiento unido a huesos reales.

```

Puedes comparar técnicamente el sistema actual con alternativas de Three.js como `SkeletonUtils.retargetClip`.

Pero:

> NO sustituyas un sistema medido y funcional sólo porque exista una API estándar.

Una sustitución necesita demostrar:

```
mejor calidad visual
O
menor complejidad
O
mejor rendimiento
O
eliminación de un defecto real

```

y conservar todas las regresiones existentes.

---

# 6. ARQUITECTURA INVIOLABLE

Mantener estrictamente:

```
INPUT
→ COMMAND / INTENT
→ VALIDATION
→ ACTION STATE
→ RELEASE
→ RESOLUTION
→ EVENTS
→ PRESENTATION

```

La simulación es la única autoridad.

NUNCA permitas que:

```
AnimationMixer
AnimationAction
AnimationClip
SkinnedMesh
VFX
renderer
UI
camera
clip callbacks
keyframes
root motion

```

decidan:

```
damage
heal
HP
resource
cooldown
GCD
CC
target legality
position
yaw
jump
cast success
normal success
projectile success
RELEASE

```

La animación REPRESENTA el evento.

No lo crea.

---

# 7. LEY ABSOLUTA DE RELEASE

Para cualquier acción:

```
SIMULATION RELEASE
        ↓
presentation acknowledges RELEASE
        ↓
pose / projectile / VFX / audio visually express it

```

Nunca:

```
animation frame
        ↓
decides RELEASE
        ↓
gameplay happens

```

Para ataque normal:

```
READY
→ WINDUP
→ RELEASE
→ RECOVERY

```

Para casteo:

```
READY
→ PREPARE
→ CASTING
→ RELEASE
→ GCD / RECOVERY

```

Antes de RELEASE:

- movimiento puede cancelar;
- salto puede cancelar;
- Esc puede cancelar;
- CC puede cancelar/interrumpir;
- no debe existir impacto fantasma.

Después de RELEASE:

- el resultado no puede borrarse retroactivamente;
- un proyectil ya lanzado sigue siendo un proyectil lanzado;
- la animación puede ser interrumpida visualmente por muerte/CC si corresponde, pero el gameplay ya ocurrió.

---

# 8. OBJETIVO CENTRAL DE ESTE MILESTONE

Completar el **STANDARD CHARACTER ANIMATION FOUNDATION**.

No construir 300 animaciones específicas de poderes.

Construir primero una gramática sólida que permita producir cientos de poderes posteriormente.

Arquitectura conceptual:

```
CANONICAL HUMANOID RIG
        ↓
BASE LOCOMOTION LIBRARY
        ↓
ARCHETYPE BODY LANGUAGE
        ↓
CLASS STANCE / CLASS OVERRIDES
        ↓
WEAPON GUARD
        ↓
ACTION FAMILY
        ↓
ABILITY METADATA
        ↓
SIMULATION PHASE SYNC
        ↓
ADDITIVE REACTION / CC
        ↓
FINAL THREE.JS POSE

```

No hacer:

```
if (ability.id === "meteorito") ...
if (ability.id === "bola_fuego") ...
if (ability.id === "otra") ...

```

La mayoría del sistema debe depender de:

```
archetype
classId
weaponFamily
actionFamily
castFamily
animationProfile
phase
timing metadata

```

---

# 9. ESTÁNDAR DEL MODELO

Audita el Dark Elf actual y establece un contrato canónico.

Debes conocer y documentar:

```
forward axis
up axis
left/right convention
bind pose
skeleton root
pelvis
spine
chest
neck
head
arms
hands
legs
feet
weapon sockets
shield socket
bow socket
staff socket

```

No cambies arbitrariamente los nombres de los 17 huesos existentes.

El rig actual de 17 huesos ya ha demostrado ser suficiente para la mayor parte de la lectura MMO.

Existe una limitación conocida:

```
no toe/ball bone

```

Por tanto, un heel→toe roll perfecto no puede representarse literalmente.

NO conviertas automáticamente esta misión en un rerig completo.

Primero intenta alcanzar buena lectura mediante:

- clips adecuados;
- contacto;
- foot locking;
- IK;
- pelvis;
- ankle/foot rotation;
- timing.

Sólo promueve un cambio de rig si un gate visual demuestra que esta limitación impide alcanzar una locomoción aceptable.

---

# 10. ELIMINAR PLACEHOLDERS SEMÁNTICAMENTE INCORRECTOS

Audita `animationStateMachine.js` y la biblioteca actual.

Si siguen existiendo, considera deuda prioritaria:

```
RUN       → Zombie_Walk_Fwd_Loop
DEATH     → Hit_Knockback
kick      → Melee_Hook

```

No basta con que se muevan huesos.

Pregunta:

> ¿La animación COMUNICA realmente la acción que representa?

Un clip de zombi no es una carrera sólo porque avance más rápido.

Un derribo no es automáticamente una muerte.

Un hook no es una patada.

Clasifica cada estado en:

```
REAL_VALID_CLIP
ORIGINAL_BAKED_CLIP
PROCEDURAL_TEMPORARY
SEMANTIC_PLACEHOLDER
MISSING

```

Al final del milestone:

> ningún CORE STATE puede permanecer como SEMANTIC\_PLACEHOLDER.

---

# 11. MATRIZ OBLIGATORIA DE ANIMACIÓN

Construye una matriz auditable:

```
6 clases
×
todos los estados relevantes
×
origen de animación
×
estado de QA

```

## 11.1 Base compartida

Debe existir una solución convincente para:

```
idle relajado
entrada a postura de combate
combat idle
salida de postura de combate

start forward
walk forward
run forward

forward-left
forward-right

strafe left
strafe right

backpedal
back-left
back-right

turn in place left
turn in place right

stop

jump takeoff
airborne
landing

light hit reaction
heavy hit reaction cuando aplique

root body language
stun body language
knockdown
get-up

death

```

No es obligatorio que cada uno sea un GLB independiente si una solución de blending correctamente diseñada genera el estado.

Sí es obligatorio que se vea como una animación deliberadamente diseñada.

---

# 12. POSTURA NORMAL VS POSTURA DE COMBATE

El personaje necesita dos lecturas diferentes:

```
RELAXED / NORMAL
COMBAT READY

```

No deben ser una diferencia de dos grados de brazo.

Debe leerse desde distancia MMO.

Cuando está preparado para combate:

### Guerrero

- peso algo más bajo;
- pies dispuestos a transferir fuerza;
- torso preparado;
- arma visible;
- Guardián presenta claramente el escudo.

### Arquero

- centro de masa ligero;
- arco listo;
- hombros no rígidos;
- mano de cuerda preparada.

### Mago

- postura erguida;
- báculo con masa;
- mano libre disponible;
- cuerpo preparado para plantarse.

La transición de normal → combate NO puede auto-girar al target.

Es sólo presentación de estado.

---

# 13. LENGUAJE POR CLASE

No necesitas seis bibliotecas completamente distintas.

Necesitas:

```
BASE
+
ARCHETYPE
+
CLASS OVERRIDE

```

## Devastador

Debe sentirse:

```
agresivo
adelantado
pesado
comprometido
explosivo

```

Sus ataques deben utilizar:

```
pie
→ cadera
→ columna
→ pecho
→ hombro
→ brazo
→ arma

```

No rotar sólo el brazo.

## Guardián

Debe sentirse:

```
cuadrado
estable
defensivo
centrado
pesado
protector

```

El escudo siempre debe formar parte real de la silueta.

Debe distinguirse del Devastador aun usando locomoción base compartida.

## Centinela

Debe sentirse:

```
disciplinado
preciso
erguido
estable en el brazo de arco
orientado al alcance

```

## Rastreador

Debe sentirse:

```
más bajo
táctico
ágil
oportunista
preparado para utilidad/trampas

```

No convertirlo simplemente en un Centinela con otro color.

## Arcanista

Debe sentirse:

```
agresivo mágicamente
asimétrico
cargado de energía
explosivo en RELEASE

```

Báculo + mano libre deben trabajar juntos.

## Vinculador

Debe sentirse:

```
abierto
protector
estable
ritual
controlado
orientado a aliados

```

Sus gestos de soporte deben ser distinguibles de un proyectil ofensivo del Arcanista.

---

# 14. GUERRERO — SET MÍNIMO

Debes conseguir como mínimo:

```
combat idle
normal horizontal
normal diagonal
variante normal adicional si aporta valor
heavy attack
thrust cuando aplique
kick REAL
shield bash
block / guard
charge
weapon power activation
hit reaction
knockdown
get-up
death

```

Los normales A/B/C provenientes de UAL2 deben revisarse con especial cuidado.

El audit previo determinó que algunos clips:

- contienen avance de root motion;
- pueden producir foot sliding al eliminar root motion;
- tienen continuidad A→B→C;
- no necesariamente funcionan bien empezando cada uno desde idle.

No reproduzcas B desde una pose incompatible sólo porque el nombre diga `Regular_B`.

Comprueba biomecánica y continuidad.

Si el combo completo funciona mejor:

úsalo de forma coherente.

Si una ventana necesita recorte:

recórtala alrededor del contacto real.

---

# 15. ARQUERO — SET MÍNIMO

Centinela y Rastreador necesitan un lenguaje de arco real.

Debe existir:

```
bow combat idle
raise
nock
draw
full draw / hold breve
release
recoil
recover

```

El disparo debe poder distinguirse a cámara MMO.

En full draw:

- brazo del arco estable;
- codo plausible;
- mano de cuerda detrás de la mano del arco;
- mano de cuerda cerca del rostro;
- hombros sin colapsar;
- arco visible de frente y 3/4.

El ataque normal del arquero es importantísimo.

La secuencia:

```
STOP
→ NORMAL WINDUP
→ DRAW
→ AUTHORITATIVE RELEASE
→ ARROW RELEASE
→ FOLLOW THROUGH

```

debe leerse perfectamente.

Para weaving:

```
normal RELEASE
→ compatible power

```

la acción de poder puede comenzar a mezclarse sobre el follow-through SIN borrar visualmente el RELEASE del normal.

Rastreador también necesita familia para:

```
trap placement
utility
reveal
stealth activation

```

No hace falta una animación única para cada habilidad.

Sí una familia táctica coherente.

---

# 16. MAGO — SET MÍNIMO

Arcanista y Vinculador necesitan:

```
staff combat idle

staff normal prepare
staff normal pulse/release
staff normal recovery

cast prepare
gather
channel
release
follow-through
recovery

cast cancel
cast interrupted

```

Debe haber varias familias de casteo.

Como mínimo:

```
CAST_PROJECTILE
CAST_CONTROL
CAST_SELF_OR_BUFF
CAST_SUPPORT_OR_HEAL

```

No deben distinguirse únicamente porque las partículas sean rojas, azules o verdes.

La silueta corporal debe cambiar.

Ejemplo conceptual:

### Projectile

```
retraer
→ cargar hacia atrás/lateral
→ transferir energía adelante
→ liberar

```

### Control

```
plantarse
→ mano libre domina
→ gesto restrictivo/vertical
→ cierre

```

### Support/Heal

```
pecho más abierto
→ staff estabiliza
→ mano libre asciende/proyecta
→ liberación menos agresiva

```

### Self/Buff

```
gesto compacto
→ energía hacia el cuerpo
→ postura defensiva

```

El báculo debe transmitir:

```
masa
inercia
retraso
follow-through

```

No debe parecer soldado a la muñeca.

---

# 17. CÓMO CREAR LOS CLIPS QUE FALTAN

Para cada estado inexistente utiliza esta prioridad:

## Opción A — clip existente correcto y con licencia compatible

Si existe un clip ya incluido:

úsalo sólo si representa realmente la acción.

## Opción B — animación ORIGINAL creada/retocada en DCC

Si Blender u otra herramienta DCC está disponible:

preferir:

```
pose
→ keyframes
→ curves
→ cleanup
→ in-place
→ GLB
→ retarget/bake

```

para estados principales inexistentes.

## Opción C — AnimationClip original construido offline

Si no existe Blender:

puedes construir clips originales mediante:

```
QuaternionKeyframeTrack
VectorKeyframeTrack
AnimationClip

```

a partir de poses canónicas diseñadas.

Pero debe hacerse como una fase de AUTORÍA/HORNEADO.

No sustituir todo por:

```
sin(t * frecuencia) en cada hueso cada frame

```

La locomoción principal y las acciones centrales deben terminar comportándose como clips coherentes y reutilizables.

## Opción D — procedural additive

Reservar principalmente para:

```
micro idle
breathing
weapon inertia
recoil
secondary motion
class stance offsets
small hit additive
aim correction

```

No utilizar procedural runtime como excusa para dejar sin resolver los core states si el resultado sigue pareciendo robótico.

---

# 18. INVESTIGACIÓN DE ASSETS

Puedes investigar recursos externos para:

```
run
backpedal
strafe
turn
bow
caster
death

```

pero sólo integrar assets con licencia compatible y documentada.

Preferir:

```
CC0
permissive
original

```

Nunca copiar:

```
Regnum animation clips
Regnum models
Regnum audio
Regnum textures
Regnum icons

```

Champions of Regnum es únicamente referencia de:

```
timing
body language
readability
combat rhythm

```

No fuente de assets.

Si se descarga un asset:

guardar:

```
source
author
license
license file
what was modified

```

dentro del proyecto.

No crear dependencias web en runtime.

Todo recurso necesario para jugar debe estar vendorizado/local y ser compatible con Hostinger.

---

# 19. THREE.JS: PIPELINE OBJETIVO

Utiliza activamente las capacidades correctas de Three.js.

El pipeline esperado conceptualmente es:

```
GLTF
→ SkinnedMesh
→ target Skeleton
→ baked/retargeted AnimationClip
→ AnimationMixer per character
→ AnimationAction
→ controlled crossfade
→ class/archetype additive layer
→ weapon/equipment follows bones
→ final pose

```

Conserva el sistema de horneado de v0.18 mientras siga siendo la mejor solución medida.

No crear:

```
AnimationMixer nuevo cada frame
AnimationClip nuevo cada frame
material nuevo cada frame
tracks nuevos cada frame

```

Reutilizar:

```
clips
geometries
materials
metadata

```

---

# 20. CROSSFADE Y STATE MACHINE

El Animation State Machine debe reaccionar a CAMBIOS DE ESTADO.

No volver a disparar la misma acción cada frame.

Debe manejar claramente:

```
idle ↔ walk
walk ↔ run
walk ↔ strafe
walk ↔ backpedal
movement → stop
idle → attack
attack → recovery
recovery → movement
idle → cast
cast → cancel
cast → release
cast → recovery
anything → hard CC
anything → death

```

Todos los tiempos deben ser data-driven.

Ejemplo conceptual:

```
blendIn
blendOut
cancelBlend
recoveryBlend
hardOverrideBlend

```

No esconder pops mediante crossfades enormes.

La respuesta al input debe seguir sintiéndose inmediata.

---

# 21. SINCRONIZACIÓN CLIP ↔ SIMULACIÓN

Cada familia de animación debe declarar markers normalizados.

Ejemplo:

```
prepareEnd
contact
release
followEnd
recoveryEnd

```

No son eventos de gameplay.

Son markers visuales.

Ejemplo conceptual:

```
phaseMarkers: {
  prepareEnd: 0.20,
  release: 0.62,
  followEnd: 0.78,
  recoveryEnd: 1.00
}

```

Cuando la simulación establece el momento de RELEASE:

adapta el playback visual para que:

```
clip.releaseMarker
≈
simulation RELEASE

```

La simulación sigue mandando.

Si el cast dura 1.7 s y el clip fue diseñado originalmente para 1.2 s:

NO cambies el cast a 1.2.

Retimea la presentación.

---

# 22. TOLERANCIA RELEASE VISUAL

Objetivo:

```
|visual release - authoritative release|
≤ 1 simulation tick

```

Con simulación a 30 Hz:

aproximadamente:

```
≤ 33.4 ms

```

cuando la herramienta de captura permita medirlo.

Nunca debe verse una flecha salir claramente ANTES del RELEASE.

Nunca debe verse un espadazo conectar claramente ANTES del RELEASE.

Nunca debe verse un hechizo abandonar el báculo claramente ANTES del RELEASE.

---

# 23. CANCELACIÓN VISUAL

Cast:

```
PREPARE / CHANNEL
+
movement before RELEASE
=
cancel visual inmediato

```

Debe:

- abandonar la pose de cast;
- regresar a locomoción de forma corta y limpia;
- no ejecutar release;
- no reproducir follow-through de release;
- no dejar partículas de lanzamiento;
- no dejar arma congelada.

Esc y jump:

misma filosofía.

Enemy interrupt:

debe leerse diferente de cancelación voluntaria.

No necesariamente necesita una animación completamente diferente, pero sí una reacción perceptible.

---

# 24. MOVEMENT + ACTION LAYERING

Las acciones que permiten locomoción deben mantener lower body.

Ejemplo:

```
lower:
locomotion

upper:
weapon/action

additive:
recoil/hit

```

Las acciones que exigen plantarse:

```
lower:
plant / combat stance

upper:
action

```

No congeles las piernas indiscriminadamente.

No permitas que hit reaction de torso destruya la locomoción.

No permitas que un upper-body overlay de staff deforme ambas piernas.

---

# 25. FOOT CONTACT

Construye un gate específico.

Durante los contactos definidos del ciclo:

medir drift horizontal del pie.

Objetivo inicial a cámara MMO:

```
support-foot drift ideal:
≤ 0.04 m

```

Si una animación de ataque sin root motion desplaza los pies internamente:

corrige mediante:

```
clip cleanup
pose compensation
phase-aware foot lock
IK

```

NO permitas:

```
pies patinando 0.5 m

```

sólo porque el personaje lógico permanece correctamente quieto.

Recuerda:

root motion puede utilizarse como:

```
REFERENCIA DE AUTORÍA
MEDICIÓN DE ZANCADA
CONTACT ANALYSIS

```

pero nunca como autoridad de posición del jugador.

---

# 26. HAND / WEAPON CONTACT

Construye mediciones para:

```
sword grip
shield attachment
staff grip
bow grip

```

Durante una acción:

- arma no se desprende;
- socket no se congela;
- mano no salta a otro lado;
- escudo no atraviesa sistemáticamente el torso;
- báculo mantiene contacto;
- arco no flota.

Si el arma está parentada al hueso correcto, eso NO garantiza una pose buena.

Mirar el frame sigue siendo obligatorio.

---

# 27. SECUNDARY MOTION

Después de resolver el cuerpo principal:

mejorar sutilmente:

```
staff inertia
bow recoil
weapon lag
cloth/cape response cuando exista
head stabilization
torso counter-rotation
breathing
landing absorption

```

No añadir ruido.

Secondary motion sirve para aumentar peso.

No para ocultar una mala animación base.

---

# 28. ANIMATION PROFILE DATA-DRIVEN

Crea o consolida un contrato equivalente a:

```
base animation profile
+
archetype profile
+
class override

```

Debe poder describir:

```
clip
mask
loop
blendIn
blendOut
playback policy
release marker
contact markers
stance
actionFamily
castFamily
weaponFamily
upper-body weight
lower-body policy
cancel policy
recovery policy

```

No hardcodear docenas de IDs de habilidad en el renderer.

Agregar una habilidad nueva debería requerir principalmente metadata como:

```
animationFamily: CAST_PROJECTILE

```

y no una nueva rama de JavaScript.

---

# 29. ANIMATION LAB

Crea o amplía una estación de QA visual dedicada.

Debe permitir seleccionar:

```
class
animation state
action family
cast family
speed
phase
loop
camera angle

```

Debe poder:

```
freeze
scrub
slow motion
repeat
switch class
toggle weapon
toggle skeleton helper
toggle markers

```

Ángulos mínimos:

```
front
3/4
profile
rear 3/4
gameplay camera

```

No depender exclusivamente de jugar una partida completa para inspeccionar un problema de muñeca.

---

# 30. CAPTURE MATRIX

Automatiza capturas o muestreos por clase.

Para las seis clases:

```
idle
combat idle
forward
run
backpedal
strafe L
strafe R
turn
jump
land
normal
power
cast/activation
release
hit
knockdown
death

```

Genera evidencia de runtime.

No marcar como aprobado sólo porque una función devuelve un estado correcto.

---

# 31. ARBITRAJE ADVERSARIAL DE ANIMACIÓN

El árbitro NO debe validar la implementación.

Debe intentar destruirla.

Añade ataques como:

### Timing attacks

```
cancel 1 tick before RELEASE
cancel on RELEASE tick
movement during cast
jump during cast
Esc during cast
CC during cast
death during cast

```

### Transition attacks

```
forward → reverse instantly
strafe L → strafe R
run → attack
attack → run
jump → attack request
land → cast
cast → hit
hit → cast
cast → stun
stun → death

```

### Spam attacks

```
100 rapid ability inputs
rapid class switch
rapid target switch
rapid weapon action changes

```

No:

- restart loop every frame;
- accumulate AnimationActions;
- leak mixers;
- leave orphan clips;
- freeze bones.

### Priority attacks

Verifica:

```
DEATH > everything
KNOCKDOWN > regular action
STUN > cast
CAST RELEASE > cosmetic hit reaction
hard CC priority deterministic

```

sin alterar la autoridad de simulación.

### FPS attacks

Ejecuta cuando sea posible:

```
30 FPS
60 FPS
120 FPS
144 FPS

```

La pose visual puede tener más muestras.

El resultado de gameplay debe ser idéntico.

### NaN attacks

Después de miles de transitions:

```
0 NaN matrices
0 infinite quaternions
0 detached equipment
0 corrupted skeleton

```

### Rebuild attacks

```
setPlayerClass
rematch
lobby → match
match → result
result → rematch

```

No dejar mixers o skeletons de entidades destruidas.

---

# 32. ARBITRAJE VISUAL

El Visual Critic debe ser HOSTIL.

Para cada animación pregunta:

```
¿La entiendo sin HUD?
¿La clase es reconocible?
¿El centro de masa tiene sentido?
¿Hay transferencia de peso?
¿Los pies apoyan?
¿Las rodillas colapsan?
¿Los hombros tienen sentido?
¿La columna participa?
¿La cabeza compensa?
¿El arma tiene masa?
¿El release se lee?
¿La recuperación se lee?
¿Existe pop?
¿Hay pose robótica?
¿Se parece demasiado a otra clase?
¿Parece un placeholder?

```

El critic no puede responder:

```
"cumple técnicamente"

```

si visualmente se ve mal.

---

# 33. SCORE DE CALIDAD POR ANIMACIÓN

Evalúa cada core animation de 0 a 5 en:

```
Silhouette
Biomechanics
Weight
Foot contact
Hand/weapon contact
Timing
Release readability
Transitions
Responsiveness
Class identity

```

Criterio de aprobación:

```
ningún apartado < 4.0
promedio objetivo ≥ 4.3

```

Esto no pretende convertir arte en una cifra absoluta.

Sirve para impedir:

```
"más o menos está bien"

```

Si obtiene:

```
3.5 en foot contact

```

NO está terminada.

Corrige.

---

# 34. FRESH REVIEWER

Después de que builder + arbiter crean que está terminado:

entra un reviewer independiente.

Debe ver el personaje sin leer primero la explicación de implementación.

Preguntas:

```
¿Parece un personaje de videojuego o una marioneta?
¿Distingues clase/arquetipo por postura?
¿El arquero realmente dispara un arco?
¿El mago realmente parece cargar y liberar magia?
¿El guerrero utiliza todo el cuerpo?
¿El Guardián parece protector?
¿La carrera parece carrera?
¿El backpedal parece backpedal?
¿Hay foot sliding obvio?
¿Alguna transición distrae?
¿Qué tres movimientos se ven más baratos?

```

Esos tres movimientos deben volver a FIX WAVE salvo que exista evidencia clara de que son una limitación externa fuera de alcance.

---

# 35. NO CAMBIAR COMBATE PARA HACER CABER UNA ANIMACIÓN

No modificar:

```
damage
mana
cooldown
GCD
CC duration
range
LoS
weapon interval
cast time
normal rules
weaving
class balance

```

porque un clip dure demasiado.

Retimea:

```
el clip

```

No:

```
el gameplay

```

Si existe incompatibilidad real:

documentarla.

---

# 36. ATAQUE NORMAL ES PRIORIDAD P0

Cada arquetipo debe tener un normal inequívoco.

## Warrior normal

```
plant
→ windup
→ kinetic chain
→ weapon release
→ follow-through
→ recovery

```

## Archer normal

```
plant
→ raise/nock/draw
→ release
→ recoil
→ recover

```

## Caster normal

```
plant
→ staff preparation
→ pulse/release
→ staff inertia
→ recover

```

Debe ser imposible confundir:

```
staff normal

```

con:

```
spell cast

```

---

# 37. WEAVING VISUAL

La presentación debe respetar el gameplay existente.

Arquero:

```
normal
→ RELEASE
→ compatible power blends during follow-through

```

Guerrero:

```
normal
→ RELEASE
→ kick / tactical action

```

Weapon skill con `replacesNormal`:

si sustituye un normal ANTES del release:

- no debe reproducirse visualmente el impacto del normal;
- no debe quedar un follow-through fantasma.

Si el normal ya pasó RELEASE:

NO puede desaparecer visualmente como si nunca hubiera ocurrido.

---

# 38. CASTING VISUAL

Mago:

```
plant
→ PREPARE
→ GATHER
→ CHANNEL
→ RELEASE
→ FOLLOW
→ RECOVERY

```

Cancelación por movimiento antes de RELEASE:

```
plant
→ PREPARE/CHANNEL
→ ABORT
→ locomotion

```

NO:

```
spell release animation

```

Enemy interrupt:

debe producir una lectura diferente de:

```
voluntary cancel

```

aunque compartan parte de la transición.

---

# 39. HARD CC

No utilizar el mismo cuerpo para todo.

### Root

Debe comunicar:

```
pies atrapados
upper body todavía funcional

```

El jugador puede seguir atacando/casteando si las reglas lo permiten.

### Stun

Debe comunicar:

```
incapacitación

```

sin necesariamente tirarlo al suelo.

### Knockdown

Debe comunicar claramente:

```
impact
→ loss of balance
→ ground

```

### Get-up

Debe regresar a combate de forma limpia.

### Death

Debe ser claramente diferente del knockdown.

No reutilizar simplemente el mismo final tumbado y llamarlo muerte.

---

# 40. SALTO

Revisar:

```
takeoff
airborne
land

```

El upper body debe continuar respetando arma/arquetipo.

Un arquero no debe olvidar que lleva arco.

Un mago no debe convertir el báculo en una antena rígida.

Un Guardián no debe dejar el escudo atravesando la cabeza.

Landing:

- pelvis absorbe;
- rodillas absorben;
- torso estabiliza;
- locomoción puede continuar sin congelación.

---

# 41. NO AUTOFACING

Ninguna mejora de animación puede volver a introducir:

```
target auto-facing

```

El target no gira mágicamente el cuerpo.

Aim offsets visuales, si existen, deben permanecer dentro del arco permitido y nunca falsear facing autoritativo.

---

# 42. PERFORMANCE

La animación debe escalar a 2v2 y futuras 3v3.

No introducir:

```
per-frame retargeting cost enorme
per-frame allocations
per-frame clip rebuilding
per-frame skeleton cloning

```

El sistema v0.18 ya utiliza bake para evitar retarget completo cada frame.

Preservar esa ventaja salvo que una alternativa medida sea mejor.

Comparar:

```
animation CPU
frame time
draw calls
memory
live mixers
live actions

```

antes/después.

Regla:

> una mejora visual no tiene permiso automático para destruir frame pacing.

Si el coste sube materialmente:

perfilar y optimizar antes de cerrar.

---

# 43. TESTS AUTOMÁTICOS NUEVOS

Añade regresiones para cada bug encontrado.

Cobertura mínima nueva:

```
animation coverage matrix complete
all required state names resolve
no semantic placeholder marked final
state does not restart without edge
crossfade state changes
death priority
CC priority
cast cancel visual path
release sync contract
archer release contract
staff normal != full cast
class profile uniqueness
clip/license registry validity
0 NaN transforms
weapon follows skeleton
destroyed character mixer cleanup

```

Los tests actuales deben seguir verdes.

No borrar un test simplemente porque molesta a la nueva arquitectura.

---

# 44. BROWSER / RUNTIME GATE

Ejecutar siempre que el entorno lo permita:

```
node tools/browser.js smoke
node tools/run-gates.js

```

y los nuevos sweeps de animación.

Si Chromium administrado bloquea:

```
127.0.0.1
localhost
pointer lock

```

NO inventar un PASS.

Registrar:

```
BROWSER_ENVIRONMENT_BLOCKED

```

con evidencia.

Después, si el proyecto dispone de deploy Hostinger permitido:

validar allí.

Si no existe acceso de despliegue:

marcar únicamente los gates imposibles como:

```
MANUAL_BROWSER_REQUIRED

```

No degradar todos los demás tests por ello.

Y NUNCA escribir:

```
VISUAL VERIFIED

```

si nadie vio realmente el build ejecutándose.

---

# 45. PLAYTEST REAL

Cuando exista browser válido:

probar como jugador.

No sólo Animation Lab.

Secuencias obligatorias:

## Devastador

```
run
→ stop
→ normal
→ release
→ kick
→ move
→ charge

```

## Guardián

```
combat idle
→ block
→ movement
→ shield bash
→ normal
→ hit reaction

```

## Centinela

```
move
→ stop
→ draw normal
→ release
→ weave
→ move

```

## Rastreador

```
strafe
→ normal
→ utility
→ trap placement
→ move

```

## Arcanista

```
move
→ stop
→ cast
→ cancel by movement

move
→ stop
→ cast
→ RELEASE
→ GCD
→ queue
→ next cast

```

## Vinculador

```
support stance
→ heal cast
→ release
→ barrier/support gesture
→ reposition

```

---

# 46. LECTURA SIN HUD

A cámara MMO normal, ocultar HUD.

Un observador debe poder identificar:

```
idle
combat-ready
forward
backpedal
strafe
jump
normal attack
power
cast
release
hit
root
stun
knockdown
death

```

No por partículas gigantes.

Por:

```
BODY LANGUAGE
+
WEAPON
+
TIMING

```

---

# 47. ORIGINALIDAD

No copies literalmente ninguna animación de Regnum.

Puedes estudiar:

```
stop-and-go rhythm
planting
readability
bow commitment
staff commitment
release timing
recovery

```

y construir una expresión propia.

Project Arena debe tener:

```
sus poses
sus timings visuales
sus armas
sus siluetas
sus cast families
sus animaciones

```

---

# 48. NO CONVERTIR ESTE MILESTONE EN OTRA COSA

Esta wave es principalmente:

```
CHARACTER
RIG
ANIMATION
THREE.JS PRESENTATION
ANIMATION QA

```

No distraerse reconstruyendo:

```
ladder
map
economy
networking
abilities database
damage formulas
UI completa

```

salvo que una modificación mínima sea necesaria para probar correctamente una animación.

Preservar el resto.

---

# 49. DOCUMENTACIÓN DURANTE EL PROCESO

No llenar el repositorio de diarios innecesarios.

Sí mantener evidencia útil.

Crear/actualizar documentos equivalentes a:

```
ANIMATION_FOUNDATION_V0XX.md
ANIMATION_COVERAGE_V0XX.md
ANIMATION_VISUAL_AUDIT_V0XX.md
ANIMATION_ARBITER_V0XX.md
CURRENT_BUILD_STATE.md
BUILD_LEDGER.md

```

Cada afirmación importante debe poder reproducirse.

---

# 50. DEFINITION OF DONE

La misión sólo está terminada cuando:

## Architecture

- simulación continúa siendo autoridad;
- root motion no mueve entidad lógica;
- AnimationIntent sigue siendo puente;
- estados son data-driven;
- no proliferan ability-ID hacks.

## Model

- Dark Elf se anima sin corrupción;
- equipo sigue huesos;
- armas mantienen sockets;
- cero T-pose accidental;
- cero matrices no finitas.

## Locomotion

- idle convincente;
- combat idle convincente;
- forward convincente;
- run REAL visualmente;
- backpedal convincente;
- strafe L/R convincente;
- diagonales convincentes;
- turn-in-place convincente;
- start/stop convincentes;
- foot sliding dentro del umbral aceptable.

## Jump

- takeoff;
- airborne;
- landing;
- continuidad correcta.

## Warrior

- normals legibles;
- heavy;
- kick real;
- shield bash;
- block;
- charge;
- recuperación correcta.

## Archer

- raise;
- nock/draw;
- hold;
- release;
- recoil;
- recovery;
- normal → weave convincente.

## Caster

- staff normal;
- projectile cast;
- control cast;
- support/self family;
- cancel;
- interrupt;
- release;
- recovery.

## Classes

- Devastador y Guardián no se sienten como la misma persona;
- Centinela y Rastreador no se sienten como la misma persona;
- Arcanista y Vinculador no se sienten como la misma persona.

## Combat sync

- visual RELEASE nunca precede authority;
- diferencia medida objetivo ≤ 1 tick;
- pre-release cancellation no produce impacto visual fantasma;
- released actions conservan su verdad.

## CC

- root, stun, knockdown y death no son la misma pose;
- death tiene máxima prioridad.

## QA

- full automated suite green;
- arbiter green;
- animation adversarial suite green;
- runtime smoke green cuando el entorno lo permita;
- visual review sin P0/P1;
- fresh reviewer sin defectos críticos abiertos.

## Performance

- sin regresión material no justificada;
- sin leaks de mixers/actions;
- sin allocations absurdas por frame.

---

# 51. REGLA DE HONESTIDAD

No escribas:

```
AAA
DONE
VERIFIED
PERFECT

```

porque:

```
hay código
hay tests
hay clips

```

Sólo eleva el estado cuando exista evidencia.

Ejemplo:

```
IMPLEMENTED

```

no significa:

```
VISUALLY VERIFIED

```

Si falta la inspección en navegador:

dilo.

No falsifiques gates para cerrar el milestone.

---

# 52. FINAL REPORT

Sólo después de completar los loops entrega:

## BUILD

Versión y build exactos.

## DIAGNOSIS

Qué impedía que las animaciones se sintieran de calidad.

## ARCHITECTURE

Qué contratos se conservaron/cambiaron.

## ANIMATION LIBRARY

Qué clips existen ahora.

Qué son:

```
external licensed
Arena original
retargeted
baked
additive

```

## COVERAGE

Estado de todas las animaciones por clase.

## IMPLEMENTED

Cambios sustanciales.

## FILES CHANGED

Lista concisa.

## TESTS

Conteos exactos.

## ARBITER

Ataques realizados, fallos encontrados y cómo se corrigieron.

## VISUAL CRITIC

Qué problemas visuales encontró y cuántas fix waves fueron necesarias.

## FRESH REVIEWER

Resultado.

## PERFORMANCE

Métricas reales disponibles.

## BROWSER

Indicar exactamente:

```
PASS
BLOCKED
MANUAL REQUIRED

```

sin maquillar el resultado.

## KNOWN LIMITATIONS

Sólo limitaciones genuinas no bloqueantes.

## NEXT MACRO MILESTONE

Uno solo.

No una lista de veinte tareas pequeñas.

---

# 53. REGLA FINAL

No quiero:

> “He mejorado las animaciones.”

Quiero poder observar:

```
un Devastador
un Guardián
un Centinela
un Rastreador
un Arcanista
un Vinculador

```

y sentir que cada uno:

```
TIENE PESO
TIENE POSTURA
TIENE ARMA
TIENE INTENCIÓN
TIENE TIMING
TIENE PERSONALIDAD

```

Cuando corre:

parece correr.

Cuando retrocede:

parece retroceder.

Cuando strafee:

parece desplazarse lateralmente.

Cuando salta:

parece despegar, estar en el aire y aterrizar.

Cuando ataca:

el cuerpo entero participa.

Cuando dispara:

el arco realmente se prepara y libera.

Cuando castea:

se planta y compromete su cuerpo.

Cuando RELEASE ocurre:

el cuerpo, el arma, el VFX y el gameplay hablan del mismo momento.

Cuando cancela:

se nota que la acción NO ocurrió.

Cuando recibe CC:

el cuerpo comunica qué le pasó.

Cuando muere:

no parece simplemente otro knockdown.

Y todo ello debe seguir obedeciendo:

> **RÁPIDO EN LAS MANOS. TÁCTICO EN LA CABEZA.**

---

# 54. START

Comienza ahora.

Primero:

```
1. inventaría completa de todos los .md y skills;
2. reconstruye el estado real del runtime;
3. ejecuta baseline;
4. genera la Animation Coverage Matrix;
5. identifica todos los placeholders y missing clips;
6. prioriza P0/P1 visuales;
7. construye la primera wave;
8. prueba;
9. captura;
10. arbitra;
11. corrige;
12. repite.

```

No pidas aprobación entre waves.

No vuelvas con una versión intermedia.

No defiendas una animación que visualmente no funciona.

El objetivo no es demostrar que el sistema puede animar un esqueleto.

El objetivo es que **Project Arena finalmente tenga personajes que se muevan y combatan como personajes de un videojuego terminado, y no como una demostración técnica de animación**.