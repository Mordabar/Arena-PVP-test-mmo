/* =============================================================================
 * ui/gameShell.js — Lobby, match chrome y results del Vertical Slice.
 *
 * Capa puramente de producto/presentación. No muta HP, cooldowns, posiciones ni
 * resultados. Emite intención mediante callbacks que consume main.js.
 * ========================================================================== */
Arena.define('ui/gameShell', ['ui/abilityIcons', 'product/matchFlow'], function (Arena) {
  'use strict';

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>\"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];}); }
  function pct(n) { return Math.max(0, Math.min(100, n * 100)); }
  function secs(v) { var m=Math.floor(v/60), s=Math.floor(v%60); return m+':'+String(s).padStart(2,'0'); }

  function uiSound(name) {
    var sounds = Arena.Audio && Arena.Audio.sounds;
    if (sounds && typeof sounds[name] === 'function') sounds[name]();
  }

  function GameShell(opts) {
    opts = opts || {};
    this.ctx = opts;
    this.world = opts.world;
    this.flow = opts.flow;
    this.selectedClass = opts.classId || 'devastador';
    this.selectedMode = '1v1';
    this._view = '';
    this._lastResult = null;
    this.root = el('div', 'arena-shell', document.body);
    this._build();
    this.renderLobby();
  }

  GameShell.prototype._build = function () {
    var self = this;

    /* PRODUCT TOP BAR */
    var top = el('div', 'arena-topbar', this.root);
    top.innerHTML = '<div class="arena-logo"><span class="logo-mark">A</span><span><b>PROJECT ARENA</b><small>LADDER PvP · ALPHA 0.8</small></span></div>' +
      '<div class="arena-top-actions"><button class="ghost-btn" data-action="lab">COMBAT LAB</button><button class="ghost-btn" data-action="lobby">LOBBY</button></div>';
    top.querySelector('[data-action="lab"]').onclick = function(){ uiSound('uiConfirm'); if (self.ctx.onTraining) self.ctx.onTraining(); };
    top.querySelector('[data-action="lobby"]').onclick = function(){ uiSound('uiConfirm'); if (self.ctx.onLobby) self.ctx.onLobby(); };
    this.topbar = top;

    /* LOBBY */
    var lobby = el('section', 'arena-screen arena-lobby', this.root);
    lobby.innerHTML = '<div class="lobby-vignette"></div><div class="lobby-grid">' +
      '<div class="lobby-main"><div class="eyebrow">ELIGE TU ROL</div><h1>Domina el ritmo.<br><span>Gana el duelo.</span></h1><p class="lobby-lead">Combate target-based donde parar, orientar, leer el RELEASE y decidir cuándo comprometerte importa más que vaciar la barra de habilidades.</p>' +
      '<div class="class-grid" data-slot="classes"></div></div>' +
      '<aside class="lobby-side"><div class="selected-card" data-slot="selected"></div><div class="ladder-card" data-slot="ladder"></div><div class="queue-card"><div class="section-label">FORMATO</div><div class="mode-pills"><button data-mode="1v1" class="active"><b>1v1</b><small>Duelo Ladder</small></button><button data-mode="2v2"><b>2v2</b><small>Skirmish</small></button></div><button class="primary-queue" data-action="start"><span>ENTRAR A LA ARENA</span><small>partida local · bots autoritativos</small></button><button class="training-link" data-action="training">Abrir Timing / Training Lab</button></div></aside>' +
      '</div>';
    this.lobby = lobby;
    this.classGrid = lobby.querySelector('[data-slot="classes"]');
    this.selectedCard = lobby.querySelector('[data-slot="selected"]');
    this.ladderCard = lobby.querySelector('[data-slot="ladder"]');
    var modeButtons = lobby.querySelectorAll('[data-mode]');
    for (var mi=0; mi<modeButtons.length; mi++) modeButtons[mi].onclick = function(){
      uiSound('uiSelect');
      self.selectedMode = this.dataset.mode;
      for (var j=0;j<modeButtons.length;j++) modeButtons[j].classList.toggle('active', modeButtons[j]===this);
    };
    lobby.querySelector('[data-action="start"]').onclick = function(){ uiSound('uiConfirm'); if(self.ctx.onStart) self.ctx.onStart(self.selectedMode, self.selectedClass); };
    lobby.querySelector('[data-action="training"]').onclick = function(){ uiSound('uiConfirm'); if(self.ctx.onTraining) self.ctx.onTraining(); };

    /* MATCH CHROME */
    var chrome = el('div', 'arena-match-chrome hidden', this.root);
    chrome.innerHTML = '<div class="match-header"><div class="team-score team-a"><span>VANGUARDIA</span><b>0</b></div><div class="match-core"><small data-slot="mode">DUELO LADDER</small><strong data-slot="clock">0:00</strong><span data-slot="phase">ROUND 1</span></div><div class="team-score team-b"><b>0</b><span>OPONENTES</span></div></div>' +
      '<div class="team-panel team-left" data-slot="team0"></div><div class="team-panel team-right" data-slot="team1"></div>' +
      '<div class="countdown-overlay"><small>PREPÁRATE</small><b data-slot="countdown">3</b><span>Lee rango · LoS · facing</span></div>';
    this.matchChrome = chrome;
    this.matchMode = chrome.querySelector('[data-slot="mode"]');
    this.matchClock = chrome.querySelector('[data-slot="clock"]');
    this.matchPhase = chrome.querySelector('[data-slot="phase"]');
    this.countdownOverlay = chrome.querySelector('.countdown-overlay');
    this.countdownValue = chrome.querySelector('[data-slot="countdown"]');
    this.team0 = chrome.querySelector('[data-slot="team0"]');
    this.team1 = chrome.querySelector('[data-slot="team1"]');

    /* RESULTS */
    var results = el('section', 'arena-screen arena-results hidden', this.root);
    results.innerHTML = '<div class="results-panel"><div class="result-kicker" data-slot="kicker">MATCH COMPLETE</div><h2 data-slot="title">VICTORIA</h2><p data-slot="sub">Controlaste el ritmo.</p><div class="result-rating"><span data-slot="rank">ÉTER</span><strong data-slot="rating">1000</strong><em data-slot="delta">+18</em></div><div class="result-stats" data-slot="stats"></div><div class="result-actions"><button class="primary-queue" data-action="rematch">REVANCHA</button><button class="ghost-btn" data-action="return">VOLVER AL LOBBY</button></div></div>';
    results.querySelector('[data-action="rematch"]').onclick = function(){ uiSound('uiConfirm'); if(self.ctx.onRematch) self.ctx.onRematch(); };
    results.querySelector('[data-action="return"]').onclick = function(){ uiSound('uiConfirm'); if(self.ctx.onLobby) self.ctx.onLobby(); };
    this.results = results;
    this.resultTitle = results.querySelector('[data-slot="title"]');
    this.resultSub = results.querySelector('[data-slot="sub"]');
    this.resultRank = results.querySelector('[data-slot="rank"]');
    this.resultRating = results.querySelector('[data-slot="rating"]');
    this.resultDelta = results.querySelector('[data-slot="delta"]');
    this.resultStats = results.querySelector('[data-slot="stats"]');
  };

  GameShell.prototype.renderLobby = function () {
    var self = this;
    this.classGrid.innerHTML = '';
    var ids = ['devastador','guardian','centinela','rastreador','arcanista','vinculador'];
    for (var i=0;i<ids.length;i++) {
      var c = Arena.Data.classes[ids[i]];
      var card = el('button', 'class-card' + (c.id===this.selectedClass?' active':''), this.classGrid);
      card.dataset.classId = c.id;
      card.innerHTML = '<span class="class-glyph">'+this._classGlyph(c.id)+'</span><span class="class-copy"><b>'+esc(c.name)+'</b><small>'+esc(c.role)+'</small></span><span class="class-arrow">›</span>';
      card.onclick = function(){ uiSound('uiSelect'); self.selectClass(this.dataset.classId); };
    }
    this._renderSelected();
    this._renderLadder();
  };

  GameShell.prototype._classGlyph = function (id) {
    return {devastador:'⚔',guardian:'⬡',centinela:'➶',rastreador:'⌖',arcanista:'✦',vinculador:'◈'}[id] || '◇';
  };

  GameShell.prototype.selectClass = function (id) {
    if (!Arena.Data.classes[id]) return;
    this.selectedClass = id;
    var cards = this.classGrid.querySelectorAll('.class-card');
    for(var i=0;i<cards.length;i++) cards[i].classList.toggle('active', cards[i].dataset.classId===id);
    this._renderSelected();
  };

  GameShell.prototype._renderSelected = function () {
    var c = Arena.Data.classes[this.selectedClass];
    var icons = '';
    for (var i=0;i<c.abilities.length;i++) {
      var ab = Arena.Data.abilities[c.abilities[i]];
      icons += '<div class="kit-icon" title="'+esc(ab.name)+'">'+Arena.UI.AbilityIcons.svg(ab)+'<span>'+esc(ab.name)+'</span></div>';
    }
    this.selectedCard.innerHTML = '<div class="selected-head"><span class="hero-glyph">'+this._classGlyph(c.id)+'</span><div><small>'+esc(c.archetype)+'</small><h3>'+esc(c.name)+'</h3></div></div><p>'+esc(c.identity)+'</p><div class="tagline">“'+esc(c.tagline)+'”</div><div class="kit-row">'+icons+'</div>';
  };

  GameShell.prototype._renderLadder = function () {
    var p = this.flow.profile;
    var rank = Arena.Product.Ladder.rankFor(p.rating);
    var placement = p.placementRemaining > 0 ? '<span class="placement">'+p.placementRemaining+' partidas de posicionamiento</span>' : '<span>'+p.wins+'V · '+p.losses+'D</span>';
    var recent = p.recent.length ? p.recent.slice(0,5).map(function(m){return '<i class="'+m.result+'" title="'+esc(m.mode)+' '+esc(m.opponent)+'">'+(m.result==='win'?'V':(m.result==='draw'?'E':'D'))+'</i>';}).join('') : '<small class="empty-recent">Sin partidas recientes</small>';
    this.ladderCard.innerHTML = '<div class="section-label">PERFIL LADDER</div><div class="rank-line"><span class="rank-sigil">'+rank.sigil+'</span><div><b>'+esc(rank.name)+'</b><small>'+placement+'</small></div><strong>'+p.rating+'</strong></div><div class="rank-track"><span style="width:'+Math.round(rank.progress*100)+'%"></span></div><div class="recent-line"><span>RECIENTES</span><div>'+recent+'</div></div>';
  };

  GameShell.prototype.showLobby = function () {
    this._view = 'LOBBY';
    this._lastResult = null;
    document.body.classList.add('arena-product-lobby');
    document.body.classList.remove('arena-product-results','arena-product-match');
    this.lobby.classList.remove('hidden');
    this.results.classList.add('hidden');
    this.matchChrome.classList.add('hidden');
    this.renderLobby();
  };

  GameShell.prototype.showMatch = function (state) {
    this._view = 'MATCH';
    this._lastResult = null;
    document.body.classList.remove('arena-product-lobby','arena-product-results');
    document.body.classList.add('arena-product-match');
    this.lobby.classList.add('hidden');
    this.results.classList.add('hidden');
    this.matchChrome.classList.remove('hidden');
    this.matchMode.textContent = state.mode === '2v2' ? 'SKIRMISH 2v2' : (state.mode==='training'?'COMBAT LAB':'DUELO LADDER');
    // El roster acaba de hacerse visible: recolocarlo en el primer frame, no al
    // cabo de doce, para que no aparezca pisando el marco del jugador.
    this._placeTick = 0;
    this._teamPanelTop = 0;
  };

  GameShell.prototype.showResults = function (result) {
    this._view = 'RESULTS';
    this._lastResult = result;
    document.body.classList.remove('arena-product-lobby','arena-product-match');
    document.body.classList.add('arena-product-results');
    this.lobby.classList.add('hidden');
    this.matchChrome.classList.add('hidden');
    this.results.classList.remove('hidden');
    this.resultTitle.textContent = result.draw ? 'EMPATE' : (result.won ? 'VICTORIA' : 'DERROTA');
    this.results.classList.toggle('lost', !result.won && !result.draw);
    this.resultSub.textContent = result.draw ? 'Doble caída: ninguna ventana quedó en pie.' : (result.won ? 'Tu equipo cerró la última ventana de presión.' : 'El rival convirtió mejor su ventana decisiva.');
    this.resultRank.textContent = result.rank.name.toUpperCase();
    this.resultRating.textContent = result.after;
    this.resultDelta.textContent = (result.delta>0?'+':'')+result.delta;
    this.resultDelta.className = result.delta >= 0 ? 'positive' : 'negative';
    var s = result.stats || {};
    this.resultStats.innerHTML = '<div><small>DURACIÓN</small><b>'+secs(result.duration||0)+'</b></div><div><small>DAÑO</small><b>'+Math.round(s.damage||0)+'</b></div><div><small>CURACIÓN</small><b>'+Math.round(s.healing||0)+'</b></div><div><small>INTERRUPTS</small><b>'+Math.round(s.interrupts||0)+'</b></div>';
  };

  GameShell.prototype.update = function (state) {
    if (!state) return;
    // Las pantallas estructurales sólo se reconstruyen al TRANSICIONAR.
    // El frame loop no debe recrear class cards/result stats 60 veces/segundo.
    if (state.phase === 'LOBBY') {
      if (this._view !== 'LOBBY') this.showLobby();
      return;
    }
    if (state.phase === 'RESULTS') {
      if (state.result && (this._view !== 'RESULTS' || this._lastResult !== state.result)) this.showResults(state.result);
      return;
    }
    if (this._view !== 'MATCH') this.showMatch(state);
    this.matchClock.textContent = secs(state.matchElapsed || 0);
    this.matchPhase.textContent = state.phase === 'COUNTDOWN' ? 'PREPARACIÓN' : 'COMBATE ACTIVO';
    var countdown = state.phase === 'COUNTDOWN';
    this.countdownOverlay.classList.toggle('show', countdown);
    if (countdown) this.countdownValue.textContent = Math.max(1, Math.ceil(state.countdown));
    this._updateTeams();
  };

  GameShell.prototype._updateTeams = function () {
    if (!this.world) return;
    var teams = [[],[]];
    for (var i=0;i<this.world.entities.length;i++) {
      var e=this.world.entities[i]; if(e.team===0||e.team===1) teams[e.team].push(e);
    }
    this._renderTeam(this.team0, teams[0], false);
    this._renderTeam(this.team1, teams[1], true);
    this._placeTeamPanels();
  };

  /* El marco del jugador crece con los estados activos: con seis debuffs la fila
     de iconos envuelve y el marco baja. Un `top` fijo para el roster funciona en
     la captura de un momento y se solapa en cuanto empieza el combate, así que
     el roster se cuelga del borde inferior real del marco. Es composición, no
     contenido: no lee ni decide nada de la simulación. */
  GameShell.prototype._placeTeamPanels = function () {
    /* Medir obliga a recalcular el layout. Cinco veces por segundo basta: el
       marco crece cuando entra o sale un estado, no dentro de un frame. */
    this._placeTick = (this._placeTick || 0) + 1;
    if (this._placeTick % 12 !== 1) return;
    var frame = document.getElementById('player-frame');
    var top = 92;
    if (frame) {
      var st = window.getComputedStyle(frame);
      if (st.display !== 'none') {
        var b = frame.getBoundingClientRect();
        if (b.height > 1) top = Math.max(top, Math.round(b.bottom) + 14);
      }
    }
    if (top === this._teamPanelTop) return;
    this._teamPanelTop = top;
    this.team0.style.top = top + 'px';
    this.team1.style.top = top + 'px';
  };

  /* El roster se REESTRUCTURA sólo cuando cambia su composición. Reconstruirlo
     con innerHTML sesenta veces por segundo tira los nodos, obliga a recalcular
     el layout entero de la columna y hace que cualquier medida tomada después
     sea un reflujo forzado. Lo que cambia continuamente son dos anchuras. */
  GameShell.prototype._renderTeam = function (root, team, hostile) {
    var i, key = '';
    for (i = 0; i < team.length; i++) key += team[i].id + ':' + team[i].classId + '|';

    if (root._rosterKey !== key) {
      var html = '';
      for (i = 0; i < team.length; i++) {
        var e = team[i], c = Arena.Data.classes[e.classId];
        html += '<div class="team-unit ' + (hostile ? 'hostile' : 'friendly') + '">' +
          '<div class="team-unit-head"><span>' + this._classGlyph(e.classId) + '</span><b>' +
          esc(e.name) + '</b><small>' + esc(c ? c.name : e.classId) + '</small></div>' +
          '<div class="team-hp"><span></span></div><div class="team-res"><span></span></div></div>';
      }
      root.innerHTML = html;
      root._rosterKey = key;
      root._units = [];
      var nodes = root.querySelectorAll('.team-unit');
      for (i = 0; i < nodes.length; i++) {
        root._units.push({
          node: nodes[i],
          hp: nodes[i].querySelector('.team-hp span'),
          res: nodes[i].querySelector('.team-res span'),
          lastHp: -1, lastRes: -1, lastDead: null
        });
      }
    }

    for (i = 0; i < team.length; i++) {
      var u = root._units[i];
      if (!u) continue;
      var ent = team[i];
      var hp = Math.round(pct(ent.hpPct()) * 2) / 2;
      var rs = Math.round(pct(ent.resourcePct()) * 2) / 2;
      var dead = !ent.alive;
      if (u.lastHp !== hp) { u.hp.style.width = hp + '%'; u.lastHp = hp; }
      if (u.lastRes !== rs) { u.res.style.width = rs + '%'; u.lastRes = rs; }
      if (u.lastDead !== dead) { u.node.classList.toggle('dead', dead); u.lastDead = dead; }
    }
  };

  Arena.UI.GameShell = GameShell;
});
