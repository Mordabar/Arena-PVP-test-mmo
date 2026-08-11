/* =============================================================================
 * render/three/threeCharacter.js — Humanoides low-poly gobernados por la
 * animación que ya existe.
 *
 * ESTE FICHERO NO INVENTA UN SISTEMA DE ANIMACIÓN.
 *
 * Toda la locomoción, el foot locking, las fases de acción, el casteo y el
 * lenguaje corporal del control ya están resueltos y verificados por 149
 * pruebas. Aquí sólo se reciben las matrices que produce `CharacterBackend` y
 * se aplican a mallas de Three.js. Por eso cambiar de renderer no cambia la
 * zancada, ni los tiempos de ataque, ni cómo se siente frenar.
 *
 * La consecuencia práctica: `buildPose` devuelve una lista de piezas con
 * nombre de malla y matriz. Este módulo crea UNA malla por pieza la primera
 * vez y después sólo copia matrices. Cero geometría nueva por fotograma.
 *
 * RUTA FUTURA
 *
 *   ProceduralLowPolyCharacter   ← lo que hay hoy
 *            ↓  mismo AnimationIntent
 *   GLBSkinnedCharacter          ← cuando existan los .glb
 *
 * `createCharacterFactory` acepta un cargador de GLB opcional. Cuando el
 * modelo exista, la ruta procedural se apaga sola por personaje, sin tocar
 * nada de simulación. Ver docs/RENDERER_MIGRATION.md.
 * ========================================================================== */
import * as THREE from 'three';

/* Materiales por material lógico. La capa de animación ya clasifica cada pieza
   (piel, tela, cuero, metal, madera, magia): reutilizamos esa clasificación en
   vez de inventar otra que se desincronizaría. */
const MATERIAL_PRESETS = {
  SKIN:    { roughness: 0.72, metalness: 0.02 },
  CLOTH:   { roughness: 0.96, metalness: 0.00 },
  LEATHER: { roughness: 0.80, metalness: 0.04 },
  METAL:   { roughness: 0.34, metalness: 0.72 },
  WOOD:    { roughness: 0.86, metalness: 0.02 },
  MAGIC:   { roughness: 0.22, metalness: 0.10 }
};

