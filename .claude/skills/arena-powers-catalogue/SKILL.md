---
name: arena-powers-catalogue
description: Integra poderes, iconos, cooldowns, cast, efectos y VFX en Project Arena, usando exclusivamente catálogos fuente reales como trainerdata.json, sin inventar IDs ni simular cobertura.
---


# Integración de poderes — data-driven

1. Averigua cuál es la fuente del repo actual: `js/data/powerLibrary.js`, `js/data/abilities.js`, `js/data/powerAnimationGrammar.js` y opcional `trainerdata.json`/Markdown exportado.
2. Cuenta TOTAL REAL de disciplinas/poderes/rangos y distingue **datos importados** de **gameplay implementado** y de **UI/visual implementada**. No declares “todos los poderes funcionan” porque el JSON existe.
3. Por poder o familia: id estable, nombre, descripción, prerequisitos, rango, tipo objetivo, coste, cast, cooldown, GCD, animación por familia, timing RELEASE, VFX, icono, efecto de simulación, estado implementado y pruebas.
4. Una implementación puede compartir lógica de efectos, pero cada poder debe tener feedback y semántica coherentes; no prometer VFX único de calidad cuando solo existe un placeholder.
5. Animación NO mueve HP ni decide daño. VFX se dispara solo desde evento de la simulación.
6. Iconos: usar recursos con licencia y registro de procedencia, o placeholder honesto `PROVISIONAL`.
7. Completar primero las habilidades necesarias para 1v1 funcional. Conservar todas las ya implementadas; luego extender catálogo por familias, y crear una lista exhaustiva de faltantes (no gastarse el presupuesto en 300 VFX desiguales).
8. Probar por habilidad: activación, consumo, targeting, interrupción, resultado en log, icono y cooldown, VFX en cámara.

Entregable: `agent-qa/PODERES_ESTADO.csv` con ids reales, estado técnico, visual, origen, casos de prueba. Si fuente adicional falta, decir `NO_EVIDENCIA`.
