# Arquitectura — Project Arena · Combat Lab 3D

Documento de referencia obligatorio antes de tocar código (documento de diseño §28).
Complementa a `Project_Arena_Combat_GameFeel_Concept_v0.2.docx`, no lo sustituye.

---

## 1. La regla que sostiene todo

> **La simulación es la única autoridad. La presentación sólo lee.**

Ningún fichero de `js/render/**` ni `js/ui/**` escribe en `hp`, `resource`,
`cooldowns`, `statuses`, `cast` ni en posiciones. La comunicación va en una sola
dirección:

```
INPUT → COMMAND → VALIDATION → CAST → IMPACT → RESOLUTION → EVENTS → PRESENTATION
```

El bus congela cada evento antes de emitirlo (`Object.freeze`), de modo que un
listener que intente escribir falla al instante en vez de corromper el estado en
silencio. Esta separación es lo que permitirá sustituir el renderer por Unity sin
rediseñar una sola regla de combate.

El jugador y los bots usan **exactamente la misma API**:
`Arena.Combat.AbilitySystem.tryUse(world, entity, abilityId, ctx)`.
Si algo se puede hacer desde `main.js` pero no desde la IA, es un privilegio
indebido y un bug.

---

## 2. Mapa de ficheros

```
index.html                 Combat Lab. Doble clic, sin servidor.
tests.html                 Batería de pruebas en navegador.
css/arena.css              HUD y panel de laboratorio.

js/namespace.js            Raíz global única (window.Arena) + registro de módulos.

js/math/                   Vectores, matrices, rayos. Sin dependencias.
  vec3.js                  Y = arriba, XZ = plano de juego.
  mat4.js                  Column-major, compatible con uniformMatrix4fv.
  ray.js                   AABB, cilindros, conos y expulsión de colisión.

js/core/                   Infraestructura sin reglas de juego.
  eventBus.js              Simulación → presentación. Estricto e inmutable.
  rng.js                   Determinista por semilla: un combate se reproduce.
  fixedTick.js             30 Hz exactos con protección anti espiral.
  entity.js                Estado del combatiente y agregación de modificadores.

js/data/                   TODO lo ajustable por un diseñador.
  balance.js               GCD, caps, DR, recursos, objetivos de ritmo.
  effects.js               Catálogo declarativo de estados.
  classes.js               Las seis subclases.
  abilities.js             Los 36 poderes activos, como datos puros.
  passives.js              Las seis pasivas, con ganchos explícitos.

js/combat/                 Las reglas. Aquí vive el documento hecho código.
  statusSystem.js          Aplicación, apilado, DR, cleanse, purga, periódicos.
  damageSystem.js          Mitigación, redirección, barreras, muerte.
  healingSystem.js         Curación, barreras, recursos.
  resolver.js              Orden de resolución obligatorio (§10, pasos 5–8).
  abilitySystem.js         Validación, GCD, casteo, cola, interrupción (§10, 1–4).

js/sim/                    Mundo y bucle.
  arena.js                 Geometría del escenario de pruebas.
  world.js                 Entidades, colisión, LoS, zonas, proyectiles, tick.

js/ai/dummyAI.js           Perfiles de dummy y bots de clase.

js/render/                 WebGL2 nativo. Sólo lectura.
  shaders.js               GLSL embebido como cadenas (no hay fetch en file://).
  primitives.js            Geometría procedural.
  camera3d.js              Tercera persona orbital con colisión.
  characterVisual.js       Humanoide procedural y animación.
  webglRenderer.js         Pipeline de cuatro pases.
  vfx.js                   Partículas dirigidas por eventos.
  picking.js               Selección, ciclo de objetivos y proyección a pantalla.

js/ui/                     DOM sobre el canvas.
  hud.js, combatLog.js, labPanel.js, tooltips.js

js/tests/                  Runner propio + batería obligatoria + balance.
js/main.js                 Arranque, entrada, escenarios, bucle.
tools/run-tests.js         Runner headless (Node) sobre los mismos ficheros.
tools/browser.js           Driver CDP para ejecutar el juego de verdad.
```

