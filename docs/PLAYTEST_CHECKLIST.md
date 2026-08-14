# Playtest humano — 10 a 15 minutos

> **Este es el último gate, y el único que las máquinas no pueden pasar.**
>
> Todo lo que hay en `BUILD_LEDGER.md` está medido: 288 pruebas, once puertas
> ejecutables, cinco árbitros. Nada de eso dice si el combate **se siente bien**.
> El peso de un mandoble, si un telegraph se lee a distancia de duelo, si parar
> para atacar es una decisión táctica o una molestia — eso necesita manos.

**Build:** ver `docs/HOSTINGER_DEPLOY.md` para subirla. La versión se muestra
abajo a la izquierda en el lobby y en la consola al arrancar.

**Cómo anotar:** cada punto tiene una casilla. Marca `OK`, `RARO` o `MAL` y una
línea de por qué. «Raro» es información valiosísima: significa que funciona pero
no se siente. No hace falta diagnosticar la causa.

---

## 0 · Antes de empezar (30 s)

- [ ] La página carga sin pantalla de error roja.
- [ ] F12 → consola: **cero errores** en rojo al arrancar.
- [ ] Suena algo al pulsar el primer botón (el audio se arma con el primer
      gesto; los navegadores lo exigen).

---

## 1 · Movimiento (2 min) — Combat Lab o partida, da igual

Entra en cualquier modo y **no ataques todavía**. Sólo camina.

- [ ] `W` avanza en la dirección a la que mira el personaje.
- [ ] `S` retrocede **sin girarse**. La animación es de andar hacia atrás, con
      pasos cortos y el torso erguido: no es la de correr reproducida al revés.
- [ ] `A` va a la **izquierda** y `D` a la **derecha**. (Esto estuvo invertido
      en su día; si vuelve a estarlo es un P0.)
- [ ] En diagonal no se va más rápido que en recto.
- [ ] Al arrancar y al frenar el cuerpo acusa el cambio, pero **el personaje
      responde al instante**: la inercia es del cuerpo, no del input.
- [ ] Los pies **no patinan**. Míralos: el pie apoyado se queda clavado en el
      suelo mientras el cuerpo pasa por encima.
- [ ] Espacio salta y aterriza sin quedarse flotando ni hundirse.

> ¿Se mueven demasiado rápido? ¿Demasiado lento? Es una queja legítima y la
> necesito por escrito: la velocidad es de simulación y se cambia en un número.

## 2 · Cámara y ratón (2 min)

- [ ] Clic izquierdo **corto** sobre un enemigo lo selecciona **sin mover la
      cámara**.
- [ ] Mantener el izquierdo y arrastrar gira cámara **y cuerpo a la vez**, en la
      misma cantidad. No hay retardo ni «goma».
- [ ] El cursor desaparece mientras arrastras y vuelve al soltar.
      *(Si esto falla → `docs/POINTER_LOCK_MANUAL.md`, es la fila pendiente.)*
- [ ] Mantener el **derecho** gira sólo la cámara. El personaje **no se mueve**.
      Al soltar no hay ningún salto.
- [ ] La rueda acerca y aleja sin atravesar el suelo ni meterse en una columna.
- [ ] Pegado a un muro o a una plataforma, la cámara **no se cuela dentro** ni
      enseña el reverso del nivel.

## 3 · Ataque normal y ritmo (2 min) — con un guerrero

Selecciona al maniquí, pulsa `T` para entrar en combate.

- [ ] Parado y encarado, el personaje ataca solo, a intervalos regulares.
- [ ] **Si te mueves, el golpe se cancela.** No se aplica daño.
- [ ] Al parar **no espera un intervalo entero de arma**: si el arma ya estaba
      lista, el golpe sale enseguida. Esto es el corazón del ritmo
      `mover → parar → normal → poder → mover`.
- [ ] De espaldas al objetivo no se puede atacar, y el HUD explica por qué.
- [ ] Fuera de rango tampoco, y también lo explica.
- [ ] El golpe **se ve** llegar: hay anticipación, impacto y recuperación, y el
      daño aparece en el momento del impacto, no antes.

## 4 · Weaving: normal + poder (2 min)

- [ ] Encadenar `normal → poder` se siente fluido, no como dos acciones
      pegadas con cinta adhesiva.
- [ ] Pedir un poder mientras el normal está en preparación **prioriza el
      poder**; no se pierde el input.
- [ ] Pulsar dos habilidades muy seguidas ejecuta **la última válida**, no
      almacena una cola de cuatro.
- [ ] El GCD se nota pero no ahoga: sigue pudiendo pegarse el normal.

## 5 · Mago (2 min) — Arcanista

- [ ] El casteo tiene barra y **el cuerpo lo cuenta**: hay una preparación
      visible, no un fogonazo.
- [ ] **Moverse durante el casteo lo cancela** y **no cobra recurso ni
      cooldown**. Comprueba el maná antes y después.
