/* =============================================================================
 * render/three/threeVfx.js — Dibujo de efectos para la presentación Three.js.
 *
 * SEPARACIÓN QUE ESTE FICHERO HACE POSIBLE
 *
 * `render/vfx.js` hace dos cosas distintas: escucha eventos de combate y
 * mantiene un pool de partículas (ESTADO), y las pinta con WebGL nativo
 * (DIBUJO). El estado es común a las dos presentaciones —los mismos eventos,
 * las mismas partículas, los mismos tiempos—; sólo el dibujo cambia.
 *
 * Aquí se implementa únicamente el DIBUJO. El estado se sigue actualizando en
 * `VFX.update`, así que un impacto dura lo mismo y sale del mismo sitio en las
 * dos versiones. Si se hubiera reimplementado el estado, los efectos se
 * desincronizarían del combate y nadie sabría cuál de los dos miente.
 *
 * Pool fijo de mallas, igual que el pool fijo de partículas: crear objetos por
 * impacto provoca microtirones de recolección justo en el burst.
 * ========================================================================== */
import * as THREE from 'three';

const MAX_SPRITES = 600;

export function createVfxRenderer(Arena, scene) {
  var VFX = Arena.Render.VFX;

  /* Una sola geometría para todas las partículas. El tamaño va en la escala del
     objeto, no en geometrías distintas. */
  var sphereGeo = new THREE.IcosahedronGeometry(0.5, 0);

  /* InstancedMesh sería más rápido, pero exige color por instancia y aquí el
     color cambia por partícula y por fotograma. Con 600 mallas sencillas y
     materiales compartidos por color redondeado, el coste es asumible y el
     código es legible. Si algún día son 5000, esto es lo que hay que cambiar. */
  var pool = [];
  var matCache = Object.create(null);

  function materialFor(r, g, b) {
    // Se redondea el color a 32 niveles: sin esto habría un material nuevo por
    // partícula y por fotograma, que es exactamente el problema que el pool
    // pretende evitar.
    var key = ((r * 31) | 0) + '_' + ((g * 31) | 0) + '_' + ((b * 31) | 0);
    var m = matCache[key];
    if (m) return m;
    m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    matCache[key] = m;
    return m;
  }

  for (var i = 0; i < MAX_SPRITES; i++) {
    var m = new THREE.Mesh(sphereGeo, materialFor(1, 1, 1));
    m.visible = false;
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
    scene.add(m);
    pool.push(m);
  }

  var _pos = new THREE.Vector3();
  var _quat = new THREE.Quaternion();
  var _scale = new THREE.Vector3();

  return {
    /**
     * Pinta el estado actual del pool de partículas.
     * NO lo avanza: de eso se encarga `VFX.update`, compartido con el renderer
     * nativo para que los tiempos sean idénticos en ambos.
     */
    render: function () {
      var used = 0;
      var particles = VFX.particles;
      for (var i = 0; i < particles.length && used < MAX_SPRITES; i++) {
        var p = particles[i];
        if (!p.alive) continue;
        var mesh = pool[used++];
        var t = p.life / Math.max(p.maxLife, 1e-4);
        var size = p.size + (p.endSize - p.size) * t;

        mesh.visible = true;
        _pos.set(p.x, p.y, p.z);
        _scale.set(size, size, size);
        mesh.matrix.compose(_pos, _quat, _scale);
        mesh.matrixWorldNeedsUpdate = true;

        var mat = materialFor(p.r, p.g, p.b);
        if (mesh.material !== mat) mesh.material = mat;
        // La opacidad va en el material compartido, así que se toma la del
        // último en escribirla. A cambio de esa imprecisión —invisible en una
        // ráfaga de 40 ms— se evitan 600 materiales.
        mat.opacity = Math.max(0, 1 - t);
      }
      for (var j = used; j < pool.length; j++) {
        if (!pool[j].visible) break;      // el pool se llena por delante
        pool[j].visible = false;
      }
    },

    dispose: function () {
      for (var i = 0; i < pool.length; i++) scene.remove(pool[i]);
      pool.length = 0;
      sphereGeo.dispose();
    }
  };
}

/* =============================================================================
 * Indicadores de selección, hover y bando
 *
 * Van aquí y no en el personaje porque no son parte del cuerpo: son interfaz
 * dibujada en el mundo. El brief pide un anillo bajo los pies y un resaltado
 * MUY suave al pasar el cursor — no el contorno grueso de un shooter, que
 * arruina la lectura de siluetas justo cuando hay cuatro personajes juntos.
 * ========================================================================== */
