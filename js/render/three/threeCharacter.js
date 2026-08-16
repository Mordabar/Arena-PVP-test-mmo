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
import { createRetargetLibrary } from './threeRetarget.js?build=v0160-ual2-retarget';


/* -------------------------------------------------------------------------
 * v0.15 · GLB HUMANOID BASE + NATIVE SKINNED MOTION
 *
 * El cuerpo real es una malla skinned compartida. v0.14 intentaba copiarle las
 * matrices de un maniquí procedural con otro bind pose: el resultado era torso
 * roto, piernas cruzadas y equipo flotante. v0.15 consume el MISMO estado
 * autoritativo de animación pero genera rotaciones locales en la base del GLB.
 * En la ruta skinned sólo quedan cuerpo + arma; ropa/equipo procedural se omite.
 * ---------------------------------------------------------------------- */
const BODY_MESHES = new Set([
  'pelvis','abdomen','ribcage','neck','skull','jaw','brow','nose','hairCap','hairTail','ear','eye',
  'shoulderBall','upperArm','elbow','lowerArm','hand','thigh','knee','shin','foot'
]);
const RIG_PARENT = {
  Hips:null, Spine:'Hips', Chest:'Spine', Neck:'Chest', Head:'Neck',
  LeftUpperArm:'Chest', LeftLowerArm:'LeftUpperArm', LeftHand:'LeftLowerArm',
  RightUpperArm:'Chest', RightLowerArm:'RightUpperArm', RightHand:'RightLowerArm',
  LeftUpperLeg:'Hips', LeftLowerLeg:'LeftUpperLeg', LeftFoot:'LeftLowerLeg',
  RightUpperLeg:'Hips', RightLowerLeg:'RightUpperLeg', RightFoot:'RightLowerLeg'
};
const RIG_ORDER = Object.keys(RIG_PARENT);

function parallelTraverse(a, b, cb) {
  cb(a, b);
  for (var i=0; i<a.children.length; i++) parallelTraverse(a.children[i], b.children[i], cb);
}

/* Object3D.clone() comparte el Skeleton de un SkinnedMesh. Para un MMO eso
   haría que animar al primer jugador moviese a TODOS. Este clon reasigna cada
   skeleton a los huesos clonados, compartiendo sólo geometría/materiales. */
