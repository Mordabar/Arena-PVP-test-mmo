/* =============================================================================
 * render/three/bootstrap.js — Arranque de la presentación Three.js.
 *
 * POR QUÉ HACE FALTA UN ARRANQUE APARTE
 *
 * El resto del proyecto son scripts clásicos que se cargan de forma síncrona.
 * Three.js es un módulo ES, que por definición se resuelve de forma asíncrona.
 * Si `main.js` arrancara el juego al terminar de cargarse, lo haría ANTES de
 * que exista el renderer. Por eso `index-three.html` declara
 * `window.ARENA_DEFER_BOOT` y es este fichero quien da la salida cuando ya
 * tiene todo montado.
 *
 * DE DÓNDE VIENE THREE.JS
 *
 * Del propio proyecto (`vendor/three-0.160.0/`), no de un CDN, y por dos
 * motivos. El primero es que un CDN caído deja el juego sin arrancar, y un
 * juego que depende de la disponibilidad de un tercero para dibujar un suelo no
 * es un juego que se pueda hospedar tranquilo. El segundo es que así todo el
 * paquete —Three y sus addons— procede de la MISMA versión fija, sin
 * posibilidad de que el navegador mezcle dos.
 *
 * El import map sigue existiendo, así que cambiar a un CDN es editar dos líneas
 * de `index-three.html` y nada más.
 * ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createThreeRenderer } from './threeRenderer.js?build=v070-20260812-1051';

var Arena = window.Arena;

try {
  if (!Arena || !Arena.Render || !Arena.Render.RendererBackend) {
    throw new Error('El núcleo del juego no se ha cargado antes que el bootstrap de Three.js.');
  }

  /* GLTFLoader se construye ya, aunque todavía no haya modelos: el día que
     existan los .glb, el backend de personajes lo recibe sin tocar el arranque.
     Cargar una malla NUNCA será responsabilidad de gameplay. */
  var glbLoader = new GLTFLoader();

  Arena.Render.RendererBackend.register('three', function (canvas, world) {
    return createThreeRenderer(Arena, canvas, world, { glbLoader: glbLoader }).init();
  });

  window.ARENA_RENDERER = 'three';
  window.ARENA_THREE = THREE;      // sólo para depuración desde consola

  Arena.Game.boot();
} catch (err) {
  if (Arena && Arena.Game && Arena.Game.showFatal) Arena.Game.showFatal(err);
  throw err;
}
