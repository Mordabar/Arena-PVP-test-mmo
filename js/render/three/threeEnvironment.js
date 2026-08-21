/* =============================================================================
 * render/three/threeEnvironment.js — "Arcane Wilds", mapa visual Three.js.
 *
 * El collider/LoS sigue viviendo en sim/arena.js. Esta capa transforma esas
 * cajas de laboratorio en un pequeño santuario forestal: muros de piedra con
 * musgo, árboles antiguos sobre los colliders de columna, terrazas cubiertas de
 * césped, vegetación ligera, ruinas, braseros y un bosque exterior. Todo lo que
 * parece sólido coincide con un obstáculo real; lo decorativo dentro de la zona
 * jugable es bajo (hierba/flores) y deliberadamente atravesable.
 * ========================================================================== */
import * as THREE from 'three';

export const PALETTE = {
  skyTop: 0x4f78aa,
  skyHorizon: 0xb9d7d8,
  fog: 0x9fbab4,
  hemiSky: 0xd6ebf3,
  hemiGround: 0x4d4939,
  sun: 0xffdfaa,

  grass: 0x557541,
  grassLight: 0x718d51,
  grassDark: 0x324a32,
  moss: 0x567447,
  dirt: 0x826a45,
  dirtLight: 0xa18458,
  stone: 0x8c8474,
  stoneDark: 0x56564e,
  stoneLight: 0xb4aa95,
  wood: 0x63472e,
  barkDark: 0x3e3024,
  leaf: 0x3d6a3b,
  leafLight: 0x6d8b4d,
  leafWarm: 0x81934e,
  bush: 0x45603a,
  accent: 0xf1ad5f,
  accentBlue: 0x72c7d4,
  banner: 0x7b3441,
  flowerA: 0xd9b668,
  flowerB: 0xc68ca8
};

function hash2(x, y, seed) {
  var n = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}
function rgb(hex) { return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]; }
function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function dataTexture(w, h, painter, repeatX, repeatY) {
  var data = new Uint8Array(w * h * 4);
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) painter(data, (y * w + x) * 4, x, y, w, h);
  var tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX || 1, repeatY || 1);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Césped coloreado con caminos y zonas pisadas integrados en la propia textura. */
function terrainTexture() {
  var g = rgb(PALETTE.grass), gl = rgb(PALETTE.grassLight), d = rgb(PALETTE.dirt);
  return dataTexture(384, 288, function (data, i, x, y, w, h) {
    var nx = x / (w - 1) * 2 - 1, ny = y / (h - 1) * 2 - 1;
    var fine = hash2(x, y, 17), coarse = hash2((x / 9) | 0, (y / 9) | 0, 91);
    var lane = Math.exp(-Math.pow(ny / 0.135, 4));
    var duelA = Math.exp(-((nx + 0.47) * (nx + 0.47) / 0.085 + ny * ny / 0.16));
    var duelB = Math.exp(-((nx - 0.43) * (nx - 0.43) / 0.085 + ny * ny / 0.16));
    var worn = Math.min(0.90, lane * 0.67 + Math.max(duelA, duelB) * 0.37);
    var lush = Math.max(0, coarse - 0.58) * (1 - worn) * 0.55;
    for (var c = 0; c < 3; c++) {
      var grass = g[c] * (0.82 + fine * 0.23) + (gl[c] - g[c]) * lush;
      var dirt = d[c] * (0.86 + fine * 0.19);
      data[i + c] = clampByte(grass + (dirt - grass) * worn);
    }
    data[i + 3] = 255;
  });
}

function stoneTexture() {
  var base = rgb(PALETTE.stone), moss = rgb(PALETTE.moss);
  return dataTexture(160, 160, function (data, i, x, y) {
    var row = (y / 22) | 0, offset = (row & 1) ? 12 : 0;
    var mortar = (y % 22 < 2) || ((x + offset) % 38 < 2);
    var n = hash2(x, y, 33), patch = hash2((x / 10) | 0, (y / 10) | 0, 75);
    var f = mortar ? 0.55 : (0.84 + n * 0.24);
    var mossMix = mortar ? 0 : Math.max(0, patch - 0.69) * 0.65;
    for (var c = 0; c < 3; c++) {
      var v = base[c] * f;
      data[i + c] = clampByte(v + (moss[c] - v) * mossMix);
    }
    data[i + 3] = 255;
  }, 2.4, 1.7);
}

