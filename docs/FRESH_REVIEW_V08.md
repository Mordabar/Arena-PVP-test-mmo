# Fresh Reviewer — v0.8

Revisión final independiente del checklist de implementación, orientada a encontrar defectos que no fueran simples fallos de compilación.

## Defectos críticos encontrados y resueltos

1. **UI estructural reconstruida cada frame.** `GameShell.update()` volvía a montar class cards/resultados aunque la fase no cambiara. Se añadió cache de vista (`LOBBY/MATCH/RESULTS`) y ahora sólo reloj/barras se actualizan continuamente.
2. **Bots con giro privilegiado.** La IA escribía `self.yaw` directamente hacia el objetivo. Se sustituyó por `World.turnEntityToward`, respetando el límite temporal de giro de la simulación antes de validar facing.
3. **Doble KO tratado acústicamente como derrota.** MatchFlow ya producía empate, pero el audio de cierre elegía derrota para todo resultado no ganado. Se neutralizó el audio de win/loss en empate y se añadió regresión de rating 0.
4. **Árbitro obsoleto v0.7.** Seguía exigiendo 206 tests/cache anterior y no auditaba Product Flow. Se actualizó a v0.8 con gates de autoridad, Ladder, empate, bots y entrypoint.
5. **Visual audit obsoleto v0.4.** Se reemplazó por auditoría v0.8 que cubre Arcane Wilds + shell Ladder + audio + assets + frontera de autoridad.

## Bloqueo externo no resuelto en código

El Chromium administrado del entorno bloquea `127.0.0.1` y la IP interna del contenedor antes de cargar JavaScript. Por tanto el smoke visual-runtime debe repetirse fuera de este entorno. No se atribuye como aprobación del build ni se inventan FPS.

> **NOTA POSTERIOR (v0.9).** Este bloqueo **ya no aplica**. `tools/browser.js`
> levanta un servidor estático en un puerto efímero y carga la página por HTTP,
> igual que hará el hosting real. El gate observable se ejecuta y se ejecutó:
> `node tools/run-gates.js`. Y en cuanto se ejecutó apareció un P0 que ninguna
> revisión estática podía ver: en la presentación de Three.js no se disparaba ni
> una sola animación de combate. Está documentado en `BUILD_LEDGER.md`.
>
> La conclusión de abajo —«sin críticos abiertos»— era correcta **para lo que
> esa revisión podía mirar**, y justamente por eso no bastaba.

## Resultado

Sin críticos estáticos/arquitectónicos abiertos tras la Fix Wave. Pendiente únicamente el gate observable externo de navegador/playtest por la política descrita.
