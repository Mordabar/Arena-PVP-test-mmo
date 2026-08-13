/* =============================================================================
 * ui/combatLog.js — Registro con marca de tiempo (documento §20).
 *
 * Su propósito no es decorar: es poder reconstruir una secuencia y reproducir
 * un bug. Por eso el sello temporal es el TIEMPO DE SIMULACIÓN, no el del
 * reloj de pared, y hay un botón para volcarlo entero al portapapeles.
 * ========================================================================== */
Arena.define('ui/combatLog', ['ui/hud'], function (Arena) {
  'use strict';

  var el = Arena.UI.el;
  var EFF = Arena.Data.effects;

  function CombatLog(root, world) {
    this.world = world;
    this.entries = [];
    this.limit = 400;
    this.filterOwn = false;
    this.playerId = null;
    this.paused = false;
    this._build(root);
    this._subscribe();
  }

  CombatLog.prototype._build = function (root) {
    var box = el('div', '', root); box.id = 'combat-log';
    var head = el('header', '', box);
    el('span', '', head).textContent = 'Registro de combate';
    el('span', 'spacer', head);

    var self = this;
    var own = el('button', 'btn', head);
    own.textContent = 'Sólo yo';
    own.style.flex = '0 0 auto';
    own.style.padding = '2px 7px';
    own.style.fontSize = '10px';
    own.onclick = function () {
      self.filterOwn = !self.filterOwn;
      own.classList.toggle('active', self.filterOwn);
      self._rebuild();
    };

    var copy = el('button', 'btn', head);
    copy.textContent = 'Copiar';
    copy.style.flex = '0 0 auto';
    copy.style.padding = '2px 7px';
    copy.style.fontSize = '10px';
    copy.onclick = function () { self.copyToClipboard(copy); };

    this.lines = el('div', 'lines', box);
    this.box = box;
  };

  CombatLog.prototype._name = function (id) {
    var e = this.world.getEntity(id);
    return e ? e.name : (id ? '?' : 'el entorno');
  };

  CombatLog.prototype._ability = function (id) {
    if (id === 'auto_attack') return 'ataque normal';
    if (id === 'lab_damage') return 'daño de laboratorio';
    var a = Arena.Data.abilities[id];
    return a ? a.name : (id || '—');
  };

  CombatLog.prototype.push = function (kind, text, involved) {
    if (this.paused) return;
    var entry = { t: this.world.time, kind: kind, text: text, involved: involved || [] };
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.shift();
    if (this._passes(entry)) this._append(entry);
  };

  CombatLog.prototype._passes = function (entry) {
    if (!this.filterOwn || !this.playerId) return true;
    return entry.involved.indexOf(this.playerId) >= 0;
  };

  CombatLog.prototype._append = function (entry) {
    var line = el('div', 'log-line ' + entry.kind, this.lines);
    var t = el('span', 't', line);
    t.textContent = entry.t.toFixed(2);
    var m = el('span', 'm', line);
    m.textContent = entry.text;

    while (this.lines.childNodes.length > 220) this.lines.removeChild(this.lines.firstChild);
    // Autoscroll sólo si el usuario ya estaba al final: si está leyendo hacia
    // arriba, arrastrarle al fondo es exactamente lo que no quiere.
    var nearBottom = this.lines.scrollHeight - this.lines.scrollTop - this.lines.clientHeight < 40;
    if (nearBottom) this.lines.scrollTop = this.lines.scrollHeight;
  };

  CombatLog.prototype._rebuild = function () {
    this.lines.innerHTML = '';
    for (var i = 0; i < this.entries.length; i++) {
      if (this._passes(this.entries[i])) this._append(this.entries[i]);
    }
    this.lines.scrollTop = this.lines.scrollHeight;
  };

  CombatLog.prototype._subscribe = function () {
    var self = this;
    var bus = this.world.bus;
    var N = function (id) { return self._name(id); };
    var A = function (id) { return self._ability(id); };

    bus.on('DamageApplied', function (p) {
      if (p.applied < 0.5 && p.absorbed < 0.5) return;
      var parts = [];
      if (p.applied >= 0.5) parts.push(Math.round(p.applied) + ' de daño');
      if (p.absorbed >= 0.5) parts.push(Math.round(p.absorbed) + ' absorbidos');
      if (p.redirected >= 0.5) parts.push(Math.round(p.redirected) + ' redirigidos');
      self.push('dmg',
        N(p.sourceId) + ' → ' + N(p.targetId) + ': ' + parts.join(', ') +
        ' (' + A(p.abilityId) + (p.crit ? ', crítico' : '') + ')',
        [p.sourceId, p.targetId]);
    });

    bus.on('HealApplied', function (p) {
      if (p.applied < 0.5) return;
      var extra = p.antiHealPct > 0 ? ' [AntiHeal ' + Math.round(p.antiHealPct * 100) + '%]' : '';
      self.push('heal',
        N(p.sourceId) + ' cura a ' + N(p.targetId) + ': ' + Math.round(p.applied) + extra,
        [p.sourceId, p.targetId]);
    });

    bus.on('BarrierApplied', function (p) {
      self.push('heal', N(p.sourceId) + ' escuda a ' + N(p.targetId) +
        ' con ' + Math.round(p.amount), [p.sourceId, p.targetId]);
    });

    bus.on('StatusApplied', function (p) {
      var d = EFF[p.effect];
      if (!d) return;
      if (d.passiveAura) return;                     // las auras no ensucian el log
      var dr = p.drMult < 0.999 ? ' [DR ' + Math.round(p.drMult * 100) + '%]' : '';
      var dur = p.duration > 0 ? ' ' + p.duration.toFixed(1) + ' s' : '';
      self.push(d.kind === 'cc' ? 'cc' : 'info',
        N(p.sourceId) + ' aplica ' + d.name + dur + ' a ' + N(p.targetId) + dr,
        [p.sourceId, p.targetId]);
    });

    bus.on('AbilityCastStarted', function (p) {
      self.push('info', N(p.casterId) + ' comienza ' + A(p.abilityId) +
        ' (' + p.castTime.toFixed(1) + ' s)', [p.casterId, p.targetId]);
    });

    bus.on('WeaponWindupStarted', function (p) {
      self.push('info', N(p.casterId) + ': ARMA · WINDUP → release @ ' + p.releaseAt.toFixed(2),
        [p.casterId, p.targetId]);
    });
    bus.on('WeaponWindupCancelled', function (p) {
      self.push('reject', N(p.casterId) + ': ARMA · CANCEL (' + p.reason + ')', [p.casterId]);
    });
    bus.on('AutoAttackReleased', function (p) {
      self.push('info', N(p.casterId) + ': ARMA · RELEASE → ' + N(p.targetId), [p.casterId, p.targetId]);
    });
    bus.on('AbilityReleased', function (p) {
      self.push('info', N(p.casterId) + ': PODER · RELEASE ' + A(p.abilityId) +
        ' · GCD ' + p.gcd.toFixed(2), [p.casterId, p.targetId]);
    });
    bus.on('AbilityQueued', function (p) {
      self.push('info', N(p.casterId) + ': QUEUE ' + A(p.abilityId) + ' [' + p.kind + ']', [p.casterId]);
    });
    bus.on('AbilityQueueReplaced', function (p) {
      self.push('info', N(p.casterId) + ': QUEUE reemplaza ' + A(p.oldAbilityId) + ' → ' + A(p.abilityId), [p.casterId]);
    });

    bus.on('AbilityCastInterrupted', function (p) {
      var why = { moved:'al moverse', movement:'al moverse', jump:'al saltar', manual:'cancelado manualmente', rotation:'al girar el cuerpo', cc:'por control', cancelled:'cancelado' }[p.reason] || 'interrumpido';
      var lock = p.lockout > 0 ? ' · escuela "' + p.school + '" bloqueada ' + p.lockout.toFixed(1) + ' s' : '';
      self.push('counter', N(p.casterId) + ': ' + A(p.abilityId) + ' ' + why + lock,
        [p.casterId, p.sourceId]);
    });

    bus.on('AbilityFizzled', function (p) {
      var why = { range: 'fuera de rango', los: 'sin línea de visión', untargetable: 'objetivo no válido' }[p.reason];
      self.push('reject', N(p.casterId) + ': ' + A(p.abilityId) + ' se disipa (' + why + ')', [p.casterId]);
    });

    bus.on('AbilityNullified', function (p) {
      var why = p.reason === 'stasis' ? 'el objetivo está en estasis' : 'Intervención lo anula';
      self.push('counter', A(p.abilityId) + ' de ' + N(p.casterId) + ' no surte efecto: ' + why,
        [p.casterId, p.targetId]);
    });

    bus.on('AbilityBlocked', function (p) {
      self.push('counter', N(p.targetId) + ' BLOQUEA ' + A(p.abilityId) + ' de ' + N(p.casterId),
        [p.casterId, p.targetId]);
    });

    bus.on('AbilityReflected', function (p) {
      self.push('counter', N(p.targetId) + ' REFLEJA ' + A(p.abilityId) + ' contra ' + N(p.casterId),
        [p.casterId, p.targetId]);
    });

    bus.on('EffectImmune', function (p) {
      var why = p.reason === 'dr' ? 'rendimientos decrecientes' : 'inmunidad';
      var d = EFF[p.effect];
      self.push('counter', N(p.targetId) + ' es inmune a ' + (d ? d.name : p.effect) + ' (' + why + ')',
        [p.sourceId, p.targetId]);
    });

    bus.on('EffectBlocked', function (p) {
      self.push('counter', N(p.targetId) + ': Velo nulo bloquea ' +
        (p.effect === 'cleanse' ? 'una purificación' : (EFF[p.effect] ? EFF[p.effect].name : p.effect)),
        [p.sourceId, p.targetId]);
    });

    bus.on('HealBlocked', function (p) {
      if (p.reason !== 'antiBuff') return;
      self.push('counter', N(p.targetId) + ': Velo nulo bloquea la curación entrante',
        [p.sourceId, p.targetId]);
    });

    bus.on('Cleansed', function (p) {
      self.push('counter', N(p.sourceId) + ' limpia [' + p.effects.join(', ') + '] de ' + N(p.targetId),
        [p.sourceId, p.targetId]);
    });

    bus.on('Purged', function (p) {
      self.push('counter', N(p.sourceId) + ' purga [' + p.effects.join(', ') + '] de ' + N(p.targetId),
        [p.sourceId, p.targetId]);
    });

    bus.on('EntityDied', function (p) {
      self.push('death', N(p.entityId) + ' ha caído' +
        (p.killerId ? ' · último golpe de ' + N(p.killerId) : ''), [p.entityId, p.killerId]);
    });

    bus.on('ZoneTriggered', function (p) {
      self.push('cc', N(p.targetId) + ' activa una trampa de ' + N(p.ownerId), [p.ownerId, p.targetId]);
    });

    bus.on('AbilityRejected', function (p) {
      if (p.casterId !== self.playerId) return;
      self.push('reject', A(p.abilityId) + ': ' + p.message, [p.casterId]);
    });

    bus.on('WorldReset', function () {
      self.entries.length = 0;
      self.lines.innerHTML = '';
      self.push('info', '— laboratorio reiniciado —', []);
    });
  };

  CombatLog.prototype.toText = function () {
    var out = [];
    for (var i = 0; i < this.entries.length; i++) {
      out.push(this.entries[i].t.toFixed(2).padStart(8) + '  ' + this.entries[i].text);
    }
    return out.join('\n');
  };

  CombatLog.prototype.copyToClipboard = function (btn) {
    var text = this.toText();
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'Copiado';
      setTimeout(function () { btn.textContent = old; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { console.log(text); done(); });
    } else {
      console.log(text);
      done();
    }
  };

  Arena.UI.CombatLog = CombatLog;
});
