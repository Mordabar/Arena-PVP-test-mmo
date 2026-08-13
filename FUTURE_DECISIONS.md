# FUTURE_DECISIONS.md

## Backend competitivo

El rating, placements e historial de v0.8 son locales y reemplazables. No deben presentarse como seguridad/matchmaking de producción. El servidor autoritativo, cuentas y matchmaking remoto pertenecen a un milestone posterior.

## Personajes

El renderer procedural actual cumple legibilidad de arquetipo y conserva el Animation Reference Pass. Antes de invertir en más micro-geometría procedural, evaluar un backend GLB/skinned compatible con `AnimationIntent`, o migración visual a Unity manteniendo la simulación/contratos.

## Gate visual runtime

En el entorno de build actual, Chromium está administrado y bloquea HTTP local/loopback antes de cargar el proyecto. Repetir `node tools/browser.js smoke` y playtest manual en un navegador no administrado como primer gate externo de v0.8.