function woodTexture() {
  var base = rgb(PALETTE.wood);
  return dataTexture(96, 96, function (data, i, x, y) {
    var grain = 0.78 + 0.14 * Math.sin(x * 0.38 + Math.sin(y * 0.11) * 2.2) + hash2(x, y, 5) * 0.10;
    data[i] = clampByte(base[0] * grain);
    data[i + 1] = clampByte(base[1] * grain);
    data[i + 2] = clampByte(base[2] * grain);
    data[i + 3] = 255;
  }, 2.0, 3.0);
}

function mat(color, opts) {
  opts = opts || {};
  return new THREE.MeshStandardMaterial({
    color: color,
    map: opts.map || null,
    roughness: opts.roughness === undefined ? 0.90 : opts.roughness,
    metalness: opts.metalness === undefined ? 0.01 : opts.metalness,
    flatShading: !!opts.flat,
    side: opts.side || THREE.FrontSide
  });
}

function shadowify(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addCanopy(root, y, scale, phase, mats, geos, animated) {
  var canopy = new THREE.Group();
  canopy.position.y = y;
  var crownData = [
    [0, 0.10, 0, 1.00], [-0.54, -0.08, 0.10, 0.74], [0.49, -0.04, -0.12, 0.80],
    [0.02, 0.58, -0.05, 0.72], [0.12, 0.16, 0.50, 0.62]
  ];
  for (var i = 0; i < crownData.length; i++) {
    var c = crownData[i];
    var crown = new THREE.Mesh(i === 3 ? geos.crownSmall : geos.crown, (i % 3 === 0) ? mats.leaf2 : (i % 3 === 1 ? mats.leaf : mats.leaf3));
    crown.position.set(c[0], c[1], c[2]);
    crown.scale.setScalar(c[3]);
    /* Far foliage receives sunlight but does not render its own shadow map
       pass. Hundreds of canopy meshes were one of the least valuable GPU
       shadow casters in the arena. */
    crown.castShadow = false; crown.receiveShadow = true;
    canopy.add(crown);
  }
  canopy.scale.setScalar(scale);
  root.add(canopy);
  animated.push({ canopy: canopy, phase: phase, baseY: canopy.position.y });
}

function addTree(group, x, z, scale, phase, mats, geos, animated, baseY, castsShadow) {
  var root = new THREE.Group();
  root.position.set(x, baseY || 0, z);
  root.rotation.y = phase * 1.63;
  root.scale.setScalar(scale);

  var trunk = new THREE.Mesh(geos.trunk, mats.bark);
  trunk.position.y = 1.35;
  trunk.rotation.z = Math.sin(phase * 2.1) * 0.035;
  trunk.castShadow = castsShadow !== false; trunk.receiveShadow = true;
  root.add(trunk);

  var collar = new THREE.Mesh(geos.rootCollar, mats.barkDark);
  collar.position.y = 0.18;
  collar.rotation.y = phase;
  collar.castShadow = castsShadow !== false; collar.receiveShadow = true;
  root.add(collar);

  addCanopy(root, 3.05, 1.0, phase, mats, geos, animated);
  group.add(root);
  return root;
}

/* v0.24 performance wave — the exterior forest is pure backdrop and used to
 * cost ~7 draw calls PER tree (trunk + collar + five crown chunks).  It has no
 * collision or gameplay meaning, so render identical component slots with
 * InstancedMesh.  Thirty+ trees collapse from ~210 draws to seven while the
 * authored silhouette/material variation remains unchanged.  The tactical
 * collider trees still use addTree() and keep their individual wind motion. */
function addInstancedForest(group, forest, mats, geos) {
  if (!forest || !forest.length) return [];
  var crownData = [
    [0, 0.10, 0, 1.00], [-0.54, -0.08, 0.10, 0.74], [0.49, -0.04, -0.12, 0.80],
    [0.02, 0.58, -0.05, 0.72], [0.12, 0.16, 0.50, 0.62]
  ];
  var slots = [
    { geo:geos.trunk, mat:mats.bark, kind:'trunk' },
    { geo:geos.rootCollar, mat:mats.barkDark, kind:'collar' }
  ];
  for (var ci=0; ci<crownData.length; ci++) slots.push({
    geo:ci===3?geos.crownSmall:geos.crown,
    mat:(ci%3===0)?mats.leaf2:((ci%3===1)?mats.leaf:mats.leaf3),
    kind:'crown', crownIndex:ci
  });
  var rootM=new THREE.Matrix4(), childM=new THREE.Matrix4(), worldM=new THREE.Matrix4();
  var rootPos=new THREE.Vector3(), rootScale=new THREE.Vector3(), childPos=new THREE.Vector3(), childScale=new THREE.Vector3();
  var rootQ=new THREE.Quaternion(), childQ=new THREE.Quaternion();
  var rootE=new THREE.Euler(), childE=new THREE.Euler();
  var out=[];
  for (var si=0; si<slots.length; si++) {
    var slot=slots[si], inst=new THREE.InstancedMesh(slot.geo,slot.mat,forest.length);
    inst.name='forest-instanced-'+slot.kind+(slot.crownIndex===undefined?'':'-'+slot.crownIndex);
    inst.castShadow=false; inst.receiveShadow=true;
    inst.frustumCulled=true;
    for (var fi=0; fi<forest.length; fi++) {
      var f=forest[fi], phase=f[3], scale=f[2];
      rootPos.set(f[0],0,f[1]); rootScale.setScalar(scale);
      rootE.set(0,phase*1.63,0); rootQ.setFromEuler(rootE); rootM.compose(rootPos,rootQ,rootScale);
      childQ.identity(); childScale.set(1,1,1);
      if(slot.kind==='trunk') {
        childPos.set(0,1.35,0); childE.set(0,0,Math.sin(phase*2.1)*0.035); childQ.setFromEuler(childE);
      } else if(slot.kind==='collar') {
        childPos.set(0,0.18,0); childE.set(0,phase,0); childQ.setFromEuler(childE);
      } else {
        var c=crownData[slot.crownIndex]; childPos.set(c[0],3.05+c[1],c[2]); childE.set(0,0,0); childQ.identity(); childScale.setScalar(c[3]);
      }
      childM.compose(childPos,childQ,childScale); worldM.multiplyMatrices(rootM,childM);
      inst.setMatrixAt(fi,worldM);
    }
    inst.instanceMatrix.needsUpdate=true;
    group.add(inst); out.push(inst);
  }
  return out;
}

/** Convierte uno de los colliders de columna en un árbol antiguo jugable. */
function addColliderTree(group, o, index, mats, geos, animated, stoneMat) {
  var scale = 1.20 + (index % 3) * 0.07;
  var root = addTree(group, o.center.x, o.center.z, scale, index * 0.77, mats, geos, animated, 0, true);
  // El tronco visual queda aproximadamente dentro de la caja 1.5x1.5.
  root.children[0].scale.set(2.25, 1.28, 2.25);
  root.children[1].scale.set(1.35, 0.90, 1.35);
  // Anillo de ruina: deja claro que el árbol ES cobertura y no decoración.
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.08, 0.24, 10), stoneMat);
  base.position.set(o.center.x, 0.12, o.center.z);
  shadowify(base); group.add(base);
}

