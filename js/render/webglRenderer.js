/* =============================================================================
 * render/webglRenderer.js — Renderer WebGL2 nativo, sin librerías.
 *
 * REGLA DE ARQUITECTURA: este fichero LEE la simulación y no la escribe jamás.
 * No hay una sola asignación a hp, cooldown, resource ni statuses aquí dentro.
 *
 * Pases por fotograma:
 *   1. sombras   → mapa de profundidad direccional (2048²)
 *   2. escena    → framebuffer HDR (RGBA16F) con Blinn-Phong, sombras y niebla
 *   3. bloom     → bright pass + desenfoque separable a media resolución
 *   4. presente  → tonemap ACES, viñeta y pulso de daño hacia el canvas
 * ========================================================================== */
Arena.define('render/webglRenderer',
  ['render/shaders', 'render/primitives', 'render/camera3d', 'render/characterBackend',
   'render/animDebug', 'render/rendererBackend'],
  function (Arena) {
  'use strict';

  var SH = Arena.Render.shaders;
  var P = Arena.Render.primitives;
  var M = Arena.Math.Mat4;
  var V = Arena.Math.Vec3;
  // El renderer no conoce el humanoide procedural: conoce un BACKEND. El día que
  // entre una malla con skinning se sustituye el backend y este fichero no cambia.
  var Backend = Arena.Render.CharacterBackend;
  function CB() { return Backend.current; }

  var SHADOW_SIZE = 2048;
  var DEFAULT_MATERIAL = { roughness: 0.55, metallic: 0.25, rimPower: 2.6 };

  /* --- Paleta de escena --------------------------------------------------- */
  var THEME = {
    // Luz de tarde alta y fría en sombra: el contraste es lo que hace legible
    // una silueta a 20 unidades. Un ambiente alto lo aplana todo a gris.
    sky: [0.13, 0.17, 0.26],
    ground: [0.030, 0.034, 0.042],
    lightColor: [1.45, 1.30, 1.05],
    lightDir: { x: 0.40, y: 0.78, z: 0.48 },
    fog: [0.042, 0.052, 0.072],
    fogDensity: 0.0125,
    floor: [0.085, 0.093, 0.112],
    floorGrid: [0.200, 0.245, 0.320],
    wall: [0.115, 0.120, 0.140],
    pillar: [0.155, 0.150, 0.165],
    platform: [0.108, 0.118, 0.142],
    exposure: 1.10,
    bloom: 0.38,
    vignette: 0.68
  };

  function Renderer(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.gl = null;
    this.camera = new Arena.Render.Camera3D();
    this.meshes = Object.create(null);
    this.programs = Object.create(null);
    this.visuals = Object.create(null);      // entityId → estado de animación
    this._pose = [];
    this.time = 0;
    this.hurtFlash = 0;
    this.quality = 'high';
    this.showTelegraphs = true;
    this.playerId = null;
    this.selectedId = null;
    this.hoverId = null;
    this._tmpMat = M.create();
    this._tmpMat2 = M.create();
    this._normalMat = new Float32Array(9);
    this.stats = { drawCalls: 0, triangles: 0 };
  }

  /* =========================================================================
   * Arranque
   * ====================================================================== */

  Renderer.prototype.init = function () {
    var gl = this.canvas.getContext('webgl2', {
      antialias: true, alpha: false, depth: true,
      powerPreference: 'high-performance', preserveDrawingBuffer: false
    });
    if (!gl) throw new Error('WebGL2 no está disponible en este navegador.');
    this.gl = gl;

    this.extColorFloat = gl.getExtension('EXT_color_buffer_float');

    this.programs.shadow = this._program(SH.shadowVert, SH.shadowFrag, 'shadow');
    this.programs.scene = this._program(SH.sceneVert, SH.sceneFrag, 'scene');
    this.programs.unlit = this._program(SH.unlitVert, SH.unlitFrag, 'unlit');
    this.programs.bright = this._program(SH.fullscreenVert, SH.brightFrag, 'bright');
    this.programs.blur = this._program(SH.fullscreenVert, SH.blurFrag, 'blur');
    this.programs.present = this._program(SH.fullscreenVert, SH.presentFrag, 'present');

    this._buildMeshes();
    this._buildTargets();

    this.emptyVao = gl.createVertexArray();

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(THEME.fog[0], THEME.fog[1], THEME.fog[2], 1);

    this.resize();
    return this;
  };

  Renderer.prototype._compile = function (type, src, label) {
    var gl = this.gl;
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      throw new Error('Error compilando shader "' + label + '":\n' + log);
    }
    return sh;
  };

  Renderer.prototype._program = function (vsSrc, fsSrc, label) {
    var gl = this.gl;
    var vs = this._compile(gl.VERTEX_SHADER, vsSrc, label + '.vert');
    var fs = this._compile(gl.FRAGMENT_SHADER, fsSrc, label + '.frag');
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Error enlazando programa "' + label + '":\n' + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs); gl.deleteShader(fs);

    // Cachear localizaciones: getUniformLocation por fotograma es caro.
    var uniforms = Object.create(null);
    var count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = gl.getActiveUniform(prog, i);
      var name = info.name.replace(/\[0\]$/, '');
      uniforms[name] = gl.getUniformLocation(prog, name);
    }
    return { program: prog, u: uniforms, label: label };
  };

  Renderer.prototype._uploadMesh = function (name, data) {
    var gl = this.gl;
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    function buffer(loc, arr, size) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    }
    buffer(0, data.positions, 3);
    buffer(1, data.normals, 3);
    buffer(2, data.uvs, 2);

    var ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    this.meshes[name] = { vao: vao, count: data.indices.length };
    return this.meshes[name];
  };

  Renderer.prototype._buildMeshes = function () {
    var chars = CB().buildMeshes();
    for (var k in chars) {
      if (Object.prototype.hasOwnProperty.call(chars, k)) this._uploadMesh(k, chars[k]);
    }
    this._uploadMesh('unitBox', P.box(1, 1, 1));
    this._uploadMesh('unitBoxY', P.translate(P.box(1, 1, 1), 0, 0.5, 0));
    this._uploadMesh('quad', P.plane(1, 1, 1));
    this._uploadMesh('floor', P.plane(1, 1, 40));
    this._uploadMesh('sphere', P.sphere(0.5, 10, 14));
    this._uploadMesh('arrow', P.merge([
      P.rotateY(P.cylinder(0.035, 0.55, 8, 1), 0),
      P.translate(P.cone(0.075, 0.20, 8), 0, 0.55, 0)
    ]));
    this._uploadMesh('cone12', P.ringSector(0, 1, Math.PI / 2.5, 28));

    // Una malla de rampa por plataforma: cada una tiene su propia pendiente.
    var plats = this.world.arena.platforms;
    for (var i = 0; i < plats.length; i++) {
      var r = plats[i].ramp;
      if (!r) continue;
      var hMin = r.dir < 0 ? r.to : r.from;
      var hMax = r.dir < 0 ? r.from : r.to;
      this._uploadMesh('ramp' + i, P.ramp(r.sx, r.sz, hMin, hMax));
    }
  };

  /* =========================================================================
   * Framebuffers
   * ====================================================================== */

  Renderer.prototype._buildTargets = function () {
    var gl = this.gl;

    // Mapa de sombras
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE, 0,
      gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.lightViewProj = M.create();
  };

  Renderer.prototype._makeColorTarget = function (w, h, float) {
    var gl = this.gl;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    var internal = (float && this.extColorFloat) ? gl.RGBA16F : gl.RGBA8;
    var type = (float && this.extColorFloat) ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex: tex, fbo: fbo, w: w, h: h };
  };

  Renderer.prototype.resize = function () {
    var gl = this.gl;
    var dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1);
    var w = Math.max(2, Math.floor(this.canvas.clientWidth * dpr));
    var h = Math.max(2, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width === w && this.canvas.height === h && this.sceneTarget) return;

    this.canvas.width = w;
    this.canvas.height = h;

    if (this.sceneTarget) {
      gl.deleteTexture(this.sceneTarget.tex); gl.deleteFramebuffer(this.sceneTarget.fbo);
      gl.deleteRenderbuffer(this.sceneDepth);
      gl.deleteTexture(this.bloomA.tex); gl.deleteFramebuffer(this.bloomA.fbo);
      gl.deleteTexture(this.bloomB.tex); gl.deleteFramebuffer(this.bloomB.fbo);
    }

    this.sceneTarget = this._makeColorTarget(w, h, true);
    this.sceneDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.sceneDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneTarget.fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.sceneDepth);

    var bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1);
    this.bloomA = this._makeColorTarget(bw, bh, true);
    this.bloomB = this._makeColorTarget(bw, bh, true);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  /* =========================================================================
   * Utilidades de dibujo
   * ====================================================================== */

  Renderer.prototype._normalMatrixFrom = function (m) {
    // Modelo sin escalado no uniforme extremo: basta con la parte 3×3.
    var n = this._normalMat;
    n[0] = m[0]; n[1] = m[1]; n[2] = m[2];
    n[3] = m[4]; n[4] = m[5]; n[5] = m[6];
    n[6] = m[8]; n[7] = m[9]; n[8] = m[10];
    return n;
  };

  Renderer.prototype._drawMesh = function (prog, name, matrix, mat) {
    var gl = this.gl;
    var mesh = this.meshes[name];
    if (!mesh) return;
    var u = prog.u;

    gl.uniformMatrix4fv(u.uModel, false, matrix);
    if (u.uNormalMatrix) gl.uniformMatrix3fv(u.uNormalMatrix, false, this._normalMatrixFrom(matrix));
    if (mat) {
      if (u.uBaseColor) gl.uniform3f(u.uBaseColor, mat.color[0], mat.color[1], mat.color[2]);
      if (u.uEmissive) {
        var e = mat.emissive || [0, 0, 0];
        gl.uniform3f(u.uEmissive, e[0], e[1], e[2]);
      }
      if (u.uRoughness) gl.uniform1f(u.uRoughness, mat.roughness === undefined ? 0.7 : mat.roughness);
      if (u.uMetallic) gl.uniform1f(u.uMetallic, mat.metallic === undefined ? 0.1 : mat.metallic);
      if (u.uAlpha) gl.uniform1f(u.uAlpha, mat.alpha === undefined ? 1 : mat.alpha);
      if (u.uGridScale) gl.uniform1f(u.uGridScale, mat.gridScale || 0);
      if (u.uGridColor) {
        var g = mat.gridColor || THEME.floorGrid;
        gl.uniform3f(u.uGridColor, g[0], g[1], g[2]);
      }
      if (u.uRimPower) gl.uniform1f(u.uRimPower, mat.rimPower === undefined ? 4.0 : mat.rimPower);
      if (u.uRimColor) {
        var r = mat.rimColor || [0.05, 0.08, 0.12];
        gl.uniform3f(u.uRimColor, r[0], r[1], r[2]);
      }
      if (u.uReceiveShadow) gl.uniform1f(u.uReceiveShadow, mat.receiveShadow === false ? 0 : 1);
      if (u.uColor) gl.uniform3f(u.uColor, mat.color[0], mat.color[1], mat.color[2]);
      if (u.uMode) gl.uniform1f(u.uMode, mat.mode || 0);
      if (u.uProgress) gl.uniform1f(u.uProgress, mat.progress === undefined ? 1 : mat.progress);
    }

    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    this.stats.drawCalls++;
    this.stats.triangles += mesh.count / 3;
  };

  /* =========================================================================
   * Recolección de la escena
   *
   * Se construye una lista de "sólidos" que se usa dos veces: una para el mapa
   * de sombras y otra para la escena. Recorrer el mundo dos veces sería un
   * riesgo de divergencia entre lo que proyecta sombra y lo que se ve.
   * ====================================================================== */

  Renderer.prototype._collectSolids = function (alpha) {
    var world = this.world;
    var solids = this._solids || (this._solids = []);
    solids.length = 0;

    var arena = world.arena;
    var i;

    /* Suelo */
    var floorM = M.create();
    M.compose(floorM, { x: 0, y: 0, z: 0 }, 0,
      { x: arena.width + 2, y: 1, z: arena.depth + 2 });
    solids.push({
      mesh: 'floor', matrix: floorM, castShadow: false,
      mat: {
        color: THEME.floor, roughness: 0.92, metallic: 0.0,
        gridScale: 1.0, gridColor: THEME.floorGrid, rimPower: 8.0
      }
    });

    /* Obstáculos */
    for (i = 0; i < arena.obstacles.length; i++) {
      var o = arena.obstacles[i];
      var m = M.create();
      var cx = (o.min.x + o.max.x) / 2;
      var cz = (o.min.z + o.max.z) / 2;
      var sy = o.max.y - o.min.y;
      M.compose(m, { x: cx, y: o.min.y + sy / 2, z: cz }, 0,
        { x: o.max.x - o.min.x, y: sy, z: o.max.z - o.min.z });
      var col = (o.kind === 'pillar') ? THEME.pillar : THEME.wall;
      solids.push({
        mesh: 'unitBox', matrix: m, castShadow: true,
        mat: { color: col, roughness: 0.85, metallic: 0.05, rimPower: 5.0 }
      });
    }

    /* Plataformas y rampas */
    for (i = 0; i < arena.platforms.length; i++) {
      var p = arena.platforms[i];
      var pm = M.create();
      M.compose(pm, { x: p.x, y: p.h / 2 + 0.006, z: p.z }, 0, { x: p.sx, y: p.h, z: p.sz });
      solids.push({
        mesh: 'unitBox', matrix: pm, castShadow: true,
        mat: { color: THEME.platform, roughness: 0.88, metallic: 0.04, gridScale: 1.0,
               gridColor: THEME.floorGrid, rimPower: 6.0 }
      });
      if (p.ramp) {
        // Malla de cuña única, con exactamente la misma pendiente que
        // groundHeightAt. La versión anterior aproximaba con escalones y se
        // veía como una escalera rota que no correspondía con el suelo real.
        var rm = M.create();
        // 1 cm por encima del suelo: la base de la rampa es coplanar con él y
        // sin este margen aparecen bandas de z-fighting en toda la pendiente.
        M.compose(rm, { x: p.ramp.x, y: 0.012, z: p.ramp.z }, 0, { x: 1, y: 1, z: 1 });
        solids.push({
          // Una rampa es suelo: proyectar su propia sombra sólo produce acné
          // sobre sí misma y no aporta ninguna información espacial.
          mesh: 'ramp' + i, matrix: rm, castShadow: false,
          mat: { color: THEME.platform, roughness: 0.9, metallic: 0.03, rimPower: 6.0 }
        });
      }
    }

    /* Personajes */
    var player = world.getEntity(this.playerId);
    for (i = 0; i < world.entities.length; i++) {
      var e = world.entities[i];
      var st = this.visuals[e.id];
      if (!st) continue;

      var stealthed = e.mods().stealthed;
      var friendly = player ? !world.areHostile(player, e) : (e.team === 0);
      // Un enemigo en sigilo es invisible; el propio jugador y sus aliados
      // se ven translúcidos para saber que el efecto sigue activo.
      if (stealthed && !friendly && e.id !== this.playerId) continue;

      var pos = V.lerp(V.create(), e.prevPos, e.pos, alpha);
      var yaw = e.prevYaw + V.angleDelta(e.prevYaw, e.yaw) * alpha;
      var palette = CB().paletteFor(e, friendly);

      CB().buildPose(this._pose, st, e, pos, yaw, palette);
      var fade = stealthed ? 0.35 : 1.0;
      var deadFade = e.alive ? 1.0 : Math.max(0.15, 1 - st.deadTime * 0.35);
      var hurtTint = st.hurt;

      for (var q = 0; q < this._pose.length; q++) {
        var part = this._pose[q];
        var col = part.color;
        if (hurtTint > 0.01) {
          col = [col[0] + hurtTint * 0.55, col[1] * (1 - hurtTint * 0.35), col[2] * (1 - hurtTint * 0.35)];
        }
        // Cada pieza trae su material: piel, tela, cuero, metal, madera o magia.
        // Con una rugosidad única para todo el cuerpo, el personaje se lee como
        // una figura de plástico por bien animado que esté.
        var pm = part.material || DEFAULT_MATERIAL;
        // El contorno de bando identifica al equipo, no repinta al personaje:
        // se mantiene bajo y estrecho para que un peto de acero siga siendo de
        // acero y una túnica roja siga siendo roja.
        var rk = 0.16 * (pm.rim === undefined ? 1 : pm.rim);
        solids.push({
          mesh: part.mesh, matrix: part.matrix, castShadow: !stealthed && e.alive,
          mat: {
            color: col,
            emissive: part.emissive,
            roughness: pm.roughness, metallic: pm.metallic,
            alpha: fade * deadFade,
            rimPower: pm.rimPower,
            rimColor: [palette.team[0] * rk, palette.team[1] * rk, palette.team[2] * rk]
          },
          transparent: (fade * deadFade) < 0.999
        });
      }

      // Overlay de depuración de animación (F3). Sólo LEE el estado; apagarlo
      // deja el juego exactamente igual.
      if (Arena.Render.AnimDebug.enabled) {
        Arena.Render.AnimDebug.build(solids, st, e, pos, yaw);
      }
    }

    /* Proyectiles */
    for (i = 0; i < world.projectiles.length; i++) {
      var pr = world.projectiles[i];
      var ppos = V.lerp(V.create(), pr.prevPos, pr.pos, alpha);
      var target = world.getEntity(pr.targetId);
      var pyaw = target ? V.yawTo(ppos, target.centerPos()) : 0;
      var pm2 = M.create();
      var isBolt = pr.kind === 'bolt';
      M.composeFull(pm2, ppos, pyaw, isBolt ? 0 : -Math.PI / 2, 0,
        isBolt ? { x: 0.5, y: 0.5, z: 0.5 } : { x: 1, y: 1, z: 1 });
      var pcol = isBolt ? [0.65, 0.45, 1.0] : [0.95, 0.85, 0.55];
      solids.push({
        mesh: isBolt ? 'sphere' : 'arrow', matrix: pm2, castShadow: false,
        mat: {
          color: pcol, emissive: [pcol[0] * 1.6, pcol[1] * 1.6, pcol[2] * 1.6],
          roughness: 0.3, metallic: 0.5, rimPower: 1.8, rimColor: pcol
        }
      });
    }

    return solids;
  };

  /* =========================================================================
   * Pases
   * ====================================================================== */

  Renderer.prototype._renderShadow = function (solids) {
    var gl = this.gl;
    var arena = this.world.arena;

    // Ortográfica ajustada a la arena: el mapa entero cabe, sin desperdiciar
    // resolución en espacio vacío.
    // El span debe cubrir la media diagonal de la arena, no su lado mayor:
    // con 0.62 × ancho las esquinas se quedaban fuera del mapa de sombras.
    var span = Math.sqrt(arena.width * arena.width + arena.depth * arena.depth) * 0.55;
    // La luz se coloca justo fuera de la escena y el rango near/far se ciñe a
    // ella: con near=1 / far=90 casi toda la precisión del buffer de 24 bits se
    // desperdiciaba en espacio vacío.
    var LIGHT_DIST = 34;
    var lightPos = {
      x: THEME.lightDir.x * LIGHT_DIST,
      y: THEME.lightDir.y * LIGHT_DIST,
      z: THEME.lightDir.z * LIGHT_DIST
    };
    var lightView = this._tmpMat;
    M.lookAt(lightView, lightPos, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    var lightProj = this._tmpMat2;
    M.ortho(lightProj, -span, span, -span, span, LIGHT_DIST - 26, LIGHT_DIST + 26);
    M.multiply(this.lightViewProj, lightProj, lightView);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    // Renderizar caras traseras evita el acné de sombra en superficies planas.
    gl.cullFace(gl.FRONT);

    var prog = this.programs.shadow;
    gl.useProgram(prog.program);
    gl.uniformMatrix4fv(prog.u.uLightViewProj, false, this.lightViewProj);

    for (var i = 0; i < solids.length; i++) {
      if (!solids[i].castShadow) continue;
      this._drawMesh(prog, solids[i].mesh, solids[i].matrix, null);
    }
    gl.cullFace(gl.BACK);
  };

  Renderer.prototype._renderScene = function (solids) {
    var gl = this.gl;
    var cam = this.camera;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneTarget.fbo);
    gl.viewport(0, 0, this.sceneTarget.w, this.sceneTarget.h);
    gl.clearColor(THEME.fog[0], THEME.fog[1], THEME.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    var prog = this.programs.scene;
    var u = prog.u;
    gl.useProgram(prog.program);
    gl.uniformMatrix4fv(u.uViewProj, false, cam.viewProj);
    gl.uniformMatrix4fv(u.uLightViewProj, false, this.lightViewProj);
    gl.uniform3f(u.uLightDir, THEME.lightDir.x, THEME.lightDir.y, THEME.lightDir.z);
    gl.uniform3f(u.uLightColor, THEME.lightColor[0], THEME.lightColor[1], THEME.lightColor[2]);
    gl.uniform3f(u.uSkyColor, THEME.sky[0], THEME.sky[1], THEME.sky[2]);
    gl.uniform3f(u.uGroundColor, THEME.ground[0], THEME.ground[1], THEME.ground[2]);
    gl.uniform3f(u.uCameraPos, cam.position.x, cam.position.y, cam.position.z);
    gl.uniform3f(u.uFogColor, THEME.fog[0], THEME.fog[1], THEME.fog[2]);
    gl.uniform1f(u.uFogDensity, THEME.fogDensity);
    gl.uniform1f(u.uShadowTexel, 1 / SHADOW_SIZE);
    gl.uniform1f(u.uNormalBias, 0.045);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.uShadowMap, 0);

    var i;
    for (i = 0; i < solids.length; i++) {
      if (solids[i].transparent) continue;
      this._drawMesh(prog, solids[i].mesh, solids[i].matrix, solids[i].mat);
    }

    // Transparentes al final, sin escribir profundidad.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (i = 0; i < solids.length; i++) {
      if (!solids[i].transparent) continue;
      this._drawMesh(prog, solids[i].mesh, solids[i].matrix, solids[i].mat);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  };

  /** Marcadores planos: selección, rango, telegraphs, zonas y sombras de apoyo. */
  Renderer.prototype._renderOverlays = function (alpha) {
    var gl = this.gl;
    var world = this.world;
    var prog = this.programs.unlit;
    var u = prog.u;

    gl.useProgram(prog.program);
    gl.uniformMatrix4fv(u.uViewProj, false, this.camera.viewProj);
    gl.uniform1f(u.uTime, this.time);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);       // aditivo: los indicadores brillan
    gl.depthMask(false);

    var self = this;
    var m = M.create();

    function disc(x, z, radius, color, a, mode, progress) {
      M.compose(m, { x: x, y: 0.035, z: z }, 0, { x: radius * 2, y: 1, z: radius * 2 });
      self._drawMesh(prog, 'quad', m, {
        color: color, alpha: a, mode: mode === undefined ? 3 : mode,
        progress: progress === undefined ? 1 : progress
      });
    }

    var i, e, pos;

    /* Sombra de contacto: ancla al personaje al suelo aunque el shadow map falle */
    for (i = 0; i < world.entities.length; i++) {
      e = world.entities[i];
      if (!e.alive) continue;
      if (e.mods().stealthed && e.id !== this.playerId) continue;
      pos = V.lerp(V.create(), e.prevPos, e.pos, alpha);
      disc(pos.x, pos.z, e.radius * 1.5, [0, 0, 0], 0.0, 3);
    }

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    /* Anillos de bando y de selección */
    var player = world.getEntity(this.playerId);
    for (i = 0; i < world.entities.length; i++) {
      e = world.entities[i];
      if (!e.alive) continue;
      if (e.mods().stealthed && player && world.areHostile(player, e)) continue;
      pos = V.lerp(V.create(), e.prevPos, e.pos, alpha);

      var friendly = player ? !world.areHostile(player, e) : (e.team === 0);
      var ring = (e.id === this.playerId) ? [0.35, 0.95, 0.55]
                : (friendly ? [0.30, 0.62, 1.0] : [1.0, 0.34, 0.28]);
      var a = (e.id === this.selectedId) ? 0.95 : ((e.id === this.hoverId) ? 0.55 : 0.30);
      var rr = (e.id === this.selectedId) ? e.radius * 2.25 : e.radius * 2.0;
      disc(pos.x, pos.z, rr, ring, a, 1);

      // Telegraph de casteo bajo los pies: el enemigo debe poder leer la
      // amenaza sin mirar la barra de casteo del HUD.
      if (this.showTelegraphs && e.cast) {
        var c = e.cast;
        var prog01 = Math.min(1, (world.time - c.startTime) / Math.max(c.duration, 1e-3));
        var ab = Arena.Data.abilities[c.abilityId];
        var col = (ab && ab.flags && ab.flags.magic) ? [0.72, 0.45, 1.0] : [1.0, 0.72, 0.30];
        disc(pos.x, pos.z, e.radius * 3.1, col, 0.55, 2, prog01);
      }
    }

    /* Zonas persistentes: trampas */
    for (i = 0; i < world.zones.length; i++) {
      var z = world.zones[i];
      var armed = world.time >= z.armedAt;
      var zcol = armed ? [1.0, 0.55, 0.25] : [0.55, 0.55, 0.55];
      var pulse = 0.35 + 0.25 * Math.sin(this.time * 4.5);
      disc(z.x, z.z, z.radius, zcol, armed ? pulse : 0.22, 1);
      disc(z.x, z.z, z.radius * 0.72, zcol, 0.14, 3);
    }

    /* Anillo de rango de la habilidad apuntada */
    if (this.rangeIndicator && player) {
      var pp = V.lerp(V.create(), player.prevPos, player.pos, alpha);
      disc(pp.x, pp.z, this.rangeIndicator, [0.55, 0.85, 1.0], 0.22, 1);
    }

    if (Arena.Render.VFX) Arena.Render.VFX.render(this, prog, alpha);

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  };

  Renderer.prototype._renderPost = function () {
    var gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.emptyVao);

    /* Bright pass */
    var bp = this.programs.bright;
    gl.useProgram(bp.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomA.fbo);
    gl.viewport(0, 0, this.bloomA.w, this.bloomA.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.tex);
    gl.uniform1i(bp.u.uScene, 0);
    gl.uniform1f(bp.u.uThreshold, 0.92);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* Desenfoque separable */
    var blur = this.programs.blur;
    gl.useProgram(blur.program);
    var passes = this.quality === 'high' ? 2 : 1;
    for (var p = 0; p < passes; p++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomB.fbo);
      gl.viewport(0, 0, this.bloomB.w, this.bloomB.h);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomA.tex);
      gl.uniform1i(blur.u.uSource, 0);
      gl.uniform2f(blur.u.uDirection, 1.35 / this.bloomA.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomA.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomB.tex);
      gl.uniform2f(blur.u.uDirection, 0, 1.35 / this.bloomA.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* Composición final */
    var pr = this.programs.present;
    gl.useProgram(pr.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.tex);
    gl.uniform1i(pr.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomA.tex);
    gl.uniform1i(pr.u.uBloom, 1);
    gl.uniform1f(pr.u.uBloomStrength, THEME.bloom);
    gl.uniform1f(pr.u.uExposure, THEME.exposure);
    gl.uniform1f(pr.u.uVignette, THEME.vignette);
    gl.uniform1f(pr.u.uHurt, this.hurtFlash);
    gl.uniform1f(pr.u.uSaturation, 1.06);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
  };

  /* =========================================================================
   * Fotograma
   * ====================================================================== */

  Renderer.prototype.syncVisuals = function (dt) {
    var world = this.world;
    var seen = Object.create(null);
    for (var i = 0; i < world.entities.length; i++) {
      var e = world.entities[i];
      seen[e.id] = true;
      if (!this.visuals[e.id]) this.visuals[e.id] = CB().createCharacter(e);
      CB().updateCharacter(this.visuals[e.id], e, dt, world);
    }
    for (var id in this.visuals) {
      if (seen[id]) continue;
      CB().destroyCharacter(this.visuals[id]);
      delete this.visuals[id];
    }
  };

  Renderer.prototype.render = function (alpha, dt) {
    this.time += dt;
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);

    this.resize();
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;

    var solids = this._collectSolids(alpha);
    this._renderShadow(solids);
    this._renderScene(solids);
    this._renderOverlays(alpha);
    this._renderPost();
  };

  Renderer.prototype.theme = THEME;
  Arena.Render.Renderer = Renderer;

  /* Se registra bajo el contrato común. `init()` devuelve `this`, así que la
     factoría entrega un renderer ya arrancado y verificado. */
  if (Arena.Render.RendererBackend) {
    Arena.Render.RendererBackend.register('webgl2', function (canvas, world) {
      return new Renderer(canvas, world).init();
    });
  }
  Arena.Render.THEME = THEME;
});
