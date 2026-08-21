/* =============================================================================
 * render/three/threeRenderer.js — Presentación con Three.js.
 *
 * Cumple el mismo contrato que el renderer WebGL2 nativo
 * (`render/rendererBackend.js`), así que `main.js`, el HUD, el laboratorio y el
 * sistema de selección funcionan sin cambios con cualquiera de los dos.
 *
 * REGLA QUE NO SE ROMPE: este fichero LEE el mundo y no lo escribe jamás. Ni
 * hp, ni recursos, ni cooldowns, ni estados, ni posición, ni orientación. El
 * giro que nace del ratón se emite como intención y lo aplica la simulación
 * dentro del paso fijo — buscar `_turnIntent` en main.js.
 *
 * LA CÁMARA SIGUE SIENDO NUESTRA. Three.js sólo aporta la PerspectiveCamera; la
 * órbita, el zoom, los límites de pitch, la colisión contra muros, el
 * look-ahead y la sacudida los calcula `render/camera3d.js`, igual que en el
 * renderer nativo. Nada de OrbitControls: un control de cámara genérico traería
 * su propia sensación y ésa es justo la que no queremos cambiar.
 * ========================================================================== */
import * as THREE from 'three';
import { createEnvironment } from './threeEnvironment.js?build=v0340-20260820-warrior-facing';
import { createCharacterFactory } from './threeCharacter.js?build=v0340-20260820-warrior-facing';
import { createVfxRenderer, createSelectionRings, createProjectileRenderer } from './threeVfx.js?build=v0340-20260820-warrior-facing';

