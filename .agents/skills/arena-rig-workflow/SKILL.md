---
name: arena-rig-workflow
description: Inspecciona y corrige GLB/rig Quaternius UAL de 65 huesos con Blender cuando hay evidencia de problema de skin, ejes, huesos, poses, keyframes o importación. No usar para cambios en gameplay.
---


# Workflow de modelos/rig/Blender

No conectes Blender por reflejo: primero demostrar que el problema está en el asset o la transformación. Si es mapping de estado o evento del juego, arreglar en Three.js.

## Checklist de rig
1. Backup de `.glb` y hash/inventario; inspeccionar licencia UAL/CMU antes de redistribuir.
2. Ejecutar `node tools/agent/arena-glb-inspect.mjs` y contrastar nombres de huesos, número de skins, duración, tracks, path target y distribución de clips.
3. En Blender (manual o Blender MCP): importar la fuente compatible y verificar A-pose/T-pose, orientación Y-up, orden y pesos, huesos simétricos, escala, local axes y root motion en un visor de animaciones.
4. Para importar/exportar, fijar una configuración y validar en GLTFLoader. Evitar borrar canales críticos, que cambie el bind pose o que el movimiento raíz desplace gameplay.
5. Exportar a una RUTA NUEVA hasta validar; registrar licencia y origen. No reemplazar modelos globalmente antes de comparar.
6. Probar un solo estado en videojuego y revisar secuencia, no solamente preview Blender.

**No crear claves arbitrarias** como sustitutos de captura de movimiento. Si la biblioteca no tiene animación convincente, `BLOCKED_ASSET` con un video/descr. de lo que falta.

Blender MCP: https://github.com/ahujasid/mcp-for-blender. Puede ejecutar Python: no permitir operaciones destructivas ni exponer puertos externamente.
