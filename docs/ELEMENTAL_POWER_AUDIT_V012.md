# Project Arena v0.12 — Elemental Power Fidelity Audit

## Objetivo

Esta wave corrige el problema más visible del build previo: la biblioteca estaba completa en cantidad, pero varios poderes emblemáticos del arquetipo Brujo no se leían como lo que hacían. v0.12 conserva el contrato mecánico fuente y crea nombres, iconos, gestos y VFX originales de Arena.

## Fuente

Documento maestro Champions of Regnum v1.35.19: 320 registros. El generador identifica 290 poderes con nombre real y 30 placeholders `undefined` de ramas Warmaster. Los placeholders no se convierten en habilidades ficticias.

El runtime contiene 410 asignaciones entre las seis subclases porque las ramas base se comparten entre especializaciones.

## Hechizos firma del Arcanista

| Índice fuente | Arena v0.12 | Cast | GCD | CD | Rango / área | Contrato funcional | Lectura visual |
|---|---|---:|---|---:|---|---|---|
| 245 | Cometa de Ceniza | 2.0 s | Normal | 15 s | 30 | daño fijo + Marear 7 s | meteorito ceniza/fuego desde arriba |
| 261 | Orbe de Ascua | 1.5 s | Corto | 15 s | 25 / 6 | proyectil; explosión target-centered al impacto | esfera de fuego + impacto radial |
| 262 | Estallido Glacial | 1.0 s | Muy corto | 20 s | 25 | daño fijo + slow 40 % durante exactamente 2 s | estallido de hielo y fragmentos |
| 263 | Descarga Fulmínea | 2.0 s | Muy corto | 20 s | 25 | daño eléctrico periódico durante 5 s | arco de electricidad segmentado |
| 265 | Prisión de Escarcha | 1.5 s | Corto | 30 s | 25 | stasis/parálisis | prisión de hielo |
| 266 | Tempestad de Cristal | 2.0 s | Normal | 120 s | 25 / 6 | daño + Aturdir 10 s | tormenta helada de área |
| 268 | Núcleo de Magma | 2.0 s | Corto | 45 s | 30 | impacto fijo + quemadura 15 s | núcleo de magma + impacto |
| 269 | Vórtice Errante | 3.0 s | Normal | 60 s | 25 / 6 | daño + root 9 s | tornado target-centered |
| 270 | Cúpula de Rayos | 2.0 s | Corto | 180 s | área 10 | daño + reducción de fuerza 10 s | tormenta eléctrica alrededor del caster |

### Hallazgos adversariales cerrados

1. **Fireball no era realmente AoE target-centered.** Se añadió `targetArea` a simulación. El objetivo seleccionado ancla el radio; el cursor visual no decide el impacto.
2. **Fireball podía parecer impactar en RELEASE aunque era proyectil.** Ahora el payload completo se resuelve en `ProjectileHit`; RELEASE sólo crea el proyectil.
3. **Explosión de hielo interpretaba “Duración de la velocidad de movimiento: 2s” como un valor de velocidad.** Corregido: slow -40 % por exactamente 2 s, sin auto-buff fantasma.
4. **Aturdir estaba degradándose al control corto que se rompe con daño.** Corregido: `Aturdir → stun`; `Marear` sigue siendo su categoría separada.
5. **Relámpago tenía duración fuente 5 s pero podía colapsarse a un golpe genérico.** Ahora es daño periódico determinista de 5 s.
6. **Explosión de magma tenía dos componentes de daño que se fusionaban.** Ahora conserva impacto + DoT 15 s.
7. **La primera barra no mostraba la fantasía del Arcanista.** La página 1 empieza por los doce poderes firma, con storage versionado para no heredar barras antiguas.

## Cobertura global

- 320 registros fuente leídos.
- 290 poderes reales.
- 30 placeholders excluidos.
- 410 asignaciones de subclase.
- 344 activos + 66 pasivos.
- 410 contratos `sourceMechanics` para auditoría.
- 410 contratos `presentation`.
- 410 firmas de icono globalmente únicas.
- Damage model de esta fase: `fixed-pure`; fórmulas de armadura siguen diferidas deliberadamente.

## Regla visual

La referencia se replica en **función, timing y legibilidad**, no copiando arte, nombres, iconos ni clips propietarios. Arena usa una gramática propia por elemento y función.