export function createSelectionRings(Arena, scene) {
  var ringGeo = new THREE.RingGeometry(0.80, 0.98, 40);
  ringGeo.rotateX(-Math.PI / 2);

  /* --- Sombra de contacto ---------------------------------------------------
   * Una mancha suave bajo los pies, aparte del mapa de sombras.
   *
   * No es redundante: el mapa de sombras es direccional, así que con el sol
   * oblicuo la sombra cae a un lado y el personaje parece flotar sobre el punto
   * donde realmente está. Esta mancha es la oclusión de contacto —lo que
   * ocurre justo debajo, donde no entra luz de ninguna dirección— y es lo que
   * ancla el cuerpo al suelo. Es el truco más barato que existe para que una
   * escena deje de parecer una maqueta de figuras sueltas. */
  var contactTex = makeRadialTexture();
  var contactGeo = new THREE.PlaneGeometry(1, 1);
  contactGeo.rotateX(-Math.PI / 2);
  var contactMat = new THREE.MeshBasicMaterial({
    map: contactTex, transparent: true, opacity: 0.62,
    depthWrite: false, color: 0x05070c
  });
  var contactPool = [];

  /* Mezcla NORMAL, no aditiva. Un anillo aditivo sobre suelo claro satura a
     blanco y pierde el color, que es justo la información que transporta: verde
     eres tú, azul aliado, rojo enemigo. Además brillaba más que el personaje. */
  function ringMat(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true, opacity: opacity,
      depthWrite: false, side: THREE.DoubleSide
    });
  }

  var MATS = {
    player: ringMat(0x3ad98a, 0.80),
    ally: ringMat(0x3f8ff0, 0.62),
    enemy: ringMat(0xe8483a, 0.62),
    selected: ringMat(0xffcf42, 0.90),
    hover: ringMat(0xdfe8ff, 0.22)      // muy suave a propósito
  };

  var pool = [];
  var _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

  function take(n) {
    while (pool.length <= n) {
      var m = new THREE.Mesh(ringGeo, MATS.ally);
      m.matrixAutoUpdate = false;
      m.visible = false;
      scene.add(m);
      pool.push(m);
    }
    return pool[n];
  }

  function takeContact(n) {
    while (contactPool.length <= n) {
      var m = new THREE.Mesh(contactGeo, contactMat);
      m.matrixAutoUpdate = false;
      m.visible = false;
      m.renderOrder = 1;       // sobre el suelo opaco, bajo los anillos
      scene.add(m);
      contactPool.push(m);
    }
    return contactPool[n];
  }

  return {
    render: function (world, playerId, selectedId, hoverId, alpha) {
      var V = Arena.Math.Vec3;
      var player = world.getEntity(playerId);
      var used = 0, contacts = 0;

      for (var i = 0; i < world.entities.length; i++) {
        var e = world.entities[i];
        if (!e.alive) continue;
        if (e.mods().stealthed && e.id !== playerId) continue;

        var pos = V.lerp(V.create(), e.prevPos, e.pos, alpha);
        var friendly = player ? !world.areHostile(player, e) : (e.team === 0);

        // Sombra de contacto para todo el mundo, vivo o no.
        var cs = takeContact(contacts++);
        cs.visible = true;
        _p.set(pos.x, pos.y + 0.006, pos.z);
        _s.set(e.radius * 3.6, 1, e.radius * 3.6);
        cs.matrix.compose(_p, _q, _s);
        cs.matrixWorldNeedsUpdate = true;

        var kind = (e.id === playerId) ? 'player' : (friendly ? 'ally' : 'enemy');
        var mesh = take(used++);
        mesh.material = MATS[kind];
        mesh.visible = true;
        _p.set(pos.x, pos.y + 0.02, pos.z);
        _s.set(e.radius * 2.1, 1, e.radius * 2.1);
        mesh.matrix.compose(_p, _q, _s);
        mesh.matrixWorldNeedsUpdate = true;

        // Anillo extra, más brillante y algo mayor, para el objetivo y el hover.
        if (e.id === selectedId || e.id === hoverId) {
          var extra = take(used++);
          extra.material = (e.id === selectedId) ? MATS.selected : MATS.hover;
          extra.visible = true;
          _p.set(pos.x, pos.y + 0.035, pos.z);
          _s.set(e.radius * 2.6, 1, e.radius * 2.6);
          extra.matrix.compose(_p, _q, _s);
          extra.matrixWorldNeedsUpdate = true;
        }
      }
      for (var j = used; j < pool.length; j++) pool[j].visible = false;
      for (var c = contacts; c < contactPool.length; c++) contactPool[c].visible = false;
    }
  };
}

/**
 * Textura radial suave, generada en un canvas de 64×64.
 *
 * Se genera en código y no se carga de un fichero por una razón práctica: es un
 * asset menos que subir, que versionar y que puede faltar en producción. Para
 * un degradado radial no compensa un PNG.
 */
function makeRadialTexture() {
  var size = 64;
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  var ctx = canvas.getContext('2d');
  var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Núcleo casi opaco y caída rápida: una sombra de contacto es pequeña y
  // densa. Un degradado ancho y suave se lee como niebla, no como oclusión.
  g.addColorStop(0.00, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  var tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
