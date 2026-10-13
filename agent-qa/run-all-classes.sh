#!/bin/sh
# Ejecuta una partida 1v1 completa por clase (E2E con teclado real). Salida: agent-qa/e2e-<clase>/
cd "$(dirname "$0")/.."
for c in devastador guardian centinela rastreador arcanista vinculador; do
  node tools/e2e-duel.mjs --class $c --max-s 150 --out agent-qa/e2e-$c > agent-qa/logs/e2e-$c.log 2>&1
  echo "$c exit=$?" >> agent-qa/logs/e2e-summary.txt
done
echo DONE >> agent-qa/logs/e2e-summary.txt
