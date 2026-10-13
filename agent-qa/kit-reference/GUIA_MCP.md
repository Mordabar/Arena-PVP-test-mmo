# ¿Qué MCP necesitas de verdad?

1. **Herramientas base del proyecto (cero instalaciones externas)**: Node 22, `tools/audit-clips.mjs`, `tools/inspect-canvas.mjs`, `tools/anim-preview.mjs`. Ya existen en el ZIP de referencia. Si el agente no puede abrir Chromium, debe informar y facilitar ejecución en Windows: no inventar screenshots.
2. **Blender MCP**: útil cuando una pose, bone, skin, IK, strip o GLB necesita intervención en Blender. No usar para arreglar cooldowns ni asignaciones de poderes.
3. **Playwright MCP**: útil para automatizar entradas de teclado, interacción de HUD y navegación. Para analizar WebGL hay que capturar imágenes/video y observarlas realmente; el DOM no muestra la animación.
4. **Biblioteca de animaciones**: conservar Quaternius UAL con su rig. Nuevos clips deben cumplir rig o poder verificarse antes de usarse. Retargeting es *último recurso* explícito, no fallback automático.

Configuración MCPS local: el usuario debe instalar dependencias, conectar la app y reiniciar la herramienta. El archivo `mcp-config.example.json` solo es REFERENCIA, no instala servidores.

**Riesgos:** MCP para Blender puede ejecutar scripts Python potentes. Evitar exponer el socket de Blender; revisar comandos destructivos y licencias. Usar `BLENDER_MCP_SAFE_MODE=1` cuando sea compatible con la operación deseada.
