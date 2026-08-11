/* =============================================================================
 * render/three/threeEnvironment.js — Escenario, luces y niebla.
 *
 * Construye la arena UNA VEZ a partir de la misma geometría que usa la
 * simulación (`world.arena`), y no vuelve a tocarla. Nada de crear objetos por
 * fotograma: el escenario es estático porque la arena lo es.
 *
 * La meta visual no es fotorrealismo, es LEGIBILIDAD. En un PvP a 20 unidades
 * hay que distinguir de un vistazo dónde acaba el suelo, dónde hay cobertura y
 * quién está detrás de qué. Un escenario recargado es un escenario en el que se
 * pierde al enemigo, y eso no es una cuestión de gusto: es jugabilidad.
 * ========================================================================== */
import * as THREE from 'three';

/* Paleta fantasy arena. Fría en sombra, cálida bajo la luz: ese contraste es lo
   que separa una silueta del fondo sin necesidad de contornos. */
export const PALETTE = {
  /* Luz de tarde: cielo frío arriba, rebote cálido del suelo abajo. Esa
     oposición de temperatura es lo que da volumen a una superficie plana sin
     necesidad de texturas: la cara que mira al cielo se enfría, la que mira al
     suelo se calienta, y el ojo lee la forma. */
  sky: 0x9fb2cf,
  ground: 0x5c4f40,
  sun: 0xffe9c4,

  // Degradado del cielo, de cenit a horizonte.
  skyTop: 0x24406e,
  skyHorizon: 0x9db4cd,
  fog: 0x8296ae,          // la niebla iguala al horizonte o se ve el corte

  /* JERARQUÍA DE VALORES. Antes todo vivía entre el 50 % y el 55 % de
     luminosidad: suelo, muros y plataformas indistinguibles, y el personaje
     —que debería ser el punto focal— era lo más oscuro del encuadre. Sin
     escalón de valor no hay lectura, y ninguna cantidad de luces lo arregla.
     Ahora: suelo OSCURO y frío, arquitectura CLARA y cálida. El personaje cae
     en el medio y se recorta contra las dos. */
  floor: 0x2f3644,
  floorLine: 0x53617c,
  wall: 0xa2968a,         // piedra cálida contra suelo frío
  pillar: 0xb3a698,
  platform: 0x8d8478,
  ramp: 0x847b70,
  rock: 0x9a9086,
  accent: 0xffb45e        // luz de brasero: el único color saturado de la escena
};

/** Material compartido. Crear uno por objeto multiplica los cambios de estado. */
function mat(color, opts) {
  opts = opts || {};
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: opts.roughness === undefined ? 0.92 : opts.roughness,
    metalness: opts.metalness === undefined ? 0.02 : opts.metalness,
    flatShading: opts.flat !== false
  });
}

