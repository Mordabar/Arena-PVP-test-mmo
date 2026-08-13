/* =============================================================================
 * ui/labPanel.js — Controles del Combat Lab (documento §20).
 *
 * Todo lo que el documento pide poder probar sin recompilar:
 *   · seis subclases jugables desde un clic
 *   · escenarios: sacos de daño, 1v1, 2v2, sala de counters
 *   · aplicar cada control al objetivo para ver la regla en aislamiento
 *   · interruptores: DR, RNG, cooldowns, coste de recurso, IA, vida infinita
 *   · perfiles de dummy: blindado, resistente, soporte, perseguidor, kiteador
 *   · métricas en vivo para juzgar el ritmo con números, no con sensaciones
 * ========================================================================== */
Arena.define('ui/labPanel', ['ui/combatLog', 'ai/dummyAI'], function (Arena) {
  'use strict';

  var el = Arena.UI.el;
  var B = Arena.Data.balance;
  var Status = Arena.Combat.StatusSystem;
  var Dmg = Arena.Combat.DamageSystem;
  var Heal = Arena.Combat.HealingSystem;
  var AI = Arena.AI;

  var CC_BUTTONS = [
    { effect: 'knockdown', duration: 1.3, label: 'Noqueo' },
    { effect: 'stun', duration: 1.5, label: 'Aturdir' },
    { effect: 'silence', duration: 1.8, label: 'Mareo' },
    { effect: 'root', duration: 2.2, label: 'Enraizar' },
    { effect: 'disarm', duration: 2.0, label: 'Desarmar' },
    { effect: 'stasis', duration: 1.8, label: 'Estasis' },
    { effect: 'utilityLock', duration: 4.0, label: 'Confusión' },
    { effect: 'slow', duration: 4.0, label: 'Slow 40%', data: { slowPct: 0.40 } },
    { effect: 'antiHeal', duration: 6.0, label: 'AntiHeal 40%', data: { antiHealPct: 0.40 } },
    { effect: 'antiBuff', duration: 4.0, label: 'Velo nulo' },
    { effect: 'armorBreak', duration: 6.0, label: 'Armadura −25%', data: { armorReductionPct: 0.25 } }
  ];

  var COUNTER_BUTTONS = [
    { effect: 'intervention', duration: 6, label: 'Intervención' },
    { effect: 'reflect', duration: 6, label: 'Reflejo' },
    { effect: 'block', duration: 3, label: 'Bloqueo', data: { slowPct: 0.35 } },
    { effect: 'barrier', duration: 10, label: 'Barrera 250', data: { amount: 250 } },
    { effect: 'damageReduction', duration: 6, label: '−35 % daño', data: { damageTakenPct: -0.35 } },
    { effect: 'slowImmunity', duration: 6, label: 'Inmune a slow' }
  ];

  function LabPanel(root, ctx) {
    this.ctx = ctx;               // {world, renderer, hud, log, setPlayerClass, buildScenario}
    this.world = ctx.world;
    this._build(root);
    this._metricsTimer = 0;
    this._frameTimes = [];
  }

  LabPanel.prototype._build = function (root) {
    var self = this;
    var panel = el('div', '', root); panel.id = 'lab';
    var head = el('header', '', panel);
    el('span', '', head).textContent = 'Combat Lab';
    var chev = el('span', 'chev', head); chev.textContent = '▾';
    head.onclick = function () { panel.classList.toggle('collapsed'); };

    var body = el('div', 'lab-body', panel);
    this.panel = panel;

    /* --- Subclase --------------------------------------------------------- */
    var s1 = this._section(body, 'Subclase del jugador');
    var grid = el('div', 'class-grid', s1);
    this.classButtons = {};
    Arena.Data.classOrder.forEach(function (id) {
      var c = Arena.Data.classes[id];
      var btn = el('div', 'class-btn', grid);
      btn.innerHTML = '<b>' + c.name + '</b><span class="role">' + shortRole(c) + '</span>';
      btn.title = c.identity;
      btn.onclick = function () { self.ctx.setPlayerClass(id); };
      self.classButtons[id] = btn;
    });

    /* --- Escenario -------------------------------------------------------- */
    var s2 = this._section(body, 'Escenario');
    var row2 = el('div', 'lab-row', s2);
    [
      ['dummies', 'Sacos de daño'],
      ['duel', 'Duelo 1v1'],
      ['team', 'Combate 2v2'],
      ['counters', 'Sala de counters'],
      ['timing', 'Timing Lab']
    ].forEach(function (s) {
      var b = el('button', 'btn', row2);
      b.textContent = s[1];
      b.onclick = function () { self.ctx.buildScenario(s[0]); self._markScenario(s[0]); };
      b.dataset.scenario = s[0];
    });
    this.scenarioRow = row2;

    var row2b = el('div', 'lab-row', s2);
    var reset = el('button', 'btn wide danger', row2b);
    reset.textContent = 'Reiniciar todo (R)';
    reset.onclick = function () { self.ctx.resetWorld(); };

    /* --- Perfil del objetivo ----------------------------------------------- */
    var s3 = this._section(body, 'Perfil del objetivo');
    var sel = el('select', 'lab-select', s3);
    Object.keys(AI.profiles).forEach(function (key) {
      var o = el('option', '', sel);
      o.value = key;
      o.textContent = AI.profiles[key].name;
      o.title = AI.profiles[key].desc;
    });
    sel.value = 'passive';
    sel.onchange = function () { self._applyProfile(sel.value); };
    this.profileSelect = sel;
    var hint = el('div', '', s3);
    hint.style.cssText = 'font-size:10.5px;color:var(--text-faint);margin-top:4px;line-height:1.45';
    this.profileHint = hint;
    sel.dispatchEvent(new Event('change'));

    /* --- Aplicar control --------------------------------------------------- */
    var s4 = this._section(body, 'Aplicar al objetivo');
    var row4 = el('div', 'lab-row', s4);
    CC_BUTTONS.forEach(function (cc) {
      var b = el('button', 'btn', row4);
      b.textContent = cc.label;
      b.style.flex = '1 1 44%';
      b.onclick = function () { self._applyEffect(cc); };
    });

    var s5 = this._section(body, 'Counters y protecciones');
    var row5 = el('div', 'lab-row', s5);
    COUNTER_BUTTONS.forEach(function (cc) {
      var b = el('button', 'btn', row5);
      b.textContent = cc.label;
      b.style.flex = '1 1 44%';
      b.onclick = function () { self._applyEffect(cc); };
    });

    var s6 = this._section(body, 'Vida y estados');
    var row6 = el('div', 'lab-row', s6);
    [
      ['300 de daño', function (t) { Dmg.labDamage(self.world, t, 300, 'pure'); }],
      ['300 de cura', function (t) { Heal.applyHeal(self.world, { source: null, target: t, raw: 300, abilityId: 'lab_heal' }); }],
      ['Bajar al 20 %', function (t) { t.hp = Math.max(1, t.hpMax * 0.2); }],
      ['Vida al máximo', function (t) { t.hp = t.hpMax; t.resource = t.resourceMax; }],
      ['Limpiar estados', function (t) {
        while (t.statuses.length) Status.removeInstance(self.world, t, t.statuses[0], 'lab');
      }],
      ['Matar', function (t) { Dmg.kill(self.world, t, null, 'lab'); }]
    ].forEach(function (pair) {
      var b = el('button', 'btn', row6);
      b.textContent = pair[0];
      b.style.flex = '1 1 44%';
      b.onclick = function () {
        var t = self._target();
        if (t) pair[1](t);
      };
    });

    /* --- Interruptores ------------------------------------------------------ */
    var s7 = this._section(body, 'Interruptores de laboratorio');
    this.toggles = {};
    this._toggle(s7, 'dr', 'Diminishing Returns', B.DR.enabled,
      function (on) { B.DR.enabled = on; }, 'MMO moderno ↔ clásico');
    this._toggle(s7, 'rng', 'RNG (críticos)', this.world.settings.rngEnabled,
      function (on) { self.world.settings.rngEnabled = on; }, '§19: apagado por defecto');
    this._toggle(s7, 'cd', 'Cooldowns libres', this.world.settings.freeCooldowns,
      function (on) { self.world.settings.freeCooldowns = on; });
    this._toggle(s7, 'res', 'Recurso ilimitado', this.world.settings.freeResources,
      function (on) { self.world.settings.freeResources = on; });
    this._toggle(s7, 'ai', 'IA activa', this.world.settings.aiEnabled,
      function (on) { self.world.settings.aiEnabled = on; });
    this._toggle(s7, 'god', 'Jugador invulnerable', false, function (on) {
      var p = self.world.getPlayer();
      if (p) p.godMode = on;
      self.world.settings.godModePlayer = on;
    });
    this._toggle(s7, 'tele', 'Telegraphs', true, function (on) {
      self.ctx.renderer.showTelegraphs = on;
    });
    this._toggle(s7, 'slow', 'Cámara lenta ×0.35', false, function (on) {
      self.world.clock.timeScale = on ? 0.35 : 1;
    }, 'para leer ventanas de counter');

    /* --- Métricas ----------------------------------------------------------- */
    var s8 = this._section(body, 'Métricas');
    this.metrics = el('div', 'metric-grid', s8);
    this._metricRows = {};
    ['FPS', 'Tick', 'Entidades', 'Draw calls', 'Triángulos', 'Partículas',
     'DPS jugador', 'Daño hecho', 'Daño recibido', 'Curación', 'Control sufrido']
      .forEach(function (k) {
        var kd = el('div', 'k', self.metrics); kd.textContent = k;
        var vd = el('div', 'v', self.metrics); vd.textContent = '—';
        self._metricRows[k] = vd;
      });

    var s9 = this._section(body, 'Verificación');
    var row9 = el('div', 'lab-row', s9);
    var testBtn = el('a', 'btn wide', row9);
    testBtn.textContent = 'Abrir batería de pruebas →';
    testBtn.href = 'tests.html';
    testBtn.target = '_blank';
    testBtn.style.textAlign = 'center';
    testBtn.style.textDecoration = 'none';

    this._markScenario('duel');
  };

  function shortRole(c) {
    return c.role.split('/')[0].trim();
  }

  LabPanel.prototype._section = function (parent, title) {
    var s = el('div', 'lab-section', parent);
    var h = el('h3', '', s);
    h.textContent = title;
    return s;
  };

  LabPanel.prototype._toggle = function (parent, key, label, initial, onChange, hint) {
    var t = el('div', 'toggle' + (initial ? ' on' : ''), parent);
    el('div', 'box', t);
    var span = el('span', '', t);
    span.textContent = label;
    if (hint) { var h = el('span', 'hint', t); h.textContent = hint; }
    t.onclick = function () {
      var on = !t.classList.contains('on');
      t.classList.toggle('on', on);
      onChange(on);
    };
    this.toggles[key] = t;
    return t;
  };

  LabPanel.prototype._target = function () {
    var p = this.world.getPlayer();
    var t = p ? this.world.getEntity(p.targetId) : null;
    if (!t) {
      if (this.ctx.hud) this.ctx.hud.showError('Selecciona un objetivo primero');
      return null;
    }
    return t;
  };

  LabPanel.prototype._applyEffect = function (cc) {
    var t = this._target();
    if (!t) return;
    var p = this.world.getPlayer();
    if (cc.effect === 'barrier') {
      Heal.applyBarrier(this.world, {
        source: p, target: t, amount: cc.data.amount, duration: cc.duration, abilityId: 'lab'
      });
      return;
    }
    Status.apply(this.world, t, {
      effect: cc.effect, duration: cc.duration, abilityId: 'lab',
      data: cc.data || {}, ignoreAntiBuff: true
    }, p);
  };

  LabPanel.prototype._applyProfile = function (profileId) {
    var p = this.world.getPlayer();
    var prof = AI.profiles[profileId];
    this.profileHint.textContent = prof ? prof.desc : '';
    for (var i = 0; i < this.world.entities.length; i++) {
      var e = this.world.entities[i];
      if (e.isPlayer) continue;
      if (p && !this.world.areHostile(p, e)) continue;
      AI.applyProfile(e, profileId);
    }
  };

  LabPanel.prototype._markScenario = function (id) {
    var kids = this.scenarioRow.childNodes;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('active', kids[i].dataset.scenario === id);
    }
  };

  LabPanel.prototype.syncToggles = function () {
    this.toggles.dr.classList.toggle('on', B.DR.enabled);
    this.toggles.rng.classList.toggle('on', this.world.settings.rngEnabled);
    this.toggles.ai.classList.toggle('on', this.world.settings.aiEnabled);
  };

  LabPanel.prototype.syncClass = function (classId) {
    for (var id in this.classButtons) {
      this.classButtons[id].classList.toggle('active', id === classId);
    }
  };

  /* =========================================================================
   * Métricas
   * ====================================================================== */
  LabPanel.prototype.update = function (dt, realDt) {
    this._frameTimes.push(realDt);
    if (this._frameTimes.length > 60) this._frameTimes.shift();

    this._metricsTimer += realDt;
    if (this._metricsTimer < 0.25) return;
    this._metricsTimer = 0;

    var sum = 0;
    for (var i = 0; i < this._frameTimes.length; i++) sum += this._frameTimes[i];
    var fps = this._frameTimes.length / Math.max(sum, 1e-5);

    var world = this.world;
    var p = world.getPlayer();
    var r = this.ctx.renderer;
    var parts = 0;
    if (Arena.Render.VFX) {
      for (var j = 0; j < Arena.Render.VFX.particles.length; j++) {
        if (Arena.Render.VFX.particles[j].alive) parts++;
      }
    }

    var set = this._metricRows;
    set['FPS'].textContent = fps.toFixed(0);
    set['Tick'].textContent = world.tickCount;
    set['Entidades'].textContent = world.entities.length;
    set['Draw calls'].textContent = r.stats.drawCalls;
    set['Triángulos'].textContent = Math.round(r.stats.triangles);
    set['Partículas'].textContent = parts;

    if (p) {
      var elapsed = Math.max(1, world.time - (this._combatStart || 0));
      set['DPS jugador'].textContent = (p.stats.damageDealt / elapsed).toFixed(1);
      set['Daño hecho'].textContent = Math.round(p.stats.damageDealt);
      set['Daño recibido'].textContent = Math.round(p.stats.damageTaken);
      set['Curación'].textContent = Math.round(p.stats.healingDone);
      set['Control sufrido'].textContent = p.stats.ccSecondsReceived.toFixed(1) + ' s';
    }
  };

  LabPanel.prototype.markCombatStart = function () {
    this._combatStart = this.world.time;
  };

  Arena.UI.LabPanel = LabPanel;
});
