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
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createThreeRenderer } from './threeRenderer.js?build=v0160-20260816-ual2-retarget';

var Arena = window.Arena;

try {
  if (!Arena || !Arena.Render || !Arena.Render.RendererBackend) {
    throw new Error('El núcleo del juego no se ha cargado antes que el bootstrap de Three.js.');
  }

  /* GLTFLoader se construye ya, aunque todavía no haya modelos: el día que
     existan los .glb, el backend de personajes lo recibe sin tocar el arranque.
     Cargar una malla NUNCA será responsabilidad de gameplay. */
  var glbLoader = new GLTFLoader();
  /* Cuerpo + biblioteca CC0 se precargan antes del boot: el jugador nunca ve
     una transición de maniquí a modelo ni una animación que aparece tarde. */
  var loaded = await Promise.all([
    glbLoader.loadAsync('./assets/models/dark-elf-base-rigged-50k.glb?build=v0160'),
    glbLoader.loadAsync('./assets/animations/ual2-standard.glb?build=v0160')
  ]);
  var baseCharacterGltf = loaded[0], animationLibraryGltf = loaded[1];
  var skinnedCount = 0;
  baseCharacterGltf.scene.traverse(function (o) {
    if (!o.isSkinnedMesh) return;
    skinnedCount++;
    /* La decimación a 50k preservó triángulos pero dejó normales visualmente
       facetadas. Eliminamos la normal importada, soldamos vértices compatibles
       (UV/skin weights incluidos) y recalculamos normales suaves. No cambia
       topología de triángulos ni pesos del rig. */
    var g = o.geometry.clone();
    if (g.getAttribute('normal')) g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-5);
    g.computeVertexNormals();
    g.normalizeNormals();
    o.geometry = g;
    var mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(function (m) { if (m) { m.flatShading = false; if(m.normalScale)m.normalScale.set(0.42,0.42); if(m.roughness!==undefined)m.roughness=Math.max(m.roughness,0.68); m.needsUpdate = true; } });
  });
  if (!skinnedCount) throw new Error('El GLB base cargó pero no contiene SkinnedMesh.');
  var required=['Walk_Carry_Loop','Sword_Regular_A','Sword_Regular_B','Sword_Heavy_Combo','Sword_Block','NinjaJump_Start','NinjaJump_Idle_Loop','NinjaJump_Land'];
  var available=new Set((animationLibraryGltf.animations||[]).map(function(c){return c.name;}));
  required.forEach(function(n){ if(!available.has(n)) throw new Error('UAL2 incompleta: falta '+n); });

  Arena.Render.RendererBackend.register('three', function (canvas, world) {
    return createThreeRenderer(Arena, canvas, world, {
      glbLoader: glbLoader, baseCharacterGltf: baseCharacterGltf,
      animationLibraryGltf: animationLibraryGltf
    }).init();
  });

  window.ARENA_RENDERER = 'three';
  window.ARENA_THREE = THREE;      // sólo para depuración desde consola

  Arena.Game.boot();
} catch (err) {
  if (Arena && Arena.Game && Arena.Game.showFatal) Arena.Game.showFatal(err);
  throw err;
}
