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
import { createThreeRenderer } from './threeRenderer.js?build=v0340-20260820-warrior-facing';
import { loadCmuClips } from './threeCmuClips.js?build=v0340-20260820-warrior-facing';

var Arena = window.Arena;

try {
  if (!Arena || !Arena.Render || !Arena.Render.RendererBackend) {
    throw new Error('El núcleo del juego no se ha cargado antes que el bootstrap de Three.js.');
  }

  /* v0.34 · WARRIOR UAL LITERAL + NATURAL TIMING + WORLD-FORWARD BOW IK.
     El Humanoid nativo de Quaternius es ahora el ÚNICO cuerpo de runtime para
     las seis subclases. Ya no se descarga ni se retargetea el legacy retarget body. UAL1
     aporta cuerpo+skin+locomoción/caster y UAL2 aporta acciones complementarias.
     Ambos comparten exactamente el mismo rig de 65 joints. */
  var glbLoader = new GLTFLoader();
  var loaded = await Promise.all([
    glbLoader.loadAsync('./assets/animations/ual1-arena-runtime.glb?build=v0340'),
    glbLoader.loadAsync('./assets/animations/ual2-melee-runtime.glb?build=v0340'),
    glbLoader.loadAsync('./assets/animations/ual2-rm-runtime.glb?build=v0340'),
    loadCmuClips('./assets/animations/arena-cmu-v031.json?build=v0340')
  ]);
  var ual1Gltf = loaded[0], ual2Gltf = loaded[1], ual2RmGltf = loaded[2], cmuLibrary = loaded[3];

  var mergedAnimations = [], seenAnim = new Set();
  function appendLibrary(gltf) {
    (gltf.animations || []).forEach(function (clip) {
      if (!seenAnim.has(clip.name)) { seenAnim.add(clip.name); mergedAnimations.push(clip); }
    });
  }
  appendLibrary(ual1Gltf);
  appendLibrary(ual2Gltf);
  appendLibrary(ual2RmGltf);
  (cmuLibrary.clips || []).forEach(function (clip) {
    if (!seenAnim.has(clip.name)) { seenAnim.add(clip.name); mergedAnimations.push(clip); }
  });
  var animationLibraryGltf = { scene: ual1Gltf.scene, animations: mergedAnimations };
  Arena.Render.animationSourceReport = {
    body: 'Quaternius UAL native humanoid',
    joints: 65,
    ual1: (ual1Gltf.animations || []).length,
    ual2: (ual2Gltf.animations || []).length,
    ual2rm: (ual2RmGltf.animations || []).length,
    cmu: (cmuLibrary.clips || []).length,
    cmuSource: 'Anims_Only_FBX_V1.zip (locomotion/kick only)',
    merged: mergedAnimations.length,
    darkElfLoaded: false
  };

  var skinnedCount = 0;
  ual1Gltf.scene.traverse(function (o) {
    if (!o.isSkinnedMesh) return;
    skinnedCount++;
    if (!o.geometry.getAttribute('normal')) {
      o.geometry.computeVertexNormals();
      o.geometry.normalizeNormals();
    }
    var mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(function (m) {
      if (!m) return;
      m.flatShading = false;
      if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.72);
      m.needsUpdate = true;
    });
  });
  if (!skinnedCount) throw new Error('UAL1 runtime no contiene SkinnedMesh para el cuerpo base.');

  /* Sólo exigimos aquí clips QUE EXISTEN en los Standard suministrados. Las
     animaciones Source/Pro solicitadas por el usuario se auditan por separado
     y nunca se falsifican con aliases silenciosos. */
  var required = [
    'Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Death01','Hit_Chest','Hit_Head','Sword_Idle',
    'Jump_Start','Jump_Loop','Jump_Land',
    'Spell_Simple_Enter','Spell_Simple_Exit','Spell_Simple_Idle_Loop','Spell_Simple_Shoot',
    'Idle_Shield_Loop','Shield_OneShot','Sword_Dash','Sword_Block','Yes',
    'Sword_Regular_A','Sword_Regular_A_Rec','Sword_Regular_B','Sword_Regular_B_Rec','Sword_Regular_C',
    'Slide_Start','Slide_Loop','Slide_Exit','Shield_Dash_RM',
    'Arena_CMU_Walk_Backward','Arena_CMU_Strafe_Left','Arena_CMU_Strafe_Right',
    'Arena_CMU_Diagonal_FL','Arena_CMU_Diagonal_FR','Arena_CMU_Diagonal_BL','Arena_CMU_Diagonal_BR',
    'Arena_CMU_Turn_Left','Arena_CMU_Turn_Right','Arena_CMU_Kick'
  ];
  var available = new Set((animationLibraryGltf.animations || []).map(function(c){ return c.name; }));
  required.forEach(function(n){ if(!available.has(n)) throw new Error('Biblioteca UAL runtime incompleta: falta '+n); });

  /* v0.30 semantic report: rejected body motions are deliberately absent from
     runtime, while missing directional/source clips remain auditable. */
  Arena.Render.requestedSourceClips = {
    exactContract: required.slice(),
    missing: required.filter(function(n){return !available.has(n);}),
    available: required.filter(function(n){return available.has(n);}),
    userLockedWarrior: ['Hit_Chest','Hit_Head','Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land','Sword_Idle','Idle_Shield_Loop','Sword_Regular_A','Sword_Regular_A_Rec','Sword_Regular_B','Sword_Regular_B_Rec','Sword_Regular_C','Shield_Dash_RM','Shield_OneShot','Slide_Start','Slide_Loop','Slide_Exit'],
    archerVideoContract: {requested:['Bow_Aim_Neutral','Bow_Notch','Bow_Shoot','Bow_RapidShoot'],fallbacks:['Arena_Archer_VideoReady','Arena_Archer_VideoNotch','Arena_Archer_VideoShoot','Arena_Archer_VideoBuff']},
    cmuImplemented: ['walkBackward','strafeLeft','strafeRight','diagonalForwardLeft','diagonalForwardRight','walkBackLeft','walkBackRight','turnLeft','turnRight','kick']
  };
  Arena.Render.RendererBackend.register('three', function (canvas, world) {
    return createThreeRenderer(Arena, canvas, world, {
      glbLoader: glbLoader,
      baseCharacterGltf: ual1Gltf,
      animationLibraryGltf: animationLibraryGltf,
      meleeBaseCharacterGltf: ual1Gltf
    }).init();
  });

  window.ARENA_RENDERER = 'three';
  window.ARENA_THREE = THREE;      // sólo para depuración desde consola

  Arena.Game.boot();
} catch (err) {
  if (Arena && Arena.Game && Arena.Game.showFatal) Arena.Game.showFatal(err);
  throw err;
}
