# Diagnóstico por capas y bloqueos reales

**No confundir:** `Gamefeel` de combate y calidad de animación son independientes. El primero fue reportado como aceptable por el usuario; protegerlo. La revisión de modelos/animaciones NO justifica rehacer la simulación.

## Contrato de simulación/presentación

1. `js/sim/`, `js/combat/` y datos: estado y reglas.
2. `js/render/characterVisual.js`: intención visual derivada.
3. `js/render/animationStateMachine.js`: selección de clip por intención y clase.
4. `js/data/animationSourcePlan.js`: procedencia/status de cada recurso.
5. `js/render/three/threeDirectAnim.js`: mezcla y reproducción.
6. `js/render/three/threeCharacter.js`: aplica al GLB.

Si la versión inspeccionada difiere, adaptarse a ella sin duplicar funciones.

## Tabla de defectos que NO se deben ocultar

| Síntoma | Hipótesis / prueba | Acción correcta |
|---|---|---|
| Caminando hacia atrás parece caminar adelante | `Walk_Loop` como fallback | clip genuino apropiado, o estado `PROVISIONAL`; comparar secuencia |
| Strafing con brazos rígidos | ventanas CMU no verificadas / upper-body blend | revisar fuente real en Blender antes de conectar |
| Arquero posa como pistola | síntesis desde clips Pistol | falta animación específica de arco; no marcar FINAL |
| T-pose/flicker | binding de tracks, visibilidad o cambio de rig | inspeccionar canal/target y frames, capturar errores |
| Impacto visual no coincide con daño | reloj doble/offset en `RELEASE` | conservar lógica de combate; alinear evento visual |
| Pies patinan | velocidad del clip y visual root motion incongruentes | medir movimiento y ajustar rate; no mover entidad desde render |
| Giro invertido | ejes, yaw, mocap mal alineado | secuencia frontal/lateral y direcciones reales |
| Casteo sin gesto propio | role mapping o clip inadecuado | buscar clip semántico correcto; placeholder honesto |

## Criterio de bloqueo técnico

Después de 2 soluciones fallidas sobre una misma causa, detener esa ruta, adjuntar evidencia y proponer alternativa (clip diferente, fuente UAL compatible, intervención manual en Blender). Continuar con componentes independientes sin mentir sobre la cobertura.
