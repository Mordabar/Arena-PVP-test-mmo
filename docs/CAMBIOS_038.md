# Cambios de gameplay · v0.38

El kit inicial vuelve a usar los seis poderes de identidad de cada clase; jugador y bot comparten los mismos IDs. El Vinculador añade dos variantes ofensivas para que pueda combatir sin aliado. El catálogo amplio permanece accesible en el libro y en barras adicionales; sus valores de rango 5 no constituyen un balance competitivo de arena.

La mayoría de costes del kit se multiplican por tres porque eran pequeños respecto a los 1000 puntos de recurso; se mantienen daño, alcance, preparación y cooldowns de esos poderes salvo cambios explícitos abajo. Pulso vital, Regeneración y Barrera pasan a 120 de maná para limitar cadenas de sustain. Misil: 210–230 daño mágico bruto, 90 maná, 9 s CD; Hiedra: 110–130 daño físico bruto, 90 maná, raíz de 1.6 s. Son copias adaptadas: los originales quedan conservados. No se modifica el ataque normal ni se añaden cargadores.

Interponer sobre ti otorga absorción; Enlace y Proteger aliado sobre ti reducen daño, sin redirección recursiva. Revivir aporta curación y barrera al lanzador vivo; no permite levantarse después de perder el duelo. Cremación contra vivo causa 35 daño mágico bruto cada segundo durante 6 s; contra cadáver conserva su uso original. Los efectos de ayuda de área incluyen al lanzador y validan objetivos amistosos. Portal se ejecuta una sola vez desde selfEffects y resuelve colisiones en destino.

El bot Guardián busca 1.6 m para usar su arma, y el Vinculador cura sobre sí por debajo del 65 % antes de atacar. Todos los ataques dirigidos ofensivos comparten orientación para jugador y bot. El duelo normal desactiva trucos y pasivos ampliados; conserva el pasivo base de cada clase. Límite de 240 s simulados con empate. Se espera 0.9 s antes del resultado por muerte para mostrar la caída.

Compromiso de tiempos: recurso, cooldown y GCD se pagan en RELEASE. Cancelar antes sigue siendo gratis. El HUD, preparación de arma, bot y animación leen la simulación. Reload significa preparar flecha/retornar arma/recuperar descarga según readyAt, sin munición ficticia. La velocidad de ataque modifica el ciclo existente.

No se declara balance competitivo. 72 duelos automáticos completaron en dos semillas; las pruebas aisladas del catálogo no cubren todas las interacciones entre sus 382 activos. Invocaciones, posesión y poderes de compañeros conservan requisitos situacionales.

| Poder | Cambio de valores |
|---|---|

Detalle exhaustivo antes/después: qa/balance-changes.json. Los contratos de commit, rig y bibliotecas originales se conservan.
