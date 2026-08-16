# Desplegar en Hostinger — Project Arena **v0.17 · CLASS GEAR ON RIG**

> Esta es la build para el **primer playtest humano**. Trae el modelo real del
> Elfo Oscuro, las animaciones retargeteadas de UAL2 y el equipo de las seis
> clases colgado de sus huesos.
>
> Cuando esté arriba: **`docs/PLAYTEST_CHECKLIST.md`** (10–15 min) y
> **`docs/POINTER_LOCK_MANUAL.md`** (1 min, cierra la última fila del ledger).

---

## Cómo saber que Hostinger sirve ESTA versión

Es lo que más veces ha mordido en este proyecto: una captura de playtest llegó a
mostrar `ALPHA 0.8` cuando ya se había subido la 0.12. **Tres marcas
independientes**, y las tres tienen que coincidir:

### 1. Cabecera visible

```
Ladder Vertical Slice · v0.17 · CLASS GEAR ON RIG · UAL2 RETARGET · A/D STRAFE · Q/E TURN
```

### 2. Consola (F12)

```js
Arena.VERSION   // "0.17.0"
Arena.BUILD     // "class-gear-on-rig-v017"
```

### 3. Sello de caché

Los ~60 scripts y el CSS del entrypoint llevan:

```
?build=v0170-20260817-class-gear-on-rig
```

`node tools/arbiter.js` comprueba las tres. Si ves un número distinto, **no
estás jugando esta build**: borra el contenido anterior del servidor y vuelve a
subir.

---

## Qué subir

Todo el proyecto tal cual. **Sin backend, sin build step, sin npm.**

```
arena/
    index.html                          ← el juego
    .htaccess                           ← OCULTO. Comprueba que se sube.
    assets/models/                      ← Elfo Oscuro (9 MB)
    assets/animations/                  ← UAL2 Standard + licencia CC0 (5 MB)
    css/  js/  vendor/  docs/
```

**Los `assets/` pesan 14 MB y son obligatorios.** Si el modelo no carga, el
juego cae a los humanoides procedurales sin avisar: se verá "algo", pero no
esto. Comprueba en consola que `Arena.Game.renderer.visuals` tiene personajes
con `usedGlb: true`.

Rutas todas relativas: funciona igual en `https://dominio.com/arena/` que en
`https://arena.dominio.com/`.

**Pasos:**

1. Copia de seguridad del contenido actual de `public_html`.
2. **Borra** lo anterior. No mezcles v0.8 / v0.12 / v0.16 con esta.
3. Sube el proyecto completo, incluido el `.htaccess`.
4. Abre con `Ctrl+F5` o en ventana de incógnito.
5. Verifica las tres marcas de arriba.

---

## HTTPS no es opcional

**Pointer Lock sólo se concede sobre HTTPS o localhost.** Sin él se cae el
control de cámara con el botón izquierdo, que es la mitad del control del juego.

```js
window.isSecureContext   // tiene que ser true
```

---

## Por qué Three.js va en `vendor/` y no en un CDN

1. **Un CDN caído deja el juego sin arrancar.**
2. **Una sola versión, garantizada**: Three y sus addons salen del mismo sitio.
3. **Se pudo verificar**: el entorno de desarrollo bloquea los CDN.

`index.html` usa módulos ES, así que **no se abre con doble clic** (`file://`).
En local: `node tools/serve.js` → `http://localhost:8080/index.html`.

---

## Gates antes de subir

```bash
node tools/run-tests.js     # 383/383
node tools/arbiter.js       # ARBITER: APROBADO
node tools/run-gates.js     # catorce puertas; las dos últimas pintan y tardan
```

Si cualquiera termina en rojo, no subas.

---

## Qué lleva la v0.17 que no llevaba la v0.16

- **El equipo de las seis clases, sobre el modelo real.** v0.16 dibujaba
  «cuerpo + arma»: las seis clases eran el mismo elfo en ropa interior con un
  arma distinta. Ahora la coraza, el faldar, el escudo torre, la túnica, el
  sombrero, la capucha, el carcaj y las bolsas cuelgan de los 17 huesos y siguen
  al skinning en cualquier clip.
- **Verificado en 56 estados de animación** (seis clases × idle, adelante,
  atrás, strafe, normal, poder, casteo, salto, impacto y muerte): sin
  desprendimientos, sin piezas congeladas, sin pop.
- **Ajuste de volumen medido**: el torso del modelo es más ancho y más profundo
  que el del maniquí, así que las corazas cosidas a la medida antigua quedaban
  por dentro del pecho.

## Lo que sigue sin cerrar, y se sabe

1. **Pointer Lock** — `MANUAL_BROWSER_REQUIRED`. Lo cierras tú en un minuto con
   `docs/POINTER_LOCK_MANUAL.md`.
2. **60 FPS** — sin medir. En el contenedor de CI se pinta por software y
   publicar esos fotogramas como si fueran los del jugador sería inventar el
   dato más importante. Hace falta una máquina con GPU: la tuya.
3. **Strafe lateral** — UAL2 Standard no trae un clip lateral real, así que A/D
   usan una gramática propia hasta que exista uno. Míralo con atención.
4. **La IA no usa las rutas de cobertura** del mapa. Documentado en
   `FUTURE_DECISIONS.md`; hubo una versión que sí y era peor.
5. **Nadie ha jugado esto.** Ese es el punto de este despliegue.