function addBush(group, x, z, scale, phase, mats, geos) {
  var b = new THREE.Mesh(geos.bush, phase % 2 > 1 ? mats.leaf2 : mats.bush);
  b.position.set(x, 0.33 * scale, z);
  b.scale.set(scale * 1.20, scale * 0.62, scale);
  b.rotation.y = phase;
  shadowify(b);
  group.add(b);
}

function addWallDetail(group, o, baseMat, capMat, mossMat, boxGeo, isPerimeter) {
  var wall = new THREE.Mesh(boxGeo, baseMat);
  wall.position.set(o.center.x, o.size.y / 2, o.center.z);
  wall.scale.set(o.size.x, o.size.y, o.size.z);
  shadowify(wall); group.add(wall);

  // Piedra de coronación: rompe el bloque enorme desde la cámara alta.
  var cap = new THREE.Mesh(boxGeo, capMat);
  cap.position.set(o.center.x, o.size.y + 0.07, o.center.z);
  cap.scale.set(o.size.x * 1.025, 0.15, o.size.z * 1.10);
  shadowify(cap); group.add(cap);

  // Musgo discontinuo sobre la coronación. En perímetro se hace más visible
  // porque es lo que recorta el muro contra el bosque exterior.
  var moss = new THREE.Mesh(boxGeo, mossMat);
  moss.position.set(o.center.x, o.size.y + 0.16, o.center.z);
  moss.scale.set(o.size.x * (isPerimeter ? 0.88 : 0.72), 0.035, o.size.z * 1.16);
  moss.receiveShadow = true; group.add(moss);

  // Contrafuertes sólo en muros largos, para que no parezcan cubos de debug.
  var longX = o.size.x > o.size.z;
  var len = Math.max(o.size.x, o.size.z);
  var count = Math.max(0, Math.floor(len / 4.2));
  for (var i = 1; i < count; i++) {
    var t = i / count - 0.5;
    var butt = new THREE.Mesh(boxGeo, capMat);
    butt.position.set(
      o.center.x + (longX ? t * o.size.x : 0),
      Math.min(1.25, o.size.y * 0.40),
      o.center.z + (longX ? 0 : t * o.size.z)
    );
    butt.scale.set(longX ? 0.30 : o.size.x * 1.22, Math.min(2.5, o.size.y * 0.80), longX ? o.size.z * 1.28 : 0.30);
    shadowify(butt); group.add(butt);
  }
}