export function createEnvironment(scene, arena) {
  var group = new THREE.Group();
  group.name = 'environment';

  /* --- Luces ------------------------------------------------------------
   * Una direccional con sombras y un hemisférico. Nada más: cada luz con
   * sombras cuesta un pase de render completo, y con dos ya no se llega a 60. */
  /* Intensidades para el pipeline moderno de Three (r155+), donde las luces ya
     no usan las unidades heredadas. Con los valores "de toda la vida" la escena
     sale sub-expuesta y el tonemap ACES lo agrava: se pierde el suelo, se
     pierden las siluetas y no se distingue quién está detrás de qué columna. */
  var hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, 2.4);
  scene.add(hemi);

  /* Relación luz/ambiente contenida. Con el sol muy por encima del hemisférico
     las sombras se vuelven manchas azules planas y sólidas: llaman más la
     atención que los personajes, que es lo contrario de lo que debe pasar. */
  var sun = new THREE.DirectionalLight(PALETTE.sun, 3.0);
  sun.position.set(18, 34, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  /* El volumen de sombra se ciñe a la arena. Una ortográfica generosa "por si
     acaso" reparte los 2048 píxeles sobre espacio vacío y las sombras salen
     dentadas justo donde importan, bajo los pies. */
  var span = Math.sqrt(arena.width * arena.width + arena.depth * arena.depth) * 0.55;
  var c = sun.shadow.camera;
  c.left = -span; c.right = span; c.top = span; c.bottom = -span;
  c.near = 8; c.far = 96;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  /* --- Cielo ---------------------------------------------------------------
   * Una esfera vista desde dentro con un degradado vertical. Cuesta un draw
   * call y cambia por completo la percepción de calidad: un fondo de color
   * plano se lee como "escena de pruebas" por bien iluminado que esté todo lo
   * demás, porque no hay ninguna superficie natural de color uniforme.
   *
   * La niebla se iguala al color del HORIZONTE, no al del cenit: si no, la
   * geometría lejana se disuelve hacia un tono que no está donde debería y
   * aparece un corte visible a media altura. */
  var skyGeo = new THREE.SphereGeometry(160, 24, 16);
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      horizonColor: { value: new THREE.Color(PALETTE.skyHorizon) }
    },
    vertexShader: [
      'varying vec3 vWorld;',
      'void main() {',
      '  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 topColor;',
      'uniform vec3 horizonColor;',
      'varying vec3 vWorld;',
      'void main() {',
      '  float h = clamp(normalize(vWorld).y, 0.0, 1.0);',
      // Curva, no lineal: el degradado real del cielo se concentra cerca del
      // horizonte y un lerp recto se ve como una rampa de Photoshop.
      '  float t = pow(h, 0.55);',
      '  gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);',
      '}'
    ].join('\n')
  });
  var sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0125);
  scene.background = new THREE.Color(PALETTE.skyHorizon);

  /* --- Suelo --------------------------------------------------------------
   * Un plano segmentado, no uno liso: los vértices extra permiten que la luz
   * direccional produzca variación y que el flat shading tenga algo que
   * facetar. Sin segmentar, el suelo es una superficie plana y muerta. */
  var floorGeo = new THREE.PlaneGeometry(arena.width, arena.depth, 24, 24);
  floorGeo.rotateX(-Math.PI / 2);
  var floor = new THREE.Mesh(floorGeo, mat(PALETTE.floor, { roughness: 0.98, flat: false }));
  floor.receiveShadow = true;
  group.add(floor);

  // Rejilla de referencia. Da escala y velocidad percibida: sin ella, correr
  // por una superficie uniforme no se siente como avanzar.
  var grid = new THREE.GridHelper(
    Math.max(arena.width, arena.depth), Math.round(Math.max(arena.width, arena.depth) / 2),
    PALETTE.floorLine, PALETTE.floorLine);
  grid.material.opacity = 0.30;
  grid.material.transparent = true;
  grid.position.y = 0.012;
  group.add(grid);

  /* --- Geometría de la arena ----------------------------------------------
   * Se lee de `world.arena`, que es la MISMA fuente que usa la simulación para
   * la colisión y la línea de visión. Si el muro que se ve y el muro que
   * bloquea no salieran del mismo sitio, el jugador acabaría disparando a
   * paredes invisibles. */
  var wallMat = mat(PALETTE.wall, { roughness: 0.88 });
  var pillarMat = mat(PALETTE.pillar, { roughness: 0.80 });
  var platMat = mat(PALETTE.platform, { roughness: 0.90 });
  var boxGeo = new THREE.BoxGeometry(1, 1, 1);

  var i, o, m;
  var rampMat = mat(PALETTE.ramp, { roughness: 0.92 });
  for (i = 0; i < arena.obstacles.length; i++) {
    o = arena.obstacles[i];
    // El tipo lo declara el propio dato de arena; deducirlo de las proporciones
    // sería adivinar algo que ya está escrito.
    m = new THREE.Mesh(boxGeo, o.kind === 'pillar' ? pillarMat : wallMat);
    m.position.set(o.center.x, o.center.y + o.size.y / 2, o.center.z);
    m.scale.set(o.size.x, o.size.y, o.size.z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  for (i = 0; i < arena.platforms.length; i++) {
    var p = arena.platforms[i];
    m = new THREE.Mesh(boxGeo, platMat);
    m.position.set(p.x, p.h / 2, p.z);
    m.scale.set(p.sx, Math.max(0.05, p.h), p.sz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);

    if (p.ramp) group.add(buildRamp(p.ramp, rampMat));
  }

  /* --- Props ---------------------------------------------------------------
   * Unas pocas rocas en el perímetro. NO llevan colisión, así que se colocan
   * fuera del área jugable: un obstáculo que se ve pero no bloquea es peor que
   * no tener obstáculo, porque enseña al jugador a desconfiar de lo que ve. */
  var rockGeo = new THREE.DodecahedronGeometry(1, 0);
  var rockMat = mat(PALETTE.rock, { roughness: 0.95 });
  var hw = arena.width / 2, hd = arena.depth / 2;
  var rocks = [
    [-hw + 1.2, -hd + 1.6, 1.5], [hw - 1.5, -hd + 1.1, 1.1],
    [-hw + 1.0, hd - 1.4, 1.3], [hw - 1.1, hd - 1.7, 1.7],
    [0, -hd + 0.9, 0.9], [0, hd - 0.9, 1.0]
  ];
  for (i = 0; i < rocks.length; i++) {
    m = new THREE.Mesh(rockGeo, rockMat);
    m.position.set(rocks[i][0], rocks[i][2] * 0.35, rocks[i][1]);
    var s = rocks[i][2];
    m.scale.set(s, s * 0.7, s * 0.9);
    m.rotation.set(i * 0.7, i * 1.3, i * 0.4);   // determinista, nunca aleatorio
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  /* --- Braseros -----------------------------------------------------------
   * Cuatro puntos de luz cálida en las esquinas del área jugable. No iluminan
   * de verdad —serían cuatro pases de sombra— pero sí aportan lo único que le
   * faltaba a la paleta: un color saturado contra el que todo lo demás se lee
   * como piedra. Una escena entera en la misma familia de color se percibe como
   * sin terminar por muy correcta que sea la iluminación. */
  var brazierMat = mat(PALETTE.wall, { roughness: 0.9 });
  var flameMat = new THREE.MeshBasicMaterial({ color: PALETTE.accent });
  var bowlGeo = new THREE.CylinderGeometry(0.34, 0.20, 0.30, 8);
  var stemGeo = new THREE.CylinderGeometry(0.10, 0.15, 1.10, 6);
  var flameGeo = new THREE.IcosahedronGeometry(0.26, 0);
  var braziers = [[-9, -6], [9, -6], [-9, 6], [9, 6]];
  for (i = 0; i < braziers.length; i++) {
    var bx = braziers[i][0], bz = braziers[i][1];
    var stem = new THREE.Mesh(stemGeo, brazierMat);
    stem.position.set(bx, 0.55, bz);
    stem.castShadow = true; stem.receiveShadow = true;
    group.add(stem);
    var bowl = new THREE.Mesh(bowlGeo, brazierMat);
    bowl.position.set(bx, 1.22, bz);
    bowl.castShadow = true;
    group.add(bowl);
    var flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(bx, 1.42, bz);
    flame.scale.set(1, 1.5, 1);
    group.add(flame);
    // Luz sin sombras: aporta el tinte cálido alrededor sin coste de pase.
    var glow = new THREE.PointLight(PALETTE.accent, 9.0, 9.0, 2.0);
    glow.position.set(bx, 1.5, bz);
    scene.add(glow);
  }

  scene.add(group);
  return { group: group, sun: sun, hemi: hemi };
}

/**
 * Rampa como prisma.
 *
 * Las alturas de los dos extremos se derivan de la MISMA fórmula que usa
 * `arena.groundHeightAt`, no de una suposición sobre qué extremo es el alto. Si
 * la rampa que se ve y la que se camina discreparan, el personaje subiría por
 * el aire o se hundiría en la geometría — y el jugador culparía a la física.
 */
function buildRamp(r, material) {
  // t = (z + sz/2)/sz, invertido cuando dir < 0; h = from + (to − from)·t
  var hAtMinZ = r.dir < 0 ? r.to : r.from;
  var hAtMaxZ = r.dir < 0 ? r.from : r.to;
  var hMin = hAtMinZ, hMax = hAtMaxZ;
  var hx = r.sx / 2, hz = r.sz / 2;

  var geo = new THREE.BufferGeometry();
  // La pendiente corre a lo largo de Z: bajo en −Z, alto en +Z (o al revés,
  // según `dir`, que ya se ha resuelto arriba).
  var v = new Float32Array([
    -hx, hMin, -hz, hx, hMin, -hz, hx, hMax, hz, -hx, hMax, hz,   // superficie
    -hx, 0, -hz, hx, 0, -hz, hx, 0, hz, -hx, 0, hz                // base
  ]);
  var idx = [
    0, 2, 1, 0, 3, 2,        // rampa
    4, 5, 6, 4, 6, 7,        // base
    0, 1, 5, 0, 5, 4,        // lado bajo
    3, 7, 6, 3, 6, 2,        // lado alto
    1, 2, 6, 1, 6, 5,        // costado +X
    0, 4, 7, 0, 7, 3         // costado −X
  ];
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  var m = new THREE.Mesh(geo, material);
  m.position.set(r.x, 0, r.z);
  m.receiveShadow = true;
  m.castShadow = false;   // una rampa es suelo: su sombra sólo produce acné
  return m;
}
