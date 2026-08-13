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


/* Texturas procedurales neutrales. Se tiñen con `material.color`, por lo que la
   misma textura sirve a todas las clases sin duplicar memoria. No buscan
   detalle final: rompen la apariencia de "plástico de debug" y permiten leer
   tela, cuero, madera y metal a distancia de cámara MMO. */
function patternTexture(kind) {
  var size = 64;
  var data = new Uint8Array(size * size * 4);
  function h(x, y, seed) {
    var n = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
    n = (n ^ (n >>> 13)) * 1274126177; n ^= n >>> 16;
    return (n >>> 0) / 4294967295;
  }
  var seed = { SKIN: 3, CLOTH: 11, LEATHER: 17, METAL: 23, WOOD: 31, MAGIC: 41 }[kind] || 1;
  for (var y = 0; y < size; y++) {
    for (var x = 0; x < size; x++) {
      var n = h(x, y, seed), v = 230;
      if (kind === 'CLOTH') {
        var weave = ((x % 4 === 0) ? -12 : 0) + ((y % 4 === 0) ? -8 : 0);
        v = 224 + weave + (n - 0.5) * 18;
      } else if (kind === 'LEATHER') {
        v = 214 + (n - 0.5) * 34 + Math.sin((x + y) * 0.22) * 5;
      } else if (kind === 'METAL') {
        v = 236 + (n - 0.5) * 18 + ((x + y * 3) % 29 === 0 ? -28 : 0);
      } else if (kind === 'WOOD') {
        v = 218 + Math.sin(x * 0.52 + Math.sin(y * 0.17) * 1.6) * 18 + (n - 0.5) * 9;
      } else if (kind === 'SKIN') {
        v = 238 + (n - 0.5) * 9;
      } else if (kind === 'MAGIC') {
        var cx = x - 31.5, cy = y - 31.5;
        v = 205 + Math.sin(Math.sqrt(cx * cx + cy * cy) * 0.65) * 24 + (n - 0.5) * 8;
      }
      v = Math.max(155, Math.min(255, Math.round(v)));
      var i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
    }
  }
  var tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(kind === 'WOOD' ? 1.3 : 2.2, kind === 'WOOD' ? 3.0 : 2.2);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const MATERIAL_PRESETS = {
  SKIN:    { roughness: 0.68, metalness: 0.01 },
  CLOTH:   { roughness: 0.91, metalness: 0.00 },
  LEATHER: { roughness: 0.73, metalness: 0.05 },
  METAL:   { roughness: 0.27, metalness: 0.84 },
  WOOD:    { roughness: 0.82, metalness: 0.01 },
  MAGIC:   { roughness: 0.16, metalness: 0.08 }
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
  var textureCache = Object.create(null);
  function textureFor(kind) { return textureCache[kind] || (textureCache[kind] = patternTexture(kind)); }
  function materialFor(materialKind, color, emissive) {
    var r = Math.round(color[0] * 255), g = Math.round(color[1] * 255), b = Math.round(color[2] * 255);
    var key = materialKind + '|' + r + '_' + g + '_' + b + '|' + (emissive ? 1 : 0);
    var m = materialCache[key];
    if (m) return m;
    var preset = MATERIAL_PRESETS[materialKind] || MATERIAL_PRESETS.CLOTH;
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color[0], color[1], color[2]),
      map: textureFor(materialKind),
      roughness: preset.roughness,
      metalness: preset.metalness,
      // Piel/tela/cuero ganan volumen con normales suaves; el metal conserva
      // facetas low-poly que ayudan a leer las placas y filos.
      flatShading: materialKind === 'METAL' || materialKind === 'LEATHER' || materialKind === 'WOOD'
    });
    if (materialKind === 'METAL') {
      m.envMapIntensity = 0.85;
    }
    if (emissive) {
      m.emissive = new THREE.Color(emissive[0], emissive[1], emissive[2]);
      m.emissiveIntensity = 1.35;
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

  /* Acentos mágicos Three-only. No representan gameplay: son presentación
     derivada de `handle.cast`/acción. Geometrías compartidas, cero allocations
     por fotograma. */
  var casterRuneGeo = new THREE.RingGeometry(0.62, 0.70, 48);
  casterRuneGeo.rotateX(-Math.PI / 2);
  var casterMoteGeo = new THREE.IcosahedronGeometry(0.055, 0);

  function Character(entity) {
    this.entityId = entity.id;
    this.handle = Backend.current.createCharacter(entity);
    this.root = new THREE.Group();
    this.root.name = 'char:' + entity.id;
    scene.add(this.root);
    this.parts = [];          // mallas activas, reutilizadas entre fotogramas
    this.pose = [];
    this.usedGlb = false;
    this.fxTime = 0;

    // Luz tenue exclusiva del caster: sólo refuerza la gema/báculo; no sirve
    // para iluminar el mapa ni para gameplay.
    this.magicLight = null;
    this.castFx = null;
    if (Arena.Data.archetypeOf(entity.classId) === 'caster') {
      this.magicLight = new THREE.PointLight(0x75bfff, 0.75, 3.2, 2.0);
      scene.add(this.magicLight);

      var fx = new THREE.Group();
      fx.name = 'caster-fx:' + entity.id;
      var runeMat = new THREE.MeshBasicMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      var rune = new THREE.Mesh(casterRuneGeo, runeMat);
      rune.position.y = 0.025; fx.add(rune);
      var motes = [];
      for (var mi=0; mi<5; mi++) {
        var mm = new THREE.MeshBasicMaterial({ color: 0xaee9ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        var mote = new THREE.Mesh(casterMoteGeo, mm); fx.add(mote); motes.push(mote);
      }
      scene.add(fx);
      this.castFx = { root: fx, rune: rune, motes: motes, time: 0 };
    }
  }

  Character.prototype.update = function (entity, dt, world) {
    Backend.current.updateCharacter(this.handle, entity, dt, world);
    this.fxTime += Math.max(0, Math.min(0.05, dt || 0));
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

    var gemPos = null;

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
      if (part.mesh === 'gem') {
        var me = _m4.elements;
        gemPos = { x: me[12], y: me[13], z: me[14] };
      }
      mesh.matrix.copy(_m4);
      mesh.matrixWorldNeedsUpdate = true;
    }
    for (i = this.pose.length; i < this.parts.length; i++) this.parts[i].visible = false;

    if (this.magicLight) {
      var castGlow = (this.handle && this.handle.cast) ? this.handle.cast : 0;
      var actionGlow = (this.handle && this.handle.action && this.handle.action.weight) ? this.handle.action.weight : 0;
      var glow = Math.max(castGlow, actionGlow * 0.72);
      var fxPos = gemPos || { x: pos.x, y: pos.y + 1.42, z: pos.z };
      this.magicLight.position.set(fxPos.x, fxPos.y, fxPos.z);
      this.magicLight.intensity = 0.28 + glow * 2.35;
      this.magicLight.color.setRGB(palette.accent[0], palette.accent[1], palette.accent[2]);

      if (this.castFx) {
        this.castFx.time = this.fxTime;
        var fx = this.castFx, vis = Math.max(0, Math.min(1, glow));
        fx.root.visible = vis > 0.015;
        /* El rune queda bajo los pies, los motes nacen alrededor de la gema. */
        fx.root.position.set(pos.x, pos.y, pos.z);
        fx.rune.material.color.setRGB(palette.accent[0], palette.accent[1], palette.accent[2]);
        fx.rune.material.opacity = vis * 0.43;
        fx.rune.rotation.z = this.castFx.time * (0.55 + vis * 0.55);
        fx.rune.scale.setScalar(0.85 + vis * 0.34);
        var localGemX = fxPos.x - pos.x, localGemY = fxPos.y - pos.y, localGemZ = fxPos.z - pos.z;
        for (var mii=0; mii<fx.motes.length; mii++) {
          var mote = fx.motes[mii];
          var a = this.castFx.time * (2.0 + mii * 0.11) + mii * Math.PI * 0.4;
          var rr = 0.12 + 0.045 * (mii % 2) + vis * 0.055;
          mote.position.set(localGemX + Math.cos(a) * rr,
            localGemY + Math.sin(a*1.7) * 0.10,
            localGemZ + Math.sin(a) * rr);
          mote.material.color.setRGB(palette.accent[0], palette.accent[1], palette.accent[2]);
          mote.material.opacity = vis * (0.42 + mii * 0.06);
          mote.scale.setScalar(0.70 + vis * (0.48 + mii * 0.05));
        }
      }
    }
  };

  Character.prototype.dispose = function () {
    Backend.current.destroyCharacter(this.handle);
    scene.remove(this.root);
    if (this.magicLight) scene.remove(this.magicLight);
    if (this.castFx) scene.remove(this.castFx.root);
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
