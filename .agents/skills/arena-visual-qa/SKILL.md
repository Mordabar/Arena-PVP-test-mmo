---
name: arena-visual-qa
description: Prueba visualmente Canvas/WebGL en Project Arena con capturas, secuencias, inputs reales y estados de simulación; detecta T-pose, foot sliding, clipping, snaps, desincronización y regresiones.
---


# QA visual — animación temporal y gamefeel

**Un screenshot no valida un movimiento**. Auditoría de clips solo comprueba existencia. Medir técnica y veracidad artística por separado.

## Rutina
1. Preparar baseline. Abrir el preview `node tools/agent/arena-preview-server.mjs` o servidor efímero del repo.
2. Ejecutar herramientas existentes si están disponibles: `node tools/inspect-canvas.mjs --state combate` y `node tools/anim-preview.mjs --class devastador`; `--set direccional` para WASD/QE.
3. Capturar estados sin alterar la simulación desde animación. Confirmar qué inputs y qué clip/estado correspondieron a CADA captura (`_informe.json`).
4. Inspeccionar **al menos 3 tiempos por acción**, inicio/impacto/recuperación. Si solo se dispone de imagen estática, resultado = `PROVISIONAL`.
5. Si existe herramienta de grabación, exportar video real con fecha/commit. Evaluar desde 2 ángulos cuando la silueta pueda engañar.
6. Construir mosaico `python tools/agent/arena-contact-sheet.py qa/anim-devastador --out agent-qa/contacto.png` (requiere Pillow), opcional.
7. Lista de defectos observables: T-pose, rubber limbs, sliding, penetración arma-cuerpo, salto temporal, pies fuera del suelo, vuelta antinatural, pose arma incorrecta, timing respecto a RELEASE, simulación divergente.
8. Medir consola y render budget; SwiftShader/headless no equivale a FPS real de GPU.
9. Aceptación final de naturalidad y feeling pertenece al usuario; registrar preguntas de evaluación concretas sin afirmar AAA.

Si tu agente no tiene acceso a navegador o no puede abrir imágenes, marca `BLOCKED_TOOL`, proporciona comandos para ejecutar en PC y no declare que validó visualmente.