function addGroundScatter(group, arena, mats) {
  // Hierba: geometría triangular muy barata, instanciada. Puede atravesarse.
  var tuftGeo = new THREE.ConeGeometry(0.055, 0.32, 3);
  var tuftMat = mat(PALETTE.grassLight, { roughness: 1.0, flat: true });
  var tuftCount = Math.max(180, Math.round(arena.width * arena.depth * 0.15));
  var tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
  var dummy = new THREE.Object3D();
  for (var i = 0; i < tuftCount; i++) {
    var x = (hash2(i, 11, 200) - 0.5) * (arena.width - 2.2);
    var z = (hash2(i, 19, 211) - 0.5) * (arena.depth - 2.2);
    // El sendero central queda más limpio para lectura de combate.
    if (Math.abs(z) < 1.45) z += (z >= 0 ? 1 : -1) * (1.55 + hash2(i, 7, 44) * 1.1);
    dummy.position.set(x, 0.14, z);
    dummy.rotation.y = hash2(i, 23, 9) * Math.PI * 2;
    var s = 0.72 + hash2(i, 31, 7) * 0.75;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
  }
  tufts.castShadow = false; tufts.receiveShadow = true;
  group.add(tufts);

  // Flores minúsculas, sólo acento cromático.
  var flowerGeo = new THREE.OctahedronGeometry(0.075, 0);
  var flowerMatA = new THREE.MeshStandardMaterial({ color: PALETTE.flowerA, roughness: 0.92, flatShading: true });
  var flowerMatB = new THREE.MeshStandardMaterial({ color: PALETTE.flowerB, roughness: 0.92, flatShading: true });
  for (i = 0; i < Math.max(30, Math.round(arena.width * arena.depth / 42)); i++) {
    var fx = (hash2(i, 43, 17) - 0.5) * (arena.width - 4);
    var fz = (hash2(i, 61, 27) - 0.5) * (arena.depth - 4);
    if (Math.abs(fz) < 2.2) fz += fz >= 0 ? 2.5 : -2.5;
    var flower = new THREE.Mesh(flowerGeo, i & 1 ? flowerMatA : flowerMatB);
    flower.position.set(fx, 0.10, fz);
    flower.scale.set(0.65, 0.90, 0.65);
    group.add(flower);
  }
}

function addArenaSigil(group) {
  var sigil = new THREE.Group();
  var ringMat = new THREE.MeshBasicMaterial({ color: 0xd0b36a, transparent: true, opacity: 0.30, depthWrite: false, side: THREE.DoubleSide });
  var ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.39, 64), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.013; sigil.add(ring);
  var inner = new THREE.Mesh(new THREE.RingGeometry(1.10, 1.16, 48), ringMat.clone());
  inner.material.opacity = 0.19; inner.rotation.x = -Math.PI / 2; inner.position.y = 0.014; sigil.add(inner);
  for (var i = 0; i < 8; i++) {
    var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.75), ringMat.clone());
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = i * Math.PI / 4;
    dash.position.set(Math.sin(i * Math.PI / 4) * 2.25, 0.015, Math.cos(i * Math.PI / 4) * 2.25);
    sigil.add(dash);
  }
  group.add(sigil);
}

