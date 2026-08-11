# De WebGL2 procedural a mallas reales

Este documento describe **qué habría que implementar** para sustituir la
presentación procedural por modelos con skinning, y **qué no debe tocarse al
hacerlo**. No describe nada que ya esté implementado: hoy sólo existe el backend
procedural, y este texto es el plano de lo que vendría después.

---

## 1. Por qué la migración es posible sin tocar el combate

El motor está partido en tres capas con una frontera explícita:

```
SIMULACIÓN            reglas, daño, control, cooldowns, posición real
      ↓  (eventos + estado, sólo lectura)
AnimationIntent       QUÉ quiere representar el personaje
      ↓
CharacterBackend      CÓMO se convierte eso en píxeles
```

`AnimationIntent` (`js/anim/animationIntent.js`) está deliberadamente **fuera de
`js/render/`**. No menciona WebGL, ni matrices, ni mallas. Un test lo verifica
(`la intención no depende de WebGL ni de geometría`), porque una dependencia
accidental ahí es lo que convierte una migración de dos semanas en una
reescritura.

Sustituir el renderer significa escribir un backend nuevo. No significa tocar
`js/combat/**`, `js/sim/**` ni `js/core/**`.

---

## 2. Qué tendría que implementar `ThreeSkinnedCharacterVisual`

Un backend cumple el contrato de `js/render/characterBackend.js`:

| Método | Responsabilidad con malla real |
|---|---|
| `buildMeshes()` | cargar el `.glb` una vez y devolver los recursos compartidos |
| `createCharacter(entity)` | instanciar `SkinnedMesh`, clonar el esqueleto, crear el `AnimationMixer` |
| `updateCharacter(h, e, dt, world)` | construir el `AnimationIntent` y traducirlo a pesos de blend |
| `buildPose(out, h, e, pos, yaw, pal)` | actualizar la matriz raíz; el skinning lo hace la GPU |
| `destroyCharacter(h)` | liberar geometría, materiales y el mixer |
| `paletteFor` / `archetypeOf` | igual que hoy: color de bando y arquetipo |
| `intentOf(h)` | devolver la intención, para depuración |

Y se activa con una línea:

```js
Arena.Render.CharacterBackend.use(ThreeSkinnedCharacterVisual);
```

`webglRenderer.js` no cambia: ya habla con `Backend.current`, nunca con el
humanoide procedural.

### Traducción intención → blend tree

La intención está diseñada para alimentar un árbol de mezcla estándar:

| Campo del intent | Consumo en un árbitro de animación |
|---|---|
| `moveForward` / `moveRight` / `speedNormalized` | blendspace 2D de locomoción |
| `locomotion` | selección de clip cuando no hay blendspace |
| `gait` | mezcla andar ↔ correr |
| `turnRate` | clips de giro en el sitio |
| `actionFamily` + `actionPhase` + `actionProgress` | capa de tren superior |
| `castFamily` + `castPhase` + `castProgress` | variantes de casteo |
| `allowMovementDuringAction` | si la capa superior enmascara o no las piernas |
| `hitReaction` | capa aditiva |
| `crowdControl` | override de cuerpo completo |

### Contrato de esqueleto

`js/render/anim/skeleton.js` ya declara los nombres que debe tener el rig
importado: `ROOT`, `PELVIS`, `SPINE_01/02`, `CHEST`, `NECK`, `HEAD`,
`CLAVICLE_*`, `UPPER_ARM_*`, `LOWER_ARM_*`, `HAND_*`, `THIGH_*`, `CALF_*`,
`FOOT_*`, más los sockets `SOCKET_WEAPON_R/L`, `SOCKET_SHIELD`, `SOCKET_BACK`,
`SOCKET_HEAD`, `SOCKET_PROJECTILE`.

Si el rig exportado usa otros nombres, **no se renombra el proyecto**: se escribe
una tabla de equivalencia en el backend nuevo. Renombrar en masa toca ficheros
que no tienen por qué enterarse de qué software exportó la malla.

### Reglas que el backend nuevo hereda y no puede romper

1. **Nada de root motion para mover la entidad.** La posición la decide la
   simulación. Si un clip lleva desplazamiento incorporado, se desactiva al
   importarlo.
2. **La animación no decide impactos.** El daño ya está resuelto cuando llega el
   evento; la animación sólo elige cuándo se ve.
3. **Nada de `Math.random()`** en nada que altere lo que el jugador interpreta.
4. **Los VFX se enganchan a sockets**, no a huesos.
5. **La cámara no cambia.** `camera3d.js` es independiente del backend.

---

## 3. Ruta a Unity

Unity sería el **cliente**, nunca el dueño de las reglas. Dos opciones, sin
decidir todavía:

**Opción A — Port de la simulación a C#.** `js/combat/**`, `js/sim/**` y
`js/core/**` son JavaScript sin DOM ni dependencias: se traducen casi línea a
línea. La batería de 134 pruebas se traduce con ellos y es la que demuestra que
el port no cambió el juego.

**Opción B — Servidor autoritativo en JavaScript.** Unity recibe estado y
eventos y sólo presenta. Es lo que la arquitectura ya hace hoy, con la frontera
en la red en vez de en la llamada a función.

### Equivalencias aproximadas

| Hoy | Unity |
|---|---|
| `core/entity.js` | struct/clase de estado, sin `MonoBehaviour` |
| `core/fixedTick.js` | bucle fijo propio, **no** `FixedUpdate` |
| `combat/abilitySystem.js` | sistema puro, sin componentes de escena |
| `combat/statusSystem.js`, `resolver.js` | idem |
| `core/eventBus.js` | cola de eventos tipada |
| `anim/animationIntent.js` | struct que alimenta el `Animator` |
| `render/characterBackend.js` | `MonoBehaviour` que aplica parámetros al `Animator` |
| `data/**` | `ScriptableObject` |

El punto de la tabla: **la mitad izquierda no depende de Unity**. La única capa
que se reescribe entera es la de presentación, que es justo la que se quería
poder cambiar.

---

## 4. Qué NO hacer al migrar

- No mover reglas de combate a `MonoBehaviour` ni a componentes de escena.
- No usar `FixedUpdate` como reloj de simulación: su cadencia depende de la
  configuración del proyecto y del framerate real.
- No dejar que un `AnimationEvent` aplique daño.
- No introducir dependencias en `anim/animationIntent.js`.
- No convertir el juego en action combat sin objetivo: sigue siendo un MMORPG
  PvP target-based.
