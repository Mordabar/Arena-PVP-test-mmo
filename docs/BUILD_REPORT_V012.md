# BUILD REPORT · Project Arena v0.12

**Milestone:** ELEMENTAL SPELL / ANIMATION / CAMERA FIDELITY PASS  
**Fecha:** 2026-08-14

## 1. Diagnóstico

El problema no era que el catálogo estuviera vacío: v0.11 ya podía enumerar las 290 habilidades fuente reales. El problema era de **fidelidad perceptual y semántica**. Poderes emblemáticos del Brujo podían existir como filas genéricas sin comunicar “bola de fuego”, “relámpago”, “explosión de hielo” o “meteorito”; además varios tipos de área se reducían a ground/self AoE aunque la referencia es target-based.

La captura desplegada entregada por el usuario mostró un segundo problema operativo: la cabecera decía **ALPHA 0.8**, por lo que Hostinger estaba sirviendo una build anterior o caché obsoleta.

## 2. Arquitectura

### Poderes

Se conserva la arquitectura data-driven y se amplía cada poder con `presentation`:

- `element`
- `shape`
- `iconShape`
- `spellGesture`
- `intensity`
- `impactRadius`

Se añade `targetArea` como tipo de objetivo autoritativo para AoE centradas en objetivo seleccionado.

Los proyectiles siguen la frontera:

`RELEASE → spawnProjectile → ProjectileHit → Resolver.execute(fromProjectile)`

Por tanto, una bola de fuego no hace daño al comenzar ni al dibujarse.

### Animación

`AnimationIntent` conserva la autoridad neutral y transporta `spellGesture`. El caster dispone de gestos distintos de hurl, freeze, lightning, storm, ground, shadow/drain, ward/heal, bind y summon.

### Cámara

Q/E ya no dejan la cámara atrás. Tras el fixed tick, la cámara copia el delta de yaw que la simulación aceptó. Left-drag conserva 1:1 cuerpo+cámara y right-drag sigue siendo free-look.

## 3. Implementado

- 320 registros fuente procesados.
- 290 poderes reales; 30 placeholders Warmaster `undefined` excluidos.
- 410 asignaciones de subclase.
- 344 activos + 66 pasivos.
- 410 contratos `sourceMechanics`.
- 410 contratos `presentation`.
- 410 firmas SVG globalmente únicas.
- Arcanista página 1 prioriza 12 poderes firma.
- Fireball target-centered + projectile impact real.
- Ice blast slow 40 % durante exactamente 2 s.
- Lightning 5 s de daño periódico fijo.
- Meteor con gesto/telegraph/impacto desde arriba.
- Frozen storm usa `stun`, no `sourceDaze`.
- Magma separa impacto de quemadura 15 s.
- Tornado target-centered + root 9 s.
- Lightning storm AoE self 10u/10s.
- Gramática VFX ampliada: control seals, wards/heal, rituals/summons, drains, elemental storms, impacts.
- Weapon skills físicos dejan de recibir sello mágico genérico.
- Cuerpo procedural con anatomía curva y materiales diferenciados.
- Cache stamp nuevo y `Arena.VERSION=0.12.0`.

## 4. Ficheros principales cambiados

- `tools/generate-power-library.py`
- `js/data/powerLibrary.js`
- `js/combat/abilitySystem.js`
- `js/combat/resolver.js`
- `js/sim/world.js`
- `js/render/vfx.js`
- `js/render/three/threeVfx.js`
- `js/render/anim/actions.js`
- `js/anim/animationIntent.js`
- `js/render/characterVisual.js`
- `js/ui/abilityIcons.js`
- `js/ui/actionBarState.js`
- `js/render/camera3d.js`
- `js/main.js`
- `js/namespace.js`
- `index.html`
- `tools/arbiter.js`
- `tools/run-agents.js`
- `tools/agents/*`
- `js/tests/powerExpansionTests.js`
- `js/tests/controlTests.js`

## 5. Tests

Último gate:

- **332 / 332 pruebas verdes.**
- Smoke exhaustivo: **344 / 344 poderes activos alcanzan RELEASE** en fixture válido.
- Nuevas regresiones emblemáticas: fireball projectile/AoE, lightning DoT, magma impact+DoT, ice storm stun y featured loadout.

## 6. Agentes

**14 / 14 APROBADOS**:

1. Power Catalog
2. Power Fidelity
3. Elemental Spells
4. Caster Gamefeel
5. Camera Comfort
6. Character Model
7. Animation
8. Iconography
9. Semantic VFX
10. Actionbar / Powerbook
11. World / Map
12. Presentation Critic
13. Integration / QA
14. Fresh Reviewer

## 7. Árbitro

**ARBITER: APROBADO.**

El árbitro intenta romper explícitamente:

- BEGIN vs RELEASE;
- cancelación pre-release;
- projectile impact vs fake RELEASE impact;
- targetArea;
- slow de 2 s;
- Aturdir vs Marear;
- magma instantáneo + periódico;
- camera follow Q/E post-simulación;
- left steer 1:1 y right free-look;
- autoridad presentación/simulación;
- versionado/cache de Hostinger.

## 8. Visual / mundo

**VISUAL CRITIC estático: APROBADO.**

Arena: **86 × 62**, 66 obstáculos, 4 plataformas. Cobertura ≤4u: **67.3 %**. Pares con LoS: **33.8 %**.

Silueta: la peor pareja en frontal continúa por encima del suelo de identidad (**18.4 %**, Centinela/Rastreador). En otras vistas el mínimo sube.

## 9. Browser gate

Se ejecutó el smoke usando `/usr/bin/chromium`. Chromium arranca, pero una política organizacional bloquea `127.0.0.1` antes de cargar Arena. No se marca como aprobado.

Evidencia: `docs/QA_BROWSER_POLICY_BLOCK_V012.png`.

`tools/browser.js` ahora busca automáticamente Chromium real si la ruta histórica de Playwright no existe.

## 10. Research de assets

Se verificaron opciones CC0 para el salto futuro a skinned meshes:

- Quaternius Universal Base Characters.
- Quaternius Universal Animation Library 1/2.
- Quaternius Modular Character Outfits Fantasy.
- KayKit Adventurers + Character Animations.

Detalle: `docs/V012_ASSET_RESEARCH.md`.

No se empaqueta un tercero de 100+ MB sin definir previamente backend GLTF/skinned, presupuesto de descarga y retargeting. v0.12 mejora la representación actual sin acoplar simulación.

## 11. Limitaciones honestas

- Pointer Lock continúa `MANUAL_BROWSER_REQUIRED` hasta probar en HTTPS real.
- 60 FPS no se afirma: este contenedor no dispone de una GPU representativa.
- La representación sigue siendo procedural; es mucho menos box-on-box, pero no es todavía un personaje skinned de producción.
- Fórmulas físicas/mágicas/armadura siguen diferidas; el daño importado permanece fixed/pure por contrato del milestone.

## 12. Próximo gate externo

Desplegar **v0.12 limpio** y comprobar `ALPHA 0.12`, `Arena.VERSION === "0.12.0"`, luego realizar playtest humano de poderes emblemáticos, cámara y lectura de modelos.
