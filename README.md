# Project Arena Ladder PvP

## Alpha v0.16 · UAL2 Retarget Locomotion

Esta wave integra la biblioteca de animaciones suministrada sobre el Elfo Oscuro skinned de 50k sin entregar autoridad a los clips. UAL2 aporta idle corporal, marcha forward/backpedal base, salto, recoil de impacto y familias melee; caster y arquero conservan sus gestos específicos de báculo/casteo y arco/draw.

También corrige dos defectos visibles del build anterior:

- piel facetada → normales suaves recalculadas en runtime;
- controles → `A/D = strafe`, `Q/E = giro`.

El retarget se realiza por delta de rotación desde el bind de la librería al **bind local real del Dark Elf**. El root motion del asset nunca mueve la entidad de simulación.

**QA:** 383/383 tests · UAL2 audit 24/24 · power parity 20/20 · 12/12 auditores especializados · ARBITER v0.16 APROBADO · VISUAL CRITIC estático APROBADO. El browser smoke local sigue bloqueado por política del entorno y el juicio visual final debe cerrarse en Hostinger.

Ver `CURRENT_BUILD_STATE.md`, `docs/ANIMATION_INTEGRATION_V016.md`, `docs/BUILD_REPORT_V016.md` y `docs/QA_BROWSER_POLICY_BLOCK_V016.png`.

---

# Project Arena · Ladder PvP Vertical Slice

## Alpha v0.11 · Character & Animation / Power Fidelity

Esta wave parte de v0.10 sin reescribir el núcleo validado y ataca los tres defectos visibles del playtest: anatomía procedural demasiado ortogonal, lenguaje corporal repetitivo y iconografía masiva poco diferenciada. También endurece la paridad mecánica de la biblioteca completa de poderes.

**Regla inviolable:** la simulación decide; Three.js, UI, libro de poderes y Product Flow sólo representan/orquestan.

### Qué cambia en v0.11

- **320 registros fuente auditados** → **290 poderes reales** + **30 placeholders `undefined` descartados** de forma explícita.
- **410 asignaciones a las seis subclases** al compartir las ramas base: Devastador 65, Guardián 65, Centinela 65, Rastreador 65, Arcanista 75 y Vinculador 75.
- **344 poderes activos + 66 pasivos** derivados de la fuente, todos con nombre e iconografía originales de Project Arena.
- Daño de esta expansión **fijo y determinista (`pure`)**. Fórmulas de armadura/resistencias para estos poderes quedan deliberadamente para la siguiente fase de balance.
- Libro de poderes con búsqueda y disciplinas; los activos se pueden **arrastrar** a la barra y los pasivos se muestran pero no se arrastran.
- **4 barras × 12 slots** persistentes por subclase.
- El caster puede **girar mientras castea**. Moverse o saltar sigue cancelando antes de `RELEASE` sin coste/cooldown fantasma.
- Arena `El Foso de Ceniza · Frontera`: **86 × 62**, 66 obstáculos, 4 plataformas y rutas exteriores simétricas para kite, flank y LoS.
- **Modelos:** anatomía curva con elipsoides/cápsulas, equipo crítico rehecho y toro real para aros/coronas.
- **Animación:** siete familias caster, cuatro familias de arquero y lenguaje guerrero diferenciado, siempre subordinados a `AnimationIntent`/`RELEASE`.
- **Iconografía:** las 410 asignaciones poseen firma y SVG visible globalmente únicos.
- **Fidelidad:** cast, GCD, cooldown y duración rank-5 quedan protegidos por pruebas; mecánicas especiales/lockouts se traducen a datos.
- Diez agentes/revisores especializados + árbitro adversarial v0.11.

El documento fuente se usa como procedencia mecánica. Los nombres, descripciones e iconos se sustituyen por identidad original de Arena; v0.11 preserva cast, categoría GCD, cooldown y duración rank-5, además de las magnitudes funcionales que tienen canal equivalente. El daño de la expansión sigue fixed/pure por decisión explícita del milestone y las fórmulas de armadura quedan diferidas.

---

## Documentos de ejecución autónoma

Antes de una macro-iteración:

1. [`CLAUDE.md`](CLAUDE.md)
2. [`AGENTS.md`](AGENTS.md)
3. [`ARENA_VERTICAL_SLICE_SPEC.md`](ARENA_VERTICAL_SLICE_SPEC.md)
4. [`QA_GATE.md`](QA_GATE.md)
5. [`ARCHITECTURE.md`](ARCHITECTURE.md)
6. [`CURRENT_BUILD_STATE.md`](CURRENT_BUILD_STATE.md)

Flujo: **planificar → construir → probar → criticar → corregir → repetir**.

---

## Empezar

| Quiero… | Abre / ejecuta |
|---|---|
| Jugar | `index.html` |
| Ver reglas en navegador | `tests.html` |
| Suite headless completa | `node tools/run-tests.js` |
| Agentes especialistas | `node tools/run-agents.js` |
| Árbitro adversarial | `node tools/arbiter.js` |
| Critic visual estático | `node tools/visual-audit.js` |
| Gates sin navegador | `node tools/run-gates.js --rapido` |
| Gates con navegador | `node tools/run-gates.js` |

## Controles