**Orden de carga**: etiquetas `<script src>` clásicas. Sin `import`/`export`, sin
`fetch`, sin npm. `Arena.define(nombre, deps, factory)` falla en el arranque si
falta una dependencia, en vez de romperse a mitad de partida.

`tests.html` declara el mismo bloque de simulación que `index.html`, y
`tools/run-tests.js` lee ese orden del propio HTML: el runner headless no puede
divergir de lo que se ejecuta en el navegador.

---

## 3. El orden de resolución (§10)

Cualquier alteración de este orden cambia el metajuego entero.

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `abilitySystem.canUse` | ¿Lanzador vivo y habilitado? |
| 2 | `abilitySystem.canUse` | ¿Recurso, GCD y cooldown disponibles? |
| 3 | `abilitySystem.canUse` | ¿Target válido, rango, orientación, línea de visión? |
| 4 | `abilitySystem._commit` | Casteo: iniciar, permitir interrupción, revalidar al terminar |
| 5 | `resolver.resolveHit` | **Estasis → Intervención → Reflejo → Bloqueo** |
| 6 | `damageSystem` / `healingSystem` | Mitigación, redirección, barreras, vida |
| 7 | `statusSystem.apply` | Estados permitidos, con DR |
| 8 | `resolver.effectHandlers` | Cleanse, purga, disparadores |
| 9 | `world.bus` | Eventos al renderer y al HUD |

Las habilidades marcadas como proyectil **resuelven al impacto, no al lanzar**:
es lo que da ventana real a los counters y lo que hace que la distancia se sienta.

---

## 4. Reglas de apilado (§7)

| Canal | Regla | Tope |
|---|---|---|
| Slow | el más fuerte, nunca la suma | 60 % |
| Reducción de defensa | acumulativa | 40 % |
| AntiHeal | el más fuerte | 60 % |
| Daño recibido | aditivo | −75 % / +60 % |
| Barreras | del mismo poder, la mayor; de poderes distintos, suman | — |
| Control | una sola instancia por tipo, gana la de mayor duración restante | DR |

Identidad de una instancia de estado:
* **CC** → clave sólo por tipo. Dos Noqueos simultáneos jamás se apilan.
* **Resto** → clave por (efecto, habilidad, lanzador). Dos Vinculadores mantienen
  su propio HoT; uno solo no duplica el suyo.

---

## 5. Decisiones tomadas sobre las preguntas abiertas del documento (§30)

El documento deja ocho decisiones sin cerrar. Éstas son las tomadas, con su motivo.
Todas están además comentadas en el punto del código donde viven.

| Pregunta abierta | Decisión | Motivo |
|---|---|---|
| ¿AntiBuff bloquea también Cleanse? | **Sí** | Si no, un soporte lo anula al instante y el poder deja de ser una ventana real de presión. A cambio, AntiBuff no es disipable, no se apila y dura poco. |
| ¿Los poderes dañinos protegidos por Intervención conservan su CC? | **Sí, se resuelve todo** | Intervención define su frontera por el *payload*, no por el efecto: o pasa entera o no pasa. Media resolución sería imposible de leer en combate. |
| ¿El Guardián refleja sólo magia? | **Sólo magia dirigida de objetivo único** | Reflejar proyectiles físicos dejaría sin ventana al Centinela, su contrapartida natural. |
| Ataque normal: ¿auto-repeat o manual? | **Auto-repeat conmutable (tecla T)** | Es el latido del ritmo; obligar a pulsarlo convertiría el combate en spam de clic. No consume GCD. |
| ¿DR como regla competitiva o de modo? | **Interruptor de laboratorio, activado por defecto** | El documento lo pide explícitamente como toggle para comparar MMO clásico y moderno. |
| Resistencias y bloqueo | **Deterministas** | §19 pide RNG desactivado en la fase de game feel. El RNG existe como interruptor, apagado por defecto. |
| Validación de orientación | **Auto-encarar en objetivo único; cono real en AoE** | Rechazar una habilidad porque el personaje mira 10° de más rompe "respuesta inmediata". La orientación sigue decidiendo donde importa: los conos. |
| Ataque normal a distancia | **Impacto inmediato, sin proyectil** | El ataque normal es el latido y debe ser predecible; sólo las habilidades marcadas viajan. |

