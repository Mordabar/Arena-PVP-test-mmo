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
  sky: 0x9aa8c0,          // rebote de cielo: frío, claro y POCO saturado
  ground: 0x4a443c,       // rebote de suelo: cálido y apagado
  fog: 0x2b3446,
  sun: 0xfff4e2,
  floor: 0x6f7789,
  floorLine: 0x99a5bd,
  wall: 0x8a8794,
  pillar: 0x9a94a2,
  platform: 0x7b8296,
  ramp: 0x757d92,
  rock: 0x8b8690
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
  var hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, 3.1);
  scene.add(hemi);

  /* Relación luz/ambiente contenida. Con el sol muy por encima del hemisférico
     las sombras se vuelven manchas azules planas y sólidas: llaman más la
     atención que los personajes, que es lo contrario de lo que debe pasar. */
  var sun = new THREE.DirectionalLight(PALETTE.sun, 2.35);
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

  // Niebla suave: separa los planos sin tragarse el fondo de la arena.
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0085);
  scene.background = new THREE.Color(PALETTE.fog);

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
  grid.material.opacity = 0.22;
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
