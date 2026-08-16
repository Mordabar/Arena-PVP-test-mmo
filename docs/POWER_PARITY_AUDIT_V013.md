# Auditoría de poderes v0.13

## Regla

`Documento Maestro → parser independiente → contrato fuente → runtime → pruebas dinámicas → árbitro adversarial`.

No se acepta como “paridad” que una habilidad sólo exista por nombre. Se comprueban campos escalares, targeting, bando afectado, centro de área y familias de efectos con casos dinámicos.

## Gates del auditor independiente

1. 320 registros / 290 válidos / 30 placeholders.
2. 410 asignaciones exactas.
3. Conteo 65/65/65/65/75/75.
4. Nombre fuente + variación sistemática.
5. Metadatos fuente campo por campo.
6. Bullets + rango 5 auditables.
7. Cast/GCD/CD exactos.
8. Maná rango 5 exacto.
9. Sin `fixed-pure`/rebalanceo Arena en poderes fuente.
10. Sin placeholders/reglas opacas.
11. Ningún poder lanzable vacío.
12. Rangos numéricos ordenados.
13. Todo tipo generado posee handler runtime.
14. Anclas Brujo (Meteorito/Fuego/Hielo/Relámpago).
15. Drains/pets/enlaces especiales.
16. Bordes semánticos de Vampirismo/curas %/revive/purga.
17. Cero fallback semántico `source_*` opaco.
18. Target/bando/centro de área de poderes sensibles.
19. Separación de resistencias físicas y mágicas.
20. Diferenciación real Represalia vs Espejo del karma.

Resultado de cierre: **20/20 · ARBITER APROBADO**.

## Pruebas dinámicas v0.13

La suite incluye pruebas ejecutables para redirección total de Asistencia del Paladín, consumo de Represalia, reflejo persistente de Espejo del karma, pulsos de Campo estático, Comunión de mana, Curación mayor, Vampirismo, curas porcentuales, Furia natural, pasivos/expiración de mascotas y demás bordes que habían producido falsos positivos en waves anteriores.
