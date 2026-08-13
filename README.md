# Project Arena · Ladder PvP Vertical Slice

## Alpha v0.8 · Product Loop Integration

La versión hospedada usa Three.js vendorizado y mantiene el núcleo de simulación independiente.
Esta iteración conserva el **Animation Reference Pass v0.7** y añade el loop de producto competitivo: lobby, selección de las seis clases, Training Lab, 1v1 Ladder local, 2v2, countdown, resultados, rating/placements persistentes y rematch.

La regla central sigue intacta: **la simulación decide; Three.js, UI y Product Flow representan/orquestan**.

Validación de entrega: `node tools/run-tests.js`, `node tools/arbiter.js` y `node tools/visual-audit.js`.


Prototipo jugable del combate de un MMO PvP de fantasía en tercera persona.
**HTML, CSS y JavaScript con presentación Three.js vendorizada y fallback WebGL2. Sin npm ni build step.**

En Hostinger se sirve `index-three.html` con Three.js vendorizado. `index.html` conserva la ruta de compatibilidad/fallback.

> *"Si el combate es divertido en una sala gris con personajes genéricos, existe
> una base real sobre la cual construir el juego."*


---

## Documentos de ejecución autónoma

Antes de pedir a un agente una macro-iteración del Arena Ladder PvP, debe leer en este orden:

1. [`CLAUDE.md`](CLAUDE.md) — constitución y reglas globales.
2. [`AGENTS.md`](AGENTS.md) — fan-out, ownership e integración.
3. [`ARENA_VERTICAL_SLICE_SPEC.md`](ARENA_VERTICAL_SLICE_SPEC.md) — objetivo de producto completo.
4. [`QA_GATE.md`](QA_GATE.md) — gates automáticos, adversariales, visuales y de rendimiento.

Estos documentos convierten el proyecto en un flujo de trabajo de largo horizonte: **planificar → paralelizar → construir → integrar → probar → criticar → corregir → repetir**.

---

## Empezar

| Quiero… | Abre |
|---|---|
| Jugar | `index.html` |
| Ver que las reglas se cumplen | `tests.html` |
| Verificar sin navegador | `node tools/run-tests.js` |
| Entender el código antes de tocarlo | [`ARCHITECTURE.md`](ARCHITECTURE.md) |

## Controles

| Acción | Tecla |
|---|---|
| Mover | `W/S` frente/atrás · `A/D` strafe relativo al personaje |
| Girar personaje | `Q/E` o arrastre con **click izquierdo** 1:1 |
| Free-look | mantener **click derecho**; sólo gira cámara |
| Cámara | rueda para zoom |
| Saltar | `Espacio` |
| Seleccionar objetivo | clic · `Tab` enemigos · `⇧Tab` aliados |
| Seleccionarte a ti | `F` |
| Habilidades | `1` … `6` |
| Ataque normal | `T` |
| Cancelar casteo | `Esc` |
| Reiniciar escenario | `R` |

---

## Qué hay dentro

**Seis subclases**, cada una con 6 habilidades activas y 1 pasiva, y con un
papel que ninguna otra cubre igual:

| Subclase | Rol | Lo que sólo ella hace |
|---|---|---|
| **Devastador** | Burst melee / iniciación | Derribo, ruptura de armadura y purga en cuerpo a cuerpo |
| **Guardián** | Protección / peel | Bloqueo determinista, reflejo mágico y redirección de daño |
| **Centinela** | Daño físico a distancia | Alcance largo, penetración de armadura y estasis a distancia |
| **Rastreador** | Control táctico | Sigilo, trampas, antiheal y bloqueo de utility enemiga |
| **Arcanista** | Burst mágico / anti-soporte | Root, estasis y AntiBuff |
| **Vinculador** | Curación / counters | Barreras, cleanse, Intervención y enlace protector |

**Sistemas de combate implementados**

* Orden de resolución obligatorio: Estasis → Intervención → Reflejo → Bloqueo →
  mitigación → estados → cleanse/purga.
* Taxonomía completa de control: noqueo, aturdimiento, mareo, enraizar,
  desarmar, estasis, bloqueo de utility, slow, rotura de defensa, AntiHeal y
  AntiBuff, cada uno con sus reglas propias de apilado y disipación.
* Diminishing Returns por categoría, con interruptor para comparar el estándar
  moderno con la cadena de control larga del MMO clásico.
* GCD en tres tramos, cola de input de 200 ms, interrupción con bloqueo de
  escuela, y casteos que se cancelan al moverse.
* Línea de visión por raycast, rango medido en el plano, colisión contra muros y
  entre personajes, proyectiles que resuelven al impactar.

**Loop Ladder / Combat Lab**

El arranque entra ahora en un lobby de producto con las seis clases, resumen del kit, perfil Ladder y elección 1v1/2v2. El flujo competitivo es:

`LOBBY → COUNTDOWN → ACTIVE → RESULTS → REMATCH / LOBBY`

Training conserva los escenarios de laboratorio (sacos de daño, duelo, 2v2, counters y Timing Lab) y los controles de DR, RNG, cooldowns, recurso, IA, invulnerabilidad, telegraphs y cámara lenta.

La IA dispone de perfiles explícitos de presión melee, kiter, caster de control, soporte sanador, peel defensivo y sparring Ladder. Los bots giran mediante el límite de la simulación y no reciben auto-face instantáneo privilegiado.

Registro de combate con marca de tiempo de simulación y copia al portapapeles:
cualquier secuencia rara se puede reproducir y pegar en un informe.

---

## Verificación

```bash
node tools/run-tests.js      # 215 pruebas
node tools/arbiter.js        # gates adversariales de autoridad/RELEASE/producto
node tools/visual-audit.js   # critic estático Three.js + UI + assets
node tools/browser.js smoke  # smoke real cuando Chromium permite localhost/HTTP local
```

Las pruebas no comprueban sólo fórmulas. Los objetivos de ritmo del documento
—tiempo hasta la muerte, ventana de burst, cadenas de control, valor del
soporte— se verifican **simulando combates completos entre bots** y fallan si el
ritmo se sale de márgenes. Un ajuste de números que rompa el juego no pasa
inadvertido.

El runner headless lee el orden de carga del propio `tests.html`, así que no
puede divergir de lo que se ejecuta en el navegador.

---

## Estado y siguiente milestone

El repositorio ya contiene el **Vertical Slice local de producto** sobre el núcleo Tactical Rhythm: simulación fija, seis clases, bots, arena, Three.js, animación procedural, VFX, audio, HUD, Training, 1v1/2v2, resultados y Ladder local reemplazable.

Deliberadamente fuera del slice local: producción online autoritativa, matchmaking real, cuentas remotas, mundo abierto, quests, economía, loot y monetización.

El próximo milestone de producto es validar visualmente v0.8 en navegador no administrado, realizar playtests humanos del loop completo y, después, decidir entre profundizar el backend GLB/skinned en Three.js o iniciar la migración visual a Unity manteniendo la simulación y contratos ya validados.