function addCloud(scene, x, y, z, scale) {
  var group = new THREE.Group();
  group.position.set(x, y, z); group.scale.setScalar(scale);
  var cloudMat = new THREE.MeshBasicMaterial({ color: 0xf5fbff, transparent: true, opacity: 0.34, depthWrite: false });
  var geo = new THREE.IcosahedronGeometry(1, 1);
  var bits = [[0,0,0,1.4],[-1.1,-0.1,0,1.0],[1.0,-0.15,0.1,1.15],[0.15,0.45,-0.1,0.95],[1.7,0.0,-0.2,0.75]];
  for (var i=0;i<bits.length;i++) {
    var b=bits[i], m=new THREE.Mesh(geo, cloudMat);
    m.position.set(b[0],b[1],b[2]); m.scale.set(b[3]*1.35,b[3]*0.48,b[3]); group.add(m);
  }
  scene.add(group);
  return group;
}

export function createEnvironment(scene, arena) {
  var group = new THREE.Group(); group.name = 'environment';
  var animatedFoliage = [], flames = [], clouds = [];

  /* --- Luz: clara y cálida, no gris de editor --------------------------- */
  var hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.75);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(PALETTE.sun, 3.55);
  sun.position.set(-21, 33, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var span = Math.sqrt(arena.width * arena.width + arena.depth * arena.depth) * 0.60;
  var sc = sun.shadow.camera; sc.left=-span; sc.right=span; sc.top=span; sc.bottom=-span; sc.near=5; sc.far=90;
  sun.shadow.bias = -0.00055; sun.shadow.normalBias = 0.030;
  scene.add(sun); scene.add(sun.target);

  /* --- Cielo con gradiente real ----------------------------------------- */
  var skyGeo = new THREE.SphereGeometry(210, 36, 22);
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { topColor: { value: new THREE.Color(PALETTE.skyTop) }, horizonColor: { value: new THREE.Color(PALETTE.skyHorizon) } },
    vertexShader: 'varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 topColor; uniform vec3 horizonColor; varying vec3 vWorld; void main(){float h=clamp(normalize(vWorld).y,0.0,1.0); float t=pow(h,0.72); gl_FragColor=vec4(mix(horizonColor,topColor,t),1.0);}'
  });
  var sky = new THREE.Mesh(skyGeo, skyMat); sky.frustumCulled = false; scene.add(sky);
  scene.background = new THREE.Color(PALETTE.skyHorizon);
  scene.fog = new THREE.Fog(PALETTE.fog, 44, 112);
  clouds.push(addCloud(scene, -22, 21, -40, 2.2), addCloud(scene, 18, 24, -48, 1.8), addCloud(scene, 35, 18, 8, 1.35));

  /* --- Suelo ------------------------------------------------------------- */
  var terrainMap = terrainTexture();
  var innerFloor = new THREE.Mesh(new THREE.PlaneGeometry(arena.width, arena.depth, 24, 18), mat(0xffffff, { map: terrainMap, roughness: 0.99 }));
  innerFloor.rotation.x = -Math.PI / 2; innerFloor.position.y = -0.008; innerFloor.receiveShadow = true; group.add(innerFloor);
  var outerRadius = Math.max(68, Math.sqrt(arena.width*arena.width + arena.depth*arena.depth) * 1.35);
  var outer = new THREE.Mesh(new THREE.CircleGeometry(outerRadius, 64), mat(PALETTE.grassDark, { roughness: 1.0 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.045; outer.receiveShadow = true; group.add(outer);
  addArenaSigil(group);

  /* --- Materiales del santuario ----------------------------------------- */
  var stoneMap = stoneTexture(), barkMap = woodTexture();
  var stoneMat = mat(0xffffff, { map: stoneMap, roughness: 0.93 });
  var stoneDarkMat = mat(PALETTE.stoneDark, { map: stoneMap, roughness: 0.96 });
  var stoneLightMat = mat(PALETTE.stoneLight, { map: stoneMap, roughness: 0.88 });
  var mossMat = mat(PALETTE.moss, { roughness: 1.0, flat: true });
  var boxGeo = new THREE.BoxGeometry(1,1,1);

  var mats = {
    bark: mat(0xffffff, { map: barkMap, roughness: 0.96 }),
    barkDark: mat(PALETTE.barkDark, { map: barkMap, roughness: 0.98 }),
    leaf: mat(PALETTE.leaf, { roughness: 0.98, flat: true }),
    leaf2: mat(PALETTE.leafLight, { roughness: 0.98, flat: true }),
    leaf3: mat(PALETTE.leafWarm, { roughness: 0.98, flat: true }),
    bush: mat(PALETTE.bush, { roughness: 0.98, flat: true })
  };
  var geos = {
    trunk: new THREE.CylinderGeometry(0.22, 0.34, 2.65, 8),
    rootCollar: new THREE.CylinderGeometry(0.44, 0.66, 0.36, 7),
    crown: new THREE.DodecahedronGeometry(1.08, 0),
    crownSmall: new THREE.IcosahedronGeometry(0.95, 0),
    bush: new THREE.DodecahedronGeometry(0.62, 0)
  };

  /* --- Obstáculos reales: ya no son bloques desnudos -------------------- */
  var pillarIndex = 0;
  for (var i=0;i<arena.obstacles.length;i++) {
    var o=arena.obstacles[i];
    var isPerimeter=Math.abs(o.center.x)>arena.width/2 || Math.abs(o.center.z)>arena.depth/2;
    if (o.kind === 'pillar') {
      addColliderTree(group, o, pillarIndex++, mats, geos, animatedFoliage, stoneDarkMat);
    } else {
      addWallDetail(group, o, isPerimeter ? stoneDarkMat : stoneMat, stoneLightMat, mossMat, boxGeo, isPerimeter);
    }
  }

  /* --- Terrazas: piedra + cubierta vegetal ------------------------------ */
  for (i=0;i<arena.platforms.length;i++) {
    var p=arena.platforms[i];
    var platform=new THREE.Mesh(boxGeo, stoneMat);
    platform.position.set(p.x,p.h/2,p.z); platform.scale.set(p.sx,Math.max(0.05,p.h),p.sz); shadowify(platform); group.add(platform);
    var turf=new THREE.Mesh(new THREE.PlaneGeometry(p.sx*0.96,p.sz*0.96), mat(PALETTE.grassLight,{roughness:1.0}));
    turf.rotation.x=-Math.PI/2; turf.position.set(p.x,p.h+0.016,p.z); turf.receiveShadow=true; group.add(turf);
    if (p.ramp) group.add(buildRamp(p.ramp, stoneMat));
  }

  addGroundScatter(group, arena, mats);

  /* --- Bosque exterior: copas grandes visibles por encima del perímetro -- */
  var hw=arena.width/2, hd=arena.depth/2;
  var forest=[];
  var forestCount = Math.max(30, Math.round((arena.width + arena.depth) * 0.46));
  for (i=0;i<forestCount;i++) {
    var side=i%4, t=(hash2(i,9,14)*2-1);
    var x,z;
    if (side===0){x=-hw-2.2-hash2(i,1,4)*4.2; z=t*(hd+5);} 
    else if(side===1){x=hw+2.2+hash2(i,2,5)*4.2; z=t*(hd+5);} 
    else if(side===2){x=t*(hw+5); z=-hd-2.0-hash2(i,3,6)*4.4;} 
    else {x=t*(hw+5); z=hd+2.0+hash2(i,4,7)*4.4;}
    forest.push([x,z,1.25+hash2(i,5,8)*0.75,i*0.71]);
  }
  addInstancedForest(group, forest, mats, geos);

  // Arbustos bajos dentro de esquinas seguras: atravesables y claramente bajos.
  var bushes=[[-14,-10],[-11,10],[13,-9],[14,9],[-6,-10.4],[6,10.2],[-15,4],[15,-4]];
  for(i=0;i<bushes.length;i++) addBush(group,bushes[i][0],bushes[i][1],0.72+(i%3)*0.10,i*0.63,mats,geos);

  /* --- Rocas de fondo y colinas ----------------------------------------- */
  var rockGeo=new THREE.DodecahedronGeometry(1,0), rockMat=mat(0x6d7068,{map:stoneMap,roughness:0.98,flat:true});
  // Rocas grandes siempre FUERA del perímetro lógico. Al ampliar la arena,
  // mantener coordenadas fijas las habría convertido en obstáculos visuales
  // atravesables dentro del PvP, una mentira de navegación inaceptable.
  var rocks=[
    [-hw-3.1,-hd-2.4,1.8],[hw+3.4,-hd-2.8,1.25],
    [-hw-3.5,hd+2.1,1.5],[hw+3.0,hd+2.7,1.9],
    [-hw*0.34,-hd-3.2,1.15],[hw*0.40,hd+3.2,1.2]
  ];
  for(i=0;i<rocks.length;i++){
    var rock=new THREE.Mesh(rockGeo,rockMat); rock.position.set(rocks[i][0],rocks[i][2]*0.34,rocks[i][1]);
    rock.scale.set(rocks[i][2],rocks[i][2]*0.70,rocks[i][2]*0.90); rock.rotation.set(i*0.31,i*0.83,i*0.17); shadowify(rock); group.add(rock);
  }
  var hillGeo=new THREE.ConeGeometry(9,9,10), hillMat=mat(0x405b41,{roughness:1.0,flat:true});
  var hills=[[-35,-25,1.15],[34,-27,1.35],[-37,25,1.25],[36,26,1.1],[0,-39,1.15],[3,41,1.25]];
  for(i=0;i<hills.length;i++){
    var hill=new THREE.Mesh(hillGeo,hillMat); hill.position.set(hills[i][0],1.55,hills[i][1]); hill.scale.set(hills[i][2],0.72*hills[i][2],hills[i][2]); hill.rotation.y=i*0.61; hill.receiveShadow=true; group.add(hill);
  }

  /* --- Portales de ruina y banderas ------------------------------------- */
  function ruinGate(x,z,rot){
    var r=new THREE.Group(); r.position.set(x,0,z); r.rotation.y=rot;
    var colGeo=new THREE.CylinderGeometry(0.31,0.39,3.5,8), lintelGeo=new THREE.BoxGeometry(4.1,0.48,0.72);
    var l=new THREE.Mesh(colGeo,stoneMat); l.position.set(-1.50,1.75,0); shadowify(l);
    var rr=new THREE.Mesh(colGeo,stoneMat); rr.position.set(1.50,1.75,0); shadowify(rr);
    var top=new THREE.Mesh(lintelGeo,stoneLightMat); top.position.set(0,3.34,0); top.rotation.z=0.018; shadowify(top);
    r.add(l,rr,top); group.add(r);
  }
  ruinGate(0,-hd-2.15,0); ruinGate(0,hd+2.15,Math.PI);

  var poleGeo=new THREE.CylinderGeometry(0.035,0.050,3.4,6), bannerGeo=new THREE.PlaneGeometry(0.90,1.35);
  var poleMat=mat(PALETTE.wood,{map:barkMap,roughness:0.90}), bannerMat=new THREE.MeshStandardMaterial({color:PALETTE.banner,roughness:0.88,side:THREE.DoubleSide});
  var bannerPos=[[-6.6,-10.2],[6.6,10.2],[-15.7,-3.8],[15.7,3.8]];
  for(i=0;i<bannerPos.length;i++){
    var pole=new THREE.Mesh(poleGeo,poleMat); pole.position.set(bannerPos[i][0],1.7,bannerPos[i][1]); pole.castShadow=true; group.add(pole);
    var banner=new THREE.Mesh(bannerGeo,bannerMat); banner.position.set(bannerPos[i][0]+0.47,2.42,bannerPos[i][1]); banner.rotation.y=(i%2)?Math.PI:0; banner.castShadow=true; group.add(banner);
  }

  /* --- Braseros ---------------------------------------------------------- */
  var brazierMat=mat(0x484039,{roughness:0.56,metalness:0.42});
  var flameMat=new THREE.MeshStandardMaterial({color:0xffc071,emissive:0xff7d32,emissiveIntensity:3.1,roughness:0.18});
  var stemGeo=new THREE.CylinderGeometry(0.07,0.11,1.0,7), bowlGeo=new THREE.CylinderGeometry(0.29,0.18,0.16,9), flameGeo=new THREE.ConeGeometry(0.13,0.40,7);
  var braziers=[[-12,-8],[12,-8],[-12,8],[12,8]];
  for(i=0;i<braziers.length;i++){
    var bx=braziers[i][0],bz=braziers[i][1];
    var stem=new THREE.Mesh(stemGeo,brazierMat); stem.position.set(bx,0.50,bz); stem.castShadow=true; group.add(stem);
    var bowl=new THREE.Mesh(bowlGeo,brazierMat); bowl.position.set(bx,1.05,bz); bowl.castShadow=true; group.add(bowl);
    var flame=new THREE.Mesh(flameGeo,flameMat); flame.position.set(bx,1.32,bz); flame.scale.set(1,1.35,1); group.add(flame);
    /* Emissive flame only. Four always-on PointLights multiplied the cost of
       every StandardMaterial in view and added almost no tactical information.
       Keeping the emissive geometry preserves the authored brazier cue while
       lowering fragment-light work on the GPU. */
    flames.push({mesh:flame,light:null,phase:i*1.37});
  }

  /* --- Luciérnagas ambientales -----------------------------------------
   * Sólo presentación: puntos emissive suaves en el bosque exterior. Dan
   * profundidad y vida sin distraer del combate central. */
  var flyGeo = new THREE.SphereGeometry(0.035, 5, 4);
  var flyMat = new THREE.MeshBasicMaterial({ color: 0xd8ff9b, transparent: true, opacity: 0.72 });
  var fireflies = new THREE.InstancedMesh(flyGeo, flyMat, 42);
  var flyDummy = new THREE.Object3D();
  for (var fi=0; fi<42; fi++) {
    var fa = hash2(fi, 97, 13) * Math.PI * 2;
    var fr = Math.max(arena.width, arena.depth) * (0.42 + hash2(fi, 103, 19) * 0.26);
    flyDummy.position.set(Math.sin(fa)*fr, 0.8 + hash2(fi, 109, 23)*2.4, Math.cos(fa)*fr);
    flyDummy.scale.setScalar(0.7 + hash2(fi,111,29)*1.4);
    flyDummy.updateMatrix(); fireflies.setMatrixAt(fi, flyDummy.matrix);
  }
  fireflies.instanceMatrix.needsUpdate = true; group.add(fireflies);

  scene.add(group);

  return {
    group:group, sun:sun, hemi:hemi,
    update:function(time,dt){
      for(var j=0;j<animatedFoliage.length;j++){
        var f=animatedFoliage[j];
        f.canopy.rotation.z=Math.sin(time*0.54+f.phase)*0.018;
        f.canopy.rotation.x=Math.cos(time*0.43+f.phase*1.4)*0.010;
        f.canopy.position.y=f.baseY+Math.sin(time*0.34+f.phase)*0.010;
      }
      for(var k=0;k<flames.length;k++){
        var fl=flames[k], pulse=0.90+Math.sin(time*8.0+fl.phase)*0.085+Math.sin(time*13.4+fl.phase)*0.030;
        fl.mesh.scale.y=1.28*pulse; fl.mesh.rotation.y+=0.016; if(fl.light) fl.light.intensity=4.6+pulse*1.15;
      }
      for(var c=0;c<clouds.length;c++) clouds[c].position.x += (dt||0)*0.08*(c+1);
      flyMat.opacity = 0.54 + Math.sin(time * 1.7) * 0.10 + Math.sin(time * 2.9) * 0.04;
    }
  };
}

function buildRamp(r, material) {
  var hAtMinZ=r.dir<0?r.to:r.from, hAtMaxZ=r.dir<0?r.from:r.to;
  var hx=r.sx/2,hz=r.sz/2;
  var geo=new THREE.BufferGeometry();
  var v=new Float32Array([
    -hx,hAtMinZ,-hz, hx,hAtMinZ,-hz, hx,hAtMaxZ,hz, -hx,hAtMaxZ,hz,
    -hx,0,-hz, hx,0,-hz, hx,0,hz, -hx,0,hz
  ]);
  var idx=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3];
  geo.setAttribute('position',new THREE.BufferAttribute(v,3)); geo.setIndex(idx); geo.computeVertexNormals();
  var m=new THREE.Mesh(geo,material); m.position.set(r.x,0,r.z); m.castShadow=true; m.receiveShadow=true; return m;
}
