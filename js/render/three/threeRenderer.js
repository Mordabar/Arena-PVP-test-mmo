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
import { createEnvironment } from './threeEnvironment.js?build=v070-20260812-1051';
import { createCharacterFactory } from './threeCharacter.js?build=v070-20260812-1051';
import { createVfxRenderer, createSelectionRings, createProjectileRenderer } from './threeVfx.js?build=v070-20260812-1051';

export function createThreeRenderer(Arena, canvas, world, opts) {
  opts = opts || {};
  var V = Arena.Math.Vec3;

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Tone mapping moderado: el brief pide low-poly limpio, no cine. Con ACES a
  // exposición alta los colores planos se lavan y las siluetas pierden borde.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 220);

  var environment = createEnvironment(scene, world.arena);
  var characters = createCharacterFactory(Arena, scene, { glbLoader: opts.glbLoader });
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
    this.stats = { drawCalls: 0, triangles: 0 };
    this._pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  }

  ThreeRenderer.prototype.init = function () {
    this.resize();
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

  ThreeRenderer.prototype.render = function (alpha, dt) {
    this.time += dt;
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
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

      var pos = V.lerp(V.create(), e.prevPos, e.pos, alpha);
      var jumpY = (e.prevJumpOffset || 0) + ((e.jumpOffset || 0) - (e.prevJumpOffset || 0)) * alpha;
      pos.y += jumpY;
      var yaw = e.prevYaw + V.angleDelta(e.prevYaw, e.yaw) * alpha;
      var palette = Arena.Render.CharacterBackend.current.paletteFor(e, friendly);

      var fade = stealthed ? 0.35 : 1.0;
      var deadFade = e.alive ? 1.0 : Math.max(0.15, 1 - ch.handle.deadTime * 0.35);
      ch.applyPose(e, pos, yaw, palette, fade * deadFade, ch.handle.hurt || 0);
    }

    if (environment && environment.update) environment.update(this.time, dt);
    rings.render(world, this.playerId, this.selectedId, this.hoverId, alpha);
    vfx.render();
    projectiles.render(world, alpha, this.time);

    renderer.render(scene, camera);
    var info = renderer.info.render;
    this.stats.drawCalls = info.calls;
    this.stats.triangles = info.triangles;
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
