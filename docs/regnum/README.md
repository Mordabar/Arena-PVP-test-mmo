# Datos de poderes de Champions of Regnum

- `POWERS.md` y `powers.json` se generan con `node tools/extract-regnum-trainer.mjs <trainerdata.json>`.
- Fuente: el archivo `trainerdata.json` del entrenador CoRT (cort.ovh), versión 1.35.19.
- Estructura: clase → disciplina → poder → valores por nivel (1 a 5), en el mismo orden que el entrenador.
- Son datos de juego de terceros. Las fórmulas y los assets no están incluidos: se tratarán por separado cuando haya permiso para usar los assets.
- 30 entradas aparecen como placeholder en la fuente (nombre "undefined"); se marcan como "sin datos en la fuente" y no se les inventa nombre.