/** Convierte la geometría procedural del proyecto a BufferGeometry. */
function toBufferGeometry(data) {
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  if (data.normals) geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  if (data.uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  geo.setIndex(data.indices);
  if (!data.normals) geo.computeVertexNormals();
  return geo;
}

export function createCharacterFactory(Arena, scene, opts) {
  opts = opts || {};
  var Backend = Arena.Render.CharacterBackend;

  /* --- Geometrías compartidas -------------------------------------------
   * Se suben UNA vez. Cuarenta personajes comparten las mismas cuarenta y
   * pico geometrías; lo único que difiere entre ellos son matrices y color. */
  var geometries = Object.create(null);
  var meshData = Backend.current.buildMeshes();
  for (var name in meshData) {
    if (Object.prototype.hasOwnProperty.call(meshData, name)) {
      geometries[name] = toBufferGeometry(meshData[name]);
    }
  }

  /* Caché de materiales por (material lógico + color). Sin ella, cada pieza de
     cada personaje crearía un material nuevo y el coste de compilación de
     shaders se dispararía en el primer combate. */
  var materialCache = Object.create(null);
  function materialFor(materialKind, color, emissive) {
    var r = Math.round(color[0] * 255), g = Math.round(color[1] * 255), b = Math.round(color[2] * 255);
    var key = materialKind + '|' + r + '_' + g + '_' + b + '|' + (emissive ? 1 : 0);
    var m = materialCache[key];
    if (m) return m;
    var preset = MATERIAL_PRESETS[materialKind] || MATERIAL_PRESETS.CLOTH;
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color[0], color[1], color[2]),
      roughness: preset.roughness,
      metalness: preset.metalness,
      flatShading: true
    });
    if (emissive) {
      m.emissive = new THREE.Color(emissive[0], emissive[1], emissive[2]);
      m.emissiveIntensity = 1;
    }
    materialCache[key] = m;
    return m;
  }

  /** Nombre del material lógico de una pieza, con reserva razonable. */
  function kindOf(part) {
    var mat = part.material;
    if (!mat) return 'CLOTH';
    var presets = Arena.Render.CharacterVisual.MATERIALS;
    for (var k in presets) {
      if (Object.prototype.hasOwnProperty.call(presets, k) && presets[k] === mat) return k;
    }
    return 'CLOTH';
  }

  var _m4 = new THREE.Matrix4();

  function Character(entity) {
    this.entityId = entity.id;
    this.handle = Backend.current.createCharacter(entity);
    this.root = new THREE.Group();
    this.root.name = 'char:' + entity.id;
    scene.add(this.root);
    this.parts = [];          // mallas activas, reutilizadas entre fotogramas
    this.pose = [];
    this.usedGlb = false;
  }

  Character.prototype.update = function (entity, dt, world) {
    Backend.current.updateCharacter(this.handle, entity, dt, world);
  };

  /**
   * Aplica la pose del fotograma.
   *
   * Las mallas se reciclan: si esta vez hacen falta menos piezas que la
   * anterior, las sobrantes se ocultan en vez de destruirse. Crear y destruir
   * objetos de Three por fotograma produce microtirones de recolección de
   * basura, y ocurrirían justo en el burst, que es cuando más piezas cambian.
   */
  Character.prototype.applyPose = function (entity, pos, yaw, palette, fade, hurtTint) {
    Backend.current.buildPose(this.pose, this.handle, entity, pos, yaw, palette);

    var i;
    for (i = 0; i < this.pose.length; i++) {
      var part = this.pose[i];
      var mesh = this.parts[i];
      if (!mesh) {
        mesh = new THREE.Mesh(geometries[part.mesh], null);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;      // la matriz la damos nosotros
        this.root.add(mesh);
        this.parts[i] = mesh;
      }
      if (mesh.geometry !== geometries[part.mesh]) mesh.geometry = geometries[part.mesh];

      var col = part.color;
      if (hurtTint > 0.01) {
        col = [col[0] + hurtTint * 0.55, col[1] * (1 - hurtTint * 0.35),
               col[2] * (1 - hurtTint * 0.35)];
      }
      mesh.material = materialFor(kindOf(part), col, part.emissive);
      if (fade < 0.999) {
        // Sigilo y desvanecimiento de muerte. Se clona el material para no
        // volver transparente a todos los que comparten ese color.
        mesh.material = mesh.material.clone();
        mesh.material.transparent = true;
        mesh.material.opacity = fade;
      }
      mesh.visible = true;
      // El proyecto usa matrices column-major compatibles con WebGL, que es
      // exactamente el orden que espera Matrix4.fromArray.
      _m4.fromArray(part.matrix);
      mesh.matrix.copy(_m4);
      mesh.matrixWorldNeedsUpdate = true;
    }
    for (i = this.pose.length; i < this.parts.length; i++) this.parts[i].visible = false;
  };

  Character.prototype.dispose = function () {
    Backend.current.destroyCharacter(this.handle);
    scene.remove(this.root);
    for (var i = 0; i < this.parts.length; i++) {
      // Las geometrías son COMPARTIDAS: destruirlas aquí dejaría sin malla a
      // todos los demás personajes. Sólo se sueltan las referencias.
      this.parts[i].geometry = null;
      this.parts[i].material = null;
    }
    this.parts.length = 0;
  };

  return {
    create: function (entity) { return new Character(entity); },
    geometries: geometries,
    /* Punto de entrada del futuro backend con malla: recibiría el GLTFLoader ya
       construido y devolvería personajes con skinning que consumen el mismo
       AnimationIntent. Hoy no hay .glb, así que no se usa. */
    glbLoader: opts.glbLoader || null
  };
}