export function createThreeRenderer(Arena, canvas, world, opts) {
  opts = opts || {};
  var V = Arena.Math.Vec3;

  /* v0.24 · Start conservatively on low-end hardware. This is only a
     presentation quality hint: simulation cadence remains fixed at 30 Hz. */
  var deviceMemory = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 0;
  var logicalCores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 0;
  var lowEndHint = (!!deviceMemory && deviceMemory <= 4) || (!!logicalCores && logicalCores <= 4);
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: !lowEndHint, alpha: false,
    /* Do not force the discrete/high-power adapter. Arena is already GPU-heavy
       enough to select it when required; `default` lets the browser/driver make
       the safer adapter decision on hybrid systems. */
    powerPreference: 'default'
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Tone mapping moderado: el brief pide low-poly limpio, no cine. Con ACES a
  // exposición alta los colores planos se lavan y las siluetas pierden borde.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 220);

  var environment = createEnvironment(scene, world.arena);
  var characters = createCharacterFactory(Arena, scene, {
    glbLoader: opts.glbLoader,
    baseCharacterGltf: opts.baseCharacterGltf || null,
    animationLibraryGltf: opts.animationLibraryGltf || null,
    meleeBaseCharacterGltf: opts.meleeBaseCharacterGltf || null,
    nativeUalAllClasses: opts.nativeUalAllClasses === true,
    /* Small caster PointLights are attractive but multiply fragment-light work.
       Keep them disabled in the default GPU-safe profile; caster runes/motes and
       emissive materials still communicate the cast without extra dynamic lights. */
    dynamicCharacterLights: false
  });
  var vfx = createVfxRenderer(Arena, scene);
  var projectiles = createProjectileRenderer(Arena, scene);
  var rings = createSelectionRings(Arena, scene);

  function ThreeRenderer() {
    this.canvas = canvas;
    this.world = world;
    this.scene = scene;
    this.three = renderer;
    this.threeCamera = camera;
    /* La MISMA cámara lógica que usa el renderer nativo. Es lo que garantiza
       que cambiar de presentación no cambie cómo se siente mirar. */
    this.camera = new Arena.Render.Camera3D();
    this.visuals = Object.create(null);   // entityId → personaje
    this.playerId = null;
    this.selectedId = null;
    this.hoverId = null;
    this.showTelegraphs = true;
    this.rangeIndicator = null;
    this.hurtFlash = 0;
    this.time = 0;
    this.stats = { drawCalls: 0, triangles: 0, geometries:0, textures:0, pixelRatio:0 };
    /* GPU-safe default. A DPR of 2 renders 4x as many pixels as DPR 1; the
       stylized arena gains little from that cost. Keep the cap conservative
       until an explicit quality selector is added. */
    this._pixelRatioCap = Math.min(window.devicePixelRatio || 1, lowEndHint ? 1.00 : 1.20);
    this._pixelRatio = this._pixelRatioCap;
    this._minPixelRatio = Math.min(this._pixelRatioCap, lowEndHint ? 0.75 : 0.80);
    this._gpuFrameEma = 16.7;
    this._gpuBudgetClock = 0;
    this._slowAtMinWindows = 0;
    this._envAccum = 0;
    this.gpuBudget = {
      hardwareHint: lowEndHint ? 'LOW_END' : 'STANDARD', deviceMemoryGB:deviceMemory||null, logicalCores:logicalCores||null,
      antialias:!lowEndHint, pixelRatioCap:this._pixelRatioCap, minPixelRatio:this._minPixelRatio,
      shadowMap:1024, shadowType:'PCF', shadowsEnabled:true, dynamicCharacterShadowCasters:2,
      adaptive:true, targetFrameMs:18.5, severeFrameMs:26.0, dynamicBrazierLights:false, dynamicCharacterLights:false,
      exteriorForestShadows:false, environmentHz:30, powerPreference:'default', contextLost:0
    };
    window.__ARENA_GPU_BUDGET__ = this.gpuBudget;
    var selfBudget=this;
    canvas.addEventListener('webglcontextlost', function(ev){
      selfBudget.gpuBudget.contextLost++;
      window.__ARENA_GPU_CONTEXT_LOST__={time:Date.now(),count:selfBudget.gpuBudget.contextLost};
      if(ev&&ev.preventDefault) ev.preventDefault();
    }, false);
    canvas.addEventListener('webglcontextrestored', function(){ selfBudget._w=0; selfBudget._h=0; }, false);
  }

  ThreeRenderer.prototype.init = function () {
    this.resize();
    /* Do not precompile the whole arena on boot. On low-end/SwiftShader paths
       the up-front shader sweep costs more perceived startup time than the
       occasional lazy compile. The lobby intentionally stays cheap. */
    return this;
  };

  ThreeRenderer.prototype.resize = function () {
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
    var h = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1));
    if (this._w === w && this._h === h) return;
    this._w = w; this._h = h;
    renderer.setPixelRatio(this._pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  /** Crea, actualiza y destruye personajes según lo que exista en el mundo. */
  ThreeRenderer.prototype.syncVisuals = function (dt) {
    var seen = Object.create(null);
    var i;
    for (i = 0; i < world.entities.length; i++) {
      var e = world.entities[i];
      seen[e.id] = true;
      if (!this.visuals[e.id]) this.visuals[e.id] = characters.create(e);
      this.visuals[e.id].update(e, dt, world);
    }
    for (var id in this.visuals) {
      if (seen[id]) continue;
      this.visuals[id].dispose();
      delete this.visuals[id];
    }
  };

  /* Aquí `visuals[id]` es un envoltorio de escena de Three.js y el handle del
     backend de personaje vive dentro. Quien quiera disparar una animación
     necesita el handle, no el envoltorio. */
  ThreeRenderer.prototype.characterHandleOf = function (entityId) {
    var v = this.visuals[entityId];
    return v ? v.handle : null;
  };

  ThreeRenderer.prototype._updateGpuBudget = function(dt) {
    var ms=Math.max(1,Math.min(100,(dt||0)*1000));
    this._gpuFrameEma += (ms-this._gpuFrameEma)*0.06;
    this._gpuBudgetClock += Math.max(0,dt||0);
    if(this._gpuBudgetClock < 1.25) return;
    this._gpuBudgetClock=0;
    /* Downshift only. We deliberately do not chase quality upward again in the
       same session: the user's hardware reported artifacts under this game and
       stable thermals/frame pacing matter more than opportunistic supersampling. */
    if(this._gpuFrameEma > this.gpuBudget.targetFrameMs && this._pixelRatio > this._minPixelRatio+0.01){
      this._pixelRatio=Math.max(this._minPixelRatio,Math.round((this._pixelRatio-0.10)*100)/100);
      this._w=0; this._h=0;
      this._slowAtMinWindows=0;
      this.gpuBudget.activePixelRatio=this._pixelRatio;
      this.gpuBudget.lastDownshiftMs=Math.round(this._gpuFrameEma*10)/10;
      return;
    }
    /* If resolution is already at its floor and the machine is still badly
       over budget for several windows, remove the whole dynamic shadow pass.
       Never oscillate it back on during the same session. */
    if(this._pixelRatio <= this._minPixelRatio+0.01 && this._gpuFrameEma > this.gpuBudget.severeFrameMs){
      this._slowAtMinWindows++;
      if(this._slowAtMinWindows >= 3 && renderer.shadowMap.enabled){
        renderer.shadowMap.enabled=false;
        this.gpuBudget.shadowsEnabled=false;
        this.gpuBudget.shadowDisabledAtMs=Math.round(this._gpuFrameEma*10)/10;
      }
    } else {
      this._slowAtMinWindows=0;
    }
  };

  ThreeRenderer.prototype.render = function (alpha, dt) {
    this.time += dt;
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    this._updateGpuBudget(dt);
    this.resize();

    /* La cámara lógica ya se ha actualizado en main.js; aquí sólo se copia su
       resultado a la cámara de Three. Si Three calculara la suya propia, las
       dos presentaciones dejarían de encuadrar igual. */
    var c = this.camera;
    camera.position.set(c.position.x, c.position.y, c.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(c.smoothFocus.x, c.smoothFocus.y, c.smoothFocus.z);
    if (Math.abs(camera.fov - c.fov * 180 / Math.PI) > 1e-3) {
      camera.fov = c.fov * 180 / Math.PI;
      camera.updateProjectionMatrix();
    }

    var player = world.getEntity(this.playerId);
    for (var i = 0; i < world.entities.length; i++) {
      var e = world.entities[i];
      var ch = this.visuals[e.id];
      if (!ch) continue;

      var stealthed = e.mods().stealthed;
      var friendly = player ? !world.areHostile(player, e) : (e.team === 0);
      // Un enemigo en sigilo es invisible; el propio y los aliados se ven
      // translúcidos, para saber que el efecto sigue activo.
      if (stealthed && !friendly && e.id !== this.playerId) {
        ch.root.visible = false;
        continue;
      }
      ch.root.visible = true;
      /* Dynamic character shadows are intentionally limited to the two actors
         the player is reading: self + selected target. Every extra skinned
         caster repeats skinning/draw work in the sun shadow pass. */
      if (ch.setShadowCasting) ch.setShadowCasting(renderer.shadowMap.enabled && (e.id === this.playerId || e.id === this.selectedId));

      var pos = V.lerp(V.create(), e.prevPos, e.pos, alpha);
      var jumpY = (e.prevJumpOffset || 0) + ((e.jumpOffset || 0) - (e.prevJumpOffset || 0)) * alpha;
      pos.y += jumpY;
      var yaw = e.prevYaw + V.angleDelta(e.prevYaw, e.yaw) * alpha;
      var palette = Arena.Render.CharacterBackend.current.paletteFor(e, friendly);

      var fade = stealthed ? 0.35 : 1.0;
      var deadFade = e.alive ? 1.0 : Math.max(0.15, 1 - ch.handle.deadTime * 0.35);
      ch.applyPose(e, pos, yaw, palette, fade * deadFade, ch.handle.hurt || 0);
    }

    /* Decorative foliage/cloud/firefly motion does not need display refresh
       frequency. Update it at ~30 Hz and carry the accumulated dt so speed is
       unchanged while low-end CPUs do half the presentation work at 60 FPS. */
    this._envAccum += Math.max(0,dt||0);
    if (environment && environment.update && this._envAccum >= 1/30) {
      environment.update(this.time, this._envAccum);
      this._envAccum = 0;
    }
    rings.render(world, this.playerId, this.selectedId, this.hoverId, alpha);
    vfx.render();
    projectiles.render(world, alpha, this.time);

    renderer.render(scene, camera);
    var info = renderer.info.render;
    this.stats.drawCalls = info.calls;
    this.stats.triangles = info.triangles;
    this.stats.geometries = renderer.info.memory.geometries || 0;
    this.stats.textures = renderer.info.memory.textures || 0;
    this.stats.pixelRatio = renderer.getPixelRatio();
    this.stats.frameMsEma = Math.round(this._gpuFrameEma*10)/10;
  };

  ThreeRenderer.prototype.dispose = function () {
    for (var id in this.visuals) this.visuals[id].dispose();
    this.visuals = Object.create(null);
    vfx.dispose();
    projectiles.dispose();
    renderer.dispose();
  };

  return new ThreeRenderer();
}