- [ ] `Escape` cancela igual, con el mismo resultado.
- [ ] El proyectil sale **al terminar** el casteo, no al empezarlo.
- [ ] Con una columna en medio, el hechizo **no llega**: la línea de visión se
      respeta y el HUD lo dice.
- [ ] El báculo pesa: se retrasa un poco respecto a la mano, no va soldado.
- [ ] El pulso básico del báculo se distingue a simple vista de un hechizo
      completo.

## 6 · Arquero (1.5 min) — Centinela

- [ ] `alzar → tensar → soltar` se lee. La flecha aparece encajada mientras
      tensa y sale al soltar.
- [ ] Al disparar el arco **retrocede** un instante.
- [ ] Strafeando, la animación de piernas es de strafe: **no** es la de correr
      de frente girada de lado.
- [ ] Se puede empezar a mover el poder justo después de soltar el normal.

## 7 · Control (CC) y counters (1.5 min) — Guardián / Vinculador

- [ ] Un aturdimiento se lee **de pie y tambaleante**; un derribo se lee **en el
      suelo**. No son la misma animación.
- [ ] Levantarse **cuesta**: la salida es más lenta que la entrada.
- [ ] Encadenar cuatro controles seguidos **deja de funcionar** (fatiga de
      control). Es intencionado: si no, existiría el bucle infinito.
- [ ] El silencio impide lanzar y **se ve** en la cabeza y las manos.
- [ ] Una barrera se ve encima de la vida, no en lugar de ella, y absorbe.
- [ ] Un counter (bloqueo, anulación, reflejo) se distingue de un fallo normal.

## 8 · Las seis clases, en gris (1 min) — **el gate de identidad**

Pasa por las seis clases en el lobby y mira sólo la **silueta**:

DEVASTADOR · GUARDIÁN · CENTINELA · RASTREADOR · ARCANISTA · VINCULADOR

- [ ] **Si estuvieran todas en gris y sin nombre, ¿las distinguirías?**
- [ ] ¿El Guardián se lee como una muralla y el Devastador como un atacante?
- [ ] ¿El Rastreador es algo más que «un Centinela verde»?
- [ ] ¿El Vinculador es algo más que «un Arcanista recoloreado»?

> Si la respuesta a la primera es **no**, dilo aunque el número diga que sí.
> Las nueve filas de identidad visual se cerraron con un 18.5 % de diferencia de
> contorno medida entre la peor pareja, pero una diferencia estadística no
> garantiza una diferencia perceptual. **Tu ojo manda sobre la métrica.**

## 9 · Bots y partida completa (3 min)

- [ ] Juega **una partida 1v1 entera** contra el bot.
- [ ] El bot se mueve con intención: mantiene distancia si es a distancia, entra
      si es cuerpo a cuerpo. No corre en línea recta hacia ti siempre.
- [ ] El bot **no se atasca** contra una columna ni contra un muro.
      *(Sabemos que la IA aún no usa las rutas de cobertura del mapa. Está
      documentado en `FUTURE_DECISIONS.md`. Lo que importa es que no se quede
      clavado.)*
- [ ] El reloj de partida avanza a velocidad real.
- [ ] Al morir alguien, la partida termina y sale la pantalla de resultados.
- [ ] Los resultados cuentan la partida, no sólo quién ganó.
- [ ] El rating cambia y se ve el cambio.
- [ ] `R` o el botón de revancha reinicia limpio, sin arrastrar cooldowns ni
      estados de la partida anterior.
- [ ] Juega **una 2v2**. El aliado hace algo útil.
- [ ] Vuelve al lobby y empieza otra. Nada se degrada.

## 10 · Rendimiento, a ojo

- [ ] ¿Va fluido? En cuanto se pueda, dame **FPS reales de una máquina con GPU**:
      en el contenedor de CI se pinta por software y publicar esos fotogramas
      como si fueran los del jugador sería inventar el dato más importante.
- [ ] ¿Hay tirones concretos? ¿Cuándo — al lanzar un hechizo, al morir alguien,
      al entrar en combate?

---

## Lo que ya sabemos que falta — no hace falta reportarlo

1. **Pointer Lock** está sin verificar automáticamente: es la fila
   `MANUAL_BROWSER_REQUIRED`. Justamente el punto 2 la cierra.
2. **La IA no usa las rutas de cobertura** que la arena ofrece. Hubo una versión
   que las usaba y era **peor** —el bot se pegaba a la cara cercana de la columna
   y moría ahí—, así que se revirtió. Necesita navegación por tangentes.
3. **Ninguna regla premia la altura** de las plataformas todavía.
4. **60 FPS sin verificar**: no hay GPU en el contenedor y no se inventa.

## Lo que más me interesa que me digas

En orden:

1. **¿El combate divierte?** Todo lo demás es corregible.
2. ¿El ritmo `mover → parar → normal → poder` se siente táctico o se siente
   lento?
3. ¿Las seis clases se distinguen **jugando**, no sólo mirándolas?
4. ¿Qué es lo primero que te ha molestado?
