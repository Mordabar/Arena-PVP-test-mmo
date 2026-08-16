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

  /* v0.12 — structured spell silhouettes. These objects are presentation-only:
     they consume VFX.spells emitted at authoritative RELEASE and never decide
     damage or impact. */
  var MAX_SEMANTIC = 96;
  var semanticCoreGeo = new THREE.IcosahedronGeometry(0.5, 1);
  var semanticMeteorGeo = new THREE.DodecahedronGeometry(0.58, 0);
  var semanticShardGeo = new THREE.ConeGeometry(0.12, 0.82, 5);
  var semanticRingGeo = new THREE.TorusGeometry(0.62, 0.045, 6, 28);
  var semanticPool = [];
  for (var spx=0; spx<MAX_SEMANTIC; spx++) {
    var root=new THREE.Group(); root.visible=false;
    var cm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
    var rm=cm.clone(); rm.opacity=.7;
    var core=new THREE.Mesh(semanticCoreGeo,cm); root.add(core);
    var ring=new THREE.Mesh(semanticRingGeo,rm); ring.rotation.x=Math.PI/2; root.add(ring);
    var shards=[];
    for (var sj=0;sj<8;sj++){ var sm=new THREE.Mesh(semanticShardGeo,cm); root.add(sm); shards.push(sm); }
    var arr=new Float32Array(9*3); var lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.BufferAttribute(arr,3));
    var lm=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
    var line=new THREE.Line(lg,lm); root.add(line);
    scene.add(root); semanticPool.push({root:root,core:core,ring:ring,shards:shards,line:line,cm:cm,rm:rm,lm:lm,lg:lg});
  }

  function semColor(element) {
    var c=VFX.elementColor ? VFX.elementColor(element) : [0.65,0.4,1];
    return new THREE.Color(c[0],c[1],c[2]);
  }
  function semLerp(a,b,t){ return a+(b-a)*t; }
  function setSemantic(h,sp,time) {
    var t=Math.max(0,Math.min(1,sp.life/Math.max(sp.maxLife,1e-4))), fade=1-t;
    var col=semColor(sp.element); h.cm.color.copy(col); h.rm.color.copy(col); h.lm.color.copy(col);
    h.cm.opacity=Math.max(.15,fade); h.rm.opacity=Math.max(.08,fade*.72); h.lm.opacity=Math.max(.08,fade);
    h.root.visible=true; h.core.visible=true; h.ring.visible=true; h.line.visible=false;
    for(var j=0;j<h.shards.length;j++) h.shards[j].visible=false;
    var ex=sp.ex,ey=sp.ey,ez=sp.ez,sx=sp.sx,sy=sp.sy,sz=sp.sz;
    var type=sp.type||'arcaneBolt', px=ex,py=ey,pz=ez;
    h.core.geometry=(type==='meteor'?semanticMeteorGeo:semanticCoreGeo);
    if(type==='fireball'||type==='magmaOrb'||type==='fireBolt'||type==='shadowBolt'||type==='arcaneBolt'){
      var travel=Math.min(1,t/.78); travel=1-Math.pow(1-travel,2);
      px=semLerp(sx,ex,travel); py=semLerp(sy,ey,travel)+Math.sin(travel*Math.PI)*.24; pz=semLerp(sz,ez,travel);
      h.core.position.set(px,py,pz); var k=(type==='magmaOrb'?.72:.48)*(1+.12*Math.sin((time||0)*20)); h.core.scale.setScalar(k);
      h.ring.position.set(px,py,pz); h.ring.scale.setScalar(k*1.45); h.ring.rotation.z=(time||0)*5;
      for(j=0;j<5;j++){var sh=h.shards[j];sh.visible=true;var q=(j+1)*.11;sh.position.set(semLerp(px,sx,q),semLerp(py,sy,q),semLerp(pz,sz,q));sh.scale.setScalar(.22+q*.3);sh.rotation.z=(time||0)*4+j;}
    } else if(type==='meteor'){
      var mt=Math.min(1,t/.78); mt=mt*mt;
      px=semLerp(sx,ex,mt);py=semLerp(sy,ey,mt);pz=semLerp(sz,ez,mt);
      h.core.position.set(px,py,pz);h.core.scale.setScalar(.76);h.core.rotation.x=(time||0)*5;h.core.rotation.z=(time||0)*3;
      h.ring.position.set(ex,ey+.05,ez);h.ring.scale.setScalar(.7+1.9*t);h.ring.rotation.x=Math.PI/2;
      for(j=0;j<8;j++){var ms=h.shards[j];ms.visible=true;ms.position.set(px+Math.sin(j*2.1)*.20,py+.35+j*.25,pz+Math.cos(j*1.7)*.20);ms.scale.set(.16,.7,.16);ms.rotation.z=Math.PI;}
    } else if(type==='lightningBolt'){
      h.core.position.set(ex,ey,ez);h.core.scale.setScalar(.22+.45*fade);h.ring.visible=false;h.line.visible=true;
      var pos=h.lg.attributes.position.array;
      var dx=ex-sx,dy=ey-sy,dz=ez-sz,len=Math.sqrt(dx*dx+dz*dz)||1, nx=-dz/len,nz=dx/len;
      for(j=0;j<9;j++){var u=j/8,jitter=(j===0||j===8)?0:Math.sin((j*7.13+sp.seed*1.37+(time||0)*44))*0.22*(1-Math.abs(.5-u));pos[j*3]=semLerp(sx,ex,u)+nx*jitter;pos[j*3+1]=semLerp(sy,ey,u)+Math.sin(j*4.7+sp.seed)*.10;pos[j*3+2]=semLerp(sz,ez,u)+nz*jitter;} h.lg.attributes.position.needsUpdate=true;
    } else if(type==='fireImpact'||type==='magmaImpact'||type==='meteorImpact'){
      h.core.position.set(ex,ey+.16,ez); h.core.scale.setScalar((type==='magmaImpact'?.42:.30)*fade+.12);
      h.ring.position.set(ex,ey+.03,ez); h.ring.scale.setScalar(.45+(1.5+(sp.radius||1)*.12)*t); h.ring.rotation.x=Math.PI/2;
      for(j=0;j<8;j++){var fs=h.shards[j];fs.visible=true;var fa=j*Math.PI/4+sp.seed*.11,fr=.15+(1.15+(sp.radius||1)*.08)*t;fs.position.set(ex+Math.cos(fa)*fr,ey+.10+Math.sin(t*Math.PI)*.65+((j%2)*.18),ez+Math.sin(fa)*fr);fs.scale.set(.18,.42+.55*fade,.18);fs.rotation.z=-fa;}
    } else if(type==='iceBurst'||type==='crystalBurst'||type==='freezePrison'||type==='earthSpike'||type==='stoneFist'){
      h.core.visible=type!=='freezePrison'; h.core.position.set(ex,ey,ez);h.core.scale.setScalar(type==='stoneFist'?.55:.30*fade+.12);
      h.ring.position.set(ex,ey+.02,ez);h.ring.scale.setScalar(.7+1.5*t);
      for(j=0;j<8;j++){var is=h.shards[j];is.visible=true;var a=j*Math.PI/4+(type==='freezePrison'?.25:0),rr=(type==='freezePrison'?.72:(.2+1.0*t));is.position.set(ex+Math.cos(a)*rr,ey+(type==='freezePrison'?.55+t*.65:.12+Math.sin(a*2)*.18),ez+Math.sin(a)*rr);is.scale.set(type==='freezePrison'?.30:.18,type==='freezePrison'?1.25:(.65+.65*fade),type==='freezePrison'?.30:.18);is.rotation.z=-a;}
    } else if(type==='iceStorm'||type==='lightningStorm'||type==='tornado'||type==='doomAura'||type==='dreadWave'||type==='fireField'||type==='darkTide'){
      h.core.visible=false;h.ring.position.set(ex,ey+.05,ez);h.ring.scale.setScalar((.65+(sp.radius||4)*.10)*(1+.18*Math.sin(t*Math.PI)));h.ring.rotation.z=(time||0)*(type==='tornado'?4:1.5);
      for(j=0;j<8;j++){var ss=h.shards[j];ss.visible=true;var aa=j*Math.PI/4+(time||0)*(type==='tornado'?2.8:.8),rr2=Math.max(.8,(sp.radius||4)*.18)*(type==='dreadWave'||type==='darkTide'?(1+t*2):1);ss.position.set(ex+Math.cos(aa)*rr2,ey+.25+(type==='tornado'?j*.18:Math.sin(aa*2)*.22),ez+Math.sin(aa)*rr2);ss.scale.set(.18,type==='tornado'?.85:.45,.18);ss.rotation.z=-aa;}
    } else if(type==='controlSeal'||type==='darkSeal'||type==='elementExpose'||type==='debilitate'||type==='fracture'||type==='slowField'||type==='stoneBind'){
      /* Debuff/control: sello legible bajo el objetivo + cuatro agujas que
         cierran el espacio. La forma comunica restricción aunque el color no
         se perciba. */
      h.core.visible=false; h.ring.position.set(ex,ey+.04,ez); h.ring.scale.setScalar(.70+1.05*t); h.ring.rotation.z=(time||0)*2.6;
      for(j=0;j<4;j++){var ds=h.shards[j],da=j*Math.PI/2+(time||0)*.35,dr=.72+.25*Math.sin(t*Math.PI);ds.visible=true;ds.position.set(ex+Math.cos(da)*dr,ey+.38+.34*fade,ez+Math.sin(da)*dr);ds.scale.set(.16,.72+.25*fade,.16);ds.rotation.z=-da;}
    } else if(type==='ward'||type==='windWard'||type==='elementWard'||type==='healPulse'||type==='mastery'||type==='warCouncil'||type==='bloodPact'||type==='enrage'){
      /* Buff/defensa/curación: doble lectura ascendente, nunca parece un
         proyectil ofensivo. */
      h.core.position.set(ex,ey+.55,ez);h.core.scale.setScalar(type==='healPulse'?.28:.20);h.ring.position.set(ex,ey+.05,ez);h.ring.scale.setScalar(.70+1.45*t);h.ring.rotation.x=Math.PI/2;
      for(j=0;j<6;j++){var bs=h.shards[j],ba=j*Math.PI/3+(time||0)*.7,br=.42+.22*Math.sin(t*Math.PI);bs.visible=true;bs.position.set(ex+Math.cos(ba)*br,ey+.15+t*1.15+(j%2)*.14,ez+Math.sin(ba)*br);bs.scale.set(.12,.42,.12);bs.rotation.z=ba;}
    } else if(type==='summonSigil'||type==='possession'||type==='spiritSwarm'||type==='massRoots'||type==='aoeRune'){
      /* Invocación/ritual: anillo estable con piezas orbitales. */
      h.core.visible=type==='possession';h.core.position.set(ex,ey+.65,ez);h.core.scale.setScalar(.24+.14*fade);h.ring.position.set(ex,ey+.03,ez);h.ring.scale.setScalar(.92+(.45+(sp.radius||2)*.06)*t);h.ring.rotation.z=-(time||0)*2.1;
      for(j=0;j<8;j++){var rs=h.shards[j],ra=j*Math.PI/4+(time||0)*(type==='spiritSwarm'?2.2:1.0),rr=.55+(sp.radius||2)*.055;rs.visible=true;rs.position.set(ex+Math.cos(ra)*rr,ey+.22+.35*Math.sin(ra*2+(time||0)*2),ez+Math.sin(ra)*rr);rs.scale.set(.12,.36,.12);rs.rotation.z=-ra;}
    } else if(type==='lifeDrain'||type==='soulDrain'||type==='cremation'){
      /* Drain/cremación: vínculo visible objetivo→caster; la vida no se mueve
         aquí, sólo la representación del evento ya resuelto. */
      h.core.position.set(ex,ey,ez);h.core.scale.setScalar(.22+.20*fade);h.ring.position.set(ex,ey+.02,ez);h.ring.scale.setScalar(.55+1.1*t);h.line.visible=true;
      var dp=h.lg.attributes.position.array;
      for(j=0;j<9;j++){var du=j/8,dj=(j===0||j===8)?0:Math.sin(j*3.7+(time||0)*8)*.10;dp[j*3]=semLerp(ex,sx,du)+dj;dp[j*3+1]=semLerp(ey,sy,du)+Math.sin(du*Math.PI)*.30;dp[j*3+2]=semLerp(ez,sz,du)-dj;}h.lg.attributes.position.needsUpdate=true;
    } else {
      h.core.position.set(ex,ey,ez);h.core.scale.setScalar(.24+.25*fade);h.ring.position.set(ex,ey,ez);h.ring.scale.setScalar(.7+1.0*t);h.ring.rotation.z=(time||0)*2;
    }
  }

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

      var su=0, spells=VFX.spells||[];
      for (var si=0;si<spells.length && su<semanticPool.length;si++) {
        var sp=spells[si]; if(!sp.alive) continue;
        setSemantic(semanticPool[su++],sp,(typeof performance!=='undefined'?performance.now()/1000:0));
      }
      for (var sh=su;sh<semanticPool.length;sh++) semanticPool[sh].root.visible=false;
    },

    dispose: function () {
      for (var i = 0; i < pool.length; i++) scene.remove(pool[i]);
      pool.length = 0;
      sphereGeo.dispose(); shardGeo.dispose(); sparkGeo.dispose(); runeGeo.dispose();
      for (var spd=0;spd<semanticPool.length;spd++){ scene.remove(semanticPool[spd].root); semanticPool[spd].lg.dispose(); semanticPool[spd].cm.dispose(); semanticPool[spd].rm.dispose(); semanticPool[spd].lm.dispose(); }
      semanticCoreGeo.dispose(); semanticMeteorGeo.dispose(); semanticShardGeo.dispose(); semanticRingGeo.dispose();
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
  const fireballCoreGeo = new THREE.IcosahedronGeometry(0.185, 2);
  const magmaCoreGeo = new THREE.DodecahedronGeometry(0.205, 0);
  const haloGeo = new THREE.TorusGeometry(0.20, 0.018, 5, 20);
  const trailGeo = new THREE.IcosahedronGeometry(0.055, 0);
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xd6c29a, roughness: 0.72, metalness: 0.05 });
  const arrowHeadMat = new THREE.MeshStandardMaterial({ color: 0xb8c1ca, roughness: 0.34, metalness: 0.72 });

  function magicPresentation(id) {
    var ab=Arena.Data&&Arena.Data.abilities&&Arena.Data.abilities[id];
    var pr=ab&&ab.presentation||{};
    var palette={fire:0xff5a22,ice:0x67dcff,lightning:0xffdf45,wind:0x88ffd6,earth:0xc78a4b,shadow:0x994bff,nature:0x65dc6d,life:0x53ff9a,arcane:0xac78ff};
    return {color:palette[pr.element]||0x9f8cff,shape:pr.shape||'arcaneBolt'};
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
          const mp=magicPresentation(p.abilityId), col=mp.color;
          h.coreMat.color.setHex(col); h.haloMat.color.setHex(col);
          h.core.geometry=mp.shape==='fireball'?fireballCoreGeo:(mp.shape==='magmaOrb'?magmaCoreGeo:boltCoreGeo);
          const baseScale=mp.shape==='fireball'?1.45:(mp.shape==='magmaOrb'?1.55:.90);
          h.core.scale.setScalar(baseScale+Math.sin((time||0)*18+i)*0.12);
          h.halo.rotation.z=(time||0)*(mp.shape==='magmaOrb'?3.5:7)+i*.7;
          h.halo.scale.setScalar((mp.shape==='fireball'||mp.shape==='magmaOrb'?1.34:.86)+Math.sin((time||0)*11+i)*0.12);
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
      arrowBodyGeo.dispose(); arrowHeadGeo.dispose(); boltCoreGeo.dispose(); fireballCoreGeo.dispose(); magmaCoreGeo.dispose(); haloGeo.dispose(); trailGeo.dispose();
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