### Divergencias numéricas respecto al documento

Todas están comentadas en el código, en el punto exacto donde se aplican:

| Valor | Documento | Aquí | Motivo |
|---|---|---|---|
| Armadura del Guardián | "muy alta" (tramo 120) | 100 | Con 120 el 1v1 contra un Devastador se iba a ~50 s y dejaba de ser un combate. |
| Pulso vital, recarga | 5 s | 0 s, coste 24 | Con recarga, el Vinculador nunca se quedaba seco y su límite pasaba a ser un temporizador en vez de una decisión de recurso. |
| Golpe quebrador, recarga | 14 s | 9 s | El kit del Devastador se quedaba sin botones y pasaba media pelea sólo con ataque normal, en contra de §3 y §19. |
| Embestida brutal, slow | 25 % / 1.5 s | 30 % / 2.5 s | Con 1.5 s el objetivo a distancia recuperaba el hueco antes del primer golpe: la carga alcanzaba pero no amenazaba. |
| Velocidad de las clases a distancia | 6.0 común | 5.7–5.82 | Con velocidad idéntica un melee no cierra distancia nunca y el duelo se eterniza. |
| Coeficiente del ataque normal | — | 0.62 → 0.78 | Los huecos entre cooldowns se sentían muertos. |

---

## 6. Verificación

```bash
node tools/run-tests.js        # 80 pruebas, headless
node tools/browser.js smoke    # arranca el juego real y reporta errores
```

También `tests.html` en el navegador, y el botón *Abrir batería de pruebas* del
panel de laboratorio.

La batería cubre:
* Los 11 tests obligatorios del §26.
* Fórmulas, caps y reglas de apilado del §7.
* Orden de resolución y counters del §9–§10.
* Ritmo, GCD, cola de input e interrupción del §6.
* Targeting, rango, LoS y movimiento del §5.
* Diminishing Returns del §11.
* **Objetivos de ritmo del §19 medidos por simulación**: TTK de duelos completos
  entre bots, ventana de presión normal, burst máximo, valor del soporte y
  límite de recurso. No son comprobaciones de fórmula: simulan combates enteros
  y fallan si el ritmo se sale de márgenes.

---

## 7. Cómo añadir contenido

**Un poder nuevo** se escribe como datos en `js/data/abilities.js`. El motor ya
implementa los efectos genéricos una sola vez en `resolver.js`
(`physicalDamage`, `magicalDamage`, `heal`, `barrier`, `hot`, `dot`, `status`,
`cleanse`, `purge`, `interrupt`, `dash`, `zone`, `reveal`, `conditional`,
`restoreResource`, `drainResource`). Escribir código especial es la excepción, no
la regla, y hay un test que falla si un poder declara un tipo no implementado.

**Un estado nuevo** se declara en `js/data/effects.js`: qué impide, cómo se
disipa, en qué categoría de DR cae y por qué canales modifica las estadísticas.
La lógica no se toca.

**Regla de trabajo** (documento §28): toda modificación de lógica de combate
añade o actualiza un test, y la batería tiene que quedar en verde antes de
seguir.

---

## 8. Ruta a Unity (§27)

Lo que debe sobrevivir al port no es el JavaScript, sino la especificación:

| Aquí | En Unity |
|---|---|
| `Arena.Data.abilities` / `classes` | ScriptableObjects o JSON importado |
| `Entity` | Clase C# pura, sin MonoBehaviour |
| `FixedTick` | Servicio de simulación autoritativo |
| Cola de comandos | Input commands / network commands |
| `EventBus` | Eventos C# |
| `webglRenderer` / `Camera3D` | GameObjects, Animator, VFX Graph |
| `Ray` / LoS matemático | Physics.Raycast, colliders, NavMesh |
| `dummyAI` | State machine / Behaviour tree |
| `js/tests/**` | EditMode / PlayMode tests |

Si los datos, las reglas y los casos de prueba son estables, el port es una
reimplementación controlada y no un rediseño.
