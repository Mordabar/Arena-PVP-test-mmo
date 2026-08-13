# Tactical Rhythm v0.6 — despliegue

Para confirmar que Hostinger sirve esta build, la cabecera del juego debe mostrar:

`Tactical Rhythm · v0.6 · Arcane Wilds · Three.js 0.160 · RELEASE + weaving`

El cache-busting de esta entrega es `v060-20260812-0917`. Sobrescribe todos los archivos de la versión anterior.

---

# Publicar en Hostinger

Archivos estáticos. Sin backend, sin build, sin npm.

## Qué subir

Todo el proyecto tal cual:

```
arena/
    index.html            ← WebGL2 nativo
    index-three.html      ← Three.js
    css/  js/  assets/  vendor/  docs/
```

Todas las rutas son **relativas**, así que funciona igual en
`https://dominio.com/arena/` que en `https://arena.dominio.com/`. No hay nada
que configurar entre un caso y el otro.

## Las dos páginas

| | `index.html` | `index-three.html` |
|---|---|---|
| Motor | WebGL2 nativo + GLSL propio | Three.js 0.160 |
| Dependencias | ninguna | Three.js, servido desde `vendor/` |
| Doble clic (`file://`) | **sí** | **no** — necesita HTTP |
| En hosting | funciona | funciona |

`index-three.html` no se abre con doble clic porque usa **módulos ES**, y el
navegador los bloquea sobre `file://` por política de origen cruzado. No es una
decisión del proyecto: es cómo funciona el estándar. En local:

```
node tools/serve.js
→ http://localhost:8080/index-three.html
```

En Hostinger no hace falta nada de eso: el hosting ya sirve por HTTPS.

## Por qué Three.js va en vendor/ y no en un CDN

El brief pedía import map + CDN. El import map está —es lo que resuelve el
nombre `three`—, pero apunta a `vendor/three-0.160.0/`, dentro del propio
proyecto. Tres motivos:

1. **Un CDN caído deja el juego sin arrancar.** Un juego que necesita que un
   tercero esté disponible para dibujar un suelo no se hospeda tranquilo.
2. **Una sola versión, garantizada.** Three y sus addons salen del mismo
   directorio, así que es imposible que el navegador mezcle dos versiones.
3. **Se pudo verificar.** El entorno donde se desarrolló esto bloquea los CDN;
   con un import map remoto no habría sido posible ejecutar ni una vez la
   versión de Three.js antes de entregarla.

Para volver a un CDN basta con cambiar dos rutas en `index-three.html`:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
```

El mismo número de versión en las dos líneas. Eso es lo que importa.

## Comprobado

La simulación produce **exactamente lo mismo** en las dos presentaciones. Un
duelo de bots de 777 ticks con la misma semilla, ejecutado en navegador sobre
cada página:

| | WebGL2 nativo | Three.js |
|---|---|---|
| tiempo | 25.9000 s | 25.9000 s |
| vida A | 181.546 | 181.546 |
| posición A | (−15.5500, 8.8290) | (−15.5500, 8.8290) |
| ticks | 777 | 777 |

Idéntico hasta el último decimal, que es lo que significa que Three.js sea
únicamente presentación.

## Rendimiento

En escritorio, con la escena de 2v2: ~135 draw calls y ~11 400 triángulos. Una
sola luz direccional con sombras, geometrías y materiales compartidos, y cero
objetos creados por fotograma. No hay post-procesado.

## Visual pass v0.4 — Verdant Ruins

Esta entrega está pensada para evitar dos problemas que se vieron en el hosting:
archivos antiguos en caché y la inversión visual de A/D.

**Para desplegar esta versión:**

1. Haz copia del sitio anterior.
2. Sobrescribe **todo** el contenido del proyecto en `public_html` (o elimina la
   versión anterior y sube esta completa).
3. Comprueba que también se haya subido el archivo oculto `.htaccess`.
4. Abre `index-three.html`. En la parte superior debe verse literalmente
   `Verdant Ruins · v0.4`. Si sigue apareciendo `v0.3`, el servidor/navegador
   todavía está sirviendo archivos anteriores.

La v0.4 incluye:

- corrección de strafe perceptual: mirando a +Z con la cámara detrás, `D` se
  desplaza hacia la derecha visible (−X) y `A` hacia la izquierda visible (+X);
- la misma convención se aplica a locomoción, foot locking y tests;
- escenario visual **Verdant Ruins** sobre el mismo mapa lógico 32×24;
- los colliders de columna se representan como árboles antiguos, por lo que la
  cobertura visual coincide con LoS/colisión;
- césped/camino procedural, bosque exterior, arbustos, flores, rocas, terrazas,
  ruinas, banderas y braseros;
- cielo degradado, fog, iluminación cálida y sombras;
- siluetas low-poly más claras por arquetipo y materiales separados;
- ajuste adicional de locomoción del caster y encuadre inicial de cámara;
- HUD Three.js `Verdant Glass`;
- cache-busting de CSS/JS y cabeceras no-cache durante esta etapa de desarrollo.

### Verificación rápida

Puedes ejecutar:

```bash
node tools/run-tests.js
node tools/visual-audit.js
```

La entrega debe terminar con **156/156 pruebas** y con el árbitro estático
`ARBITER: APROBADO`.

No se añadieron dependencias ni build step. Three.js sigue vendorizado en
`vendor/three-0.160.0/`.


## Game Feel v0.5 — Arcane Wilds

Sube **todo el contenido** del ZIP reemplazando la versión anterior. La cabecera visible debe mostrar:

`Arcane Wilds · v0.5 · Three.js 0.160`

La v0.5 añade:

- mapa lógico 46×34 con segunda corona de cobertura;
- salto con `Espacio`;
- click izquierdo sostenido = cámara + cuerpo usando el mismo delta angular del mouse;
- click derecho sostenido = free-look sin girar el avatar;
- casteo y locomoción del mago refinados;
- VFX de casteo/impacto y proyectiles mágicos/flechas visibles;
- iconos SVG locales por habilidad;
- cache-busting `v050-20260811-1635`.

Si la cabecera sigue mostrando v0.4, Hostinger está sirviendo archivos antiguos: elimina/sobrescribe el contenido anterior y fuerza una recarga dura.
