Actúa como responsable de implementación y pulido de Project Arena. Trabaja sobre el proyecto y los packs que te adjunto. Tu misión es entregar una versión local de arena 1v1 completa, jugable y coherente, con buen gamefeel, poderes ajustados, iconos, preparación/recarga, cooldowns, efectos y representación visual de todos los estados existentes.

Debes ejecutar el trabajo, no limitarte a proponer un plan. Organiza las subtareas internamente y completa todas las iteraciones necesarias dentro de los recursos disponibles. No me pidas aprobar cada cambio ni me entregues solo un personaje o una demostración aislada. Resuelve las decisiones rutinarias usando el proyecto y estos requisitos.

## 1. Contexto, presupuesto y alcance

- La base es Project Arena v0.37, o la versión más reciente que adjunte. El gamefeel actual tiene aspectos que me gustan: consérvalos y mejora lo que esté defectuoso.
- Presupuesto adicional: $0. Usa el agente de mi suscripción y herramientas gratuitas o locales. No contrates APIs, servicios, servidores, créditos ni assets. No consumas créditos adicionales de generación de imágenes.
- Aprovecha Three.js, los personajes, las seis clases, el rig UAL, los clips y el combate existentes. No migres de motor ni reinicies la arquitectura para resolver este encargo.
- El objetivo inicial es 1v1 local contra un bot usando el modo existente. No añadas MMO, servidor online, cuentas, matchmaking ni contenido ajeno a este objetivo.
- El rival debe combatir de verdad y permitir evaluar las habilidades. El modo de práctica y las herramientas de depuración pueden complementar la partida.
- Mantén las clases y sus identidades. Completa el alcance para todas las clases existentes; no ocultes las defectuosas para aparentar que el juego está terminado.

## 2. Inspección y continuidad

Antes de editar, localiza el punto de entrada, la simulación, los poderes, el HUD, los assets, los sistemas de animación y las pruebas. Lee las instrucciones aplicables del repositorio y docs/ANIMATION_PLAYBOOK.md.

El playbook de v0.37 conserva secciones históricas: verifica el encabezado actual y los archivos reales antes de asumir que un inventario o un fallo antiguo sigue vigente.

Guarda una copia recuperable o un commit de la base sin sobrescribir trabajo ajeno. Documenta brevemente el estado inicial. Después continúa directamente con implementación, ejecución y corrección.

Mantén una fuente de verdad para tiempos, daño, recursos, estados y cooldowns en la simulación. La animación, el HUD y los VFX consumen esa información; no deciden por separado cuándo ocurre un impacto.

## 3. Gameplay, poderes y balance inicial

Revisa todos los poderes activos, ataques básicos y efectos de las clases existentes. Corrige habilidades rotas, validaciones inconsistentes, comportamientos contradictorios y mensajes confusos.

Ajusta daño, curación, costes, alcance, preparación, recuperación, duración de efectos y cooldowns cuando sea necesario para que un duelo sea comprensible y permita responder al rival. Conserva las identidades tácticas y registra los valores cambiados con su motivo.

Evalúa especialmente las habilidades pensadas para aliados: en 1v1 deben tener un uso válido y claramente explicado, por ejemplo mediante autocasteo o una adaptación razonable que conserve su identidad. Evita botones inutilizables por falta de compañeros.

Comprueba objetivo, distancia, orientación y línea de visión cuando las reglas lo requieran. Distingue fallo, bloqueo, evasión, absorción, daño y curación si esos resultados existen. Evita daño duplicado y costes/cooldowns aplicados dos veces.

Respeta el contrato actual de commit en RELEASE salvo que un defecto requiera un cambio documentado. Una acción cancelada antes del commit no debe consumir arbitrariamente recursos ni iniciar cooldowns. Prueba la cola de entradas y los ataques consecutivos: pulsar repetidamente no debe duplicar acciones ni dejar al personaje bloqueado.

El bot debe usar sus habilidades legalmente, respetar tiempos y recursos, perseguir o mantener distancia según su clase y permitir terminar el duelo. Evalúa varios enfrentamientos, sin afirmar balance competitivo definitivo por unas pocas partidas.

## 4. Imágenes de poderes y HUD

Cada poder activo debe tener un icono gráfico local, distintivo y coherente con su función. Reutiliza imágenes disponibles y, donde falten, crea SVG o PNG mediante herramientas gratuitas/locales. Un SVG cuenta como imagen; emojis o letras solos no son el resultado final.

Mantén un estilo común y buena legibilidad al tamaño real de la barra. Relaciona cada icono con el ID correcto del poder. Empaqueta los recursos para funcionar sin servicios externos.

La barra debe mostrar:

- Icono, atajo y selección/activación.
- Cooldown numérico y progreso visual calculados a partir del tiempo real de simulación.
- GCD distinguible del cooldown individual.
- Estados de falta de recurso, objetivo inválido, fuera de alcance y bloqueo por control.
- Tooltip con descripción, coste, alcance, duración, preparación y cooldown actuales.
- Feedback breve cuando una acción se rechaza.

