/* =============================================================================
 * product/matchFlow.js — Estado de producto para lobby → countdown → match → results.
 *
 * Esta máquina NO resuelve daño, muerte ni victoria por sí sola. El integrador
 * le informa cuándo la simulación determinó que un equipo ya no tiene miembros
 * vivos. Así mantenemos la frontera SIMULATION → EVENTS → PRODUCT PRESENTATION.
 * ========================================================================== */
Arena.define('product/matchFlow', ['product/ladder'], function (Arena) {
  'use strict';

  function MatchFlow(opts) {
    opts = opts || {};
    this.phase = 'LOBBY';
    this.mode = '1v1';
    this.classId = opts.classId || 'devastador';
    this.countdown = 0;
    this.matchElapsed = 0;
    this.result = null;
    this.round = 0;
    this.profile = Arena.Product.Ladder.sanitize(opts.profile);
    this._onChange = opts.onChange || function () {};
  }

  MatchFlow.prototype._emit = function (reason) {
    this._onChange(this.snapshot(), reason || 'update');
  };

  MatchFlow.prototype.snapshot = function () {
    return {
      phase: this.phase, mode: this.mode, classId: this.classId,
      countdown: this.countdown, matchElapsed: this.matchElapsed,
      result: this.result, round: this.round, profile: this.profile
    };
  };

  MatchFlow.prototype.enterLobby = function () {
    this.phase = 'LOBBY';
    this.countdown = 0;
    this.matchElapsed = 0;
    this.result = null;
    this._emit('lobby');
  };

  MatchFlow.prototype.begin = function (mode, classId, countdownSeconds) {
    this.mode = mode === '2v2' ? '2v2' : (mode === 'training' ? 'training' : '1v1');
    this.classId = classId || this.classId;
    this.result = null;
    this.matchElapsed = 0;
    this.round++;
    if (this.mode === 'training') {
      this.phase = 'ACTIVE';
      this.countdown = 0;
    } else {
      this.phase = 'COUNTDOWN';
      this.countdown = countdownSeconds === undefined ? 3.0 : Math.max(0, countdownSeconds);
    }
    this._emit('begin');
  };

  MatchFlow.prototype.update = function (realDt) {
    realDt = Math.max(0, Math.min(0.25, Number(realDt) || 0));
    if (this.phase === 'COUNTDOWN') {
      this.countdown = Math.max(0, this.countdown - realDt);
      if (this.countdown <= 0) {
        this.phase = 'ACTIVE';
        this._emit('fight');
      }
    } else if (this.phase === 'ACTIVE') {
      this.matchElapsed += realDt;
    }
  };

  MatchFlow.prototype.finish = function (winnerTeam, info) {
    if (this.phase !== 'ACTIVE' || this.mode === 'training') return null;
    info = info || {};
    var draw = winnerTeam !== 0 && winnerTeam !== 1;
    var won = !draw && winnerTeam === 0;
    var applied = Arena.Product.Ladder.applyResult(this.profile, {
      won: won, draw: draw,
      opponentRating: info.opponentRating || 1000,
      mode: this.mode,
      classId: this.classId,
      opponent: info.opponent || ''
    });
    this.profile = applied.profile;
    this.result = {
      won: won, draw: draw,
      winnerTeam: winnerTeam,
      delta: applied.delta,
      before: applied.before,
      after: applied.after,
      rank: applied.rank,
      duration: this.matchElapsed,
      stats: info.stats || null,
      opponent: info.opponent || ''
    };
    this.phase = 'RESULTS';
    this._emit('finish');
    return this.result;
  };

  Arena.Product.MatchFlow = MatchFlow;
});
