---
name: arena-release-gate
description: Certifica técnicamente la entrega de Project Arena 1v1 y evita afirmaciones sin evidencias, validando assets, animaciones temporales, HUD, powers, consola, FPS y reproducción.
---


# Gate de entrega

1. Corre `node tools/agent/arena-doctor.mjs` y `node tools/audit-clips.mjs` si aplica.
2. Ejecuta `node tools/agent/arena-qa.mjs --visual` si navegador y scripts de origen disponibles. Registrar entorno, comandos y errores.
3. Revisa matriz en `agent-qa/kit-reference/CRITERIOS_DE_ACEPTACION.md`, casos A01–A20.
4. Verifica resultado 1v1 desde el lanzamiento del juego hasta muerte/victoria/reinicio.
5. Para cada animación nueva, comparar al menos 3 frames temporales (no un único PNG) y comprobar evento semántico correcto; usuario aprueba naturalidad.
6. Abre `http://127.0.0.1:4173/` con `node tools/agent/arena-preview-server.mjs` y adjunta instrucciones reproducibles.
7. Informa todas las piezas provisionales y assets ausentes, errores de consola, pruebas no ejecutadas, licencias por aclarar y estatus de poderes.
8. Escribe `agent-qa/REPORTE_FINAL.md`, usando formato del kit, y evita palabra "terminado" cuando hay críticos bloqueantes.

El `PASS` automático de sintaxis o auditor es necesario pero INSUFICIENTE para calidad visual percibida.
