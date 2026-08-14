# Pointer Lock — la única fila que no se puede automatizar

**Estado en el ledger: `MANUAL_BROWSER_REQUIRED`.** No es un defecto del juego y
no es una fila que se pueda marcar verde desde aquí.

---

## Por qué

Pointer Lock exige un **gesto humano real**. Chromium rechaza cualquier
`requestPointerLock()` que nazca de un evento sintético, y lo dice con estas
palabras exactas cuando el arnés lo intenta:

```
WrongDocumentError: The root document of this element is not valid for pointer lock.
```

Es una decisión de seguridad del navegador, no un fallo del producto. Ninguna
cantidad de ingenio en el arnés la cambia, y perseguirla bloqueaba nueve tareas
de producto por una limitación de la herramienta de QA.

## Qué SÍ está automatizado y en verde

Esto se comprueba en cada ejecución de `node tools/run-gates.js`:

| Comprobación | Dónde |
|---|---|
| El arrastre izquierdo **solicita** Pointer Lock por la ruta real del jugador | `tools/scripts/pointerlock-gate.json` |
| El arrastre izquierdo gira cámara y cuerpo **1:1**, con eventos de ratón reales | `tools/scripts/mouse-sweep.json` |
| El arrastre derecho gira la cámara y **no** el cuerpo | `tools/scripts/mouse-sweep.json` |
| El deadzone: un clic corto selecciona y **no** mueve la cámara | `tools/scripts/control-sweep.json` |
| El diagnóstico manual existe, se abre, se cierra y no escribe simulación | `tools/scripts/pointerlock-gate.json` |

Lo único que falta es que **el navegador conceda la captura del cursor**, y eso
sólo lo concede a una persona.

---

## Procedimiento manual — 60 segundos

Requiere **HTTPS o localhost**. Pointer Lock no se concede sobre `http://` en un
dominio remoto, así que sobre Hostinger tiene que ser el dominio con certificado.

1. Abre el juego con el diagnóstico ya desplegado:

   ```
   https://TU-DOMINIO/index.html?diag=pointerlock
   ```

   (o entra normal y pulsa **F9** en cualquier momento).

2. Empieza una partida cualquiera. Abajo a la izquierda aparece el panel
   **DIAGNÓSTICO · POINTER LOCK** con seis líneas en gris.

3. **Mantén pulsado el botón izquierdo** sobre el juego y **arrastra el ratón en
   horizontal** al menos medio segundo, girando claramente (más de ~15°).

   Mientras arrastras deben ponerse en verde:
   - `Mantener el botón IZQUIERDO sobre el juego`
   - `Pointer Lock activo mientras se arrastra`
   - `El cursor desaparece`

4. **Suelta** el botón. Deben ponerse en verde:
   - `El ratón horizontal gira cámara y cuerpo 1:1` — al lado sale la relación
     medida, `cuerpo/cámara`. Tiene que estar entre **0.94 y 1.06**.
   - `Al soltar vuelve el cursor y se libera el lock`

5. **Mantén pulsado el botón derecho** y arrastra en horizontal girando
   claramente. Debe ponerse en verde:
   - `Botón DERECHO: gira la cámara y NO el cuerpo` — al lado salen los dos
     giros; el del cuerpo tiene que ser prácticamente **0**.

6. El panel termina en una de estas tres líneas:

   ```
   PASA · Pointer Lock verificado a mano
   PENDIENTE · faltan N por comprobar
   FALLA · N comprobación(es) en rojo
   ```

## Cómo dejar constancia

Con el panel abierto, en la consola del navegador:

```js
copy(Arena.UI.PointerLockDiag._panel.report())
```

Eso deja en el portapapeles un informe con fecha, `user-agent`, origen, si el
contexto es seguro y el resultado de las seis líneas. Pegándolo aquí, la fila
del ledger pasa de `MANUAL_BROWSER_REQUIRED` a `VERIFIED` con evidencia.

## Si alguna línea sale en rojo

| Línea en rojo | Qué mirar primero |
|---|---|
| `Pointer Lock activo` | ¿Estás en HTTPS o localhost? El panel dice `contexto seguro` en el informe. Firefox pide un permiso extra la primera vez. |
| `El cursor desaparece` | Es la misma condición que la anterior: el cursor lo esconde el navegador al conceder el lock. |
| `1:1` fuera de 0.94–1.06 | Hay suavizado o tope de giro donde no debe haberlo. `CLAUDE.md` §4.2 es explícito: `deltaYawCharacter === deltaYawCamera`. |
| `Al soltar vuelve el cursor` | `Game._exitPointerLock` no se está llamando en `mouseup`. |
| `Botón DERECHO gira el cuerpo` | La mirada libre está escribiendo en el yaw del jugador. `CLAUDE.md` §4.3. |
