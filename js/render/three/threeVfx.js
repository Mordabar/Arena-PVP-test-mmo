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
  var shardGeo = new THREE.OctahedronGeometry(0.52, 0);
  var sparkGeo = new THREE.ConeGeometry(0.22, 1.0, 5);
  var runeGeo = new THREE.TorusGeometry(0.40, 0.08, 5, 14);
  var GEOS = { orb: sphereGeo, wisp: sphereGeo, shard: shardGeo, spark: sparkGeo, rune: runeGeo };

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
        var style = p.style || 'orb';
        mesh.geometry = GEOS[style] || sphereGeo;
        _pos.set(p.x, p.y, p.z);
        if (style === 'spark') _scale.set(size * 0.45, size * 1.9, size * 0.45);
        else if (style === 'rune') _scale.set(size * 1.7, size * 1.7, size * 1.7);
        else if (style === 'wisp') _scale.set(size * 0.75, size * 1.15, size * 0.75);
        else _scale.set(size, size, size);
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
      sphereGeo.dispose(); shardGeo.dispose(); sparkGeo.dispose(); runeGeo.dispose();
    }
  };
}


/* =============================================================================
 * Proyectiles visibles — flechas y magia con estela.
 *
 * La simulación ya mantiene world.projectiles y decide impacto/velocidad. Aquí
 * sólo se interpola prevPos→pos y se representa el vuelo. Esto corrige el fallo
 * perceptual de “pulso sale de la nada y aparece daño”: ahora hay una lectura
 * continua desde el caster hasta el objetivo.
 * ========================================================================== */
export function createProjectileRenderer(Arena, scene) {
  const MAX = 96;
  const arrowBodyGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.72, 5);
  const arrowHeadGeo = new THREE.ConeGeometry(0.055, 0.18, 6);
  const boltCoreGeo = new THREE.IcosahedronGeometry(0.115, 1);
  const haloGeo = new THREE.TorusGeometry(0.20, 0.018, 5, 20);
  const trailGeo = new THREE.IcosahedronGeometry(0.055, 0);
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xd6c29a, roughness: 0.72, metalness: 0.05 });
  const arrowHeadMat = new THREE.MeshStandardMaterial({ color: 0xb8c1ca, roughness: 0.34, metalness: 0.72 });

  function magicColor(id) {
    if (/invernal|estasis/i.test(id || '')) return 0x79d9ff;
    if (/impacto_celeste/i.test(id || '')) return 0xc59cff;
    if (/corrupcion|marca_corrosiva/i.test(id || '')) return 0xc76aff;
    if (/descarga/i.test(id || '')) return 0xff8b51;
    return 0x9f8cff;
  }

  const pool = [];
  for (let i=0;i<MAX;i++) {
    const root = new THREE.Group(); root.visible = false;
    const arrow = new THREE.Group();
    const body = new THREE.Mesh(arrowBodyGeo, arrowMat); body.position.y = 0;
    const head = new THREE.Mesh(arrowHeadGeo, arrowHeadMat); head.position.y = 0.45;
    body.castShadow = head.castShadow = true; arrow.add(body, head); root.add(arrow);

    const magic = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x9f8cff, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xb9b0ff, transparent:true, opacity:0.52, blending:THREE.AdditiveBlending, depthWrite:false });
    const core = new THREE.Mesh(boltCoreGeo, coreMat); magic.add(core);
    const halo = new THREE.Mesh(haloGeo, haloMat); halo.rotation.x = Math.PI/2; magic.add(halo);
    const trails=[];
    for (let t=0;t<4;t++) {
      const tm = new THREE.MeshBasicMaterial({ color:0x9f8cff, transparent:true, opacity:0.35 - t*0.055, blending:THREE.AdditiveBlending, depthWrite:false });
      const tr = new THREE.Mesh(trailGeo, tm); magic.add(tr); trails.push(tr);
    }
    root.add(magic); scene.add(root);
    pool.push({root,arrow,magic,core,halo,trails,coreMat,haloMat});
  }

  const pos = new THREE.Vector3(), prev = new THREE.Vector3(), dir = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0,1,0);

  return {
    render(world, alpha, time) {
      let used=0;
      for (let i=0;i<world.projectiles.length && used<MAX;i++) {
        const p=world.projectiles[i], h=pool[used++];
        const x=p.prevPos.x+(p.pos.x-p.prevPos.x)*alpha;
        const y=p.prevPos.y+(p.pos.y-p.prevPos.y)*alpha;
        const z=p.prevPos.z+(p.pos.z-p.prevPos.z)*alpha;
        pos.set(x,y,z); prev.set(p.prevPos.x,p.prevPos.y,p.prevPos.z);
        dir.copy(pos).sub(prev);
        if (dir.lengthSq()<1e-6) {
          const target=world.getEntity(p.targetId);
          if (target) dir.set(target.pos.x-x, target.pos.y+target.height*.55-y, target.pos.z-z);
          else dir.set(0,0,1);
        }
        dir.normalize();
        h.root.visible=true; h.root.position.copy(pos);
        const magic=p.kind==='bolt'; h.magic.visible=magic; h.arrow.visible=!magic;
        if (!magic) {
          h.arrow.quaternion.setFromUnitVectors(yAxis,dir);
          h.arrow.scale.setScalar(1.0);
        } else {
          const col=magicColor(p.abilityId);
          h.coreMat.color.setHex(col); h.haloMat.color.setHex(col);
          h.core.scale.setScalar(0.90+Math.sin((time||0)*18+i)*0.12);
          h.halo.rotation.z=(time||0)*7+i*.7;
          h.halo.scale.setScalar(0.86+Math.sin((time||0)*11+i)*0.12);
          for (let t=0;t<h.trails.length;t++) {
            const tr=h.trails[t], d=.16*(t+1);
            tr.position.set(-dir.x*d,-dir.y*d,-dir.z*d);
            tr.scale.setScalar(1-t*.14);
            tr.material.color.setHex(col);
          }
        }
      }
      for (let i=used;i<pool.length;i++) pool[i].root.visible=false;
    },
    dispose() {
      for (const h of pool) scene.remove(h.root);
      arrowBodyGeo.dispose(); arrowHeadGeo.dispose(); boltCoreGeo.dispose(); haloGeo.dispose(); trailGeo.dispose();
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
