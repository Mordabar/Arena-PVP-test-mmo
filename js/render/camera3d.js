/* =============================================================================
 * render/camera3d.js — Cámara orbital de tercera persona tipo MMORPG.
 *
 * Regla dura (documento §5): la cámara NUNCA participa en las reglas de daño.
 * Aquí sólo se decide qué se ve, jamás qué ocurre.
 *
 * Lo que hace que se sienta bien:
 *   · seguimiento suave del objetivo, no rígido
 *   · colisión: la cámara se acerca si un muro se interpone
 *   · sacudida de impacto, corta y con caída rápida
 * ========================================================================== */
Arena.define('render/camera3d', ['math/mat4', 'math/ray'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var M = Arena.Math.Mat4;
  var Ray = Arena.Math.Ray;

  function Camera3D(opts) {
    opts = opts || {};
    this.yaw = opts.yaw === undefined ? Math.PI : opts.yaw;
    this.pitch = opts.pitch === undefined ? 0.66 : opts.pitch;
    this.distance = opts.distance === undefined ? 10.0 : opts.distance;
    this.targetDistance = this.distance;

    this.minPitch = -0.30;
    this.maxPitch = 1.30;
    this.minDistance = 3.0;
    this.maxDistance = 24.0;

    this.fov = opts.fov === undefined ? (55 * Math.PI / 180) : opts.fov;
    this.near = 0.1;
    this.far = 220;

    this.focus = V.create(0, 1.4, 0);        // punto al que mira
    this.smoothFocus = V.create(0, 1.4, 0);
    this.position = V.create(0, 3, 10);
    this.heightOffset = 1.15;

    this.view = M.create();
    this.proj = M.create();
    this.viewProj = M.create();
    this.invViewProj = M.create();

    this.sensitivity = 0.0026;
    /* Seguimiento CONTENIDO. Una cámara que persigue al milímetro convierte
       cada paso en un empujón de encuadre y el conjunto se siente de juego de
       acción. Un MMO táctico quiere una cámara casi estática: sigue, pero no
       reacciona a cada acelerón. */
    this.followLerp = 8.0;
    this._shake = 0;
    this._shakeSeed = 0;
    this._shakeFreq = 1.0;
    this.aspect = 16 / 9;

    /* Look-ahead: el encuadre se adelanta hacia donde va el personaje, no se
       queda centrado en él. Con la cámara clavada en el pecho, correr hacia
       delante no enseña nada nuevo y esquivar se hace a ciegas. Es un
       desplazamiento del PUNTO DE MIRA, nunca de la posición simulada. */
    this.lookAhead = V.create(0, 0, 0);
    this.lookAheadTarget = V.create(0, 0, 0);
    this.lookAheadAmount = 0.42;      // unidades a velocidad plena
    this.lookAheadRate = 1.5;         // lento a propósito: rápido produce vaivén
  }

  Camera3D.prototype.orbit = function (dx, dy) {
    this.yaw -= dx * this.sensitivity;
    this.pitch += dy * this.sensitivity;
    if (this.pitch < this.minPitch) this.pitch = this.minPitch;
    if (this.pitch > this.maxPitch) this.pitch = this.maxPitch;
    while (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    while (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  };

  Camera3D.prototype.zoom = function (delta) {
    this.targetDistance += delta * 0.0125;
    if (this.targetDistance < this.minDistance) this.targetDistance = this.minDistance;
    if (this.targetDistance > this.maxDistance) this.targetDistance = this.maxDistance;
  };

  /* Niveles de sacudida. Si todo sacude igual, nada comunica nada: el ataque
     normal no debe mover la cámara, un golpe pesado sí y un crítico más, con
     una frecuencia más baja para que se lea como un golpe y no como ruido. */
  /* Sacudida CONTENIDA. La escala anterior era de juego de acción: cada golpe
     movía el encuadre y en un intercambio de tres segundos la pantalla no
     paraba quieta. Aquí la sacudida es un acento, no un efecto: sólo el golpe
     grande y el crítico llegan a notarse. */
  Camera3D.SHAKE = {
    none:     { amount: 0.00, freq: 1.0 },
    light:    { amount: 0.015, freq: 1.5 },
    moderate: { amount: 0.050, freq: 1.1 },
    heavy:    { amount: 0.105, freq: 0.85 },
    critical: { amount: 0.180, freq: 0.70 }
  };

  /** Sacudida por impacto. `amount` en unidades de intensidad (0.2–1.0). */
  Camera3D.prototype.shake = function (amount, freq) {
    this._shake = Math.min(1.2, this._shake + amount);
    if (freq) this._shakeFreq = freq;
  };

  /** Sacudida por nivel: 'none' | 'light' | 'moderate' | 'heavy' | 'critical'. */
  Camera3D.prototype.shakeTier = function (tier) {
    var t = Camera3D.SHAKE[tier];
    if (!t || t.amount <= 0) return;
    this.shake(t.amount, t.freq);
  };

  Camera3D.prototype.setFocus = function (x, y, z) {
    V.set(this.focus, x, y + this.heightOffset, z);
  };

  /**
   * Adelanta el encuadre en la dirección de desplazamiento.
   * @param vx,vz velocidad del personaje en unidades/segundo
   * @param maxSpeed velocidad base, para normalizar
   */
  Camera3D.prototype.setLookAhead = function (vx, vz, maxSpeed) {
    var sp = Math.sqrt(vx * vx + vz * vz);
    if (sp < 0.05 || maxSpeed <= 0) {
      V.set(this.lookAheadTarget, 0, 0, 0);
      return;
    }
    var k = Math.min(1, sp / maxSpeed) * this.lookAheadAmount;
    V.set(this.lookAheadTarget, (vx / sp) * k, 0, (vz / sp) * k);
  };

  /**
   * @param dt segundos reales
   * @param world para la colisión de cámara; puede omitirse
   */
  Camera3D.prototype.update = function (dt, world, aspect) {
    this.aspect = aspect || this.aspect;

    // El look-ahead entra y sale despacio: si siguiera al input al instante,
    // cada corrección de rumbo balancearía la cámara y marearía.
    var la = 1 - Math.exp(-this.lookAheadRate * dt);
    V.lerp(this.lookAhead, this.lookAhead, this.lookAheadTarget, la);

    var k = 1 - Math.exp(-this.followLerp * dt);
    var aim = {
      x: this.focus.x + this.lookAhead.x,
      y: this.focus.y,
      z: this.focus.z + this.lookAhead.z
    };
    V.lerp(this.smoothFocus, this.smoothFocus, aim, k);
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-10 * dt));

    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    var dir = {
      x: Math.sin(this.yaw) * cp,
      y: sp,
      z: Math.cos(this.yaw) * cp
    };

    var desired = {
      x: this.smoothFocus.x + dir.x * this.distance,
      y: this.smoothFocus.y + dir.y * this.distance,
      z: this.smoothFocus.z + dir.z * this.distance
    };

    // Colisión: si hay un muro entre el foco y la cámara, acercarse hasta él.
    if (world && world.arena) {
      var toCam = V.normalize(V.create(), V.sub(V.create(), desired, this.smoothFocus));
      var maxD = this.distance;
      var nearest = maxD;
      var obs = world.arena.obstacles;
      for (var i = 0; i < obs.length; i++) {
        var t = Ray.rayAABB(this.smoothFocus, toCam, obs[i], maxD);
        if (t !== null && t < nearest) nearest = t;
      }
      if (nearest < maxD) {
        var d = Math.max(this.minDistance * 0.5, nearest - 0.35);
        desired.x = this.smoothFocus.x + toCam.x * d;
        desired.y = this.smoothFocus.y + toCam.y * d;
        desired.z = this.smoothFocus.z + toCam.z * d;
      }
      if (desired.y < 0.35) desired.y = 0.35;
    }

    if (this._shake > 0.001) {
      this._shakeSeed += dt * 47.0 * this._shakeFreq;
      var s = this._shake * 0.16;
      desired.x += Math.sin(this._shakeSeed * 2.7) * s;
      desired.y += Math.cos(this._shakeSeed * 3.9) * s;
      desired.z += Math.sin(this._shakeSeed * 1.9) * s;
      // Caída rápida: una sacudida larga marea, una corta comunica impacto.
      this._shake *= Math.exp(-11.0 * dt);
    }

    V.copy(this.position, desired);

    M.lookAt(this.view, this.position, this.smoothFocus, { x: 0, y: 1, z: 0 });
    M.perspective(this.proj, this.fov, this.aspect, this.near, this.far);
    M.multiply(this.viewProj, this.proj, this.view);
    M.invert(this.invViewProj, this.viewProj);
  };

  /** Vectores de movimiento relativos a la cámara (WASD tipo MMO). */
  Camera3D.prototype.movementBasis = function () {
    var fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    return {
      forward: { x: fx, z: fz },
      right: { x: -fz, z: fx }
    };
  };

  /** Rayo en espacio mundo desde un píxel de pantalla. Base del picking. */
  Camera3D.prototype.screenRay = function (ndcX, ndcY) {
    var nearP = M.transformPoint({}, this.invViewProj, { x: ndcX, y: ndcY, z: -1 });
    var farP = M.transformPoint({}, this.invViewProj, { x: ndcX, y: ndcY, z: 1 });
    var dir = V.normalize(V.create(), V.sub(V.create(), farP, nearP));
    return { origin: nearP, dir: dir };
  };

  Arena.Render.Camera3D = Camera3D;
});
