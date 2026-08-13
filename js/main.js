/* =============================================================================
 * main.js — Arranque, entrada del jugador, escenarios y bucle principal.
 *
 * Aquí se cose todo: simulación (autoridad) + renderer + HUD (espejo).
 * El jugador usa exactamente la misma API que un bot: Arena.Combat.AbilitySystem.
 * Si algo se puede hacer aquí y no desde la IA, es un privilegio indebido.
 * ========================================================================== */
Arena.define('main',
  ['sim/world', 'render/webglRenderer', 'render/vfx', 'render/picking',
   'ui/hud', 'ui/combatLog', 'ui/labPanel', 'ui/tooltips', 'ui/gameShell',
   'product/matchFlow', 'product/ladder', 'ai/dummyAI', 'audio/audio',
   'data/scenarios'],
  function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var B = Arena.Data.balance;
  var Ability = Arena.Combat.AbilitySystem;
  var Picking = Arena.Render.Picking;
  var VFX = Arena.Render.VFX;

  var Game = {
    world: null, renderer: null, hud: null, log: null, lab: null, tooltips: null, shell: null,
    flow: null, ladderStore: null,
    playerClass: 'devastador',
    scenario: 'duel',
    input: {
      forward: 0, strafe: 0,
      mouseNdc: { x: 0, y: 0 },
      dragging: false, dragButton: -1, dragMoved: 0,
      lastX: 0, lastY: 0,
      /* Distinguir CLIC de ARRASTRE. Se guarda cuándo y dónde empezó la
         pulsación: un clic breve con poco desplazamiento sigue seleccionando,
         y usa la posición ORIGINAL del cursor, no la final. Con Pointer Lock
         activo el cursor deja de existir, así que sin guardarla no habría
         forma de saber a qué se apuntaba. */
      downTime: 0, downX: 0, downY: 0, downNdc: { x: 0, y: 0 },
      pointerLocked: false,
      steerYawPending: 0, pointerTimer: null,
      dragActive: false, pendingDragDx: 0, pendingDragDy: 0,
      /* Modo de cámara activo: 'steer' (botón izquierdo — la cámara arrastra al
         personaje) o 'freelook' (botón derecho — mirar sin girar el cuerpo). */
      camMode: null
    },
    _lastFrame: 0,
    _running: false,
    _matchResolved: false,
    _matchEndPending: false,
    _lastMatch: { mode: '1v1', classId: 'devastador' }
  };

  /* =========================================================================
   * Arranque
   * ====================================================================== */
  Game.start = function () {
    var canvas = document.getElementById('gl');
    var hudRoot = document.getElementById('hud');

    this.world = new Arena.Sim.World({ seed: 20260810 });
    /* El renderer se elige por nombre a través del contrato común
       (render/rendererBackend.js). `index.html` no declara ninguno y usa el
       WebGL2 nativo; `index-three.html` declara 'three'. Así el arranque es el
       mismo fichero para las dos presentaciones. */
    this.renderer = Arena.Render.RendererBackend.create(
      window.ARENA_RENDERER || 'webgl2', canvas, this.world);
    VFX.install(this.world, this.renderer);

    this.hud = new Arena.UI.HUD(hudRoot, this.world, this.renderer);
    this.log = new Arena.UI.CombatLog(hudRoot, this.world);
    this.tooltips = new Arena.UI.Tooltips(hudRoot, this.world);

    var self = this;
    var browserStorage = null;
    try { browserStorage = window.localStorage; } catch (storageErr) { browserStorage = null; }
    this.ladderStore = Arena.Product.Ladder.makeStorage(browserStorage);
    this.flow = new Arena.Product.MatchFlow({
      classId: this.playerClass,
      profile: this.ladderStore.load(),
      onChange: function (state, reason) { self._onFlowChange(state, reason); }
    });
    this.lab = new Arena.UI.LabPanel(hudRoot, {
      world: this.world,
      renderer: this.renderer,
      hud: this.hud,
      log: this.log,
      setPlayerClass: function (id) { self.setPlayerClass(id); },
      buildScenario: function (id) { self.buildScenario(id); },
      resetWorld: function () { self.buildScenario(self.scenario); }
    });

    this.shell = new Arena.UI.GameShell({
      world: this.world, flow: this.flow, classId: this.playerClass,
      onStart: function (mode, classId) { self.startMatch(mode, classId); },
      onTraining: function () { self.openTraining(); },
      onRematch: function () { self.rematch(); },
      onLobby: function () { self.enterLobby(); }
    });
    this.world.bus.on('EntityDied', function () { self._matchEndPending = true; });

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

    this._clearWorld();
    this.world.start();
    this.flow.enterLobby();

    this._running = true;
    this._lastFrame = performance.now();
    requestAnimationFrame(function (t) { self._frame(t); });
  };

  Game._clearWorld = function () {
    var world = this.world;
    if (!world) return;
    world.entities.length = 0;
    world._byId = Object.create(null);
    world.zones.length = 0;
    world.projectiles.length = 0;
    world.bus.emit('WorldReset', { time: world.time });
    if (VFX) VFX.clear();
    if (this.hud) { this.hud.clearFloaters(); this.hud.playerId = null; }
    if (this.renderer) { this.renderer.playerId = null; this.renderer.selectedId = null; this.renderer.syncVisuals(0); }
  };

  Game._onFlowChange = function (state, reason) {
    if (reason === 'fight') {
      this._setBotsEnabled(true);
      var p = this.world.getPlayer();
      if (p) p.combatMode = false;
      if (Arena.Audio && Arena.Audio.sounds && Arena.Audio.sounds.roundStart) Arena.Audio.sounds.roundStart();
    }
    if (reason === 'finish') {
      this._setBotsEnabled(false);
      this.ladderStore.save(this.flow.profile);
      if (Arena.Audio && Arena.Audio.sounds && state.result && !state.result.draw) {
        var s = state.result.won ? Arena.Audio.sounds.victory : Arena.Audio.sounds.defeat;
        if (s) s();
      }
    }
    if (this.shell) this.shell.update(state);
  };

  Game._setBotsEnabled = function (enabled) {
    for (var i=0; i<this.world.entities.length; i++) {
      var e = this.world.entities[i];
      if (!e.isPlayer) e.aiEnabled = !!enabled && e.aiProfile !== 'passive' && e.aiProfile !== 'armored' && e.aiProfile !== 'warded';
    }
  };

  Game._opponentFor = function (classId) {
    return { devastador:'centinela', guardian:'arcanista', centinela:'devastador',
      rastreador:'vinculador', arcanista:'guardian', vinculador:'rastreador' }[classId] || 'centinela';
  };

  Game._allyFor = function (classId) {
    if (classId === 'vinculador') return 'devastador';
    if (classId === 'guardian') return 'centinela';
    return 'vinculador';
  };

  Game._aiProfileForClass = function (classId) {
    return {
      devastador:'chaser', guardian:'peel', centinela:'kiter', rastreador:'kiter',
      arcanista:'caster', vinculador:'support'
    }[classId] || 'sparring';
  };

  Game.startMatch = function (mode, classId) {
    this.playerClass = Arena.Data.classes[classId] ? classId : this.playerClass;
    this._lastMatch = { mode: mode === '2v2' ? '2v2' : '1v1', classId: this.playerClass };
    this._matchResolved = false;
    this._matchEndPending = false;
    this.buildScenario(this._lastMatch.mode === '2v2' ? 'team' : 'duel');
    this._setBotsEnabled(false);
    var p = this.world.getPlayer();
    if (p) { p._moveIntent = null; p._turnIntent = 0; p.autoAttackOn = false; p.combatMode = false; }
    this.flow.begin(this._lastMatch.mode, this.playerClass, 3.0);
  };

  Game.openTraining = function () {
    this._matchResolved = false;
    this._matchEndPending = false;
    this.flow.begin('training', this.playerClass, 0);
    this.buildScenario('timing');
    this._setBotsEnabled(false);
    document.body.classList.add('arena-training');
  };

  Game.enterLobby = function () {
    document.body.classList.remove('arena-training');
    this._matchResolved = false;
    this._matchEndPending = false;
    this._clearWorld();
    this.flow.enterLobby();
  };

  Game.rematch = function () {
    this.startMatch(this._lastMatch.mode, this._lastMatch.classId);
  };

  Game._teamAlive = function (team) {
    for (var i=0; i<this.world.entities.length; i++) {
      var e=this.world.entities[i]; if (e.team===team && e.alive) return true;
    }
    return false;
  };

  Game._teamStats = function (team) {
    var out={damage:0, healing:0, interrupts:0};
    for (var i=0;i<this.world.entities.length;i++) {
      var e=this.world.entities[i]; if(e.team!==team) continue;
      out.damage += e.stats.damageDealt || 0; out.healing += e.stats.healingDone || 0; out.interrupts += e.stats.interrupts || 0;
    }
    return out;
  };

  Game._evaluateMatchEnd = function () {
    if (!this.flow || this.flow.phase !== 'ACTIVE' || this.flow.mode === 'training' || this._matchResolved) return;
    var alive0=this._teamAlive(0), alive1=this._teamAlive(1);
    if (alive0 && alive1) return;
    this._matchResolved = true;
    var winner = (!alive0 && !alive1) ? -1 : (alive0 ? 0 : 1);
    var enemyName='Rival';
    for(var i=0;i<this.world.entities.length;i++){ var e=this.world.entities[i]; if(e.team===1){ enemyName=Arena.Data.classes[e.classId]?Arena.Data.classes[e.classId].name:e.name; break; } }
    this.flow.finish(winner, {
      opponentRating: this.flow.mode === '2v2' ? 1040 : 1020,
      opponent: enemyName, stats: this._teamStats(0)
    });
  };

  /* =========================================================================
   * Escenarios (documento §20)
   * ====================================================================== */
  Game.buildScenario = function (id) {
    var world = this.world;
    this.scenario = id;

    this._clearWorld();

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
    function add(classId, cfg) {
      var e = Arena.Data.makeEntity(classId, cfg);
      e.aiProfile = cfg.profile || 'passive';
      world.addEntity(e);
      Arena.Data.passives.initEntity(e);
      made.push(e);
      return e;
    }

    /* El layout vive en `data/scenarios` para que las pruebas puedan
       comprobar que nadie nace dentro de una columna. Aquí sólo se resuelven
       los roles («la contraclase del jugador») y se instancia. */
    var scen = Arena.Data.scenarios.get(id);
    if (scen) {
      for (var u = 0; u < scen.units.length; u++) {
        var unit = scen.units[u];
        var classId = this._resolveScenarioClass(unit.cls);
        var pos = Arena.Data.scenarios.positionOf(unit, world.arena);
        add(classId, {
          name: unit.name || (Arena.Data.classes[classId].name + (unit.nameSuffix || '')),
          team: unit.team,
          x: pos.x, z: pos.z, yaw: pos.yaw,
          profile: unit.profile === 'byClass' ? this._aiProfileForClass(classId) : unit.profile
        });
      }
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
    cam.pitch = 0.44;
    cam.targetDistance = 7.8;
    cam.distance = 7.8;
    cam.setFocus(player.pos.x, player.pos.y, player.pos.z);
    V.copy(cam.smoothFocus, cam.focus);

    this.renderer.syncVisuals(0);
    this.lab.syncClass(this.playerClass);
    this.lab.markCombatStart();
    this.log.push('info', 'Escenario: ' + scenarioName(id) + ' · clase ' +
      Arena.Data.classes[this.playerClass].name, []);
  };

  function scenarioName(id) {
    return Arena.Data.scenarios.nameOf(id);
  }

  /** Roles del escenario → clase concreta, en función de la del jugador. */
  Game._resolveScenarioClass = function (cls) {
    if (cls === 'opponent') return this._opponentFor(this.playerClass);
    if (cls === 'ally') return this._allyFor(this.playerClass);
    if (cls === 'enemyMate') return this._allyFor(this._opponentFor(this.playerClass));
    return cls;
  };

  Game.setPlayerClass = function (classId) {
    if (!Arena.Data.classes[classId]) return;
    this.playerClass = classId;
    if (this.flow) this.flow.classId = classId;
    if (this.flow && this.flow.phase === 'LOBBY') { if (this.shell) this.shell.selectClass(classId); return; }
    this.buildScenario(this.scenario);
  };

  /* =========================================================================
   * Entrada
   * ====================================================================== */
  Game._bindInput = function (canvas) {
    var self = this;
    var input = this.input;

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* --- RATÓN --------------------------------------------------------------
     *
     * IZQUIERDO tiene dos comportamientos que hay que poder distinguir:
     *   clic corto   → seleccionar lo que hay bajo el cursor
     *   mantener     → gobernar la cámara Y arrastrar al personaje con ella
     *
     * DERECHO es free look: la cámara gira libremente y el cuerpo NO. Poder
     * mirar atrás mientras sigues corriendo hacia delante es una de las cosas
     * que separan un MMO de un juego de acción con lock-on.
     *
     * Con Pointer Lock el cursor desaparece, así que la selección usa la
     * posición que tenía el ratón AL PULSAR, no la que tiene al soltar.
     */
    var CLICK_MAX_MS = 260, CLICK_MAX_PX = 6;

    canvas.addEventListener('mousedown', function (e) {
      input.dragging = true;
      input.dragButton = e.button;
      input.dragMoved = 0;
      input.dragActive = false;
      input.pendingDragDx = 0; input.pendingDragDy = 0;
      input.lastX = e.clientX;
      input.lastY = e.clientY;
      input.downTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      input.downX = e.clientX;
      input.downY = e.clientY;
      var ndc0 = Picking.ndcFromEvent(canvas, e);
      input.downNdc.x = ndc0.x;
      input.downNdc.y = ndc0.y;
      input.camMode = (e.button === 0) ? 'steer' : (e.button === 2 ? 'freelook' : null);
      canvas.classList.add('dragging');
      // Pointer Lock sólo empieza al superar el deadzone: mantener pulsado sin
      // mover sigue siendo un clic potencial y NO toca la cámara.
      e.preventDefault();
    });

    window.addEventListener('mouseup', function (e) {
      if (!input.dragging) return;
      if (input.pointerTimer) { clearTimeout(input.pointerTimer); input.pointerTimer = null; }
      canvas.classList.remove('dragging');

      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      var held = now - input.downTime;
      var moved = Math.abs(e.clientX - input.downX) + Math.abs(e.clientY - input.downY);
      // Clic corto y quieto = seleccionar. El umbral doble —tiempo y píxeles—
      // evita que un temblor de mano cambie de objetivo en mitad de un burst y
      // que una cámara movida despacio cuente como selección.
      if (e.button === 0 && held < CLICK_MAX_MS && !input.dragActive) {
        self._selectAt(input.downNdc.x, input.downNdc.y);
      }
      self._exitPointerLock();
      input.dragging = false;
      input.dragButton = -1;
      input.camMode = null;
    });

    window.addEventListener('mousemove', function (e) {
      // Con Pointer Lock el ratón no tiene posición: sólo entrega desplazamiento.
      var dx, dy;
      if (input.pointerLocked) {
        dx = e.movementX || 0;
        dy = e.movementY || 0;
      } else {
        var ndc = Picking.ndcFromEvent(canvas, e);
        input.mouseNdc.x = ndc.x;
        input.mouseNdc.y = ndc.y;
        dx = e.clientX - input.lastX;
        dy = e.clientY - input.lastY;
        input.lastX = e.clientX;
        input.lastY = e.clientY;
      }

      if (input.dragging) {
        input.dragMoved += Math.abs(dx) + Math.abs(dy);
        if (!input.dragActive) {
          input.pendingDragDx += dx; input.pendingDragDy += dy;
          // DEADZONE REAL: hasta cruzarlo NO se ha movido ni un píxel de cámara
          // ni un radián del cuerpo. Esto evita que seleccionar cambie el encuadre.
          if (input.dragMoved < CLICK_MAX_PX) return;
          input.dragActive = true;
          dx = input.pendingDragDx; dy = input.pendingDragDy;
          input.pendingDragDx = 0; input.pendingDragDy = 0;
          self._enterPointerLock(canvas);
        }
        var yawBefore = self.renderer.camera.yaw;
        self.renderer.camera.orbit(dx, dy);
        if (input.camMode === 'steer') {
          var p = self.world && self.world.getPlayer ? self.world.getPlayer() : null;
          if (p) p._mouseTurnDelta = (p._mouseTurnDelta || 0) +
            V.angleDelta(yawBefore, self.renderer.camera.yaw);
        }
      } else if (e.target === canvas) {
        var hover = Picking.entityAt(self.world, self.renderer.camera,
          input.mouseNdc.x, input.mouseNdc.y, self.world.getPlayer());
        self.renderer.hoverId = hover ? hover.id : null;
        canvas.style.cursor = hover ? 'pointer' : 'crosshair';
      }
    });

    document.addEventListener('pointerlockchange', function () {
      input.pointerLocked = (document.pointerLockElement === canvas);
    });

    canvas.addEventListener('wheel', function (e) {
      self.renderer.camera.zoom(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', function (e) { self._onKeyDown(e); });
    window.addEventListener('keyup', function (e) { self._onKeyUp(e); });
    window.addEventListener('blur', function () {
      input.forward = 0; input.strafe = 0;
      if (input.pointerTimer) { clearTimeout(input.pointerTimer); input.pointerTimer = null; }
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

    var combatEnabled = !this.flow || this.flow.phase === 'ACTIVE';

    // Habilidades 1–6
    if (key >= '1' && key <= '6') {
      if (!combatEnabled) { e.preventDefault(); return; }
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
        if (!combatEnabled) break;
        player.autoAttackOn = !player.autoAttackOn;
        player.combatMode = player.autoAttackOn;
        if (!player.autoAttackOn && player.weaponState && player.weaponState.phase === 'WINDUP') {
          Ability.cancelWeaponWindup(world, player, 'combatModeOff');
        }
        break;
      case 'escape':
        if (player.pendingCast || player.cast) Ability.cancelCast(world, player, 'manual');
        else { player.targetId = null; this.renderer.selectedId = null; }
        break;
      case 'r':
        if (this.flow && this.flow.mode !== 'training' && this.flow.phase !== 'LOBBY') this.rematch();
        else this.buildScenario(this.scenario);
        break;
      case 'f':
        // Seleccionarse a uno mismo: necesario para autocurarse.
        player.targetId = player.id;
        this.renderer.selectedId = player.id;
        break;
      case ' ':
        if (!combatEnabled) break;
        player._jumpRequested = true;
        e.preventDefault();
        break;
      case 'f3':
        // Depuración de animación: esqueleto, pies anclados, centro de masa y
        // vectores. Sólo lee estado, así que apagarlo no cambia nada.
        Arena.Render.AnimDebug.enabled = !Arena.Render.AnimDebug.enabled;
        e.preventDefault();
        break;
    }
  };

  /** Vuelca el estado de animación del personaje observado al panel de F3. */
  Game._updateAnimDebug = function (player) {
    var D = Arena.Render.AnimDebug;
    var panel = document.getElementById('animDebug');
    if (!panel) return;
    if (!D.enabled) { panel.hidden = true; return; }
    panel.hidden = false;

    // Se depura el objetivo si lo hay: es más útil ver el bicho que se mueve
    // delante que el propio personaje, que casi siempre está de espaldas.
    var subject = (player && player.targetId && player.targetId !== player.id)
      ? this.world.getEntity(player.targetId) : player;
    if (!subject) { panel.querySelector('pre').textContent = 'sin entidad'; return; }
    var handle = this.renderer.visuals[subject.id];
    if (!handle) { panel.querySelector('pre').textContent = 'sin estado visual'; return; }
    panel.querySelector('pre').textContent = D.lines(handle, subject).join('\n');
  };

  /** Pantalla de error compartida por los dos arranques. */
  Game.showFatal = function (err) {
    var fatal = document.getElementById('fatal');
    if (!fatal) return;
    fatal.classList.add('show');
    var pre = fatal.querySelector('pre');
    if (pre) pre.textContent = (err && err.stack) ? err.stack : String(err);
  };

  Game._onKeyUp = function (e) {
    var key = e.key.toLowerCase();
    this._keys[key] = false;
  };

  /** W/S avanzan y retroceden · A/D son STRAFE, nunca giro. */
  Game._readMovement = function () {
    var k = this._keys;
    var f = (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0);
    var s = (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0);
    return { forward: f, strafe: s };
  };

  /**
   * Intención de giro, en −1..1. Dos fuentes que se combinan:
   *
   *   Q/E              giro explícito a velocidad plena
   *   arrastre izq.    la cámara arrastra al cuerpo consigo
   *
   * Devuelve INTENCIÓN, no un ángulo. Quien gira de verdad es la simulación,
   * dentro del paso fijo. El renderer no escribe `yaw` en ningún caso, ni
   * siquiera cuando el gesto que lo provoca nace en el ratón.
   */
  Game._applyTurnIntent = function (player) {
    var k = this._keys;

    /* Arrastre con botón izquierdo: el cuerpo ES la cámara, 1:1 y sin retardo.
       Así se comporta el giro con ratón en cualquier MMO, y es lo que hace que
       el gesto se sienta conectado a la mano en vez de a un motor. */
    if (this.input.camMode === 'steer') {
      /* El delta exacto del ratón ya quedó en `_mouseTurnDelta` durante
         mousemove. Aquí sólo impedimos que Q/E compitan con el gesto. */
      player._faceIntent = null;
      player._turnIntent = 0;
      return;
    }
    player._faceIntent = null;

    // Q/E: giro por tecla, limitado por TURN_SPEED. Una tecla no tiene
    // magnitud, así que su velocidad la pone el juego.
    player._turnIntent = (k['e'] ? 1 : 0) - (k['q'] ? 1 : 0);
  };

  Game._useSlot = function (index) {
    if (this.flow && this.flow.phase !== 'ACTIVE') return;
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

  /** Pointer Lock donde exista; donde no, el juego sigue funcionando igual. */
  Game._enterPointerLock = function (canvas) {
    if (this.input.pointerLocked) return;
    if (canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch (err) { /* no soportado */ }
    }
  };
  Game._exitPointerLock = function () {
    if (!this.input.pointerLocked) return;
    if (document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (err) { /* no soportado */ }
    }
  };

  Game._selectAtCursor = function () {
    this._selectAt(this.input.mouseNdc.x, this.input.mouseNdc.y);
  };

  /** Selecciona en unas coordenadas concretas, no necesariamente las actuales. */
  Game._selectAt = function (ndcX, ndcY) {
    var world = this.world;
    var player = world.getPlayer();
    var hit = Picking.entityAt(world, this.renderer.camera, ndcX, ndcY, player);
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
      if (self2.flow && self2.flow.phase !== 'ACTIVE') return;
      var p = self2.world.getPlayer();
      if (p) { p.autoAttackOn = !p.autoAttackOn; p.combatMode = p.autoAttackOn; }
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
    if (this.flow) this.flow.update(realDt);

    /* --- Intención de movimiento y giro -----------------------------------
     *
     * EL MOVIMIENTO ES RELATIVO AL FRENTE DEL PERSONAJE, no a la cámara.
     *
     * Con base de cámara, mirar a un lado cambia hacia dónde avanza W, y el
     * cuerpo deja de tener un frente propio: da igual hacia dónde mire el
     * personaje porque el desplazamiento no lo usa. Aquí el frente del cuerpo
     * es lo que decide todo —hacia dónde se avanza, qué hay en el arco frontal,
     * qué habilidad puede lanzarse— y por eso orientarse es una decisión
     * táctica y no un efecto secundario de mover el ratón.
     */
    if (player && player.alive && (!this.flow || this.flow.phase === 'ACTIVE')) {
      var mv = this._readMovement();
      if (mv.forward || mv.strafe) {
        /* Base ortonormal del personaje, alineada con la percepción de la
         * cámara que arranca DETRÁS del avatar. El proyecto usa +Z como frente;
         * en un sistema diestro con Y arriba, la derecha visual de ese frente
         * es −X, no +X. Ésa era la raíz real del bug A/D: matemáticamente se
         * movía por un vector consistente, pero en pantalla D se veía a la
         * izquierda.
         *
         *   frente   F = ( sin yaw,  cos yaw)
         *   derecha  R = (-cos yaw,  sin yaw)
         *
         * Con yaw=0 y la cámara detrás, D va a la DERECHA de la pantalla. */
        var sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
        var dx = sy * mv.forward - cy * mv.strafe;
        var dz = cy * mv.forward + sy * mv.strafe;
        // Se aplica dentro del paso fijo para no depender de los fps.
        player._moveIntent = { x: dx, z: dz };
      } else {
        player._moveIntent = null;
      }
      this._applyTurnIntent(player);
    } else if (player) {
      player._moveIntent = null; player._turnIntent = 0; player._faceIntent = null;
    }

    /* --- Simulación ------------------------------------------------------- */
    var alpha = world.advance(realDt);
    if (this._matchEndPending) { this._matchEndPending = false; this._evaluateMatchEnd(); }

    /* --- Presentación ----------------------------------------------------- */
    this.renderer.syncVisuals(realDt);
    VFX.update(realDt);

    if (player) {
      var ipos = V.lerp(V.create(), player.prevPos, player.pos, alpha);
      var jumpY = (player.prevJumpOffset || 0) +
        ((player.jumpOffset || 0) - (player.prevJumpOffset || 0)) * alpha;
      this.renderer.camera.setFocus(ipos.x, ipos.y + jumpY * 0.42, ipos.z);
      // Look-ahead: la velocidad se deduce del paso fijo ya simulado, no del
      // input. Así el encuadre se adelanta a lo que el personaje ESTÁ haciendo
      // y no a lo que se le acaba de pedir.
      var vx = (player.pos.x - player.prevPos.x) * world.clock.rate;
      var vz = (player.pos.z - player.prevPos.z) * world.clock.rate;
      this.renderer.camera.setLookAhead(vx, vz, player.moveSpeedBase);
      this.renderer.selectedId = player.targetId;

      // Anillo de rango de la habilidad bajo el cursor del ratón.
      this.renderer.rangeIndicator = null;
    }
    var rect = this.renderer.canvas.getBoundingClientRect();
    this.renderer.camera.update(realDt, world, rect.width / Math.max(1, rect.height));

    this.renderer.render(alpha, realDt);
    this.hud.update(realDt, alpha);
    if (this.shell && this.flow) this.shell.update(this.flow.snapshot());
    this.lab.update(realDt, realDt);
    this._updateAnimDebug(player);

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
      Arena.Game.showFatal(err);
      throw err;
    }
  }
  Arena.Game.boot = boot;

  /* Arranque diferido. `index-three.html` carga Three.js como módulo ES, que es
     asíncrono por definición: si el juego arrancara aquí, lo haría antes de que
     exista el renderer. En ese caso da la salida el bootstrap del módulo, que
     llama a `Arena.Game.boot()` cuando ya tiene la escena montada.

     El guard va AQUÍ y no dentro de `boot()`: puesto dentro, bloquearía también
     la llamada explícita del bootstrap y el juego no arrancaría nunca. */
  function autoBoot() {
    if (window.ARENA_DEFER_BOOT) return;
    boot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBoot);
  else autoBoot();
})();