| Acción | Tecla |
|---|---|
| Mover | `W/S` frente/atrás · `A/D` strafe |
| Girar personaje | `Q/E` o arrastre con click izquierdo |
| Free-look | mantener click derecho |
| Cámara | rueda para zoom |
| Saltar | `Espacio` |
| Objetivo | clic · `Tab` enemigo · `⇧Tab` aliado |
| Self target | `F` |
| Slots activos | `1 2 3 4 5 6 7 8 9 0 - =` |
| Cambiar barra | `Shift+1` … `Shift+4` |
| Libro de poderes | `B` |
| Ataque normal | `T` |
| Cancelar casteo / cerrar libro | `Esc` |
| Reiniciar escenario | `R` |

---

## Las seis subclases

| Subclase | Hereda | Especialización | Poderes fuente traducidos |
|---|---|---|---:|
| **Devastador** | Guerrero | Bárbaro | 65 |
| **Guardián** | Guerrero | Caballero | 65 |
| **Centinela** | Arquero | Tirador | 65 |
| **Rastreador** | Arquero | Cazador | 65 |
| **Arcanista** | Mago | Brujo | 75 |
| **Vinculador** | Mago | Conjurador | 75 |

Las ramas base Guerrero/Arquero/Mago aparecen en ambas especializaciones de su familia, por eso hay **410 asignaciones de clase** a partir de **290 poderes fuente reales**.

La traducción cubre daño directo y DoT fijo, hard/soft CC, barreras, curación, recurso, buffs/debuffs, cleanse/purge, stealth/reveal, santuario, reflejo, redirección, auras, revive y compañeros/invocaciones. Los 30 encabezados `undefined` de las tablas Warmaster se diagnostican y excluyen; no se fabrican habilidades inexistentes para inflar la cifra.

---

## Powerbook y barras

`B` abre el libro. Cada entrada muestra icono, nombre fuente con variación rastreable, disciplina, tipo y resumen mecánico. Los poderes activos se arrastran a cualquiera de los 48 slots; click derecho limpia un slot. Las cuatro páginas son independientes y persisten por subclase.

Contrato:

`POWERBOOK → DRAG INTENT → ACTION BAR STATE → INPUT → COMMAND → VALIDATION → ACTION STATE → RELEASE → RESOLUTION`

La UI nunca modifica HP, recurso, cooldown, GCD o estados directamente.

---

## Casteo v0.11

El caster debe estar plantado para mantener el cast, pero **orientar el cuerpo/cámara no es movimiento**. Girar no cancela `PREPARE/CASTING`; caminar o saltar sí. Antes de `RELEASE`, cancelar devuelve la acción sin pagar recurso, cooldown ni GCD. En `RELEASE` se vuelve a validar rango, LoS y facing cuando la habilidad lo requiere.

---

## Arena ampliada

`El Foso de Ceniza · Frontera` mide **86 × 62** y preserva el núcleo del duelo, añadiendo un anillo exterior de cobertura y rutas de flanqueo. El análisis del mismo `sim/arena` usado por la simulación verifica:

- simetría 180°;
- una sola región navegable;
- separación de spawn táctica;
- cobertura a ≤4 u por encima del suelo mínimo de QA;
- LoS suficiente para ranged sin convertir el mapa en una explanada;
- loops centrales cerrados para kite y reposicionamiento.

---

## QA v0.11

La expansión tiene pruebas específicas que verifican, entre otros contratos:

- cobertura 320 → 290 → 410;
- los 290 índices fuente reales aparecen en runtime;
- ningún placeholder llega al juego;
- todo poder activo tiene implementación ejecutable;
- los **344 activos** recorren `request → RELEASE` sin excepción;
- los pasivos no se pueden usar como activos;
- los iconos generados son únicos por subclase;
- resistencias de CC no se traducen por error como auto-CC;
- el giro no cancela cast, el movimiento sí;
- 4×12 exacto, páginas independientes y asignaciones inválidas rechazadas;
- arena grande, simétrica, conectada y con cobertura.

El fan-out ejecutable está en `tools/agents/`. El árbitro `tools/arbiter.js` intenta romper autoridad, RELEASE, cancelaciones, catálogo, action bars, caster y mapa.

---

## Estado honesto

El milestone de **poderes + powerbook + arena ampliada** queda cerrado por gates headless y árbitro. Permanecen dos verificaciones externas del baseline que un proceso headless no puede convertir honestamente en verde:

1. **Pointer Lock**: `MANUAL_BROWSER_REQUIRED` en navegador desplegado (`docs/POINTER_LOCK_MANUAL.md`).
2. **Playtest humano** de 10–15 min (`docs/PLAYTEST_CHECKLIST.md`).

Además, el objetivo de 60 FPS debe volver a medirse en GPU real después de esta ampliación; no se inventa una cifra de FPS desde un entorno sin GPU.


## v0.16 · UAL2 Retarget Locomotion

La biblioteca UAL2 Standard suministrada por el usuario se integra como animación de presentación: idle corporal, marcha forward/backpedal, salto, recoil de impacto y familias melee. El root motion del asset se descarta; posición/yaw siguen siendo autoridad de simulación. A/D = strafe, Q/E = giro. La piel del GLB se suaviza recalculando normales en runtime.
