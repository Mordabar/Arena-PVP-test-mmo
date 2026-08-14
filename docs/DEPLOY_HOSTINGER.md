# Desplegar en Hostinger — Ladder Vertical Slice v0.9 · PLAYTEST

> Esta es la versión preparada para el **primer playtest humano**. Nadie ha
> jugado el build todavía; todo lo verde del ledger es medición.
>
> Cuando esté arriba: **`docs/PLAYTEST_CHECKLIST.md`** (10–15 min) y
> **`docs/POINTER_LOCK_MANUAL.md`** (1 min, cierra la última fila del ledger).

---

## Cómo saber que Hostinger sirve ESTA versión

Es el problema que más veces ha mordido en este proyecto: el hosting cachea los
`.js` con agresividad y se acaba probando la versión anterior creyendo que se
prueba la nueva.

**Dos comprobaciones, las dos obligatorias:**

1. En el lobby, la línea bajo el título dice literalmente:

   ```
   Ladder Vertical Slice · v0.9 · PLAYTEST · Tactical Rhythm · Three.js 0.160 · seis identidades de clase
   ```

2. En la consola del navegador (F12):

   ```js
   Arena.VERSION   // "0.9.0"
   Arena.BUILD     // "ladder-vertical-slice-v09-playtest"
   ```

Si sale `v0.8` o `0.8.0`, **no estás jugando esta build**. Borra el contenido
anterior del servidor y vuelve a subir, o fuerza recarga dura (Ctrl+F5 / Cmd+Shift+R).

El sello de caché de esta entrega es **`v090-20260814-playtest`** y va en la
query de los ~50 `<script src>` de `index.html`. El árbitro comprueba que estén
todos: `node tools/arbiter.js`.

---

## Qué subir

Todo el proyecto tal cual. **Sin backend, sin build step, sin npm.**

```
arena/
    index.html          ← el juego. Es el único entrypoint.
    .htaccess           ← archivo OCULTO. Comprueba que se haya subido.
    css/  js/  assets/  vendor/  docs/
```

Todas las rutas son **relativas**: funciona igual en
`https://dominio.com/arena/` que en `https://arena.dominio.com/`. No hay nada
que configurar entre un caso y el otro.

**Pasos:**

1. Copia de seguridad del sitio anterior.
2. **Borra** el contenido anterior en `public_html` (no sobrescribas encima: un
   fichero viejo que ya no existe en esta versión seguiría sirviéndose).
3. Sube el proyecto completo, incluido el `.htaccess`.
4. Abre el sitio y haz las dos comprobaciones de versión de arriba.

---

## HTTPS no es opcional

**Pointer Lock sólo se concede sobre HTTPS o localhost.** Sobre `http://` en un
dominio remoto el navegador lo rechaza, y con él se cae el control de cámara con
el botón izquierdo, que es la mitad del control del juego.

Hostinger da certificado gratuito; asegúrate de que está activo y de que el
sitio redirige a `https://`. Para verificarlo desde el propio juego:

```js
window.isSecureContext   // tiene que ser true
```

---

## Por qué Three.js va en `vendor/` y no en un CDN

El import map está —es lo que resuelve el nombre `three`— pero apunta a
`vendor/three-0.160.0/`, dentro del propio proyecto:

1. **Un CDN caído deja el juego sin arrancar.** Un juego que necesita que un
   tercero esté disponible para dibujar un suelo no se hospeda tranquilo.
2. **Una sola versión, garantizada.** Three y sus addons salen del mismo
   directorio, así que el navegador no puede mezclar dos versiones.
3. **Se pudo verificar.** El entorno de desarrollo bloquea los CDN; con un
   import map remoto no se habría podido ejecutar ni una vez antes de entregar.

`index.html` usa módulos ES, así que **no se abre con doble clic** (`file://`):
el navegador los bloquea por política de origen cruzado. Es el estándar, no una
decisión del proyecto. En local:

```
node tools/serve.js
→ http://localhost:8080/index.html
```

En Hostinger no hace falta: el hosting ya sirve por HTTPS.

---

## Verificación antes de subir

```bash
node tools/run-tests.js     # 288/288
node tools/arbiter.js       # ARBITER: APROBADO
node tools/run-gates.js     # once puertas, la última pinta y tarda varios minutos
```

Si cualquiera termina en rojo, no subas.

---

## Qué lleva la v0.9 que no llevaba la v0.8

- **Seis identidades de clase.** Antes había tres familias de arquetipo y las
  seis clases eran tres parejas de gemelos (0.3 % de diferencia de contorno
  entre centinela y rastreador). Ahora el peor par difiere un 18.5 %, medido
  desde tres vistas. El equipo es un sistema de datos, no seis casos especiales.
- **Audio verificado en partida real**: 31 rutas, 55 cues, los 25 motivos de
  rechazo. Estaba escrito pero nadie lo había ejecutado.
- **Diagnóstico de Pointer Lock** con F9 o `?diag=pointerlock`.
- Arena rediseñada como nivel medido, cámara que ya no atraviesa las
  plataformas, HUD sin solapes, y el P0 por el que la presentación de Three.js
  no disparaba **ninguna** animación de combate.

## Lo que sigue sin estar cerrado, y se sabe

1. **Pointer Lock** — `MANUAL_BROWSER_REQUIRED`. Lo cierras tú en un minuto con
   `docs/POINTER_LOCK_MANUAL.md`.
2. **60 FPS** — sin medir. En el contenedor de CI se pinta por software y
   publicar esos fotogramas como si fueran los del jugador sería inventar el
   dato. Hace falta una máquina con GPU: la tuya.
3. **La IA no usa las rutas de cobertura** del mapa. Hubo una versión que sí y
   era peor (el bot moría pegado a la columna); está revertida y documentada en
   `FUTURE_DECISIONS.md`.
4. **Nadie ha jugado esto.** Ese es el punto de este despliegue.