Muestra vida, recursos, objetivo, casteo e interrupción, buffs/debuffs relevantes y sus duraciones. Los textos deben estar en español. La información del HUD debe coincidir con el comportamiento real de cada habilidad.

## 5. Preparación, reload y recuperación

Representa de forma coherente el ciclo de cada arma: listo, preparación, ejecución/disparo y recuperación o recarga.

En arco, distingue preparar una nueva flecha, tensar/apuntar, soltar y recuperar. En melee, distingue anticipación, golpe y retorno. En magia, distingue preparación, lanzamiento y recuperación.

Si el proyecto ya tiene munición o recarga real, completa su lógica, control y HUD. Si no existe, implementa la preparación y disponibilidad del siguiente ataque según el arma, sin inventar cargadores de balas para arco, espada o magia. Documenta esta interpretación de reload.

El personaje, el indicador de disponibilidad y la legalidad del siguiente ataque deben estar sincronizados. Los cambios de velocidad de ataque deben afectar coherentemente el ciclo completo.

## 6. Animación para cada estado real

Construye y verifica una matriz clase × estado × clip/pose × prioridad × transición × condición de salida. Toda situación del juego debe tener una representación visual coherente; puede ser un clip, una capa o una pose sostenida. Reutilizar un clip adecuado es válido y debe quedar documentado.

Cubre, cuando esos estados existan:

- Reposo normal y guardia de combate.
- Caminar/correr, retroceso, desplazamiento lateral, diagonales y giros.
- Inicio/parada de movimiento; salto y aterrizaje si están disponibles.
- Ataque básico, preparación, ejecución, recuperación y ataques repetidos.
- Casteo, canalización si existe, lanzamiento e interrupción.
- Buff, curación y acciones especiales de los poderes.
- Recepción de daño, bloqueo, evasión o absorción según el resultado real.
- Aturdimiento, noqueo, permanecer tendido y levantarse.
- Enraizamiento, silencio, desarme, ralentización y estasis según sus reglas.
- Muerte y reinicio del duelo.

Una reacción leve al daño no debe cancelar casteos ni modificar la lógica del combate si las reglas no lo indican. Usa mezcla/capa aditiva o una reacción breve cuando corresponda. El control fuerte y la muerte deben tener prioridad coherente; un noqueado o muerto no debe atacar visualmente.

Enraizamiento impide desplazamiento, silencio restringe los poderes afectados y desarme restringe las acciones que corresponda: no los conviertas indiscriminadamente en una inmovilización total. Para estasis, mantén la pose congelada si ese es su comportamiento.

Cada nueva acción debe reiniciar su animación aunque use el mismo clip. Sincroniza disparos e impactos con los eventos reales. Mantén movimiento de piernas durante acciones que permitan desplazamiento; evita deslizamientos evidentes, saltos de pose y restricciones de manos acumuladas entre fotogramas.

Conserva el rig UAL nativo. Si falta un movimiento, edita/crea un clip sobre ese rig o usa una adaptación coherente. Usa Blender gratuito por scripts/MCP si está realmente disponible. Los recursos externos gratuitos son opcionales y requieren validar compatibilidad antes de incorporarlos; no reemplaces el esqueleto principal.

El preview público de una biblioteca no equivale a poseer sus clips. Identifica el origen real de cada animación y etiqueta cualquier adaptación provisional. No declares un movimiento resuelto solo porque su nombre figura en una tabla.

## 7. Efectos, sonido y cámara

Conecta los VFX a eventos reales de preparación, lanzamiento, recorrido, impacto y finalización. Diferencia habilidades y clases mediante formas y colores consistentes. Incluye proyectiles, impactos, áreas, curación, escudos y controles cuando corresponda.

Los efectos deben aclarar el combate y permitir ver al rival. Evita flashes excesivos, partículas sin límite y efectos persistentes después de muerte o reinicio.

Añade sonidos gratuitos/locales o sintetizados para acciones e impactos relevantes. Usa los existentes cuando sirvan. Evita sonidos duplicados y permite ajustar volumen.

Pule cámara, selección y lectura de distancia. Conserva la respuesta de control que funciona. Las mejoras audiovisuales no deben alterar arbitrariamente tiempos, posiciones ni reglas.

## 8. Bucle de partida y ejecución

El flujo debe permitir elegir clase, iniciar duelo, combatir, mostrar victoria/derrota y jugar de nuevo. Cada reinicio limpia entidades, efectos, cooldowns, estados y eventos anteriores.

La partida normal debe usar las reglas reales, con trucos, invulnerabilidad y cooldowns gratuitos desactivados. Separa las opciones de depuración de la experiencia normal.

Mantén un arranque sencillo en Windows aprovechando iniciar.bat/iniciar.py cuando existan. Incluye instrucciones exactas y todas las dependencias de ejecución necesarias. Evita añadir Node, Blender o herramientas de desarrollo como requisito para jugar si el proyecto funciona con Python y navegador.

## 9. Iteración autónoma y verificación

Trabaja en un ciclo continuo: inspeccionar → implementar → ejecutar → observar → corregir → repetir. Mantén una única misión hasta entregar el alcance completo; no requieras mi aprobación entre subtareas.

