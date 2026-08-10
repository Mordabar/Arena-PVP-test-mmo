/* =============================================================================
 * main.js — Arranque, entrada del jugador, escenarios y bucle principal.
 *
 * Aquí se cose todo: simulación (autoridad) + renderer + HUD (espejo).
 * El jugador usa exactamente la misma API que un bot: Arena.Combat.AbilitySystem.
 * Si algo se puede hacer aquí y no desde la IA, es un privilegio indebido.
 * ========================================================================== */
Arena.define('main',
  ['sim/world', 'render/webglRenderer', 'render/vfx', 'render/picking',
   'ui/hud', 'ui/combatLog', 'ui/labPanel', 'ui/tooltips', 'ai/dummyAI', 'audio/audio'],
  function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var B = Arena.Data.balance;
  var Ability = Arena.Combat.AbilitySystem;
  var Picking = Arena.Render.Picking;
  var VFX = Arena.Render.VFX;

  var Game = {
    world: null, renderer: null, hud: null, log: null, lab: null, tooltips: null,
    playerClass: 'devastador',
    scenario: 'duel',
    input: {
      forward: 0, strafe: 0,
      mouseNdc: { x: 0, y: 0 },
      dragging: false, dragButton: -1, dragMoved: 0,
      lastX: 0, lastY: 0
    },
    _lastFrame: 0,
    _running: false
  };

  /* =========================================================================
   * Arranque
   * ====================================================================== */
  Game.start = function () {
    var canvas = document.getElementById('gl');
    var hudRoot = document.getElementById('hud');

    this.world = new Arena.Sim.World({ seed: 20260810 });
    this.renderer = new Arena.Render.Renderer(canvas, this.world).init();
    VFX.install(this.world, this.renderer);

    this.hud = new Arena.UI.HUD(hudRoot, this.world, this.renderer);
    this.log = new Arena.UI.CombatLog(hudRoot, this.world);
    this.tooltips = new Arena.UI.Tooltips(hudRoot, this.world);

    var self = this;
    this.lab = new Arena.UI.LabPanel(hudRoot, {
      world: this.world,
      renderer: this.renderer,
      hud: this.hud,
      log: this.log,
      setPlayerClass: function (id) { self.setPlayerClass(id); },
      buildScenario: function (id) { self.buildScenario(id); },
      resetWorld: function () { self.buildScenario(self.scenario); }
    });

    // El audio se arma en el primer gesto: los navegadores bloquean el contexto
    // hasta que hay interacción real del usuario.
    Arena.Audio.install(this.world, function () { return self.hud.playerId; });
    var armAudio = function () {
      Arena.Audio.init();
      Arena.Audio.resume();
      window.removeEventListener('pointerdown', armAudio);
      window.removeEventListener('keydown', armAudio);
    };
    window.addEventListener('pointerdown', armAudio);
    window.addEventListener('keydown', armAudio);

    this._bindInput(canvas);
    this._bindActionBar();

    this.buildScenario('duel');
    this.world.start();

    this._running = true;
    this._lastFrame = performance.now();
    requestAnimationFrame(function (t) { self._frame(t); });
  };

  /* =========================================================================
   * Escenarios (documento §20)
   * ====================================================================== */
  Game.buildScenario = function (id) {
    var world = this.world;
    this.scenario = id;

    world.entities.length = 0;
    world._byId = Object.create(null);
    world.zones.length = 0;
    world.projectiles.length = 0;
    world.bus.emit('WorldReset', { time: world.time });
    if (VFX) VFX.clear();
    if (this.hud) this.hud.clearFloaters();

    var spawns = world.arena.spawns;
    var player = Arena.Data.makeEntity(this.playerClass, {
      id: 'player', name: 'Tú', team: 0, isPlayer: true,
      x: spawns.player.x, z: spawns.player.z, yaw: spawns.player.yaw
    });
    player.aiEnabled = false;
    world.addEntity(player);
    Arena.Data.passives.initEntity(player);
    player.godMode = !!world.settings.godModePlayer;

    var made = [];
    var self = this;
    function add(classId, cfg) {
      var e = Arena.Data.makeEntity(classId, cfg);
      e.aiProfile = cfg.profile || 'passive';
      world.addEntity(e);
      Arena.Data.passives.initEntity(e);
      made.push(e);
      return e;
    }

    switch (id) {
      case 'dummies':
        add('guardian', { name: 'Blindado', team: 1, x: 4, z: -3, profile: 'armored' });
        add('arcanista', { name: 'Resistente', team: 1, x: 4, z: 0, profile: 'warded' });
        add('centinela', { name: 'Saco de daño', team: 1, x: 4, z: 3, profile: 'passive' });
        add('vinculador', { name: 'Aliado', team: 0, x: -8, z: 3, profile: 'support' });
        break;

      case 'duel':
        add('centinela', { name: 'Duelista', team: 1, x: spawns.enemy.x, z: spawns.enemy.z, profile: 'bot' });
        break;

      case 'team':
        add('vinculador', { name: 'Vinculador aliado', team: 0, x: -12, z: 2, profile: 'bot' });
        add('devastador', { name: 'Devastador rival', team: 1, x: 10, z: -2, profile: 'bot' });
        add('vinculador', { name: 'Vinculador rival', team: 1, x: 13, z: 2, profile: 'bot' });
        break;

      case 'counters':
        add('guardian', { name: 'Guardián (reflejo)', team: 1, x: 5, z: -4, profile: 'passive' });
        add('vinculador', { name: 'Vinculador (intervención)', team: 1, x: 5, z: 0, profile: 'passive' });
        add('arcanista', { name: 'Arcanista (velo nulo)', team: 1, x: 5, z: 4, profile: 'passive' });
        add('vinculador', { name: 'Aliado de pruebas', team: 0, x: -8, z: 3, profile: 'passive' });
        break;
    }

    // El primer enemigo queda preseleccionado: nadie quiere empezar buscando
    // a quién pegar.
    for (var i = 0; i < made.length; i++) {
      if (made[i].team !== player.team) { player.targetId = made[i].id; break; }
    }

    this.hud.setPlayer(player);
    this.log.playerId = player.id;
    this.renderer.playerId = player.id;
    this.renderer.selectedId = player.targetId;

    // La cámara empieza detrás del personaje, mirando a donde él mira. Aparecer
    // orientado hacia una pared es la primera impresión más barata de perder.
    var cam = this.renderer.camera;
    cam.yaw = player.yaw + Math.PI;
    cam.pitch = 0.52;
    cam.setFocus(player.pos.x, player.pos.y, player.pos.z);
    V.copy(cam.smoothFocus, cam.focus);

    this.renderer.syncVisuals(0);
    this.lab.syncClass(this.playerClass);
    this.lab.markCombatStart();
    this.log.push('info', 'Escenario: ' + scenarioName(id) + ' · clase ' +
      Arena.Data.classes[this.playerClass].name, []);
  };

  function scenarioName(id) {
    return { dummies: 'sacos de daño', duel: 'duelo 1v1', team: 'combate 2v2',
             counters: 'sala de counters' }[id] || id;
  }

  Game.setPlayerClass = function (classId) {
    this.playerClass = classId;
    this.buildScenario(this.scenario);
  };

  /* =========================================================================
   * Entrada
   * ====================================================================== */
  Game._bindInput = function (canvas) {
    var self = this;
    var input = this.input;

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    canvas.addEventListener('mousedown', function (e) {
      input.dragging = true;
      input.dragButton = e.button;
      input.dragMoved = 0;
      input.lastX = e.clientX;
      input.lastY = e.clientY;
      canvas.classList.add('dragging');
      e.preventDefault();
    });

    window.addEventListener('mouseup', function (e) {
      if (!input.dragging) return;
      canvas.classList.remove('dragging');
      // Clic corto = seleccionar. Arrastre = mover cámara. El umbral evita
      // que un temblor de mano cambie de objetivo en mitad de un burst.
      if (input.dragMoved < 5 && e.button === 0 && e.target === canvas) {
        self._selectAtCursor();
      }
      input.dragging = false;
      input.dragButton = -1;
    });

    window.addEventListener('mousemove', function (e) {
      var ndc = Picking.ndcFromEvent(canvas, e);
      input.mouseNdc.x = ndc.x;
      input.mouseNdc.y = ndc.y;

      if (input.dragging) {
        var dx = e.clientX - input.lastX;
        var dy = e.clientY - input.lastY;
        input.lastX = e.clientX;
        input.lastY = e.clientY;
        input.dragMoved += Math.abs(dx) + Math.abs(dy);
        self.renderer.camera.orbit(dx, dy);
        // Botón derecho: el personaje gira con la cámara, como en cualquier MMO.
        if (input.dragButton === 2) {
          var p = self.world.getPlayer();
          if (p && p.alive) p.yaw = self.renderer.camera.yaw + Math.PI;
        }
      } else if (e.target === canvas) {
        var hover = Picking.entityAt(self.world, self.renderer.camera,
          ndc.x, ndc.y, self.world.getPlayer());
        self.renderer.hoverId = hover ? hover.id : null;
        canvas.style.cursor = hover ? 'pointer' : 'crosshair';
      }
    });

    canvas.addEventListener('wheel', function (e) {
      self.renderer.camera.zoom(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', function (e) { self._onKeyDown(e); });
    window.addEventListener('keyup', function (e) { self._onKeyUp(e); });
    window.addEventListener('blur', function () {
      input.forward = 0; input.strafe = 0;
      self._keys = Object.create(null);
    });
  };

  Game._keys = Object.create(null);

  Game._onKeyDown = function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    var key = e.key.toLowerCase();
    if (this._keys[key]) return;               // ignorar autorepetición
    this._keys[key] = true;

    var world = this.world;
    var player = world.getPlayer();
    if (!player) return;

    // Habilidades 1–6
    if (key >= '1' && key <= '6') {
      this._useSlot(parseInt(key, 10) - 1);
      e.preventDefault();
      return;
    }

    switch (key) {
      case 'tab': {
        var next = Picking.cycleTarget(world, player, player.targetId, { allies: e.shiftKey });
        if (next) { player.targetId = next.id; this.renderer.selectedId = next.id; }
        e.preventDefault();
        break;
      }
      case 't':
        player.autoAttackOn = !player.autoAttackOn;
        break;
      case 'escape':
        if (player.cast) Ability.cancelCast(world, player);
        else { player.targetId = null; this.renderer.selectedId = null; }
        break;
      case 'r':
        this.buildScenario(this.scenario);
        break;
      case 'f':
        // Seleccionarse a uno mismo: necesario para autocurarse.
        player.targetId = player.id;
        this.renderer.selectedId = player.id;
        break;
      case ' ':
        e.preventDefault();
        break;
    }
  };

  Game._onKeyUp = function (e) {
    var key = e.key.toLowerCase();
    this._keys[key] = false;
  };

  Game._readMovement = function () {
    var k = this._keys;
    var f = (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0);
    var s = (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0);
    return { forward: f, strafe: s };
  };

  Game._useSlot = function (index) {
    var world = this.world;
    var player = world.getPlayer();
    if (!player) return;
    var abilityId = player.abilities[index];
    if (!abilityId) return;

    var ab = Arena.Data.abilities[abilityId];
    var ctx = { targetId: player.targetId, target: world.getEntity(player.targetId) };

    // Habilidades de zona: el destino es el punto bajo el cursor.
    if (ab && ab.target === 'ground') {
      var pt = Picking.groundAt(world, this.renderer.camera,
        this.input.mouseNdc.x, this.input.mouseNdc.y);
      ctx.groundPoint = pt;
    }
    // Curación sobre uno mismo cuando no hay aliado seleccionado.
    if (ab && ab.target === 'allyOrSelf' && !ctx.target) {
      ctx.targetId = player.id;
      ctx.target = player;
    }
    Ability.tryUse(world, player, abilityId, ctx);
  };

  Game._selectAtCursor = function () {
    var world = this.world;
    var player = world.getPlayer();
    var hit = Picking.entityAt(world, this.renderer.camera,
      this.input.mouseNdc.x, this.input.mouseNdc.y, player);
    if (hit) {
      if (player) player.targetId = hit.id;
      this.renderer.selectedId = hit.id;
    } else {
      if (player) player.targetId = null;
      this.renderer.selectedId = null;
    }
  };

  Game._bindActionBar = function () {
    var self = this;
    for (var i = 0; i < this.hud.slots.length; i++) {
      (function (slot) {
        slot.root.addEventListener('mousedown', function (e) {
          e.preventDefault();
          self._useSlot(slot.index);
        });
        slot.root.addEventListener('mouseenter', function () {
          if (slot.abilityId) {
            self.tooltips.showAbility(slot.abilityId, slot.root, self.world.getPlayer());
          }
        });
        slot.root.addEventListener('mouseleave', function () { self.tooltips.hide(); });
      })(this.hud.slots[i]);
    }

    var self2 = this;
    this.hud.autoBtn.addEventListener('click', function () {
      var p = self2.world.getPlayer();
      if (p) p.autoAttackOn = !p.autoAttackOn;
    });
    this.hud.autoBtn.addEventListener('mouseenter', function () {
      self2.tooltips.showText('Ataque normal (T)',
        'Se repite mientras el objetivo sea válido y esté en rango. No consume GCD: convive con las habilidades.',
        self2.hud.autoBtn);
    });
    this.hud.autoBtn.addEventListener('mouseleave', function () { self2.tooltips.hide(); });
  };

  /* =========================================================================
   * Bucle
   * ====================================================================== */
  Game._frame = function (now) {
    var self = this;
    if (!this._running) return;

    var realDt = Math.min(0.1, (now - this._lastFrame) / 1000);
    this._lastFrame = now;

    var world = this.world;
    var player = world.getPlayer();

    /* --- Intención de movimiento ---------------------------------------- */
    if (player && player.alive) {
      var mv = this._readMovement();
      if (mv.forward || mv.strafe) {
        var basis = this.renderer.camera.movementBasis();
        var dx = basis.forward.x * mv.forward + basis.right.x * mv.strafe;
        var dz = basis.forward.z * mv.forward + basis.right.z * mv.strafe;
        // El movimiento se aplica dentro del paso fijo para no depender de fps.
        player._moveIntent = { x: dx, z: dz };
      } else {
        player._moveIntent = null;
      }
    }

    /* --- Simulación ------------------------------------------------------- */
    var alpha = world.advance(realDt);

    /* --- Presentación ----------------------------------------------------- */
    this.renderer.syncVisuals(realDt);
    VFX.update(realDt);

    if (player) {
      var ipos = V.lerp(V.create(), player.prevPos, player.pos, alpha);
      this.renderer.camera.setFocus(ipos.x, ipos.y, ipos.z);
      this.renderer.selectedId = player.targetId;

      // Anillo de rango de la habilidad bajo el cursor del ratón.
      this.renderer.rangeIndicator = null;
    }
    var rect = this.renderer.canvas.getBoundingClientRect();
    this.renderer.camera.update(realDt, world, rect.width / Math.max(1, rect.height));

    this.renderer.render(alpha, realDt);
    this.hud.update(realDt, alpha);
    this.lab.update(realDt, realDt);

    requestAnimationFrame(function (t) { self._frame(t); });
  };

  Arena.Game = Game;
});

/* =============================================================================
 * Arranque con red de seguridad: un fallo de WebGL o de shader tiene que
 * explicarse en pantalla, no quedarse en la consola con un lienzo negro.
 * ========================================================================== */
(function () {
  'use strict';
  function boot() {
    try {
      Arena.Game.start();
    } catch (err) {
      var fatal = document.getElementById('fatal');
      if (fatal) {
        fatal.classList.add('show');
        fatal.querySelector('pre').textContent = (err && err.stack) ? err.stack : String(err);
      }
      throw err;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
