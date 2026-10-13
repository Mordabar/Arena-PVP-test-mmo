# Verificación v0.39

## Comprobado

- Fórmulas históricas del Excel:38 casos numéricos independientes.
- Trainer:12.333 comprobaciones y2.050 ejecuciones de variantes de nivel;32 ramas,290 poderes reales,30 huecos excluidos.
- Catálogo de runtime:382 activos (incluidos activos heredados de compatibilidad), cero errores; kit inicial36 poderes.
- Duelo:72 emparejamientos ordenados entre bots, dos semillas. El informe `duel-regression.json` contiene duración y resultado, incluyendo cualquier empate por tiempo. No demuestra balance competitivo.
- Flujo:18 reinicios de partidas, cuenta atrás, resultado, revancha, limpieza de mundo, resurrección sobre aliado muerto y adaptación de portal.
- Animación:374 checks de regresión,2.018 de secuencias,78 referencias existentes.42 poses CPU del rig real, con invariancia de simulación y coherencia mano/cuerda/eje del arco.
- Iconos:320 SVG válidos y byte-distintos;290 identidades/nombres/semillas únicas, con51 siluetas semánticas compartidas. Atlas rasterizados revisados.
- Syntax/rutas/VFX: `static-visual-039.json`. Mallas y transformadas de efectos ejercitadas por CPU, sin renderer WebGL.

## No comprobado

No hay QA de navegador/GPU en esta sesión: falta la capacidad requerida para la vista previa gestionada. No se lanzó servidor alternativo ni se omitió la autenticación. No hay grabaciones de partidas humanas, validación de Pointer Lock, audio audible o medición real de FPS. El resultado nativo del despliegue confirma publicación, no calidad visual.

Arco, patada y locomoción direccional siguen provisionales. Los packs no contienen los clips originales correspondientes. Factor de armadura0,52 comunitario/experimental; no certificado como fórmula actual de los servidores. Campaña/puntos, restricciones completas de equipamiento, mundo abierto y multijugador de red están fuera de esta primera fase.
