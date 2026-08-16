# Desplegar en Hostinger — Project Arena v0.12 · ELEMENTAL SPELL PASS

## Cómo saber que Hostinger sirve ESTA versión

La captura del playtest anterior mostraba **ALPHA 0.8**. Eso prueba que el hosting estaba sirviendo una build vieja o caché antigua. v0.12 tiene tres marcas independientes para evitar repetirlo.

### 1. Cabecera visible

En el juego debe verse:

`ALPHA 0.12`

Y la línea de versión contiene:

`v0.12 · ELEMENTAL SPELL PASS · CAMERA COMFORT · POWER FIDELITY`

### 2. Consola F12

```js
Arena.VERSION   // "0.12.0"
Arena.BUILD     // "elemental-spell-animation-camera-v012"
```

### 3. Sello de caché

Todos los scripts y CSS del entrypoint llevan:

`?build=v0120-20260814-elemental-camera`

El árbitro comprueba el sello.

## Subida limpia recomendada

1. Haz copia del contenido actual de `public_html`.
2. Borra los ficheros de la build vieja antes de subir la nueva. No mezcles v0.8/v0.11/v0.12.
3. Sube **todo** el contenido del ZIP v0.12, incluyendo archivos ocultos como `.htaccess` si están presentes.
4. Abre el sitio con `Ctrl+F5` o ventana incógnita.
5. Verifica `ALPHA 0.12` y los dos valores de consola anteriores.
6. Si sigue apareciendo 0.8, limpia la caché de Hostinger/CDN y vuelve a probar.

## HTTPS

Pointer Lock requiere contexto seguro en despliegue remoto. Comprueba:

```js
window.isSecureContext // true
```

## Gates antes de subir

```bash
node tools/run-tests.js
node tools/run-agents.js
node tools/arbiter.js
node tools/visual-audit.js
```

El smoke local con Chromium no puede cerrarse en el entorno de build actual porque la política administrada bloquea `127.0.0.1` antes de cargar JavaScript. La evidencia está en `docs/QA_BROWSER_POLICY_BLOCK_V012.png`. En Hostinger sí debe repetirse el smoke/playtest manual.

## Playtest prioritario de v0.12

1. Arcanista: página 1 de barra debe empezar por los doce poderes firma.
2. Orbe de Ascua debe viajar como proyectil y explotar al impactar, no al comenzar el cast.
3. Estallido Glacial debe ralentizar sólo 2 s.
4. Descarga Fulmínea debe comunicar electricidad durante 5 s.
5. Cometa de Ceniza debe leer como meteorito desde cámara MMO.
6. Q/E deben girar cuerpo y cámara juntos.
7. Arrastre izquierdo debe hacer que cuerpo y cámara roten 1:1.
8. Arrastre derecho debe seguir siendo free-look sin girar el cuerpo.