function cloneSkinnedScene(source) {
  var clone = source.clone(true);
  var srcToClone = Object.create(null);
  parallelTraverse(source, clone, function (src, dst) { srcToClone[src.uuid] = dst; });
  source.traverse(function (src) {
    if (!src.isSkinnedMesh) return;
    var dst = srcToClone[src.uuid];
    var sk = src.skeleton.clone();
    sk.bones = src.skeleton.bones.map(function (bone) { return srcToClone[bone.uuid]; });
    dst.skeleton = sk;
    dst.bindMatrix.copy(src.bindMatrix);
    dst.bindMatrixInverse.copy(src.bindMatrixInverse);
    dst.normalizeSkinWeights();
  });
  return clone;
}

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
  var baseCharacterGltf = opts.baseCharacterGltf || null;
  var animationLibraryGltf = opts.animationLibraryGltf || null;
  var retargetLibrary = animationLibraryGltf ? createRetargetLibrary(animationLibraryGltf) : null;

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

  /* --- Armas limpias para el cuerpo skinned --------------------------------
   * Se enganchan a huesos reales; no reutilizamos matrices de equipo del
   * maniquí procedural. Cuerpo + arma es la dirección de esta iteración. */
  var weaponMat = new THREE.MeshStandardMaterial({ color:0x3a3029, roughness:0.62, metalness:0.12 });
  var metalWeaponMat = new THREE.MeshStandardMaterial({ color:0xaeb8c4, roughness:0.28, metalness:0.82 });
  var magicWeaponMat = new THREE.MeshStandardMaterial({ color:0x7fb7ff, emissive:0x244d88, emissiveIntensity:1.1, roughness:0.24, metalness:0.16 });

  function makeStaff() {
    var g=new THREE.Group(); g.name='weapon:staff';
    var shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.031,1.70,10),weaponMat); shaft.position.y=-0.34; g.add(shaft);
    var collar=new THREE.Mesh(new THREE.TorusGeometry(0.105,0.020,8,18),metalWeaponMat); collar.position.y=0.50; collar.rotation.x=Math.PI/2; g.add(collar);
    var orb=new THREE.Mesh(new THREE.IcosahedronGeometry(0.095,1),magicWeaponMat); orb.position.y=0.60; g.add(orb);
    g.position.set(0.025,-0.03,0.02); g.rotation.set(0.06,0,-0.05); return g;
  }
  function makeSword() {
    var g=new THREE.Group(); g.name='weapon:sword';
    var blade=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.98,0.020),metalWeaponMat); blade.position.y=-0.54; g.add(blade);
    var tip=new THREE.Mesh(new THREE.ConeGeometry(0.044,0.16,4),metalWeaponMat); tip.position.y=-1.11; tip.rotation.z=Math.PI; g.add(tip);
    var guard=new THREE.Mesh(new THREE.BoxGeometry(0.31,0.045,0.055),metalWeaponMat); guard.position.y=-0.02; g.add(guard);
    var grip=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.25,8),weaponMat); grip.position.y=0.12; g.add(grip);
    g.position.set(0.02,-0.01,0.02); return g;
  }
  function makeBow() {
    var g=new THREE.Group(); g.name='weapon:bow';
    var c1=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0.64,0),new THREE.Vector3(0.25,0.32,0),new THREE.Vector3(0,0,0));
    var c2=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0),new THREE.Vector3(0.25,-0.32,0),new THREE.Vector3(0,-0.64,0));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c1,14,0.023,7,false),weaponMat));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c2,14,0.023,7,false),weaponMat));
    var sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.Float32BufferAttribute([0,0.64,0, 0,0,0, 0,-0.64,0],3));
    var line=new THREE.Line(sg,new THREE.LineBasicMaterial({color:0xd9d9cf})); line.name='bowString'; g.add(line); g.userData.string=line;
    g.position.set(-0.01,-0.01,0.03); return g;
  }

  function Character(entity) {
    this.entityId = entity.id;
    this.handle = Backend.current.createCharacter(entity);
    this.root = new THREE.Group();
    this.root.name = 'char:' + entity.id;
    scene.add(this.root);
    this.parts = [];          // equipo procedural activo, reutilizado
    this.pose = [];
    this.usedGlb = !!baseCharacterGltf;
    this.fxTime = 0;
    this.skinnedRoot = null;
    this.rigBones = null;
    this.rigBindPos = null;
    this.rigBindQuat = null;
    this.rigBindWorldQuat = null;
    this.retarget = null;
    this.skinnedAnim = Arena.Render.SkinnedAnimationContract ? Arena.Render.SkinnedAnimationContract.createState() : null;
    this.weapons = null;
    this.lastDt = 1/60;

    if (baseCharacterGltf) {
      this.skinnedRoot = cloneSkinnedScene(baseCharacterGltf.scene);
      this.skinnedRoot.name = 'dark-elf-base:' + entity.id;
      this.root.add(this.skinnedRoot);
      this.rigBones = Object.create(null);
      this.rigBindPos = Object.create(null);
      this.rigBindQuat = Object.create(null);
      this.rigBindWorldQuat = Object.create(null);
      this.skinnedRoot.updateMatrixWorld(true);
      for (var rb=0; rb<RIG_ORDER.length; rb++) {
        var bn = RIG_ORDER[rb], bone = this.skinnedRoot.getObjectByName(bn);
        if (!bone || !bone.isBone) throw new Error('Rig GLB incompleto: falta hueso ' + bn);
        this.rigBones[bn] = bone;
        this.rigBindPos[bn] = bone.position.clone();
        this.rigBindQuat[bn] = bone.quaternion.clone();
        this.rigBindWorldQuat[bn] = bone.getWorldQuaternion(new THREE.Quaternion());
      }
      this.retarget = retargetLibrary ? retargetLibrary.create() : null;
      this.weapons = { staff:makeStaff(), bow:makeBow(), sword:makeSword() };
      this.rigBones.RightHand.add(this.weapons.staff);
      this.rigBones.LeftHand.add(this.weapons.bow);
      this.rigBones.RightHand.add(this.weapons.sword);
      this.weapons.staff.visible=this.weapons.bow.visible=this.weapons.sword.visible=false;
      this.skinnedRoot.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (o.isSkinnedMesh) o.frustumCulled = false;
      });
    }

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
    this.lastDt = Math.max(1/240, Math.min(0.05, dt || 1/60));
    this.fxTime += Math.max(0, Math.min(0.05, dt || 0));
  };

  var _rigWorld = new THREE.Matrix4(), _rigParentWorld = new THREE.Matrix4();
  var _rigLocal = new THREE.Matrix4(), _rigInv = new THREE.Matrix4();
  var _rigPos = new THREE.Vector3(), _rigQuat = new THREE.Quaternion(), _rigScale = new THREE.Vector3();
  var _rigParentPos = new THREE.Vector3(), _rigParentQuat = new THREE.Quaternion(), _rigParentScale = new THREE.Vector3();
  var _one = new THREE.Vector3(1,1,1);

  var _qOffset = new THREE.Quaternion(), _eOffset = new THREE.Euler();
  Character.prototype.applySkinnedPose = function (entity, pos, yaw) {
    if (!this.usedGlb || !this.rigBones || !this.skinnedAnim || !Arena.Render.SkinnedAnimationContract) return;
    var arche = Arena.Data.archetypeOf(entity.classId);
    var clipSpec = (this.retarget && Arena.Data.AnimationLibraryMap)
      ? Arena.Data.AnimationLibraryMap.select(this.handle, arche) : null;
    var fullExternal = !!(clipSpec && clipSpec.fullAction);
    var externalLocomotion = !!(clipSpec && clipSpec.locomotion);
    var a = Arena.Render.SkinnedAnimationContract.update(this.skinnedAnim, this.handle, arche, entity.classId, this.lastDt, {
      skipLocomotion: externalLocomotion,
      skipGuard: false,
      skipMeleeAction: fullExternal
    });

    /* World transform remains simulation-authoritative. External clips are
       sampled only as bone pose; root translation/yaw from UAL2 is discarded. */
    this.root.position.set(pos.x, pos.y, pos.z);
    this.root.rotation.order='YXZ';
    this.root.rotation.set(a.rootPitch, yaw, a.rootRoll);
    var modelScale = Math.max(0.84, Math.min(1.06, entity.height / 1.89738));
    this.skinnedRoot.scale.setScalar(modelScale);

    // 1) Restore exact Dark Elf bind pose before every sample.
    for (var r0=0;r0<RIG_ORDER.length;r0++) {
      var bn0=RIG_ORDER[r0], bb0=this.rigBones[bn0];
      bb0.position.copy(this.rigBindPos[bn0]);
      bb0.quaternion.copy(this.rigBindQuat[bn0]);
      bb0.scale.set(1,1,1);
    }

    // 2) Retarget supplied CC0 animation clip, when the data contract selects one.
    var retargetResult = null;
    if (clipSpec && this.retarget) {
      retargetResult = this.retarget.retarget(clipSpec, this.rigBones, this.rigBindWorldQuat, this.rigBindQuat);
      if (retargetResult && retargetResult.applied) {
        var qs=retargetResult.localQuats || {};
        for (var rq in qs) if (this.rigBones[rq]) this.rigBones[rq].quaternion.copy(qs[rq]);
        this.rigBones.Hips.position.y += (retargetResult.hipsLift || 0) / modelScale;
      }
    }

    // 3) Arena-specific additive language: bow draw, staff cast, CC, guards.
    //    It layers on top of the external base without owning combat timing.
    this.rigBones.Hips.position.y += a.hipsY / modelScale;
    for (var i=0;i<RIG_ORDER.length;i++) {
      var n=RIG_ORDER[i], b=this.rigBones[n], p=a.bones[n];
      _eOffset.set(p.x,p.y,p.z,'XYZ'); _qOffset.setFromEuler(_eOffset); b.quaternion.multiply(_qOffset).normalize();
    }

    var kind=a.weapon.kind;
    this.weapons.staff.visible=kind==='staff'; this.weapons.bow.visible=kind==='bow'; this.weapons.sword.visible=kind==='sword';
    var w=this.weapons[kind];
    if(w){
      w.rotation.set(a.weapon.pitch,a.weapon.yaw,a.weapon.roll,'XYZ');
      if(kind==='staff') w.rotation.z += -0.05;
      if(kind==='sword') w.rotation.z += -0.08;
      if(kind==='bow' && w.userData.string){
        var pa=w.userData.string.geometry.attributes.position.array;
        pa[3]=0; pa[4]=0; pa[5]=-0.30*a.weapon.draw;
        w.userData.string.geometry.attributes.position.needsUpdate=true;
      }
    }
    this.skinnedRoot.updateMatrixWorld(true);
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
    if (this.usedGlb) {
      this.applySkinnedPose(entity, pos, yaw);
      /* No armadura/ropa procedural in v0.15. The imported body already carries
         its underwear material; only the archetype weapon remains. */
      for (var hp=0; hp<this.parts.length; hp++) this.parts[hp].visible=false;
      var fxPos={x:pos.x,y:pos.y+1.35,z:pos.z};
      if (this.magicLight) {
        var castGlow=(this.handle&&this.handle.cast)?this.handle.cast:0;
        var actionGlow=(this.handle&&this.handle.action&&this.handle.action.weight)?this.handle.action.weight:0;
        var glow=Math.max(castGlow,actionGlow*0.72);
        this.magicLight.position.set(fxPos.x,fxPos.y,fxPos.z);
        this.magicLight.intensity=0.22+glow*1.9;
        if(this.castFx){
          var fx=this.castFx,vis=Math.max(0,Math.min(1,glow)); fx.root.visible=vis>0.015; fx.root.position.set(pos.x,pos.y,pos.z);
          fx.rune.material.opacity=vis*0.32; fx.rune.rotation.z=this.fxTime*(0.55+vis*0.45);
          for(var fm=0;fm<fx.motes.length;fm++){ var mote=fx.motes[fm],aa=this.fxTime*(1.8+fm*0.12)+fm*1.23; mote.position.set(Math.cos(aa)*0.20,1.20+Math.sin(aa*1.4)*0.10,Math.sin(aa)*0.20); mote.material.opacity=vis*(0.32+fm*0.04); }
        }
      }
      return;
    }

    Backend.current.buildPose(this.pose, this.handle, entity, pos, yaw, palette);
    var gemPos = null;

    var i, partCursor = 0;
    for (i = 0; i < this.pose.length; i++) {
      var part = this.pose[i];
      if (this.usedGlb && BODY_MESHES.has(part.mesh)) continue;
      var mesh = this.parts[partCursor];
      if (!mesh) {
        mesh = new THREE.Mesh(geometries[part.mesh], null);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;      // la matriz la damos nosotros
        this.root.add(mesh);
        this.parts[partCursor] = mesh;
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
      partCursor++;
    }
    for (i = partCursor; i < this.parts.length; i++) this.parts[i].visible = false;

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
    if (this.retarget) this.retarget.dispose();
    this.skinnedRoot = null; this.rigBones = null; this.rigBindPos = null; this.rigBindQuat=null; this.rigBindWorldQuat=null; this.retarget=null; this.weapons=null; this.skinnedAnim=null;
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
    glbLoader: opts.glbLoader || null,
    baseCharacterGltf: baseCharacterGltf,
    animationLibraryGltf: animationLibraryGltf
  };
}
