/* =============================================================================
 * ui/hud.js — Marcos de unidad, barra de acción, nameplates y texto flotante.
 *
 * El HUD es un espejo: lee la simulación cada fotograma y refleja su estado.
 * Nunca decide nada ni escribe en el mundo. Cualquier acción del jugador pasa
 * por main.js → Arena.Combat.AbilitySystem, igual que la de un bot.
 * ========================================================================== */
Arena.define('ui/hud', ['render/picking', 'data/passives', 'ui/abilityIcons', 'ui/actionBarState', 'ui/powerBook'], function (Arena) {
  'use strict';

  var V = Arena.Math.Vec3;
  var B = Arena.Data.balance;
  var EFF = Arena.Data.effects;
  var Picking = Arena.Render.Picking;
  var Ability = Arena.Combat.AbilitySystem;

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  function makeBar(parent, cls) {
    var bar = el('div', 'bar ' + (cls || ''), parent);
    var ghost = el('div', 'ghost', bar);
    var fill = el('div', 'fill', bar);
    var shield = el('div', 'shield', bar);
    var label = el('div', 'label', bar);
    return { root: bar, fill: fill, ghost: ghost, shield: shield, label: label, _ghostAt: 0, _ghostPct: 0 };
  }

  function setBar(bar, pct, now, text, shieldPct) {
    pct = Math.max(0, Math.min(1, pct));
    // La estela sólo baja: si el valor sube, se iguala al instante.
    if (pct > bar._ghostPct) bar._ghostPct = pct;
    else if (now - bar._ghostAt > 0.28) bar._ghostPct += (pct - bar._ghostPct) * 0.22;
    if (pct < bar._ghostPct - 0.001) bar._ghostAt = now;

    bar.fill.style.width = (pct * 100).toFixed(2) + '%';
    bar.ghost.style.width = (Math.max(pct, bar._ghostPct) * 100).toFixed(2) + '%';
    if (bar.shield) {
      var sp = Math.max(0, Math.min(1 - pct, shieldPct || 0));
      bar.shield.style.left = (pct * 100).toFixed(2) + '%';
      bar.shield.style.width = (sp * 100).toFixed(2) + '%';
      bar.shield.style.display = sp > 0.001 ? 'block' : 'none';
    }
    if (text !== undefined) bar.label.textContent = text;
  }

  /* =========================================================================
   * HUD
   * ====================================================================== */
  function HUD(root, world, renderer) {
    this.root = root;
    this.world = world;
    this.renderer = renderer;
    this.playerId = null;
    this.floaters = [];
    this.nameplates = Object.create(null);
    this._errorTimer = 0;
    this.actionState = new Arena.UI.ActionBarState.State('devastador');
    this._build();
    this._subscribe();
  }

  HUD.prototype._build = function () {
    var r = this.root;

    /* --- Marco del jugador ---------------------------------------------- */
    var pf = el('div', 'unit-frame', r); pf.id = 'player-frame';
    var ph = el('div', 'uf-head', pf);
    this.pName = el('div', 'uf-name', ph);
    this.pClass = el('div', 'uf-class', ph);
    this.pHp = makeBar(pf, 'uf-hp');
    this.pRes = makeBar(pf, 'uf-res');
    this.pCharges = el('div', 'charges', pf);
    this.pStatuses = el('div', 'statuses', pf);

    /* --- Marco del objetivo ---------------------------------------------- */
    var tf = el('div', 'unit-frame hidden', r); tf.id = 'target-frame';
    var th = el('div', 'uf-head', tf);
    this.tName = el('div', 'uf-name', th);
    this.tClass = el('div', 'uf-class', th);
    this.tDist = el('div', 'uf-dist', th);
    this.tHp = makeBar(tf, 'uf-hp');
    this.tCast = makeBar(tf, 'cast-bar');
    this.tStatuses = el('div', 'statuses', tf);
    this.targetFrame = tf;

    /* --- Barra de casteo del jugador -------------------------------------- */
    var pc = el('div', 'bar', r); pc.id = 'player-cast';
    this.castFill = el('div', 'fill', pc);
    this.castLabel = el('div', 'label', pc);
    this.playerCast = pc;

    /* --- Barra de acción: 4 páginas × 12 slots --------------------------- */
    var ab = el('div', '', r); ab.id = 'action-bar';
    var tools = el('div', 'actionbar-tools', ab);
    this.barTabs = [];
    var selfHud = this;
    for (var bi = 0; bi < Arena.UI.ActionBarState.BAR_COUNT; bi++) {
      var tab = el('button', 'bar-tab', tools); tab.type = 'button'; tab.textContent = String(bi + 1);
      tab.dataset.bar = String(bi);
      tab.addEventListener('click', (function (idx) { return function (e) { e.stopPropagation(); selfHud.selectBar(idx); }; })(bi));
      this.barTabs.push(tab);
    }
    this.bookBtn = el('button', 'power-book-button', tools); this.bookBtn.type = 'button';
    this.bookBtn.innerHTML = '<span>✦</span> Libro de poderes <kbd>B</kbd>';
    this.bookBtn.addEventListener('click', function (e) { e.stopPropagation(); selfHud.togglePowerBook(); });
    var resetBtn = el('button', 'bar-reset', tools); resetBtn.type='button'; resetBtn.textContent='Restaurar barras';
    resetBtn.addEventListener('click', function(e){e.stopPropagation();selfHud.actionState.reset();selfHud._renderActionBar();});

    var row = el('div', 'actionbar-row', ab);
    var keys = ['1','2','3','4','5','6','7','8','9','0','−','='];
    this.slots = [];
    for (var i = 0; i < Arena.UI.ActionBarState.SLOT_COUNT; i++) {
      var s = el('div', 'slot', row); s.draggable = true;
      var key = el('div', 'key', s); key.textContent = keys[i];
      var icon = el('div', 'icon', s);
      var sweep = el('div', 'cd-sweep', s);
      var cdText = el('div', 'cd-text', s);
      var gcd = el('div', 'gcd', s);
      var slot = { root: s, icon: icon, sweep: sweep, cdText: cdText, gcd: gcd, index: i, abilityId: null };
      this.slots.push(slot);
      s.addEventListener('dragover', function(e){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; this.classList.add('drag-over'); });
      s.addEventListener('dragleave', function(){ this.classList.remove('drag-over'); });
      s.addEventListener('drop', (function(sl){ return function(e){
        e.preventDefault(); sl.root.classList.remove('drag-over');
        var id=e.dataTransfer.getData('application/x-arena-ability')||e.dataTransfer.getData('text/plain');
        if(selfHud.actionState.assign(sl.index,id)) selfHud._renderActionBar();
      };})(slot));
      s.addEventListener('dragstart', (function(sl){ return function(e){
        if(!sl.abilityId){e.preventDefault();return;} e.dataTransfer.effectAllowed='copy';
        e.dataTransfer.setData('application/x-arena-ability',sl.abilityId);e.dataTransfer.setData('text/plain',sl.abilityId);
      };})(slot));
      s.addEventListener('contextmenu', (function(sl){ return function(e){e.preventDefault();selfHud.actionState.clear(sl.index);selfHud._renderActionBar();};})(slot));
    }
    var aa = el('div', '', row); aa.id = 'autoattack-toggle';
    aa.innerHTML = '<div>⚔</div><div class="lbl">T</div>';
    this.autoBtn = aa;
    this.actionBar = ab;
    this.powerBook = new Arena.UI.PowerBook(r);
    this.selectBar(0);

    /* --- Capa 3D: nameplates y texto flotante ----------------------------- */
    this.overlay = el('div', '', r); this.overlay.id = 'overlay-3d';

    /* --- Aviso de acción rechazada ---------------------------------------- */
    this.errorEl = el('div', '', r); this.errorEl.id = 'action-error';
  };

  /* =========================================================================
   * Eventos → texto flotante y avisos
   * ====================================================================== */
  HUD.prototype._subscribe = function () {
    var self = this;
    var bus = this.world.bus;

    bus.on('DamageApplied', function (p) {
      if (p.applied > 0.5) {
        var cls = p.crit ? 'crit' : (p.applied > 130 ? 'damage-big' : 'damage');
        self.floatNumber(p.targetId, p.applied, cls, '−');
      } else if (p.absorbed > 0.5) {
        self.floatNumber(p.targetId, p.absorbed, 'absorb', '◈');
      }
    });
    bus.on('HealApplied', function (p) {
      if (p.applied > 0.5) self.floatNumber(p.targetId, p.applied, 'heal', '+');
    });
    bus.on('DamageImmune', function (p) { self.float(p.targetId, 'INMUNE', 'immune'); });
    bus.on('AbilityBlocked', function (p) { self.float(p.targetId, 'BLOQUEADO', 'immune'); });
    bus.on('AbilityReflected', function (p) { self.float(p.targetId, 'REFLEJADO', 'immune'); });
    bus.on('AbilityNullified', function (p) {
      self.float(p.targetId, p.reason === 'stasis' ? 'ESTASIS' : 'INTERVENCIÓN', 'immune');
    });
    bus.on('EffectImmune', function (p) {
      if (p.reason === 'dr') self.float(p.targetId, 'INMUNE (DR)', 'immune');
    });
    bus.on('EffectBlocked', function (p) { self.float(p.targetId, 'BLOQUEADO', 'immune'); });
    bus.on('HealBlocked', function (p) {
      if (p.reason === 'antiBuff') self.float(p.targetId, 'VELO NULO', 'immune');
    });

    bus.on('AbilityRejected', function (p) {
      if (p.casterId !== self.playerId) return;
      self.showError(p.message);
    });
  };

  HUD.prototype.showError = function (msg) {
    this.errorEl.textContent = msg;
    this.errorEl.classList.add('show');
    this._errorTimer = 1.1;
  };

  /**
   * Texto flotante con agregación.
   *
   * En un burst llegan cinco números en menos de medio segundo y apilarlos
   * produce una nube ilegible. Los golpes del mismo tipo sobre el mismo
   * objetivo dentro de una ventana corta se acumulan en un solo número que
   * crece, que además comunica mejor "me están reventando".
   */
  HUD.prototype.floatNumber = function (entityId, amount, cls, prefix) {
    var key = entityId + '|' + cls;
    if (!this._agg) this._agg = Object.create(null);
    var live = this._agg[key];
    if (live && live.life < 0.42 && this.floaters.indexOf(live) >= 0) {
      live.amount += amount;
      live.node.textContent = prefix + Math.round(live.amount);
      live.life = Math.min(live.life, 0.18);   // reinicia el desvanecido
      return;
    }
    var f = this.float(entityId, prefix + Math.round(amount), cls);
    if (f) { f.amount = amount; this._agg[key] = f; }
  };

  HUD.prototype.float = function (entityId, text, cls) {
    var e = this.world.getEntity(entityId);
    if (!e) return null;
    var node = el('div', 'float-text ' + cls, this.overlay);
    node.textContent = text;

    // Colocación en abanico alterno. Con posición aleatoria, dos números casi
    // simultáneos se solapan y quedan ilegibles justo cuando más importan.
    if (!this._fanIndex) this._fanIndex = Object.create(null);
    var n = (this._fanIndex[entityId] || 0);
    this._fanIndex[entityId] = (n + 1) % 6;
    var side = (n % 2 === 0) ? 1 : -1;
    var tier = Math.floor(n / 2);

    var f = {
      node: node, entityId: entityId, life: 0, maxLife: 1.25,
      x: side * (16 + tier * 26),
      y: -tier * 13, vy: -52 - tier * 6,
      baseY: e.height * 0.88, amount: 0
    };
    this.floaters.push(f);
    // Techo de seguridad: un AoE sobre 8 objetivos no debe inundar el DOM.
    if (this.floaters.length > 34) {
      var old = this.floaters.shift();
      if (old.node.parentNode) old.node.parentNode.removeChild(old.node);
    }
    return f;
  };

  /* =========================================================================
   * Actualización por fotograma
   * ====================================================================== */
  HUD.prototype.update = function (dt, alpha) {
    var world = this.world;
    var player = world.getEntity(this.playerId);
    var now = world.time;

    if (this._errorTimer > 0) {
      this._errorTimer -= dt;
      if (this._errorTimer <= 0) this.errorEl.classList.remove('show');
    }

    if (player) {
      this._updatePlayerFrame(player, now);
      this._updateTargetFrame(player, now);
      this._updateActionBar(player, now);
    }
    this._updateNameplates(alpha);
    this._updateFloaters(dt, alpha);
  };

  HUD.prototype._updatePlayerFrame = function (p, now) {
    var cls = Arena.Data.classes[p.classId];
    this.pName.textContent = p.name;
    this.pClass.textContent = cls ? cls.role : '';

    setBar(this.pHp, p.hpPct(), now,
      Math.round(p.hp) + ' / ' + Math.round(p.effectiveHpMax ? p.effectiveHpMax() : p.hpMax),
      p.totalBarrier() / (p.effectiveHpMax ? p.effectiveHpMax() : p.hpMax));

    var res = B.RESOURCE[p.resourceType];
    this.pRes.root.className = 'bar uf-res ' + p.resourceType;
    setBar(this.pRes, p.resourcePct(), now,
      (res ? res.name + '  ' : '') + Math.round(p.resource) + ' / ' + p.resourceMax);

    this._updateCharges(p);
    this._updateStatusRow(this.pStatuses, p, now);

    if (p.cast) {
      var prog = (now - p.cast.startTime) / Math.max(p.cast.duration, 1e-3);
      this.playerCast.classList.add('active');
      this.castFill.style.width = (Math.min(1, prog) * 100).toFixed(1) + '%';
      var ab = Arena.Data.abilities[p.cast.abilityId];
      this.castLabel.textContent = (ab ? ab.name : p.cast.abilityId) + '   ' +
        Math.max(0, p.cast.endTime - now).toFixed(1) + ' s';
    } else {
      this.playerCast.classList.remove('active');
    }
  };

  HUD.prototype._updateCharges = function (p) {
    var info = Arena.Data.passives.chargeKeyFor(p);
    if (!info) { this.pCharges.style.display = 'none'; return; }
    this.pCharges.style.display = 'flex';

    if (this.pCharges._key !== info.key) {
      this.pCharges.innerHTML = '';
      var lbl = el('div', 'cl', this.pCharges);
      lbl.textContent = info.label;
      this.pCharges._pips = [];
      for (var i = 0; i < info.max; i++) this.pCharges._pips.push(el('div', 'pip', this.pCharges));
      this.pCharges._key = info.key;
    }
    var n = p.charges[info.key] || 0;
    for (var j = 0; j < this.pCharges._pips.length; j++) {
      this.pCharges._pips[j].className = 'pip' + (j < n ? ' on' : '');
    }
  };

  HUD.prototype._updateTargetFrame = function (player, now) {
    var t = this.world.getEntity(player.targetId);
    if (!t || !t.alive) {
      this.targetFrame.classList.add('hidden');
      return;
    }
    this.targetFrame.classList.remove('hidden');
    var hostile = this.world.areHostile(player, t);
    this.targetFrame.classList.toggle('hostile', hostile);

    var cls = Arena.Data.classes[t.classId];
    this.tName.textContent = t.name;
    this.tClass.textContent = cls ? cls.role : '';

    var dist = V.distXZ(player.pos, t.pos);
    this.tDist.textContent = dist.toFixed(1) + ' u';
    this.tDist.classList.toggle('out-of-range', dist > 26);

    setBar(this.tHp, t.hpPct(), now,
      Math.round(t.hp) + ' / ' + Math.round(t.effectiveHpMax ? t.effectiveHpMax() : t.hpMax),
      t.totalBarrier() / (t.effectiveHpMax ? t.effectiveHpMax() : t.hpMax));

    if (t.cast) {
      var prog = (now - t.cast.startTime) / Math.max(t.cast.duration, 1e-3);
      this.tCast.root.classList.add('active', 'cast-bar');
      this.tCast.root.classList.toggle('uninterruptible', !t.cast.interruptible);
      this.tCast.fill.style.width = (Math.min(1, prog) * 100).toFixed(1) + '%';
      var ab = Arena.Data.abilities[t.cast.abilityId];
      this.tCast.label.innerHTML = '<span>' + (ab ? ab.name : '') + '</span><span>' +
        Math.max(0, t.cast.endTime - now).toFixed(1) + '</span>';
    } else {
      this.tCast.root.classList.remove('active');
    }

    this._updateStatusRow(this.tStatuses, t, now);
  };

  HUD.prototype._updateStatusRow = function (container, entity, now) {
    // Reconstruir sólo cuando cambia la composición: tocar el DOM cada
    // fotograma con 12 iconos cuesta más que todo el render 3D.
    var sig = '';
    for (var i = 0; i < entity.statuses.length; i++) sig += entity.statuses[i].id + ',';
    if (container._sig !== sig) {
      container.innerHTML = '';
      container._nodes = [];
      for (var j = 0; j < entity.statuses.length; j++) {
        var st = entity.statuses[j];
        var d = EFF[st.defId];
        if (!d) continue;
        var node = el('div', 'status-icon ' + d.kind, container);
        node.textContent = d.icon || '•';
        node.style.color = d.color || '#fff';
        node.title = d.name + ' — ' + d.desc;
        var sweep = el('div', 'sweep', node);
        var secs = el('div', 'secs', node);
        container._nodes.push({ st: st, node: node, sweep: sweep, secs: secs });
      }
      container._sig = sig;
    }
    var nodes = container._nodes || [];
    for (var k = 0; k < nodes.length; k++) {
      var s = nodes[k].st;
      var remain = Math.max(0, s.endTime - now);
      var frac = s.duration > 0 ? remain / s.duration : 1;
      nodes[k].sweep.style.height = ((1 - frac) * 100).toFixed(1) + '%';
      nodes[k].secs.textContent = remain >= 1 ? Math.ceil(remain) : (remain > 0 ? remain.toFixed(1) : '');
    }
  };

  HUD.prototype._renderActionBar = function () {
    for (var i = 0; i < this.slots.length; i++) {
      var id = this.actionState.abilityAt(i);
      var ab = id ? Arena.Data.abilities[id] : null;
      this.slots[i].abilityId = id || null;
      this.slots[i].icon.innerHTML = ab ? Arena.UI.AbilityIcons.svg(ab) : '';
      this.slots[i].root.classList.toggle('empty', !ab);
      this.slots[i].root.setAttribute('aria-label', ab ? ab.name : 'Slot vacío');
    }
    for (var b=0;b<this.barTabs.length;b++) this.barTabs[b].classList.toggle('active', b===this.actionState.activeBar);
  };

  HUD.prototype.setAbilities = function (player) {
    this.actionState.setClass(player.classId);
    if (this.powerBook) this.powerBook.setClass(player.classId);
    this._renderActionBar();
  };

  HUD.prototype.selectBar = function (index) {
    this.actionState.selectBar(index);
    if (this.slots) this._renderActionBar();
  };

  HUD.prototype.getActiveAbilityId = function (slotIndex) { return this.actionState.abilityAt(slotIndex); };
  HUD.prototype.togglePowerBook = function () { if (this.powerBook) this.powerBook.toggle(); };
  HUD.prototype.closePowerBook = function () { if (this.powerBook && this.powerBook.isOpen()) { this.powerBook.hide(); return true; } return false; };

  HUD.prototype._updateActionBar = function (p, now) {
    var world = this.world;
    var target = world.getEntity(p.targetId);
    var gcdLeft = p.gcdRemaining(now);

    for (var i = 0; i < this.slots.length; i++) {
      var slot = this.slots[i];
      var ab = slot.abilityId ? Arena.Data.abilities[slot.abilityId] : null;
      if (!ab) continue;

      var cdLeft = p.cooldownRemaining(ab.id, now);
      var cdFrac = ab.cooldown > 0 ? Math.min(1, cdLeft / ab.cooldown) : 0;
      slot.sweep.style.height = (cdFrac * 100).toFixed(1) + '%';
      slot.cdText.textContent = cdLeft > 0
        ? (cdLeft >= 10 ? Math.ceil(cdLeft) : cdLeft.toFixed(1))
        : '';

      slot.gcd.style.transform = 'scaleX(' +
        (gcdLeft > 0 && p.gcdDuration > 0 ? (gcdLeft / p.gcdDuration).toFixed(3) : 0) + ')';

      // El estado del botón explica POR QUÉ no se puede usar, no sólo que no.
      var check = Ability.canUse(world, p, ab, { targetId: p.targetId, target: target });
      var c = slot.root.classList;
      c.toggle('unusable', !check.ok && check.reason !== 'gcd');
      c.toggle('no-resource', check.reason === 'resource');
      c.toggle('out-of-range', check.reason === 'range' || check.reason === 'los');
      c.toggle('ready', check.ok);
      c.toggle('queued', !!(p.queued && p.queued.abilityId === ab.id));
    }
    this.autoBtn.classList.toggle('on', p.autoAttackOn);
  };

  /* =========================================================================
   * Nameplates
   * ====================================================================== */
  HUD.prototype._updateNameplates = function (alpha) {
    var world = this.world;
    var cam = this.renderer.camera;
    var canvas = this.renderer.canvas;
    var player = world.getEntity(this.playerId);
    var now = world.time;
    var seen = Object.create(null);

    for (var i = 0; i < world.entities.length; i++) {
      var e = world.entities[i];
      if (!e.alive) continue;
      if (e.id === this.playerId) continue;
      var hostile = player ? world.areHostile(player, e) : false;
      if (hostile && e.mods().stealthed && !e.hasStatus('revealed')) continue;

      var pos = V.lerp(V.create(), e.prevPos, e.pos, alpha);
      var jumpY = (e.prevJumpOffset || 0) + ((e.jumpOffset || 0) - (e.prevJumpOffset || 0)) * alpha;
      var screen = Picking.worldToScreen(cam, canvas, {
        x: pos.x, y: pos.y + jumpY + e.height + 0.42, z: pos.z
      });
      if (!screen || screen.depth > 1) continue;

      seen[e.id] = true;
      var np = this.nameplates[e.id];
      if (!np) np = this.nameplates[e.id] = this._makeNameplate(e);

      np.root.style.transform = 'translate(-50%,-100%) translate(' +
        screen.x.toFixed(1) + 'px,' + screen.y.toFixed(1) + 'px)';
      np.root.style.display = 'block';
      np.root.className = 'nameplate ' + (hostile ? 'hostile' : 'friendly') +
        (e.id === (player && player.targetId) ? ' selected' : '');

      np.hp.style.width = (e.hpPct() * 100).toFixed(1) + '%';

      if (e.cast) {
        var prog = (now - e.cast.startTime) / Math.max(e.cast.duration, 1e-3);
        np.cast.parentNode.classList.add('active');
        np.cast.style.width = (Math.min(1, prog) * 100).toFixed(1) + '%';
      } else {
        np.cast.parentNode.classList.remove('active');
      }

      // Etiqueta de control: es la información que decide si atacas o esperas.
      np.cc.textContent = this._ccLabel(e);
    }

    for (var id in this.nameplates) {
      if (!seen[id]) {
        this.nameplates[id].root.style.display = 'none';
        if (!world.getEntity(id)) {
          this.overlay.removeChild(this.nameplates[id].root);
          delete this.nameplates[id];
        }
      }
    }
  };

  HUD.prototype._ccLabel = function (e) {
    var priority = ['stasis', 'knockdown', 'stun', 'sourceDaze', 'silence', 'root', 'noAttack', 'disarm', 'utilityLock', 'antiBuff'];
    for (var i = 0; i < priority.length; i++) {
      if (e.hasStatus(priority[i])) return EFF[priority[i]].name;
    }
    if (e.hasStatus('intervention')) return 'Intervención';
    if (e.hasStatus('reflect')) return 'Reflejo';
    if (e.hasStatus('block')) return 'Bloqueo';
    return '';
  };

  HUD.prototype._makeNameplate = function (e) {
    var root = el('div', 'nameplate', this.overlay);
    var name = el('div', 'np-name', root);
    name.textContent = e.name;
    var hpBar = el('div', 'bar np-hp', root);
    var hp = el('div', 'fill', hpBar);
    var castBar = el('div', 'bar np-cast', root);
    var cast = el('div', 'fill', castBar);
    var cc = el('div', 'np-cc', root);
    return { root: root, name: name, hp: hp, cast: cast, cc: cc };
  };

  /* =========================================================================
   * Texto flotante
   * ====================================================================== */
  HUD.prototype._updateFloaters = function (dt, alpha) {
    var cam = this.renderer.camera;
    var canvas = this.renderer.canvas;

    for (var i = this.floaters.length - 1; i >= 0; i--) {
      var f = this.floaters[i];
      f.life += dt;
      if (f.life >= f.maxLife) {
        if (f.node.parentNode) f.node.parentNode.removeChild(f.node);
        this.floaters.splice(i, 1);
        continue;
      }
      f.y += f.vy * dt;
      f.vy += 52 * dt;                  // arco: sube y se frena

      var e = this.world.getEntity(f.entityId);
      if (!e) { f.node.style.opacity = '0'; continue; }
      var pos = V.lerp(V.create(), e.prevPos, e.pos, alpha);
      var screen = Picking.worldToScreen(cam, canvas, {
        x: pos.x, y: pos.y + f.baseY, z: pos.z
      });
      if (!screen) { f.node.style.display = 'none'; continue; }

      f.node.style.display = 'block';
      f.node.style.transform = 'translate(-50%,-50%) translate(' +
        (screen.x + f.x).toFixed(1) + 'px,' + (screen.y + f.y).toFixed(1) + 'px)';
      var t = f.life / f.maxLife;
      f.node.style.opacity = t < 0.72 ? '1' : String(1 - (t - 0.72) / 0.28);
    }
  };

  HUD.prototype.setPlayer = function (entity) {
    this.playerId = entity.id;
    this.setAbilities(entity);
  };

  HUD.prototype.clearFloaters = function () {
    for (var i = 0; i < this.floaters.length; i++) {
      var n = this.floaters[i].node;
      if (n.parentNode) n.parentNode.removeChild(n);
    }
    this.floaters.length = 0;
  };

  Arena.UI.HUD = HUD;
  Arena.UI.makeBar = makeBar;
  Arena.UI.setBar = setBar;
  Arena.UI.el = el;
});
