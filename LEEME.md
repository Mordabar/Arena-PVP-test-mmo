# Project Arena 0.39 · Poderes y fórmulas Regnum

Seis clases, duelo local contra IA y entrenamiento. Ver docs/CAMBIOS_039.md para alcance y adaptaciones. No es servidor MMO ni certificación AAA.

## Jugar

1. Extrae el ZIP completo.
2. Con Python 3 instalado, abre iniciar.bat en Windows o ejecuta `python3 iniciar.py`.
3. Abre la dirección local de la consola. Déjala abierta; Ctrl+C detiene el servidor.
4. Elige clase y entra a la arena, o abre entrenamiento.

No requiere npm, Blender ni Internet para jugar. Necesita navegador de escritorio con WebGL y HTTP; no abrir index.html por doble clic.

## Controles

| Acción | Control |
|---|---|
| Mover / caminar | WASD / Shift + movimiento |
| Girar / mirar libre | Q y E o botón izquierdo / botón derecho |
| Zoom / salto | Rueda / Espacio |
| Rival / aliado / tú | Tab / Shift+Tab / F |
| Ataque normal | T |
| Poderes | 1–9, 0, - y = |
| Cambiar barra | Shift+1 a Shift+4 |
| Libro de poderes | B |
| Cancelar cast / revancha | Esc / R |

Seleccionar objetivo no gira automáticamente al personaje. Encáralo para atacar.

## Trainer y cálculos

En B, busca por nombre variante/original/rama; selecciona nivel 1–5 y equipa pasivos. Arrastra activos a la barra. El build se guarda en este navegador y se bloquea durante duelo. Es un editor libre, todavía sin restricciones de puntos de personaje.

Fuente JSON:32 ramas,290 poderes definidos y30 huecos explícitos excluidos. Las ramas compartidas generan410 asignaciones de clase. Cada poder tiene icono y firma visual; los clips corporales se comparten por acción.

En entrenamiento, Combat Lab ofrece Fórmulas Regnum: arma, atributo principal, protección del objetivo, grado de resistencia y desglose del último golpe. Combate suma componentes elementales, resta armadura una vez y después aplica crítico. El factor0,52 de la hoja es comunitario/experimental, no una afirmación oficial actual.

## Evidencia y límites

docs/REGNUM_FORMULAS.md recoge fórmulas y coordenadas del Excel; el original no se modifica. qa/trainer-039.json, qa/duel-regression.json, qa/catalogue-smoke.json y qa/game-flow-regression.json contienen QA de simulación. qa/ANIMATION_039.md y qa/animation-sequences-039-CPU.png recogen pruebas/poses del rig real por CPU, no capturas ni gameplay de navegador. Documentación v0.38/v0.37 conservada como historia.

Arco, patada y locomoción direccional siguen siendo adaptaciones provisionales. No se verificaron partidas humanas, sonido audible, Pointer Lock ni FPS. Domar, invocaciones y portales tienen adaptaciones limitadas a Arena; no hay mundo abierto, fauna/altares ni multijugador en red.

Licencias conservadas en assets/animations. Sin compras ni servicios adicionales.