Arranca realmente el juego. Usa navegador y secuencias de fotogramas o vídeo para verificar movimientos, no solo capturas estáticas. Prueba:

- Partidas completas con cada clase y enfrentamientos representativos.
- Todos los poderes y sus iconos, tooltips, costes y cooldowns.
- Ataques repetidos, movimiento durante acciones, daño recibido, interrupciones, control y muerte.
- Objetivo inválido, fuera de alcance y recursos insuficientes.
- Victoria/derrota y varias revanchas.
- Limpieza de efectos y estabilidad durante sesiones repetidas.

Reutiliza las auditorías y pruebas existentes; amplíalas para cambios de lógica relevantes. Los estados forzados de laboratorio complementan la verificación, pero no sustituyen combates completos.

Compara visualmente antes/después y comprueba consola, assets ausentes y posibles fugas. Registra el entorno y el rendimiento medido sin extrapolar cifras a mi computador.

Si una herramienta no está disponible, busca una alternativa gratuita que permita seguir. No inventes accesos ni resultados. Si un bloqueo real impide verificar una parte, completa el resto y explica exactamente qué quedó sin comprobar.

No declares cumplimiento solo por compilar, pasar pruebas o cumplir un número de comprobaciones. Corrige los defectos observados. Una vez alcanzados los criterios y sin fallos críticos conocidos, termina y empaqueta; no extiendas indefinidamente el alcance.

## 10. Sitio jugable dentro de ChatGPT y actualización del mismo proyecto

Además del ZIP, crea una versión web jugable con Sites de ChatGPT si esa capacidad está disponible en esta sesión y puede usarse sin coste adicional. Lee y sigue sus instrucciones y el flujo de publicación y pruebas compatible con el entorno. Usa un Site privado y su dirección proporcionada por la plataforma; no compres dominio ni contrates hosting.

El sitio debe ejecutar el juego real con sus GLB, iconos, sonidos y demás recursos. Debe permitir elegir clase, jugar el duelo, ver el resultado y reiniciar. Una página promocional, un vídeo o una captura no cumplen este requisito.

Aprovecha la estructura HTML/JS actual y empaqueta las dependencias necesarias. Comprueba rutas, carga de assets, teclado, ratón, foco del canvas y restricciones de audio del navegador. Añade un botón claro para entrar al juego y capturar los controles cuando sea necesario.

Mantén el código fuente del Site y el juego descargable sincronizados: publica y empaqueta la misma revisión del gameplay. Conserva la identidad del Site y su repositorio para actualizarlo durante esta tarea y ante mis siguientes instrucciones. No crees un sitio nuevo en cada iteración.

Durante el encargo, usa las herramientas de navegador permitidas para ejecutar el juego y observar los resultados. Modifica el código fuente o los assets, repite las comprobaciones y actualiza el Site cuando corrijas fallos. Las modificaciones deben llegar a la versión jugable y al ZIP final.

Incluye un panel de pruebas opcional, separado de la partida normal, para inspeccionar poderes, animaciones y valores de ajuste. Los cambios experimentales del panel no sustituyen cambios persistidos en el código/configuración: cuando adoptes un ajuste, guárdalo, compruébalo y actualiza ambas entregas.

Mantén visible la versión del juego para que pueda identificar qué estoy probando. Al terminar, entrega el enlace real del Site desplegado y explica los límites de verificación que existan. No afirmes que el enlace funciona sin una publicación confirmada.

Si Sites no está disponible, informa de esa limitación y entrega una vista previa local mediante las herramientas soportadas y el ZIP ejecutable. No simules un Site ni sustituyas el requisito por un servicio de pago. Completa todos los demás requisitos que sean viables.

La autonomía de ajustes se refiere al agente durante la tarea y futuras sesiones donde yo le dé instrucciones; no prometas que el sitio mantiene un agente trabajando indefinidamente después de cerrar la sesión.

## 11. Entrega y criterios de aceptación

Entrega:

1. ZIP completo del juego actualizado y ejecutable localmente.
2. Instrucciones de arranque y controles.
3. Registro breve de cambios de gameplay/balance.
4. Matriz de cobertura de animaciones con origen y adaptaciones.
5. Evidencia visual de partidas y estados corregidos.
6. Resultados de verificación y pendientes reales.
7. Enlace al Site privado jugable, actualizado a la misma revisión del ZIP, cuando Sites esté disponible.

La versión debe permitir duelos completos con las clases existentes, poderes utilizables, iconos gráficos, tiempos y HUD sincronizados, efectos claros, reacción al daño y representación coherente de los estados. No debe haber errores críticos conocidos que impidan combatir o reiniciar.

Separa en el informe: implementado, comprobado técnicamente, observado visualmente y pendiente. No prometas perfección artística ni ocultes limitaciones.

Empieza a trabajar sobre los archivos adjuntos y entrega el resultado completo. Conserva esta instrucción y el progreso en un archivo de continuidad para poder retomar la misma misión si la sesión alcanza su límite.