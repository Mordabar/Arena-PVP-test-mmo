/* =============================================================================
 * ui/tooltips.js — Tooltips de habilidad.
 *
 * Los números que muestra se calculan CON el estado real del lanzador: si el
 * Devastador tiene 5 cargas de Ímpetu, el coste que aparece ya lleva el
 * descuento. Un tooltip que miente es peor que no tenerlo.
 * ========================================================================== */
Arena.define('ui/tooltips', ['ui/hud'], function (Arena) {
  'use strict';

  var el = Arena.UI.el;
  var B = Arena.Data.balance;
  var Ability = Arena.Combat.AbilitySystem;

  var GCD_LABEL = {
    none: 'fuera de GCD', reactive: 'GCD reactivo',
    short: 'GCD corto', standard: 'GCD estándar'
  };

  function Tooltips(root, world) {
    this.world = world;
    this.node = el('div', '', root);
    this.node.id = 'tooltip';
    this.name = el('div', 'tt-name', this.node);
    this.meta = el('div', 'tt-meta', this.node);
    this.desc = el('div', 'tt-desc', this.node);
    this.tip = el('div', 'tt-tip', this.node);
  }

  Tooltips.prototype.showAbility = function (abilityId, anchorEl, caster) {
    var ab = Arena.Data.abilities[abilityId];
    if (!ab) return this.hide();
    var world = this.world;

    this.name.textContent = ab.name;

    var bits = [];
    bits.push(targetLabel(ab));
    if (ab.range) bits.push(ab.range.toFixed(1) + ' u');
    if (ab.radius) bits.push('radio ' + ab.radius.toFixed(1) + ' u');

    var cost = caster ? Ability.costOf(world, caster, ab) : ab.cost;
    if (ab.cost) {
      var res = B.RESOURCE[caster ? caster.resourceType : 'vigor'];
      var discounted = caster && cost < ab.cost - 0.01;
      bits.push(Math.round(cost) + ' ' + (res ? res.name : '') + (discounted ? ' ▼' : ''));
    }

    var castTime = caster ? Ability.castTimeOf(world, caster, ab) : ab.castTime;
    bits.push(castTime > 0 ? 'casteo ' + castTime.toFixed(2) + ' s' : 'instantáneo');
    if (ab.cooldown) bits.push('recarga ' + ab.cooldown + ' s');
    bits.push(GCD_LABEL[ab.gcd] || ('GCD ' + ab.gcd));

    this.meta.innerHTML = '';
    for (var i = 0; i < bits.length; i++) {
      var s = el('span', '', this.meta);
      s.textContent = bits[i];
    }

    var desc = ab.desc || '';
    // Daño y curación estimados con la potencia real del lanzador.
    var estimate = estimateNumbers(ab, caster);
    if (estimate) desc += '  <b style="color:#ffd98a">' + estimate + '</b>';
    this.desc.innerHTML = desc;

    this.tip.textContent = ab.tip || '';
    this.tip.style.display = ab.tip ? 'block' : 'none';

    this._place(anchorEl);
  };

  Tooltips.prototype.showText = function (title, body, anchorEl) {
    this.name.textContent = title;
    this.meta.innerHTML = '';
    this.desc.textContent = body;
    this.tip.style.display = 'none';
    this._place(anchorEl);
  };

  Tooltips.prototype._place = function (anchorEl) {
    this.node.classList.add('visible');
    var rect = anchorEl.getBoundingClientRect();
    var tip = this.node.getBoundingClientRect();
    var left = rect.left + rect.width / 2 - tip.width / 2;
    var top = rect.top - tip.height - 12;
    if (top < 8) top = rect.bottom + 12;
    left = Math.max(8, Math.min(window.innerWidth - tip.width - 8, left));
    this.node.style.left = left + 'px';
    this.node.style.top = top + 'px';
  };

  Tooltips.prototype.hide = function () {
    this.node.classList.remove('visible');
  };

  function targetLabel(ab) {
    switch (ab.target) {
      case 'self': return 'sobre ti';
      case 'enemy': return 'enemigo';
      case 'ally': return 'aliado';
      case 'allyOrSelf': return 'aliado o tú';
      case 'cone': return 'cono frontal';
      case 'aoeSelf': return 'área a tu alrededor';
      case 'ground': return 'zona en el suelo';
      default: return ab.target;
    }
  }

  function estimateNumbers(ab, caster) {
    if (!caster) return '';
    var out = [];
    var list = ab.effects || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var flat;
      switch (e.type) {
        case 'physicalDamage':
        case 'magicalDamage':
        case 'pureDamage':
          flat = e.flat !== undefined ? e.flat : caster.power * (e.coefficient || 1);
          out.push('≈ ' + Math.round(flat) + ' de daño bruto');
          break;
        case 'heal':
          flat = e.flat !== undefined ? e.flat : caster.healPower * (e.coefficient || 1);
          out.push('≈ ' + Math.round(flat) + ' de curación');
          break;
        case 'barrier':
          flat = e.flat !== undefined ? e.flat : caster.healPower * (e.coefficient || 1);
          out.push('≈ ' + Math.round(flat) + ' de absorción');
          break;
        case 'hot':
          flat = e.flat !== undefined ? e.flat : caster.healPower * (e.coefficient || 1);
          out.push('≈ ' + Math.round(flat) + ' de curación en ' + (e.duration || 8) + ' s');
          break;
        case 'dot':
          flat = e.flat !== undefined ? e.flat : caster.power * (e.coefficient || 1);
          out.push('≈ ' + Math.round(flat) + ' de daño en ' + (e.duration || 6) + ' s');
          break;
        case 'conditional':
          var sub = estimateNumbers({ effects: e.otherwise || e.then || [] }, caster);
          if (sub) out.push(sub);
          break;
      }
    }
    return out.join(' · ');
  }

  Arena.UI.Tooltips = Tooltips;
});
