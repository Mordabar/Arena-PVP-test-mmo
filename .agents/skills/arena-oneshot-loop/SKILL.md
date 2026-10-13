---
name: arena-oneshot-loop
description: Coordina en una sola sesión autónoma el objetivo global de un 1v1 Three.js jugable y pulido, iterando con checkpoints y pruebas reales sin pedir instrucciones para cada microtarea.
---


# One-shot autónomo con control de calidad

El usuario NO quiere dividir manualmente todo en pequeñas tareas. El agente debe asumir coordinación integral, pero no declarar terminado por pasar checks.

## Bucle
`AUDITAR → REPRODUCIR → PRIORIZAR → CAMBIAR CON CAUSA → EJECUTAR → OBSERVAR VIDEO/FRAMES → COMPARAR → REGISTRAR → SIGUIENTE FALLO`.

1. Define 1 objetivo verificable (demo 1v1 end-to-end) y descompón INTERNAMENTE en subtareas. No pidas una aprobación por archivo.
2. Crea branch/snapshot sin destruir cambios del usuario.
3. Prioridad: animación y preview; después poderes/HUD/VFX; por último balance superficial y limpieza menor.
4. Cada cambio requiere diff pequeño y prueba; permite autonomía entre cambios, pero guarda evidencia a nivel de versión.
5. Dos intentos fallidos para una misma hipótesis: parar, diagnosticar y cambiar enfoque o marcar bloqueo. No consumir presupuesto cíclicamente.
6. Herramienta inexistente ≠ tarea completada. Lo no comprobado debe etiquetarse `NO_PROBADO`.
7. No construir 3v3 MMO, ranking, login ni app móvil durante esta entrega.
8. Terminar con demo + checklist de aceptación + lista realista de bloqueos, no solo descripción.

Si falta licencia de animación, input requerido del usuario o autorización destructiva, pedirla una sola vez de forma concreta.
